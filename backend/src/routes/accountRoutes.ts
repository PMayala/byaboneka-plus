// ============================================
// ACCOUNT ROUTES PATCH
// File: src/routes/accountRoutes.ts
// Add these routes to your main router in src/routes/index.ts
// ============================================

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


// ============================================
// HOW TO INTEGRATE:
// ============================================
// In src/routes/index.ts, add these lines:
//
// 1. Import at the top:
//    import accountRoutes from './accountRoutes';
//    import { deleteAccount, exportUserData } from '../controllers/accountController';
//
// 2. Add routes BEFORE the catch-all or at the end of the auth section:
//    // Account management (Right to Erasure + Portability)
//    router.delete('/users/me', authenticate, deleteAccount);
//    router.get('/users/me/export', authenticate, exportUserData);
//
// OR simply import and use this sub-router:
//    router.use(accountRoutes);
