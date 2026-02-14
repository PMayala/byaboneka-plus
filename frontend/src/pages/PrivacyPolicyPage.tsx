import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Shield } from 'lucide-react';
import { Card } from '../components/ui';

const PrivacyPolicyPage: React.FC = () => {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12">
      <Link to="/" className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-6">
        <ArrowLeft className="w-4 h-4 mr-2" />Back to Home
      </Link>

      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center">
          <Shield className="w-6 h-6 text-primary-600" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Privacy Policy</h1>
          <p className="text-sm text-gray-500">Last updated: February 2026</p>
        </div>
      </div>

      <Card className="p-6 sm:p-8 prose prose-gray max-w-none">
        <h2 className="text-lg font-semibold text-gray-900 mt-0">1. Information We Collect</h2>
        <p className="text-gray-600">
          Byaboneka+ collects information necessary to operate the lost and found platform effectively. 
          This includes your name, email address, phone number (optional), and any item descriptions 
          you provide when reporting lost or found items.
        </p>

        <h2 className="text-lg font-semibold text-gray-900">2. How We Use Your Information</h2>
        <p className="text-gray-600">Your information is used to:</p>
        <ul className="text-gray-600 list-disc pl-5 space-y-1">
          <li>Create and manage your account</li>
          <li>Facilitate lost and found item matching</li>
          <li>Enable secure communication between owners and finders</li>
          <li>Generate and verify handover OTP codes</li>
          <li>Calculate trust scores based on platform activity</li>
          <li>Detect and prevent fraudulent activity</li>
          <li>Send notifications about item matches and claims</li>
        </ul>

        <h2 className="text-lg font-semibold text-gray-900">3. Sensitive Information Protection</h2>
        <p className="text-gray-600">
          Byaboneka+ automatically detects and redacts sensitive information such as national ID numbers, 
          phone numbers, and financial details from item descriptions. This protects your privacy even 
          when descriptions are publicly visible. Verification answers are stored in hashed form and 
          cannot be read by platform administrators.
        </p>

        <h2 className="text-lg font-semibold text-gray-900">4. Data Sharing</h2>
        <p className="text-gray-600">
          We do not sell or share your personal information with third parties. Item descriptions are 
          visible to other users for matching purposes. Your contact details are only shared with 
          verified claimants after successful ownership verification.
        </p>

        <h2 className="text-lg font-semibold text-gray-900">5. Data Security</h2>
        <p className="text-gray-600">
          We implement industry-standard security measures including JWT authentication, 
          bcrypt password hashing, rate limiting, and SQL injection prevention. All API 
          communications are encrypted via HTTPS.
        </p>

        <h2 className="text-lg font-semibold text-gray-900">6. Data Retention</h2>
        <p className="text-gray-600">
          Item reports are automatically expired after 30 days of inactivity. Pending claims 
          expire after 7 days. You may delete your reports at any time. Account data is 
          retained as long as your account is active.
        </p>

        <h2 className="text-lg font-semibold text-gray-900">7. Your Rights</h2>
        <p className="text-gray-600">
          You have the right to access, update, or delete your personal information through 
          your account settings. You may also request a complete data export by contacting 
          our support team.
        </p>

        <h2 className="text-lg font-semibold text-gray-900">8. Contact</h2>
        <p className="text-gray-600">
          For privacy-related inquiries, please contact us at{' '}
          <a href="mailto:privacy@byaboneka.rw" className="text-primary-500 hover:underline">
            privacy@byaboneka.rw
          </a>
        </p>
      </Card>
    </div>
  );
};

export default PrivacyPolicyPage;