/**
 * ============================================
 * Google reCAPTCHA v3 Verification Middleware
 * ============================================
 * 
 * Verifies reCAPTCHA tokens sent from the frontend.
 * 
 * - Checks token validity with Google's API
 * - Enforces minimum score threshold (0.5 default)
 * - Validates action name matches expected action
 * - Gracefully degrades: if RECAPTCHA_SECRET_KEY is not set,
 *   requests pass through (captcha disabled)
 * 
 * Setup:
 * 1. https://www.google.com/recaptcha/admin → v3 site
 * 2. Set RECAPTCHA_SECRET_KEY in backend .env
 */

import { Request, Response, NextFunction } from 'express';
import https from 'https';

const RECAPTCHA_SECRET = process.env.RECAPTCHA_SECRET_KEY || '';
const RECAPTCHA_VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';
const MIN_SCORE = parseFloat(process.env.RECAPTCHA_MIN_SCORE || '0.5');

interface RecaptchaResponse {
  success: boolean;
  score: number;
  action: string;
  challenge_ts: string;
  hostname: string;
  'error-codes'?: string[];
}

/**
 * Verify a reCAPTCHA token with Google's API
 */
async function verifyToken(token: string, remoteIp?: string): Promise<RecaptchaResponse> {
  return new Promise((resolve, reject) => {
    const params = new URLSearchParams({
      secret: RECAPTCHA_SECRET,
      response: token,
      ...(remoteIp && { remoteip: remoteIp }),
    });

    const postData = params.toString();

    const req = https.request(
      RECAPTCHA_VERIFY_URL,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            reject(new Error('Failed to parse reCAPTCHA response'));
          }
        });
      }
    );

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

/**
 * Express middleware that verifies reCAPTCHA v3 token.
 * 
 * Expects the token in req.body.recaptchaToken
 * 
 * @param expectedAction - The action name to validate (e.g., 'register', 'login')
 * @param options - Optional overrides
 */
export function requireRecaptcha(
  expectedAction: string,
  options?: { minScore?: number; optional?: boolean }
) {
  const minScore = options?.minScore ?? MIN_SCORE;
  const optional = options?.optional ?? false;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // If secret key not configured, skip captcha (development/graceful degradation)
    if (!RECAPTCHA_SECRET) {
      if (process.env.NODE_ENV === 'development') {
        // Silent pass-through in development
      } else {
        console.warn('reCAPTCHA: RECAPTCHA_SECRET_KEY not set — captcha verification skipped');
      }
      next();
      return;
    }

    const token = req.body.recaptchaToken;

    // If no token provided
    if (!token) {
      if (optional) {
        // Optional mode: allow through but flag it
        (req as any).recaptchaSkipped = true;
        next();
        return;
      }
      res.status(400).json({
        success: false,
        message: 'reCAPTCHA verification required. Please try again.',
      });
      return;
    }

    try {
      const clientIp = req.ip || req.socket.remoteAddress;
      const result = await verifyToken(token, clientIp);

      if (!result.success) {
        console.warn(`reCAPTCHA verification failed:`, result['error-codes']);
        res.status(403).json({
          success: false,
          message: 'reCAPTCHA verification failed. Please refresh and try again.',
        });
        return;
      }

      // Check score
      if (result.score < minScore) {
        console.warn(
          `reCAPTCHA low score: ${result.score} (min: ${minScore}) ` +
          `action: ${result.action} ip: ${clientIp}`
        );
        res.status(403).json({
          success: false,
          message: 'Request blocked for security reasons. Please try again.',
        });
        return;
      }

      // Check action matches (prevents token reuse across different forms)
      if (result.action !== expectedAction) {
        console.warn(
          `reCAPTCHA action mismatch: expected "${expectedAction}", got "${result.action}"`
        );
        res.status(403).json({
          success: false,
          message: 'Security verification mismatch. Please refresh and try again.',
        });
        return;
      }

      // Attach score to request for logging/fraud detection
      (req as any).recaptchaScore = result.score;
      (req as any).recaptchaAction = result.action;

      // Remove token from body so it doesn't interfere with validation schemas
      delete req.body.recaptchaToken;

      next();
    } catch (error) {
      console.error('reCAPTCHA verification error:', error);

      // On error, decide based on optional flag
      if (optional) {
        (req as any).recaptchaError = true;
        next();
        return;
      }

      res.status(500).json({
        success: false,
        message: 'Security verification failed. Please try again.',
      });
    }
  };
}

/**
 * Lightweight check — logs score but never blocks.
 * Use for actions where you want analytics but not enforcement.
 */
export function softRecaptcha(expectedAction: string) {
  return requireRecaptcha(expectedAction, { optional: true, minScore: 0 });
}
