/**
 * Email Verification Middleware for Byaboneka+
 * 
 * Requires verified email for sensitive actions.
 * FIX BUG-02: Bypasses in development/test environments since
 * email sending isn't implemented for MVP.
 */

import { Request, Response, NextFunction } from 'express';
import { query } from '../config/database';

/**
 * Middleware to require email verification for sensitive actions
 * Must be used AFTER authenticate middleware
 * 
 * In development/test: bypasses the check to allow full flow testing
 * In production: enforces email verification
 */
export async function requireVerifiedEmail(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // FIX BUG-02: Skip email verification in non-production environments
  // This allows the full claim → OTP → handover flow to work during development & testing
  if (process.env.NODE_ENV !== 'production') {
    return next();
  }

  if (!req.user?.userId) {
    res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
    return;
  }
  
  try {
    const result = await query(
      'SELECT email_verified FROM users WHERE id = $1',
      [req.user.userId]
    );
    
    if (result.rows.length === 0) {
      res.status(401).json({
        success: false,
        message: 'User not found'
      });
      return;
    }
    
    if (!result.rows[0].email_verified) {
      res.status(403).json({
        success: false,
        message: 'Email verification required for this action. Please verify your email first.',
        requiresEmailVerification: true
      });
      return;
    }
    
    next();
  } catch (error) {
    console.error('Email verification middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check email verification status'
    });
  }
}

/**
 * Optional email verification - warns but doesn't block
 */
export async function warnUnverifiedEmail(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.user?.userId) {
    next();
    return;
  }
  
  try {
    const result = await query(
      'SELECT email_verified FROM users WHERE id = $1',
      [req.user.userId]
    );
    
    if (result.rows.length > 0 && !result.rows[0].email_verified) {
      // Add warning to response locals
      res.locals.emailWarning = 'Your email is not verified. Some features may be limited.';
    }
    
    next();
  } catch (error) {
    // Don't block the request if check fails
    console.error('Email verification warning check failed:', error);
    next();
  }
}