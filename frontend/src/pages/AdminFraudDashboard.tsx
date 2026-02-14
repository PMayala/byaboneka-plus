import React, { useState, useEffect } from 'react';
import { fraudApi } from '../services/novelFeatureApi';

// ============================================
// TYPES
// ============================================

interface FlaggedUser {
  id: number;
  name: string;
  email: string;
  trust_score: number;
  created_at: string;
  high_risk_events: number;
  failed_verifications_7d: number;
}

// ============================================
// COMPONENT
// ============================================

const AdminFraudDashboard: React.FC = () => {
  const [users, setUsers] = useState<FlaggedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadFlaggedUsers();
  }, []);

  const loadFlaggedUsers = async () => {
    try {
      setLoading(true);
      const res = await fraudApi.getFlaggedUsers();
      setUsers(res.data?.data || []);
    } catch (err) {
      setError('Failed to load fraud alerts');
    } finally {
      setLoading(false);
    }
  };

  const getRiskBadge = (events: number) => {
    if (events >= 5) return { label: 'CRITICAL', bg: '#FEE2E2', color: '#991B1B' };
    if (events >= 3) return { label: 'HIGH', bg: '#FFE4E6', color: '#9F1239' };
    return { label: 'MEDIUM', bg: '#FEF3C7', color: '#92400E' };
  };

  const getTrustColor = (score: number) => {
    if (score >= 5) return '#059669';
    if (score >= 0) return '#6B7280';
    if (score >= -10) return '#D97706';
    return '#DC2626';
  };

  const getAccountAge = (createdAt: string) => {
    const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000);
    if (days === 0) return 'Today';
    if (days === 1) return '1 day';
    if (days < 7) return `${days} days`;
    if (days < 30) return `${Math.floor(days / 7)} weeks`;
    return `${Math.floor(days / 30)} months`;
  };

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <p style={{ color: '#6B7280' }}>Loading fraud alerts...</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 16 }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 20
      }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1E3A5F', marginBottom: 4 }}>
            🚨 Fraud Detection Alerts
          </h2>
          <p style={{ fontSize: 13, color: '#6B7280' }}>
            Users flagged by the behavioral fraud engine in the last 7 days
          </p>
        </div>
        <button onClick={loadFlaggedUsers} style={{
          padding: '8px 16px', background: '#1E3A5F', color: 'white',
          border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13
        }}>
          Refresh
        </button>
      </div>

      {error && (
        <div style={{
          padding: '12px 16px', background: '#FEE2E2', borderRadius: 8,
          color: '#991B1B', marginBottom: 16, fontSize: 13
        }}>
          {error}
        </div>
      )}

      {/* Stats summary */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12,
        marginBottom: 20
      }}>
        <StatCard
          label="Flagged Users"
          value={users.length}
          icon="👤"
          color="#1E3A5F"
        />
        <StatCard
          label="Critical Risk"
          value={users.filter(u => u.high_risk_events >= 5).length}
          icon="🔴"
          color="#DC2626"
        />
        <StatCard
          label="Failed Verifications"
          value={users.reduce((sum, u) => sum + u.failed_verifications_7d, 0)}
          icon="❌"
          color="#D97706"
        />
      </div>

      {/* User list */}
      {users.length === 0 ? (
        <div style={{
          padding: 40, textAlign: 'center', background: '#F0FDF4',
          borderRadius: 12, border: '1px solid #BBF7D0'
        }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
          <p style={{ color: '#065F46', fontWeight: 500 }}>No flagged users</p>
          <p style={{ color: '#6B7280', fontSize: 13 }}>The fraud detection engine has not flagged any users in the last 7 days.</p>
        </div>
      ) : (
        <div style={{
          borderRadius: 12, border: '1px solid #E5E7EB', overflow: 'hidden'
        }}>
          {/* Table header */}
          <div style={{
            display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
            padding: '10px 16px', background: '#F9FAFB',
            borderBottom: '1px solid #E5E7EB',
            fontSize: 12, fontWeight: 600, color: '#6B7280'
          }}>
            <span>User</span>
            <span>Risk Level</span>
            <span>Trust Score</span>
            <span>Failed Claims (7d)</span>
            <span>Account Age</span>
          </div>

          {/* Rows */}
          {users.map(user => {
            const risk = getRiskBadge(user.high_risk_events);
            return (
              <div key={user.id} style={{
                display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
                padding: '12px 16px', borderBottom: '1px solid #F3F4F6',
                alignItems: 'center',
                background: user.high_risk_events >= 5 ? '#FFF5F5' : 'white'
              }}>
                {/* User info */}
                <div>
                  <div style={{ fontWeight: 500, fontSize: 14, color: '#1F2937' }}>
                    {user.name}
                  </div>
                  <div style={{ fontSize: 12, color: '#6B7280' }}>
                    {user.email}
                  </div>
                </div>

                {/* Risk badge */}
                <div>
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: '3px 8px',
                    borderRadius: 8, background: risk.bg, color: risk.color
                  }}>
                    {risk.label} ({user.high_risk_events})
                  </span>
                </div>

                {/* Trust score */}
                <div style={{
                  fontWeight: 600, fontSize: 14,
                  color: getTrustColor(user.trust_score)
                }}>
                  {user.trust_score}
                </div>

                {/* Failed verifications */}
                <div style={{
                  fontWeight: 500, fontSize: 14,
                  color: user.failed_verifications_7d > 3 ? '#DC2626' : '#6B7280'
                }}>
                  {user.failed_verifications_7d}
                </div>

                {/* Account age */}
                <div style={{ fontSize: 13, color: '#6B7280' }}>
                  {getAccountAge(user.created_at)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ============================================
// SUB-COMPONENT: Stat Card
// ============================================

const StatCard: React.FC<{
  label: string; value: number; icon: string; color: string;
}> = ({ label, value, icon, color }) => (
  <div style={{
    padding: '16px', background: 'white', borderRadius: 12,
    border: '1px solid #E5E7EB', textAlign: 'center'
  }}>
    <div style={{ fontSize: 20, marginBottom: 4 }}>{icon}</div>
    <div style={{ fontSize: 24, fontWeight: 700, color }}>{value}</div>
    <div style={{ fontSize: 12, color: '#6B7280' }}>{label}</div>
  </div>
);

export default AdminFraudDashboard;