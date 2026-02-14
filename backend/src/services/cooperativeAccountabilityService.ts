import { query } from '../config/database';

/**
 * ============================================
 * COOPERATIVE ACCOUNTABILITY INDEX
 * ============================================
 * 
 * NOVEL FEATURE: No lost-and-found platform creates a public, data-driven
 * accountability ranking for partner organizations. This transforms
 * cooperatives from passive custodians into competitively ranked actors.
 * 
 * Citizens can see which cooperative returns items fastest and most
 * reliably, creating market-based incentives for good behavior without
 * regulatory enforcement.
 * 
 * Computes:
 *   - return_rate: items returned / items received
 *   - avg_return_hours: average time from report to return
 *   - dispute_rate: disputes / total claims through this coop
 *   - staff_trust_avg: average trust score of cooperative staff
 *   - accountability_score: weighted composite (0-100)
 */

// ============================================
// TYPES
// ============================================

export interface CooperativeAccountability {
  cooperative_id: number;
  cooperative_name: string;
  registration_number: string;

  // Raw metrics
  total_items_received: number;
  total_items_returned: number;
  total_claims_processed: number;
  total_disputes: number;
  avg_return_hours: number | null;
  staff_count: number;
  staff_trust_average: number;

  // Computed scores (0-100 each)
  return_rate_score: number;
  speed_score: number;
  reliability_score: number;    // inverse of dispute rate
  staff_quality_score: number;

  // Final composite
  accountability_score: number;
  accountability_grade: 'A' | 'B' | 'C' | 'D' | 'F';
  rank: number;

  // Trend
  trend: 'IMPROVING' | 'STABLE' | 'DECLINING';
}

// ============================================
// WEIGHTS FOR ACCOUNTABILITY SCORE
// ============================================

const WEIGHTS = {
  RETURN_RATE: 0.35,       // Most important: do items actually get returned?
  SPEED: 0.25,             // How fast?
  RELIABILITY: 0.20,       // Low dispute rate
  STAFF_QUALITY: 0.20,     // Staff trust scores
};

// Benchmarks for scoring
const BENCHMARKS = {
  EXCELLENT_RETURN_RATE: 0.80,
  GOOD_RETURN_RATE: 0.50,
  EXCELLENT_RETURN_HOURS: 24,
  GOOD_RETURN_HOURS: 72,
  POOR_RETURN_HOURS: 168,
};

// ============================================
// COMPUTE ACCOUNTABILITY INDEX
// ============================================

