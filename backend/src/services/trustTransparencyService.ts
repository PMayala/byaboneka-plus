import { query } from '../config/database';
import { getTrustLevel, TRUST_CHANGES } from '../utils';
import { TrustLevel } from '../types';

// ============================================
// TRUST SCORE TRANSPARENCY SERVICE
// "Users can see their score but NOT how it's calculated"
// ============================================

export interface TrustScoreExplanation {
  current_score: number;
  level: TrustLevel;
  level_description: string;
  permissions: {
    daily_report_limit: number;
    daily_claim_limit: number;
    can_generate_otp: boolean;
    can_message: boolean;
  };
  scoring_rules: Array<{
    event: string;
    change: number;
    description: string;
  }>;
  recent_events: Array<{
    change: number;
    reason: string;
    date: string;
  }>;
  next_level: {
    name: string;
    points_needed: number;
  } | null;
}

const LEVEL_DESCRIPTIONS: Record<string, string> = {
  [TrustLevel.SUSPENDED]: 'Your account is suspended due to very low trust. Contact support to resolve.',
  [TrustLevel.RESTRICTED]: 'Your account has restricted access. Positive actions will help improve your standing.',
  [TrustLevel.NEW]: 'You are a new user. Complete verifications and successful returns to build trust.',
  [TrustLevel.ESTABLISHED]: 'You are an established user with a good track record.',
  [TrustLevel.TRUSTED]: 'You are a trusted user with the highest access privileges.',
};

const LEVEL_THRESHOLDS: Array<{ level: TrustLevel; min: number }> = [
  { level: TrustLevel.TRUSTED, min: 15 },
  { level: TrustLevel.ESTABLISHED, min: 5 },
  { level: TrustLevel.NEW, min: 0 },
  { level: TrustLevel.RESTRICTED, min: -10 },
  { level: TrustLevel.SUSPENDED, min: -100 },
];

export async function getTrustScoreExplanation(userId: number): Promise<TrustScoreExplanation> {
  // Get current score
  const userResult = await query(
    'SELECT trust_score FROM users WHERE id = $1',
    [userId]
  );

  if (userResult.rows.length === 0) {
    throw new Error('User not found');
  }

  const currentScore = userResult.rows[0].trust_score;
  const level = getTrustLevel(currentScore);

  // Get recent trust events from audit logs
  const eventsResult = await query(
    `SELECT changes->>'change' as change, changes->>'reason' as reason, timestamp
     FROM audit_logs
     WHERE actor_id = $1 AND action = 'TRUST_SCORE_CHANGED'
     ORDER BY timestamp DESC
     LIMIT 20`,
    [userId]
  );

  const recentEvents = eventsResult.rows.map((row: any) => ({
    change: parseInt(row.change) || 0,
    reason: row.reason || 'Unknown',
    date: row.timestamp
  }));

  // Determine next level
  let nextLevel: { name: string; points_needed: number } | null = null;
  for (const threshold of LEVEL_THRESHOLDS) {
    if (currentScore < threshold.min) {
      nextLevel = {
        name: threshold.level,
        points_needed: threshold.min - currentScore
      };
    }
  }

  // Permissions based on level
  const permissions = {
    daily_report_limit: level === TrustLevel.SUSPENDED ? 0 : level === TrustLevel.RESTRICTED ? 1 : level === TrustLevel.NEW ? 3 : level === TrustLevel.ESTABLISHED ? 5 : 10,
    daily_claim_limit: level === TrustLevel.SUSPENDED ? 0 : level === TrustLevel.RESTRICTED ? 1 : level === TrustLevel.NEW ? 3 : level === TrustLevel.ESTABLISHED ? 5 : 7,
    can_generate_otp: level !== TrustLevel.SUSPENDED,
    can_message: level !== TrustLevel.SUSPENDED,
  };

  // Scoring rules (public transparency)
  const scoringRules = [
    { event: 'Successfully return a found item', change: TRUST_CHANGES.SUCCESSFUL_RETURN_FINDER, description: 'Awarded to the finder when an item is returned via OTP handover' },
    { event: 'Successfully recover your lost item', change: TRUST_CHANGES.SUCCESSFUL_RECOVERY_OWNER, description: 'Awarded to the owner when they recover their item' },
    { event: 'Verify your email address', change: TRUST_CHANGES.EMAIL_VERIFIED, description: 'One-time bonus for email verification' },
    { event: 'Verify your phone number', change: TRUST_CHANGES.PHONE_VERIFIED, description: 'One-time bonus for phone verification' },
    { event: 'Accurate item report confirmed', change: TRUST_CHANGES.ACCURATE_REPORT_CONFIRMED, description: 'When your report leads to a successful match and return' },
    { event: 'Failed verification attempt', change: TRUST_CHANGES.FAILED_VERIFICATION, description: 'Deducted when you fail to answer ownership questions correctly' },
    { event: 'Multiple failed claims (3+)', change: TRUST_CHANGES.MULTIPLE_FAILED_CLAIMS, description: 'Additional penalty for pattern of failed claim attempts' },
    { event: 'Reported for scam', change: TRUST_CHANGES.SCAM_REPORTED, description: 'Temporary deduction while report is investigated' },
    { event: 'Scam confirmed by admin', change: TRUST_CHANGES.SCAM_CONFIRMED, description: 'Severe penalty for confirmed fraudulent behavior' },
    { event: 'Filed false scam report', change: TRUST_CHANGES.FALSE_SCAM_REPORT, description: 'Penalty for filing a report found to be false' },
  ];

  return {
    current_score: currentScore,
    level,
    level_description: LEVEL_DESCRIPTIONS[level] || 'Unknown level',
    permissions,
    scoring_rules: scoringRules,
    recent_events: recentEvents,
    next_level: nextLevel
  };
}