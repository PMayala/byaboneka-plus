import { query } from '../config/database';

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function getVerificationLimits(params: {
  claimId: number;
  userId: number;
}): Promise<{
  attemptsToday: number;
  failuresToday: number;
  blockedUntil: Date | null;
}> {
  const { claimId, userId } = params;
  const from = startOfToday();

  const res = await query(
    `SELECT attempt_at, attempt_status
     FROM verification_attempts
     WHERE claim_id = $1 AND user_id = $2 AND attempt_at >= $3
     ORDER BY attempt_at DESC`,
    [claimId, userId, from]
  );

  const rows = res.rows as { attempt_at: string; attempt_status: string }[];
  const attemptsToday = rows.length;
  const failuresToday = rows.filter(r => r.attempt_status === 'FAILED').length;

  // Progressive cooldown based on failures today
  // 1st fail -> 1 hour, 2nd -> 4 hours, 3rd+ -> 24 hours
  const cooldownMinutes =
    failuresToday <= 0 ? 0 :
    failuresToday === 1 ? 60 :
    failuresToday === 2 ? 240 : 1440;

  if (cooldownMinutes === 0) return { attemptsToday, failuresToday, blockedUntil: null };

  const lastAttempt = rows[0] ? new Date(rows[0].attempt_at) : null;
  if (!lastAttempt) return { attemptsToday, failuresToday, blockedUntil: null };

  const blockedUntil = new Date(lastAttempt.getTime() + cooldownMinutes * 60_000);
  return { attemptsToday, failuresToday, blockedUntil };
}

export async function recordVerificationAttempt(params: {
  claimId: number;
  userId: number;
  success: boolean;
  correctAnswers: number;
  ipAddress?: string;
}): Promise<void> {
  const { claimId, userId, success, correctAnswers, ipAddress } = params;

  await query(
    `INSERT INTO verification_attempts (claim_id, user_id, correct_answers, attempt_status, ip_address)
     VALUES ($1, $2, $3, $4, $5)`,
    [claimId, userId, correctAnswers, success ? 'PASSED' : 'FAILED', ipAddress || null]
  );
}