import { Router } from 'express';

// Controllers
import * as authController from '../controllers/authController';
import * as lostItemsController from '../controllers/lostItemsController';
import * as foundItemsController from '../controllers/foundItemsController';
import * as claimsController from '../controllers/claimsController';
import * as messagesController from '../controllers/messagesController';
import * as adminController from '../controllers/adminController';
import * as cooperativesController from '../controllers/cooperativesController';

// Middleware
import {
  authenticate,
  optionalAuth,
  adminOnly,
  authorize,
  adminOrCoopStaff,
} from '../middleware/auth';
import {
  validate,
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  createLostItemSchema,
  updateLostItemSchema,
  createFoundItemSchema,
  updateFoundItemSchema,
  createClaimSchema,
  verifyClaimSchema,
  setVerificationQuestionsSchema,
  verifyOtpSchema,
  sendMessageSchema,
} from '../middleware/validation';
import {
  authLimiter,
  reportLimiter,
  claimLimiter,
  verificationLimiter,
  otpLimiter,
  messageLimiter,
  passwordResetLimiter,
  searchLimiter,
} from '../middleware/rateLimiter';
import { UserRole } from '../types';
import { checkConnection, query as dbQuery } from '../config/database';
import { fraudCheck } from '../services/fraudDetectionService';
import { requireRecaptcha, softRecaptcha } from '../middleware/recaptcha';
import { checkEmailHealth, sendContactFormEmail } from '../services/emailService';
import { requireConsent } from '../middleware/consent';
import { deleteAccount, exportUserData } from '../controllers/accountController';
import { getCooperativeAccountability } from '../services/cooperativeAccountabilityService';

const router = Router();

// ============================================
// AUTH ROUTES
// ============================================

router.post('/auth/register',
  authLimiter,
  requireConsent,
  requireRecaptcha('register'),
  validate(registerSchema),
  authController.register
);

router.post('/auth/login',
  authLimiter,
  softRecaptcha('login'),
  validate(loginSchema),
  authController.login
);

router.post('/auth/refresh', validate(refreshTokenSchema), authController.refreshToken);
router.post('/auth/logout', authenticate, authController.logout);

router.post('/auth/forgot-password',
  passwordResetLimiter,
  requireRecaptcha('forgot_password'),
  validate(forgotPasswordSchema),
  authController.forgotPassword
);

router.post('/auth/reset-password', validate(resetPasswordSchema), authController.resetPassword);

router.get('/auth/profile', authenticate, authController.getProfile);
router.put('/auth/profile', authenticate, authController.updateProfile);
router.post('/auth/change-password', authenticate, authController.changePassword);

// NOTE: Email verification endpoints are handled by the emailVerificationService
// and served by enhancedRoutes.ts if present.  Only add them here if the
// handler functions actually exist in authController.
// authController currently exports: register, login, refreshToken, logout,
// forgotPassword, resetPassword, getProfile, updateProfile, changePassword
// — do NOT add requestEmailVerification / verifyEmail / getEmailVerificationStatus here.

// ============================================
// ACCOUNT MANAGEMENT (Data Protection Rights)
// ============================================

router.delete('/users/me', authenticate, deleteAccount);
router.get('/users/me/export', authenticate, exportUserData);

// ============================================
// LOST ITEMS ROUTES
// ============================================

router.post('/lost-items',
  authenticate,
  reportLimiter,
  requireRecaptcha('report_lost'),
  fraudCheck('REPORT_CREATE'),
  validate(createLostItemSchema),
  lostItemsController.createLostItem
);

router.get('/lost-items', optionalAuth, searchLimiter, lostItemsController.getLostItems);

// NOTE: /lost-items/check-duplicate is served by novelFeatureRoutes / enhancedRoutes.
// Do NOT reference lostItemsController.checkDuplicate — that function does not exist.

router.get('/lost-items/:id', optionalAuth, lostItemsController.getLostItem);
router.put('/lost-items/:id', authenticate, validate(updateLostItemSchema), lostItemsController.updateLostItem);
router.delete('/lost-items/:id', authenticate, lostItemsController.deleteLostItem);
router.get('/lost-items/:id/matches', authenticate, lostItemsController.getLostItemMatches);
router.post('/lost-items/:id/dismiss-match', authenticate, lostItemsController.dismissMatch);
router.get('/users/me/lost-items', authenticate, lostItemsController.getMyLostItems);

// ============================================
// FOUND ITEMS ROUTES
// ============================================

router.post('/found-items',
  authenticate,
  reportLimiter,
  requireRecaptcha('report_found'),
  fraudCheck('REPORT_CREATE'),
  validate(createFoundItemSchema),
  foundItemsController.createFoundItem
);

router.get('/found-items', optionalAuth, searchLimiter, foundItemsController.getFoundItems);

