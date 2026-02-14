/**
 * ============================================
 * PRIVACY-PRESERVING SENSITIVE ITEM REDACTION
 * ============================================
 * 
 * NOVEL FEATURE: Intelligent content-level redaction that detects and
 * masks specific sensitive patterns (Rwanda national ID numbers, phone 
 * numbers, IMEI numbers, bank account numbers) in descriptions while 
 * keeping the rest of the content visible.
 * 
 * Unlike crude show/hide toggles, this provides surgical, pattern-aware
 * redaction specific to Rwandan document formats.
 * 
 * Fills spec gap THREAT-7.4 (Privacy leak prevention).
 */

// ============================================
// TYPES
// ============================================

export interface RedactionResult {
  redacted_text: string;
  redactions_applied: RedactionMatch[];
  sensitivity_level: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface RedactionMatch {
  pattern_type: string;
  original_length: number;
  position: number;
  reason: string;
}

// ============================================
// RWANDA-SPECIFIC SENSITIVE PATTERNS
// ============================================

const PATTERNS: Array<{
  name: string;
  regex: RegExp;
  reason: string;
  sensitivity: 'LOW' | 'MEDIUM' | 'HIGH';
  mask: (match: string) => string;
}> = [
  {
    // Rwanda National ID: 16 digits starting with 1
    // Format: 1 YYYY MM DD X XXXXX XX (e.g., 1199880012345678)
    name: 'RWANDA_NATIONAL_ID',
    regex: /\b(1[12]\d{14})\b/g,
    reason: 'Rwanda national ID number detected',
    sensitivity: 'HIGH',
    mask: (m) => m[0] + '*'.repeat(m.length - 2) + m[m.length - 1],
  },
  {
    // Rwanda phone numbers: +250 7XX XXX XXX or 07XX XXX XXX
    name: 'PHONE_NUMBER_RW',
    regex: /(\+?250\s?|0)([7]\d{2}[\s.-]?\d{3}[\s.-]?\d{3})\b/g,
    reason: 'Phone number detected - hidden for privacy',
    sensitivity: 'MEDIUM',
    mask: (m) => {
      const digits = m.replace(/\D/g, '');
      return digits.slice(0, 4) + '***' + digits.slice(-2);
    },
  },
  {
    // IMEI numbers: 15 digits
    name: 'IMEI_NUMBER',
    regex: /(?<!\d)(\d{15})(?!\d)/g,
    reason: 'Possible IMEI number detected',
    sensitivity: 'HIGH',
    mask: (m) => m.slice(0, 4) + '***********',
  },
  {
    // Bank account numbers: 10-16 digit sequences with common prefixes
    name: 'BANK_ACCOUNT',
    regex: /(?<!\d)(\d{10,13})(?!\d)/g,
    reason: 'Possible bank/account number detected',
    sensitivity: 'HIGH',
    mask: (m) => m.slice(0, 2) + '*'.repeat(m.length - 4) + m.slice(-2),
  },
  {
    // Email addresses
    name: 'EMAIL',
    regex: /\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/g,
    reason: 'Email address detected',
    sensitivity: 'MEDIUM',
    mask: (m) => {
      const [local, domain] = m.split('@');
      return local[0] + '***@' + domain;
    },
  },
  {
    // Rwanda driver license pattern
    name: 'DRIVER_LICENSE_RW',
    regex: /\b(DL[-\s]?\d{6,8})\b/gi,
    reason: 'Possible driver license number detected',
    sensitivity: 'HIGH',
    mask: (m) => m.slice(0, 3) + '****',
  },
  {
    // Passport numbers (common format: 2 letters + 7 digits)
    name: 'PASSPORT',
    regex: /\b([A-Z]{2}\d{7})\b/g,
    reason: 'Possible passport number detected',
    sensitivity: 'HIGH',
    mask: (m) => m.slice(0, 2) + '*****' + m.slice(-2),
  },
];

// ============================================
// CORE REDACTION FUNCTION
// ============================================

/**
 * Redact sensitive information from text.
 * 
 * @param text - The text to redact
 * @param category - Item category (ID/WALLET get stricter redaction)
 * @param isOwner - If true, skip redaction (owner can see their own data)
 * @returns RedactionResult with masked text and metadata
 */
export function redactSensitiveContent(
  text: string,
  category?: string,
  isOwner: boolean = false
): RedactionResult {
  // Owner always sees full text
  if (isOwner) {
    return {
      redacted_text: text,
      redactions_applied: [],
      sensitivity_level: 'NONE'
    };
  }

  let redactedText = text;
  const redactions: RedactionMatch[] = [];
  let highestSensitivity: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' = 'NONE';

  // Apply patterns
  for (const pattern of PATTERNS) {
    // For non-ID/WALLET categories, skip bank account pattern (too many false positives)
    if (pattern.name === 'BANK_ACCOUNT' && !['ID', 'WALLET'].includes(category || '')) {
      continue;
    }

    let match;
    const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
    
    while ((match = regex.exec(text)) !== null) {
      const original = match[0];
      const masked = pattern.mask(original);
      
      // Only redact if the mask actually changes something
      if (masked !== original) {
        redactedText = redactedText.replace(original, masked);
        redactions.push({
          pattern_type: pattern.name,
          original_length: original.length,
          position: match.index,
          reason: pattern.reason
        });

        // Track highest sensitivity
        const levels = { NONE: 0, LOW: 1, MEDIUM: 2, HIGH: 3 };
        if (levels[pattern.sensitivity] > levels[highestSensitivity]) {
          highestSensitivity = pattern.sensitivity;
        }
      }
    }
  }

  // For ID/WALLET categories, apply extra strictness
  if (['ID', 'WALLET'].includes(category || '') && highestSensitivity === 'NONE') {
    // Even if no patterns matched, truncate long descriptions for sensitive categories
    if (text.length > 200) {
      redactedText = text.substring(0, 200) + '... [Full details visible after verification]';
      highestSensitivity = 'LOW';
    }
  }

  return {
    redacted_text: redactedText,
    redactions_applied: redactions,
    sensitivity_level: highestSensitivity
  };
}

// ============================================
// EXPRESS MIDDLEWARE
// ============================================

import { Request, Response, NextFunction } from 'express';

/**
 * Middleware that automatically redacts sensitive content in item responses.
 * Attach after the main handler has set res.locals.itemData.
 * 
 * Usage in routes:
 *   router.get('/found-items/:id', getFoundItem, redactItemMiddleware);
 * 
 * Or call directly in controller:
 *   const result = redactSensitiveContent(item.description, item.category, isOwner);
 */
export function redactItemResponse(isOwnerCheck: (req: Request, itemData: any) => boolean) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Hook into res.json to intercept the response
    const originalJson = res.json.bind(res);
    
