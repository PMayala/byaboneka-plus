/**
 * ============================================
 * Google reCAPTCHA v3 Hook for Byaboneka+
 * ============================================
 * 
 * Invisible reCAPTCHA — no checkbox, no puzzle.
 * Scores each action 0.0 (bot) to 1.0 (human).
 * Backend verifies the token and checks the score.
 * 
 * Setup:
 * 1. Go to https://www.google.com/recaptcha/admin
 * 2. Create a v3 site → get SITE KEY and SECRET KEY
 * 3. Set VITE_RECAPTCHA_SITE_KEY in frontend .env
 * 4. Set RECAPTCHA_SECRET_KEY in backend .env
 */

import { useCallback, useEffect, useRef } from 'react';

const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY || '';

// Track if script is already loading/loaded globally
let scriptLoaded = false;
let scriptLoading = false;
let loadCallbacks: (() => void)[] = [];

function loadRecaptchaScript(): Promise<void> {
  if (scriptLoaded) return Promise.resolve();
  
  return new Promise((resolve) => {
    if (scriptLoading) {
      loadCallbacks.push(resolve);
      return;
    }
    
    if (!RECAPTCHA_SITE_KEY) {
      console.warn('reCAPTCHA: VITE_RECAPTCHA_SITE_KEY not set — captcha disabled');
      scriptLoaded = true;
      resolve();
      return;
    }
    
    scriptLoading = true;
    
    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`;
    script.async = true;
    script.defer = true;
    
    script.onload = () => {
      scriptLoaded = true;
      scriptLoading = false;
      resolve();
      loadCallbacks.forEach(cb => cb());
      loadCallbacks = [];
    };
    
    script.onerror = () => {
      scriptLoading = false;
      console.error('reCAPTCHA: Failed to load script');
      // Resolve anyway — app should work without captcha
      scriptLoaded = true;
      resolve();
      loadCallbacks.forEach(cb => cb());
      loadCallbacks = [];
    };
    
    document.head.appendChild(script);
  });
}

declare global {
  interface Window {
    grecaptcha: {
      ready: (callback: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
    };
  }
}

/**
 * Hook to use reCAPTCHA v3 in any component.
 * 
 * Usage:
 * ```tsx
 * const { executeRecaptcha, isReady } = useRecaptcha();
 * 
 * const handleSubmit = async () => {
 *   const token = await executeRecaptcha('register');
 *   // Send token to backend with your API call
 *   await authApi.register({ ...data, recaptchaToken: token });
 * };
 * ```
 */
export function useRecaptcha() {
  const isReady = useRef(false);
  
  useEffect(() => {
    loadRecaptchaScript().then(() => {
      isReady.current = true;
    });
  }, []);
  
  const executeRecaptcha = useCallback(async (action: string): Promise<string | null> => {
    // If no site key configured, skip captcha (development mode)
    if (!RECAPTCHA_SITE_KEY) {
      return null;
    }
    
    if (!window.grecaptcha) {
      console.warn('reCAPTCHA: grecaptcha not available');
      return null;
    }
    
    try {
      return await new Promise<string>((resolve, reject) => {
        window.grecaptcha.ready(async () => {
          try {
            const token = await window.grecaptcha.execute(RECAPTCHA_SITE_KEY, { action });
            resolve(token);
          } catch (err) {
            reject(err);
          }
        });
      });
    } catch (error) {
      console.error('reCAPTCHA execution failed:', error);
      return null;
    }
  }, []);
  
  return { executeRecaptcha, isReady: isReady.current };
}

/**
 * Check if reCAPTCHA is configured (has site key)
 */
export function isRecaptchaEnabled(): boolean {
  return !!RECAPTCHA_SITE_KEY;
}
