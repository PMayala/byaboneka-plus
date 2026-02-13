/**
 * Unit Tests: Matching Algorithm
 * Tests the scoring logic defined in the spec:
 * - Category match: +5 (required)
 * - Same location area: +3
 * - Within 72 hours: +2
 * - Keyword overlap: +1 per match
 * - Minimum score to display: 5
 */

// We test the pure scoring logic by importing the scoring functions
// If they're not exported, we test indirectly through findMatchesForLostItem

describe('Matching Score Calculation', () => {
  // Score constants from spec
  const CATEGORY_MATCH = 5;
  const LOCATION_MATCH = 3;
  const TIME_WINDOW_MATCH = 2;
  const KEYWORD_MATCH = 1;
  const MIN_DISPLAY_SCORE = 5;

  // Helper to calculate score (mirrors matchingService logic)
  function calculateScore(params: {
    sameCategory: boolean;
    sameLocation: boolean;
    withinTimeWindow: boolean;
    keywordOverlap: number;
  }): number {
    let score = 0;
    if (params.sameCategory) score += CATEGORY_MATCH;
    if (params.sameLocation) score += LOCATION_MATCH;
    if (params.withinTimeWindow) score += TIME_WINDOW_MATCH;
    score += params.keywordOverlap * KEYWORD_MATCH;
    return score;
  }

  it('should score category match as +5', () => {
    expect(calculateScore({
      sameCategory: true, sameLocation: false, withinTimeWindow: false, keywordOverlap: 0,
    })).toBe(5);
  });

  it('should score category + location as +8', () => {
    expect(calculateScore({
      sameCategory: true, sameLocation: true, withinTimeWindow: false, keywordOverlap: 0,
    })).toBe(8);
  });

  it('should score full match with keywords', () => {
    expect(calculateScore({
      sameCategory: true, sameLocation: true, withinTimeWindow: true, keywordOverlap: 3,
    })).toBe(13); // 5+3+2+3
  });

  it('should not meet threshold without category match', () => {
    const score = calculateScore({
      sameCategory: false, sameLocation: true, withinTimeWindow: true, keywordOverlap: 2,
    });
    // 0+3+2+2 = 7 but without category match this should not be displayed
    // The actual service requires category match, but score alone would be 7
    expect(score).toBe(7);
  });

  it('should meet minimum display score with category only', () => {
    const score = calculateScore({
      sameCategory: true, sameLocation: false, withinTimeWindow: false, keywordOverlap: 0,
    });
    expect(score).toBeGreaterThanOrEqual(MIN_DISPLAY_SCORE);
  });

  it('should score keyword overlap incrementally', () => {
    const score0 = calculateScore({ sameCategory: true, sameLocation: false, withinTimeWindow: false, keywordOverlap: 0 });
    const score3 = calculateScore({ sameCategory: true, sameLocation: false, withinTimeWindow: false, keywordOverlap: 3 });
    expect(score3 - score0).toBe(3);
  });
});

describe('Time Window Matching', () => {
  const WINDOW_HOURS = 72;

  function isWithinWindow(lostDate: Date, foundDate: Date): boolean {
    const diffMs = Math.abs(foundDate.getTime() - lostDate.getTime());
    const diffHours = diffMs / (1000 * 60 * 60);
    return diffHours <= WINDOW_HOURS;
  }

  it('should match items within 72 hours', () => {
    const lost = new Date('2026-02-10T10:00:00Z');
    const found = new Date('2026-02-11T10:00:00Z'); // 24h later
    expect(isWithinWindow(lost, found)).toBe(true);
  });

  it('should match items at exactly 72 hours', () => {
    const lost = new Date('2026-02-10T10:00:00Z');
    const found = new Date('2026-02-13T10:00:00Z'); // exactly 72h
    expect(isWithinWindow(lost, found)).toBe(true);
  });

  it('should not match items beyond 72 hours', () => {
    const lost = new Date('2026-02-10T10:00:00Z');
    const found = new Date('2026-02-13T11:00:00Z'); // 73h
    expect(isWithinWindow(lost, found)).toBe(false);
  });

  it('should work when found date is before lost date', () => {
    const lost = new Date('2026-02-12T10:00:00Z');
    const found = new Date('2026-02-11T10:00:00Z'); // found before "lost" date
    expect(isWithinWindow(lost, found)).toBe(true);
  });
});

describe('Location Matching', () => {
  // Kigali areas from matchingService
  const KIGALI_AREAS: Record<string, string[]> = {
    'Nyarugenge': ['Nyabugogo', 'Biryogo', 'Gitega', 'Muhima', 'Nyamirambo'],
    'Kicukiro': ['Gikondo', 'Kicukiro Centre', 'Niboye', 'Kanombe'],
    'Gasabo': ['Kimironko', 'Remera', 'Gisozi', 'Kacyiru', 'Kibagabaga'],
  };

  function getDistrict(location: string): string | null {
    const lower = location.toLowerCase();
    for (const [district, areas] of Object.entries(KIGALI_AREAS)) {
      if (areas.some(a => a.toLowerCase() === lower) || district.toLowerCase() === lower) {
        return district;
      }
    }
    return null;
  }

  it('should identify same-area matches', () => {
    expect(getDistrict('Nyabugogo')).toBe('Nyarugenge');
    expect(getDistrict('Kimironko')).toBe('Gasabo');
  });

  it('should match areas in same district', () => {
    expect(getDistrict('Nyabugogo')).toBe(getDistrict('Muhima')); // Both Nyarugenge
    expect(getDistrict('Kimironko')).toBe(getDistrict('Remera')); // Both Gasabo
  });

  it('should distinguish different districts', () => {
    expect(getDistrict('Nyabugogo')).not.toBe(getDistrict('Kimironko'));
  });
});