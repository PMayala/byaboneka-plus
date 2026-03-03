import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * PrivacyPolicyPage — PRODUCTION VERSION
 *
 * Replaces the placeholder privacy policy with content that:
 * 1. Complies with Rwanda's Data Protection Law (Law N°058/2021)
 * 2. Covers all data collected by Byaboneka+
 * 3. Explains user rights (access, rectification, erasure, portability)
 * 4. Describes trust score processing transparently
 * 5. Covers cookie usage and consent
 *
 * FILE: frontend/src/pages/PrivacyPolicyPage.tsx (FULL REPLACEMENT)
 */
const PrivacyPolicyPage: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Link to="/" className="inline-flex items-center text-primary-500 hover:text-primary-600 mb-6">
        <ArrowLeft className="w-4 h-4 mr-1" />
        Back to Home
      </Link>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 md:p-12">
        <div className="flex items-center gap-3 mb-6">
          <Shield className="w-8 h-8 text-primary-500" />
          <h1 className="text-3xl font-bold text-gray-900">Privacy Policy</h1>
        </div>
        <p className="text-sm text-gray-500 mb-8">Last updated: February 2026</p>

        <div className="prose prose-gray max-w-none space-y-6">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">1. Introduction</h2>
            <p className="text-gray-700 leading-relaxed">
              Byaboneka+ ("we", "us", "our") operates a trust-aware lost and found platform designed
              for Rwanda's transport and public spaces. This Privacy Policy explains how we collect,
              use, store, and protect your personal data in compliance with the Republic of Rwanda's
              Law N°058/2021 Relating to the Protection of Personal Data and Privacy ("the Data Protection Law").
            </p>
            <p className="text-gray-700 leading-relaxed">
              By creating an account or using our services, you acknowledge that you have read and
              understood this policy. Your use of Byaboneka+ is also governed by our Terms of Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">2. Data Controller</h2>
            <p className="text-gray-700 leading-relaxed">
              Byaboneka+ is operated as a capstone project at the African Leadership University, Kigali, Rwanda.
              For data protection inquiries, contact us at: mayalaplamedi.rw@gmail.com
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">3. What Data We Collect</h2>
            <p className="text-gray-700 leading-relaxed mb-3">We collect the following categories of personal data:</p>

            <h3 className="text-lg font-medium text-gray-800 mt-4 mb-2">3.1 Account Information</h3>
            <p className="text-gray-700 leading-relaxed">
              Full name, email address, phone number (optional), and encrypted password.
              We also record whether your email and phone are verified.
            </p>

            <h3 className="text-lg font-medium text-gray-800 mt-4 mb-2">3.2 Item Reports</h3>
            <p className="text-gray-700 leading-relaxed">
              When you report a lost or found item: item category, title, description, location area,
              date of loss/finding, uploaded photographs, and verification security questions and
              their hashed answers.
            </p>

            <h3 className="text-lg font-medium text-gray-800 mt-4 mb-2">3.3 Claims and Verification</h3>
            <p className="text-gray-700 leading-relaxed">
              Claim records linking lost and found items, verification attempt results (pass/fail, number correct),
              handover OTP codes (stored as hashed values), and dispute records.
            </p>

            <h3 className="text-lg font-medium text-gray-800 mt-4 mb-2">3.4 Messages</h3>
            <p className="text-gray-700 leading-relaxed">
              In-app messages exchanged between claim participants. Messages are scanned for extortion
              patterns and sensitive data requests to protect users from fraud.
            </p>

            <h3 className="text-lg font-medium text-gray-800 mt-4 mb-2">3.5 Trust Score</h3>
            <p className="text-gray-700 leading-relaxed">
              We calculate and maintain a trust score for each user based on their platform activity.
              This score increases with successful returns and verifications, and decreases with
              failed verification attempts and confirmed scam reports. The score determines your
              daily limits for reports and claims. You can view your score and how it is calculated
              in your Settings page.
            </p>

            <h3 className="text-lg font-medium text-gray-800 mt-4 mb-2">3.6 Technical Data</h3>
            <p className="text-gray-700 leading-relaxed">
              IP addresses, browser user agent strings, and timestamps are recorded in audit logs
              for security purposes. We use reCAPTCHA v3 (provided by Google) for bot prevention,
              which may collect usage analytics subject to Google's privacy policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">4. Legal Basis for Processing</h2>
            <p className="text-gray-700 leading-relaxed">
              Under Rwanda's Data Protection Law, we process your data on the following bases:
              (a) your consent, given at registration;
              (b) performance of a contract — providing the lost and found matching service;
              (c) legitimate interests — fraud detection, platform safety, and trust scoring;
              (d) legal obligations — audit logs retained as required by law.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">5. How We Use Your Data</h2>
            <p className="text-gray-700 leading-relaxed">
              We use your data to: match lost and found items using our deterministic algorithm;
              verify item ownership through security questions; facilitate safe handovers via OTP codes;
              detect and prevent fraud through behavioral analysis; calculate trust scores;
              send email notifications about matches, claims, and account activity;
              generate cooperative accountability rankings; and comply with legal requirements.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">6. Data Sharing</h2>
            <p className="text-gray-700 leading-relaxed">
              We do not sell your personal data. We share limited data only in these circumstances:
              with verified claim participants (name only, never phone number or email);
              with transport cooperatives when you report items through their network;
              with law enforcement if required by Rwandan law;
              and with Brevo (Sendinblue) for email delivery services.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">7. Privacy-Preserving Features</h2>
            <p className="text-gray-700 leading-relaxed">
              Byaboneka+ automatically detects and redacts sensitive information in item descriptions,
              including Rwanda National ID numbers, phone numbers, IMEI numbers, and bank account numbers.
              These are masked in public views and only visible to verified owners. Location information
              uses sector/neighborhood names rather than exact addresses. Phone numbers are never
              exposed in API responses.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">8. Data Retention</h2>
            <p className="text-gray-700 leading-relaxed">
              Active item reports are retained for 30 days before automatic expiry.
              Expired and returned items are archived after 365 days and permanently deleted
              30 days after archival. Audit logs are retained for legal compliance purposes.
              Messages in resolved claims are retained for 90 days. You may request earlier
              deletion of your data (see Your Rights below).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">9. Data Security</h2>
            <p className="text-gray-700 leading-relaxed">
              We protect your data with: bcrypt password hashing with salt; JWT authentication with
              token rotation; parameterized SQL queries preventing injection; Helmet.js security
              headers; CORS origin whitelisting; rate limiting on all endpoints; input validation
              using Zod schemas; and encrypted HTTPS connections.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">10. Your Rights</h2>
            <p className="text-gray-700 leading-relaxed mb-3">
              Under Rwanda's Data Protection Law, you have the right to:
            </p>
            <p className="text-gray-700 leading-relaxed">
              <strong>Access:</strong> View all data we hold about you via Settings → Data & Privacy → Download My Data.
            </p>
            <p className="text-gray-700 leading-relaxed">
              <strong>Rectification:</strong> Update your name and phone number in Settings → Profile.
            </p>
            <p className="text-gray-700 leading-relaxed">
              <strong>Erasure:</strong> Delete your account and anonymize your data via Settings → Data & Privacy → Delete Account.
              This anonymizes your personal information and removes your active sessions.
            </p>
            <p className="text-gray-700 leading-relaxed">
              <strong>Portability:</strong> Export all your data in JSON format via Settings → Data & Privacy → Download My Data.
            </p>
            <p className="text-gray-700 leading-relaxed">
              <strong>Objection:</strong> Contact us to object to specific processing activities.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">11. Cookies</h2>
            <p className="text-gray-700 leading-relaxed">
              Byaboneka+ uses essential cookies for authentication (JWT tokens stored in browser memory,
              not cookies) and a cookie consent preference. We use Google reCAPTCHA v3 which may set
              its own cookies. You can manage cookie preferences through our cookie consent banner
              that appears on first visit.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">12. Children's Privacy</h2>
            <p className="text-gray-700 leading-relaxed">
              Byaboneka+ is not intended for users under 18 years of age. We require age confirmation
              during registration. If we become aware that a child under 18 has provided personal data
              without parental consent, we will take steps to delete that information.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">13. Changes to This Policy</h2>
            <p className="text-gray-700 leading-relaxed">
              We may update this Privacy Policy from time to time. Changes will be posted on this page
              with an updated revision date. Continued use of Byaboneka+ after changes constitutes
              acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">14. Contact</h2>
            <p className="text-gray-700 leading-relaxed">
              For privacy-related questions or to exercise your rights, contact us through the
              Contact page or email mayalaplamedi.rw@gmail.com. For complaints about our data processing,
              you may also contact the National Cyber Security Authority (NCSA) of Rwanda.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicyPage;