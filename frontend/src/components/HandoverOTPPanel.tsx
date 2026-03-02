// frontend/src/components/HandoverOTPPanel.tsx

import React, { useMemo, useEffect, useState } from 'react';
import { handoverApi, getErrorMessage } from '../services/api';
import { useTranslation } from 'react-i18next';

interface HandoverOTPPanelProps {
  claimId: number;
  claimStatus: string; // expects "VERIFIED" before OTP is allowed
  userRole: 'owner' | 'finder' | 'coop_staff';
  userId: number;
  claimantId: number;
  finderId: number;
  onHandoverComplete?: () => void;
}

interface HandoverStatus {
  has_otp: boolean;
  otp_verified?: boolean;
  expires_at?: string;
  attempts_used?: number;
  is_expired?: boolean;
  message?: string;
}

export const HandoverOTPPanel: React.FC<HandoverOTPPanelProps> = ({
  claimId,
  claimStatus,
  userRole,
  userId,
  claimantId,
  finderId,
  onHandoverComplete,
}) => {
  const { t } = useTranslation();

  const [status, setStatus] = useState<HandoverStatus | null>(null);
  const [generatedOTP, setGeneratedOTP] = useState<string | null>(null);
  const [otpInput, setOtpInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showOTP, setShowOTP] = useState(false);

  // ✅ Correct authorization
  // Owner is the claimant only
  const isOwner = useMemo(
    () => userRole === 'owner' && userId === claimantId,
    [userRole, userId, claimantId]
  );

  // Finder is exactly finderId; coop staff is allowed without matching finderId
  const isFinder = useMemo(() => userRole === 'finder' && userId === finderId, [userRole, userId, finderId]);
  const isCoopStaff = useMemo(() => userRole === 'coop_staff', [userRole]);

  const isUnauthorized = !isOwner && !isFinder && !isCoopStaff;
  const isVerifiedClaim = claimStatus === 'VERIFIED';

  // ✅ UI gates to prevent guaranteed 400/403 calls
  const canGenerateOtp = isOwner && isVerifiedClaim && !(status?.has_otp && !status?.is_expired);
  const canVerifyOtp =
    (isFinder || isCoopStaff) &&
    isVerifiedClaim &&
    !!status?.has_otp &&
    !status?.otp_verified &&
    !status?.is_expired;

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

  // ✅ Important: re-fetch when claimStatus changes to VERIFIED
  useEffect(() => {
    if (isUnauthorized) return;

    setError('');
    setSuccess('');
    setGeneratedOTP(null);

    // Only start handover UI once claim is VERIFIED
    if (isVerifiedClaim) {
      fetchHandoverStatus();
    } else {
      setStatus(null);
    }
  }, [claimId, isUnauthorized, isVerifiedClaim]);

  const handleGenerateOTP = async () => {
    setError('');
    setSuccess('');
    setGeneratedOTP(null);

    if (!isVerifiedClaim) {
      setError(`Claim must be VERIFIED before generating OTP. Current: ${claimStatus}`);
      return;
    }
    if (!isOwner) {
      setError('Only the verified item owner (claimant) can generate the handover code.');
      return;
    }

    setLoading(true);
    try {
      const response = await handoverApi.generateOtp(claimId);
      if (response.data.success) {
        setGeneratedOTP(response.data.data.otp);
        setSuccess('Handover code generated.');
        await fetchHandoverStatus();
      }
    } catch (err: any) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!isVerifiedClaim) {
      setError(`Claim must be VERIFIED before verifying OTP. Current: ${claimStatus}`);
      return;
    }
    if (!(isFinder || isCoopStaff)) {
      setError('Only the finder or cooperative staff can verify the handover code.');
      return;
    }
    if (!status?.has_otp) {
      setError('No handover code found. Ask the owner to generate one first.');
      return;
    }
    if (status.is_expired) {
      setError('Handover code expired. Ask the owner to generate a new one.');
      return;
    }
    if (otpInput.length !== 6) {
      setError('Enter a valid 6-digit code.');
      return;
    }

    setLoading(true);
    try {
      const response = await handoverApi.confirmHandover(claimId, otpInput);
      if (response.data.success) {
        setSuccess(response.data.message || 'Handover completed.');
        setOtpInput('');
        await fetchHandoverStatus();
        onHandoverComplete?.();
      }
    } catch (err: any) {
      setError(getErrorMessage(err));
      await fetchHandoverStatus();
    } finally {
      setLoading(false);
    }
  };

  if (isUnauthorized) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        Only the owner, finder, or cooperative staff can manage handover.
      </div>
    );
  }

  if (!isVerifiedClaim) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="font-semibold">Secure Handover</div>
        <div className="text-sm mt-1">
          Handover OTP is available only when the claim is <b>VERIFIED</b>. Current status: <b>{claimStatus}</b>
        </div>
      </div>
    );
  }

  if (status?.otp_verified) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="font-semibold">Handover Complete</div>
        <div className="text-sm mt-1">Item has been marked as returned.</div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="mb-4">
        <div className="text-lg font-semibold">Secure Handover (OTP)</div>
        <div className="text-sm text-gray-600">
          Owner generates OTP → Finder/Coop verifies OTP to mark item returned.
        </div>
      </div>

      {/* OWNER */}
      {isOwner && (
        <div className="mb-6">
          {generatedOTP ? (
            <div className="text-center">
              <div className="text-sm text-gray-600 mb-2">Handover code:</div>
              <div className="relative">
                <div className="text-4xl font-mono font-bold tracking-widest bg-blue-50 py-4 rounded-lg">
                  {showOTP ? generatedOTP : '••••••'}
                </div>
                <button
                  type="button"
                  onClick={() => setShowOTP((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600"
                >
                  {showOTP ? 'Hide' : 'Show'}
                </button>
              </div>
              <div className="text-xs text-gray-500 mt-2">
                Share this with the finder/cooperative staff during physical handover.
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleGenerateOTP}
              disabled={loading || !canGenerateOtp}
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg disabled:opacity-50"
            >
              {loading ? 'Generating...' : status?.has_otp && !status?.is_expired ? 'OTP already active' : 'Generate OTP'}
            </button>
          )}
        </div>
      )}

      {/* FINDER / COOP */}
      {(isFinder || isCoopStaff) && (
        <div>
          {!status?.has_otp ? (
            <div className="p-3 bg-gray-50 rounded-lg text-sm">
              No handover code generated yet. Ask the owner to generate one first.
            </div>
          ) : status.is_expired ? (
            <div className="p-3 bg-orange-50 rounded-lg text-sm">
              The code expired. Ask the owner to generate a new one.
            </div>
          ) : (
            <form onSubmit={handleVerifyOTP}>
              <div className="text-sm text-gray-600 mb-2">Enter the 6-digit code:</div>
              <div className="flex gap-3">
                <input
                  value={otpInput}
                  onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="flex-1 border rounded-lg px-3 py-2 text-center text-2xl font-mono tracking-widest"
                  placeholder="123456"
                  maxLength={6}
                />
                <button
                  type="submit"
                  disabled={loading || !canVerifyOtp || otpInput.length !== 6}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg disabled:opacity-50"
                >
                  {loading ? 'Verifying...' : 'Verify'}
                </button>
              </div>
              {typeof status.attempts_used === 'number' && (
                <div className="text-xs text-gray-500 mt-2">
                  Attempts used: {status.attempts_used}
                </div>
              )}
            </form>
          )}
        </div>
      )}

      {error && <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm">{error}</div>}
      {success && <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm">{success}</div>}
    </div>
  );
};