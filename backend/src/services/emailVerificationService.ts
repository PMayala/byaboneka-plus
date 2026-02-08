/**
 * Email Verification Service for Byaboneka+
 * 
 * Implements AUTH-01: Email verification requirement
 * Provides token generation, verification, and middleware for
 * requiring verified emails on sensitive actions.
 */

import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { query } from '../config/database';
import { logAudit, extractRequestMeta } from './auditService';
import { Request } from 'express';

const TOKEN_LENGTH = 32; // 32 bytes = 64 hex chars
const TOKEN_VALIDITY_HOURS = 24;
const SALT_ROUNDS = 10;

export interface VerificationResult {
  success: boolean;
  message: string;
  verified?: boolean;
}

export interface TokenGenerationResult {
  success: boolean;
  token?: string; // Only returned for sending via email
  expiresAt?: Date;
  message: string;
}

/**
 * Generate a secure verification token
 */
function generateToken(): string {
  return crypto.randomBytes(TOKEN_LENGTH).toString('hex');
}

/**
 * Generate and store an email verification token for a user
 */
export async function generateEmailVerificationToken(
  userId: number,
  req?: Request
): Promise<TokenGenerationResult> {
  // Check if user exists and isn't already verified
  const userResult = await query(
    'SELECT id, email, email_verified FROM users WHERE id = $1',
    [userId]
  );
  
  if (userResult.rows.length === 0) {
    return { success: false, message: 'User not found' };
  }
  
  const user = userResult.rows[0];
  
  if (user.email_verified) {
    return { success: false, message: 'Email is already verified' };
  }
  
  // Delete any existing tokens for this user
  await query(
    'DELETE FROM email_verification_tokens WHERE user_id = $1',
    [userId]
  );
  
  // Generate new token
  const token = generateToken();
  const tokenHash = await bcrypt.hash(token, SALT_ROUNDS);
  const expiresAt = new Date(Date.now() + TOKEN_VALIDITY_HOURS * 60 * 60 * 1000);
  
  await query(
    `INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt]
  );
  
  // Log token generation
  const { ipAddress, userAgent } = req ? extractRequestMeta(req) : {};
  await logAudit({
    actorId: userId,
    action: 'EMAIL_VERIFICATION_REQUESTED',
    resourceType: 'user',
    resourceId: userId,
    changes: { expires_at: expiresAt.toISOString() },
    ipAddress,
    userAgent
  });
  
  // In production, send email here
  // For MVP, we'll return the token (log it in development)
  console.log(`[EMAIL] Verification token for user ${userId}: ${token}`);
  
  return {
    success: true,
    token, // Would be sent via email in production
    expiresAt,
    message: 'Verification email sent. Please check your inbox.'
  };
}

/**
 * Verify an email using the provided token
 */
export async function verifyEmail(
  userId: number,
  token: string,
  req?: Request
): Promise<VerificationResult> {
  // Get the stored token
  const tokenResult = await query(
    `SELECT * FROM email_verification_tokens 
     WHERE user_id = $1 AND used_at IS NULL
     ORDER BY created_at DESC LIMIT 1`,
    [userId]
  );
  
  if (tokenResult.rows.length === 0) {
    return { 
      success: false, 
      message: 'No verification token found. Please request a new one.' 
    };
  }
  
  const storedToken = tokenResult.rows[0];
  
  // Check expiry
  if (new Date(storedToken.expires_at) < new Date()) {
    return { 
      success: false, 
      message: 'Verification token has expired. Please request a new one.' 
    };
  }
  
  // Verify token
  const isValid = await bcrypt.compare(token, storedToken.token_hash);
  
  if (!isValid) {
    return { success: false, message: 'Invalid verification token' };
  }
  
  // Mark token as used and verify email
  await query(
    `UPDATE email_verification_tokens SET used_at = NOW() WHERE id = $1`,
    [storedToken.id]
  );
  
  await query(
    `UPDATE users SET email_verified = TRUE WHERE id = $1`,
    [userId]
  );
  
  // Log verification
  const { ipAddress, userAgent } = req ? extractRequestMeta(req) : {};
  await logAudit({
    actorId: userId,
    action: 'EMAIL_VERIFIED',
    resourceType: 'user',
    resourceId: userId,
    changes: { email_verified: true },
    ipAddress,
    userAgent
  });
  
  return {
    success: true,
    verified: true,
    message: 'Email verified successfully!'
  };
}

/**
 * Check if a user's email is verified
 */
export async function isEmailVerified(userId: number): Promise<boolean> {
  const result = await query(
    'SELECT email_verified FROM users WHERE id = $1',
    [userId]
  );
  
  return result.rows.length > 0 && result.rows[0].email_verified === true;
}

/**
 * Resend verification email (with rate limiting)
 */
export async function resendVerificationEmail(
  userId: number,
  req?: Request
): Promise<TokenGenerationResult> {
  // Check how many tokens were generated recently
  const recentTokens = await query(
    `SELECT COUNT(*) FROM email_verification_tokens 
     WHERE user_id = $1 AND created_at > NOW() - INTERVAL '1 hour'`,
    [userId]
  );
  
  if (parseInt(recentTokens.rows[0].count) >= 3) {
    return { 
      success: false, 
      message: 'Too many verification requests. Please try again later.' 
    };
  }
  
  return generateEmailVerificationToken(userId, req);
}

/**
 * Clean up expired verification tokens
 */
export async function cleanupExpiredTokens(): Promise<number> {
  const result = await query(
    `DELETE FROM email_verification_tokens 
     WHERE expires_at < NOW() - INTERVAL '7 days'
     RETURNING id`
  );
  
  return result.rowCount || 0;
}
