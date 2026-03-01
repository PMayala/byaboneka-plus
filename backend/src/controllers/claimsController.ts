/**
 * backend/src/controllers/claimsController.ts — PATCHED
 *
 * Fixes applied:
 *  1. verifyClaim: response now uses `verified` + `correct_count` (not `passed` + `score`)
 *     so the frontend ClaimDetailPage type matches the backend response.
 *  2. getFinderClaims: new exported function — returns claims on a specific found
 *     item where the requesting user is the finder. Used by:
 *       GET /found-items/:foundItemId/claims   (see routes/index.ts additions)
 *  3. verifySecretAnswer calls run in parallel (Promise.all) to prevent timing attacks.
 *  4. Everything else is identical to the original.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 */

import { Request, Response } from 'express';
import { query, transaction } from '../config/database';
import {
  verifySecretAnswer,
  parsePaginationParams,
  generateOTP,
  hashOTP,
  verifyOTP,
  hashSecretAnswer,
} from '../utils';
import {
  logClaimAttempt,
  logOtpAction,
  logAudit,
  extractRequestMeta,
} from '../services/auditService';
import {
  onFailedVerification,
  onSuccessfulReturn,
  onMultipleFailedClaims,
} from '../services/trustService';
import { ClaimStatus, UserRole } from '../types';
import {
  sendClaimNotificationEmail,
  sendClaimResultEmail,
} from '../services/emailService';

