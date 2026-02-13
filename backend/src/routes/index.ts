import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Controllers
import * as authController from '../controllers/authController';
import * as lostItemsController from '../controllers/lostItemsController';
import * as foundItemsController from '../controllers/foundItemsController';
import * as claimsController from '../controllers/claimsController';
import * as messagesController from '../controllers/messagesController';
import * as adminController from '../controllers/adminController';
import * as cooperativesController from '../controllers/cooperativesController';

// Middleware
import { authenticate, optionalAuth, adminOnly, authorize, adminOrCoopStaff } from '../middleware/auth';
import { validate, registerSchema, loginSchema, refreshTokenSchema, forgotPasswordSchema, resetPasswordSchema,
         createLostItemSchema, updateLostItemSchema, createFoundItemSchema, updateFoundItemSchema,
         createClaimSchema, verifyClaimSchema, verifyOtpSchema, sendMessageSchema } from '../middleware/validation';
import { authLimiter, reportLimiter, claimLimiter, verificationLimiter, otpLimiter, messageLimiter, 
         passwordResetLimiter, searchLimiter } from '../middleware/rateLimiter';
import { UserRole } from '../types';
import { checkConnection } from '../config/database';

const router = Router();

// ============================================
// FILE UPLOAD CONFIGURATION
// ============================================

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, process.env.UPLOAD_PATH || './uploads');
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, and WebP are allowed.'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

// ============================================
// AUTH ROUTES
// ============================================

router.post('/auth/register',
  authLimiter,
  validate(registerSchema),
  authController.register
);

router.post('/auth/login',
  authLimiter,
  validate(loginSchema),
  authController.login
);

router.post('/auth/refresh',
  validate(refreshTokenSchema),
  authController.refreshToken
);

router.post('/auth/logout',
  authenticate,
  authController.logout
);

router.post('/auth/forgot-password',
  passwordResetLimiter,
  validate(forgotPasswordSchema),
  authController.forgotPassword
);

router.post('/auth/reset-password',
  validate(resetPasswordSchema),
  authController.resetPassword
);

router.get('/auth/profile',
  authenticate,
  authController.getProfile
);

router.put('/auth/profile',
  authenticate,
  authController.updateProfile
);

router.post('/auth/change-password',
  authenticate,
  authController.changePassword
);

// ============================================
// LOST ITEMS ROUTES
// ============================================

router.post('/lost-items',
  authenticate,
  reportLimiter,
  validate(createLostItemSchema),
  lostItemsController.createLostItem
);

router.get('/lost-items',
  optionalAuth,
  searchLimiter,
  lostItemsController.getLostItems
);

router.get('/lost-items/:id',
  optionalAuth,
  lostItemsController.getLostItem
);

router.put('/lost-items/:id',
  authenticate,
  validate(updateLostItemSchema),
  lostItemsController.updateLostItem
);

router.delete('/lost-items/:id',
  authenticate,
  lostItemsController.deleteLostItem
);

router.get('/lost-items/:id/matches',
  authenticate,
  lostItemsController.getLostItemMatches
);

router.get('/users/me/lost-items',
  authenticate,
  lostItemsController.getMyLostItems
);

// ============================================
// FOUND ITEMS ROUTES
// ============================================

router.post('/found-items',
  authenticate,
  reportLimiter,
  validate(createFoundItemSchema),
  foundItemsController.createFoundItem
);

router.get('/found-items',
  optionalAuth,
  searchLimiter,
  foundItemsController.getFoundItems
);

router.get('/found-items/:id',
  optionalAuth,
  foundItemsController.getFoundItem
);

router.put('/found-items/:id',
  authenticate,
  validate(updateFoundItemSchema),
  foundItemsController.updateFoundItem
);

router.delete('/found-items/:id',
  authenticate,
  foundItemsController.deleteFoundItem
);

router.post('/found-items/:id/images',
  authenticate,
  upload.array('images', 5),
  foundItemsController.uploadFoundItemImages
);

router.get('/found-items/:id/matches',
  authenticate,
  foundItemsController.getFoundItemMatches
);

router.get('/users/me/found-items',
  authenticate,
  foundItemsController.getMyFoundItems
);

// ============================================
// CLAIMS ROUTES
// ============================================

