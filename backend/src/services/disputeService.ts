/**
 * Dispute Service for Byaboneka+
 * 
 * Implements CLAIM-07: Dispute mechanism for edge cases
 * Allows users to dispute claims when verification fails despite ownership,
 * or when there are issues with the handover process.
 */

import { query, transaction } from '../config/database';
import { logAudit, extractRequestMeta } from './auditService';
import { updateTrustScore } from './trustService';
import { Request } from 'express';

export type DisputeStatus = 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED_OWNER' | 'RESOLVED_FINDER' | 'DISMISSED';

export interface Dispute {
  id: number;
  claim_id: number;
  initiated_by: number;
  reason: string;
  evidence_urls: string[];
  status: DisputeStatus;
  admin_notes: string | null;
  resolved_by: number | null;
  resolved_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface DisputeCreationResult {
  success: boolean;
  dispute?: Dispute;
  message: string;
}

export interface DisputeResolutionResult {
  success: boolean;
  message: string;
  trustAdjustments?: {
    ownerId: number;
    ownerAdjustment: number;
    finderId: number;
    finderAdjustment: number;
  };
}

/**
 * Open a dispute for a claim
 * Can be initiated by either the claimant (owner) or the finder
 */
export async function openDispute(
  claimId: number,
  userId: number,
  reason: string,
  evidenceUrls: string[] = [],
  req?: Request
): Promise<DisputeCreationResult> {
  // Get claim details
  const claimResult = await query(
    `SELECT c.*, li.user_id as lost_item_owner, fi.finder_id
     FROM claims c
     JOIN lost_items li ON c.lost_item_id = li.id
     JOIN found_items fi ON c.found_item_id = fi.id
     WHERE c.id = $1`,
    [claimId]
  );
  
  if (claimResult.rows.length === 0) {
    return { success: false, message: 'Claim not found' };
  }
  
  const claim = claimResult.rows[0];
  
  // Check if user is a participant
  const isOwner = claim.claimant_id === userId || claim.lost_item_owner === userId;
  const isFinder = claim.finder_id === userId;
  
  if (!isOwner && !isFinder) {
    return { success: false, message: 'Only claim participants can open a dispute' };
  }
  
  // Check claim status - can dispute PENDING, VERIFIED, or REJECTED claims
  const validStatuses = ['PENDING', 'VERIFIED', 'REJECTED'];
  if (!validStatuses.includes(claim.status)) {
    return { 
      success: false, 
      message: `Cannot dispute a claim with status '${claim.status}'. Only pending, verified, or rejected claims can be disputed.` 
    };
  }
  
  // Check if dispute already exists
  const existingDispute = await query(
    'SELECT id, status FROM claim_disputes WHERE claim_id = $1',
    [claimId]
  );
  
  if (existingDispute.rows.length > 0) {
    const existing = existingDispute.rows[0];
    if (['OPEN', 'UNDER_REVIEW'].includes(existing.status)) {
      return { success: false, message: 'A dispute is already open for this claim' };
    }
  }
  
  // Create dispute
  const disputeResult = await query(
    `INSERT INTO claim_disputes (claim_id, initiated_by, reason, evidence_urls)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [claimId, userId, reason, evidenceUrls]
  );
  
  // Update claim status to DISPUTED
  await query(
    `UPDATE claims SET status = 'DISPUTED' WHERE id = $1`,
    [claimId]
  );
  
  // Log dispute creation
  const { ipAddress, userAgent } = req ? extractRequestMeta(req) : {};
  await logAudit({
    actorId: userId,
    action: 'DISPUTE_OPENED',
    resourceType: 'claim_dispute',
    resourceId: disputeResult.rows[0].id,
    changes: { claim_id: claimId, reason: reason.substring(0, 100) },
    ipAddress,
    userAgent
  });
  
  return {
    success: true,
    dispute: disputeResult.rows[0],
    message: 'Dispute opened successfully. An administrator will review your case.'
  };
}

/**
 * Get dispute details
 */
export async function getDispute(disputeId: number): Promise<Dispute | null> {
  const result = await query(
    'SELECT * FROM claim_disputes WHERE id = $1',
    [disputeId]
  );
  
  return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * Get dispute by claim ID
 */
export async function getDisputeByClaimId(claimId: number): Promise<Dispute | null> {
  const result = await query(
    'SELECT * FROM claim_disputes WHERE claim_id = $1 ORDER BY created_at DESC LIMIT 1',
    [claimId]
  );
  
  return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * Update dispute status (admin only)
 */
export async function updateDisputeStatus(
  disputeId: number,
  adminId: number,
  newStatus: 'UNDER_REVIEW',
  notes?: string,
  req?: Request
): Promise<{ success: boolean; message: string }> {
  const result = await query(
    `UPDATE claim_disputes 
     SET status = $1, admin_notes = COALESCE($2, admin_notes), updated_at = NOW()
     WHERE id = $3
     RETURNING *`,
    [newStatus, notes, disputeId]
  );
  
  if (result.rows.length === 0) {
    return { success: false, message: 'Dispute not found' };
  }
  
  const { ipAddress, userAgent } = req ? extractRequestMeta(req) : {};
  await logAudit({
    actorId: adminId,
    action: 'DISPUTE_UPDATED',
    resourceType: 'claim_dispute',
    resourceId: disputeId,
    changes: { status: newStatus },
    ipAddress,
    userAgent
  });
  
  return { success: true, message: `Dispute status updated to ${newStatus}` };
}

/**
 * Resolve a dispute (admin only)
 * This is a critical function that:
 * 1. Updates the dispute status
 * 2. Updates the claim status based on resolution
 * 3. Adjusts trust scores accordingly
 */
export async function resolveDispute(
  disputeId: number,
  adminId: number,
  resolution: 'RESOLVED_OWNER' | 'RESOLVED_FINDER' | 'DISMISSED',
  resolutionNotes: string,
  req?: Request
): Promise<DisputeResolutionResult> {
  // Get dispute with claim details
  const disputeResult = await query(
    `SELECT d.*, c.claimant_id, c.lost_item_id, c.found_item_id,
            li.user_id as lost_item_owner, fi.finder_id
     FROM claim_disputes d
     JOIN claims c ON d.claim_id = c.id
     JOIN lost_items li ON c.lost_item_id = li.id
     JOIN found_items fi ON c.found_item_id = fi.id
     WHERE d.id = $1`,
    [disputeId]
  );
  
  if (disputeResult.rows.length === 0) {
    return { success: false, message: 'Dispute not found' };
  }
  
  const dispute = disputeResult.rows[0];
  
  // Cannot resolve already resolved disputes
  if (['RESOLVED_OWNER', 'RESOLVED_FINDER', 'DISMISSED'].includes(dispute.status)) {
    return { success: false, message: 'This dispute has already been resolved' };
  }
  
  const ownerId = dispute.claimant_id;
  const finderId = dispute.finder_id;
  
  let ownerAdjustment = 0;
  let finderAdjustment = 0;
  let newClaimStatus = 'DISPUTED';
  
  await transaction(async (client) => {
    // Update dispute
    await client.query(
      `UPDATE claim_disputes 
       SET status = $1, resolved_by = $2, resolved_at = NOW(), 
           admin_notes = $3, updated_at = NOW()
       WHERE id = $4`,
      [resolution, adminId, resolutionNotes, disputeId]
    );
    
    // Determine outcomes based on resolution
    switch (resolution) {
      case 'RESOLVED_OWNER':
        // Owner was right - they get the item
        newClaimStatus = 'VERIFIED';
        ownerAdjustment = 10; // Trust bonus for legitimate dispute
        
        // If dispute was initiated by finder, they might get a penalty
        if (dispute.initiated_by === finderId) {
          finderAdjustment = -5; // Minor penalty for wrongly disputing
        }
        break;
        
      case 'RESOLVED_FINDER':
        // Finder was right - claim rejected
        newClaimStatus = 'REJECTED';
        finderAdjustment = 5; // Small bonus for reporting fraud
        
        // Claimant was trying to claim something not theirs
        ownerAdjustment = -15; // Significant penalty for false claim
        break;
        
      case 'DISMISSED':
        // Dispute was frivolous or inconclusive - revert to previous state
        newClaimStatus = 'PENDING';
        // Small penalty for whoever opened frivolous dispute
        if (dispute.initiated_by === ownerId) {
          ownerAdjustment = -5;
        } else {
          finderAdjustment = -5;
        }
        break;
    }
    
    // Update claim status
    await client.query(
      `UPDATE claims SET status = $1 WHERE id = $2`,
      [newClaimStatus, dispute.claim_id]
    );
    
    // Update item statuses if needed
    if (resolution === 'RESOLVED_OWNER') {
      // Treat as verified claim
      await client.query(
        `UPDATE found_items SET status = 'MATCHED' WHERE id = $1`,
        [dispute.found_item_id]
      );
      await client.query(
        `UPDATE lost_items SET status = 'CLAIMED' WHERE id = $1`,
        [dispute.lost_item_id]
      );
    } else if (resolution === 'RESOLVED_FINDER') {
      // Reset items to available
      await client.query(
        `UPDATE found_items SET status = 'UNCLAIMED' WHERE id = $1`,
        [dispute.found_item_id]
      );
      await client.query(
        `UPDATE lost_items SET status = 'ACTIVE' WHERE id = $1`,
        [dispute.lost_item_id]
      );
    }
  });
  
// Apply trust adjustments (outside transaction for safety)
if (ownerAdjustment !== 0) {
  await updateTrustScore(
    req ?? null,
    ownerId,
    ownerAdjustment,
    `Dispute resolution: ${resolution}`
  );
}

if (finderAdjustment !== 0) {
  await updateTrustScore(
    req ?? null,
    finderId,
    finderAdjustment,
    `Dispute resolution: ${resolution}`
  );
}

  
  // Log resolution
  const { ipAddress, userAgent } = req ? extractRequestMeta(req) : {};
  await logAudit({
    actorId: adminId,
    action: 'DISPUTE_RESOLVED',
    resourceType: 'claim_dispute',
    resourceId: disputeId,
    changes: {
      resolution,
      new_claim_status: newClaimStatus,
      owner_trust_adjustment: ownerAdjustment,
      finder_trust_adjustment: finderAdjustment
    },
    ipAddress,
    userAgent
  });
  
  return {
    success: true,
    message: `Dispute resolved: ${resolution}. Trust scores adjusted accordingly.`,
    trustAdjustments: {
      ownerId,
      ownerAdjustment,
      finderId,
      finderAdjustment
    }
  };
}

/**
 * Get all disputes for admin review
 */
export async function getDisputesForReview(
  status?: DisputeStatus,
  page: number = 1,
  limit: number = 20
): Promise<{ disputes: any[]; total: number }> {
  const offset = (page - 1) * limit;
  
  let whereClause = '';
  const params: any[] = [];
  let paramIndex = 1;
  
  if (status) {
    whereClause = `WHERE d.status = $${paramIndex++}`;
    params.push(status);
  }
  
  const countResult = await query(
    `SELECT COUNT(*) FROM claim_disputes d ${whereClause}`,
    params
  );
  
  const result = await query(
    `SELECT d.*, 
            c.status as claim_status,
            initiator.name as initiator_name, initiator.email as initiator_email,
            owner.name as owner_name, owner.email as owner_email,
            finder.name as finder_name, finder.email as finder_email,
            li.title as lost_item_title, li.category,
            fi.title as found_item_title
     FROM claim_disputes d
     JOIN claims c ON d.claim_id = c.id
     JOIN users initiator ON d.initiated_by = initiator.id
     JOIN lost_items li ON c.lost_item_id = li.id
     JOIN found_items fi ON c.found_item_id = fi.id
     JOIN users owner ON li.user_id = owner.id
     JOIN users finder ON fi.finder_id = finder.id
     ${whereClause}
     ORDER BY d.created_at DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
    [...params, limit, offset]
  );
  
  return {
    disputes: result.rows,
    total: parseInt(countResult.rows[0].count)
  };
}

/**
 * Add evidence to an existing dispute
 */
export async function addDisputeEvidence(
  disputeId: number,
  userId: number,
  evidenceUrls: string[]
): Promise<{ success: boolean; message: string }> {
  // Verify user is a participant
  const disputeResult = await query(
    `SELECT d.*, c.claimant_id, fi.finder_id
     FROM claim_disputes d
     JOIN claims c ON d.claim_id = c.id
     JOIN found_items fi ON c.found_item_id = fi.id
     WHERE d.id = $1`,
    [disputeId]
  );
  
  if (disputeResult.rows.length === 0) {
    return { success: false, message: 'Dispute not found' };
  }
  
  const dispute = disputeResult.rows[0];
  
  if (dispute.claimant_id !== userId && dispute.finder_id !== userId) {
    return { success: false, message: 'Only dispute participants can add evidence' };
  }
  
  // Can only add evidence to open disputes
  if (!['OPEN', 'UNDER_REVIEW'].includes(dispute.status)) {
    return { success: false, message: 'Cannot add evidence to a resolved dispute' };
  }
  
  // Append new evidence URLs
  await query(
    `UPDATE claim_disputes 
     SET evidence_urls = evidence_urls || $1, updated_at = NOW()
     WHERE id = $2`,
    [evidenceUrls, disputeId]
  );
  
  return { success: true, message: 'Evidence added successfully' };
}
