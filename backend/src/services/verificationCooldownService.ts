/**
 * Verification Cooldown Service for Byaboneka+
 * 
 * Implements CLAIM-04/05: Progressive cooldown for failed verification attempts
 * - 1 hour after first failure
 * - 4 hours after second failure
 * - 24 hours after third failure
 */

import { query } from '../config/database';

// Cooldown durations in milliseconds
const COOLDOWN_DURATIONS = {
  1: 60 * 60 * 1000,        // 1 hour after 1 failure
  2: 4 * 60 * 60 * 1000,    // 4 hours after 2 failures  
  3: 24 * 60 * 60 * 1000    // 24 hours after 3 failures
};

const MAX_DAILY_ATTEMPTS = 3;

export interface CooldownStatus {
  canAttempt: boolean;
  cooldownUntil: Date | null;
  remainingSeconds: number;
  attemptsToday: number;
  failuresToday: number;
  message: string;
}

export interface AttemptResult {
  attemptId: number;
  newCooldown: Date | null;
  consecutiveFailures: number;
}

/**
 * Check if a user can make a verification attempt for a specific claim
 */
export async function checkCooldownStatus(
  claimId: number,
  userId: number
): Promise<CooldownStatus> {
  // Get claim cooldown info
  const claimResult = await query(
    `SELECT next_attempt_at, consecutive_failures 
     FROM claims WHERE id = $1`,
    [claimId]
  );
  
  if (claimResult.rows.length === 0) {
    throw new Error('Claim not found');
  }
  
  const claim = claimResult.rows[0];
  
  // Check claim-level cooldown
  if (claim.next_attempt_at && new Date(claim.next_attempt_at) > new Date()) {
    const cooldownUntil = new Date(claim.next_attempt_at);
    const remainingMs = cooldownUntil.getTime() - Date.now();
    
    return {
      canAttempt: false,
      cooldownUntil,
      remainingSeconds: Math.ceil(remainingMs / 1000),
      attemptsToday: claim.consecutive_failures,
      failuresToday: claim.consecutive_failures,
      message: formatCooldownMessage(remainingMs)
    };
  }
  
  // Count attempts in last 24 hours
  const attemptsResult = await query(
    `SELECT 
       COUNT(*) as total_attempts,
       COUNT(*) FILTER (WHERE attempt_status = 'FAILED') as failed_attempts
     FROM verification_attempts
     WHERE claim_id = $1 
     AND attempt_at > NOW() - INTERVAL '24 hours'`,
    [claimId]
  );
  
  const attemptsToday = parseInt(attemptsResult.rows[0].total_attempts);
  const failuresToday = parseInt(attemptsResult.rows[0].failed_attempts);
  
  // Check max daily attempts
  if (attemptsToday >= MAX_DAILY_ATTEMPTS) {
    // Find when the oldest attempt expires
    const oldestAttempt = await query(
      `SELECT attempt_at FROM verification_attempts
       WHERE claim_id = $1
       ORDER BY attempt_at ASC
       LIMIT 1`,
      [claimId]
    );
    
    if (oldestAttempt.rows.length > 0) {
      const expiresAt = new Date(oldestAttempt.rows[0].attempt_at);
      expiresAt.setHours(expiresAt.getHours() + 24);
      const remainingMs = expiresAt.getTime() - Date.now();
      
      return {
        canAttempt: false,
        cooldownUntil: expiresAt,
        remainingSeconds: Math.ceil(remainingMs / 1000),
        attemptsToday,
        failuresToday,
        message: 'Maximum daily verification attempts reached. Please try again tomorrow.'
      };
    }
  }
  
  return {
    canAttempt: true,
    cooldownUntil: null,
    remainingSeconds: 0,
    attemptsToday,
    failuresToday,
    message: `You have ${MAX_DAILY_ATTEMPTS - attemptsToday} attempts remaining today.`
  };
}

/**
 * Record a verification attempt and calculate new cooldown if failed
 */
