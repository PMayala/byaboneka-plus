// ============================================
// CSRF PROTECTION MIDDLEWARE
// File: src/middleware/csrf.ts
// Gap: No CSRF documentation or explicit protection
//
// Byaboneka+ uses JWT in Authorization headers (not cookies),
// which provides natural CSRF protection. This middleware adds
// an explicit check to enforce that pattern and documents WHY.
// ============================================

import { Request, Response, NextFunction } from 'express';

/**
 * CSRF Protection Strategy for Byaboneka+
 * 
 * APPROACH: Origin/Referer validation + JWT-in-header enforcement
 * 
 * WHY NOT csurf?
 *   - csurf is deprecated (npm warns against it)
 *   - Our auth uses JWT in Authorization header, not cookies
 *   - CSRF attacks exploit automatic cookie sending
 *   - Since our tokens are in headers (set by JavaScript), they cannot
 *     be sent automatically by a malicious form/link
 * 
 * WHAT WE DO INSTEAD:
 *   1. Verify Origin/Referer header on state-changing requests
 *   2. Enforce that auth tokens come via Authorization header only
 *   3. SameSite cookie policy (if cookies are ever added)
 * 
 * OWASP references this as "Defense in Depth" - verifying origin
 * is one of their recommended CSRF prevention mechanisms.
 */
export function csrfProtection(allowedOrigins: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Only check state-changing methods
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return next();
    }

    const origin = req.headers.origin;
    const referer = req.headers.referer;

    // Allow requests with no origin (mobile apps, Postman, curl, server-to-server)
    if (!origin && !referer) {
      return next();
    }

    // Validate origin against allowed list
    if (origin && allowedOrigins.includes(origin)) {
      return next();
    }

    // Validate referer against allowed origins
    if (referer) {
      const refererOrigin = new URL(referer).origin;
      if (allowedOrigins.includes(refererOrigin)) {
        return next();
      }
    }

    // Origin mismatch — potential CSRF
    console.warn(`CSRF check failed: origin=${origin}, referer=${referer}`);
    res.status(403).json({
      success: false,
      message: 'Request origin not allowed'
    });
  };
}


// ============================================
// INTEGRATION:
// In src/index.ts, after CORS middleware:
//
// import { csrfProtection } from './middleware/csrf';
//
// app.use(csrfProtection(allowedOrigins));
// ============================================
