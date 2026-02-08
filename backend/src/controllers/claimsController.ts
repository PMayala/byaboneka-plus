import { Request, Response } from 'express';
import { query, transaction } from '../config/database';
import { verifySecretAnswer, parsePaginationParams, generateOTP, hashOTP, verifyOTP } from '../utils';
import { logClaimAttempt, logOtpAction, logAudit, extractRequestMeta } from '../services/auditService';
import { onFailedVerification, onSuccessfulReturn, onMultipleFailedClaims } from '../services/trustService';
import { ClaimStatus, UserRole } from '../types';

// ============================================
// CLAIMS CONTROLLER
// Verification Challenge & OTP Handover
// ============================================

// Create a new claim
export async function createClaim(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const { lost_item_id, found_item_id } = req.body;

    // Verify lost item exists and belongs to claimant
    const lostItem = await query(
      'SELECT id, user_id, status FROM lost_items WHERE id = $1',
      [lost_item_id]
    );

    if (lostItem.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Lost item not found' });
      return;
    }

    if (lostItem.rows[0].user_id !== userId) {
      res.status(403).json({ success: false, message: 'You can only claim items for your own lost reports' });
      return;
    }

    if (lostItem.rows[0].status !== 'ACTIVE') {
      res.status(400).json({ success: false, message: 'This lost item is no longer active' });
      return;
    }

    // Verify found item exists and is unclaimed
    const foundItem = await query(
      'SELECT id, status FROM found_items WHERE id = $1',
      [found_item_id]
    );

    if (foundItem.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Found item not found' });
      return;
    }

    if (foundItem.rows[0].status !== 'UNCLAIMED') {
      res.status(400).json({ success: false, message: 'This found item is no longer available' });
      return;
    }

    // Check for existing active claim
    const existingClaim = await query(
      `SELECT id FROM claims 
       WHERE lost_item_id = $1 AND found_item_id = $2 AND claimant_id = $3
       AND status NOT IN ('CANCELLED', 'REJECTED', 'EXPIRED')`,
      [lost_item_id, found_item_id, userId]
    );

    if (existingClaim.rows.length > 0) {
      res.status(409).json({ 
        success: false, 
        message: 'You already have an active claim for this item',
        claim_id: existingClaim.rows[0].id
      });
      return;
    }

    // Create claim
    const result = await query(
      `INSERT INTO claims (lost_item_id, found_item_id, claimant_id, status)
       VALUES ($1, $2, $3, 'PENDING')
       RETURNING *`,
      [lost_item_id, found_item_id, userId]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Claim created. Please complete verification to proceed.'
    });
  } catch (error) {
    console.error('Create claim error:', error);
    res.status(500).json({ success: false, message: 'Failed to create claim' });
  }
}

// Get verification questions for a claim
export async function getVerificationQuestions(req: Request, res: Response): Promise<void> {
  try {
    const { claimId } = req.params;
    const userId = req.user!.userId;

    // Get claim and verify ownership
    const claim = await query(
      `SELECT c.*, li.user_id as lost_item_owner
       FROM claims c
       JOIN lost_items li ON c.lost_item_id = li.id
       WHERE c.id = $1`,
      [claimId]
    );

    if (claim.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Claim not found' });
      return;
    }

    if (claim.rows[0].claimant_id !== userId) {
      res.status(403).json({ success: false, message: 'Not authorized to view this claim' });
      return;
    }

    if (claim.rows[0].status !== 'PENDING') {
      res.status(400).json({ success: false, message: 'Verification is only available for pending claims' });
      return;
    }

    // Check rate limits
    const attemptsToday = await query(
      `SELECT COUNT(*) FROM verification_attempts
       WHERE claim_id = $1 AND attempt_at > NOW() - INTERVAL '24 hours'`,
      [claimId]
    );

    if (parseInt(attemptsToday.rows[0].count) >= 3) {
      res.status(429).json({
        success: false,
        message: 'Too many verification attempts. Please try again in 24 hours.'
      });
      return;
    }

    // Get questions (not answers)
    const secrets = await query(
      `SELECT question_1_text, question_2_text, question_3_text
       FROM verification_secrets
       WHERE lost_item_id = $1`,
      [claim.rows[0].lost_item_id]
    );

    if (secrets.rows.length === 0) {
      res.status(500).json({ success: false, message: 'Verification questions not found' });
      return;
    }

    res.json({
      success: true,
      data: {
        claim_id: parseInt(claimId),
        questions: [
          secrets.rows[0].question_1_text,
          secrets.rows[0].question_2_text,
          secrets.rows[0].question_3_text
        ],
        attempts_remaining: 3 - parseInt(attemptsToday.rows[0].count)
      }
    });
  } catch (error) {
    console.error('Get verification questions error:', error);
    res.status(500).json({ success: false, message: 'Failed to get verification questions' });
  }
}