export async function recordVerificationAttempt(
  claimId: number,
  userId: number,
  passed: boolean,
  correctAnswers: number,
  ipAddress?: string
): Promise<AttemptResult> {
  // Insert attempt record
  const attemptResult = await query(
    `INSERT INTO verification_attempts 
     (claim_id, user_id, correct_answers, attempt_status, ip_address)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [claimId, userId, correctAnswers, passed ? 'PASSED' : 'FAILED', ipAddress]
  );
  
  const attemptId = attemptResult.rows[0].id;
  
  if (passed) {
    // Success - reset consecutive failures
    await query(
      `UPDATE claims SET consecutive_failures = 0, next_attempt_at = NULL WHERE id = $1`,
      [claimId]
    );
    
    return {
      attemptId,
      newCooldown: null,
      consecutiveFailures: 0
    };
  }
  
  // Failure - increment consecutive failures and set cooldown
  const updateResult = await query(
    `UPDATE claims 
     SET consecutive_failures = consecutive_failures + 1,
         last_attempt_at = NOW()
     WHERE id = $1
     RETURNING consecutive_failures`,
    [claimId]
  );
  
  const consecutiveFailures = updateResult.rows[0].consecutive_failures;
  
  // Calculate cooldown based on consecutive failures
  const cooldownMs = COOLDOWN_DURATIONS[Math.min(consecutiveFailures, 3) as keyof typeof COOLDOWN_DURATIONS];
  const cooldownUntil = cooldownMs ? new Date(Date.now() + cooldownMs) : null;
  
  if (cooldownUntil) {
    await query(
      `UPDATE claims SET next_attempt_at = $1 WHERE id = $2`,
      [cooldownUntil, claimId]
    );
  }
  
  return {
    attemptId,
    newCooldown: cooldownUntil,
    consecutiveFailures
  };
}

/**
 * Format a human-readable cooldown message
 */
function formatCooldownMessage(remainingMs: number): string {
  const hours = Math.floor(remainingMs / (60 * 60 * 1000));
  const minutes = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));
  
  if (hours > 0) {
    return `Please wait ${hours} hour${hours > 1 ? 's' : ''} and ${minutes} minute${minutes > 1 ? 's' : ''} before trying again.`;
  }
  return `Please wait ${minutes} minute${minutes > 1 ? 's' : ''} before trying again.`;
}

/**
 * Get verification attempt history for a claim
 */
export async function getAttemptHistory(
  claimId: number,
  limit: number = 10
): Promise<any[]> {
  const result = await query(
    `SELECT va.*, u.name as user_name
     FROM verification_attempts va
     JOIN users u ON va.user_id = u.id
     WHERE va.claim_id = $1
     ORDER BY va.attempt_at DESC
     LIMIT $2`,
    [claimId, limit]
  );
  
  return result.rows;
}

/**
 * Clear cooldown for a claim (admin function)
 */
export async function clearCooldown(claimId: number): Promise<void> {
  await query(
    `UPDATE claims 
     SET next_attempt_at = NULL, consecutive_failures = 0 
     WHERE id = $1`,
    [claimId]
  );
}

/**
 * Check if user has suspicious verification patterns
 * (multiple failures across different claims)
 */
export async function checkSuspiciousPatterns(userId: number): Promise<{
  isSuspicious: boolean;
  recentFailures: number;
  uniqueClaimsFailed: number;
}> {
  const result = await query(
    `SELECT 
       COUNT(*) as total_failures,
       COUNT(DISTINCT claim_id) as unique_claims
     FROM verification_attempts
     WHERE user_id = $1
     AND attempt_status = 'FAILED'
     AND attempt_at > NOW() - INTERVAL '7 days'`,
    [userId]
  );
  
  const recentFailures = parseInt(result.rows[0].total_failures);
  const uniqueClaimsFailed = parseInt(result.rows[0].unique_claims);
  
  // Suspicious if: 5+ failures across 3+ different claims in a week
  const isSuspicious = recentFailures >= 5 && uniqueClaimsFailed >= 3;
  
  return {
    isSuspicious,
    recentFailures,
    uniqueClaimsFailed
  };
}
