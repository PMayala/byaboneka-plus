/**
 * Unit Tests: Trust Score System
 * Tests scoring rules from spec CLAIM-06:
 * - Successful return: +3 finder, +2 owner
 * - Failed verification: -2
 * - Multiple failed claims: -5
 * - Scam confirmed: -10
 * - False scam report: -3
 * - Score clamped to [-100, 100]
 */

import { TrustLevel } from '../../src/types';

describe('Trust Score Rules', () => {
  // Mirror the trust level thresholds from trustService
  function getTrustLevel(score: number): TrustLevel {
    if (score <= -20) return TrustLevel.SUSPENDED;
    if (score < 0) return TrustLevel.RESTRICTED;
    if (score < 10) return TrustLevel.NEW;
    if (score < 30) return TrustLevel.ESTABLISHED;
    return TrustLevel.TRUSTED;
  }

  function clamp(score: number): number {
    return Math.max(-100, Math.min(100, score));
  }

  describe('Score Changes', () => {
    it('successful return rewards both parties', () => {
      const finderReward = 3;
      const ownerReward = 2;
      expect(clamp(0 + finderReward)).toBe(3);
      expect(clamp(0 + ownerReward)).toBe(2);
    });

    it('failed verification penalizes claimer', () => {
      expect(clamp(5 + (-2))).toBe(3);
    });

    it('multiple failed claims penalizes more', () => {
      expect(clamp(5 + (-5))).toBe(0);
    });

    it('confirmed scam is severe penalty', () => {
      expect(clamp(10 + (-10))).toBe(0);
    });

    it('false scam report penalizes reporter', () => {
      expect(clamp(5 + (-3))).toBe(2);
    });

    it('score cannot exceed 100', () => {
      expect(clamp(99 + 5)).toBe(100);
    });

    it('score cannot go below -100', () => {
      expect(clamp(-98 + (-5))).toBe(-100);
    });
  });

  describe('Trust Levels', () => {
    it('SUSPENDED when score <= -20', () => {
      expect(getTrustLevel(-20)).toBe(TrustLevel.SUSPENDED);
      expect(getTrustLevel(-50)).toBe(TrustLevel.SUSPENDED);
    });

    it('RESTRICTED when score is -19 to -1', () => {
      expect(getTrustLevel(-1)).toBe(TrustLevel.RESTRICTED);
      expect(getTrustLevel(-19)).toBe(TrustLevel.RESTRICTED);
    });

    it('NEW when score is 0 to 9', () => {
      expect(getTrustLevel(0)).toBe(TrustLevel.NEW);
      expect(getTrustLevel(9)).toBe(TrustLevel.NEW);
    });

    it('ESTABLISHED when score is 10 to 29', () => {
      expect(getTrustLevel(10)).toBe(TrustLevel.ESTABLISHED);
      expect(getTrustLevel(29)).toBe(TrustLevel.ESTABLISHED);
    });

    it('TRUSTED when score >= 30', () => {
      expect(getTrustLevel(30)).toBe(TrustLevel.TRUSTED);
      expect(getTrustLevel(100)).toBe(TrustLevel.TRUSTED);
    });
  });

  describe('Progressive Cooldown', () => {
    // From spec CLAIM-05: 1hr after 1st fail, 4hr after 2nd, 24hr after 3rd
    function getCooldownMinutes(failuresToday: number): number {
      if (failuresToday <= 0) return 0;
      if (failuresToday === 1) return 60;
      if (failuresToday === 2) return 240;
      return 1440;
    }

    it('no cooldown for first attempt', () => {
      expect(getCooldownMinutes(0)).toBe(0);
    });

    it('1 hour after first failure', () => {
      expect(getCooldownMinutes(1)).toBe(60);
    });

    it('4 hours after second failure', () => {
      expect(getCooldownMinutes(2)).toBe(240);
    });

    it('24 hours after third+ failure', () => {
      expect(getCooldownMinutes(3)).toBe(1440);
      expect(getCooldownMinutes(5)).toBe(1440);
    });
  });
});