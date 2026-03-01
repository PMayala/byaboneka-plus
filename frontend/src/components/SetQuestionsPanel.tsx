/**
 * SetQuestionsPanel
 *
 * Displayed to the FINDER when a claim is in PENDING_QUESTIONS status.
 * Allows the finder to create 3 questions (with answers) that the owner
 * must answer to prove ownership. Answers are hashed server-side.
 *
 * After submission the claim moves to PENDING and the owner is notified.
 */
import React, { useState } from 'react';
import { Shield, HelpCircle, CheckCircle, AlertCircle, Plus, Trash2 } from 'lucide-react';
import { Button, Card, Input, Textarea, Alert } from './ui';
import { claimsApi } from '../services/api';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

interface QuestionRow {
  question: string;
  answer: string;
}

interface Props {
  claimId: number;
  onSuccess: () => void;
}

const QUESTION_TIPS = [
  'What colour is the item?',
  'What brand or model is it?',
  'Where exactly did you lose it?',
  'What is written / engraved on it?',
  'What was stored inside it?',
  'What distinguishing mark does it have?',
];

const SetQuestionsPanel: React.FC<Props> = ({ claimId, onSuccess }) => {
  const { t } = useTranslation();

  const [rows, setRows] = useState<QuestionRow[]>([
    { question: '', answer: '' },
    { question: '', answer: '' },
    { question: '', answer: '' },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const updateRow = (index: number, field: keyof QuestionRow, value: string) => {
    setRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
    // Clear error for this field
    const key = `${field}_${index}`;
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    rows.forEach((row, i) => {
      if (!row.question.trim() || row.question.trim().length < 5) {
        newErrors[`question_${i}`] = 'Question must be at least 5 characters';
      }
      if (!row.answer.trim() || row.answer.trim().length < 1) {
        newErrors[`answer_${i}`] = 'Answer is required';
      }
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      await claimsApi.setQuestions(
        claimId,
        rows.map((r) => ({ question: r.question.trim(), answer: r.answer.trim() }))
      );
      toast.success('Verification questions set! The owner has been notified to answer them.');
      onSuccess();
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Failed to save questions. Please try again.';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="p-6 mb-6 border-primary-200">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center flex-shrink-0">
          <Shield className="w-5 h-5 text-primary-600" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Set Ownership Verification Questions</h2>
          <p className="text-sm text-gray-500">
            Someone claims this item is theirs. Create 3 questions only the real owner can answer.
          </p>
        </div>
      </div>

      {/* Instructions */}
      <Alert type="info" className="mb-6">
        <HelpCircle className="w-4 h-4 inline mr-2" />
        <strong>How it works:</strong> You write questions about the item's details. The owner
        answers them privately. If they get at least 2 out of 3 correct, ownership is confirmed and
        they can arrange to collect the item. Answers are hashed — only correctness is checked, not
        the text itself.
      </Alert>

      {/* Tip chips */}
      <div className="mb-5">
        <p className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wide">
          Question ideas (click to use)
        </p>
        <div className="flex flex-wrap gap-2">
          {QUESTION_TIPS.map((tip) => (
            <button
              key={tip}
              type="button"
              onClick={() => {
                const emptyIdx = rows.findIndex((r) => !r.question.trim());
                if (emptyIdx >= 0) {
                  updateRow(emptyIdx, 'question', tip);
                }
              }}
              className="px-3 py-1 text-xs bg-gray-100 hover:bg-primary-50 hover:text-primary-700 rounded-full border border-gray-200 hover:border-primary-300 transition-colors"
            >
              {tip}
            </button>
          ))}
        </div>
      </div>

      {/* Question rows */}
      <div className="space-y-6">
        {rows.map((row, i) => (
          <div key={i} className="p-4 bg-gray-50 rounded-xl border border-gray-200">
            <p className="text-sm font-semibold text-gray-700 mb-3">
              Question {i + 1}
            </p>

            {/* Question text */}
            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Question *
              </label>
              <Input
                value={row.question}
                onChange={(e) => updateRow(i, 'question', e.target.value)}
                placeholder={`e.g. ${QUESTION_TIPS[i] || 'Ask something only the owner would know'}`}
                error={errors[`question_${i}`]}
              />
            </div>

            {/* Answer */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Correct Answer *{' '}
                <span className="text-gray-400 font-normal">
                  (stored securely — never shown to anyone)
                </span>
              </label>
              <Input
                value={row.answer}
                onChange={(e) => updateRow(i, 'answer', e.target.value)}
                placeholder="The correct answer"
                error={errors[`answer_${i}`]}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Privacy note */}
      <p className="text-xs text-gray-400 mt-4 mb-6 flex items-start gap-1">
        <CheckCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-trust-500" />
        Answers are one-way hashed before storage. No one — including admins — can read them. Only
        correctness is verified when the owner responds.
      </p>

      {/* Warning: don't ask for sensitive data */}
      <Alert type="warning" className="mb-6">
        <AlertCircle className="w-4 h-4 inline mr-2" />
        <strong>Do not ask for:</strong> ID numbers, phone numbers, bank details, passwords, or
        money. Questions should be about the item's physical appearance or contents only.
      </Alert>

      {/* Submit */}
      <Button
        onClick={handleSubmit}
        loading={submitting}
        className="w-full"
        disabled={submitting}
      >
        {submitting ? 'Saving questions…' : 'Save Questions & Notify Owner'}
      </Button>
    </Card>
  );
};

export default SetQuestionsPanel;