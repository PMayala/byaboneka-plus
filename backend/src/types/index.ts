// ============================================
// BYABONEKA+ TYPE DEFINITIONS
// Trust-Aware Lost & Found Infrastructure
// ============================================

// ==================== ENUMS ====================

export enum UserRole {
  CITIZEN = 'citizen',
  COOP_STAFF = 'coop_staff',
  ADMIN = 'admin'
}

export enum ItemCategory {
  PHONE = 'PHONE',
  ID = 'ID',
  WALLET = 'WALLET',
  BAG = 'BAG',
  KEYS = 'KEYS',
  OTHER = 'OTHER'
}

export enum LostItemStatus {
  ACTIVE = 'ACTIVE',
  CLAIMED = 'CLAIMED',
  RETURNED = 'RETURNED',
  EXPIRED = 'EXPIRED'
}

export enum FoundItemStatus {
  UNCLAIMED = 'UNCLAIMED',
  MATCHED = 'MATCHED',
  RETURNED = 'RETURNED',
  EXPIRED = 'EXPIRED'
}

export enum ItemSource {
  CITIZEN = 'CITIZEN',
  COOPERATIVE = 'COOPERATIVE'
}

export enum ClaimStatus {
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
  RETURNED = 'RETURNED',
  DISPUTED = 'DISPUTED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED'
}

export enum VerificationAttemptStatus {
  PASSED = 'PASSED',
  FAILED = 'FAILED'
}

export enum CooperativeStatus {
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  SUSPENDED = 'SUSPENDED'
}

export enum ScamReportStatus {
  OPEN = 'OPEN',
  INVESTIGATING = 'INVESTIGATING',
  RESOLVED = 'RESOLVED'
}

export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  VERIFY = 'VERIFY',
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  CLAIM_ATTEMPT = 'CLAIM_ATTEMPT',
  CLAIM_VERIFIED = 'CLAIM_VERIFIED',
  CLAIM_REJECTED = 'CLAIM_REJECTED',
  OTP_GENERATED = 'OTP_GENERATED',
  OTP_VERIFIED = 'OTP_VERIFIED',
  OTP_FAILED = 'OTP_FAILED',
  ITEM_RETURNED = 'ITEM_RETURNED',
  SCAM_REPORTED = 'SCAM_REPORTED',
  USER_BANNED = 'USER_BANNED',
  USER_SUSPENDED = 'USER_SUSPENDED',
  COOP_APPROVED = 'COOP_APPROVED',
  COOP_SUSPENDED = 'COOP_SUSPENDED',
  TRUST_SCORE_CHANGED = 'TRUST_SCORE_CHANGED',
  REPORT_EXPIRED = 'REPORT_EXPIRED'
}

export enum TrustLevel {
  SUSPENDED = 'SUSPENDED',
  RESTRICTED = 'RESTRICTED',
  NEW = 'NEW',
  ESTABLISHED = 'ESTABLISHED',
  TRUSTED = 'TRUSTED'
}

// ==================== INTERFACES ====================

// Base entity with timestamps
export interface BaseEntity {
  id: number;
  created_at: Date;
  updated_at: Date;
}

// User
export interface User extends BaseEntity {
  email: string;
  phone?: string;
  password_hash: string;
  name: string;
  role: UserRole;
  trust_score: number;
  cooperative_id?: number;
  email_verified: boolean;
  phone_verified: boolean;
  is_banned: boolean;
  banned_at?: Date;
  ban_reason?: string;
}

export interface UserPublic {
  id: number;
  name: string;
  role: UserRole;
  trust_score: number;
  created_at: Date;
}

// Cooperative
export interface Cooperative extends BaseEntity {
  name: string;
  registration_number: string;
  status: CooperativeStatus;
  contact_info: string;
  address?: string;
  verified_at?: Date;
  verified_by?: number;
}

// Lost Item
export interface LostItem extends BaseEntity {
  user_id: number;
  category: ItemCategory;
  title: string;
  description: string;
  location_area: string;
  location_hint?: string;
  lost_date: Date;
  status: LostItemStatus;
  keywords: string[];
  photo_url?: string;
  expiry_warning_sent: boolean;
  expired_at?: Date;
}