export async function computeCooperativeAccountability(): Promise<CooperativeAccountability[]> {
  // Get all verified cooperatives with their metrics
  const result = await query(`
    WITH coop_items AS (
      SELECT 
        c.id as cooperative_id,
        c.name as cooperative_name,
        c.registration_number,
        COUNT(fi.id) as total_items_received,
        COUNT(fi.id) FILTER (WHERE fi.status = 'RETURNED') as total_items_returned,
        AVG(
          CASE WHEN fi.status = 'RETURNED' AND hc.returned_at IS NOT NULL
          THEN EXTRACT(EPOCH FROM (hc.returned_at - fi.created_at)) / 3600
          ELSE NULL END
        ) as avg_return_hours
      FROM cooperatives c
      LEFT JOIN found_items fi ON fi.cooperative_id = c.id
      LEFT JOIN claims cl ON cl.found_item_id = fi.id AND cl.status = 'RETURNED'
      LEFT JOIN handover_confirmations hc ON hc.claim_id = cl.id AND hc.otp_verified = true
      WHERE c.status = 'VERIFIED'
      GROUP BY c.id, c.name, c.registration_number
    ),
    coop_claims AS (
      SELECT
        fi.cooperative_id,
        COUNT(DISTINCT cl.id) as total_claims,
        COUNT(DISTINCT d.id) as total_disputes
      FROM found_items fi
      JOIN claims cl ON cl.found_item_id = fi.id
      LEFT JOIN claim_disputes d ON d.claim_id = cl.id
      WHERE fi.cooperative_id IS NOT NULL
      GROUP BY fi.cooperative_id
    ),
    coop_staff AS (
      SELECT
        u.cooperative_id,
        COUNT(u.id) as staff_count,
        COALESCE(AVG(u.trust_score), 0) as staff_trust_avg
      FROM users u
      WHERE u.role = 'coop_staff' AND u.cooperative_id IS NOT NULL
      GROUP BY u.cooperative_id
    )
    SELECT
      ci.*,
      COALESCE(cc.total_claims, 0) as total_claims_processed,
      COALESCE(cc.total_disputes, 0) as total_disputes,
      COALESCE(cs.staff_count, 0) as staff_count,
      COALESCE(cs.staff_trust_avg, 0) as staff_trust_average
    FROM coop_items ci
    LEFT JOIN coop_claims cc ON cc.cooperative_id = ci.cooperative_id
    LEFT JOIN coop_staff cs ON cs.cooperative_id = ci.cooperative_id
    ORDER BY ci.cooperative_id
  `);

  const cooperatives: CooperativeAccountability[] = result.rows.map(row => {
    const totalReceived = parseInt(row.total_items_received) || 0;
    const totalReturned = parseInt(row.total_items_returned) || 0;
    const totalClaims = parseInt(row.total_claims_processed) || 0;
    const totalDisputes = parseInt(row.total_disputes) || 0;
    const avgHours = row.avg_return_hours ? parseFloat(row.avg_return_hours) : null;
    const staffTrustAvg = parseFloat(row.staff_trust_average) || 0;

    // ── Return Rate Score (0-100) ──
    let returnRateScore = 0;
    if (totalReceived > 0) {
      const rate = totalReturned / totalReceived;
      if (rate >= BENCHMARKS.EXCELLENT_RETURN_RATE) returnRateScore = 100;
      else if (rate >= BENCHMARKS.GOOD_RETURN_RATE) returnRateScore = 50 + (rate - 0.5) / 0.3 * 50;
      else returnRateScore = rate / 0.5 * 50;
    }

    // ── Speed Score (0-100) ──
    let speedScore = 50; // Default for no data
    if (avgHours !== null) {
      if (avgHours <= BENCHMARKS.EXCELLENT_RETURN_HOURS) speedScore = 100;
      else if (avgHours <= BENCHMARKS.GOOD_RETURN_HOURS) speedScore = 70 - (avgHours - 24) / 48 * 20;
      else if (avgHours <= BENCHMARKS.POOR_RETURN_HOURS) speedScore = 50 - (avgHours - 72) / 96 * 30;
      else speedScore = Math.max(10, 20 - (avgHours - 168) / 168 * 10);
    }

    // ── Reliability Score (0-100, inverse of dispute rate) ──
    let reliabilityScore = 100; // Perfect if no claims
    if (totalClaims > 0) {
      const disputeRate = totalDisputes / totalClaims;
      reliabilityScore = Math.max(0, 100 - disputeRate * 200); // 50% disputes = 0 score
    }

    // ── Staff Quality Score (0-100) ──
    let staffQualityScore = 50; // Default
    if (staffTrustAvg >= 15) staffQualityScore = 100;
    else if (staffTrustAvg >= 5) staffQualityScore = 60 + (staffTrustAvg - 5) / 10 * 40;
    else if (staffTrustAvg >= 0) staffQualityScore = 40 + staffTrustAvg / 5 * 20;
    else staffQualityScore = Math.max(0, 40 + staffTrustAvg * 4); // Negative trust tanks score

    // ── Composite Accountability Score ──
    const accountabilityScore = Math.round(
      returnRateScore * WEIGHTS.RETURN_RATE +
      speedScore * WEIGHTS.SPEED +
      reliabilityScore * WEIGHTS.RELIABILITY +
      staffQualityScore * WEIGHTS.STAFF_QUALITY
    );

    // ── Grade ──
    let grade: 'A' | 'B' | 'C' | 'D' | 'F';
    if (accountabilityScore >= 85) grade = 'A';
    else if (accountabilityScore >= 70) grade = 'B';
    else if (accountabilityScore >= 55) grade = 'C';
    else if (accountabilityScore >= 40) grade = 'D';
    else grade = 'F';

    return {
      cooperative_id: parseInt(row.cooperative_id),
      cooperative_name: row.cooperative_name,
      registration_number: row.registration_number,
      total_items_received: totalReceived,
      total_items_returned: totalReturned,
      total_claims_processed: totalClaims,
      total_disputes: totalDisputes,
      avg_return_hours: avgHours ? Math.round(avgHours) : null,
      staff_count: parseInt(row.staff_count) || 0,
      staff_trust_average: Math.round(staffTrustAvg * 10) / 10,
      return_rate_score: Math.round(returnRateScore),
      speed_score: Math.round(speedScore),
      reliability_score: Math.round(reliabilityScore),
      staff_quality_score: Math.round(staffQualityScore),
      accountability_score: accountabilityScore,
      accountability_grade: grade,
      rank: 0, // Set after sorting
      trend: 'STABLE' as const, // TODO: compute from historical data
    };
  });

  // Sort by accountability score and assign ranks
  cooperatives.sort((a, b) => b.accountability_score - a.accountability_score);
  cooperatives.forEach((c, i) => { c.rank = i + 1; });

  return cooperatives;
}