router.post('/claims',
  authenticate,
  claimLimiter,
  validate(createClaimSchema),
  claimsController.createClaim
);

router.get('/claims/:claimId',
  authenticate,
  claimsController.getClaim
);

router.get('/claims/:claimId/questions',
  authenticate,
  verificationLimiter,
  claimsController.getVerificationQuestions
);

router.post('/claims/:claimId/verify',
  authenticate,
  verificationLimiter,
  validate(verifyClaimSchema),
  claimsController.verifyClaim
);

router.post('/claims/:claimId/cancel',
  authenticate,
  claimsController.cancelClaim
);

router.get('/users/me/claims',
  authenticate,
  claimsController.getMyClaims
);

// NOTE: Handover OTP routes are in enhancedRoutes.ts (single implementation)
// POST /claims/:claimId/handover/otp     - Generate OTP
// POST /claims/:claimId/handover/verify  - Verify OTP
// GET  /claims/:claimId/handover         - Get status

// ============================================
// MESSAGES ROUTES
// ============================================

router.get('/messages/threads',
  authenticate,
  messagesController.getMessageThreads
);

router.get('/messages/threads/:claimId',
  authenticate,
  messagesController.getClaimMessages
);

router.post('/messages/threads/:claimId',
  authenticate,
  messageLimiter,
  validate(sendMessageSchema),
  messagesController.sendMessage
);

router.post('/messages/:messageId/report',
  authenticate,
  messagesController.reportScam
);

router.get('/messages/unread-count',
  authenticate,
  messagesController.getUnreadCount
);

// ============================================
// COOPERATIVES ROUTES
// ============================================

router.get('/cooperatives',
  optionalAuth,
  cooperativesController.getCooperatives
);

router.get('/cooperatives/:id',
  optionalAuth,
  cooperativesController.getCooperative
);

router.post('/cooperatives',
  authenticate,
  adminOnly,
  cooperativesController.createCooperative
);

router.patch('/cooperatives/:id/status',
  authenticate,
  adminOnly,
  cooperativesController.updateCooperativeStatus
);

router.post('/cooperatives/:id/staff',
  authenticate,
  adminOnly,
  cooperativesController.addCooperativeStaff
);

router.get('/cooperatives/:id/staff',
  authenticate,
  adminOrCoopStaff,
  cooperativesController.getCooperativeStaff
);

router.get('/cooperatives/:id/items',
  authenticate,
  adminOrCoopStaff,
  cooperativesController.getCooperativeItems
);

router.get('/cooperative/dashboard',
  authenticate,
  authorize(UserRole.COOP_STAFF),
  cooperativesController.getCooperativeDashboard
);

// ============================================
// ADMIN ROUTES
// ============================================

router.get('/admin/stats',
  authenticate,
  adminOnly,
  adminController.getDashboardStats
);

router.get('/admin/users',
  authenticate,
  adminOnly,
  adminController.getUsers
);

router.post('/admin/users/:userId/ban',
  authenticate,
  adminOnly,
  adminController.banUser
);

router.post('/admin/users/:userId/unban',
  authenticate,
  adminOnly,
  adminController.unbanUser
);

router.get('/admin/scam-reports',
  authenticate,
  adminOnly,
  adminController.getScamReports
);

router.post('/admin/scam-reports/:reportId/resolve',
  authenticate,
  adminOnly,
  adminController.resolveScamReport
);

router.get('/admin/audit-logs',
  authenticate,
  adminOnly,
  adminController.getAuditLogsHandler
);

router.post('/admin/users/:userId/recalculate-trust',
  authenticate,
  adminOnly,
  adminController.recalculateUserTrust
);

router.post('/admin/cleanup',
  authenticate,
  adminOnly,
  adminController.triggerCleanup
);

// ============================================
// HEALTH CHECK (with DB connectivity)
// ============================================

router.get('/health', async (req, res) => {
  const dbOk = await checkConnection();
  const status = dbOk ? 'ok' : 'degraded';
  const httpCode = dbOk ? 200 : 503;

  res.status(httpCode).json({
    status,
    timestamp: new Date().toISOString(),
    database: dbOk ? 'connected' : 'unreachable'
  });
});

export default router;