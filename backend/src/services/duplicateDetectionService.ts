/**
 * Duplicate Detection Service for Byaboneka+
 * 
 * Implements SYS-05: Duplicate detection for similar reports
 * Uses fuzzy matching to identify potentially duplicate reports
 */

import { query } from '../config/database';
import { ItemCategory } from '../types';

interface DuplicateCandidate {
  id: number;
  type: 'lost' | 'found';
  title: string;
  description: string;
  category: string;
  location_area: string;
  date: Date;
  similarity_score: number;
  similarity_reasons: string[];
}

interface DuplicateCheckResult {
  hasPotentialDuplicates: boolean;
  candidates: DuplicateCandidate[];
  highestScore: number;
}

// Similarity thresholds
const SAME_CATEGORY_SCORE = 5;
const SAME_LOCATION_SCORE = 3;
const SIMILAR_LOCATION_SCORE = 1;
const DATE_WITHIN_3_DAYS = 2;
const DATE_WITHIN_7_DAYS = 1;
const KEYWORD_MATCH_SCORE = 1;
const TITLE_SIMILARITY_THRESHOLD = 0.6;
const DUPLICATE_THRESHOLD = 8; // Minimum score to flag as potential duplicate

/**
 * Calculate Jaccard similarity between two strings (based on words)
 */
function calculateTextSimilarity(text1: string, text2: string): number {
  if (!text1 || !text2) return 0;
  
  const normalize = (s: string) => s.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2);
  
  const words1 = new Set(normalize(text1));
  const words2 = new Set(normalize(text2));
  
  if (words1.size === 0 || words2.size === 0) return 0;
  
  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size;
}

/**
 * Calculate days between two dates
 */
function daysBetween(date1: Date, date2: Date): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Check for duplicate lost items
 */
export async function checkDuplicateLostItems(
  userId: number,
  category: ItemCategory,
  title: string,
  description: string,
  locationArea: string,
  lostDate: Date
): Promise<DuplicateCheckResult> {
  // Get recent active lost items in the same category
  const result = await query(
    `SELECT id, category, title, description, location_area, lost_date, keywords
     FROM lost_items
     WHERE user_id = $1 
     AND category = $2
     AND status = 'ACTIVE'
     AND created_at > NOW() - INTERVAL '30 days'
     ORDER BY created_at DESC
     LIMIT 20`,
    [userId, category]
  );
  
  const candidates: DuplicateCandidate[] = [];
  
  for (const item of result.rows) {
    let score = 0;
    const reasons: string[] = [];
    
    // Category match (already filtered, but include in score)
    score += SAME_CATEGORY_SCORE;
    reasons.push(`Same category: ${category}`);
    
    // Location comparison
    const locationSimilarity = calculateTextSimilarity(locationArea, item.location_area);
    if (locationArea.toLowerCase() === item.location_area.toLowerCase()) {
      score += SAME_LOCATION_SCORE;
      reasons.push(`Same location: ${locationArea}`);
    } else if (locationSimilarity > 0.5) {
      score += SIMILAR_LOCATION_SCORE;
      reasons.push(`Similar location`);
    }
    
    // Date proximity
    const days = daysBetween(lostDate, item.lost_date);
    if (days <= 3) {
      score += DATE_WITHIN_3_DAYS;
      reasons.push(`Lost within 3 days of each other`);
    } else if (days <= 7) {
      score += DATE_WITHIN_7_DAYS;
      reasons.push(`Lost within 7 days of each other`);
    }
    
    // Title similarity
    const titleSimilarity = calculateTextSimilarity(title, item.title);
    if (titleSimilarity > TITLE_SIMILARITY_THRESHOLD) {
      score += Math.round(titleSimilarity * 3);
      reasons.push(`Similar title (${Math.round(titleSimilarity * 100)}% match)`);
    }
    
    // Description similarity
    const descSimilarity = calculateTextSimilarity(description, item.description);
    if (descSimilarity > 0.4) {
      score += Math.round(descSimilarity * 2);
      reasons.push(`Similar description`);
    }
    
    if (score >= DUPLICATE_THRESHOLD) {
      candidates.push({
        id: item.id,
        type: 'lost',
        title: item.title,
        description: item.description.substring(0, 100) + '...',
        category: item.category,
        location_area: item.location_area,
        date: item.lost_date,
        similarity_score: score,
        similarity_reasons: reasons
      });
    }
  }
  
  // Sort by score descending
  candidates.sort((a, b) => b.similarity_score - a.similarity_score);
  
  return {
    hasPotentialDuplicates: candidates.length > 0,
    candidates: candidates.slice(0, 5), // Return top 5
    highestScore: candidates[0]?.similarity_score || 0
  };
}

/**
 * Check for duplicate found items
 */
