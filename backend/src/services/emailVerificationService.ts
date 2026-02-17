/**
 * Email Verification Service for Byaboneka+
 * 
 * Implements AUTH-01: Email verification requirement
 */

import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { query } from '../config/database';
import { logAudit, extractRequestMeta } from './auditService';
import { sendVerificationEmail } from './emailService';
import { Request } from 'express';

const TOKEN_LENGTH = 32;
const TOKEN_VALIDITY_HOURS = 24;
const SALT_ROUNDS = 10;

export interface VerificationResult {
  success: boolean;
  message: string;
  verified?: boolean;
}

export interface TokenGenerationResult {
  success: boolean;
  token?: string;
  expiresAt?: Date;
  message: string;
}

function generateToken(): string {
  return crypto.randomBytes(TOKEN_LENGTH).toString('hex');
}

export async function generateEmailVerificationToken(
  userId: number,
  req?: Request
): Promise<TokenGenerationResult> {
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
  
  await query(
    'DELETE FROM email_verification_tokens WHERE user_id = $1',
    [userId]
  );
  
  const token = generateToken();
  const tokenHash = await bcrypt.hash(token, SALT_ROUNDS);
  const expiresAt = new Date(Date.now() + TOKEN_VALIDITY_HOURS * 60 * 60 * 1000);
  
  await query(
    `INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt]
  );
  
  const { ipAddress, userAgent } = req ? extractRequestMeta(req) : { ipAddress: undefined, userAgent: undefined };
  await logAudit({
    actorId: userId,
    action: 'EMAIL_VERIFICATION_REQUESTED',
    resourceType: 'user',
    resourceId: userId,
    changes: { expires_at: expiresAt.toISOString() },
    ipAddress,
    userAgent
  });
  
  console.log(`[EMAIL] Verification token for user ${userId}: ${token}`);
  
  // Send verification email via Brevo
  sendVerificationEmail(user.email, user.name || 'User', token).catch(err =>
    console.error('Verification email failed:', err.message)
  );
  
  return {
    success: true,
    token,
    expiresAt,
    message: 'Verification email sent. Please check your inbox.'
  };
}

export async function verifyEmail(
  userId: number,
  token: string,
  req?: Request
): Promise<VerificationResult> {
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
  
  if (new Date(storedToken.expires_at) < new Date()) {
    return { 
      success: false, 
      message: 'Verification token has expired. Please request a new one.' 
    };
  }
  
  const isValid = await bcrypt.compare(token, storedToken.token_hash);
  
  if (!isValid) {
    return { success: false, message: 'Invalid verification token' };
  }
  
  await query(
    `UPDATE email_verification_tokens SET used_at = NOW() WHERE id = $1`,
    [storedToken.id]
  );
  
  await query(
    `UPDATE users SET email_verified = TRUE WHERE id = $1`,
    [userId]
  );
  
  const { ipAddress, userAgent } = req ? extractRequestMeta(req) : { ipAddress: undefined, userAgent: undefined };
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

export async function isEmailVerified(userId: number): Promise<boolean> {
  const result = await query(
    'SELECT email_verified FROM users WHERE id = $1',
    [userId]
  );
  
  return result.rows.length > 0 && result.rows[0].email_verified === true;
}

export async function resendVerificationEmail(
  userId: number,
  req?: Request
): Promise<TokenGenerationResult> {
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

export async function cleanupExpiredTokens(): Promise<number> {
  const result = await query(
    `DELETE FROM email_verification_tokens 
     WHERE expires_at < NOW() - INTERVAL '7 days'
     RETURNING id`
  );
  
  return result.rowCount || 0;
}