// Found Item
export interface FoundItem extends BaseEntity {
  finder_id: number;
  cooperative_id?: number;
  category: ItemCategory;
  title: string;
  description: string;
  location_area: string;
  location_hint?: string;
  found_date: Date;
  status: FoundItemStatus;
  source: ItemSource;
  image_urls: string[];
  keywords: string[];
  expiry_warning_sent: boolean;
  expired_at?: Date;
}

// Verification Secrets
export interface VerificationSecret extends BaseEntity {
  lost_item_id: number;
  question_1_text: string;
  answer_1_hash: string;
  answer_1_salt: string;
  question_2_text: string;
  answer_2_hash: string;
  answer_2_salt: string;
  question_3_text: string;
  answer_3_hash: string;
  answer_3_salt: string;
}

// Claim
export interface Claim extends BaseEntity {
  lost_item_id: number;
  found_item_id: number;
  claimant_id: number;
  status: ClaimStatus;
  verification_score: number;
  attempts_made: number;
  last_attempt_at?: Date;
  dispute_reason?: string;
}

// Verification Attempt
export interface VerificationAttempt extends BaseEntity {
  claim_id: number;
  correct_answers: number;
  attempt_status: VerificationAttemptStatus;
  attempt_at: Date;
  ip_address?: string;
}

// Handover Confirmation
export interface HandoverConfirmation extends BaseEntity {
  claim_id: number;
  otp_code_hash: string;
  otp_expires_at: Date;
  otp_verified: boolean;
  verification_attempts: number;
  returned_at?: Date;
  return_confirmed_by?: number;
}

// Message
export interface Message extends BaseEntity {
  sender_id: number;
  receiver_id: number;
  claim_id: number;
  content: string;
  is_read: boolean;
  is_flagged: boolean;
  flag_reason?: string;
}

// Scam Report
export interface ScamReport extends BaseEntity {
  reporter_id: number;
  message_id?: number;
  reported_user_id: number;
  claim_id?: number;
  reason: string;
  status: ScamReportStatus;
  resolved_at?: Date;
  resolved_by?: number;
  resolution_notes?: string;
}

// Audit Log
export interface AuditLog {
  id: number;
  actor_id?: number;
  action: AuditAction;
  resource_type: string;
  resource_id?: number;
  changes?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  timestamp: Date;
}

// Match Result
export interface MatchResult {
  found_item: FoundItem;
  score: number;
  explanation: string[];
}

// ==================== DTOs ====================

// Auth DTOs
export interface RegisterDTO {
  email: string;
  password: string;
  name: string;
  phone?: string;
}

export interface LoginDTO {
  email: string;
  password: string;
}

export interface TokenPayload {
  userId: number;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

// Lost Item DTOs
export interface CreateLostItemDTO {
  category: ItemCategory;
  title: string;
  description: string;
  location_area: string;
  location_hint?: string;
  lost_date: string;
  photo_url?: string;
  verification_questions: VerificationQuestionDTO[];
}

export interface VerificationQuestionDTO {
  question: string;
  answer: string;
}

// Found Item DTOs
export interface CreateFoundItemDTO {
  category: ItemCategory;
  title: string;
  description: string;
  location_area: string;
  location_hint?: string;
  found_date: string;
  cooperative_id?: number;
}

// Claim DTOs
export interface CreateClaimDTO {
  lost_item_id: number;
  found_item_id: number;
}

export interface VerifyClaimDTO {
  answers: string[];
}

// Message DTOs
export interface SendMessageDTO {
  content: string;
}

// Pagination
export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// API Response
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: any[];
}

// Search/Filter
export interface ItemSearchParams {
  category?: ItemCategory;
  location_area?: string;
  date_from?: string;
  date_to?: string;
  keyword?: string;
  status?: string;
}

// Trust Score Change
export interface TrustScoreChange {
  user_id: number;
  change: number;
  reason: string;
  new_score: number;
}