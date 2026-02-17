import React, { useState, useEffect } from 'react';
import { cooperativeLeaderboardApi } from '../services/novelFeatureApi';

// ============================================
// TYPES
// ============================================

interface CooperativeAccountability {
  cooperative_id: number;
  cooperative_name: string;
  registration_number: string;
  total_items_received: number;
  total_items_returned: number;
  avg_return_hours: number | null;
  total_disputes: number;
  staff_count: number;
  staff_trust_average: number;
  return_rate_score: number;
  speed_score: number;
  reliability_score: number;
  staff_quality_score: number;
  accountability_score: number;
  accountability_grade: 'A' | 'B' | 'C' | 'D' | 'F';
  rank: number;
}

// ============================================
// COMPONENT
// ============================================

const CooperativeLeaderboard: React.FC = () => {
  const [cooperatives, setCooperatives] = useState<CooperativeAccountability[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    loadLeaderboard();
  }, []);

  const loadLeaderboard = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await cooperativeLeaderboardApi.getLeaderboard();
      setCooperatives(res.data?.data || []);
    } catch (err: any) {
      console.error('Leaderboard load error:', err?.response?.data || err?.message);
      setError('Failed to load leaderboard. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const gradeColors: Record<string, { bg: string; text: string }> = {
    A: { bg: '#D1FAE5', text: '#065F46' },
    B: { bg: '#DBEAFE', text: '#1E40AF' },
    C: { bg: '#FEF3C7', text: '#92400E' },
    D: { bg: '#FFE4E6', text: '#9F1239' },
    F: { bg: '#FEE2E2', text: '#991B1B' },
  };

  const getRankEmoji = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  const getReturnRate = (c: CooperativeAccountability) => {
    if (c.total_items_received === 0) return 'N/A';
    return `${Math.round((c.total_items_returned / c.total_items_received) * 100)}%`;
  };

  const getAvgTime = (hours: number | null) => {
    if (hours === null) return 'N/A';
    if (hours < 24) return `${Math.round(hours)}h`;
    return `${Math.round(hours / 24)}d`;
  };

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>📊</div>
        <p style={{ color: '#6B7280' }}>Loading cooperative rankings...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <p style={{ color: '#EF4444' }}>{error}</p>
        <button onClick={loadLeaderboard} style={{
          marginTop: 8, padding: '8px 16px', background: '#1E3A5F',
          color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer'
        }}>Retry</button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: 16 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1E3A5F', marginBottom: 4 }}>
          🏆 Cooperative Accountability Index
        </h1>
        <p style={{ fontSize: 14, color: '#6B7280', marginBottom: 12 }}>
          Ranking transport cooperatives by their item return performance. 
          Choose cooperatives with higher scores for better recovery chances.
        </p>
        <div style={{
          display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 12, color: '#6B7280'
        }}>
          <span>📦 Return Rate: 35%</span>
          <span>⏱️ Speed: 25%</span>
          <span>🛡️ Reliability: 20%</span>
          <span>👥 Staff Quality: 20%</span>
        </div>
      </div>

      {/* Leaderboard */}
      {cooperatives.length === 0 ? (
        <p style={{ textAlign: 'center', color: '#9CA3AF', padding: 40 }}>
          No cooperative data available yet.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {cooperatives.map(coop => (
            <div key={coop.cooperative_id}
              onClick={() => setExpandedId(expandedId === coop.cooperative_id ? null : coop.cooperative_id)}
              style={{
                background: 'white', borderRadius: 12,
                border: '1px solid #E5E7EB',
                cursor: 'pointer',
                transition: 'box-shadow 0.2s',
                boxShadow: expandedId === coop.cooperative_id ? '0 4px 12px rgba(0,0,0,0.08)' : '0 1px 3px rgba(0,0,0,0.05)',
              }}
            >
              {/* Main row */}
              <div style={{
                padding: '14px 16px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {/* Rank */}
                  <span style={{ fontSize: 20, width: 36, textAlign: 'center' }}>
                    {getRankEmoji(coop.rank)}
                  </span>
                  
                  {/* Name & stats */}
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15, color: '#1F2937' }}>
                      {coop.cooperative_name}
                    </div>
                    <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                      {coop.total_items_returned}/{coop.total_items_received} returned
                      {coop.avg_return_hours !== null && ` • avg ${getAvgTime(coop.avg_return_hours)}`}
                    </div>
                  </div>
                </div>

                {/* Grade & Score */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {/* Score bar */}
                  <div style={{ width: 80, textAlign: 'right' }}>
                    <div style={{
                      width: 80, height: 6, background: '#E5E7EB',
                      borderRadius: 3, overflow: 'hidden'
                    }}>
                      <div style={{
                        width: `${coop.accountability_score}%`, height: '100%',
                        background: coop.accountability_score >= 70 ? '#10B981' :
                                    coop.accountability_score >= 40 ? '#F59E0B' : '#EF4444',
                        borderRadius: 3
                      }} />
                    </div>
                    <span style={{ fontSize: 11, color: '#6B7280' }}>
                      {coop.accountability_score}/100
                    </span>
                  </div>
                  
                  {/* Grade badge */}
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: gradeColors[coop.accountability_grade].bg,
                    color: gradeColors[coop.accountability_grade].text,
                    fontWeight: 700, fontSize: 16
                  }}>
                    {coop.accountability_grade}
                  </div>
                </div>
              </div>

              {/* Expanded detail */}
              {expandedId === coop.cooperative_id && (
                <div style={{
                  padding: '12px 16px 16px 64px',
                  borderTop: '1px solid #F3F4F6',
                  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12
                }}>
                  <ScoreBar label="Return Rate" score={coop.return_rate_score} detail={getReturnRate(coop)} />
                  <ScoreBar label="Speed" score={coop.speed_score} detail={getAvgTime(coop.avg_return_hours)} />
                  <ScoreBar label="Reliability" score={coop.reliability_score} detail={`${coop.total_disputes} disputes`} />
                  <ScoreBar label="Staff Quality" score={coop.staff_quality_score} detail={`${coop.staff_count} staff, avg trust ${coop.staff_trust_average}`} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================
// SUB-COMPONENT: Score Bar
// ============================================

const ScoreBar: React.FC<{ label: string; score: number; detail: string }> = ({ label, score, detail }) => (
  <div>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
      <span style={{ fontSize: 12, fontWeight: 500, color: '#374151' }}>{label}</span>
      <span style={{ fontSize: 11, color: '#6B7280' }}>{detail}</span>
    </div>
    <div style={{ width: '100%', height: 6, background: '#E5E7EB', borderRadius: 3, overflow: 'hidden' }}>
      <div style={{
        width: `${score}%`, height: '100%', borderRadius: 3,
        background: score >= 70 ? '#10B981' : score >= 40 ? '#F59E0B' : '#EF4444',
        transition: 'width 0.5s ease'
      }} />
    </div>
  </div>
);

export default CooperativeLeaderboard;