/**
 * Enhanced Routes for Byaboneka+
 * 
 * Adds new endpoints for:
 * - Dispute workflow (CLAIM-07)
 * - Enhanced OTP verification (HAND-01 to HAND-07)
 * - Email verification (AUTH-01)
 * - CAPTCHA integration (SYS-04)
 * - Duplicate detection responses (SYS-05)
 */

import { Router } from 'express';
import { authenticate, adminOnly } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { verificationLimiter, otpLimiter } from '../middleware/rateLimiter';
import { requireVerifiedEmail } from '../middleware/emailVerification';
import { z } from 'zod';

// Import new services
import * as otpService from '../services/otpService';
import * as disputeService from '../services/disputeService';
import * as emailVerificationService from '../services/emailVerificationService';
import * as verificationCooldownService from '../services/verificationCooldownService';
import { checkDuplicateLostItems, checkDuplicateFoundItems } from '../services/duplicateDetectionService';

const enhancedRouter = Router();

// ============================================
// VALIDATION SCHEMAS
// ============================================

const disputeSchema = z.object({
  reason: z.string().min(20, 'Please provide a detailed reason (at least 20 characters)').max(2000),
  evidence_urls: z.array(z.string().url()).max(5).optional()
});

const resolveDisputeSchema = z.object({
  resolution: z.enum(['RESOLVED_OWNER', 'RESOLVED_FINDER', 'DISMISSED']),
  resolution_notes: z.string().min(10).max(2000)
});

const verifyEmailSchema = z.object({
  token: z.string().min(64).max(64)
});

// ============================================
// OTP / HANDOVER ENDPOINTS (Enhanced)
// ============================================

/**
 * Generate handover OTP (owner only)
 * POST /claims/:claimId/handover/otp
 */
enhancedRouter.post('/claims/:claimId/handover/otp',
  authenticate,
  requireVerifiedEmail, // Require verified email for OTP generation
  async (req, res) => {
    try {
      const { claimId } = req.params;
      const userId = req.user!.userId;
      
      const result = await otpService.generateHandoverOTP(
        parseInt(claimId),
        userId,
        req
      );
      
      if (!result.success) {
        res.status(400).json({ success: false, message: result.message });
        return;
      }
      
      res.json({
        success: true,
        data: {
          otp: result.otp, // Only shown to owner
          expires_at: result.expiresAt,
          validity_hours: 24
        },
        message: result.message
      });
    } catch (error) {
      console.error('Generate OTP error:', error);
      res.status(500).json({ success: false, message: 'Failed to generate handover code' });
    }
  }
);

/**
 * Verify handover OTP (finder or coop staff only)
 * POST /claims/:claimId/handover/verify
 */
enhancedRouter.post('/claims/:claimId/handover/verify',
  authenticate,
  otpLimiter,
  validate(z.object({ otp: z.string().length(6).regex(/^\d{6}$/) })),
  async (req, res) => {
    try {
      const { claimId } = req.params;
      const { otp } = req.body;
      const userId = req.user!.userId;
      
      const result = await otpService.verifyHandoverOTP(
        parseInt(claimId),
        otp,
        userId,
        req
      );
      
      if (!result.success) {
        res.status(400).json({
          success: false,
          message: result.message,
          attempts_remaining: result.attemptsRemaining
        });
        return;
      }
      
      res.json({
        success: true,
        message: result.message,
        handover_completed: result.handoverCompleted
      });
    } catch (error) {
      console.error('Verify OTP error:', error);
      res.status(500).json({ success: false, message: 'Failed to verify handover code' });
    }
  }
);

/**
 * Get handover status
 * GET /claims/:claimId/handover
 */
enhancedRouter.get('/claims/:claimId/handover',
  authenticate,
  async (req, res) => {
    try {
      const { claimId } = req.params;
      const status = await otpService.getHandoverStatus(parseInt(claimId));
      
      if (!status) {
        res.json({
          success: true,
          data: {
            has_otp: false,
            message: 'No handover code generated yet'
          }
        });
        return;
      }
      
      res.json({
        success: true,
        data: {
          has_otp: true,
          otp_verified: status.otpVerified,
          expires_at: status.otpExpiresAt,
          attempts_used: status.verificationAttempts,
          is_expired: new Date(status.otpExpiresAt) < new Date()
        }
      });
    } catch (error) {
      console.error('Get handover status error:', error);
      res.status(500).json({ success: false, message: 'Failed to get handover status' });
    }
  }
);

