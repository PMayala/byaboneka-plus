import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { TokenPayload, UserRole, TrustLevel } from '../types';

// ============================================
// PASSWORD & HASHING UTILITIES
// ============================================

const BCRYPT_COST = 10;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// For secret answers - normalize and hash with salt
export async function hashSecretAnswer(answer: string): Promise<{ hash: string; salt: string }> {
  const salt = crypto.randomBytes(16).toString('hex');
  const normalized = normalizeAnswer(answer);
  const hash = await bcrypt.hash(normalized + salt, BCRYPT_COST);
  return { hash, salt };
}

export async function verifySecretAnswer(
  submittedAnswer: string,
  storedHash: string,
  salt: string
): Promise<boolean> {
  const normalized = normalizeAnswer(submittedAnswer);
  return bcrypt.compare(normalized + salt, storedHash);
}

function normalizeAnswer(answer: string): string {
  return answer
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ');   // Collapse whitespace
}

// ============================================
// JWT UTILITIES
// ============================================

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error('FATAL: JWT_SECRET environment variable must be set in production');
  }
  return secret || 'dev_jwt_secret_change_in_production_min_32_chars';
}

function getJwtRefreshSecret(): string {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error('FATAL: JWT_REFRESH_SECRET environment variable must be set in production');
  }
  return secret || 'dev_refresh_secret_change_in_production_min_32';
}

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

export function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: ACCESS_TOKEN_EXPIRY } as jwt.SignOptions);
}

export function generateRefreshToken(payload: TokenPayload): string {
  return jwt.sign(payload, getJwtRefreshSecret(), { expiresIn: REFRESH_TOKEN_EXPIRY } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, getJwtSecret()) as TokenPayload;
}

