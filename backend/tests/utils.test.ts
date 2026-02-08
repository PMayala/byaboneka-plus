import {
  extractKeywords,
  getTrustLevel,
  computeLocationDistance,
  isMessageFlaggable,
  getHoursDifference,
  getDaysDifference,
  isWithinHours,
  isValidEmail,
  isValidPhone,
  sanitizeInput,
  parsePaginationParams,
  generateOTP,
  hashToken,
  getClaimAttemptLimit,
  getReportDailyLimit,
  TRUST_CHANGES
} from '../src/utils';
import { TrustLevel } from '../src/types';

describe('Utility Functions', () => {
  describe('extractKeywords', () => {
    it('should extract meaningful keywords from text', () => {
      const text = 'Lost my black iPhone 13 Pro with blue silicone case';
      const keywords = extractKeywords(text);

      expect(keywords).toContain('black');
      expect(keywords).toContain('iphone');
      expect(keywords).toContain('blue');
      expect(keywords).toContain('silicone');
    });

    it('should filter out stopwords', () => {
      const text = 'I lost my phone in the market';
      const keywords = extractKeywords(text);

      expect(keywords).not.toContain('the');
      expect(keywords).not.toContain('in');
      expect(keywords).not.toContain('my');
    });

    it('should normalize to lowercase', () => {
      const text = 'BLACK IPHONE Samsung';
      const keywords = extractKeywords(text);

      expect(keywords).toContain('black');
      expect(keywords).toContain('iphone');
      expect(keywords).toContain('samsung');
    });

    it('should handle empty text', () => {
      const keywords = extractKeywords('');
      expect(keywords).toEqual([]);
    });

    it('should identify brand names', () => {
      const text = 'Samsung Galaxy phone with Tecno charger';
      const keywords = extractKeywords(text);

      expect(keywords).toContain('samsung');
      expect(keywords).toContain('galaxy');
      expect(keywords).toContain('tecno');
    });

    it('should identify colors', () => {
      const text = 'A red bag with green stripes and white logo';
      const keywords = extractKeywords(text);

      expect(keywords).toContain('red');
      expect(keywords).toContain('green');
      expect(keywords).toContain('white');
    });

    it('should handle special characters', () => {
      const text = 'iPhone-14 with case @home #lost!';
      const keywords = extractKeywords(text);

      expect(keywords.some(k => k.includes('iphone'))).toBe(true);
    });
  });

  describe('getTrustLevel', () => {
    it('should return SUSPENDED for very low scores', () => {
      expect(getTrustLevel(-15)).toBe(TrustLevel.SUSPENDED);
      expect(getTrustLevel(-100)).toBe(TrustLevel.SUSPENDED);
    });

    it('should return RESTRICTED for negative scores', () => {
      expect(getTrustLevel(-5)).toBe(TrustLevel.RESTRICTED);
      expect(getTrustLevel(-1)).toBe(TrustLevel.RESTRICTED);
    });

    it('should return NEW for low positive scores', () => {
      expect(getTrustLevel(0)).toBe(TrustLevel.NEW);
      expect(getTrustLevel(4)).toBe(TrustLevel.NEW);
    });

    it('should return ESTABLISHED for medium scores', () => {
      expect(getTrustLevel(5)).toBe(TrustLevel.ESTABLISHED);
      expect(getTrustLevel(14)).toBe(TrustLevel.ESTABLISHED);
    });

    it('should return TRUSTED for high scores', () => {
      expect(getTrustLevel(15)).toBe(TrustLevel.TRUSTED);
      expect(getTrustLevel(100)).toBe(TrustLevel.TRUSTED);
    });
  });

  describe('getClaimAttemptLimit', () => {
    it('should return 0 for SUSPENDED', () => {
      expect(getClaimAttemptLimit(TrustLevel.SUSPENDED)).toBe(0);
    });

    it('should return 1 for RESTRICTED', () => {
      expect(getClaimAttemptLimit(TrustLevel.RESTRICTED)).toBe(1);
    });

    it('should return 3 for NEW', () => {
      expect(getClaimAttemptLimit(TrustLevel.NEW)).toBe(3);
    });

    it('should return 5 for ESTABLISHED', () => {
      expect(getClaimAttemptLimit(TrustLevel.ESTABLISHED)).toBe(5);
    });

    it('should return 7 for TRUSTED', () => {
      expect(getClaimAttemptLimit(TrustLevel.TRUSTED)).toBe(7);
    });
  });

  describe('getReportDailyLimit', () => {
    it('should return appropriate limits for each trust level', () => {
      expect(getReportDailyLimit(TrustLevel.SUSPENDED)).toBe(0);
      expect(getReportDailyLimit(TrustLevel.RESTRICTED)).toBe(1);
      expect(getReportDailyLimit(TrustLevel.NEW)).toBe(3);
      expect(getReportDailyLimit(TrustLevel.ESTABLISHED)).toBe(5);
      expect(getReportDailyLimit(TrustLevel.TRUSTED)).toBe(10);
    });
  });

  describe('computeLocationDistance', () => {
    it('should return 0 for same location', () => {
      expect(computeLocationDistance('Kimironko', 'Kimironko')).toBe(0);
      expect(computeLocationDistance('KIMIRONKO', 'kimironko')).toBe(0);
    });

    it('should return 1 for adjacent locations', () => {
      expect(computeLocationDistance('Kimironko', 'Remera')).toBe(1);
      expect(computeLocationDistance('Remera', 'Kimironko')).toBe(1);
      expect(computeLocationDistance('Kacyiru', 'Gisozi')).toBe(1);
    });

    it('should return 2 for same district locations', () => {
      expect(computeLocationDistance('Kimironko', 'Kacyiru')).toBe(2);
      expect(computeLocationDistance('Gikondo', 'Kanombe')).toBe(2);
    });

    it('should return 3 for different district locations', () => {
      expect(computeLocationDistance('Kimironko', 'Nyamirambo')).toBe(3);
      expect(computeLocationDistance('Remera', 'Gitega')).toBe(3);
    });

    it('should handle case insensitivity', () => {
      expect(computeLocationDistance('REMERA', 'kimironko')).toBe(1);
      expect(computeLocationDistance('Remera', 'KIMIRONKO')).toBe(1);
    });

    it('should handle whitespace', () => {
      expect(computeLocationDistance(' Kimironko ', ' Remera ')).toBe(1);
    });
  });

  describe('isMessageFlaggable', () => {
    it('should flag messages with multiple suspicious keywords', () => {
      const result = isMessageFlaggable('Please pay money via MTN before I return');
      expect(result.flagged).toBe(true);
      expect(result.reason).toBeDefined();
    });

    it('should not flag normal messages', () => {
      const result = isMessageFlaggable('Thank you for finding my phone!');
      expect(result.flagged).toBe(false);
    });

    it('should flag extortion attempts', () => {
      const result = isMessageFlaggable('Send me 10000 first then I will give you');
      expect(result.flagged).toBe(true);
    });

    it('should flag payment requests', () => {
      const result = isMessageFlaggable('Transfer money to my account for reward');
      expect(result.flagged).toBe(true);
    });

    it('should flag external meeting requests', () => {
      const result = isMessageFlaggable('Meet me alone at night and pay money first');
      expect(result.flagged).toBe(true);
    });

    it('should not flag single suspicious word', () => {
      const result = isMessageFlaggable('I found your wallet with money inside');
      expect(result.flagged).toBe(false);
    });
  });

  describe('getHoursDifference', () => {
    it('should calculate correct hours difference', () => {
      const date1 = new Date('2024-01-15T10:00:00Z');
      const date2 = new Date('2024-01-15T14:00:00Z');

      expect(getHoursDifference(date1, date2)).toBe(4);
    });

    it('should return absolute difference', () => {
      const date1 = new Date('2024-01-15T14:00:00Z');
      const date2 = new Date('2024-01-15T10:00:00Z');

      expect(getHoursDifference(date1, date2)).toBe(4);
    });

    it('should handle same time', () => {
      const date = new Date('2024-01-15T10:00:00Z');
      expect(getHoursDifference(date, date)).toBe(0);
    });

    it('should handle fractional hours', () => {
      const date1 = new Date('2024-01-15T10:00:00Z');
      const date2 = new Date('2024-01-15T10:30:00Z');
      expect(getHoursDifference(date1, date2)).toBe(0.5);
    });
  });

  describe('getDaysDifference', () => {
    it('should calculate correct days difference', () => {
      const date1 = new Date('2024-01-15T10:00:00Z');
      const date2 = new Date('2024-01-17T10:00:00Z');
      expect(getDaysDifference(date1, date2)).toBe(2);
    });

    it('should handle partial days', () => {
      const date1 = new Date('2024-01-15T00:00:00Z');
      const date2 = new Date('2024-01-15T12:00:00Z');
      expect(getDaysDifference(date1, date2)).toBe(0.5);
    });
  });

  describe('isWithinHours', () => {
    it('should return true for dates within range', () => {
      const date1 = new Date('2024-01-15T10:00:00Z');
      const date2 = new Date('2024-01-15T12:00:00Z');
      expect(isWithinHours(date1, date2, 3)).toBe(true);
    });

    it('should return false for dates outside range', () => {
      const date1 = new Date('2024-01-15T10:00:00Z');
      const date2 = new Date('2024-01-15T20:00:00Z');
      expect(isWithinHours(date1, date2, 5)).toBe(false);
    });

    it('should handle exact boundary', () => {
      const date1 = new Date('2024-01-15T10:00:00Z');
      const date2 = new Date('2024-01-15T15:00:00Z');
      expect(isWithinHours(date1, date2, 5)).toBe(true);
    });
  });

  describe('isValidEmail', () => {
    it('should validate correct emails', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name@domain.co.rw')).toBe(true);
      expect(isValidEmail('user+tag@gmail.com')).toBe(true);
    });

    it('should reject invalid emails', () => {
      expect(isValidEmail('invalid')).toBe(false);
      expect(isValidEmail('test@')).toBe(false);
      expect(isValidEmail('@domain.com')).toBe(false);
      expect(isValidEmail('')).toBe(false);
      expect(isValidEmail('test @example.com')).toBe(false);
    });
  });

  describe('isValidPhone', () => {
    it('should validate Rwandan phone numbers', () => {
      expect(isValidPhone('+250788123456')).toBe(true);
      expect(isValidPhone('250788123456')).toBe(true);
      expect(isValidPhone('+250 788 123 456')).toBe(true);
    });

    it('should reject invalid phone numbers', () => {
      expect(isValidPhone('123456')).toBe(false);
      expect(isValidPhone('+1234567890')).toBe(false);
      expect(isValidPhone('abcdefghijk')).toBe(false);
    });
  });

  describe('sanitizeInput', () => {
    it('should remove HTML tags', () => {
      expect(sanitizeInput('<script>alert("xss")</script>')).toBe('alert("xss")');
      expect(sanitizeInput('<b>bold</b> text')).toBe('bold text');
    });

    it('should trim whitespace', () => {
      expect(sanitizeInput('  hello world  ')).toBe('hello world');
    });

    it('should handle normal text', () => {
      expect(sanitizeInput('Normal text here')).toBe('Normal text here');
    });
  });

  describe('parsePaginationParams', () => {
    it('should parse valid params', () => {
      const result = parsePaginationParams(2, 20);
      expect(result.page).toBe(2);
      expect(result.limit).toBe(20);
      expect(result.offset).toBe(20);
    });

    it('should use defaults for missing params', () => {
      const result = parsePaginationParams(undefined, undefined);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.offset).toBe(0);
    });

    it('should handle string params', () => {
      const result = parsePaginationParams('3', '15');
      expect(result.page).toBe(3);
      expect(result.limit).toBe(15);
    });

    it('should enforce minimum page of 1', () => {
      const result = parsePaginationParams(0, 10);
      expect(result.page).toBe(1);
    });

    it('should enforce maximum limit of 100', () => {
      const result = parsePaginationParams(1, 500);
      expect(result.limit).toBe(100);
    });

    it('should enforce minimum limit of 1', () => {
      const result = parsePaginationParams(1, -5);
      expect(result.limit).toBe(1);
    });
  });

  describe('generateOTP', () => {
    it('should generate 6-digit OTP', () => {
      const otp = generateOTP();
      expect(otp).toMatch(/^\d{6}$/);
    });

    it('should generate different OTPs', () => {
      const otps = new Set([generateOTP(), generateOTP(), generateOTP()]);
      expect(otps.size).toBeGreaterThan(1);
    });
  });

  describe('hashToken', () => {
    it('should hash token consistently', () => {
      const token = 'test-token-123';
      const hash1 = hashToken(token);
      const hash2 = hashToken(token);
      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different tokens', () => {
      const hash1 = hashToken('token1');
      const hash2 = hashToken('token2');
      expect(hash1).not.toBe(hash2);
    });

    it('should produce hex string', () => {
      const hash = hashToken('test');
      expect(hash).toMatch(/^[a-f0-9]+$/);
    });
  });

  describe('TRUST_CHANGES', () => {
    it('should have positive values for good actions', () => {
      expect(TRUST_CHANGES.SUCCESSFUL_RETURN_FINDER).toBeGreaterThan(0);
      expect(TRUST_CHANGES.SUCCESSFUL_RECOVERY_OWNER).toBeGreaterThan(0);
      expect(TRUST_CHANGES.EMAIL_VERIFIED).toBeGreaterThan(0);
    });

    it('should have negative values for bad actions', () => {
      expect(TRUST_CHANGES.FAILED_VERIFICATION).toBeLessThan(0);
      expect(TRUST_CHANGES.SCAM_REPORTED).toBeLessThan(0);
      expect(TRUST_CHANGES.SCAM_CONFIRMED).toBeLessThan(0);
    });
  });
});