// Verify claim with answers
export async function verifyClaim(req: Request, res: Response): Promise<void> {
  try {
    const { claimId } = req.params;
    const userId = req.user!.userId;
    const { answers } = req.body;

    // Get claim
    const claimResult = await query(
      `SELECT c.*, li.user_id as lost_item_owner
       FROM claims c
       JOIN lost_items li ON c.lost_item_id = li.id
       WHERE c.id = $1`,
      [claimId]
    );

    if (claimResult.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Claim not found' });
      return;
    }

    const claim = claimResult.rows[0];

    if (claim.claimant_id !== userId) {
      res.status(403).json({ success: false, message: 'Not authorized' });
      return;
    }

    if (claim.status !== 'PENDING') {
      res.status(400).json({ success: false, message: 'Claim is not in pending status' });
      return;
    }

    // Check rate limits
    const attemptsToday = await query(
      `SELECT COUNT(*) FROM verification_attempts
       WHERE claim_id = $1 AND attempt_at > NOW() - INTERVAL '24 hours'`,
      [claimId]
    );

    if (parseInt(attemptsToday.rows[0].count) >= 3) {
      res.status(429).json({
        success: false,
        message: 'Daily verification limit reached. Try again tomorrow.'
      });
      return;
    }

    // Get secrets
    const secrets = await query(
      `SELECT * FROM verification_secrets WHERE lost_item_id = $1`,
      [claim.lost_item_id]
    );

    if (secrets.rows.length === 0) {
      res.status(500).json({ success: false, message: 'Verification data not found' });
      return;
    }

    const secret = secrets.rows[0];

    // Verify each answer
    let correctCount = 0;
    const results: boolean[] = [];

    const answer1Correct = await verifySecretAnswer(
      answers[0],
      secret.answer_1_hash,
      secret.answer_1_salt
    );
    results.push(answer1Correct);
    if (answer1Correct) correctCount++;

    const answer2Correct = await verifySecretAnswer(
      answers[1],
      secret.answer_2_hash,
      secret.answer_2_salt
    );
    results.push(answer2Correct);
    if (answer2Correct) correctCount++;

    const answer3Correct = await verifySecretAnswer(
      answers[2],
      secret.answer_3_hash,
      secret.answer_3_salt
    );
    results.push(answer3Correct);
    if (answer3Correct) correctCount++;

    const passed = correctCount >= 2;
    const verificationScore = correctCount / 3;

    // Record attempt
    const { ipAddress } = extractRequestMeta(req);
    await query(
      `INSERT INTO verification_attempts (claim_id, correct_answers, attempt_status, ip_address)
       VALUES ($1, $2, $3, $4)`,
      [claimId, correctCount, passed ? 'PASSED' : 'FAILED', ipAddress]
    );

    // Update claim
    const newStatus = passed ? ClaimStatus.VERIFIED : ClaimStatus.PENDING;
    const newAttempts = claim.attempts_made + 1;

    await query(
      `UPDATE claims SET 
        status = $1, 
        verification_score = $2, 
        attempts_made = $3,
        last_attempt_at = NOW()
       WHERE id = $4`,
      [newStatus, verificationScore, newAttempts, claimId]
    );

    // Log the attempt
    await logClaimAttempt(req, parseInt(claimId), passed, correctCount);

    // Update trust score
    if (!passed) {
      await onFailedVerification(req, userId);
      
      // Check for multiple failures
      const totalFailed = await query(
        `SELECT COUNT(*) FROM verification_attempts
         WHERE claim_id IN (SELECT id FROM claims WHERE claimant_id = $1)
         AND attempt_status = 'FAILED'
         AND attempt_at > NOW() - INTERVAL '7 days'`,
        [userId]
      );
      await onMultipleFailedClaims(req, userId, parseInt(totalFailed.rows[0].count));
    }

    // If verified, update found item status
    if (passed) {
      await query(
        `UPDATE found_items SET status = 'MATCHED' WHERE id = $1`,
        [claim.found_item_id]
      );
      await query(
        `UPDATE lost_items SET status = 'CLAIMED' WHERE id = $1`,
        [claim.lost_item_id]
      );
    }

    const attemptsRemaining = 3 - parseInt(attemptsToday.rows[0].count) - 1;

    res.json({
      success: true,
      data: {
        passed,
        score: correctCount,
        attempts_remaining: attemptsRemaining,
        message: passed 
          ? 'Verification successful! You can now coordinate the handover.'
          : `Verification failed. ${correctCount}/3 correct. ${attemptsRemaining} attempts remaining.`
      }
    });
  } catch (error) {
    console.error('Verify claim error:', error);
    res.status(500).json({ success: false, message: 'Verification failed' });
  }
}

