/**
 * Enhanced OTP Handover Service for Byaboneka+
 * 
 * Implements secure handover OTP requirements:
 * - HAND-01: OTP generation for verified claims only
 * - HAND-02: 24-hour validity
 * - HAND-03: Single-use enforcement
 * - HAND-04: Finder/coop staff enters OTP
 * - HAND-05: Max 3 OTP verification attempts
 * - HAND-06: Status changes only after OTP validation
 * - HAND-07: Comprehensive audit logging
 */

import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { query, transaction } from '../config/database';
import { logAudit, extractRequestMeta } from './auditService';
import { onSuccessfulReturn } from './trustService';
import { Request } from 'express';

const OTP_LENGTH = 6;
const OTP_VALIDITY_HOURS = 24;
const MAX_OTP_ATTEMPTS = 3;
const SALT_ROUNDS = 10;

export interface OTPGenerationResult {
  success: boolean;
  otp?: string;
  expiresAt?: Date;
  message: string;
}

export interface OTPVerificationResult {
  success: boolean;
  message: string;
  attemptsRemaining?: number;
  handoverCompleted?: boolean;
}

export interface HandoverDetails {
  handoverId: number;
  claimId: number;
  lostItemId: number;
  foundItemId: number;
  ownerId: number;
  finderId: number;
  otpExpiresAt: Date;
  otpVerified: boolean;
  verificationAttempts: number;
}

/**
 * Generate a secure 6-digit OTP
 */
function generateSecureOTP(): string {
  const bytes = crypto.randomBytes(4);
  const num = bytes.readUInt32BE(0) % 1000000;
  return num.toString().padStart(OTP_LENGTH, '0');
}

/**
 * Generate handover OTP for a verified claim
 * Only the item owner (claimant) can generate the OTP
 */
export async function generateHandoverOTP(
  claimId: number,
  userId: number,
  req?: Request
): Promise<OTPGenerationResult> {
  // Verify claim exists and user is the owner
  const claimResult = await query(
    `SELECT c.*, li.user_id as owner_id, fi.finder_id, li.id as lost_item_id, fi.id as found_item_id
     FROM claims c
     JOIN lost_items li ON c.lost_item_id = li.id
     JOIN found_items fi ON c.found_item_id = fi.id
     WHERE c.id = $1`,
    [claimId]
  );
  
  if (claimResult.rows.length === 0) {
    return { success: false, message: 'Claim not found' };
  }
  
  const claim = claimResult.rows[0];
  
  // Only the claimant (verified owner) can generate OTP
  if (claim.claimant_id !== userId) {
    return { success: false, message: 'Only the verified item owner can generate the handover code' };
  }
  
  // Claim must be verified
  if (claim.status !== 'VERIFIED') {
    return { 
      success: false, 
      message: 'Claim must be verified before generating a handover code. Current status: ' + claim.status 
    };
  }
  
  // Check for existing valid OTP
  const existingOTP = await query(
    `SELECT id, otp_expires_at, otp_verified FROM handover_confirmations
     WHERE claim_id = $1`,
    [claimId]
  );
  
  if (existingOTP.rows.length > 0) {
    const existing = existingOTP.rows[0];
    
    if (existing.otp_verified) {
      return { success: false, message: 'Handover has already been completed for this claim' };
    }
    
    if (new Date(existing.otp_expires_at) > new Date()) {
      const remainingMs = new Date(existing.otp_expires_at).getTime() - Date.now();
      const remainingHours = Math.ceil(remainingMs / (60 * 60 * 1000));
      return { 
        success: false, 
        message: `A handover code is already active. It expires in ${remainingHours} hours. Please use the existing code or wait for it to expire.` 
      };
    }
    
    // Expired - delete old OTP before creating new one
    await query('DELETE FROM handover_confirmations WHERE id = $1', [existing.id]);
  }
  
  // Generate new OTP
  const otp = generateSecureOTP();
  const otpHash = await bcrypt.hash(otp, SALT_ROUNDS);
  const expiresAt = new Date(Date.now() + OTP_VALIDITY_HOURS * 60 * 60 * 1000);
  
  await query(
    `INSERT INTO handover_confirmations 
     (claim_id, otp_code_hash, otp_expires_at, generated_by, max_attempts)
     VALUES ($1, $2, $3, $4, $5)`,
    [claimId, otpHash, expiresAt, userId, MAX_OTP_ATTEMPTS]
  );
  
  // Log OTP generation
  const { ipAddress, userAgent } = req ? extractRequestMeta(req) : { ipAddress: undefined, userAgent: undefined };
  await logAudit({
    actorId: userId,
    action: 'OTP_GENERATED',
    resourceType: 'handover',
    resourceId: claimId,
    changes: { 
      expires_at: expiresAt.toISOString(),
      claim_status: claim.status 
    },
    ipAddress,
    userAgent
  });
  
  return {
    success: true,
    otp,
    expiresAt,
    message: `Handover code generated successfully. Share this code ONLY when physically meeting the finder. Valid for 24 hours.`
  };
}

