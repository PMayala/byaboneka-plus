import React, { useState } from 'react';
import { disputeApi, getErrorMessage } from '../services/api';

/**
 * DisputeForm Component for Byaboneka+
 * 
 * Implements CLAIM-07: Dispute mechanism for edge cases
 * Allows users to open a dispute when verification fails despite ownership
 * 
 * FIX #4 & #8: Now uses centralized axios `disputeApi` instead of raw fetch().
 */

interface DisputeFormProps {
  claimId: number;
  claimStatus: string;
  onDisputeOpened?: () => void;
  existingDispute?: {
    id: number;
    status: string;
    reason: string;
    created_at: string;
  } | null;
}

export const DisputeForm: React.FC<DisputeFormProps> = ({
  claimId,
  claimStatus,
  onDisputeOpened,
  existingDispute
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Check if dispute can be opened
  const canDispute = ['PENDING', 'VERIFIED', 'REJECTED'].includes(claimStatus);
  const hasActiveDispute = existingDispute && ['OPEN', 'UNDER_REVIEW'].includes(existingDispute.status);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (reason.trim().length < 20) {
      setError('Please provide a detailed explanation (at least 20 characters)');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await disputeApi.open(claimId, { reason: reason.trim() });
      setSuccess(true);
      onDisputeOpened?.();
    } catch (err: any) {
      setError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (hasActiveDispute) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h4 className="font-medium text-blue-900">Dispute Submitted</h4>
            <p className="text-sm text-blue-700 mt-1">
              Your dispute is currently <span className="font-medium">{existingDispute?.status.replace('_', ' ').toLowerCase()}</span>.
              Our team will review your case and contact you soon.
            </p>
            <p className="text-xs text-blue-600 mt-2">
              Submitted on {new Date(existingDispute!.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!canDispute) {
    return null;
  }

  if (success) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <div>
            <h4 className="font-medium text-green-900">Dispute Submitted Successfully</h4>
            <p className="text-sm text-green-700 mt-1">
              An administrator will review your case within 24-48 hours.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 flex items-center justify-between transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg 
            className="w-5 h-5 text-orange-500" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
            />
          </svg>
          <span className="font-medium text-gray-900">Having issues? Open a Dispute</span>
        </div>
        <svg 
          className={`w-5 h-5 text-gray-500 transform transition-transform ${isOpen ? 'rotate-180' : ''}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Form */}
      {isOpen && (
        <div className="p-4 border-t border-gray-200">
          <p className="text-sm text-gray-600 mb-4">
            If you believe you are the true owner but verification failed, or if there's an issue 
            with the handover process, you can open a dispute. An administrator will review your case.
          </p>

          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Explain your situation <span className="text-red-500">*</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Please explain why you believe you are the rightful owner and why verification may have failed..."
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                rows={4}
                maxLength={2000}
              />
              <p className="text-xs text-gray-500 mt-1">
                {reason.length}/2000 characters (minimum 20)
              </p>
            </div>

            {/* Tips */}
            <div className="bg-gray-50 rounded-lg p-3 mb-4">
              <p className="text-sm text-gray-700 font-medium mb-2">Tips for a successful dispute:</p>
              <ul className="text-xs text-gray-600 space-y-1">
                <li>• Explain what specific details you know about the item</li>
                <li>• Mention if the verification questions might have been set incorrectly</li>
                <li>• Include any additional proof of ownership you can provide</li>
                <li>• Be specific about dates and locations</li>
              </ul>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || reason.trim().length < 20}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Submitting...' : 'Open Dispute'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default DisputeForm;