// ============================================
// GET SINGLE COOPERATIVE ACCOUNTABILITY
// ============================================

export async function getCooperativeAccountability(
  cooperativeId: number
): Promise<CooperativeAccountability | null> {
  const all = await computeCooperativeAccountability();
  return all.find(c => c.cooperative_id === cooperativeId) || null;
}

// ============================================
// SAFE HANDOVER LOCATIONS
// ============================================

export interface SafeHandoverPoint {
  id: number;
  name: string;
  type: 'COOPERATIVE_OFFICE' | 'SECTOR_OFFICE' | 'POLICE_POST' | 'TRANSIT_HUB';
  address: string;
  area: string;
  operating_hours: string;
  safety_rating: number; // 1-5
  latitude?: number;
  longitude?: number;
}

/**
 * NOVEL FEATURE: Structured handover location recommendations.
 * Returns safe meeting points ranked by proximity to the item's location area.
 * 
 * Fills spec gap HAND-05 and Algorithm Spec 3.5.2.
 */
export const SAFE_HANDOVER_POINTS: SafeHandoverPoint[] = [
  // Cooperative offices
  { id: 1, name: 'RFTC Nyabugogo Office', type: 'COOPERATIVE_OFFICE', address: 'Nyabugogo Bus Terminal', area: 'Nyabugogo', operating_hours: '06:00-20:00', safety_rating: 5 },
  { id: 2, name: 'Kigali Bus Services Kimironko', type: 'COOPERATIVE_OFFICE', address: 'Kimironko Bus Stop', area: 'Kimironko', operating_hours: '06:00-20:00', safety_rating: 5 },
  { id: 3, name: 'Royal Express Remera', type: 'COOPERATIVE_OFFICE', address: 'Remera Bus Station', area: 'Remera', operating_hours: '06:00-19:00', safety_rating: 4 },
  { id: 4, name: 'Volcano Express Downtown', type: 'COOPERATIVE_OFFICE', address: 'KN 4 Ave, City Center', area: 'Nyarugenge', operating_hours: '07:00-18:00', safety_rating: 5 },
  
  // Sector offices
  { id: 10, name: 'Kimironko Sector Office', type: 'SECTOR_OFFICE', address: 'Kimironko, Gasabo District', area: 'Kimironko', operating_hours: '07:00-17:00 Mon-Fri', safety_rating: 5 },
  { id: 11, name: 'Remera Sector Office', type: 'SECTOR_OFFICE', address: 'Remera, Gasabo District', area: 'Remera', operating_hours: '07:00-17:00 Mon-Fri', safety_rating: 5 },
  { id: 12, name: 'Nyamirambo Sector Office', type: 'SECTOR_OFFICE', address: 'Nyamirambo, Nyarugenge District', area: 'Nyamirambo', operating_hours: '07:00-17:00 Mon-Fri', safety_rating: 5 },
  { id: 13, name: 'Kicukiro Sector Office', type: 'SECTOR_OFFICE', address: 'Kicukiro Center', area: 'Kicukiro', operating_hours: '07:00-17:00 Mon-Fri', safety_rating: 5 },
  
  // Police posts
  { id: 20, name: 'Remera Police Station', type: 'POLICE_POST', address: 'KG 11 Ave, Remera', area: 'Remera', operating_hours: '24/7', safety_rating: 5 },
  { id: 21, name: 'Kacyiru Police Station', type: 'POLICE_POST', address: 'Kacyiru, Gasabo District', area: 'Kacyiru', operating_hours: '24/7', safety_rating: 5 },
  { id: 22, name: 'Nyarugenge Police Station', type: 'POLICE_POST', address: 'City Center', area: 'Nyarugenge', operating_hours: '24/7', safety_rating: 5 },
  
  // Transit hubs
  { id: 30, name: 'Nyabugogo Bus Terminal', type: 'TRANSIT_HUB', address: 'Nyabugogo Main Terminal', area: 'Nyabugogo', operating_hours: '05:00-21:00', safety_rating: 4 },
  { id: 31, name: 'Kigali Bus Terminal (Downtown)', type: 'TRANSIT_HUB', address: 'KN 2 Ave, Nyarugenge', area: 'Nyarugenge', operating_hours: '05:30-20:30', safety_rating: 4 },
  { id: 32, name: 'Kimironko Market Area', type: 'TRANSIT_HUB', address: 'Kimironko Commercial Center', area: 'Kimironko', operating_hours: '06:00-19:00', safety_rating: 3 },
];

