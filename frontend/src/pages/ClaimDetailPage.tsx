/**
 * ClaimDetailPage — FIXED
 *
 * Fixes in this version:
 *  1. SafeHandoverLocationPicker REMOVED — safe location feature is deferred (future iposita/police integration).
 *  2. Scroll-to-footer BUG FIXED: messagesEndRef.current?.scrollIntoView() was firing on every
 *     messages state change, including the initial empty-array load, which caused the page to
 *     jump to the bottom on load. Now only scrolls when messages.length > 0.
 *  3. normaliseVerifyResult handles both old `score`/`passed` and new `correct_count`/`verified` shapes.
 *  4. Dispute 404 is silently swallowed — expected when no dispute exists.
 *  5. Messages 404 also silently swallowed — not all claims have messaging open yet.
 *  6. Progress tracker, polling, messaging all intact.
 */
import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Shield,
  CheckCircle,
  XCircle,
  Clock,
  MessageSquare,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { Button, Card, Badge, LoadingSpinner, Alert, Input } from '../components/ui';
import { claimsApi, messagesApi, disputeApi } from '../services/api';
import { HandoverOTPPanel } from '../components/HandoverOTPPanel';
import { DisputeForm } from '../components/DisputeForm';
import { SafetyWarningBanner } from '../components/SafetyWarningBanner';
import { ScamReportButton } from '../components/ScamReportButton';
import SetQuestionsPanel from '../components/SetQuestionsPanel';
import { Claim, Message, CATEGORY_INFO, STATUS_INFO } from '../types';
import { useAuthStore } from '../store/authStore';
import { formatDate } from '../utils/dateUtils';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

/** Normalise the two possible backend response shapes for verify */
function normaliseVerifyResult(raw: any): {
  verified: boolean;
  correct_count: number;
  attempts_remaining: number;
} {
  return {
    verified: raw.verified ?? raw.passed ?? false,
    correct_count: raw.correct_count ?? raw.score ?? 0,
    attempts_remaining: raw.attempts_remaining ?? 0,
  };
}

/** Map claim status to a Badge variant */
function claimBadgeVariant(
  status: string
): 'verified' | 'pending' | 'active' | 'expired' | 'danger' {
  switch (status) {
    case 'VERIFIED':
    case 'RETURNED':
      return 'verified';
    case 'PENDING':
      return 'pending';
    case 'PENDING_QUESTIONS':
      return 'active';
    case 'REJECTED':
    case 'CANCELLED':
    case 'EXPIRED':
    case 'DISPUTED':
      return status === 'DISPUTED' ? 'danger' : 'expired';
    default:
      return 'expired';
  }
}

