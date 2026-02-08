/**
 * Email Verification Middleware for Byaboneka+
 * 
 * Requires verified email for sensitive actions
 */

import { Request, Response, NextFunction } from 'express';
import { query } from '../config/database';

/**
 * Middleware to require email verification for sensitive actions
 * Must be used AFTER authenticate middleware
 */
export async function requireVerifiedEmail(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.user?.userId) {
    res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
    return;
  }
  
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
  
  const result = await query(
    'SELECT email_verified FROM users WHERE id = $1',
    [req.user.userId]
  );
  
  if (result.rows.length > 0 && !result.rows[0].email_verified) {
    // Add warning to response
    res.locals.emailWarning = 'Your email is not verified. Some features may be limited.';
  }
  
  next();
}
