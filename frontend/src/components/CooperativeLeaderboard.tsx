import React, { useEffect, useMemo, useState } from 'react';
import { cooperativeLeaderboardApi } from '../services/novelFeatureApi';
import { useTranslation } from 'react-i18next';

// ============================================
// TYPES
// ============================================
interface CooperativeAccountability {
  cooperative_id?: number | null;
  cooperative_name?: string | null;
  registration_number?: string | null;
  total_items_received?: number | null;
  total_items_returned?: number | null;
  avg_return_hours?: number | null;
  total_disputes?: number | null;
  staff_count?: number | null;
  staff_trust_average?: number | null;
  return_rate_score?: number | null;
  speed_score?: number | null;
  reliability_score?: number | null;
  staff_quality_score?: number | null;
  accountability_score?: number | null;
  accountability_grade?: string | null;
  rank?: number | null;
}

// ============================================
// HELPERS
// ============================================
const clampPct = (value: unknown) => {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
};

const safeNum = (v: unknown, fallback = 0) => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const safeStr = (v: unknown, fallback = '') => {
  const s = String(v ?? '').trim();
  return s.length ? s : fallback;
};

// ============================================
// COMPONENT
// ============================================
const CooperativeLeaderboard: React.FC = () => {
  const { t } = useTranslation();

  const [cooperatives, setCooperatives] = useState<CooperativeAccountability[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const gradeColors = useMemo(
    () =>
      ({
        A: { bg: '#D1FAE5', text: '#065F46' },
        B: { bg: '#DBEAFE', text: '#1E40AF' },
        C: { bg: '#FEF3C7', text: '#92400E' },
        D: { bg: '#FFE4E6', text: '#9F1239' },
        F: { bg: '#FEE2E2', text: '#991B1B' },
      }) as const,
    []
  );

  type GradeKey = keyof typeof gradeColors;

  const normalizeGrade = (g: unknown): GradeKey => {
    const s = String(g ?? '').trim().toUpperCase();
    return (s in gradeColors ? s : 'F') as GradeKey;
  };

  const metricWeights = useMemo(
    () => [
      { id: 'return_rate', icon: '📦', label: 'Return Rate', weight: '35%' },
      { id: 'speed', icon: '⏱️', label: 'Speed', weight: '25%' },
      { id: 'reliability', icon: '🛡️', label: 'Reliability', weight: '20%' },
      { id: 'staff_quality', icon: '👥', label: 'Staff Quality', weight: '20%' },
    ],
    []
  );

  const loadLeaderboard = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await cooperativeLeaderboardApi.getLeaderboard();
      setCooperatives(res.data?.data || []);
    } catch (err: any) {
      console.error('Leaderboard load error:', err?.response?.data || err?.message);
      setError(t('leaderboard.loadError'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLeaderboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getRankEmoji = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  const getReturnRate = (c: CooperativeAccountability) => {
    const received = safeNum(c.total_items_received, 0);
    const returned = safeNum(c.total_items_returned, 0);
    if (!received) return 'N/A';
    return `${Math.round((returned / received) * 100)}%`;
  };

  const getAvgTime = (hours: number | null | undefined) => {
    const h = typeof hours === 'number' && Number.isFinite(hours) ? hours : null;
    if (h === null) return 'N/A';
    if (h < 24) return `${Math.round(h)}h`;
    return `${Math.round(h / 24)}d`;
  };

  // ✅ Guaranteed-unique key builder
  const buildRowKey = (c: CooperativeAccountability, index: number) => {
    const coopId = c.cooperative_id;
    const reg = safeStr(c.registration_number);
    const name = safeStr(c.cooperative_name);
    const rank = c.rank ?? '';

    // Prefer real identifiers if present
    if (coopId !== null && coopId !== undefined) return `coop-${coopId}`;

    if (reg) return `reg-${reg}`;

    // Composite fallback (still might collide) + index guarantees uniqueness
    const received = safeNum(c.total_items_received, 0);
    const returned = safeNum(c.total_items_returned, 0);
    return `fallback-${name}-${rank}-${received}-${returned}-idx${index}`;
  };

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>📊</div>
        <p style={{ color: '#6B7280' }}>{t('leaderboard.loadingRankings')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <p style={{ color: '#EF4444' }}>{error}</p>
        <button
          onClick={loadLeaderboard}
          style={{
            marginTop: 8,
            padding: '8px 16px',
            background: '#1E3A5F',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
          }}
        >
          {t('common.retry')}
        </button>
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
          Ranking transport cooperatives by their item return performance. Choose cooperatives with higher scores for
          better recovery chances.
        </p>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 12, color: '#6B7280' }}>
          {metricWeights.map((m) => (
            <span key={m.id}>
              {m.icon} {m.label}: {m.weight}
            </span>
          ))}
        </div>
      </div>

      {/* Leaderboard */}
      {cooperatives.length === 0 ? (
        <p style={{ textAlign: 'center', color: '#9CA3AF', padding: 40 }}>{t('leaderboard.noData')}.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {cooperatives.map((coop, index) => {
            const rowKey = buildRowKey(coop, index);

            const gradeKey = normalizeGrade(coop?.accountability_grade);
            const colors = gradeColors[gradeKey];
            const scorePct = clampPct(coop?.accountability_score);

            const rankNum = safeNum(coop.rank, index + 1);

            const received = safeNum(coop.total_items_received, 0);
            const returned = safeNum(coop.total_items_returned, 0);

            return (
              <div
                key={rowKey}
                onClick={() => setExpandedKey(expandedKey === rowKey ? null : rowKey)}
                style={{
                  background: 'white',
                  borderRadius: 12,
                  border: '1px solid #E5E7EB',
                  cursor: 'pointer',
                  transition: 'box-shadow 0.2s',
                  boxShadow: expandedKey === rowKey ? '0 4px 12px rgba(0,0,0,0.08)' : '0 1px 3px rgba(0,0,0,0.05)',
                }}
              >
                {/* Main row */}
                <div
                  style={{
                    padding: '14px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {/* Rank */}
                    <span style={{ fontSize: 20, width: 36, textAlign: 'center' }}>{getRankEmoji(rankNum)}</span>

                    {/* Name & stats */}
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 15, color: '#1F2937' }}>
                        {safeStr(coop.cooperative_name, t('leaderboard.unknownCoop'))}
                      </div>
                      <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                        {returned}/{received} returned
                        {coop.avg_return_hours !== null && coop.avg_return_hours !== undefined && ` • avg ${getAvgTime(coop.avg_return_hours)}`}
                      </div>
                    </div>
                  </div>

                  {/* Grade & Score */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {/* Score bar */}
                    <div style={{ width: 80, textAlign: 'right' }}>
                      <div
                        style={{
                          width: 80,
                          height: 6,
                          background: '#E5E7EB',
                          borderRadius: 3,
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${scorePct}%`,
                            height: '100%',
                            background: scorePct >= 70 ? '#10B981' : scorePct >= 40 ? '#F59E0B' : '#EF4444',
                            borderRadius: 3,
                          }}
                        />
                      </div>
                      <span style={{ fontSize: 11, color: '#6B7280' }}>{Math.round(scorePct)}/100</span>
                    </div>

                    {/* Grade badge */}
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: colors.bg,
                        color: colors.text,
                        fontWeight: 700,
                        fontSize: 16,
                      }}
                      title={`Grade: ${gradeKey}`}
                    >
                      {gradeKey}
                    </div>
                  </div>
                </div>

                {/* Expanded detail */}
                {expandedKey === rowKey && (
                  <div
                    style={{
                      padding: '12px 16px 16px 64px',
                      borderTop: '1px solid #F3F4F6',
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 12,
                    }}
                  >
                    {[
                      { id: 'return_rate_bar', label: 'Return Rate', score: coop.return_rate_score, detail: getReturnRate(coop) },
                      { id: 'speed_bar', label: 'Speed', score: coop.speed_score, detail: getAvgTime(coop.avg_return_hours) },
                      { id: 'reliability_bar', label: 'Reliability', score: coop.reliability_score, detail: `${safeNum(coop.total_disputes, 0)} disputes` },
                      { id: 'staff_quality_bar', label: 'Staff Quality', score: coop.staff_quality_score, detail: `${safeNum(coop.staff_count, 0)} staff, avg trust ${safeNum(coop.staff_trust_average, 0)}` },
                    ].map((item) => (
                      <ScoreBar
                        key={`${rowKey}-${item.id}`}
                        label={item.label}
                        score={clampPct(item.score)}
                        detail={item.detail}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ============================================
// SUB-COMPONENT: Score Bar
// ============================================
const ScoreBar: React.FC<{ label: string; score: number; detail: string }> = ({ label, score, detail }) => {
  const pct = clampPct(score);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: '#374151' }}>{label}</span>
        <span style={{ fontSize: 11, color: '#6B7280' }}>{detail}</span>
      </div>
      <div style={{ width: '100%', height: 6, background: '#E5E7EB', borderRadius: 3, overflow: 'hidden' }}>
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            borderRadius: 3,
            background: pct >= 70 ? '#10B981' : pct >= 40 ? '#F59E0B' : '#EF4444',
            transition: 'width 0.5s ease',
          }}
        />
      </div>
    </div>
  );
};

export default CooperativeLeaderboard;