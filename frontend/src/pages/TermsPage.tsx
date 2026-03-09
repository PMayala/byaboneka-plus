import React from 'react';
import { Link } from 'react-router-dom';
import { FileText, ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const TermsPage: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Link to="/" className="inline-flex items-center text-primary-500 hover:text-primary-600 mb-6">
        <ArrowLeft className="w-4 h-4 mr-1" />
        Back to Home
      </Link>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 md:p-12">
        <div className="flex items-center gap-3 mb-6">
          <FileText className="w-8 h-8 text-primary-500" />
          <h1 className="text-3xl font-bold text-gray-900">Terms of Service</h1>
        </div>
        <p className="text-sm text-gray-500 mb-8">Last updated: February 2026</p>

        <div className="prose prose-gray max-w-none space-y-6">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">1. Acceptance of Terms</h2>
            <p className="text-gray-700 leading-relaxed">
              By creating an account on Byaboneka+ or using our services, you agree to be bound by
              these Terms of Service ("Terms"), our Privacy Policy, and all applicable laws of the
              Republic of Rwanda. If you do not agree to these Terms, do not use the platform.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">2. About Byaboneka+</h2>
            <p className="text-gray-700 leading-relaxed">
              Byaboneka+ is a trust-aware lost and found platform that helps citizens and transport
              cooperatives in Rwanda recover lost items through intelligent matching, secure
              verification, and safe handover protocols. The platform is provided as-is for the
              purpose of connecting people who have lost items with those who have found them.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">3. Eligibility</h2>
            <p className="text-gray-700 leading-relaxed">
              You must be at least 18 years old to create an account. By registering, you confirm
              that you are 18 or older. You must provide accurate information during registration
              and keep your account information current.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">4. User Accounts</h2>
            <p className="text-gray-700 leading-relaxed">
              You are responsible for maintaining the confidentiality of your password and account.
              You agree to notify us immediately of any unauthorized use. You may not share your
              account credentials with others. Each person may maintain only one account.
              We reserve the right to suspend or terminate accounts that violate these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">5. Reporting Lost and Found Items</h2>
            <p className="text-gray-700 leading-relaxed">
              When reporting items, you agree to: provide accurate and truthful descriptions;
              not report items that you know have already been returned; set meaningful verification
              questions that genuinely help identify the item owner; not include sensitive personal
              information (full ID numbers, bank details) in public descriptions — our system
              automatically redacts such information; and upload only images you have the right to share.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">6. Claims and Verification</h2>
            <p className="text-gray-700 leading-relaxed">
              The verification system is designed to ensure items are returned to their rightful owners.
              You agree to: only claim items that genuinely belong to you; answer verification questions
              honestly; not attempt to guess or brute-force verification answers; accept the verification
              result — if you fail verification, you may try again within the daily limits set by your
              trust level; and use the dispute mechanism if you believe verification was unfair.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">7. Handover Protocol</h2>
            <p className="text-gray-700 leading-relaxed">
              For your safety, we strongly recommend meeting at our designated safe handover locations
              (sector offices, police posts, cooperative offices, and transit hubs). The OTP handover
              code should only be shared in person at the meeting point. Never pay money to retrieve
              your item — Byaboneka+ is a free service. Report any requests for payment using the
              Report Scam feature.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">8. Trust Score System</h2>
            <p className="text-gray-700 leading-relaxed">
              Byaboneka+ maintains a trust score for each user. This score affects your daily limits
              for creating reports and claims. Positive actions (successful returns, email verification)
              increase your score. Negative actions (failed verifications, confirmed scam reports)
              decrease it. Users with very low trust scores may have their accounts automatically
              restricted. You can view your trust score and its breakdown in your Settings page.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">9. Prohibited Conduct</h2>
            <p className="text-gray-700 leading-relaxed">You agree not to:</p>
            <p className="text-gray-700 leading-relaxed">
              File false reports or fraudulent claims; demand payment or reward for returning items;
              harass, threaten, or extort other users; share other users' personal information;
              attempt to access accounts belonging to others; use automated tools to interact with
              the platform; circumvent rate limits, fraud detection, or security measures;
              create multiple accounts to circumvent restrictions; or use the platform for any
              illegal purpose.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">10. Cooperative Partners</h2>
            <p className="text-gray-700 leading-relaxed">
              Transport cooperatives using Byaboneka+ are responsible for: training their staff on
              proper item handling; maintaining accurate records of items in their custody; facilitating
              timely handovers; and complying with these Terms and the accountability standards
              reflected in the Cooperative Leaderboard.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">11. Content Moderation</h2>
            <p className="text-gray-700 leading-relaxed">
              We monitor messages for extortion patterns, sensitive data requests, and other harmful
              content. Flagged content may be reviewed by administrators. Users who engage in
              prohibited messaging behavior may have their trust scores reduced or accounts suspended.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">12. Item Expiry</h2>
            <p className="text-gray-700 leading-relaxed">
              Item reports automatically expire after 30 days of inactivity. You will receive a
              warning email 7 days before expiry. Verified claims that do not proceed to handover
              expire after 14 days. Expired items may be archived and eventually deleted per our
              data retention policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">13. Limitation of Liability</h2>
            <p className="text-gray-700 leading-relaxed">
              Byaboneka+ facilitates connections between users but does not guarantee the recovery
              of lost items. We are not responsible for: the actions of other users; the condition
              of returned items; losses incurred from failed claims or handovers; unauthorized access
              to your account due to your failure to protect credentials; or service interruptions
              or technical issues.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">14. Account Termination</h2>
            <p className="text-gray-700 leading-relaxed">
              You may delete your account at any time through Settings → Data & Privacy → Delete Account.
              We may suspend or terminate your account if you violate these Terms, engage in fraud,
              or if your trust score falls to suspension level. Upon termination, your personal data
              will be anonymized in accordance with our Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">15. Intellectual Property</h2>
            <p className="text-gray-700 leading-relaxed">
              The Byaboneka+ platform, including its matching algorithms, trust scoring system,
              fraud detection engine, and user interface, is protected by intellectual property laws.
              You retain ownership of content you upload (item descriptions, images) but grant us a
              license to display and process this content for the purpose of providing the service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">16. Governing Law</h2>
            <p className="text-gray-700 leading-relaxed">
              These Terms are governed by the laws of the Republic of Rwanda. Any disputes arising
              from these Terms or your use of Byaboneka+ shall be subject to the jurisdiction of
              the courts of Rwanda.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">17. Changes to Terms</h2>
            <p className="text-gray-700 leading-relaxed">
              We may update these Terms from time to time. Material changes will be communicated
              via email or in-app notification. Continued use of Byaboneka+ after changes
              constitutes acceptance of the updated Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">18. Contact</h2>
            <p className="text-gray-700 leading-relaxed">
              For questions about these Terms, contact us through the{' '}
              <Link to="/contact" className="text-primary-500 hover:text-primary-600">Contact page</Link>
              {' '}or email mayalaplamedi.rw@gmail.com .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default TermsPage;