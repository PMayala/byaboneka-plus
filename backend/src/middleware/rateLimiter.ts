import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { getTrustLevel, getClaimAttemptLimit, getReportDailyLimit } from '../utils';
import { TrustLevel } from '../types';

// ============================================
// RATE LIMITING MIDDLEWARE
// ============================================

// Standard API rate limiter
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: {
    success: false,
    message: 'Too many requests, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict rate limiter for auth endpoints
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per 15 minutes
  message: {
    success: false,
    message: 'Too many login attempts, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful logins
});

// Report creation limiter (trust-based)
export const reportLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: (req: Request): number => {
    if (req.user) {
      const trustLevel = getTrustLevel(req.user.trust_score || 0);
      return getReportDailyLimit(trustLevel);
    }
    return 3; // Default for unauthenticated
  },
  message: {
    success: false,
    message: 'Daily report limit reached. Try again tomorrow.'
  },
  keyGenerator: (req: Request): string => {
    return req.user?.userId?.toString() || req.ip || 'anonymous';
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Claim attempt limiter
export const claimLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: (req: Request): number => {
    if (req.user) {
      const trustLevel = getTrustLevel(req.user.trust_score || 0);
      return getClaimAttemptLimit(trustLevel);
    }
    return 0; // Must be authenticated
  },
  message: {
    success: false,
    message: 'Daily claim limit reached. Try again tomorrow.'
  },
  keyGenerator: (req: Request): string => {
    return req.user?.userId?.toString() || req.ip || 'anonymous';
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Verification attempt limiter (per item)
export const verificationLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 3, // 3 attempts per item per day
  message: {
    success: false,
    message: 'Too many verification attempts for this item. Try again in 24 hours.'
  },
  keyGenerator: (req: Request): string => {
    const userId = req.user?.userId || 'anonymous';
    const claimId = req.params.claimId || 'unknown';
    return `verify:${userId}:${claimId}`;
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// OTP verification limiter
export const otpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 OTP attempts per hour
  message: {
    success: false,
    message: 'Too many OTP attempts. Please wait before trying again.'
  },
  keyGenerator: (req: Request): string => {
    const claimId = req.params.claimId || 'unknown';
    return `otp:${claimId}`;
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Message sending limiter
export const messageLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // 50 messages per hour
  message: {
    success: false,
    message: 'Message rate limit reached. Please wait before sending more messages.'
  },
  keyGenerator: (req: Request): string => {
    return req.user?.userId?.toString() || req.ip || 'anonymous';
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Search limiter (to prevent scraping)
export const searchLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 searches per minute
  message: {
    success: false,
    message: 'Search rate limit reached. Please slow down.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Password reset limiter
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 reset requests per hour
  message: {
    success: false,
    message: 'Too many password reset requests. Please try again later.'
  },
  keyGenerator: (req: Request): string => {
    return req.body.email || req.ip || 'anonymous';
  },
  standardHeaders: true,
  legacyHeaders: false,
});
