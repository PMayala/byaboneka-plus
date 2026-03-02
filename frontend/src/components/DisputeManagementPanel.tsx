import React, { useState, useEffect } from 'react';
import { adminApi, getErrorMessage } from '../services/api';
import { useTranslation } from 'react-i18next';

/**
 * DisputeManagementPanel Component
 * 
 * Admin interface for resolving disputes
 * Status flow: OPEN -> UNDER_REVIEW -> RESOLVED_OWNER/RESOLVED_FINDER/DISMISSED
 * Includes trust score adjustments based on resolution
 */

interface DisputeDetails {
  id: number;
  claim_id: number;
  initiated_by: number;
  initiator_name: string;
  reason: string;
  evidence_urls?: string[];
  status: 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED_OWNER' | 'RESOLVED_FINDER' | 'DISMISSED';
  admin_notes: string | null;
  resolved_by?: number | null;
  resolved_at?: string | null;
  created_at: string;
  updated_at: string;
  owner_name?: string;
  finder_name?: string;
  item_title?: string;
}

interface DisputeManagementPanelProps {
  dispute: DisputeDetails;
  isAdmin: boolean;
  onResolutionComplete?: () => void;
}

export const DisputeManagementPanel: React.FC<DisputeManagementPanelProps> = ({
  dispute,
  isAdmin,
  onResolutionComplete
}) => {
  const { t } = useTranslation();
  const [resolution, setResolution] = useState<'RESOLVED_OWNER' | 'RESOLVED_FINDER' | 'DISMISSED' | null>(null);
  const [adminNotes, setAdminNotes] = useState(dispute.admin_notes || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showResolutionForm, setShowResolutionForm] = useState(false);

  const isResolved = ['RESOLVED_OWNER', 'RESOLVED_FINDER', 'DISMISSED'].includes(dispute.status);
  const canResolve = isAdmin && !isResolved;

  const resolutionOptions = [
    {
      value: 'RESOLVED_OWNER',
      label: 'Resolved in Favor of Owner',
      description: 'Owner was correct - they get the item. Owner gets +10 trust.',
      color: 'bg-green-50',
      textColor: 'text-green-700'
    },
    {
      value: 'RESOLVED_FINDER',
      label: 'Resolved in Favor of Finder',
      description: 'Finder was correct - claim is rejected. Finder gets +5, owner gets -15 trust.',
      color: 'bg-orange-50',
      textColor: 'text-orange-700'
    },
    {
      value: 'DISMISSED',
      label: 'Dismiss Dispute',
      description: 'Dispute is frivolous or inconclusive. Revert to pending. Initiator gets -5 trust.',
      color: 'bg-gray-50',
      textColor: 'text-gray-700'
    }
  ];

  const handleResolveDispute = async () => {
    if (!resolution || !adminNotes.trim()) {
      setError('Please provide resolution and notes');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await adminApi.resolveDispute(dispute.id, {
        resolution,
        resolution_notes: adminNotes
      });
      setSuccess(response.data.message || 'Dispute resolved successfully.');
      setShowResolutionForm(false);
      onResolutionComplete?.();
    } catch (err: any) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'OPEN':
        return 'bg-red-100 text-red-800';
      case 'UNDER_REVIEW':
        return 'bg-yellow-100 text-yellow-800';
      case 'RESOLVED_OWNER':
        return 'bg-green-100 text-green-800';
      case 'RESOLVED_FINDER':
        return 'bg-orange-100 text-orange-800';
      case 'DISMISSED':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-gray-900">Dispute Resolution</h3>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusBadgeColor(dispute.status)}`}>
            {dispute.status.replace(/_/g, ' ')}
          </span>
        </div>
        <p className="text-sm text-gray-600">
          Claim #{dispute.claim_id} - {dispute.item_title}
        </p>
      </div>

      {/* Content */}
      <div className="p-6 space-y-6">
        {/* Dispute Info */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-500 uppercase font-semibold">Initiated By</p>
            <p className="text-sm font-medium text-gray-900">{dispute.initiator_name}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase font-semibold">Created</p>
            <p className="text-sm font-medium text-gray-900">
              {new Date(dispute.created_at).toLocaleDateString()}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase font-semibold">Item Owner</p>
            <p className="text-sm font-medium text-gray-900">{dispute.owner_name}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase font-semibold">Item Finder</p>
            <p className="text-sm font-medium text-gray-900">{dispute.finder_name}</p>
          </div>
        </div>

        {/* Reason Section */}
        <div>
          <h4 className="text-sm font-semibold text-gray-900 mb-2">Dispute Reason</h4>
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{dispute.reason}</p>
          </div>
        </div>

        {/* Evidence */}
        {dispute.evidence_urls && dispute.evidence_urls.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-2">Evidence Provided</h4>
            <div className="space-y-2">
              {dispute.evidence_urls.map((url, idx) => (
                <a
                  key={idx}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 hover:underline"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Evidence {idx + 1}
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Current Admin Notes */}
        {dispute.admin_notes && !showResolutionForm && (
          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-2">Admin Notes</h4>
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-900">{dispute.admin_notes}</p>
            </div>
          </div>
        )}

        {/* Resolution Form */}
        {canResolve && (
          <>
            {!showResolutionForm ? (
              <button
                onClick={() => setShowResolutionForm(true)}
                className="w-full px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
                type="button"
              >
                Resolve This Dispute
              </button>
            ) : (
              <div className="space-y-4 p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                <h4 className="font-semibold text-gray-900">Resolution Decision</h4>

                {/* Resolution Options */}
                <div className="space-y-3">
                  {resolutionOptions.map((option) => (
                    <label
                      key={option.value}
                      className={`block p-4 rounded-lg border-2 cursor-pointer transition-all ${
                        resolution === option.value
                          ? 'border-indigo-500 bg-indigo-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="resolution"
                        value={option.value}
                        checked={resolution === option.value}
                        onChange={(e) => setResolution(e.target.value as any)}
                        className="mr-3"
                      />
                      <span className="font-medium text-gray-900">{option.label}</span>
                      <p className="text-xs text-gray-600 mt-1">{option.description}</p>
                    </label>
                  ))}
                </div>

                {/* Admin Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Resolution Notes <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="Explain the reasoning for this resolution..."
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                    rows={4}
                    maxLength={2000}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {adminNotes.length}/2000 characters
                  </p>
                </div>

                {/* Error/Success Messages */}
                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                    {error}
                  </div>
                )}
                {success && (
                  <div className="p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
                    {success}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4 border-t border-indigo-200">
                  <button
                    onClick={handleResolveDispute}
                    disabled={loading || !resolution || !adminNotes.trim()}
                    className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    type="button"
                  >
                    {loading ? 'Resolving...' : 'Confirm Resolution'}
                  </button>
                  <button
                    onClick={() => {
                      setShowResolutionForm(false);
                      setResolution(null);
                      setError('');
                      setSuccess('');
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                    type="button"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Resolved State */}
        {isResolved && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <div>
                <h4 className="font-medium text-green-900">Dispute Resolved</h4>
                <p className="text-sm text-green-700 mt-1">
                  Resolved on {new Date(dispute.resolved_at || '').toLocaleDateString()} by admin
                </p>
                <p className="text-sm text-green-700 mt-2">{dispute.admin_notes}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DisputeManagementPanel;