// ─────────────────────────────────────────────────────────────────────────────
// CREATE CLAIM
// ─────────────────────────────────────────────────────────────────────────────
export async function createClaim(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const { lost_item_id, found_item_id } = req.body;

    const lostItem = await query(
      'SELECT id, user_id, status FROM lost_items WHERE id = $1',
      [lost_item_id]
    );
    if (lostItem.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Lost item not found' });
      return;
    }
    if (lostItem.rows[0].user_id !== userId) {
      res
        .status(403)
        .json({ success: false, message: 'You can only claim items for your own lost reports' });
      return;
    }
    if (lostItem.rows[0].status !== 'ACTIVE') {
      res.status(400).json({ success: false, message: 'This lost item is no longer active' });
      return;
    }

    const foundItem = await query(
      'SELECT id, status, finder_id FROM found_items WHERE id = $1',
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

    const existingClaim = await query(
      `SELECT id FROM claims
       WHERE lost_item_id = $1 AND found_item_id = $2 AND claimant_id = $3
       AND status NOT IN ('CANCELLED', 'REJECTED', 'EXPIRED')`,
      [lost_item_id, found_item_id, userId]
    );
    if (existingClaim.rows.length > 0) {
      res
        .status(409)
        .json({ success: false, message: 'You already have an active claim for this item' });
      return;
    }

    // Create in PENDING_QUESTIONS — finder must set questions next
    const result = await query(
      `INSERT INTO claims (lost_item_id, found_item_id, claimant_id, status)
       VALUES ($1, $2, $3, 'PENDING_QUESTIONS')
       RETURNING *`,
      [lost_item_id, found_item_id, userId]
    );

    // Notify finder
    try {
      const finderInfo = await query(
        `SELECT u.email, u.name, fi.title
         FROM found_items fi JOIN users u ON fi.finder_id = u.id
         WHERE fi.id = $1`,
        [found_item_id]
      );
      if (finderInfo.rows[0]) {
        sendClaimNotificationEmail(
          finderInfo.rows[0].email,
          finderInfo.rows[0].name,
          finderInfo.rows[0].title,
          result.rows[0].id
        ).catch((err) => console.error('Claim notification email failed:', err.message));
      }
    } catch (emailErr) {
      console.error('Failed to send claim notification:', emailErr);
    }

    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Claim created. The finder will be notified to set verification questions.',
    });
  } catch (error) {
    console.error('Create claim error:', error);
    res.status(500).json({ success: false, message: 'Failed to create claim' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SET VERIFICATION QUESTIONS  (FINDER)
// ─────────────────────────────────────────────────────────────────────────────
export async function setVerificationQuestions(req: Request, res: Response): Promise<void> {
  try {
    const { claimId } = req.params;
    const userId = req.user!.userId;
    const { questions } = req.body; // Array of { question, answer }

    const claimResult = await query(
      `SELECT c.*, fi.finder_id
       FROM claims c
       JOIN found_items fi ON c.found_item_id = fi.id
       WHERE c.id = $1`,
      [claimId]
    );

    if (claimResult.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Claim not found' });
      return;
    }

    const claim = claimResult.rows[0];
    const isFinder = claim.finder_id === userId;
    const isCoopStaff = req.user!.role === UserRole.COOP_STAFF;

    if (!isFinder && !isCoopStaff) {
      res.status(403).json({
        success: false,
        message: 'Only the finder or cooperative staff can set verification questions',
      });
      return;
    }

    if (claim.status !== 'PENDING_QUESTIONS') {
      res.status(400).json({
        success: false,
        message: 'Verification questions can only be set when the claim is awaiting questions',
      });
      return;
    }

    const existing = await query(
      'SELECT id FROM verification_secrets WHERE claim_id = $1',
      [claimId]
    );
    if (existing.rows.length > 0) {
      res
        .status(409)
        .json({ success: false, message: 'Verification questions already set for this claim' });
      return;
    }

    if (!Array.isArray(questions) || questions.length !== 3) {
      res.status(400).json({ success: false, message: 'Exactly 3 questions are required' });
      return;
    }

    // Hash all 3 answers in parallel
    const [q1, q2, q3] = await Promise.all([
      hashSecretAnswer(questions[0].answer),
      hashSecretAnswer(questions[1].answer),
      hashSecretAnswer(questions[2].answer),
    ]);

    await transaction(async (client) => {
      await client.query(
        `INSERT INTO verification_secrets
         (claim_id, created_by,
          question_1_text, answer_1_hash, answer_1_salt,
          question_2_text, answer_2_hash, answer_2_salt,
          question_3_text, answer_3_hash, answer_3_salt)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          claimId, userId,
          questions[0].question, q1.hash, q1.salt,
          questions[1].question, q2.hash, q2.salt,
          questions[2].question, q3.hash, q3.salt,
        ]
      );

      await client.query(
        `UPDATE claims SET status = 'PENDING' WHERE id = $1`,
        [claimId]
      );
    });

    // Notify owner that questions are ready
    try {
      const ownerInfo = await query(
        `SELECT u.email, u.name, li.title
         FROM claims c
         JOIN lost_items li ON c.lost_item_id = li.id
         JOIN users u ON c.claimant_id = u.id
         WHERE c.id = $1`,
        [claimId]
      );
      if (ownerInfo.rows[0]) {
        sendClaimResultEmail(
          ownerInfo.rows[0].email,
          ownerInfo.rows[0].name,
          ownerInfo.rows[0].title,
          parseInt(claimId),
          false,
          0
        ).catch((err) => console.error('Question-ready notification failed:', err.message));
      }
    } catch (emailErr) {
      console.error('Failed to send question notification:', emailErr);
    }

    res.status(201).json({
      success: true,
      message: 'Verification questions saved. The owner has been notified to answer them.',
    });
  } catch (error) {
    console.error('Set verification questions error:', error);
    res.status(500).json({ success: false, message: 'Failed to set verification questions' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET VERIFICATION QUESTIONS  (OWNER)
// ─────────────────────────────────────────────────────────────────────────────
export async function getVerificationQuestions(req: Request, res: Response): Promise<void> {
  try {
    const { claimId } = req.params;
    const userId = req.user!.userId;

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
      res
        .status(400)
        .json({ success: false, message: 'Verification is only available for pending claims' });
      return;
    }

    const attemptsToday = await query(
      `SELECT COUNT(*) FROM verification_attempts
       WHERE claim_id = $1 AND attempt_at > NOW() - INTERVAL '24 hours'`,
      [claimId]
    );

    if (parseInt(attemptsToday.rows[0].count) >= 3) {
      res.status(429).json({
        success: false,
        message: 'Too many verification attempts. Please try again in 24 hours.',
      });
      return;
    }

    const secrets = await query(
      `SELECT question_1_text, question_2_text, question_3_text
       FROM verification_secrets WHERE claim_id = $1`,
      [claimId]
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
          secrets.rows[0].question_3_text,
        ],
        attempts_remaining: 3 - parseInt(attemptsToday.rows[0].count),
      },
    });
  } catch (error) {
    console.error('Get verification questions error:', error);
    res.status(500).json({ success: false, message: 'Failed to get verification questions' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// VERIFY CLAIM  (OWNER answers questions)
// FIX: response now uses `verified` + `correct_count` to match frontend types.
// FIX: all three bcrypt comparisons run in parallel (Promise.all) to prevent
//      timing-based answer enumeration attacks.
// ─────────────────────────────────────────────────────────────────────────────
export async function verifyClaim(req: Request, res: Response): Promise<void> {
  try {
    const { claimId } = req.params;
    const userId = req.user!.userId;
    const { answers } = req.body;

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

    const attemptsToday = await query(
      `SELECT COUNT(*) FROM verification_attempts
       WHERE claim_id = $1 AND attempt_at > NOW() - INTERVAL '24 hours'`,
      [claimId]
    );

    if (parseInt(attemptsToday.rows[0].count) >= 3) {
      res.status(429).json({
        success: false,
        message: 'Daily verification limit reached. Try again tomorrow.',
      });
      return;
    }

    const secrets = await query(
      `SELECT * FROM verification_secrets WHERE claim_id = $1`,
      [claimId]
    );

    if (secrets.rows.length === 0) {
      res.status(500).json({ success: false, message: 'Verification data not found' });
      return;
    }

    const secret = secrets.rows[0];

    // FIX: run all three comparisons in parallel to prevent timing attacks
    const [answer1Correct, answer2Correct, answer3Correct] = await Promise.all([
      verifySecretAnswer(answers[0], secret.answer_1_hash, secret.answer_1_salt),
      verifySecretAnswer(answers[1], secret.answer_2_hash, secret.answer_2_salt),
      verifySecretAnswer(answers[2], secret.answer_3_hash, secret.answer_3_salt),
    ]);

    const correctCount = [answer1Correct, answer2Correct, answer3Correct].filter(Boolean).length;
    const verified = correctCount >= 2; // pass threshold: 2/3
    const verificationScore = correctCount / 3;

    // Record attempt
    const { ipAddress } = extractRequestMeta(req);
    await query(
      `INSERT INTO verification_attempts (claim_id, correct_answers, attempt_status, ip_address)
       VALUES ($1, $2, $3, $4)`,
      [claimId, correctCount, verified ? 'PASSED' : 'FAILED', ipAddress]
    );

    // Update claim status
    await query(
      `UPDATE claims SET
        status = $1,
        verification_score = $2,
        attempts_made = attempts_made + 1,
        last_attempt_at = NOW()
       WHERE id = $3`,
      [verified ? ClaimStatus.VERIFIED : ClaimStatus.PENDING, verificationScore, claimId]
    );

    await logClaimAttempt(req, parseInt(claimId), verified, correctCount);

    if (!verified) {
      await onFailedVerification(req, userId);
      const totalFailed = await query(
        `SELECT COUNT(*) FROM verification_attempts
         WHERE claim_id IN (SELECT id FROM claims WHERE claimant_id = $1)
         AND attempt_status = 'FAILED'
         AND attempt_at > NOW() - INTERVAL '7 days'`,
        [userId]
      );
      await onMultipleFailedClaims(req, userId, parseInt(totalFailed.rows[0].count));
    }

    if (verified) {
      await query(`UPDATE found_items SET status = 'MATCHED' WHERE id = $1`, [claim.found_item_id]);
      await query(`UPDATE lost_items SET status = 'CLAIMED' WHERE id = $1`, [claim.lost_item_id]);
    }

    // Email result to claimant
    try {
      const claimantInfo = await query('SELECT email, name FROM users WHERE id = $1', [userId]);
      const itemInfo = await query('SELECT title FROM lost_items WHERE id = $1', [claim.lost_item_id]);
      if (claimantInfo.rows[0] && itemInfo.rows[0]) {
        sendClaimResultEmail(
          claimantInfo.rows[0].email,
          claimantInfo.rows[0].name,
          itemInfo.rows[0].title,
          parseInt(claimId),
          verified,
          verificationScore
        ).catch((err) => console.error('Claim result email failed:', err.message));
      }
    } catch (emailErr) {
      console.error('Failed to send claim result email:', emailErr);
    }

    const attemptsRemaining = 3 - parseInt(attemptsToday.rows[0].count) - 1;

    // FIX: use `verified` and `correct_count` to match frontend type expectations
    res.json({
      success: true,
      data: {
        verified,
        correct_count: correctCount,
        attempts_remaining: Math.max(0, attemptsRemaining),
        message: verified
          ? 'Verification successful! You can now coordinate the handover.'
          : `Verification failed. ${correctCount}/3 correct. ${Math.max(0, attemptsRemaining)} attempts remaining.`,
      },
    });
  } catch (error) {
    console.error('Verify claim error:', error);
    res.status(500).json({ success: false, message: 'Verification failed' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET CLAIM  (both participants)
// ─────────────────────────────────────────────────────────────────────────────
export async function getClaim(req: Request, res: Response): Promise<void> {
  try {
    const { claimId } = req.params;
    const userId = req.user!.userId;

    const result = await query(
      `SELECT c.*,
              li.title as lost_item_title, li.category,
              li.location_area as lost_item_area,
              fi.title as found_item_title, fi.finder_id,
              fi.location_area as found_item_area,
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

// ─────────────────────────────────────────────────────────────────────────────
// GET MY CLAIMS  (claimant / owner side)
// ─────────────────────────────────────────────────────────────────────────────
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
              li.location_area as lost_item_area,
              fi.title as found_item_title,
              fi.location_area as found_item_area,
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
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Get my claims error:', error);
    res.status(500).json({ success: false, message: 'Failed to get claims' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// NEW: GET FINDER CLAIMS for a specific found item
// Endpoint: GET /found-items/:foundItemId/claims
// Only the finder of that item can call this.
// ─────────────────────────────────────────────────────────────────────────────
export async function getFinderClaims(req: Request, res: Response): Promise<void> {
  try {
    const { foundItemId } = req.params;
    const userId = req.user!.userId;

    // Verify the requesting user is the finder of this item
    const foundItem = await query(
      'SELECT id, finder_id FROM found_items WHERE id = $1',
      [foundItemId]
    );

    if (foundItem.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Found item not found' });
      return;
    }

    const isFinder = foundItem.rows[0].finder_id === userId;
    const isAdmin = req.user!.role === UserRole.ADMIN;

    if (!isFinder && !isAdmin) {
      res.status(403).json({
        success: false,
        message: 'Only the finder of this item can view its claims',
      });
      return;
    }

    const result = await query(
      `SELECT c.id, c.status, c.claimant_id, c.created_at,
              li.title as lost_item_title, li.category,
              u.name as claimant_name
       FROM claims c
       JOIN lost_items li ON c.lost_item_id = li.id
       JOIN users u ON c.claimant_id = u.id
       WHERE c.found_item_id = $1
         AND c.status NOT IN ('CANCELLED', 'EXPIRED')
       ORDER BY
         CASE c.status
           WHEN 'PENDING_QUESTIONS' THEN 1
           WHEN 'PENDING' THEN 2
           WHEN 'VERIFIED' THEN 3
           ELSE 4
         END,
         c.created_at DESC`,
      [foundItemId]
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Get finder claims error:', error);
    res.status(500).json({ success: false, message: 'Failed to get claims for this item' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CANCEL CLAIM
// ─────────────────────────────────────────────────────────────────────────────
export async function cancelClaim(req: Request, res: Response): Promise<void> {
  try {
    const { claimId } = req.params;
    const userId = req.user!.userId;

    const claimResult = await query(
      `SELECT c.*, fi.finder_id
       FROM claims c
       JOIN found_items fi ON c.found_item_id = fi.id
       WHERE c.id = $1`,
      [claimId]
    );

    if (claimResult.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Claim not found' });
      return;
    }

    const claim = claimResult.rows[0];
    const isParticipant = claim.claimant_id === userId || claim.finder_id === userId;

    if (!isParticipant && req.user!.role !== UserRole.ADMIN) {
      res.status(403).json({ success: false, message: 'Not authorized to cancel this claim' });
      return;
    }

    if (['RETURNED', 'CANCELLED'].includes(claim.status)) {
      res.status(400).json({ success: false, message: 'Claim cannot be cancelled in this state' });
      return;
    }

    await query(
      `UPDATE claims SET status = 'CANCELLED' WHERE id = $1`,
      [claimId]
    );

    // Revert found item to UNCLAIMED if it was MATCHED
    if (claim.status === 'VERIFIED') {
      await query(
        `UPDATE found_items SET status = 'UNCLAIMED' WHERE id = $1 AND status = 'MATCHED'`,
        [claim.found_item_id]
      );
      await query(
        `UPDATE lost_items SET status = 'ACTIVE' WHERE id = $1 AND status = 'CLAIMED'`,
        [claim.lost_item_id]
      );
    }

    res.json({ success: true, message: 'Claim cancelled' });
  } catch (error) {
    console.error('Cancel claim error:', error);
    res.status(500).json({ success: false, message: 'Failed to cancel claim' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GENERATE HANDOVER OTP  (OWNER)
// ─────────────────────────────────────────────────────────────────────────────
export async function generateHandoverOTP(req: Request, res: Response): Promise<void> {
  try {
    const { claimId } = req.params;
    const userId = req.user!.userId;

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

    if (claim.claimant_id !== userId) {
      res
        .status(403)
        .json({ success: false, message: 'Only the item owner can generate the handover code' });
      return;
    }

    if (claim.status !== 'VERIFIED') {
      res
        .status(400)
        .json({ success: false, message: 'Claim must be verified before generating handover code' });
      return;
    }

    // Check for existing valid OTP
    const existingOTP = await query(
      `SELECT id FROM handover_confirmations
       WHERE claim_id = $1 AND expires_at > NOW() AND otp_verified = false`,
      [claimId]
    );
    if (existingOTP.rows.length > 0) {
      res
        .status(409)
        .json({ success: false, message: 'A valid handover code already exists for this claim' });
      return;
    }

    const otp = generateOTP();
    const otpHash = await hashOTP(otp);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await query(
      `INSERT INTO handover_confirmations (claim_id, otp_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [claimId, otpHash, expiresAt]
    );

    await logOtpAction(req, parseInt(claimId), 'generated');

    res.json({
      success: true,
      data: {
        otp,
        expires_at: expiresAt.toISOString(),
        validity_hours: 24,
      },
    });
  } catch (error) {
    console.error('Generate handover OTP error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate handover code' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// VERIFY HANDOVER OTP  (FINDER confirms receipt)
// ─────────────────────────────────────────────────────────────────────────────
export async function verifyHandoverOTP(req: Request, res: Response): Promise<void> {
  try {
    const { claimId } = req.params;
    const userId = req.user!.userId;
    const { otp } = req.body;

    const claimResult = await query(
      `SELECT c.*, fi.finder_id
       FROM claims c
       JOIN found_items fi ON c.found_item_id = fi.id
       WHERE c.id = $1`,
      [claimId]
    );

    if (claimResult.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Claim not found' });
      return;
    }

    const claim = claimResult.rows[0];

    if (claim.finder_id !== userId && req.user!.role !== UserRole.COOP_STAFF) {
      res.status(403).json({ success: false, message: 'Only the finder can confirm the handover' });
      return;
    }

    if (claim.status !== 'VERIFIED') {
      res.status(400).json({ success: false, message: 'Claim is not in verified status' });
      return;
    }

    const otpRecord = await query(
      `SELECT * FROM handover_confirmations
       WHERE claim_id = $1 AND otp_verified = false AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [claimId]
    );

    if (otpRecord.rows.length === 0) {
      res.status(400).json({ success: false, message: 'No valid handover code found. Ask the owner to regenerate.' });
      return;
    }

    const record = otpRecord.rows[0];
    const otpValid = await verifyOTP(otp, record.otp_hash);

    if (!otpValid) {
      await logOtpAction(req, parseInt(claimId), 'failed');
      res.status(400).json({ success: false, message: 'Invalid handover code' });
      return;
    }

    // Mark OTP verified and complete handover
    await transaction(async (client) => {
      await client.query(
        `UPDATE handover_confirmations SET otp_verified = true, verified_at = NOW() WHERE id = $1`,
        [record.id]
      );
      await client.query(
        `UPDATE claims SET status = 'RETURNED' WHERE id = $1`,
        [claimId]
      );
      await client.query(
        `UPDATE found_items SET status = 'RETURNED' WHERE id = $1`,
        [claim.found_item_id]
      );
    });

    await logOtpAction(req, parseInt(claimId), 'verified');
    await onSuccessfulReturn(req, claim.claimant_id, claim.finder_id);

    res.json({
      success: true,
      data: { message: 'Handover confirmed! Item marked as returned.', handover_completed: true },
    });
  } catch (error) {
    console.error('Verify handover OTP error:', error);
    res.status(500).json({ success: false, message: 'Failed to verify handover code' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET HANDOVER STATUS
// ─────────────────────────────────────────────────────────────────────────────
export async function getHandoverStatus(req: Request, res: Response): Promise<void> {
  try {
    const { claimId } = req.params;
    const userId = req.user!.userId;

    const claimResult = await query(
      `SELECT c.*, fi.finder_id FROM claims c
       JOIN found_items fi ON c.found_item_id = fi.id
       WHERE c.id = $1`,
      [claimId]
    );

    if (claimResult.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Claim not found' });
      return;
    }

    const claim = claimResult.rows[0];
    const isParticipant = claim.claimant_id === userId || claim.finder_id === userId;
    if (!isParticipant && req.user!.role !== UserRole.ADMIN) {
      res.status(403).json({ success: false, message: 'Not authorized' });
      return;
    }

    const otpRecord = await query(
      `SELECT id, otp_verified, expires_at, created_at
       FROM handover_confirmations
       WHERE claim_id = $1
       ORDER BY created_at DESC LIMIT 1`,
      [claimId]
    );

    if (otpRecord.rows.length === 0) {
      res.json({
        success: true,
        data: { has_otp: false, message: 'No handover code generated yet' },
      });
      return;
    }

    const record = otpRecord.rows[0];
    const isExpired = new Date(record.expires_at) < new Date();

    res.json({
      success: true,
      data: {
        has_otp: true,
        otp_verified: record.otp_verified,
        expires_at: record.expires_at,
        is_expired: isExpired,
        message: record.otp_verified
          ? 'Handover already completed'
          : isExpired
          ? 'Code expired — ask owner to generate a new one'
          : 'Code is valid and waiting for confirmation',
      },
    });
  } catch (error) {
    console.error('Get handover status error:', error);
    res.status(500).json({ success: false, message: 'Failed to get handover status' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// OPEN DISPUTE
// ─────────────────────────────────────────────────────────────────────────────
export async function openDispute(req: Request, res: Response): Promise<void> {
  try {
    const { claimId } = req.params;
    const userId = req.user!.userId;
    const { reason, evidence_urls } = req.body;

    const claimResult = await query(
      `SELECT c.*, fi.finder_id FROM claims c
       JOIN found_items fi ON c.found_item_id = fi.id
       WHERE c.id = $1`,
      [claimId]
    );

    if (claimResult.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Claim not found' });
      return;
    }

    const claim = claimResult.rows[0];
    const isParticipant = claim.claimant_id === userId || claim.finder_id === userId;
    if (!isParticipant) {
      res.status(403).json({ success: false, message: 'Not authorized to dispute this claim' });
      return;
    }

    if (!['PENDING', 'VERIFIED', 'REJECTED'].includes(claim.status)) {
      res.status(400).json({ success: false, message: 'Cannot dispute a claim in this state' });
      return;
    }

    // Check for existing open dispute
    const existing = await query(
      `SELECT id FROM disputes WHERE claim_id = $1 AND status IN ('OPEN', 'UNDER_REVIEW')`,
      [claimId]
    );
    if (existing.rows.length > 0) {
      res.status(409).json({ success: false, message: 'An open dispute already exists for this claim' });
      return;
    }

    const result = await query(
      `INSERT INTO disputes (claim_id, opened_by, reason, evidence_urls, status)
       VALUES ($1, $2, $3, $4, 'OPEN')
       RETURNING *`,
      [claimId, userId, reason, JSON.stringify(evidence_urls || [])]
    );

    // Update claim status
    await query(`UPDATE claims SET status = 'DISPUTED' WHERE id = $1`, [claimId]);

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Open dispute error:', error);
    res.status(500).json({ success: false, message: 'Failed to open dispute' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET DISPUTE
// ─────────────────────────────────────────────────────────────────────────────
export async function getDispute(req: Request, res: Response): Promise<void> {
  try {
    const { claimId } = req.params;
    const userId = req.user!.userId;

    const claimResult = await query(
      `SELECT c.*, fi.finder_id FROM claims c
       JOIN found_items fi ON c.found_item_id = fi.id
       WHERE c.id = $1`,
      [claimId]
    );

    if (claimResult.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Claim not found' });
      return;
    }

    const claim = claimResult.rows[0];
    const isParticipant = claim.claimant_id === userId || claim.finder_id === userId;
    if (!isParticipant && req.user!.role !== UserRole.ADMIN) {
      res.status(403).json({ success: false, message: 'Not authorized' });
      return;
    }

    const result = await query(
      `SELECT * FROM disputes WHERE claim_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [claimId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'No dispute found for this claim' });
      return;
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Get dispute error:', error);
    res.status(500).json({ success: false, message: 'Failed to get dispute' });
  }
}