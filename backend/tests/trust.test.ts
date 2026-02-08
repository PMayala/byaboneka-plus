/**
 * Trust Service Tests
 * Tests for trust score calculations
 */

import { getTrustLevel, getClaimAttemptLimit, getReportDailyLimit, TRUST_CHANGES } from '../src/utils';
import { TrustLevel } from '../src/types';

describe('Trust Score Utilities', () => {
  describe('getTrustLevel', () => {
    it('should return SUSPENDED for very negative scores', () => {
      expect(getTrustLevel(-15)).toBe(TrustLevel.SUSPENDED);
      expect(getTrustLevel(-20)).toBe(TrustLevel.SUSPENDED);
      expect(getTrustLevel(-100)).toBe(TrustLevel.SUSPENDED);
    });

    it('should return RESTRICTED for moderately negative scores', () => {
      expect(getTrustLevel(-5)).toBe(TrustLevel.RESTRICTED);
      expect(getTrustLevel(-1)).toBe(TrustLevel.RESTRICTED);
      expect(getTrustLevel(-9)).toBe(TrustLevel.RESTRICTED);
    });

    it('should return NEW for low positive scores', () => {
      expect(getTrustLevel(0)).toBe(TrustLevel.NEW);
      expect(getTrustLevel(1)).toBe(TrustLevel.NEW);
      expect(getTrustLevel(4)).toBe(TrustLevel.NEW);
    });

    it('should return ESTABLISHED for medium scores', () => {
      expect(getTrustLevel(5)).toBe(TrustLevel.ESTABLISHED);
      expect(getTrustLevel(10)).toBe(TrustLevel.ESTABLISHED);
      expect(getTrustLevel(14)).toBe(TrustLevel.ESTABLISHED);
    });

    it('should return TRUSTED for high scores', () => {
      expect(getTrustLevel(15)).toBe(TrustLevel.TRUSTED);
      expect(getTrustLevel(50)).toBe(TrustLevel.TRUSTED);
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
    it('should return 0 for SUSPENDED', () => {
      expect(getReportDailyLimit(TrustLevel.SUSPENDED)).toBe(0);
    });

    it('should return 1 for RESTRICTED', () => {
      expect(getReportDailyLimit(TrustLevel.RESTRICTED)).toBe(1);
    });

    it('should return 3 for NEW', () => {
      expect(getReportDailyLimit(TrustLevel.NEW)).toBe(3);
    });

    it('should return 5 for ESTABLISHED', () => {
      expect(getReportDailyLimit(TrustLevel.ESTABLISHED)).toBe(5);
    });

    it('should return 10 for TRUSTED', () => {
      expect(getReportDailyLimit(TrustLevel.TRUSTED)).toBe(10);
    });
  });

  describe('TRUST_CHANGES constants', () => {
    it('should have positive values for good actions', () => {
      expect(TRUST_CHANGES.SUCCESSFUL_RETURN_FINDER).toBeGreaterThan(0);
      expect(TRUST_CHANGES.SUCCESSFUL_RECOVERY_OWNER).toBeGreaterThan(0);
      expect(TRUST_CHANGES.EMAIL_VERIFIED).toBeGreaterThan(0);
      expect(TRUST_CHANGES.PHONE_VERIFIED).toBeGreaterThan(0);
    });

    it('should have negative values for bad actions', () => {
      expect(TRUST_CHANGES.FAILED_VERIFICATION).toBeLessThan(0);
      expect(TRUST_CHANGES.MULTIPLE_FAILED_CLAIMS).toBeLessThan(0);
      expect(TRUST_CHANGES.SCAM_REPORTED).toBeLessThan(0);
      expect(TRUST_CHANGES.SCAM_CONFIRMED).toBeLessThan(0);
    });

    it('should have appropriate magnitudes', () => {
      // Successful returns should be worth more than verifications
      expect(TRUST_CHANGES.SUCCESSFUL_RETURN_FINDER).toBeGreaterThanOrEqual(TRUST_CHANGES.EMAIL_VERIFIED);
      // Confirmed scam should be very negative
      expect(TRUST_CHANGES.SCAM_CONFIRMED).toBeLessThan(-10);
    });
  });

  describe('Trust Level Progression', () => {
    it('should progress through levels as score increases', () => {
      const scores = [-20, -5, 0, 7, 20];
      const expectedLevels = [
        TrustLevel.SUSPENDED,
        TrustLevel.RESTRICTED,
        TrustLevel.NEW,
        TrustLevel.ESTABLISHED,
        TrustLevel.TRUSTED
      ];

      scores.forEach((score, index) => {
        expect(getTrustLevel(score)).toBe(expectedLevels[index]);
      });
    });

    it('should have increasing claim limits with trust levels', () => {
      const levels = [
        TrustLevel.SUSPENDED,
        TrustLevel.RESTRICTED,
        TrustLevel.NEW,
        TrustLevel.ESTABLISHED,
        TrustLevel.TRUSTED
      ];

      let previousLimit = -1;
      levels.forEach(level => {
        const limit = getClaimAttemptLimit(level);
        expect(limit).toBeGreaterThanOrEqual(previousLimit);
        previousLimit = limit;
      });
    });
  });
});
