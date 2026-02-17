import { query } from '../config/database';
import { Request } from 'express';
import { logTrustScoreChange } from './auditService';
import { TRUST_CHANGES, getTrustLevel } from '../utils';
import { TrustLevel } from '../types';

// ============================================
// TRUST SCORE SERVICE
// Adaptive Trust Scoring System
// ============================================

export interface TrustScoreUpdate {
  userId: number;
  change: number;
  reason: string;
}

// Get user's current trust score
export async function getUserTrustScore(userId: number): Promise<number> {
  const result = await query(
    'SELECT trust_score FROM users WHERE id = $1',
    [userId]
  );
  
  if (result.rows.length === 0) {
    throw new Error('User not found');
  }
  
  return result.rows[0].trust_score;
}

// Update user's trust score
export async function updateTrustScore(
  req: Request | null,
  userId: number,
  change: number,
  reason: string
): Promise<number> {
  // Get current score
  const currentScore = await getUserTrustScore(userId);
  
  // Calculate new score (bounded between -100 and 100)
  const newScore = Math.max(-100, Math.min(100, currentScore + change));
  
  // Update in database
  await query(
    'UPDATE users SET trust_score = $1 WHERE id = $2',
    [newScore, userId]
  );
  
  // Log the change
  await logTrustScoreChange(req, userId, change, reason, newScore);
  
  // Check if user should be auto-suspended
  if (newScore <= -10 && currentScore > -10) {
    await suspendUserForLowTrust(userId);
  }
  
  return newScore;
}

// Batch update trust scores
export async function batchUpdateTrustScores(
  req: Request | null,
  updates: TrustScoreUpdate[]
): Promise<void> {
  for (const update of updates) {
    await updateTrustScore(req, update.userId, update.change, update.reason);
  }
}

// Specific trust score operations
export async function onSuccessfulReturn(
  req: Request,
  finderId: number,
  ownerId: number
): Promise<void> {
  await updateTrustScore(
    req,
    finderId,
    TRUST_CHANGES.SUCCESSFUL_RETURN_FINDER,
    'Successfully returned a found item'
  );
  
  await updateTrustScore(
    req,
    ownerId,
    TRUST_CHANGES.SUCCESSFUL_RECOVERY_OWNER,
    'Successfully recovered lost item'
  );
}

export async function onFailedVerification(
  req: Request,
  userId: number
): Promise<void> {
  await updateTrustScore(
    req,
    userId,
    TRUST_CHANGES.FAILED_VERIFICATION,
    'Failed verification attempt'
  );
}

export async function onMultipleFailedClaims(
  req: Request,
  userId: number,
  failCount: number
): Promise<void> {
  if (failCount >= 3) {
    await updateTrustScore(
      req,
      userId,
      TRUST_CHANGES.MULTIPLE_FAILED_CLAIMS,
      `Multiple failed claim attempts (${failCount})`
    );
  }
}

export async function onScamReported(
  req: Request,
  userId: number
): Promise<void> {
  await updateTrustScore(
    req,
    userId,
    TRUST_CHANGES.SCAM_REPORTED,
    'Reported for scam (pending investigation)'
  );
}

export async function onScamConfirmed(
  req: Request,
  userId: number
): Promise<void> {
  await updateTrustScore(
    req,
    userId,
    TRUST_CHANGES.SCAM_CONFIRMED,
    'Scam confirmed by admin'
  );
}

export async function onFalseScamReport(
  req: Request,
  reporterId: number
): Promise<void> {
  await updateTrustScore(
    req,
    reporterId,
    TRUST_CHANGES.FALSE_SCAM_REPORT,
    'Filed false scam report'
  );
}

export async function onEmailVerified(
  req: Request,
  userId: number
): Promise<void> {
  await updateTrustScore(
    req,
    userId,
    TRUST_CHANGES.EMAIL_VERIFIED,
    'Email address verified'
  );
}

export async function onPhoneVerified(
  req: Request,
  userId: number
): Promise<void> {
  await updateTrustScore(
    req,
    userId,
    TRUST_CHANGES.PHONE_VERIFIED,
    'Phone number verified'
  );
}

// Auto-suspend user for very low trust
async function suspendUserForLowTrust(userId: number): Promise<void> {
  await query(
    `UPDATE users 
     SET is_banned = true, 
         banned_at = NOW(), 
         ban_reason = 'Automatically suspended due to very low trust score'
     WHERE id = $1`,
    [userId]
  );
}

// Get trust level and permissions for a user
export async function getUserTrustInfo(userId: number): Promise<{
  score: number;
  level: TrustLevel;
  claimLimit: number;
  reportLimit: number;
}> {
  const score = await getUserTrustScore(userId);
  const level = getTrustLevel(score);
  
  // Calculate limits based on trust level
  const claimLimit = getClaimLimitForLevel(level);
  const reportLimit = getReportLimitForLevel(level);
  
  return {
    score,
    level,
    claimLimit,
    reportLimit
  };
}

function getClaimLimitForLevel(level: TrustLevel): number {
  switch (level) {
    case TrustLevel.SUSPENDED: return 0;
    case TrustLevel.RESTRICTED: return 1;
    case TrustLevel.NEW: return 3;
    case TrustLevel.ESTABLISHED: return 5;
    case TrustLevel.TRUSTED: return 7;
    default: return 3;
  }
}

function getReportLimitForLevel(level: TrustLevel): number {
  switch (level) {
    case TrustLevel.SUSPENDED: return 0;
    case TrustLevel.RESTRICTED: return 1;
    case TrustLevel.NEW: return 3;
    case TrustLevel.ESTABLISHED: return 5;
    case TrustLevel.TRUSTED: return 10;
    default: return 3;
  }
}

// Get users with suspicious trust patterns
export async function getSuspiciousUsers(): Promise<any[]> {
  const result = await query(
    `SELECT u.id, u.name, u.email, u.trust_score, u.created_at,
            COUNT(DISTINCT va.id) as failed_verifications,
            COUNT(DISTINCT sr.id) as scam_reports
     FROM users u
     LEFT JOIN claims c ON c.claimant_id = u.id
     LEFT JOIN verification_attempts va ON va.claim_id = c.id AND va.attempt_status = 'FAILED'
     LEFT JOIN scam_reports sr ON sr.reported_user_id = u.id AND sr.status != 'RESOLVED'
     WHERE u.trust_score < 0 OR u.is_banned = true
     GROUP BY u.id
     HAVING COUNT(DISTINCT va.id) >= 3 OR COUNT(DISTINCT sr.id) >= 1
     ORDER BY u.trust_score ASC
     LIMIT 50`
  );
  
  return result.rows;
}

// Recalculate trust score based on history (for admin correction)
export async function recalculateTrustScore(userId: number): Promise<number> {
  // Get all trust-related events from audit log
  const result = await query(
    `SELECT changes->>'change' as change
     FROM audit_logs
     WHERE actor_id = $1
       AND action = 'TRUST_SCORE_CHANGED'
     ORDER BY timestamp ASC`,
    [userId]
  );
  
  // Sum all changes
  let totalScore = 0;
  for (const row of result.rows) {
    if (row.change) {
      totalScore += parseInt(row.change);
    }
  }
  
  // Bound the score
  totalScore = Math.max(-100, Math.min(100, totalScore));
  
  // Update user
  await query(
    'UPDATE users SET trust_score = $1 WHERE id = $2',
    [totalScore, userId]
  );
  
  return totalScore;
}