// NOTE: /found-items/check-duplicate is served by novelFeatureRoutes / enhancedRoutes.
// Do NOT reference foundItemsController.checkDuplicate — that function does not exist.

router.get('/found-items/:id', optionalAuth, foundItemsController.getFoundItem);
router.put('/found-items/:id', authenticate, validate(updateFoundItemSchema), foundItemsController.updateFoundItem);
router.delete('/found-items/:id', authenticate, foundItemsController.deleteFoundItem);
router.get('/found-items/:id/matches', authenticate, foundItemsController.getFoundItemMatches);
router.get('/users/me/found-items', authenticate, foundItemsController.getMyFoundItems);

// ─────────────────────────────────────────────────────────────────────────────
// FIX: GET /found-items/:foundItemId/claims
// Returns claims on a found item to the finder.
// Powers the "pending claim alert" on FoundItemDetailPage and Dashboard.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/found-items/:foundItemId/claims',
  authenticate,
  claimsController.getFinderClaims
);

// ============================================
// CLAIMS ROUTES
// ============================================

router.post('/claims',
  authenticate,
  claimLimiter,
  fraudCheck('CLAIM_CREATE'),
  validate(createClaimSchema),
  claimsController.createClaim
);

router.get('/users/me/claims', authenticate, claimsController.getMyClaims);
router.get('/claims/:claimId', authenticate, claimsController.getClaim);

// Finder sets verification questions (claim status = PENDING_QUESTIONS)
router.post('/claims/:claimId/questions',
  authenticate,
  validate(setVerificationQuestionsSchema),
  claimsController.setVerificationQuestions
);

// Owner retrieves questions to answer (claim status = PENDING)
router.get('/claims/:claimId/questions',
  authenticate,
  verificationLimiter,
  claimsController.getVerificationQuestions
);

// Owner submits answers
router.post('/claims/:claimId/verify',
  authenticate,
  verificationLimiter,
  fraudCheck('CLAIM_VERIFY'),
  validate(verifyClaimSchema),
  claimsController.verifyClaim
);

router.post('/claims/:claimId/cancel', authenticate, claimsController.cancelClaim);

// Handover OTP
router.post('/claims/:claimId/handover/otp', authenticate, otpLimiter, claimsController.generateHandoverOTP);
router.post('/claims/:claimId/handover/verify', authenticate, otpLimiter, validate(verifyOtpSchema), claimsController.verifyHandoverOTP);
router.get('/claims/:claimId/handover', authenticate, claimsController.getHandoverStatus);

// Disputes
router.post('/claims/:claimId/dispute', authenticate, claimsController.openDispute);
router.get('/claims/:claimId/dispute', authenticate, claimsController.getDispute);

// ============================================
// MESSAGES ROUTES
// ============================================

router.get('/messages/threads', authenticate, messagesController.getMessageThreads);
router.get('/messages/unread-count', authenticate, messagesController.getUnreadCount);
router.get('/messages/threads/:claimId', authenticate, messagesController.getClaimMessages);
router.post('/messages/threads/:claimId',
  authenticate,
  messageLimiter,
  validate(sendMessageSchema),
  messagesController.sendMessage
);
router.post('/messages/:messageId/report', authenticate, messagesController.reportScam);

// ============================================
// COOPERATIVE ROUTES
// ============================================

router.get('/cooperatives', optionalAuth, cooperativesController.getCooperatives);

// NOTE: cooperativesController does NOT export `getLeaderboard`.
// The leaderboard is computed inline here or in a separate service.
router.get('/cooperatives/leaderboard', async (req, res) => {
  try {
    const result = await dbQuery(`
      SELECT
        c.id,
        c.name,
        c.status,
        COUNT(fi.id)                                              AS total_items,
        COUNT(CASE WHEN fi.status = 'RETURNED' THEN 1 END)       AS returned_items,
        ROUND(
          COUNT(CASE WHEN fi.status = 'RETURNED' THEN 1 END)::numeric /
          NULLIF(COUNT(fi.id), 0) * 100,
          1
        )                                                         AS return_rate,
        (SELECT COUNT(*) FROM users WHERE cooperative_id = c.id)  AS staff_count
      FROM cooperatives c
      LEFT JOIN found_items fi ON fi.cooperative_id = c.id
      WHERE c.status = 'VERIFIED'
      GROUP BY c.id, c.name, c.status
      ORDER BY returned_items DESC, total_items DESC
      LIMIT 20
    `);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Leaderboard error:', error);
    res.status(500).json({ success: false, message: 'Failed to get leaderboard' });
  }
});