const ClaimDetailPage: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [claim, setClaim] = useState<Claim | null>(null);
  const [loading, setLoading] = useState(true);

  // Owner-side: answers verification questions
  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState(['', '', '']);
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{
    verified: boolean;
    correct_count: number;
    attempts_remaining: number;
  } | null>(null);

  // Messaging
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Dispute
  const [existingDispute, setExistingDispute] = useState<{
    id: number;
    status: string;
    reason: string;
    created_at: string;
  } | null>(null);

  // Derived: who is this user in the claim?
  // claimant_id = the person who LOST the item and is CLAIMING it back = Owner
  const isOwner = user?.id === claim?.claimant_id;
  const isFinder = !isOwner;

  /* ─── Data Loading ─── */

  const loadClaim = async () => {
    try {
      const response = await claimsApi.getById(parseInt(id!));
      setClaim(response.data.data);
    } catch (error) {
      toast.error(t('claims.loadError'));
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const loadQuestions = async () => {
    try {
      const response = await claimsApi.getQuestions(parseInt(id!));
      setQuestions(response.data.data.questions || []);
    } catch (error: any) {
      if (error.response?.status === 429) {
        toast.error(t('claims.tooManyAttempts'));
      }
    }
  };

  const loadMessages = async () => {
    try {
      const response = await messagesApi.getMessages(parseInt(id!));
      setMessages(response.data.data || []);
    } catch {
      // Silently ignore — messaging may not be open yet
    }
  };

  const loadDispute = async () => {
    try {
      const response = await disputeApi.get(parseInt(id!));
      if (response.data.success && response.data.data) {
        setExistingDispute(response.data.data);
      }
    } catch {
      // 404 = no dispute exists yet — silently ignore
    }
  };

  /* ─── Effects ─── */

  useEffect(() => {
    loadClaim();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!claim) return;

    if (claim.status === 'PENDING' && isOwner) {
      loadQuestions();
    }

    if (['PENDING', 'VERIFIED', 'RETURNED'].includes(claim.status)) {
      loadMessages();
    }

    if (['PENDING', 'VERIFIED', 'REJECTED'].includes(claim.status)) {
      loadDispute();
    }

    if (pollRef.current) clearInterval(pollRef.current);
    if (!['RETURNED', 'CANCELLED', 'REJECTED', 'EXPIRED'].includes(claim.status)) {
      pollRef.current = setInterval(async () => {
        try {
          const r = await claimsApi.getById(parseInt(id!));
          const fresh = r.data.data;
          setClaim((prev) => {
            if (!prev || prev.status !== fresh.status) return fresh;
            return prev;
          });
          if (['PENDING', 'VERIFIED', 'RETURNED'].includes(fresh.status)) {
            loadMessages();
          }
        } catch {
          // ignore polling errors
        }
      }, 30_000);
    }

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claim?.status, isOwner]);

  // FIX: Only scroll to bottom when there are actual messages.
  // Previously this fired on every render including the initial empty load,
  // causing the page to jump to the footer on first load.
  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  /* ─── Actions ─── */

  const handleVerify = async () => {
    if (answers.some((a) => !a.trim())) {
      toast.error(t('claims.answerAll'));
      return;
    }
    setVerifying(true);
    try {
      const response = await claimsApi.verify(parseInt(id!), answers);
      const result = normaliseVerifyResult(response.data.data);
      setVerificationResult(result);
      if (result.verified) {
        toast.success(t('claims.verificationSuccess'));
        loadClaim();
      } else {
        toast.error(
          `Verification failed. ${result.correct_count}/3 correct. ${result.attempts_remaining} attempts remaining.`
        );
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    setSendingMessage(true);
    try {
      await messagesApi.sendMessage(parseInt(id!), newMessage);
      setNewMessage('');
      loadMessages();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to send message');
    } finally {
      setSendingMessage(false);
    }
  };

  /* ─── Guards ─── */

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }
  if (!claim) return null;

  const statusInfo = STATUS_INFO[claim.status];

  const getUserRole = (): 'owner' | 'finder' | 'coop_staff' => {
    if (user?.role === 'coop_staff') return 'coop_staff';
    if (isOwner) return 'owner';
    return 'finder';
  };

  /* ─── Render ─── */

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Back */}
      <Link
        to="/dashboard"
        className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Dashboard
      </Link>

      {/* ── Status header ── */}
      <Card className="p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <Badge variant={claimBadgeVariant(claim.status)}>
            {statusInfo?.label || claim.status}
          </Badge>
          <span className="text-sm text-gray-500">Claim #{claim.id}</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">{claim.lost_item_title}</h1>
        <p className="text-gray-600">Found item: {claim.found_item_title}</p>
        <p className="text-xs text-gray-400 mt-2">
          Your role:{' '}
          <strong>
            {isOwner
              ? '🙋 Owner / Claimant — you lost this item'
              : '🤝 Finder — you found this item'}
          </strong>
        </p>
      </Card>

      <div className="grid md:grid-cols-3 gap-6">
        {/* ── Main column ── */}
        <div className="md:col-span-2 space-y-6">

          {/* ══ FINDER: Set Questions (PENDING_QUESTIONS) ══ */}
          {claim.status === 'PENDING_QUESTIONS' && isFinder && (
            <SetQuestionsPanel claimId={claim.id} onSuccess={() => loadClaim()} />
          )}

          {/* ══ OWNER: Waiting for finder to set questions ══ */}
          {claim.status === 'PENDING_QUESTIONS' && isOwner && (
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                <h2 className="text-lg font-semibold">Waiting for Verification Questions</h2>
              </div>
              <p className="text-gray-600 mb-3">
                Your claim has been submitted. The finder has been notified and is setting up 3
                verification questions to confirm you are the rightful owner.
              </p>
              <p className="text-sm text-gray-500">
                You'll be able to answer the questions once the finder saves them. This page
                updates automatically every 30 seconds.
              </p>
            </Card>
          )}

          {/* ══ OWNER: Answer verification questions (PENDING) ══ */}
          {claim.status === 'PENDING' && isOwner && (
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <Shield className="w-6 h-6 text-primary-500" />
                <h2 className="text-lg font-semibold">Verification Challenge</h2>
              </div>
              {questions.length > 0 ? (
                <div className="space-y-4">
                  {questions.map((q, i) => (
                    <div key={i}>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Q{i + 1}: {q}
                      </label>
                      <Input
                        value={answers[i]}
                        onChange={(e) => {
                          const a = [...answers];
                          a[i] = e.target.value;
                          setAnswers(a);
                        }}
                        placeholder={t('claims.yourAnswer')}
                      />
                    </div>
                  ))}

                  {verificationResult && (
                    <Alert type={verificationResult.verified ? 'success' : 'error'}>
                      {verificationResult.verified ? (
                        <CheckCircle className="w-4 h-4 inline mr-2" />
                      ) : (
                        <XCircle className="w-4 h-4 inline mr-2" />
                      )}
                      {verificationResult.verified
                        ? 'Verification successful! You can now proceed to handover.'
                        : `${verificationResult.correct_count}/3 correct. ${verificationResult.attempts_remaining} attempt(s) remaining.`}
                    </Alert>
                  )}

                  <Button onClick={handleVerify} loading={verifying} className="w-full">
                    Verify Ownership
                  </Button>
                </div>
              ) : (
                <Alert type="warning">
                  <AlertCircle className="w-4 h-4 inline mr-2" />
                  Questions are not available yet or your daily limit has been reached. Try again
                  later.
                </Alert>
              )}
            </Card>
          )}

          {/* ══ FINDER: Waiting for owner to answer (PENDING) ══ */}
          {claim.status === 'PENDING' && isFinder && (
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-3">
                <Loader2 className="w-5 h-5 text-yellow-500 animate-spin" />
                <h2 className="text-lg font-semibold">Waiting for Owner to Verify</h2>
              </div>
              <p className="text-gray-600 text-sm">
                The owner has been notified and is answering your verification questions. You'll
                see the result here once they submit their answers.
              </p>
            </Card>
          )}

          {/* ══ Handover (VERIFIED) ══ */}
          {claim.status === 'VERIFIED' && (
            <>
              <Card className="p-4 border-l-4 border-blue-500 bg-blue-50">
                <p className="text-sm text-blue-900">
                  {isOwner ? (
                    <>
                      <strong>📱 Your turn (Owner):</strong> Tap{' '}
                      <em>Generate Handover Code</em> below, then meet the finder in person and
                      read them the 6-digit code. <strong>Only share it face-to-face.</strong>
                    </>
                  ) : (
                    <>
                      <strong>🤝 Your turn (Finder):</strong> Meet the owner in person. They
                      will generate a 6-digit code — enter it below to confirm the handover and
                      close this claim.
                    </>
                  )}
                </p>
              </Card>

              {/* Add these definitions above your return:
                  const userRole = ...
                  const handleHandoverComplete = ...
              */}

              {user && claim?.claimant_id && claim?.finder_id && (
                <HandoverOTPPanel
                  claimId={claim.id}
                  claimStatus={claim.status}
                  userRole={getUserRole()}
                  userId={user.id}
                  claimantId={claim.claimant_id}
                  finderId={claim.finder_id}
                  onHandoverComplete={() => loadClaim()}
                />
              )}
            </>
          )}

          {/* ══ Returned ══ */}
          {claim.status === 'RETURNED' && (
            <Card className="p-6 bg-trust-50 border-trust-200 text-center">
              <CheckCircle className="w-16 h-16 text-trust-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-trust-800">Item Successfully Returned! 🎉</h2>
              <p className="text-trust-700 mt-2">
                Great job! This claim has been completed.
              </p>
            </Card>
          )}

          {/* ══ Cancelled / Rejected / Expired ══ */}
          {['CANCELLED', 'REJECTED', 'EXPIRED'].includes(claim.status) && (
            <Card className="p-6">
              <Alert type="error">
                <XCircle className="w-4 h-4 inline mr-2" />
                This claim is <strong>{statusInfo?.label || claim.status}</strong> and no further
                actions are available.
              </Alert>
            </Card>
          )}

          {/* ══ Safety Banner (active claims) ══ */}
          {['PENDING_QUESTIONS', 'PENDING', 'VERIFIED'].includes(claim.status) && (
            <SafetyWarningBanner variant="full" />
          )}

          {/* ══ Messaging (both parties, PENDING / VERIFIED / RETURNED) ══ */}
          {['PENDING', 'VERIFIED', 'RETURNED'].includes(claim.status) && (
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <MessageSquare className="w-5 h-5 text-gray-500" />
                <h2 className="font-semibold text-gray-900">Messages</h2>
              </div>

              <div className="space-y-3 max-h-80 overflow-y-auto mb-4 pr-1">
                {messages.length === 0 ? (
                  <p className="text-center text-gray-500 py-8 text-sm">
                    No messages yet. Start the conversation below.
                  </p>
                ) : (
                  messages.map((m) => (
                    <div key={m.id} className={`flex ${m.is_mine ? 'justify-end' : 'justify-start'}`}>
                      <div className="max-w-[80%]">
                        {!m.is_mine && (
                          <p className="text-xs text-gray-500 mb-1 ml-1">{m.sender_name || 'Other party'}</p>
                        )}
                        <div
                          className={`p-3 rounded-xl ${
                            m.is_mine ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-900'
                          }`}
                        >
                          {m.is_flagged && (
                            <p className={`text-xs mb-1 ${m.is_mine ? 'text-primary-200' : 'text-orange-600'}`}>
                              ⚠️ This message was flagged for review.
                            </p>
                          )}
                          <p className="text-sm whitespace-pre-wrap">{m.content}</p>
                          <p className={`text-xs mt-1 ${m.is_mine ? 'text-primary-200' : 'text-gray-400'}`}>
                            {formatDate(m.created_at, 'h:mm a')}
                          </p>
                        </div>
                        {!m.is_mine && (
                          <div className="mt-1 ml-1">
                            <ScamReportButton
                              claimId={claim.id}
                              messageId={m.id}
                              reportedUserId={m.sender_id}
                              reportedUserName={m.sender_name || 'Unknown'}
                              onReportSubmitted={() => toast.success(t('scamReport.reportSuccess'))}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              <form onSubmit={sendMessage} className="flex gap-2">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder={t('claims.typeMessage')}
                  className="flex-1"
                />
                <Button type="submit" loading={sendingMessage} disabled={!newMessage.trim()}>
                  {t('claims.sendMessage')}
                </Button>
              </form>

              <p className="text-xs text-gray-400 mt-2">
                🔒 Phone numbers are automatically masked. Never share ID numbers or bank details.
                Use the Report button if you receive suspicious messages.
              </p>
            </Card>
          )}

          {/* ══ Dispute (owner only) ══ */}
          {isOwner && ['PENDING', 'VERIFIED', 'REJECTED'].includes(claim.status) && (
            <DisputeForm
              claimId={claim.id}
              claimStatus={claim.status}
              existingDispute={existingDispute}
              onDisputeOpened={() => loadDispute()}
            />
          )}
        </div>

        {/* ── Sidebar ── */}
        <div>
          <Card className="p-6 mb-6">
            <h3 className="font-semibold text-gray-900 mb-4">Progress</h3>
            <div className="space-y-4">
              {[
                { label: 'Claim Created', done: true },
                { label: 'Questions Set', done: !['PENDING_QUESTIONS'].includes(claim.status) },
                { label: 'Ownership Verified', done: ['VERIFIED', 'RETURNED'].includes(claim.status) },
                { label: 'Item Returned', done: claim.status === 'RETURNED' },
              ].map(({ label, done }) => (
                <div key={label} className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${done ? 'bg-trust-500 text-white' : 'bg-gray-200 text-gray-400'}`}>
                    {done ? <CheckCircle className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                  </div>
                  <span className={done ? 'font-medium text-gray-900' : 'text-gray-400 text-sm'}>
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Related Items</h3>
            <Link to={`/lost-items/${claim.lost_item_id}`} className="block text-sm text-primary-500 hover:underline mb-2">
              View Lost Item Report →
            </Link>
            <Link to={`/found-items/${claim.found_item_id}`} className="block text-sm text-primary-500 hover:underline">
              View Found Item Report →
            </Link>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ClaimDetailPage;