/**
 * Verify OTP and complete handover
 * Only the finder or cooperative staff can verify the OTP
 */
export async function verifyHandoverOTP(
  claimId: number,
  otp: string,
  verifierId: number,
  req?: Request
): Promise<OTPVerificationResult> {
  // Get handover details
  const handoverResult = await query(
    `SELECT h.*, c.status as claim_status, c.claimant_id as owner_id,
            li.id as lost_item_id, li.user_id as lost_item_owner,
            fi.id as found_item_id, fi.finder_id, fi.cooperative_id
     FROM handover_confirmations h
     JOIN claims c ON h.claim_id = c.id
     JOIN lost_items li ON c.lost_item_id = li.id
     JOIN found_items fi ON c.found_item_id = fi.id
     WHERE h.claim_id = $1`,
    [claimId]
  );
  
  if (handoverResult.rows.length === 0) {
    return { success: false, message: 'No handover code found for this claim. The owner needs to generate one first.' };
  }
  
  const handover = handoverResult.rows[0];
  
  if (handover.otp_verified) {
    return { success: false, message: 'This handover has already been completed.' };
  }
  
  // Check if verifier is authorized (finder or coop staff)
  const isAuthorizedVerifier = await checkVerifierAuthorization(verifierId, handover);
  if (!isAuthorizedVerifier.authorized) {
    return { success: false, message: isAuthorizedVerifier.reason };
  }
  
  if (new Date(handover.otp_expires_at) < new Date()) {
    return { success: false, message: 'Handover code has expired. Please ask the owner to generate a new one.' };
  }
  
  if (handover.verification_attempts >= (handover.max_attempts || MAX_OTP_ATTEMPTS)) {
    return { 
      success: false, 
      message: 'Maximum verification attempts exceeded. Please ask the owner to generate a new code.',
      attemptsRemaining: 0
    };
  }
  
  // Verify OTP
  const isValid = await bcrypt.compare(otp, handover.otp_code_hash);
  
  const { ipAddress, userAgent } = req ? extractRequestMeta(req) : { ipAddress: undefined, userAgent: undefined };
  
  if (!isValid) {
    await query(
      `UPDATE handover_confirmations SET verification_attempts = verification_attempts + 1 WHERE id = $1`,
      [handover.id]
    );
    
    await logAudit({
      actorId: verifierId,
      action: 'OTP_FAILED',
      resourceType: 'handover',
      resourceId: claimId,
      changes: { attempts: handover.verification_attempts + 1 },
      ipAddress,
      userAgent
    });
    
    const maxAttempts = handover.max_attempts || MAX_OTP_ATTEMPTS;
    const attemptsRemaining = maxAttempts - handover.verification_attempts - 1;
    return {
      success: false,
      message: `Invalid handover code. ${attemptsRemaining} attempt${attemptsRemaining !== 1 ? 's' : ''} remaining.`,
      attemptsRemaining
    };
  }
  
  // OTP is valid - complete handover in a transaction
  await transaction(async (client) => {
    await client.query(
      `UPDATE handover_confirmations 
       SET otp_verified = TRUE, returned_at = NOW(), return_confirmed_by = $1
       WHERE id = $2`,
      [verifierId, handover.id]
    );
    
    await client.query(
      `UPDATE claims SET status = 'RETURNED' WHERE id = $1`,
      [claimId]
    );
    
    await client.query(
      `UPDATE lost_items SET status = 'RETURNED' WHERE id = $1`,
      [handover.lost_item_id]
    );
    
    await client.query(
      `UPDATE found_items SET status = 'RETURNED' WHERE id = $1`,
      [handover.found_item_id]
    );
  });
  
  // Log successful handover
  await logAudit({
    actorId: verifierId,
    action: 'OTP_VERIFIED',
    resourceType: 'handover',
    resourceId: claimId,
    changes: { 
      handover_completed: true,
      confirmed_by: verifierId,
      owner_id: handover.owner_id,
      finder_id: handover.finder_id
    },
    ipAddress,
    userAgent
  });

  // Update trust scores for successful return
  if (req) {
    await onSuccessfulReturn(req, handover.finder_id, handover.owner_id);
  }
  
  return {
    success: true,
    message: 'Handover completed successfully! The item has been marked as returned. Thank you for using Byaboneka+.',
    handoverCompleted: true
  };
}

