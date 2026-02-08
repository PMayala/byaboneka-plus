import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Shield, CheckCircle, XCircle, Clock, 
  Key, MessageSquare, AlertCircle, Copy, Check
} from 'lucide-react';
import { Button, Card, Badge, LoadingSpinner, Alert, Input, Modal } from '../components/ui';
import { claimsApi, handoverApi, messagesApi } from '../services/api';
import { Claim, Message, CATEGORY_INFO, STATUS_INFO } from '../types';
import { useAuthStore } from '../store/authStore';
import { formatDate } from '../utils/dateUtils';
import toast from 'react-hot-toast';

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

  const [otp, setOtp] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState<string | null>(null);
  const [otpCopied, setOtpCopied] = useState(false);
  const [generatingOtp, setGeneratingOtp] = useState(false);
  const [confirmingOtp, setConfirmingOtp] = useState(false);
  const [showOtpModal, setShowOtpModal] = useState(false);

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
      setMessages(response.data.data || []);
    } catch (error) {
      console.error('Failed to load messages:', error);
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

  const handleGenerateOtp = async () => {
    setGeneratingOtp(true);
    try {
      const response = await handoverApi.generateOtp(parseInt(id!));
      setGeneratedOtp(response.data.data.otp);
      setShowOtpModal(true);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to generate OTP');
    } finally {
      setGeneratingOtp(false);
    }
  };

  const handleConfirmOtp = async () => {
    if (otp.length !== 6) {
      toast.error('Enter 6-digit OTP');
      return;
    }
    setConfirmingOtp(true);
    try {
      await handoverApi.confirmHandover(parseInt(id!), otp);
      toast.success('Item return confirmed!');
      loadClaim();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Invalid OTP');
    } finally {
      setConfirmingOtp(false);
    }
  };

  const copyOtp = () => {
    if (generatedOtp) {
      navigator.clipboard.writeText(generatedOtp);
      setOtpCopied(true);
      setTimeout(() => setOtpCopied(false), 2000);
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

          {claim.status === 'VERIFIED' && (
            <Card className="p-6 mb-6">
              <div className="flex items-center gap-3 mb-6">
                <Key className="w-6 h-6 text-trust-500" />
                <h2 className="text-lg font-semibold">Handover</h2>
              </div>
              {isOwner ? (
                <div>
                  <Alert type="info" className="mb-4">Generate OTP only when meeting in person!</Alert>
                  <Button onClick={handleGenerateOtp} loading={generatingOtp}><Key className="w-4 h-4 mr-2" />Generate Code</Button>
                </div>
              ) : (
                <div className="flex gap-3">
                  <Input value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6-digit OTP" maxLength={6} className="font-mono text-2xl tracking-widest" />
                  <Button onClick={handleConfirmOtp} loading={confirmingOtp}><CheckCircle className="w-4 h-4 mr-2" />Confirm</Button>
                </div>
              )}
            </Card>
          )}

          {claim.status === 'RETURNED' && (
            <Card className="p-6 mb-6 bg-trust-50 border-trust-200 text-center">
              <CheckCircle className="w-16 h-16 text-trust-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-trust-800">Item Returned! 🎉</h2>
            </Card>
          )}

          {['PENDING', 'VERIFIED'].includes(claim.status) && (
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <MessageSquare className="w-5 h-5 text-gray-500" />
                <h2 className="font-semibold">Messages</h2>
              </div>
              <div className="space-y-3 max-h-80 overflow-y-auto mb-4">
                {messages.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No messages yet</p>
                ) : messages.map((m) => (
                  <div key={m.id} className={`flex ${m.is_mine ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] p-3 rounded-xl ${m.is_mine ? 'bg-primary-500 text-white' : 'bg-gray-100'}`}>
                      <p className="text-sm">{m.content}</p>
                      <p className={`text-xs mt-1 ${m.is_mine ? 'text-primary-200' : 'text-gray-500'}`}>{formatDate(m.created_at, 'h:mm a')}</p>
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
        </div>

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

      <Modal isOpen={showOtpModal} onClose={() => setShowOtpModal(false)} title="Your Handover Code">
        <Alert type="warning" className="mb-4">Only share when receiving item!</Alert>
        <div className="bg-gray-100 rounded-xl p-6 mb-4 text-center">
          <p className="font-mono text-4xl font-bold tracking-widest text-primary-600">{generatedOtp}</p>
        </div>
        <Button variant="secondary" onClick={copyOtp} className="w-full">
          {otpCopied ? <><Check className="w-4 h-4 mr-2" />Copied!</> : <><Copy className="w-4 h-4 mr-2" />Copy</>}
        </Button>
      </Modal>
    </div>
  );
};

export default ClaimDetailPage;
