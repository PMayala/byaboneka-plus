// ============================================
// BYABONEKA+ FRONTEND TYPES
// ============================================

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

// ✅ UPDATED: Claim statuses (includes NEW PENDING_QUESTIONS)
export enum ClaimStatus {
  PENDING_QUESTIONS = 'PENDING_QUESTIONS', // NEW: Waiting for finder to set questions
  PENDING = 'PENDING',                     // Owner needs to answer questions
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
  RETURNED = 'RETURNED',
  DISPUTED = 'DISPUTED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED'
}

// User
export interface User {
  id: number;
  email: string;
  name: string;
  phone?: string;
  role: UserRole;
  trust_score: number;
  cooperative_id?: number;
  cooperative_name?: string;
  email_verified: boolean;
  phone_verified: boolean;
  created_at: string;
}

// Lost Item
export interface LostItem {
  id: number;
  user_id: number;
  category: ItemCategory;
  subcategory?: string;          // Added: migration 004 (ALGO-3.1.2)
  title: string;
  description: string;
  location_area: string;
  location_hint?: string;
  lost_date: string;
  status: LostItemStatus;
  keywords?: string[];
  photo_url?: string;
  image_urls?: string[];         // Added: migration 004
  created_at: string;
  user_name?: string;
  verification_questions?: string[];
  match_count?: number;
  claim_count?: number;
}

// Found Item
export interface FoundItem {
  id: number;
  finder_id: number;
  cooperative_id?: number;
  category: ItemCategory;
  subcategory?: string;          // Added: migration 004 (ALGO-3.1.2)
  title: string;
  description: string;
  location_area: string;
  location_hint?: string;
  found_date: string;
  status: FoundItemStatus;
  source: 'CITIZEN' | 'COOPERATIVE';
  image_urls: string[];
  keywords?: string[];
  created_at: string;
  finder_name?: string;
  cooperative_name?: string;
  claim_count?: number;
}

export interface Claim {
  id: number;
  lost_item_id: number;
  found_item_id: number;
  claimant_id: number;
  finder_id?: number;
  status: ClaimStatus;
  verification_score: number;
  attempts_made: number;
  created_at: string;
  updated_at?: string;
  lost_item_title?: string;
  found_item_title?: string;
  category?: ItemCategory;
  claimant_name?: string;
  otp_expires_at?: string;
  otp_verified?: boolean;
  // Location info (for handover location recommendations)
  lost_item_area?: string;
  found_item_area?: string;
  // Dispute info
  dispute_reason?: string;
}

// Match
export interface Match {
  found_item?: FoundItem;
  lost_item?: LostItem;
  score: number;
  explanation: string[];
}

// Message
export interface Message {
  id: number;
  sender_id: number;
  receiver_id: number;
  claim_id: number;
  content: string;
  is_read: boolean;
  is_flagged: boolean;
  created_at: string;
  sender_name?: string;
  is_mine?: boolean;
  warning?: string;
}

// Message Thread
export interface MessageThread {
  claim_id: number;
  claim_status: ClaimStatus;
  item_title: string;
  category: ItemCategory;
  my_role: 'owner' | 'finder';
  other_party_name: string;
  other_user_id?: number;
  other_user_name?: string;
  last_message?: string;
  last_message_at?: string;
  unread_count: number;
}

// Cooperative — FIX INT-01: Matches backend schema exactly
export interface Cooperative {
  id: number;
  name: string;
  registration_number: string;
  status: 'PENDING' | 'VERIFIED' | 'SUSPENDED';
  contact_info: string;
  address?: string;
  verified_at?: string;
  verified_by?: number;
  created_at: string;
  updated_at?: string;
  // Computed fields from backend queries
  staff_count?: number;
  items_count?: number;
}

// Verification Question
export interface VerificationQuestion {
  question: string;
  answer: string;
}

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: Array<{ field: string; message: string }>;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Auth types
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResponse {
  user: User;
  tokens: AuthTokens;
}

// Form types
export interface CreateLostItemForm {
  category: ItemCategory;
  title: string;
  description: string;
  location_area: string;
  location_hint?: string;
  lost_date: string;
  photo_url?: string;
  verification_questions: VerificationQuestion[];
}

export interface CreateFoundItemForm {
  category: ItemCategory;
  title: string;
  description: string;
  location_area: string;
  location_hint?: string;
  found_date: string;
  cooperative_id?: number;
}

// Search params
export interface ItemSearchParams {
  category?: ItemCategory;
  location_area?: string;
  date_from?: string;
  date_to?: string;
  keyword?: string;
  status?: string;
  page?: number;
  limit?: number;
}

// Category info for UI
export const CATEGORY_INFO: Record<ItemCategory, { label: string; icon: string; color: string }> = {
  [ItemCategory.PHONE]: { label: 'Phone', icon: '📱', color: 'bg-blue-100 text-blue-800' },
  [ItemCategory.ID]: { label: 'ID/Document', icon: '🪪', color: 'bg-purple-100 text-purple-800' },
  [ItemCategory.WALLET]: { label: 'Wallet', icon: '👛', color: 'bg-green-100 text-green-800' },
  [ItemCategory.BAG]: { label: 'Bag', icon: '👜', color: 'bg-orange-100 text-orange-800' },
  [ItemCategory.KEYS]: { label: 'Keys', icon: '🔑', color: 'bg-yellow-100 text-yellow-800' },
  [ItemCategory.OTHER]: { label: 'Other', icon: '📦', color: 'bg-gray-100 text-gray-800' },
};

// ✅ UPDATED: Status info for UI (includes new claim status)
export const STATUS_INFO: Record<string, { label: string; color: string }> = {
  // Items
  ACTIVE: { label: 'Active', color: 'blue' },
  UNCLAIMED: { label: 'Unclaimed', color: 'blue' },
  CLAIMED: { label: 'Claimed', color: 'yellow' },
  MATCHED: { label: 'Matched', color: 'yellow' },

  // Claims
  PENDING_QUESTIONS: { label: 'Awaiting Questions', color: 'blue' },      // NEW
  PENDING: { label: 'Awaiting Verification', color: 'yellow' },           // UPDATED label
  VERIFIED: { label: 'Verified', color: 'green' },
  REJECTED: { label: 'Rejected', color: 'red' },
  RETURNED: { label: 'Returned', color: 'green' },
  DISPUTED: { label: 'Disputed', color: 'red' },
  CANCELLED: { label: 'Cancelled', color: 'gray' },
  EXPIRED: { label: 'Expired', color: 'gray' },
};

// Rwanda locations
export const RWANDA_LOCATIONS = [
  'Kimironko', 'Remera', 'Kacyiru', 'Gisozi', 'Kimihurura', 'Nyarutarama',
  'Kibagabaga', 'Kinyinya', 'Nyabugogo', 'Muhima', 'Gitega', 'Nyamirambo',
  'Rwezamenyo', 'Kimisagara', 'Gikondo', 'Kagarama', 'Kicukiro', 'Kanombe',
  'Niboye', 'Masaka', 'Nyarugunga', 'Gasabo', 'Nyarugenge', 'Huye', 'Musanze',
  'Rubavu', 'Muhanga', 'Rwamagana', 'Kayonza', 'Nyagatare'
];
