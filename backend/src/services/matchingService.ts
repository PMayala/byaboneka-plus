import { query } from '../config/database';
import {
  LostItem,
  FoundItem,
  MatchResult,
  ItemCategory
} from '../types';
import {
  extractKeywords,
  computeLocationDistance,
  getHoursDifference
} from '../utils';

// ============================================
// MATCHING ENGINE SERVICE
// Deterministic, Explainable Matching Algorithm
// ============================================

// Matching weights
const WEIGHTS = {
  CATEGORY_MATCH: 5,      // Required - must match
  SAME_LOCATION: 5,       // Same sector/area
  ADJACENT_LOCATION: 3,   // Adjacent sector
  NEARBY_LOCATION: 1,     // Same district
  WITHIN_24H: 3,          // Found within 24 hours
  WITHIN_72H: 2,          // Found within 72 hours
  WITHIN_7D: 1,           // Found within 7 days
  KEYWORD_MATCH: 1,       // Per matching keyword
  SUBCATEGORY_MATCH: 2,   // Additional category specificity
};

const MINIMUM_SCORE = 5;  // Minimum score to show as match
const MAX_MATCHES = 5;    // Maximum matches to return

export interface MatchScore {
  score: number;
  explanation: string[];
}

// Compute match score between a lost item and found item
export function computeMatchScore(lost: LostItem, found: FoundItem): MatchScore {
  let score = 0;
  const explanation: string[] = [];

  // GATE 1: Category MUST match (required)
  if (lost.category !== found.category) {
    return { score: 0, explanation: ['Category mismatch'] };
  }
  score += WEIGHTS.CATEGORY_MATCH;
  explanation.push(`Category match: ${lost.category} (+${WEIGHTS.CATEGORY_MATCH})`);

  // GATE 2: Location proximity
  const distance = computeLocationDistance(lost.location_area, found.location_area);
  if (distance === 0) {
    score += WEIGHTS.SAME_LOCATION;
    explanation.push(`Same location: ${lost.location_area} (+${WEIGHTS.SAME_LOCATION})`);
  } else if (distance === 1) {
    score += WEIGHTS.ADJACENT_LOCATION;
    explanation.push(`Adjacent location (+${WEIGHTS.ADJACENT_LOCATION})`);
  } else if (distance <= 2) {
    score += WEIGHTS.NEARBY_LOCATION;
    explanation.push(`Nearby area (+${WEIGHTS.NEARBY_LOCATION})`);
  }

  // GATE 3: Temporal correlation
  const lostDate = new Date(lost.lost_date);
  const foundDate = new Date(found.found_date);
  const hoursDiff = getHoursDifference(lostDate, foundDate);

  // Found item should be after or around the same time as lost
  if (foundDate >= lostDate || hoursDiff <= 24) {
    if (hoursDiff <= 24) {
      score += WEIGHTS.WITHIN_24H;
      explanation.push(`Within 24 hours (+${WEIGHTS.WITHIN_24H})`);
    } else if (hoursDiff <= 72) {
      score += WEIGHTS.WITHIN_72H;
      explanation.push(`Within 72 hours (+${WEIGHTS.WITHIN_72H})`);
    } else if (hoursDiff <= 168) { // 7 days
      score += WEIGHTS.WITHIN_7D;
      explanation.push(`Within 7 days (+${WEIGHTS.WITHIN_7D})`);
    }
  }

  // GATE 4: Keyword overlap
  const lostKeywords = lost.keywords || extractKeywords(lost.title + ' ' + lost.description);
  const foundKeywords = found.keywords || extractKeywords(found.title + ' ' + found.description);

  const overlappingKeywords = lostKeywords.filter(kw => 
    foundKeywords.some(fkw => fkw.toLowerCase() === kw.toLowerCase())
  );

  for (const keyword of overlappingKeywords.slice(0, 5)) { // Cap at 5 keyword bonuses
    score += WEIGHTS.KEYWORD_MATCH;
    explanation.push(`Keyword: "${keyword}" (+${WEIGHTS.KEYWORD_MATCH})`);
  }

  return { score, explanation };
}

