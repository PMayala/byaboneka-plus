import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema, ZodError } from 'zod';
import { ItemCategory, UserRole } from '../types';

// ============================================
// VALIDATION MIDDLEWARE
// ============================================

// Generic validation middleware factory
export function validate(schema: ZodSchema, source: 'body' | 'query' | 'params' = 'body') {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const data = req[source];
      schema.parse(data);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }));

        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors
        });
        return;
      }

      res.status(400).json({
        success: false,
        message: 'Invalid request data'
      });
    }
  };
}

// ============================================
// AUTH SCHEMAS
// ============================================

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  phone: z.string().regex(/^\+?250\d{9}$/, 'Invalid Rwandan phone number').optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

// ============================================
// LOST ITEM SCHEMAS
// ============================================

const verificationQuestionSchema = z.object({
  question: z.string().min(5, 'Question must be at least 5 characters').max(255),
  answer: z.string().min(1, 'Answer is required').max(100),
});

export const createLostItemSchema = z.object({
  category: z.nativeEnum(ItemCategory),
  title: z.string().min(3, 'Title must be at least 3 characters').max(100),
  description: z.string().min(10, 'Description must be at least 10 characters').max(2000),
  location_area: z.string().min(2, 'Location area is required').max(100),
  location_hint: z.string().max(500).optional(),
  lost_date: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  photo_url: z.string().url().optional(),
  verification_questions: z.array(verificationQuestionSchema).length(3, 'Exactly 3 verification questions required'),
});

export const updateLostItemSchema = z.object({
  title: z.string().min(3).max(100).optional(),
  description: z.string().min(10).max(2000).optional(),
  location_area: z.string().min(2).max(100).optional(),
  location_hint: z.string().max(500).optional().nullable(),
  photo_url: z.string().url().optional().nullable(),
});

// ============================================
// FOUND ITEM SCHEMAS
// ============================================

export const createFoundItemSchema = z.object({
  category: z.nativeEnum(ItemCategory),
  title: z.string().min(3, 'Title must be at least 3 characters').max(100),
  description: z.string().min(10, 'Description must be at least 10 characters').max(2000),
  location_area: z.string().min(2, 'Location area is required').max(100),
  location_hint: z.string().max(500).optional(),
  found_date: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  cooperative_id: z.number().int().positive().optional(),
});

export const updateFoundItemSchema = z.object({
  title: z.string().min(3).max(100).optional(),
  description: z.string().min(10).max(2000).optional(),
  location_area: z.string().min(2).max(100).optional(),
  location_hint: z.string().max(500).optional().nullable(),
});

// ============================================
// CLAIM SCHEMAS
// ============================================

export const createClaimSchema = z.object({
  lost_item_id: z.number().int().positive('Lost item ID is required'),
  found_item_id: z.number().int().positive('Found item ID is required'),
});

export const verifyClaimSchema = z.object({
  answers: z.array(z.string().min(1, 'Answer is required')).length(3, 'All 3 answers are required'),
});

export const disputeClaimSchema = z.object({
  reason: z.string().min(10, 'Dispute reason must be at least 10 characters').max(1000),
});

// ============================================
// HANDOVER SCHEMAS
// ============================================

export const verifyOtpSchema = z.object({
  otp: z.string().length(6, 'OTP must be 6 digits').regex(/^\d{6}$/, 'OTP must be 6 digits'),
});

// ============================================
// MESSAGE SCHEMAS
// ============================================

export const sendMessageSchema = z.object({
  content: z.string().min(1, 'Message cannot be empty').max(1000, 'Message too long'),
});

// ============================================
// SCAM REPORT SCHEMAS
// ============================================

export const scamReportSchema = z.object({
  reported_user_id: z.number().int().positive('Reported user ID is required'),
  message_id: z.number().int().positive().optional(),
  claim_id: z.number().int().positive().optional(),
  reason: z.string().min(10, 'Please provide a detailed reason').max(1000),
});

export const resolveScamReportSchema = z.object({
  resolution_notes: z.string().min(5, 'Resolution notes are required').max(1000),
  action: z.enum(['dismiss', 'warn', 'suspend', 'ban']),
});

// ============================================
// COOPERATIVE SCHEMAS
// ============================================

export const createCooperativeSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters').max(255),
  registration_number: z.string().min(5, 'Registration number is required').max(100),
  contact_info: z.string().min(5, 'Contact information is required'),
  address: z.string().max(500).optional(),
});

export const approveCooperativeSchema = z.object({
  status: z.enum(['VERIFIED', 'SUSPENDED']),
});

// ============================================
// ADMIN SCHEMAS
// ============================================

export const banUserSchema = z.object({
  reason: z.string().min(5, 'Ban reason is required').max(500),
});

export const createCoopStaffSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  phone: z.string().regex(/^\+?250\d{9}$/, 'Invalid Rwandan phone number').optional(),
  cooperative_id: z.number().int().positive('Cooperative ID is required'),
});

// ============================================
// SEARCH/FILTER SCHEMAS
// ============================================

export const searchParamsSchema = z.object({
  category: z.nativeEnum(ItemCategory).optional(),
  location_area: z.string().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  keyword: z.string().optional(),
  status: z.string().optional(),
  page: z.string().regex(/^\d+$/).transform(Number).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
});

// ============================================
// ID PARAM SCHEMA
// ============================================

export const idParamSchema = z.object({
  id: z.string().regex(/^\d+$/, 'Invalid ID').transform(Number),
});