/**
 * Check if a user is authorized to verify the OTP
 */
async function checkVerifierAuthorization(
  verifierId: number,
  handover: any
): Promise<{ authorized: boolean; reason: string }> {
  if (verifierId === handover.finder_id) {
    return { authorized: true, reason: 'Verifier is the finder' };
  }
  
  if (verifierId === handover.owner_id || verifierId === handover.lost_item_owner) {
    return { 
      authorized: false, 
      reason: 'The item owner cannot verify the handover code. Only the finder or cooperative staff can do this.' 
    };
  }
  
  if (handover.cooperative_id) {
    const staffCheck = await query(
      `SELECT id FROM users WHERE id = $1 AND cooperative_id = $2 AND role = 'coop_staff'`,
      [verifierId, handover.cooperative_id]
    );
    
    if (staffCheck.rows.length > 0) {
      return { authorized: true, reason: 'Verifier is cooperative staff' };
    }
  }
  
  return { 
    authorized: false, 
    reason: 'Only the finder or authorized cooperative staff can verify the handover code.' 
  };
}

/**
 * Get handover status for a claim
 */
export async function getHandoverStatus(claimId: number): Promise<HandoverDetails | null> {
  const result = await query(
    `SELECT h.*, c.claimant_id as owner_id,
            li.id as lost_item_id, fi.id as found_item_id, fi.finder_id
     FROM handover_confirmations h
     JOIN claims c ON h.claim_id = c.id
     JOIN lost_items li ON c.lost_item_id = li.id
     JOIN found_items fi ON c.found_item_id = fi.id
     WHERE h.claim_id = $1`,
    [claimId]
  );
  
  if (result.rows.length === 0) return null;
  
  const h = result.rows[0];
  return {
    handoverId: h.id,
    claimId: h.claim_id,
    lostItemId: h.lost_item_id,
    foundItemId: h.found_item_id,
    ownerId: h.owner_id,
    finderId: h.finder_id,
    otpExpiresAt: h.otp_expires_at,
    otpVerified: h.otp_verified,
    verificationAttempts: h.verification_attempts
  };
}

/**
 * Regenerate OTP (invalidates old one)
 */
export async function regenerateOTP(
  claimId: number,
  userId: number,
  req?: Request
): Promise<OTPGenerationResult> {
  await query('DELETE FROM handover_confirmations WHERE claim_id = $1', [claimId]);
  return generateHandoverOTP(claimId, userId, req);
}