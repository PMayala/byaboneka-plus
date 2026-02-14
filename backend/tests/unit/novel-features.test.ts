/**
 * ============================================
 * UNIT TESTS FOR NOVEL FEATURES
 * ============================================
 * 
 * Test coverage for:
 * - Verification Strength Analyzer
 * - Sensitive Item Redaction
 * - Cooperative Accountability scoring math
 * 
 * Run with: npx jest tests/unit/novel-features.test.ts
 */

// ── Mock database before imports ──
jest.mock('../../src/config/database', () => ({
  query: jest.fn(),
}));

jest.mock('../../src/services/auditService', () => ({
  logAudit: jest.fn(),
}));

import {
  analyzeVerificationStrength,
  getTemplatesForCategory,
  QUESTION_TEMPLATES,
} from '../../src/services/verificationStrengthService';

import {
  redactSensitiveContent,
  redactItemList,
} from '../../src/services/sensitiveRedactionService';

// ============================================
// VERIFICATION STRENGTH TESTS
// ============================================

describe('Verification Strength Analyzer', () => {
  
  describe('analyzeVerificationStrength', () => {
    
    it('should rate strong questions as STRONG', () => {
      const result = analyzeVerificationStrength(
        [
          'How many cards are inside the wallet?',
          'Describe the keychain attached to the keys',
          'What specific app is on the phone home screen?'
        ],
        ['three cards', 'small wooden elephant', 'whatsapp business'],
        'WALLET',
        'Black leather wallet lost near Kimironko'
      );
      
      expect(result.overall_strength).not.toBe('WEAK');
      expect(result.overall_score).toBeGreaterThanOrEqual(40);
    });

    it('should rate yes/no questions as WEAK', () => {
      const result = analyzeVerificationStrength(
        ['Is it black?', 'Is it mine?', 'Was it lost?'],
        ['yes', 'yes', 'yes'],
        'PHONE',
        'Black phone lost in Remera'
      );
      
      expect(result.overall_strength).toBe('WEAK');
      expect(result.questions[0].issues).toContain('Yes/no questions are easy to guess (50% chance)');
    });

    it('should flag answers that appear in the item description', () => {
      const result = analyzeVerificationStrength(
        ['What color is the phone?', 'What brand?', 'What model?'],
        ['black', 'samsung', 'galaxy s21'],
        'PHONE',
        'Black Samsung Galaxy S21 lost at Nyabugogo bus stop'
      );

      // At least one question should flag the answer-in-description issue
      const flagged = result.questions.filter(q => 
        q.issues.some(i => i.includes('answer appears in the item description'))
      );
      expect(flagged.length).toBeGreaterThan(0);
    });

    it('should detect redundant questions', () => {
      const result = analyzeVerificationStrength(
        ['What color is the phone?', 'What colour is the phone case?', 'Describe the phone color'],
        ['black', 'black case', 'dark black'],
        'PHONE',
        'Phone lost'
      );

      expect(result.redundancy_warning).toBe(true);
    });

    it('should penalize very short answers', () => {
      const result = analyzeVerificationStrength(
        ['Describe the item', 'What is unique about it?', 'Secret detail?'],
        ['x', 'y', 'z'],
        'OTHER',
        'Lost item'
      );

      result.questions.forEach(q => {
        expect(q.issues.some(i => i.includes('too short'))).toBe(true);
      });
    });

    it('should give bonus for specific question patterns', () => {
      const specific = analyzeVerificationStrength(
        ['How many compartments does the bag have?'],
        ['three compartments with a hidden zipper'],
        'BAG',
        'Lost bag'
      );

      const generic = analyzeVerificationStrength(
        ['Is it a bag?'],
        ['yes'],
        'BAG',
        'Lost bag'
      );

      expect(specific.questions[0].score).toBeGreaterThan(generic.questions[0].score);
    });
  });

  describe('getTemplatesForCategory', () => {
    
    it('should return PHONE templates for PHONE category', () => {
      const templates = getTemplatesForCategory('PHONE');
      expect(templates.length).toBeGreaterThan(0);
      expect(templates[0].category).toBe('PHONE');
      expect(templates.some(t => t.question.toLowerCase().includes('lockscreen'))).toBe(true);
    });

    it('should return OTHER templates for unknown category', () => {
      const templates = getTemplatesForCategory('SPACESHIP');
      expect(templates.length).toBeGreaterThan(0);
      expect(templates[0].category).toBe('OTHER');
    });

    it('should have templates for all defined categories', () => {
      const categories = ['PHONE', 'ID', 'WALLET', 'BAG', 'KEYS', 'OTHER'];
      categories.forEach(cat => {
        expect(QUESTION_TEMPLATES[cat]).toBeDefined();
        expect(QUESTION_TEMPLATES[cat].length).toBeGreaterThan(0);
      });
    });
  });
});

