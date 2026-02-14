import React, { useState, useEffect } from 'react';
import { handoverApi, getErrorMessage } from '../services/api';

/**
 * HandoverOTPPanel Component for Byaboneka+
 * 
 * Implements secure handover OTP flow:
 * - HAND-01: OTP generation for verified claims
 * - HAND-02: 24-hour validity display
 * - HAND-03: Single-use indication
 * - HAND-04: Finder OTP input
 * - HAND-05: Attempt tracking
 * 
 * FIX #4: Now uses centralized axios `api` instance instead of raw fetch().
 *         This ensures proper auth token injection, refresh handling, and
 *         correct base URL in production (Vercel → Render).
 */

interface HandoverOTPPanelProps {
  claimId: number;
  claimStatus: string;
  userRole: 'owner' | 'finder' | 'coop_staff';
  onHandoverComplete?: () => void;
}

interface HandoverStatus {
  has_otp: boolean;
  otp_verified?: boolean;
  expires_at?: string;
  attempts_used?: number;
  is_expired?: boolean;
}

export const HandoverOTPPanel: React.FC<HandoverOTPPanelProps> = ({
  claimId,
  claimStatus,
  userRole,
  onHandoverComplete
}) => {
  const [status, setStatus] = useState<HandoverStatus | null>(null);
  const [generatedOTP, setGeneratedOTP] = useState<string | null>(null);
  const [otpInput, setOtpInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showOTP, setShowOTP] = useState(false);

  // Fetch handover status
  useEffect(() => {
    fetchHandoverStatus();
  }, [claimId]);

  const fetchHandoverStatus = async () => {
    try {
      const response = await handoverApi.getStatus(claimId);
      if (response.data.success) {
        setStatus(response.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch handover status:', err);
    }
  };

  // Generate OTP (Owner only)
  const handleGenerateOTP = async () => {
    setLoading(true);
    setError('');
    setGeneratedOTP(null);

    try {
      const response = await handoverApi.generateOtp(claimId);
      setGeneratedOTP(response.data.data.otp);
      setSuccess('Handover code generated! Share it only when meeting in person.');
      fetchHandoverStatus();
    } catch (err: any) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // Verify OTP (Finder/Coop only)
  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (otpInput.length !== 6) {
      setError('Please enter a 6-digit code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await handoverApi.confirmHandover(claimId, otpInput);
      setSuccess(response.data.message || 'Handover confirmed!');
      onHandoverComplete?.();
    } catch (err: any) {
      const errData = err.response?.data;
      if (errData?.attempts_remaining !== undefined) {
        setError(`Invalid code. ${errData.attempts_remaining} attempts remaining.`);
      } else {
        setError(getErrorMessage(err));
      }
      fetchHandoverStatus();
    } finally {
      setLoading(false);
      setOtpInput('');
    }
  };

  // Format time remaining
  const getTimeRemaining = () => {
    if (!status?.expires_at) return null;
    const expires = new Date(status.expires_at);
    const now = new Date();
    const diff = expires.getTime() - now.getTime();
    
    if (diff <= 0) return 'Expired';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours}h ${minutes}m remaining`;
  };

  // Claim must be VERIFIED for handover
  if (claimStatus !== 'VERIFIED') {
    return null;
  }

  // Handover already completed
  if (status?.otp_verified) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-green-900">Handover Complete!</h3>
            <p className="text-green-700">The item has been successfully returned to its owner.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 bg-blue-50 border-b border-blue-100">
        <h3 className="text-lg font-semibold text-blue-900 flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          Secure Handover
        </h3>
        <p className="text-sm text-blue-700 mt-1">
          {userRole === 'owner' 
            ? 'Generate a one-time code to confirm the item return.'
            : 'Enter the code provided by the owner to confirm handover.'}
        </p>
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Status Display */}
        {status?.has_otp && !status.is_expired && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Active handover code</span>
              <span className="text-sm font-medium text-blue-600">
                {getTimeRemaining()}
              </span>
            </div>
            {status.attempts_used !== undefined && status.attempts_used > 0 && (
              <p className="text-xs text-orange-600 mt-1">
                {3 - status.attempts_used} verification attempts remaining
              </p>
            )}
          </div>
        )}

        {/* Owner View: Generate OTP */}
        {userRole === 'owner' && (
          <div>
            {generatedOTP ? (
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-3">Your handover code:</p>
                <div className="relative">
                  <div className="text-4xl font-mono font-bold text-blue-600 tracking-widest bg-blue-50 py-4 rounded-lg">
                    {showOTP ? generatedOTP : '••••••'}
                  </div>
                  <button
                    onClick={() => setShowOTP(!showOTP)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showOTP ? (
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-3">
                  Share this code ONLY when you meet the finder in person to collect your item.
                </p>
              </div>
            ) : (
              <div className="text-center">
                {!status?.has_otp || status.is_expired ? (
                  <>
                    <p className="text-sm text-gray-600 mb-4">
                      Ready to collect your item? Generate a secure handover code.
                    </p>
                    <button
                      onClick={handleGenerateOTP}
                      disabled={loading}
                      className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                    >
                      {loading ? 'Generating...' : 'Generate Handover Code'}
                    </button>
                  </>
                ) : (
                  <p className="text-sm text-gray-600">
                    A handover code is already active. Check your records or wait for it to expire.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Finder/Coop View: Verify OTP */}
        {(userRole === 'finder' || userRole === 'coop_staff') && (
          <form onSubmit={handleVerifyOTP}>
            <p className="text-sm text-gray-600 mb-4">
              Enter the 6-digit code provided by the item owner:
            </p>
            <div className="flex gap-3">
              <input
                type="text"
                value={otpInput}
                onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="flex-1 text-center text-2xl font-mono tracking-widest border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                maxLength={6}
              />
              <button
                type="submit"
                disabled={loading || otpInput.length !== 6}
                className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {loading ? 'Verifying...' : 'Confirm'}
              </button>
            </div>
          </form>
        )}

        {/* Messages */}
        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
            {success}
          </div>
        )}

        {/* Instructions */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h4 className="text-sm font-medium text-gray-900 mb-2">How it works:</h4>
          <ol className="text-xs text-gray-600 space-y-1">
            {userRole === 'owner' ? (
              <>
                <li>1. Generate a secure handover code</li>
                <li>2. Meet the finder in a safe, public location</li>
                <li>3. Verify your item before sharing the code</li>
                <li>4. Share the code ONLY after receiving your item</li>
              </>
            ) : (
              <>
                <li>1. Meet the owner at the agreed location</li>
                <li>2. Hand over the item to the verified owner</li>
                <li>3. Ask the owner for the 6-digit handover code</li>
                <li>4. Enter the code here to confirm the return</li>
              </>
            )}
          </ol>
        </div>
      </div>
    </div>
  );
};

export default HandoverOTPPanel;