    res.json = (body: any) => {
      if (body?.success && body?.data) {
        const item = body.data;
        const isOwner = isOwnerCheck(req, item);

        // Redact description
        if (item.description) {
          const descResult = redactSensitiveContent(item.description, item.category, isOwner);
          item.description = descResult.redacted_text;
          if (descResult.redactions_applied.length > 0) {
            item._privacy_notice = 'Some sensitive information has been redacted for privacy protection.';
            item._redaction_count = descResult.redactions_applied.length;
          }
        }

        // Redact title too
        if (item.title) {
          const titleResult = redactSensitiveContent(item.title, item.category, isOwner);
          item.title = titleResult.redacted_text;
        }

        body.data = item;
      }
      return originalJson(body);
    };

    next();
  };
}

// ============================================
// BATCH REDACTION (for list endpoints)
// ============================================

export function redactItemList(
  items: any[],
  userId?: number
): any[] {
  return items.map(item => {
    const isOwner = userId !== undefined && (item.user_id === userId || item.finder_id === userId);
    
    if (item.description) {
      const result = redactSensitiveContent(item.description, item.category, isOwner);
      item.description = result.redacted_text;
    }
    if (item.title) {
      const result = redactSensitiveContent(item.title, item.category, isOwner);
      item.title = result.redacted_text;
    }
    return item;
  });
}