// ============================================
// DISPUTE ENDPOINTS
// ============================================

/**
 * Open a dispute for a claim
 * POST /claims/:claimId/dispute
 */
enhancedRouter.post('/claims/:claimId/dispute',
  authenticate,
  validate(disputeSchema),
  async (req, res) => {
    try {
      const { claimId } = req.params;
      const { reason, evidence_urls } = req.body;
      const userId = req.user!.userId;
      
      const result = await disputeService.openDispute(
        parseInt(claimId),
        userId,
        reason,
        evidence_urls || [],
        req
      );
      
      if (!result.success) {
        res.status(400).json({ success: false, message: result.message });
        return;
      }
      
      res.status(201).json({
        success: true,
        data: result.dispute,
        message: result.message
      });
    } catch (error) {
      console.error('Open dispute error:', error);
      res.status(500).json({ success: false, message: 'Failed to open dispute' });
    }
  }
);

/**
 * Get dispute for a claim
 * GET /claims/:claimId/dispute
 */
enhancedRouter.get('/claims/:claimId/dispute',
  authenticate,
  async (req, res) => {
    try {
      const { claimId } = req.params;
      const dispute = await disputeService.getDisputeByClaimId(parseInt(claimId));
      
      if (!dispute) {
        res.status(404).json({ success: false, message: 'No dispute found for this claim' });
        return;
      }
      
      res.json({ success: true, data: dispute });
    } catch (error) {
      console.error('Get dispute error:', error);
      res.status(500).json({ success: false, message: 'Failed to get dispute' });
    }
  }
);

/**
 * Add evidence to a dispute
 * POST /disputes/:disputeId/evidence
 */
enhancedRouter.post('/disputes/:disputeId/evidence',
  authenticate,
  validate(z.object({ evidence_urls: z.array(z.string().url()).min(1).max(5) })),
  async (req, res) => {
    try {
      const { disputeId } = req.params;
      const { evidence_urls } = req.body;
      const userId = req.user!.userId;
      
      const result = await disputeService.addDisputeEvidence(
        parseInt(disputeId),
        userId,
        evidence_urls
      );
      
      if (!result.success) {
        res.status(400).json({ success: false, message: result.message });
        return;
      }
      
      res.json({ success: true, message: result.message });
    } catch (error) {
      console.error('Add evidence error:', error);
      res.status(500).json({ success: false, message: 'Failed to add evidence' });
    }
  }
);

/**
 * Admin: Get all disputes
 * GET /admin/disputes
 */
enhancedRouter.get('/admin/disputes',
  authenticate,
  adminOnly,
  async (req, res) => {
    try {
      const { status, page, limit } = req.query;
      
      const result = await disputeService.getDisputesForReview(
        status as any,
        parseInt(page as string) || 1,
        parseInt(limit as string) || 20
      );
      
      res.json({
        success: true,
        data: result.disputes,
        pagination: {
          total: result.total,
          page: parseInt(page as string) || 1,
          limit: parseInt(limit as string) || 20
        }
      });
    } catch (error) {
      console.error('Get disputes error:', error);
      res.status(500).json({ success: false, message: 'Failed to get disputes' });
    }
  }
);

/**
 * Admin: Resolve a dispute
 * POST /admin/disputes/:disputeId/resolve
 */
enhancedRouter.post('/admin/disputes/:disputeId/resolve',
  authenticate,
  adminOnly,
  validate(resolveDisputeSchema),
  async (req, res) => {
    try {
      const { disputeId } = req.params;
      const { resolution, resolution_notes } = req.body;
      const adminId = req.user!.userId;
      
      const result = await disputeService.resolveDispute(
        parseInt(disputeId),
        adminId,
        resolution,
        resolution_notes,
        req
      );
      
      if (!result.success) {
        res.status(400).json({ success: false, message: result.message });
        return;
      }
      
      res.json({
        success: true,
        message: result.message,
        trust_adjustments: result.trustAdjustments
      });
    } catch (error) {
      console.error('Resolve dispute error:', error);
      res.status(500).json({ success: false, message: 'Failed to resolve dispute' });
    }
  }
);

// ============================================
// VERIFICATION COOLDOWN ENDPOINTS
// ============================================

/**
 * Check verification cooldown status
 * GET /claims/:claimId/verification/status
 */
