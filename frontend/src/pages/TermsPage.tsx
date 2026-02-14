import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, FileText } from 'lucide-react';
import { Card } from '../components/ui';

const TermsPage: React.FC = () => {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12">
      <Link to="/" className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-6">
        <ArrowLeft className="w-4 h-4 mr-2" />Back to Home
      </Link>

      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center">
          <FileText className="w-6 h-6 text-primary-600" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Terms of Service</h1>
          <p className="text-sm text-gray-500">Last updated: February 2026</p>
        </div>
      </div>

      <Card className="p-6 sm:p-8 prose prose-gray max-w-none">
        <h2 className="text-lg font-semibold text-gray-900 mt-0">1. Acceptance of Terms</h2>
        <p className="text-gray-600">
          By creating an account or using Byaboneka+, you agree to these Terms of Service. 
          Byaboneka+ is a lost and found platform designed to facilitate the recovery of lost 
          items within Rwanda's transport ecosystem.
        </p>

        <h2 className="text-lg font-semibold text-gray-900">2. User Accounts</h2>
        <p className="text-gray-600">
          You must provide accurate information when creating an account. You are responsible 
          for maintaining the security of your credentials. Each person may only create one 
          account. Accounts found to be duplicates or fraudulent may be suspended.
        </p>

        <h2 className="text-lg font-semibold text-gray-900">3. Reporting Items</h2>
        <p className="text-gray-600">
          When reporting lost or found items, you must provide truthful and accurate descriptions. 
          Deliberately filing false reports, claiming items that don't belong to you, or manipulating 
          item descriptions is prohibited and may result in account suspension and trust score penalties.
        </p>

        <h2 className="text-lg font-semibold text-gray-900">4. Verification & Claims</h2>
        <p className="text-gray-600">
          The verification system is designed to protect rightful owners. You must answer verification 
          questions honestly when claiming items. Attempting to guess or brute-force verification 
          answers is prohibited. Failed verification attempts are logged and may affect your trust score.
        </p>

        <h2 className="text-lg font-semibold text-gray-900">5. Trust Score</h2>
        <p className="text-gray-600">
          Your trust score reflects your reputation on the platform. It increases with successful 
          returns and honest interactions, and decreases with failed verifications, reported scams, 
          or policy violations. Users with very low trust scores may face restrictions.
        </p>

        <h2 className="text-lg font-semibold text-gray-900">6. Prohibited Conduct</h2>
        <ul className="text-gray-600 list-disc pl-5 space-y-1">
          <li>Filing false lost or found item reports</li>
          <li>Claiming items that do not belong to you</li>
          <li>Requesting payment or rewards for returning items</li>
          <li>Harassing or threatening other users</li>
          <li>Attempting to bypass verification or security measures</li>
          <li>Creating multiple accounts to circumvent restrictions</li>
          <li>Sharing personal information of other users outside the platform</li>
        </ul>

        <h2 className="text-lg font-semibold text-gray-900">7. Cooperative Partners</h2>
        <p className="text-gray-600">
          Transport cooperatives using Byaboneka+ agree to register found items promptly, 
          facilitate handovers in good faith, and maintain their staff accounts responsibly. 
          Cooperative accountability scores are publicly visible on the platform leaderboard.
        </p>

        <h2 className="text-lg font-semibold text-gray-900">8. Disputes</h2>
        <p className="text-gray-600">
          If you believe a claim or verification result is incorrect, you may open a dispute. 
          Disputes are reviewed by platform administrators who may examine evidence, messages, 
          and platform logs to reach a resolution. Trust score adjustments may be applied based 
          on dispute outcomes.
        </p>

        <h2 className="text-lg font-semibold text-gray-900">9. Limitation of Liability</h2>
        <p className="text-gray-600">
          Byaboneka+ facilitates connections between item finders and owners but does not 
          guarantee recovery of any item. We are not responsible for the condition of items, 
          the conduct of users during physical meetups, or any losses arising from use of the platform. 
          Always meet at recommended safe handover locations.
        </p>

        <h2 className="text-lg font-semibold text-gray-900">10. Contact</h2>
        <p className="text-gray-600">
          Questions about these terms can be directed to{' '}
          <a href="mailto:support@byaboneka.rw" className="text-primary-500 hover:underline">
            support@byaboneka.rw
          </a>
        </p>
      </Card>
    </div>
  );
};

export default TermsPage;