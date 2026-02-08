import { computeMatchScore } from '../src/services/matchingService';
import { LostItem, FoundItem, ItemCategory, LostItemStatus, FoundItemStatus, ItemSource } from '../src/types';

describe('Matching Engine', () => {
  // Helper to create mock lost item
  const createLostItem = (overrides: Partial<LostItem> = {}): LostItem => ({
    id: 1,
    user_id: 1,
    category: ItemCategory.PHONE,
    title: 'Black iPhone 13',
    description: 'Lost my black iPhone with blue case',
    location_area: 'Kimironko',
    lost_date: new Date('2024-01-15T10:00:00Z'),
    status: LostItemStatus.ACTIVE,
    keywords: ['black', 'iphone', '13', 'blue', 'case'],
    created_at: new Date(),
    updated_at: new Date(),
    expiry_warning_sent: false,
    ...overrides,
  });

  // Helper to create mock found item
  const createFoundItem = (overrides: Partial<FoundItem> = {}): FoundItem => ({
    id: 1,
    finder_id: 2,
    category: ItemCategory.PHONE,
    title: 'iPhone found at market',
    description: 'Found black iPhone with blue case near market',
    location_area: 'Kimironko',
    found_date: new Date('2024-01-15T14:00:00Z'),
    status: FoundItemStatus.UNCLAIMED,
    source: ItemSource.CITIZEN,
    image_urls: [],
    keywords: ['iphone', 'black', 'blue', 'case', 'market'],
    created_at: new Date(),
    updated_at: new Date(),
    expiry_warning_sent: false,
    ...overrides,
  });

  describe('computeMatchScore', () => {
    it('should return 0 for category mismatch', () => {
      const lost = createLostItem({ category: ItemCategory.PHONE });
      const found = createFoundItem({ category: ItemCategory.WALLET });

      const result = computeMatchScore(lost, found);

      expect(result.score).toBe(0);
      expect(result.explanation).toContain('Category mismatch');
    });

    it('should give +5 for category match', () => {
      const lost = createLostItem();
      const found = createFoundItem();

      const result = computeMatchScore(lost, found);

      expect(result.score).toBeGreaterThanOrEqual(5);
      expect(result.explanation.some(e => e.includes('Category match'))).toBe(true);
    });

    it('should give +5 for same location', () => {
      const lost = createLostItem({ location_area: 'Kimironko' });
      const found = createFoundItem({ location_area: 'Kimironko' });

      const result = computeMatchScore(lost, found);

      expect(result.explanation.some(e => e.includes('Same location'))).toBe(true);
    });

    it('should give +3 for within 24 hours', () => {
      const lostDate = new Date('2024-01-15T10:00:00Z');
      const foundDate = new Date('2024-01-15T18:00:00Z'); // 8 hours later

      const lost = createLostItem({ lost_date: lostDate });
      const found = createFoundItem({ found_date: foundDate });

      const result = computeMatchScore(lost, found);

      expect(result.explanation.some(e => e.includes('24 hours'))).toBe(true);
    });

    it('should give +1 for each keyword match', () => {
      const lost = createLostItem({ keywords: ['black', 'iphone', 'blue'] });
      const found = createFoundItem({ keywords: ['black', 'iphone', 'green'] });

      const result = computeMatchScore(lost, found);

      // Should match 'black' and 'iphone'
      const keywordMatches = result.explanation.filter(e => e.includes('Keyword'));
      expect(keywordMatches.length).toBe(2);
    });

    it('should calculate high score for perfect match', () => {
      const lost = createLostItem({
        category: ItemCategory.PHONE,
        location_area: 'Kimironko',
        lost_date: new Date('2024-01-15T10:00:00Z'),
        keywords: ['black', 'iphone', 'blue', 'case']
      });

      const found = createFoundItem({
        category: ItemCategory.PHONE,
        location_area: 'Kimironko',
        found_date: new Date('2024-01-15T14:00:00Z'),
        keywords: ['black', 'iphone', 'blue', 'case']
      });

      const result = computeMatchScore(lost, found);

      // Category (5) + Location (5) + Time (3) + Keywords (4) = 17
      expect(result.score).toBeGreaterThanOrEqual(15);
    });

    it('should handle empty keywords gracefully', () => {
      const lost = createLostItem({ keywords: [] });
      const found = createFoundItem({ keywords: [] });

      const result = computeMatchScore(lost, found);

      // Should still calculate score without keywords
      expect(result.score).toBeGreaterThan(0);
    });
  });
});
