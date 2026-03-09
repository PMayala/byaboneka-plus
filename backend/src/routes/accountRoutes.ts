import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { deleteAccount, exportUserData } from '../controllers/accountController';

const router = Router();

// ============================================
// ACCOUNT MANAGEMENT ROUTES
// ============================================

// DELETE /api/v1/users/me — Delete own account (Right to Erasure)
router.delete('/users/me',
  authenticate,
  deleteAccount
);

// GET /api/v1/users/me/export — Export own data (Right to Portability)
router.get('/users/me/export',
  authenticate,
  exportUserData
);

export default router;