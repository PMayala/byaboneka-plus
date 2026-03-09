import React, { useState, useEffect } from 'react';
import { Shield, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

/**
 * Cookie Consent Banner
 * 
 * Required because reCAPTCHA v3 sets cookies (_GRECAPTCHA, NID).
 * Rwanda's Data Protection Law N°058/2021 requires informed consent
 * for non-essential data processing.
 * 
 * This banner:
 * - Shows on first visit
 * - Persists consent in localStorage
 * - Links to Privacy Policy
 * - Blocks reCAPTCHA loading until consent given (graceful degradation already exists)
 */

const CONSENT_KEY = 'byaboneka_cookie_consent';

export const CookieConsentBanner: React.FC = () => {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(CONSENT_KEY);
    if (!consent) {
      // Small delay so it doesn't flash on page load
      const timer = setTimeout(() => setVisible(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem(CONSENT_KEY, 'accepted');
    setVisible(false);
    // Reload to activate reCAPTCHA if it was deferred
    window.dispatchEvent(new Event('cookie-consent-given'));
  };

  const handleDecline = () => {
    localStorage.setItem(CONSENT_KEY, 'declined');
    setVisible(false);
    // reCAPTCHA graceful degradation already handles this
  };

  if (!visible) return null;

  return (
    <div 
      className="fixed bottom-0 left-0 right-0 z-50 animate-slide-up"
      role="dialog"
      aria-label={t('cookies.title')}
    >
      <div className="max-w-4xl mx-auto px-4 pb-4">
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 p-5">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 mb-1">{t('cookies.title')}</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                {t('cookies.description')}{' '}
                <Link to="/privacy" className="text-primary-500 hover:underline">
                  {t('cookies.learnMore')}
                </Link>
              </p>
            </div>
            <button 
              onClick={handleDecline}
              className="text-gray-400 hover:text-gray-600"
              aria-label={t('cookies.dismiss')}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex items-center justify-end gap-3 mt-4">
            <button
              onClick={handleDecline}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-50 transition-colors"
            >
              {t('cookies.decline')}
            </button>
            <button
              onClick={handleAccept}
              className="px-6 py-2 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-lg transition-colors"
            >
              {t('cookies.accept')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Check if user has given cookie consent (for reCAPTCHA gating)
 */
export function hasCookieConsent(): boolean {
  return localStorage.getItem(CONSENT_KEY) === 'accepted';
}

export default CookieConsentBanner;