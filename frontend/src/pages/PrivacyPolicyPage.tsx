import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Shield } from 'lucide-react';
import { Card } from '../components/ui';
import { useTranslation } from 'react-i18next';

const PrivacyPolicyPage: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12">
      <Link to="/" className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-6">
        <ArrowLeft className="w-4 h-4 mr-2" />{t('common.backToHome')}
      </Link>

      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center">
          <Shield className="w-6 h-6 text-primary-600" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{t('privacy.title')}</h1>
          <p className="text-sm text-gray-500">{t('privacy.lastUpdated')}: February 2026</p>
        </div>
      </div>

      <Card className="p-6 sm:p-8 prose prose-gray max-w-none">
        <h2 className="text-lg font-semibold text-gray-900 mt-0">1. {t('privacy.introTitle')}</h2>
        <p className="text-gray-600">
          Byaboneka+ ("we", "our", "the platform") is a trust-aware lost and found platform 
          operated as part of an academic research project at African Leadership University. 
          This Privacy Policy explains how we collect, use, store, and protect your personal 
          data in compliance with Rwanda's Law N°058/2021 on the Protection of Personal Data 
          and Privacy.
        </p>

        <h2 className="text-lg font-semibold text-gray-900">2. {t('privacy.collectTitle')}</h2>
        <p className="text-gray-600">We collect the following categories of personal data:</p>
        <p className="text-gray-600">
          <strong>Account Information:</strong> Your name, email address, and optionally your 
          phone number, provided during registration. We also record the date you accepted our 
          Terms of Service.
        </p>
        <p className="text-gray-600">
          <strong>Item Reports:</strong> Descriptions, categories, and general location areas 
          (sector/neighborhood level, not exact addresses) of lost or found items you report.
        </p>
        <p className="text-gray-600">
          <strong>Verification Data:</strong> Private security questions and answers you set 
          when reporting lost items. Answers are cryptographically hashed using bcrypt and are 
          never stored in plaintext. Even our administrators cannot see your answers.
        </p>
        <p className="text-gray-600">
          <strong>Images:</strong> Photos you upload of found items, stored securely on our servers.
        </p>
        <p className="text-gray-600">
          <strong>Messages:</strong> In-app messages exchanged between you and other users 
          during the claim process. Messages are visible only to the conversation participants.
        </p>
        <p className="text-gray-600">
          <strong>Platform Activity:</strong> Your trust score (a numerical reputation metric), 
          claim history, verification attempt records, and handover confirmations.
        </p>
        <p className="text-gray-600">
          <strong>Technical Data:</strong> IP addresses and user agent strings, collected for 
          security purposes (fraud detection, audit logging) and stored in our audit logs.
        </p>

        <h2 className="text-lg font-semibold text-gray-900">3. {t('privacy.useTitle')}</h2>
        <p className="text-gray-600">We use your data for the following purposes:</p>
        <ul className="text-gray-600 list-disc pl-5 space-y-1">
          <li>Creating and managing your user account</li>
          <li>Matching lost items with found items using our rule-based algorithm (category, location, time, keywords)</li>
          <li>Verifying ownership claims through private challenge questions</li>
          <li>Generating one-time passwords (OTPs) for secure item handover</li>
          <li>Calculating and maintaining your trust score based on platform behavior</li>
          <li>Detecting and preventing fraud through behavioral analysis</li>
          <li>Enabling secure communication between item owners and finders</li>
          <li>Providing cooperative leaderboard and accountability metrics</li>
          <li>Sending transactional emails (welcome, password reset, expiry warnings)</li>
          <li>Maintaining audit logs for accountability and dispute resolution</li>
        </ul>

        <h2 className="text-lg font-semibold text-gray-900">4. {t('privacy.legalBasis')}</h2>
        <p className="text-gray-600">
          We process your personal data based on: (a) your explicit consent, provided when you 
          accept these terms during registration; (b) the necessity of processing for the 
          performance of the service you have requested; and (c) our legitimate interest in 
          preventing fraud and maintaining platform security.
        </p>

        <h2 className="text-lg font-semibold text-gray-900">5. {t('privacy.sharingTitle')}</h2>
        <p className="text-gray-600">
          We do not sell, rent, or trade your personal data to third parties. Limited data may 
          be shared with:
        </p>
        <ul className="text-gray-600 list-disc pl-5 space-y-1">
          <li><strong>Other Users:</strong> Your name (not email or phone) is visible to users 
          you interact with during claims. Your phone number is never publicly displayed.</li>
          <li><strong>Cooperative Staff:</strong> Staff at transport cooperatives can see item 
          details for items registered at their cooperative, but not your private verification answers.</li>
          <li><strong>Service Providers:</strong> Brevo (email delivery), Render (hosting), 
          Google (reCAPTCHA anti-bot protection). These providers process data under their own 
          privacy policies.</li>
        </ul>

        <h2 className="text-lg font-semibold text-gray-900">6. {t('privacy.protectTitle')}</h2>
        <p className="text-gray-600">We implement the following security measures:</p>
        <ul className="text-gray-600 list-disc pl-5 space-y-1">
          <li>Passwords are hashed using bcrypt (never stored in plaintext)</li>
          <li>Verification answers are cryptographically hashed</li>
          <li>All API communication uses HTTPS encryption</li>
          <li>JWT-based authentication with short-lived access tokens</li>
          <li>Rate limiting on authentication and sensitive endpoints</li>
          <li>Input sanitization to prevent injection attacks</li>
          <li>Security headers via Helmet.js</li>
          <li>Fraud detection engine monitoring for suspicious activity patterns</li>
          <li>Comprehensive audit logging of all critical actions</li>
        </ul>

        <h2 className="text-lg font-semibold text-gray-900">7. {t('privacy.rightsTitle')}</h2>
        <p className="text-gray-600">
          Under Rwanda's Data Protection Law, you have the following rights:
        </p>
        <ul className="text-gray-600 list-disc pl-5 space-y-1">
          <li><strong>Right of Access:</strong> You can view your personal data in your Settings page</li>
          <li><strong>Right to Rectification:</strong> You can update your name and phone number in Settings</li>
          <li><strong>Right to Erasure:</strong> You can delete your account and anonymize your data from Settings → Data & Privacy → Delete Account</li>
          <li><strong>Right to Data Portability:</strong> You can download all your data in JSON format from Settings → Data & Privacy → Download My Data</li>
          <li><strong>Right to Object:</strong> You can contact us to object to specific data processing activities</li>
        </ul>

        <h2 className="text-lg font-semibold text-gray-900">8. {t('privacy.retentionTitle')}</h2>
        <p className="text-gray-600">
          Active item reports are automatically expired after 30 days of inactivity. A warning 
          is sent 7 days before expiry. Expired items are retained for audit purposes but are 
          not publicly visible. Audit logs are retained for legal compliance. When you delete 
          your account, personal data is anonymized immediately, but audit records are preserved 
          as required by law.
        </p>

        <h2 className="text-lg font-semibold text-gray-900">9. {t('privacy.childrenTitle')}</h2>
        <p className="text-gray-600">
          Byaboneka+ is intended for users aged 18 and above. We do not knowingly collect 
          personal data from minors. If we become aware that a minor has created an account, 
          we will take steps to remove their data.
        </p>

        <h2 className="text-lg font-semibold text-gray-900">10. Cookies &amp; Third-Party Services</h2>
        <p className="text-gray-600">
          Byaboneka+ uses Google reCAPTCHA v3 to protect the platform from automated abuse.
          reCAPTCHA may set cookies (including _GRECAPTCHA and NID) and collect usage data
          to distinguish humans from bots. This data is processed by Google under their
          privacy policy. We display a cookie consent banner on your first visit. If you
          decline cookies, reCAPTCHA is disabled and the platform uses graceful fallback
          security measures. No advertising or tracking cookies are used.
        </p>

        <h2 className="text-lg font-semibold text-gray-900">11. {t('privacy.changesTitle')}</h2>
        <p className="text-gray-600">
          We may update this Privacy Policy to reflect changes in our practices. Significant 
          changes will be communicated via email or an in-app notice.
        </p>

        <h2 className="text-lg font-semibold text-gray-900">11. {t('privacy.contactTitle')}</h2>
        <p className="text-gray-600">
          For questions about this Privacy Policy or to exercise your data rights, contact us at{' '}
          <a href="mailto:support@byaboneka.rw" className="text-primary-500 hover:underline">
            support@byaboneka.rw
          </a>
        </p>
      </Card>
    </div>
  );
};

export default PrivacyPolicyPage;