export async function checkDuplicateFoundItems(
  finderId: number,
  category: ItemCategory,
  title: string,
  description: string,
  locationArea: string,
  foundDate: Date
): Promise<DuplicateCheckResult> {
  // Get recent unclaimed found items in the same category
  const result = await query(
    `SELECT id, category, title, description, location_area, found_date, keywords
     FROM found_items
     WHERE finder_id = $1 
     AND category = $2
     AND status = 'UNCLAIMED'
     AND created_at > NOW() - INTERVAL '30 days'
     ORDER BY created_at DESC
     LIMIT 20`,
    [finderId, category]
  );
  
  const candidates: DuplicateCandidate[] = [];
  
  for (const item of result.rows) {
    let score = 0;
    const reasons: string[] = [];
    
    score += SAME_CATEGORY_SCORE;
    reasons.push(`Same category: ${category}`);
    
    const locationSimilarity = calculateTextSimilarity(locationArea, item.location_area);
    if (locationArea.toLowerCase() === item.location_area.toLowerCase()) {
      score += SAME_LOCATION_SCORE;
      reasons.push(`Same location: ${locationArea}`);
    } else if (locationSimilarity > 0.5) {
      score += SIMILAR_LOCATION_SCORE;
      reasons.push(`Similar location`);
    }
    
    const days = daysBetween(foundDate, item.found_date);
    if (days <= 3) {
      score += DATE_WITHIN_3_DAYS;
      reasons.push(`Found within 3 days of each other`);
    } else if (days <= 7) {
      score += DATE_WITHIN_7_DAYS;
      reasons.push(`Found within 7 days of each other`);
    }
    
    const titleSimilarity = calculateTextSimilarity(title, item.title);
    if (titleSimilarity > TITLE_SIMILARITY_THRESHOLD) {
      score += Math.round(titleSimilarity * 3);
      reasons.push(`Similar title (${Math.round(titleSimilarity * 100)}% match)`);
    }
    
    const descSimilarity = calculateTextSimilarity(description, item.description);
    if (descSimilarity > 0.4) {
      score += Math.round(descSimilarity * 2);
      reasons.push(`Similar description`);
    }
    
    if (score >= DUPLICATE_THRESHOLD) {
      candidates.push({
        id: item.id,
        type: 'found',
        title: item.title,
        description: item.description.substring(0, 100) + '...',
        category: item.category,
        location_area: item.location_area,
        date: item.found_date,
        similarity_score: score,
        similarity_reasons: reasons
      });
    }
  }
  
  candidates.sort((a, b) => b.similarity_score - a.similarity_score);
  
  return {
    hasPotentialDuplicates: candidates.length > 0,
    candidates: candidates.slice(0, 5),
    highestScore: candidates[0]?.similarity_score || 0
  };
}

/**
 * Cross-check if a new lost item matches any existing found items
 * (useful for immediate suggestions)
 */
export async function findPotentialMatchesForNewLostItem(
  category: ItemCategory,
  title: string,
  description: string,
  locationArea: string,
  lostDate: Date
): Promise<DuplicateCandidate[]> {
  const result = await query(
    `SELECT id, category, title, description, location_area, found_date, keywords
     FROM found_items
     WHERE category = $1
     AND status = 'UNCLAIMED'
     AND found_date >= $2 - INTERVAL '7 days'
     AND found_date <= NOW()
     ORDER BY found_date DESC
     LIMIT 50`,
    [category, lostDate]
  );
  
  const candidates: DuplicateCandidate[] = [];
  
  for (const item of result.rows) {
    let score = 0;
    const reasons: string[] = [];
    
    score += SAME_CATEGORY_SCORE;
    reasons.push(`Same category: ${category}`);
    
    const locationSimilarity = calculateTextSimilarity(locationArea, item.location_area);
    if (locationArea.toLowerCase() === item.location_area.toLowerCase()) {
      score += SAME_LOCATION_SCORE;
      reasons.push(`Same location`);
    } else if (locationSimilarity > 0.3) {
      score += SIMILAR_LOCATION_SCORE;
      reasons.push(`Nearby location`);
    }
    
    const titleSimilarity = calculateTextSimilarity(title, item.title);
    if (titleSimilarity > 0.4) {
      score += Math.round(titleSimilarity * 3);
      reasons.push(`Similar item description`);
    }
    
    const descSimilarity = calculateTextSimilarity(description, item.description);
    if (descSimilarity > 0.3) {
      score += Math.round(descSimilarity * 2);
      reasons.push(`Description matches`);
    }
    
    if (score >= 6) {
      candidates.push({
        id: item.id,
        type: 'found',
        title: item.title,
        description: item.description.substring(0, 100) + '...',
        category: item.category,
        location_area: item.location_area,
        date: item.found_date,
        similarity_score: score,
        similarity_reasons: reasons
      });
    }
  }
  
  candidates.sort((a, b) => b.similarity_score - a.similarity_score);
  return candidates.slice(0, 10);
}

/**
 * Record a potential duplicate for admin review
 */
export async function recordPotentialDuplicate(
  originalId: number,
  originalType: 'lost' | 'found',
  duplicateId: number,
  duplicateType: 'lost' | 'found',
  score: number,
  reasons: string[]
): Promise<void> {
  await query(
    `INSERT INTO potential_duplicates 
     (original_item_id, original_item_type, duplicate_item_id, duplicate_item_type, 
      similarity_score, similarity_reasons)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT DO NOTHING`,
    [originalId, originalType, duplicateId, duplicateType, score, reasons]
  );
}
