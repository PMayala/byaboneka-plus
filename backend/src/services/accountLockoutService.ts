// ============================================
// ACCOUNT LOCKOUT SERVICE
// ============================================

import { query } from '../config/database';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;

/**
 * Record a failed login attempt for an email.
 * After MAX_FAILED_ATTEMPTS, the account is temporarily locked.
 */
export async function recordFailedLogin(email: string): Promise<void> {
  await query(
    `UPDATE users SET 
      failed_login_attempts = COALESCE(failed_login_attempts, 0) + 1,
      last_failed_login = NOW()
    WHERE email = $1`,
    [email.toLowerCase()]
  );
}

/**
 * Reset failed login counter after successful login.
 */
export async function resetFailedLogins(email: string): Promise<void> {
  await query(
    `UPDATE users SET 
      failed_login_attempts = 0,
      last_failed_login = NULL
    WHERE email = $1`,
    [email.toLowerCase()]
  );
}

/**
 * Check if an account is currently locked out.
 * Returns { locked: boolean, minutesRemaining: number }
 */
export async function checkAccountLockout(email: string): Promise<{ locked: boolean; minutesRemaining: number }> {
  const result = await query(
    `SELECT failed_login_attempts, last_failed_login FROM users WHERE email = $1`,
    [email.toLowerCase()]
  );

  if (result.rows.length === 0) {
    return { locked: false, minutesRemaining: 0 };
  }

  const { failed_login_attempts, last_failed_login } = result.rows[0];

  if (!failed_login_attempts || failed_login_attempts < MAX_FAILED_ATTEMPTS) {
    return { locked: false, minutesRemaining: 0 };
  }

  if (!last_failed_login) {
    return { locked: false, minutesRemaining: 0 };
  }

  const lockoutExpiry = new Date(last_failed_login);
  lockoutExpiry.setMinutes(lockoutExpiry.getMinutes() + LOCKOUT_DURATION_MINUTES);

  if (new Date() < lockoutExpiry) {
    const minutesRemaining = Math.ceil((lockoutExpiry.getTime() - Date.now()) / 60000);
    return { locked: true, minutesRemaining };
  }

  // Lockout expired — reset
  await resetFailedLogins(email);
  return { locked: false, minutesRemaining: 0 };
}
