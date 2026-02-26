// ============================================
// CONSENT VALIDATION MIDDLEWARE
// File: src/middleware/consent.ts
// Gap Fix: Registration consent (Research Proposal 3.2.4)
// ============================================

import { Request, Response, NextFunction } from 'express';

/**
 * Middleware that validates the user has accepted Terms of Service 
 * and Privacy Policy before registration.
 * 
 * Expects req.body.acceptedTerms === true
 */
export function requireConsent(req: Request, res: Response, next: NextFunction): void {
  const { acceptedTerms, confirmedAge } = req.body;

  if (acceptedTerms !== true) {
    res.status(400).json({
      success: false,
      message: 'You must accept the Terms of Service and Privacy Policy to create an account',
      errors: [
        {
          field: 'acceptedTerms',
          message: 'Acceptance of Terms of Service and Privacy Policy is required'
        }
      ]
    });
    return;
  }

  if (confirmedAge !== true) {
    res.status(400).json({
      success: false,
      message: 'You must confirm you are 18 years or older to create an account',
      errors: [
        {
          field: 'confirmedAge',
          message: 'Age confirmation is required (must be 18+)'
        }
      ]
    });
    return;
  }

  next();
}


// ============================================
// HOW TO INTEGRATE:
// ============================================
// In src/routes/index.ts, update the register route:
//
// import { requireConsent } from '../middleware/consent';
//
// router.post('/auth/register',
//   authLimiter,
//   requireConsent,              // <-- ADD THIS LINE
//   requireRecaptcha('register'),
//   validate(registerSchema),
//   authController.register
// );
