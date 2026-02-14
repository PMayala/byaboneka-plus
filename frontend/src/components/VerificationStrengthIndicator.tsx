import React, { useState, useEffect, useCallback } from 'react';
import { verificationStrengthApi } from '../services/novelFeatureApi';

// ============================================
// TYPES
// ============================================

interface QuestionAnalysis {
  question_index: number;
  strength: 'WEAK' | 'MODERATE' | 'STRONG';
  score: number;
  issues: string[];
  suggestions: string[];
}

interface StrengthResult {
  overall_strength: 'WEAK' | 'MODERATE' | 'STRONG';
  overall_score: number;
  questions: QuestionAnalysis[];
  redundancy_warning: boolean;
  improvement_tips: string[];
}

interface QuestionTemplate {
  category: string;
  question: string;
  why_effective: string;
}

interface Props {
  questions: string[];
  answers: string[];
  category: string;
  description: string;
  onSelectTemplate?: (index: number, question: string) => void;
}

// ============================================
// COMPONENT
// ============================================

const VerificationStrengthIndicator: React.FC<Props> = ({
  questions, answers, category, description, onSelectTemplate
}) => {
  const [analysis, setAnalysis] = useState<StrengthResult | null>(null);
  const [templates, setTemplates] = useState<QuestionTemplate[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [loading, setLoading] = useState(false);
  const [expandedQuestion, setExpandedQuestion] = useState<number | null>(null);

  // Fetch templates on mount
  useEffect(() => {
    if (category) {
      verificationStrengthApi.getTemplates(category)
        .then(res => setTemplates(res.data?.data || []))
        .catch(() => {});
    }
  }, [category]);

  // Debounced analysis
  const analyzeQuestions = useCallback(async () => {
    const hasContent = questions.some(q => q.length > 3) && answers.some(a => a.length > 0);
    if (!hasContent || !category) return;

    setLoading(true);
    try {
      const res = await verificationStrengthApi.analyzeStrength({
        questions, answers, category, description
      });
      setAnalysis(res.data?.data || null);
    } catch {
      // Silently fail - this is an enhancement, not critical
    } finally {
      setLoading(false);
    }
  }, [questions, answers, category, description]);

  useEffect(() => {
    const timer = setTimeout(analyzeQuestions, 800);
    return () => clearTimeout(timer);
  }, [analyzeQuestions]);

  // ── Strength badge colors ──
  const strengthColors = {
    WEAK: { bg: '#FEE2E2', text: '#991B1B', border: '#FECACA', icon: '⚠️' },
    MODERATE: { bg: '#FEF3C7', text: '#92400E', border: '#FDE68A', icon: '⚡' },
    STRONG: { bg: '#D1FAE5', text: '#065F46', border: '#A7F3D0', icon: '✅' },
  };

  const getScoreBarColor = (score: number) => {
    if (score >= 65) return '#10B981';
    if (score >= 35) return '#F59E0B';
    return '#EF4444';
  };

  if (!analysis && !loading) return null;

  return (
    <div style={{ marginTop: 16, borderRadius: 12, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        background: analysis ? strengthColors[analysis.overall_strength].bg : '#F9FAFB',
        borderBottom: '1px solid #E5E7EB',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>
            {loading ? '⏳' : analysis ? strengthColors[analysis.overall_strength].icon : ''}
          </span>
          <span style={{
            fontWeight: 600, fontSize: 14,
            color: analysis ? strengthColors[analysis.overall_strength].text : '#6B7280'
          }}>
            {loading ? 'Analyzing questions...' :
             analysis ? `Verification Strength: ${analysis.overall_strength}` : ''}
          </span>
        </div>
        {analysis && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 60, height: 6, background: '#E5E7EB', borderRadius: 3, overflow: 'hidden'
            }}>
              <div style={{
                width: `${analysis.overall_score}%`, height: '100%',
                background: getScoreBarColor(analysis.overall_score),
                borderRadius: 3, transition: 'width 0.5s ease'
              }} />
            </div>
            <span style={{ fontSize: 12, color: '#6B7280', fontWeight: 600 }}>
              {analysis.overall_score}/100
            </span>
          </div>
        )}
      </div>

      {/* Per-question analysis */}
      {analysis && (
        <div style={{ padding: '8px 0' }}>
          {analysis.questions.map((qa, i) => (
            <div key={i}
              onClick={() => setExpandedQuestion(expandedQuestion === i ? null : i)}
              style={{
                padding: '8px 16px', cursor: 'pointer',
                borderBottom: i < analysis.questions.length - 1 ? '1px solid #F3F4F6' : 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, color: '#374151' }}>
                  Q{i + 1}: {questions[i]?.substring(0, 40) || '(empty)'}{questions[i]?.length > 40 ? '...' : ''}
                </span>
                <span style={{
                  fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10,
                  background: strengthColors[qa.strength].bg,
                  color: strengthColors[qa.strength].text,
                  border: `1px solid ${strengthColors[qa.strength].border}`
                }}>
                  {qa.strength}
                </span>
              </div>

              {/* Expanded details */}
              {expandedQuestion === i && (
                <div style={{ marginTop: 8, paddingLeft: 8 }}>
                  {qa.issues.length > 0 && (
                    <div style={{ marginBottom: 6 }}>
                      {qa.issues.map((issue, j) => (
                        <div key={j} style={{ fontSize: 12, color: '#DC2626', marginBottom: 2 }}>
                          ⚠ {issue}
                        </div>
                      ))}
                    </div>
                  )}
                  {qa.suggestions.length > 0 && (
                    <div>
                      {qa.suggestions.map((sug, j) => (
                        <div key={j} style={{ fontSize: 12, color: '#059669', marginBottom: 2 }}>
                          💡 {sug}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Redundancy warning */}
      {analysis?.redundancy_warning && (
        <div style={{
          padding: '8px 16px', background: '#FEF3C7',
          fontSize: 13, color: '#92400E', borderTop: '1px solid #FDE68A'
        }}>
          ⚠️ Your questions are too similar to each other. Use different types of questions for better security.
        </div>
      )}

      {/* Templates toggle */}
      <div style={{ padding: '8px 16px', borderTop: '1px solid #E5E7EB' }}>
        <button
          onClick={() => setShowTemplates(!showTemplates)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 13, color: '#1E3A5F', fontWeight: 500,
            padding: 0, textDecoration: 'underline'
          }}
        >
          {showTemplates ? 'Hide' : 'Show'} suggested questions for {category.toLowerCase()} items
        </button>

        {showTemplates && templates.length > 0 && (
          <div style={{ marginTop: 8 }}>
            {templates.map((t, i) => (
              <div key={i} style={{
                padding: '8px 12px', marginBottom: 6, background: '#F0F7FF',
                borderRadius: 8, border: '1px solid #DBEAFE',
                display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#1E3A5F' }}>
                    "{t.question}"
                  </div>
                  <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>
                    {t.why_effective}
                  </div>
                </div>
                {onSelectTemplate && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      // Find next empty question slot
                      const emptyIdx = questions.findIndex(q => !q || q.length < 3);
                      if (emptyIdx >= 0) onSelectTemplate(emptyIdx, t.question);
                    }}
                    style={{
                      background: '#1E3A5F', color: 'white', border: 'none',
                      borderRadius: 6, padding: '4px 10px', fontSize: 11,
                      cursor: 'pointer', whiteSpace: 'nowrap', marginLeft: 8
                    }}
                  >
                    Use this
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default VerificationStrengthIndicator;