enhancedRouter.get('/claims/:claimId/verification/status',
  authenticate,
  async (req, res) => {
    try {
      const { claimId } = req.params;
      const userId = req.user!.userId;
      
      const status = await verificationCooldownService.checkCooldownStatus(
        parseInt(claimId),
        userId
      );
      
      res.json({
        success: true,
        data: status
      });
    } catch (error) {
      console.error('Check cooldown error:', error);
      res.status(500).json({ success: false, message: 'Failed to check verification status' });
    }
  }
);

// ============================================
// EMAIL VERIFICATION ENDPOINTS
// ============================================

/**
 * Request email verification
 * POST /auth/email/verify/request
 */
enhancedRouter.post('/auth/email/verify/request',
  authenticate,
  async (req, res) => {
    try {
      const userId = req.user!.userId;
      
      const result = await emailVerificationService.generateEmailVerificationToken(userId, req);
      
      if (!result.success) {
        res.status(400).json({ success: false, message: result.message });
        return;
      }
      
      res.json({
        success: true,
        message: result.message,
        // In development, return token for testing
        ...(process.env.NODE_ENV === 'development' && { token: result.token })
      });
    } catch (error) {
      console.error('Request email verification error:', error);
      res.status(500).json({ success: false, message: 'Failed to send verification email' });
    }
  }
);

/**
 * Verify email with token
 * POST /auth/email/verify
 */
enhancedRouter.post('/auth/email/verify',
  authenticate,
  validate(verifyEmailSchema),
  async (req, res) => {
    try {
      const userId = req.user!.userId;
      const { token } = req.body;
      
      const result = await emailVerificationService.verifyEmail(userId, token, req);
      
      if (!result.success) {
        res.status(400).json({ success: false, message: result.message });
        return;
      }
      
      res.json({
        success: true,
        message: result.message,
        verified: result.verified
      });
    } catch (error) {
      console.error('Verify email error:', error);
      res.status(500).json({ success: false, message: 'Failed to verify email' });
    }
  }
);

/**
 * Check email verification status
 * GET /auth/email/status
 */
enhancedRouter.get('/auth/email/status',
  authenticate,
  async (req, res) => {
    try {
      const userId = req.user!.userId;
      const isVerified = await emailVerificationService.isEmailVerified(userId);
      
      res.json({
        success: true,
        data: { email_verified: isVerified }
      });
    } catch (error) {
      console.error('Check email status error:', error);
      res.status(500).json({ success: false, message: 'Failed to check email status' });
    }
  }
);

// ============================================
// DUPLICATE DETECTION ENDPOINTS
// ============================================

/**
 * Check for duplicate lost item before creation
 * POST /lost-items/check-duplicate
 */
enhancedRouter.post('/lost-items/check-duplicate',
  authenticate,
  validate(z.object({
    category: z.string(),
    title: z.string(),
    description: z.string(),
    location_area: z.string(),
    lost_date: z.string()
  })),
  async (req, res) => {
    try {
      const userId = req.user!.userId;
      const { category, title, description, location_area, lost_date } = req.body;
      
      const result = await checkDuplicateLostItems(
        userId,
        category as any,
        title,
        description,
        location_area,
        new Date(lost_date)
      );
      
      res.json({
        success: true,
        data: {
          has_potential_duplicates: result.hasPotentialDuplicates,
          candidates: result.candidates,
          highest_score: result.highestScore
        }
      });
    } catch (error) {
      console.error('Check duplicate error:', error);
      res.status(500).json({ success: false, message: 'Failed to check for duplicates' });
    }
  }
);

/**
 * Check for duplicate found item before creation
 * POST /found-items/check-duplicate
 */
enhancedRouter.post('/found-items/check-duplicate',
  authenticate,
  validate(z.object({
    category: z.string(),
    title: z.string(),
    description: z.string(),
    location_area: z.string(),
    found_date: z.string()
  })),
  async (req, res) => {
    try {
      const userId = req.user!.userId;
      const { category, title, description, location_area, found_date } = req.body;
      
      const result = await checkDuplicateFoundItems(
        userId,
        category as any,
        title,
        description,
        location_area,
        new Date(found_date)
      );
      
      res.json({
        success: true,
        data: {
          has_potential_duplicates: result.hasPotentialDuplicates,
          candidates: result.candidates,
          highest_score: result.highestScore
        }
      });
    } catch (error) {
      console.error('Check duplicate error:', error);
      res.status(500).json({ success: false, message: 'Failed to check for duplicates' });
    }
  }
);

export default enhancedRouter;