export function verifyRefreshToken(token: string): TokenPayload {
  return jwt.verify(token, getJwtRefreshSecret()) as TokenPayload;
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// ============================================
// OTP UTILITIES (unified — uses bcryptjs)
// ============================================

export function generateOTP(): string {
  // Generate 6-digit OTP using crypto for security
  const bytes = crypto.randomBytes(4);
  const num = bytes.readUInt32BE(0) % 1000000;
  return num.toString().padStart(6, '0');
}

export async function hashOTP(otp: string): Promise<string> {
  return bcrypt.hash(otp, BCRYPT_COST);
}

export async function verifyOTP(otp: string, hash: string): Promise<boolean> {
  return bcrypt.compare(otp, hash);
}

// ============================================
// KEYWORD EXTRACTION
// ============================================

// Common stopwords to filter out (English + Kinyarwanda)
const STOPWORDS = new Set([
  // English
  'the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'and', 'or', 'is', 'it',
  'was', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
  'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare',
  'ought', 'used', 'my', 'your', 'his', 'her', 'its', 'our', 'their', 'this', 'that',
  'these', 'those', 'i', 'you', 'he', 'she', 'we', 'they', 'what', 'which', 'who',
  'whom', 'whose', 'where', 'when', 'why', 'how', 'all', 'each', 'every', 'both',
  'few', 'more', 'most', 'other', 'some', 'such', 'no', 'not', 'only', 'same', 'so',
  'than', 'too', 'very', 'just', 'also', 'now', 'here', 'there', 'then', 'once',
  'with', 'about', 'after', 'before', 'above', 'below', 'between', 'into', 'through',
  'during', 'under', 'again', 'further', 'while', 'lost', 'found', 'item',
  // Kinyarwanda common
  'mu', 'ku', 'ni', 'na', 'ndi', 'uri', 'ari', 'dufite', 'nta', 'hari', 'ya', 'yo',
  'by', 'bya', 'cy', 'cya', 'ry', 'rya', 'wa', 'wo', 'ba', 'bo', 'ka', 'ko', 'ha',
]);

// High-value keywords to always include if found
const COLOR_PATTERNS = [
  'black', 'white', 'red', 'blue', 'green', 'yellow', 'orange', 'pink', 'purple',
  'brown', 'grey', 'gray', 'silver', 'gold', 'dark', 'light',
  'umukara', 'umweru', 'umutuku', 'ubururu'
];

const BRAND_PATTERNS = [
  'iphone', 'samsung', 'galaxy', 'tecno', 'infinix', 'itel', 'huawei', 'xiaomi',
  'redmi', 'oppo', 'vivo', 'nokia', 'motorola', 'pixel', 'oneplus', 'realme',
  'nike', 'adidas', 'samsonite', 'puma', 'gucci', 'louis', 'vuitton', 'zara',
  'bk', 'equity', 'kcb', 'cogebanque', 'bpr', 'i&m', 'access',
  'toyota', 'honda', 'hp', 'dell', 'lenovo', 'asus', 'acer', 'macbook'
];

export function extractKeywords(text: string): string[] {
  if (!text) return [];

  const normalized = text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const words = normalized.split(' ');
  const keywords: Set<string> = new Set();

  for (const word of words) {
    if (word.length < 3 || STOPWORDS.has(word)) {
      continue;
    }

    if (COLOR_PATTERNS.includes(word) || BRAND_PATTERNS.includes(word)) {
      keywords.add(word);
      continue;
    }

    if (word.length >= 3) {
      keywords.add(word);
    }
  }

  return Array.from(keywords);
}

// ============================================
// TRUST SCORE UTILITIES
// ============================================

export function getTrustLevel(trustScore: number): TrustLevel {
  if (trustScore < -10) return TrustLevel.SUSPENDED;
  if (trustScore < 0) return TrustLevel.RESTRICTED;
  if (trustScore < 5) return TrustLevel.NEW;
  if (trustScore < 15) return TrustLevel.ESTABLISHED;
  return TrustLevel.TRUSTED;
}

export function getClaimAttemptLimit(trustLevel: TrustLevel): number {
  switch (trustLevel) {
    case TrustLevel.SUSPENDED: return 0;
    case TrustLevel.RESTRICTED: return 1;
    case TrustLevel.NEW: return 3;
    case TrustLevel.ESTABLISHED: return 5;
    case TrustLevel.TRUSTED: return 7;
    default: return 3;
  }
}

export function getReportDailyLimit(trustLevel: TrustLevel): number {
  switch (trustLevel) {
    case TrustLevel.SUSPENDED: return 0;
    case TrustLevel.RESTRICTED: return 1;
    case TrustLevel.NEW: return 3;
    case TrustLevel.ESTABLISHED: return 5;
    case TrustLevel.TRUSTED: return 10;
    default: return 3;
  }
}

// Trust score changes
export const TRUST_CHANGES = {
  SUCCESSFUL_RETURN_FINDER: 3,
  SUCCESSFUL_RECOVERY_OWNER: 2,
  EMAIL_VERIFIED: 1,
  PHONE_VERIFIED: 2,
  FAILED_VERIFICATION: -2,
  MULTIPLE_FAILED_CLAIMS: -5,
  SCAM_REPORTED: -5,
  SCAM_CONFIRMED: -20,
  FALSE_SCAM_REPORT: -3,
  ACCURATE_REPORT_CONFIRMED: 1,
};

// ============================================
// LOCATION UTILITIES
// ============================================

const KIGALI_AREAS: { [key: string]: string[] } = {
  'Nyarugenge': ['Gitega', 'Nyarugenge', 'Nyamirambo', 'Muhima', 'Rwezamenyo', 'Kimisagara'],
  'Gasabo': ['Kimironko', 'Remera', 'Kacyiru', 'Gisozi', 'Kimihurura', 'Nyarutarama', 'Kibagabaga', 'Kinyinya'],
  'Kicukiro': ['Gikondo', 'Kagarama', 'Kicukiro', 'Kanombe', 'Niboye', 'Masaka', 'Nyarugunga'],
};

const ADJACENT_AREAS: { [key: string]: string[] } = {
  'kimironko': ['remera', 'kibagabaga', 'kinyinya'],
  'remera': ['kimironko', 'kicukiro', 'kibagabaga', 'nyarugunga'],
  'kacyiru': ['kimihurura', 'gisozi', 'nyarutarama'],
  'nyabugogo': ['muhima', 'gitega', 'nyamirambo'],
  'gisozi': ['kacyiru', 'kinyinya', 'jabana'],
  'nyamirambo': ['muhima', 'nyabugogo', 'rwezamenyo'],
  'kibagabaga': ['kimironko', 'remera', 'kinyinya'],
  'kinyinya': ['kimironko', 'kibagabaga', 'gisozi'],
  'kicukiro': ['remera', 'gikondo', 'nyarugunga'],
  'muhima': ['nyabugogo', 'nyamirambo', 'gitega'],
  'kimihurura': ['kacyiru', 'nyarutarama'],
  'nyarutarama': ['kacyiru', 'kimihurura'],
  'gikondo': ['kicukiro', 'kagarama'],
  'kagarama': ['gikondo', 'kicukiro'],
};

export function computeLocationDistance(area1: string, area2: string): number {
  const a1 = area1.toLowerCase().trim();
  const a2 = area2.toLowerCase().trim();

  if (a1 === a2) return 0;

  const adjacentToA1 = ADJACENT_AREAS[a1] || [];
  if (adjacentToA1.includes(a2)) return 1;

  const adjacentToA2 = ADJACENT_AREAS[a2] || [];
  if (adjacentToA2.includes(a1)) return 1;

  for (const district of Object.values(KIGALI_AREAS)) {
    const lowerDistrict = district.map(a => a.toLowerCase());
    if (lowerDistrict.includes(a1) && lowerDistrict.includes(a2)) {
      return 2;
    }
  }

  return 3;
}

// ============================================
// FRAUD DETECTION UTILITIES
// ============================================

const PAYMENT_KEYWORDS = [
  'pay', 'money', 'cash', 'mtn', 'momo', 'airtel', 'transfer', 'send',
  'price', 'reward', 'fee', 'cost', 'charge',
  'amafaranga', 'hishyura', 'ohereze'
];

const CONDITIONAL_KEYWORDS = ['first', 'before'];

export function detectExtortionKeywords(message: string): string[] {
  const lower = message.toLowerCase();

  const hasPayment = PAYMENT_KEYWORDS.some(k => lower.includes(k));
  const hasCondition = CONDITIONAL_KEYWORDS.some(k => lower.includes(k));

  // Only flag when it sounds like “pay first / pay before…”
  if (hasPayment && hasCondition) return ['payment_before_return'];

  return [];
}

export function isMessageFlaggable(message: string): { flagged: boolean; reason?: string } {
  const suspicious = detectExtortionKeywords(message);

  if (suspicious.length >= 1) {
    return {
      flagged: true,
      reason: `Message suggests payment before return (${suspicious.join(', ')})`
    };
  }

  return { flagged: false };
}


// ============================================
// DATE UTILITIES
// ============================================

export function getHoursDifference(date1: Date, date2: Date): number {
  const diff = Math.abs(date1.getTime() - date2.getTime());
  return diff / (1000 * 60 * 60);
}

export function getDaysDifference(date1: Date, date2: Date): number {
  return getHoursDifference(date1, date2) / 24;
}

export function isWithinHours(date1: Date, date2: Date, hours: number): boolean {
  return getHoursDifference(date1, date2) <= hours;
}

// ============================================
// VALIDATION UTILITIES
// ============================================

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function isValidPhone(phone: string): boolean {
  const phoneRegex = /^\+?250\d{9}$/;
  return phoneRegex.test(phone.replace(/\s/g, ''));
}

export function sanitizeInput(input: string): string {
  return input
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .trim();
}

/**
 * Escape special LIKE pattern characters to prevent pattern injection.
 * Use with parameterized queries: WHERE col LIKE $1
 */
export function escapeLikePattern(input: string): string {
  return input
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_');
}

// ============================================
// ID/PAGINATION UTILITIES
// ============================================

export function generateUUID(): string {
  return crypto.randomUUID();
}

export function parsePaginationParams(
  page?: string | number,
  limit?: string | number
): { page: number; limit: number; offset: number } {
  const parsedPage = Math.max(1, parseInt(String(page)) || 1);
  const parsedLimit = Math.min(100, Math.max(1, parseInt(String(limit)) || 20));
  const offset = (parsedPage - 1) * parsedLimit;

  return { page: parsedPage, limit: parsedLimit, offset };
}