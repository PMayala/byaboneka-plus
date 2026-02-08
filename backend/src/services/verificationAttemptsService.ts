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
    `SELECT attempted_at, success
     FROM claim_verification_attempts
     WHERE claim_id = $1 AND user_id = $2 AND attempted_at >= $3
     ORDER BY attempted_at DESC`,
    [claimId, userId, from]
  );

  const rows = res.rows as { attempted_at: string; success: boolean }[];
  const attemptsToday = rows.length;
  const failuresToday = rows.filter(r => !r.success).length;

  // Progressive cooldown based on failures today
  // 1st fail -> 1 hour, 2nd -> 4 hours, 3rd+ -> 24 hours
  const cooldownMinutes =
    failuresToday <= 0 ? 0 :
    failuresToday === 1 ? 60 :
    failuresToday === 2 ? 240 : 1440;

  if (cooldownMinutes === 0) return { attemptsToday, failuresToday, blockedUntil: null };

  const lastAttempt = rows[0] ? new Date(rows[0].attempted_at) : null;
  if (!lastAttempt) return { attemptsToday, failuresToday, blockedUntil: null };

  const blockedUntil = new Date(lastAttempt.getTime() + cooldownMinutes * 60_000);
  return { attemptsToday, failuresToday, blockedUntil };
}

export async function recordVerificationAttempt(params: {
  claimId: number;
  userId: number;
  success: boolean;
}): Promise<void> {
  const { claimId, userId, success } = params;

  await query(
    `INSERT INTO claim_verification_attempts (claim_id, user_id, success)
     VALUES ($1, $2, $3)`,
    [claimId, userId, success]
  );
}