router.get('/cooperatives/:id', optionalAuth, cooperativesController.getCooperative);
router.post('/cooperatives', authenticate, adminOnly, cooperativesController.createCooperative);
router.patch('/cooperatives/:id/status', authenticate, adminOnly, cooperativesController.updateCooperativeStatus);
router.post('/cooperatives/:id/staff', authenticate, adminOnly, cooperativesController.addCooperativeStaff);
router.get('/cooperatives/:id/staff', authenticate, adminOrCoopStaff, cooperativesController.getCooperativeStaff);
router.get('/cooperatives/:id/items', authenticate, adminOrCoopStaff, cooperativesController.getCooperativeItems);

router.get('/cooperatives/:id/accountability', async (req, res) => {
  try {
    const cooperativeId = parseInt(req.params.id);
    const report = await getCooperativeAccountability(cooperativeId);
    if (!report) {
      res.status(404).json({ success: false, message: 'Cooperative not found' });
      return;
    }
    res.json({ success: true, data: report });
  } catch (error) {
    console.error('Accountability report error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate report' });
  }
});

router.get('/cooperative/dashboard',
  authenticate,
  authorize(UserRole.COOP_STAFF),
  cooperativesController.getCooperativeDashboard
);

// ============================================
// ADMIN ROUTES
// ============================================

router.get('/admin/stats', authenticate, adminOnly, adminController.getDashboardStats);
router.get('/admin/users', authenticate, adminOnly, adminController.getUsers);
router.post('/admin/users/:userId/ban', authenticate, adminOnly, adminController.banUser);
router.post('/admin/users/:userId/unban', authenticate, adminOnly, adminController.unbanUser);
router.get('/admin/scam-reports', authenticate, adminOnly, adminController.getScamReports);
router.post('/admin/scam-reports/:reportId/resolve', authenticate, adminOnly, adminController.resolveScamReport);
router.get('/admin/audit-logs', authenticate, adminOnly, adminController.getAuditLogsHandler);
router.post('/admin/users/:userId/recalculate-trust', authenticate, adminOnly, adminController.recalculateUserTrust);
router.post('/admin/cleanup', authenticate, adminOnly, adminController.triggerCleanup);

router.get('/admin/contact-messages', authenticate, adminOnly, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const offset = (page - 1) * limit;

    const countResult = await dbQuery('SELECT COUNT(*) FROM contact_messages');
    const total = parseInt(countResult.rows[0].count);

    const result = await dbQuery(
      `SELECT * FROM contact_messages ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    if (result.rows.length > 0) {
      const ids = result.rows.map((r: any) => r.id);
      await dbQuery(`UPDATE contact_messages SET read = true WHERE id = ANY($1)`, [ids]);
    }

    res.json({
      success: true,
      data: result.rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Get contact messages error:', error);
    res.status(500).json({ success: false, message: 'Failed to get contact messages' });
  }
});

// ============================================
// CONTACT FORM
// ============================================

router.post('/contact', authLimiter, requireRecaptcha('contact'), async (req, res) => {
  try {
    const { name, email, message } = req.body;

    if (!name || !email || !message) {
      res.status(400).json({ success: false, message: 'Name, email, and message are required' });
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ success: false, message: 'Invalid email address' });
      return;
    }

    if (message.length > 5000) {
      res.status(400).json({ success: false, message: 'Message too long (max 5000 characters)' });
      return;
    }

    try {
      await dbQuery(
        `INSERT INTO contact_messages (name, email, message, ip_address) VALUES ($1, $2, $3, $4)`,
        [name.trim(), email.trim(), message.trim(), req.ip || 'unknown']
      );
    } catch (dbErr) {
      console.error('Failed to store contact message:', dbErr);
    }

    const sent = await sendContactFormEmail(name.trim(), email.trim(), message.trim());

    if (sent) {
      res.json({ success: true, message: "Message sent successfully. We'll get back to you soon!" });
    } else {
      console.log(`[CONTACT FORM] From: ${name} <${email}> | ${message}`);
      res.json({ success: true, message: "Message received. We'll get back to you soon!" });
    }
  } catch (error) {
    console.error('Contact form error:', error);
    res.status(500).json({ success: false, message: 'Failed to send message. Please try again.' });
  }
});

// ============================================
// ROOT & HEALTH
// ============================================

router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Byaboneka+ API v1',
    version: '1.0.0',
    docs: '/api-docs',
    health: '/api/v1/health',
  });
});

router.get('/health', async (req, res) => {
  const dbOk = await checkConnection();
  const emailHealth = await checkEmailHealth();
  const status = dbOk ? 'ok' : 'degraded';

  res.status(dbOk ? 200 : 503).json({
    status,
    timestamp: new Date().toISOString(),
    database: dbOk ? 'connected' : 'unreachable',
    email: {
      configured: emailHealth.configured,
      connected: emailHealth.connected,
      provider: emailHealth.configured ? 'brevo' : 'none',
    },
  });
});

export default router;