// Generate OTP for handover
export async function generateHandoverOTP(req: Request, res: Response): Promise<void> {
  try {
    const { claimId } = req.params;
    const userId = req.user!.userId;

    // Get claim
    const claimResult = await query(
      `SELECT c.*, li.user_id as lost_item_owner, fi.finder_id
       FROM claims c
       JOIN lost_items li ON c.lost_item_id = li.id
       JOIN found_items fi ON c.found_item_id = fi.id
       WHERE c.id = $1`,
      [claimId]
    );

    if (claimResult.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Claim not found' });
      return;
    }

    const claim = claimResult.rows[0];

    // Only the verified owner can generate OTP
    if (claim.claimant_id !== userId) {
      res.status(403).json({ success: false, message: 'Only the item owner can generate the handover code' });
      return;
    }

    if (claim.status !== 'VERIFIED') {
      res.status(400).json({ success: false, message: 'Claim must be verified before generating handover code' });
      return;
    }

    // Check for existing valid OTP
    const existingOTP = await query(
      `SELECT id, otp_expires_at FROM handover_confirmations
       WHERE claim_id = $1 AND otp_expires_at > NOW() AND otp_verified = FALSE`,
      [claimId]
    );

    if (existingOTP.rows.length > 0) {
      res.status(400).json({
        success: false,
        message: 'A valid handover code already exists',
        expires_at: existingOTP.rows[0].otp_expires_at
      });
      return;
    }

    // Generate OTP
    const otp = generateOTP();
    const otpHash = await hashOTP(otp);

    // Store or update handover confirmation
    await query(
      `INSERT INTO handover_confirmations (claim_id, otp_code_hash, otp_expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '24 hours')
       ON CONFLICT (claim_id) 
       DO UPDATE SET otp_code_hash = $2, otp_expires_at = NOW() + INTERVAL '24 hours', 
                     otp_verified = FALSE, verification_attempts = 0`,
      [claimId, otpHash]
    );

    // Log OTP generation
    await logOtpAction(req, parseInt(claimId), 'generated');

    res.json({
      success: true,
      data: {
        otp,
        expires_in: '24 hours',
        message: 'Share this code only when you physically receive your item. The finder will enter this code to confirm the return.'
      }
    });
  } catch (error) {
    console.error('Generate OTP error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate handover code' });
  }
}

// Verify OTP and complete handover
export async function confirmHandover(req: Request, res: Response): Promise<void> {
  try {
    const { claimId } = req.params;
    const userId = req.user!.userId;
    const { otp } = req.body;

    // Get claim and handover info
    const claimResult = await query(
      `SELECT c.*, h.id as handover_id, h.otp_code_hash, h.otp_expires_at, 
              h.otp_verified, h.verification_attempts,
              fi.finder_id, li.user_id as owner_id
       FROM claims c
       JOIN handover_confirmations h ON h.claim_id = c.id
       JOIN found_items fi ON c.found_item_id = fi.id
       JOIN lost_items li ON c.lost_item_id = li.id
       WHERE c.id = $1`,
      [claimId]
    );

    if (claimResult.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Claim or handover not found' });
      return;
    }

    const data = claimResult.rows[0];

    // Only finder or coop staff can confirm handover
    const isFinderOrCoopStaff = data.finder_id === userId || req.user!.role === UserRole.COOP_STAFF;
    if (!isFinderOrCoopStaff) {
      res.status(403).json({ success: false, message: 'Only the finder or cooperative staff can confirm the handover' });
      return;
    }

    if (data.otp_verified) {
      res.status(400).json({ success: false, message: 'Handover already confirmed' });
      return;
    }

    if (new Date(data.otp_expires_at) < new Date()) {
      res.status(400).json({ success: false, message: 'Handover code has expired. Please request a new one.' });
      return;
    }

    if (data.verification_attempts >= 3) {
      res.status(429).json({ success: false, message: 'Too many failed attempts. Please contact support.' });
      return;
    }

    // Verify OTP
    const isValid = await verifyOTP(otp, data.otp_code_hash);

    if (!isValid) {
      // Increment attempts
      await query(
        `UPDATE handover_confirmations SET verification_attempts = verification_attempts + 1 WHERE id = $1`,
        [data.handover_id]
      );
      
      await logOtpAction(req, parseInt(claimId), 'failed');

      res.status(400).json({
        success: false,
        message: 'Invalid handover code',
        attempts_remaining: 2 - data.verification_attempts
      });
      return;
    }

    // Success - complete handover
    await transaction(async (client) => {
      // Update handover
      await client.query(
        `UPDATE handover_confirmations 
         SET otp_verified = TRUE, returned_at = NOW(), return_confirmed_by = $1
         WHERE id = $2`,
        [userId, data.handover_id]
      );

      // Update claim
      await client.query(
        `UPDATE claims SET status = 'RETURNED' WHERE id = $1`,
        [claimId]
      );

      // Update items
      await client.query(
        `UPDATE lost_items SET status = 'RETURNED' WHERE id = $1`,
        [data.lost_item_id]
      );
      await client.query(
        `UPDATE found_items SET status = 'RETURNED' WHERE id = $1`,
        [data.found_item_id]
      );
    });

    // Log and update trust scores
    await logOtpAction(req, parseInt(claimId), 'verified');
    await onSuccessfulReturn(req, data.finder_id, data.owner_id);

    res.json({
      success: true,
      message: 'Item return confirmed successfully! Thank you for using Byaboneka+.'
    });
  } catch (error) {
    console.error('Confirm handover error:', error);
    res.status(500).json({ success: false, message: 'Failed to confirm handover' });
  }
}