export function recommendHandoverLocations(
  itemLocationArea: string,
  itemCategory: string
): SafeHandoverPoint[] {
  const areaLower = itemLocationArea.toLowerCase();
  
  // Score each location by proximity and appropriateness
  const scored = SAFE_HANDOVER_POINTS.map(point => {
    let score = 0;
    
    // Same area = highest score
    if (point.area.toLowerCase() === areaLower) score += 10;
    // Same district area
    else if (isAdjacent(point.area, itemLocationArea)) score += 5;
    
    // For sensitive items (ID, WALLET, PHONE), prefer official locations
    if (['ID', 'WALLET', 'PHONE'].includes(itemCategory)) {
      if (point.type === 'COOPERATIVE_OFFICE' || point.type === 'SECTOR_OFFICE') score += 3;
      if (point.type === 'POLICE_POST') score += 2;
    }
    
    // Safety rating bonus
    score += point.safety_rating;
    
    return { ...point, _score: score };
  });

  // Sort by score descending, return top 5
  scored.sort((a, b) => b._score - a._score);
  return scored.slice(0, 5).map(({ _score, ...point }) => point);
}

function isAdjacent(area1: string, area2: string): boolean {
  const adjacency: Record<string, string[]> = {
    'nyabugogo': ['nyarugenge', 'gitega', 'muhima'],
    'kimironko': ['remera', 'kibagabaga', 'gisozi'],
    'remera': ['kimironko', 'kacyiru', 'gisozi'],
    'kacyiru': ['remera', 'kimihurura', 'nyarutarama'],
    'nyamirambo': ['nyarugenge', 'biryogo', 'rwezamenyo'],
    'kicukiro': ['gatenga', 'gikondo', 'kanombe'],
    'nyarugenge': ['nyabugogo', 'nyamirambo', 'muhima', 'kacyiru'],
  };
  const a1 = area1.toLowerCase();
  const a2 = area2.toLowerCase();
  return adjacency[a1]?.includes(a2) || adjacency[a2]?.includes(a1) || false;
}