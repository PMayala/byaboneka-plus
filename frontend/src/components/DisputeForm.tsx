import React, { useState } from 'react';
import { disputeApi, getErrorMessage } from '../services/api';
import { useTranslation } from 'react-i18next';

/**
 * DisputeForm Component for Byaboneka+
 * 
 * User-facing dispute creation form
 * Allows users to open disputes when verification fails despite ownership
 * or when there are issues with the handover process.
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
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [evidenceUrls, setEvidenceUrls] = useState<string[]>([]);
  const [newEvidenceUrl, setNewEvidenceUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Check if dispute can be opened
  const canDispute = ['PENDING', 'VERIFIED', 'REJECTED'].includes(claimStatus);
  const hasActiveDispute = existingDispute && ['OPEN', 'UNDER_REVIEW'].includes(existingDispute.status);

  const handleAddEvidence = () => {
    if (newEvidenceUrl.trim() && evidenceUrls.length < 5) {
      setEvidenceUrls([...evidenceUrls, newEvidenceUrl.trim()]);
      setNewEvidenceUrl('');
    }
  };

  const handleRemoveEvidence = (index: number) => {
    setEvidenceUrls(evidenceUrls.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (reason.trim().length < 20) {
      setError(t('disputes.reasonMinLength'));
      return;
    }

    setIsSubmitting(true);
    setError('');
    try {
      await disputeApi.open(claimId, {
        reason: reason.trim(),
        evidence_urls: evidenceUrls
      });
      setSuccess(true);
      setReason('');
      setEvidenceUrls([]);
      onDisputeOpened?.();
    } catch (err: any) {
      setError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Display existing active dispute
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
              Your dispute is currently <span className="font-medium">{existingDispute?.status.replace(/_/g, ' ').toLowerCase()}</span>.
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

  // Cannot dispute if claim status doesn't allow it
  if (!canDispute) {
    return null;
  }

  // Success message
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
      {/* Header/Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 flex items-center justify-between transition-colors text-left"
        type="button"
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
          className={`w-5 h-5 text-gray-500 transform transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
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
            {/* Reason */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Explain your situation <span className="text-red-500">*</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t('disputes.reasonPlaceholder')}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 resize-none"
                rows={4}
                maxLength={2000}
              />
              <p className="text-xs text-gray-500 mt-1">
                {reason.length}/2000 characters (minimum 20)
              </p>
            </div>

            {/* Evidence Upload */}
            <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Evidence Links (Optional - up to 5)
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="url"
                  value={newEvidenceUrl}
                  onChange={(e) => setNewEvidenceUrl(e.target.value)}
                  placeholder="https://example.com/evidence.jpg"
                  className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
                <button
                  type="button"
                  onClick={handleAddEvidence}
                  disabled={!newEvidenceUrl.trim() || evidenceUrls.length >= 5}
                  className="px-3 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Add
                </button>
              </div>
              {evidenceUrls.length > 0 && (
                <div className="space-y-2">
                  {evidenceUrls.map((url, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between gap-2 p-2 bg-white rounded border border-orange-200"
                    >
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-orange-600 hover:text-orange-700 truncate flex-1"
                      >
                        {url}
                      </a>
                      <button
                        type="button"
                        onClick={() => handleRemoveEvidence(idx)}
                        className="text-xs text-red-600 hover:text-red-700 font-medium"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Tips */}
            <div className="bg-orange-50 rounded-lg p-3 mb-4 border border-orange-200">
              <p className="text-sm text-orange-900 font-medium mb-2">Tips for a successful dispute:</p>
              <ul className="text-xs text-orange-800 space-y-1">
                <li>• Explain what specific details you know about the item</li>
                <li>• Mention if the verification questions might have been set incorrectly</li>
                <li>• Include links to any additional proof of ownership you can provide</li>
                <li>• Be specific about dates and locations</li>
                <li>• Describe any technical issues you encountered</li>
              </ul>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
                {error}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setReason('');
                  setEvidenceUrls([]);
                  setError('');
                }}
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