// Get claim details
export async function getClaim(req: Request, res: Response): Promise<void> {
  try {
    const { claimId } = req.params;
    const userId = req.user!.userId;

    const result = await query(
      `SELECT c.*, 
              li.title as lost_item_title, li.category,
              fi.title as found_item_title, fi.finder_id,
              h.otp_expires_at, h.otp_verified,
              u.name as claimant_name
       FROM claims c
       JOIN lost_items li ON c.lost_item_id = li.id
       JOIN found_items fi ON c.found_item_id = fi.id
       LEFT JOIN handover_confirmations h ON h.claim_id = c.id
       JOIN users u ON c.claimant_id = u.id
       WHERE c.id = $1`,
      [claimId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Claim not found' });
      return;
    }

    const claim = result.rows[0];

    // Only allow access to claim participants or admin
    const isParticipant = claim.claimant_id === userId || claim.finder_id === userId;
    if (!isParticipant && req.user!.role !== UserRole.ADMIN) {
      res.status(403).json({ success: false, message: 'Not authorized to view this claim' });
      return;
    }

    res.json({ success: true, data: claim });
  } catch (error) {
    console.error('Get claim error:', error);
    res.status(500).json({ success: false, message: 'Failed to get claim' });
  }
}

// Get user's claims
export async function getMyClaims(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const { page, limit, offset } = parsePaginationParams(
      req.query.page as string,
      req.query.limit as string
    );

    const countResult = await query(
      'SELECT COUNT(*) FROM claims WHERE claimant_id = $1',
      [userId]
    );
    const total = parseInt(countResult.rows[0].count);

    const result = await query(
      `SELECT c.*, 
              li.title as lost_item_title, li.category,
              fi.title as found_item_title,
              h.otp_expires_at, h.otp_verified
       FROM claims c
       JOIN lost_items li ON c.lost_item_id = li.id
       JOIN found_items fi ON c.found_item_id = fi.id
       LEFT JOIN handover_confirmations h ON h.claim_id = c.id
       WHERE c.claimant_id = $1
       ORDER BY c.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    res.json({
      success: true,
      data: result.rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (error) {
    console.error('Get my claims error:', error);
    res.status(500).json({ success: false, message: 'Failed to get claims' });
  }
}

// Cancel claim
export async function cancelClaim(req: Request, res: Response): Promise<void> {
  try {
    const { claimId } = req.params;
    const userId = req.user!.userId;

    const claim = await query(
      'SELECT * FROM claims WHERE id = $1 AND claimant_id = $2',
      [claimId, userId]
    );

    if (claim.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Claim not found' });
      return;
    }

    if (!['PENDING', 'VERIFIED'].includes(claim.rows[0].status)) {
      res.status(400).json({ success: false, message: 'Cannot cancel this claim' });
      return;
    }

    await query(
      `UPDATE claims SET status = 'CANCELLED' WHERE id = $1`,
      [claimId]
    );

    // Revert item statuses if needed
    if (claim.rows[0].status === 'VERIFIED') {
      await query(`UPDATE found_items SET status = 'UNCLAIMED' WHERE id = $1`, [claim.rows[0].found_item_id]);
      await query(`UPDATE lost_items SET status = 'ACTIVE' WHERE id = $1`, [claim.rows[0].lost_item_id]);
    }

    res.json({ success: true, message: 'Claim cancelled' });
  } catch (error) {
    console.error('Cancel claim error:', error);
    res.status(500).json({ success: false, message: 'Failed to cancel claim' });
  }
}