// Find matches for a lost item
export async function findMatchesForLostItem(
  lostItemId: number,
  forceRefresh: boolean = false
): Promise<MatchResult[]> {
  // Check cache first (unless force refresh)
  if (!forceRefresh) {
    // FIX BUG-01: Explicitly alias columns to avoid id collision between matches and found_items
    const cachedResult = await query(
      `SELECT m.score, m.explanation,
              f.id, f.finder_id, f.cooperative_id, f.category,
              f.title, f.description, f.location_area, f.location_hint,
              f.found_date, f.status, f.source, f.image_urls, f.keywords,
              f.expiry_warning_sent, f.expired_at, f.created_at, f.updated_at
       FROM matches m
       JOIN found_items f ON m.found_item_id = f.id
       WHERE m.lost_item_id = $1
       AND m.computed_at > NOW() - INTERVAL '1 hour'
       ORDER BY m.score DESC
       LIMIT $2`,
      [lostItemId, MAX_MATCHES]
    );

    if (cachedResult.rows.length > 0) {
      return cachedResult.rows.map(row => ({
        found_item: {
          id: row.id,
          finder_id: row.finder_id,
          cooperative_id: row.cooperative_id,
          category: row.category,
          title: row.title,
          description: row.description,
          location_area: row.location_area,
          location_hint: row.location_hint,
          found_date: row.found_date,
          status: row.status,
          source: row.source,
          image_urls: row.image_urls,
          keywords: row.keywords,
          expiry_warning_sent: row.expiry_warning_sent,
          expired_at: row.expired_at,
          created_at: row.created_at,
          updated_at: row.updated_at
        },
        score: row.score,
        explanation: row.explanation
      }));
    }
  }

  // Get the lost item
  const lostResult = await query(
    'SELECT * FROM lost_items WHERE id = $1',
    [lostItemId]
  );

  if (lostResult.rows.length === 0) {
    throw new Error('Lost item not found');
  }

  const lostItem = lostResult.rows[0] as LostItem;

  // Get potential found items (same category, unclaimed, recent)
  const foundResult = await query(
    `SELECT * FROM found_items
     WHERE category = $1
     AND status = 'UNCLAIMED'
     AND found_date >= ($2::date - INTERVAL '7 days')
     ORDER BY found_date DESC
     LIMIT 100`,
    [lostItem.category, lostItem.lost_date]
  );

  const foundItems = foundResult.rows as FoundItem[];

  // Compute scores
  const scoredMatches: MatchResult[] = [];

  for (const foundItem of foundItems) {
    const { score, explanation } = computeMatchScore(lostItem, foundItem);

    if (score >= MINIMUM_SCORE) {
      scoredMatches.push({
        found_item: foundItem,
        score,
        explanation
      });
    }
  }

  // Sort by score descending and take top N
  scoredMatches.sort((a, b) => b.score - a.score);
  const topMatches = scoredMatches.slice(0, MAX_MATCHES);

  // Cache results
  await cacheMatches(lostItemId, topMatches);

  return topMatches;
}

// Find matches for a found item (reverse lookup)
export async function findMatchesForFoundItem(
  foundItemId: number,
  forceRefresh: boolean = false
): Promise<{ lost_item: LostItem; score: number; explanation: string[] }[]> {
  // Get the found item
  const foundResult = await query(
    'SELECT * FROM found_items WHERE id = $1',
    [foundItemId]
  );

  if (foundResult.rows.length === 0) {
    throw new Error('Found item not found');
  }

  const foundItem = foundResult.rows[0] as FoundItem;

  // Get potential lost items (same category, active, recent)
  const lostResult = await query(
    `SELECT * FROM lost_items
     WHERE category = $1
     AND status = 'ACTIVE'
     AND lost_date <= ($2::date + INTERVAL '7 days')
     ORDER BY lost_date DESC
     LIMIT 100`,
    [foundItem.category, foundItem.found_date]
  );

  const lostItems = lostResult.rows as LostItem[];

  // Compute scores
  const scoredMatches: { lost_item: LostItem; score: number; explanation: string[] }[] = [];

  for (const lostItem of lostItems) {
    const { score, explanation } = computeMatchScore(lostItem, foundItem);

    if (score >= MINIMUM_SCORE) {
      scoredMatches.push({
        lost_item: lostItem,
        score,
        explanation
      });
    }
  }

  // Sort by score descending and take top N
  scoredMatches.sort((a, b) => b.score - a.score);
  return scoredMatches.slice(0, MAX_MATCHES);
}

// Cache match results
async function cacheMatches(lostItemId: number, matches: MatchResult[]): Promise<void> {
  // Clear old cache for this lost item
  await query('DELETE FROM matches WHERE lost_item_id = $1', [lostItemId]);

  // Insert new matches
  for (const match of matches) {
    await query(
      `INSERT INTO matches (lost_item_id, found_item_id, score, explanation, computed_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (lost_item_id, found_item_id) 
       DO UPDATE SET score = $3, explanation = $4, computed_at = NOW()`,
      [lostItemId, match.found_item.id, match.score, match.explanation]
    );
  }
}

// Trigger matching when a new item is created
export async function onItemCreated(
  itemType: 'lost' | 'found',
  itemId: number
): Promise<void> {
  try {
    if (itemType === 'lost') {
      // Find matches for the new lost item
      await findMatchesForLostItem(itemId, true);
    } else {
      // For found items, update matches for all potentially matching lost items
      const foundResult = await query(
        'SELECT category, found_date FROM found_items WHERE id = $1',
        [itemId]
      );

      if (foundResult.rows.length > 0) {
        const { category, found_date } = foundResult.rows[0];

        // Get all active lost items in same category
        const lostItems = await query(
          `SELECT id FROM lost_items
           WHERE category = $1
           AND status = 'ACTIVE'
           AND lost_date <= ($2::date + INTERVAL '7 days')`,
          [category, found_date]
        );

        // Refresh matches for each (limited to avoid overload)
        for (const item of lostItems.rows.slice(0, 20)) {
          await findMatchesForLostItem(item.id, true);
        }
      }
    }
  } catch (error) {
    // Don't let matching errors crash the main flow
    console.error(`Matching error for ${itemType} item ${itemId}:`, error);
  }
}

// Clear stale matches
export async function clearStaleMatches(): Promise<number> {
  const result = await query(
    `DELETE FROM matches
     WHERE computed_at < NOW() - INTERVAL '24 hours'
     RETURNING id`
  );
  return result.rowCount || 0;
}