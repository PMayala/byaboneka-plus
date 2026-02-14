import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Shield, CheckCircle, XCircle, Clock, 
  Key, MessageSquare, AlertCircle, Copy, Check
} from 'lucide-react';
import { Button, Card, Badge, LoadingSpinner, Alert, Input, Modal } from '../components/ui';
import { claimsApi, messagesApi, disputeApi } from '../services/api';
import { HandoverOTPPanel } from '../components/HandoverOTPPanel';
import { DisputeForm } from '../components/DisputeForm';
import { SafetyWarningBanner } from '../components/SafetyWarningBanner';
import { ScamReportButton } from '../components/ScamReportButton';
import SafeHandoverLocationPicker from '../components/SafeHandoverLocationPicker';
import { Claim, Message, CATEGORY_INFO, STATUS_INFO } from '../types';
import { useAuthStore } from '../store/authStore';
import { formatDate } from '../utils/dateUtils';
import toast from 'react-hot-toast';

/**
 * ClaimDetailPage - FIXED VERSION
 * 
 * FIX #13: Now uses HandoverOTPPanel component instead of inline OTP logic
 * FIX #13: Now includes DisputeForm component
 * FIX #15: Now includes SafetyWarningBanner
 * FIX #16: Now includes ScamReportButton on messages
 */

const ClaimDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [claim, setClaim] = useState<Claim | null>(null);
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState(['', '', '']);
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{
    verified: boolean;
    correct_count: number;
    attempts_remaining: number;
  } | null>(null);

  // Dispute state
  const [existingDispute, setExistingDispute] = useState<{
    id: number;
    status: string;
    reason: string;
    created_at: string;
  } | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  const isOwner = user?.id === claim?.claimant_id;

  useEffect(() => {
    loadClaim();
  }, [id]);

  useEffect(() => {
    if (claim?.status === 'PENDING' && isOwner) {
      loadQuestions();
    }
    if (claim && ['VERIFIED', 'PENDING'].includes(claim.status)) {
      loadMessages();
    }
    // Load dispute status for relevant claim states
    if (claim && ['PENDING', 'VERIFIED', 'REJECTED'].includes(claim.status)) {
      loadDispute();
    }
  }, [claim, isOwner]);

  const loadClaim = async () => {
    try {
      const response = await claimsApi.getById(parseInt(id!));
      setClaim(response.data.data);
    } catch (error) {
      toast.error('Failed to load claim');
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
        toast.error('Too many verification attempts. Please try again tomorrow.');
      }
    }
  };

  const loadMessages = async () => {
    try {
      const response = await messagesApi.getMessages(parseInt(id!));
      // Backend returns data as array directly (not paginated)
      setMessages(response.data.data || []);
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  const loadDispute = async () => {
    try {
      const response = await disputeApi.get(parseInt(id!));
      if (response.data.success && response.data.data) {
        setExistingDispute(response.data.data);
      }
    } catch (error: any) {
      // 404 = no dispute, that's fine
      if (error.response?.status !== 404) {
        console.error('Failed to load dispute:', error);
      }
    }
  };

  const handleVerify = async () => {
    if (answers.some((a) => !a.trim())) {
      toast.error('Please answer all questions');
      return;
    }
    setVerifying(true);
    try {
      const response = await claimsApi.verify(parseInt(id!), answers);
      const result = response.data.data;
      setVerificationResult(result);
      if (result.verified) {
        toast.success('Verification successful! You can now proceed to handover.');
        loadClaim();
      } else {
        toast.error(`Verification failed. ${result.correct_count}/3 correct. ${result.attempts_remaining} attempts remaining.`);
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
      toast.error(error.response?.data?.message || 'Failed to send');
    } finally {
      setSendingMessage(false);
    }
  };

  if (loading) return <div className="flex justify-center py-12"><LoadingSpinner size="lg" /></div>;
  if (!claim) return null;

  const statusInfo = STATUS_INFO[claim.status];

  // Determine the user's role in this claim for the handover panel
  const getUserRole = (): 'owner' | 'finder' | 'coop_staff' => {
    if (user?.role === 'coop_staff') return 'coop_staff';
    if (isOwner) return 'owner';
    return 'finder';
  };

  // Get the other party info for scam reporting
  const getOtherPartyFromMessage = (msg: Message) => {
    return {
      id: msg.sender_id,
      name: msg.sender_name || 'Unknown user',
    };
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Link to="/dashboard" className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-6">
        <ArrowLeft className="w-4 h-4 mr-2" />Back to Dashboard
      </Link>

      <Card className="p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <Badge variant={claim.status === 'VERIFIED' || claim.status === 'RETURNED' ? 'verified' : claim.status === 'PENDING' ? 'pending' : 'expired'}>
            {statusInfo?.label || claim.status}
          </Badge>
          <span className="text-sm text-gray-500">Claim #{claim.id}</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{claim.lost_item_title}</h1>
        <p className="text-gray-600">Claiming: {claim.found_item_title}</p>
      </Card>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          {/* Verification Challenge */}
          {claim.status === 'PENDING' && isOwner && (
            <Card className="p-6 mb-6">
              <div className="flex items-center gap-3 mb-6">
                <Shield className="w-6 h-6 text-primary-500" />
                <h2 className="text-lg font-semibold">Verification Challenge</h2>
              </div>
              {questions.length > 0 ? (
                <div className="space-y-4">
                  {questions.map((q, i) => (
                    <div key={i}>
                      <label className="block text-sm font-medium mb-1">Q{i + 1}: {q}</label>
                      <Input value={answers[i]} onChange={(e) => { const a = [...answers]; a[i] = e.target.value; setAnswers(a); }} placeholder="Your answer" />
                    </div>
                  ))}
                  {verificationResult && (
                    <Alert type={verificationResult.verified ? 'success' : 'error'}>
                      {verificationResult.verified ? <CheckCircle className="w-4 h-4 inline mr-2" /> : <XCircle className="w-4 h-4 inline mr-2" />}
                      {verificationResult.verified 
                        ? 'Verification successful! You can now proceed to handover.'
                        : `${verificationResult.correct_count}/3 correct. ${verificationResult.attempts_remaining} attempts remaining.`}
                    </Alert>
                  )}
                  <Button onClick={handleVerify} loading={verifying} className="w-full">Verify Ownership</Button>
                </div>
              ) : (
                <Alert type="warning"><AlertCircle className="w-4 h-4 inline mr-2" />Cannot load questions. Limit reached?</Alert>
              )}
            </Card>
          )}

          {/* FIX #13: Use the dedicated HandoverOTPPanel component */}
          {claim.status === 'VERIFIED' && (
            <div className="mb-6">
              {/* NOVEL: Safe handover location recommendations */}
              <SafeHandoverLocationPicker
                itemArea={''}
                itemCategory={claim.category || 'OTHER'}
                onSelectLocation={(loc) => console.log('Selected handover location:', loc.name)}
              />
              <div className="mt-4" />
              <HandoverOTPPanel
                claimId={claim.id}
                claimStatus={claim.status}
                userRole={getUserRole()}
                onHandoverComplete={() => loadClaim()}
              />
            </div>
          )}

          {/* Item Returned */}
          {claim.status === 'RETURNED' && (
            <Card className="p-6 mb-6 bg-trust-50 border-trust-200 text-center">
              <CheckCircle className="w-16 h-16 text-trust-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-trust-800">Item Returned! 🎉</h2>
            </Card>
          )}

          {/* FIX #15: Safety Warning Banner */}
          {['PENDING', 'VERIFIED'].includes(claim.status) && (
            <SafetyWarningBanner variant="full" />
          )}

          {/* Messages Section */}
          {['PENDING', 'VERIFIED'].includes(claim.status) && (
            <Card className="p-6 mt-6">
              <div className="flex items-center gap-3 mb-4">
                <MessageSquare className="w-5 h-5 text-gray-500" />
                <h2 className="font-semibold">Messages</h2>
              </div>
              <div className="space-y-3 max-h-80 overflow-y-auto mb-4">
                {messages.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No messages yet</p>
                ) : messages.map((m) => (
                  <div key={m.id} className={`flex ${m.is_mine ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] ${m.is_mine ? '' : ''}`}>
                      <div className={`p-3 rounded-xl ${m.is_mine ? 'bg-primary-500 text-white' : 'bg-gray-100'}`}>
                        {/* FIX: Show warning on flagged messages */}
                        {m.is_flagged && m.warning && (
                          <p className={`text-xs mb-1 ${m.is_mine ? 'text-primary-200' : 'text-orange-600'}`}>
                            ⚠️ {m.warning}
                          </p>
                        )}
                        <p className="text-sm">{m.content}</p>
                        <p className={`text-xs mt-1 ${m.is_mine ? 'text-primary-200' : 'text-gray-500'}`}>{formatDate(m.created_at, 'h:mm a')}</p>
                      </div>
                      {/* FIX #16: ScamReportButton on received messages */}
                      {!m.is_mine && (
                        <div className="mt-1 ml-1">
                          <ScamReportButton
                            claimId={claim.id}
                            messageId={m.id}
                            reportedUserId={m.sender_id}
                            reportedUserName={m.sender_name || 'Unknown'}
                            onReportSubmitted={() => toast.success('Report submitted')}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <form onSubmit={sendMessage} className="flex gap-2">
                <Input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Type message..." className="flex-1" />
                <Button type="submit" loading={sendingMessage}>Send</Button>
              </form>
            </Card>
          )}

          {/* FIX #13: DisputeForm component integration */}
          {isOwner && ['PENDING', 'VERIFIED', 'REJECTED'].includes(claim.status) && (
            <div className="mt-6">
              <DisputeForm
                claimId={claim.id}
                claimStatus={claim.status}
                existingDispute={existingDispute}
                onDisputeOpened={() => loadDispute()}
              />
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div>
          <Card className="p-6 mb-6">
            <h3 className="font-semibold mb-4">Progress</h3>
            <div className="space-y-4">
              {['Created', 'Verified', 'Returned'].map((s, i) => {
                const done = (i === 0) || (i === 1 && claim.status !== 'PENDING') || (i === 2 && claim.status === 'RETURNED');
                return (
                  <div key={s} className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${done ? 'bg-trust-500 text-white' : 'bg-gray-200 text-gray-400'}`}>
                      {done ? <CheckCircle className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                    </div>
                    <span className={done ? 'font-medium' : 'text-gray-500'}>{s}</span>
                  </div>
                );
              })}
            </div>
          </Card>
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Related</h3>
            <Link to={`/lost-items/${claim.lost_item_id}`} className="block text-sm text-primary-500 hover:underline mb-2">Lost Item →</Link>
            <Link to={`/found-items/${claim.found_item_id}`} className="block text-sm text-primary-500 hover:underline">Found Item →</Link>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ClaimDetailPage;