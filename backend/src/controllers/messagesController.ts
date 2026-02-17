import { Request, Response } from 'express';
import { query } from '../config/database';
import { parsePaginationParams, isMessageFlaggable } from '../utils';
import { UserRole } from '../types';

// ============================================
// MESSAGES CONTROLLER
// In-app Messaging for Claims
// ============================================

// Send message in claim thread
export async function sendMessage(req: Request, res: Response): Promise<void> {
  try {
    const { claimId } = req.params;
    const userId = req.user!.userId;
    const { content } = req.body;

    // Get claim and verify user is a participant
    const claimResult = await query(
      `SELECT c.*, fi.finder_id, li.user_id as owner_id
       FROM claims c
       JOIN found_items fi ON c.found_item_id = fi.id
       JOIN lost_items li ON c.lost_item_id = li.id
       WHERE c.id = $1`,
      [claimId]
    );

    if (claimResult.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Claim not found' });
      return;
    }

    const claim = claimResult.rows[0];

    // Only allow messaging between verified claim participants
    const isOwner = claim.owner_id === userId;
    const isFinder = claim.finder_id === userId;

    if (!isOwner && !isFinder) {
      res.status(403).json({ success: false, message: 'Not authorized to message in this claim' });
      return;
    }

    // Only allow messaging for verified claims
    if (!['VERIFIED', 'PENDING'].includes(claim.status)) {
      res.status(400).json({ success: false, message: 'Messaging is not available for this claim status' });
      return;
    }

    // Determine receiver
    const receiverId = isOwner ? claim.finder_id : claim.owner_id;

    // Check for flaggable content
    const flagCheck = isMessageFlaggable(content);

    // Create message
    const result = await query(
      `INSERT INTO messages (sender_id, receiver_id, claim_id, content, is_flagged, flag_reason)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [userId, receiverId, claimId, content, flagCheck.flagged, flagCheck.reason || null]
    );

    const message = result.rows[0];

    // Add warning if flagged
    const responseMessage = flagCheck.flagged
      ? {
          ...message,
          warning: 'Your message contains potentially suspicious content. Remember: Never pay money before verification.'
        }
      : message;

    res.status(201).json({
      success: true,
      data: responseMessage
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ success: false, message: 'Failed to send message' });
  }
}

// Get messages for a claim
export async function getClaimMessages(req: Request, res: Response): Promise<void> {
  try {
    const { claimId } = req.params;
    const userId = req.user!.userId;

    // Verify user is a participant
    const claimResult = await query(
      `SELECT c.*, fi.finder_id, li.user_id as owner_id
       FROM claims c
       JOIN found_items fi ON c.found_item_id = fi.id
       JOIN lost_items li ON c.lost_item_id = li.id
       WHERE c.id = $1`,
      [claimId]
    );

    if (claimResult.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Claim not found' });
      return;
    }

    const claim = claimResult.rows[0];
    const isOwner = claim.owner_id === userId;
    const isFinder = claim.finder_id === userId;

    if (!isOwner && !isFinder && req.user!.role !== UserRole.ADMIN) {
      res.status(403).json({ success: false, message: 'Not authorized to view these messages' });
      return;
    }

    // Get messages
    const result = await query(
      `SELECT m.*, 
              u.name as sender_name,
              CASE WHEN m.sender_id = $2 THEN true ELSE false END as is_mine
       FROM messages m
       JOIN users u ON m.sender_id = u.id
       WHERE m.claim_id = $1
       ORDER BY m.created_at ASC`,
      [claimId, userId]
    );

    // Mark messages as read
    await query(
      `UPDATE messages SET is_read = true WHERE claim_id = $1 AND receiver_id = $2`,
      [claimId, userId]
    );

    res.json({
      success: true,
      data: result.rows,
      warning: 'Never pay money before item verification and handover. Report suspicious behavior.'
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ success: false, message: 'Failed to get messages' });
  }
}

// Get all message threads for current user
export async function getMessageThreads(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const { page, limit, offset } = parsePaginationParams(
      req.query.page as string,
      req.query.limit as string
    );

    // Get claims where user is participant
    const result = await query(
      `SELECT DISTINCT ON (c.id)
              c.id as claim_id,
              c.status as claim_status,
              li.title as item_title,
              li.category,
              CASE WHEN li.user_id = $1 THEN 'owner' ELSE 'finder' END as my_role,
              CASE WHEN li.user_id = $1 THEN finder.name ELSE owner.name END as other_party_name,
              (SELECT content FROM messages WHERE claim_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
              (SELECT created_at FROM messages WHERE claim_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_at,
              (SELECT COUNT(*) FROM messages WHERE claim_id = c.id AND receiver_id = $1 AND is_read = false) as unread_count
       FROM claims c
       JOIN lost_items li ON c.lost_item_id = li.id
       JOIN found_items fi ON c.found_item_id = fi.id
       JOIN users owner ON li.user_id = owner.id
       JOIN users finder ON fi.finder_id = finder.id
       WHERE li.user_id = $1 OR fi.finder_id = $1
       ORDER BY c.id, last_message_at DESC NULLS LAST
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    const countResult = await query(
      `SELECT COUNT(DISTINCT c.id)
       FROM claims c
       JOIN lost_items li ON c.lost_item_id = li.id
       JOIN found_items fi ON c.found_item_id = fi.id
       WHERE li.user_id = $1 OR fi.finder_id = $1`,
      [userId]
    );
    const total = parseInt(countResult.rows[0].count);

    res.json({
      success: true,
      data: result.rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (error) {
    console.error('Get message threads error:', error);
    res.status(500).json({ success: false, message: 'Failed to get message threads' });
  }
}

// Report scam
export async function reportScam(req: Request, res: Response): Promise<void> {
  try {
    const { messageId } = req.params;
    const userId = req.user!.userId;
    const { reason } = req.body;

    // Get message
    const messageResult = await query(
      `SELECT m.*, c.id as claim_id
       FROM messages m
       JOIN claims c ON m.claim_id = c.id
       WHERE m.id = $1`,
      [messageId]
    );

    if (messageResult.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Message not found' });
      return;
    }

    const message = messageResult.rows[0];

    // Can only report messages received
    if (message.receiver_id !== userId) {
      res.status(403).json({ success: false, message: 'You can only report messages you received' });
      return;
    }

    // Check for existing report
    const existingReport = await query(
      `SELECT id FROM scam_reports WHERE message_id = $1 AND reporter_id = $2`,
      [messageId, userId]
    );

    if (existingReport.rows.length > 0) {
      res.status(409).json({ success: false, message: 'You have already reported this message' });
      return;
    }

    // Create report
    const result = await query(
      `INSERT INTO scam_reports (reporter_id, message_id, reported_user_id, claim_id, reason)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, messageId, message.sender_id, message.claim_id, reason]
    );

    // Flag the message
    await query(
      `UPDATE messages SET is_flagged = true, flag_reason = 'Reported by recipient' WHERE id = $1`,
      [messageId]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Scam report submitted. Our team will review it.'
    });
  } catch (error) {
    console.error('Report scam error:', error);
    res.status(500).json({ success: false, message: 'Failed to report scam' });
  }
}

// Get unread message count
export async function getUnreadCount(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;

    const result = await query(
      `SELECT COUNT(*) FROM messages WHERE receiver_id = $1 AND is_read = false`,
      [userId]
    );

    res.json({
      success: true,
      data: { unread_count: parseInt(result.rows[0].count) }
    });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ success: false, message: 'Failed to get unread count' });
  }
}