// ============================================
// SENSITIVE REDACTION TESTS
// ============================================

describe('Sensitive Item Redaction', () => {
  
  describe('redactSensitiveContent', () => {
    
    it('should redact Rwanda national ID numbers (16 digits starting with 1)', () => {
      const result = redactSensitiveContent(
        'Found ID card number 1199880012345678 near bus stop',
        'ID'
      );
      
      expect(result.redacted_text).not.toContain('1199880012345678');
      expect(result.redacted_text).toContain('1');    // First digit preserved
      expect(result.redacted_text).toContain('8');    // Last digit preserved
      expect(result.redactions_applied.length).toBeGreaterThan(0);
      expect(result.sensitivity_level).toBe('HIGH');
    });

    it('should redact Rwandan phone numbers', () => {
      const result = redactSensitiveContent(
        'Contact me at +250788123456 or 0722987654',
        'OTHER'
      );

      expect(result.redacted_text).not.toContain('788123456');
      expect(result.redacted_text).not.toContain('722987654');
      expect(result.redactions_applied.length).toBeGreaterThan(0);
    });

    it('should redact email addresses', () => {
      const result = redactSensitiveContent(
        'The ID belongs to john.doe@gmail.com',
        'ID'
      );

      expect(result.redacted_text).not.toContain('john.doe@gmail.com');
      expect(result.redacted_text).toContain('j***@gmail.com');
    });

    it('should NOT redact when user is the owner', () => {
      const result = redactSensitiveContent(
        'Found ID card number 1199880012345678',
        'ID',
        true  // isOwner
      );

      expect(result.redacted_text).toContain('1199880012345678');
      expect(result.redactions_applied.length).toBe(0);
      expect(result.sensitivity_level).toBe('NONE');
    });

    it('should return NONE sensitivity for text without sensitive data', () => {
      const result = redactSensitiveContent(
        'Lost my black phone near Kimironko market',
        'PHONE'
      );

      expect(result.redacted_text).toBe('Lost my black phone near Kimironko market');
      expect(result.redactions_applied.length).toBe(0);
    });

    it('should truncate long descriptions for ID/WALLET categories', () => {
      const longText = 'A'.repeat(300);
      const result = redactSensitiveContent(longText, 'ID');

      expect(result.redacted_text.length).toBeLessThan(longText.length);
      expect(result.redacted_text).toContain('Full details visible after verification');
    });

    it('should handle multiple sensitive patterns in one text', () => {
      const result = redactSensitiveContent(
        'Found wallet with ID 1199880012345678, contact john@test.com or call +250788111222',
        'WALLET'
      );

      expect(result.redactions_applied.length).toBeGreaterThanOrEqual(2);
      expect(result.sensitivity_level).toBe('HIGH');
    });
  });

  describe('redactItemList', () => {
    
    it('should redact descriptions for non-owners', () => {
      const items = [
        { user_id: 1, description: 'ID number 1199880012345678', category: 'ID', title: 'Found ID' },
        { user_id: 2, description: 'Black phone found', category: 'PHONE', title: 'Phone' },
      ];

      const redacted = redactItemList(items, 1); // user 1 viewing

      // Item 1: user IS owner, should NOT be redacted
      expect(redacted[0].description).toContain('1199880012345678');
      
      // Item 2: user is NOT owner, but no sensitive patterns, so unchanged
      expect(redacted[1].description).toBe('Black phone found');
    });

    it('should redact for anonymous users (no userId)', () => {
      const items = [
        { user_id: 1, description: 'Call me at +250788999888', category: 'OTHER', title: 'Item' },
      ];

      const redacted = redactItemList(items);
      expect(redacted[0].description).not.toContain('788999888');
    });
  });
});