import { Request, Response } from 'express';
import { query } from '../config/database';
import { parsePaginationParams, isMessageFlaggable, maskPhoneNumbersInContent } from '../utils';
import { UserRole } from '../types';
import { logAudit } from '../services/auditService';

// ============================================
// MESSAGES CONTROLLER
// In-app Messaging for Claims
// ============================================

// ALGO-3.4.1: Sensitive data fishing patterns (complete implementation)
const SENSITIVE_DATA_PATTERNS = [
  /\b1\d{15}\b/,                          // Rwanda NID (16 digits starting with 1)
  /(?:\+?250|0)7\d{8}/,                   // Rwandan phone numbers
  /(?:send|give|share|tell)\s+(?:me\s+)?(?:your|the)\s+(?:id|phone|number|nid|identity|indangamuntu)/i,
  /(?:ohereze|mpa|ntanga)\s+(?:inomero|telefoni|indangamuntu)/i,  // Kinyarwanda
  /\b\d{15}\b/,                           // IMEI numbers (15 digits)
  /\b\d{10,16}\b.*(?:account|konte|amafaranga)/i, // Bank account patterns
  /(?:what|tell|share|give)\s+(?:is|me)\s+(?:your|the)\s+(?:full|complete)\s+(?:name|id|number)/i,
  /(?:envoyer|donner|partager)\s+(?:votre|ton|le)\s+(?:numéro|identité|téléphone)/i, // French
  /(?:last|full)\s+(?:3|4|three|four)\s+(?:digits|numbers|chars)/i, // Trying to extract partial ID
  /(?:pin|code|password|mot de passe|ijambo ry'ibanga)/i, // Asking for credentials
];

// MoMo/Mobile money detection (COMM-05: complete MTN patterns)
const MOBILE_MONEY_PATTERNS = [
  /\*182\*/,            // MTN MoMo USSD
  /\*131\*/,            // Airtel Money
  /\*909\*/,            // Tigo Cash
  /momo\s*(?:code|number|numer)/i,
  /(?:send|ohereze)\s+(?:to|kuri)\s+\d{10}/i,
  /agent\s+(?:code|id|number)/i,
];

function detectSensitiveDataFishing(content: string): boolean {
  return SENSITIVE_DATA_PATTERNS.some(pattern => pattern.test(content));
}

function detectMobileMoneyActivity(content: string): boolean {
  return MOBILE_MONEY_PATTERNS.some(pattern => pattern.test(content));
}

// Send message in claim thread
export async function sendMessage(req: Request, res: Response): Promise<void> {
  try {
    const { claimId } = req.params;
    const userId = req.user!.userId;
    let { content } = req.body;

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

    // COMM-02: Automatically mask phone numbers in content
    const phoneCheck = maskPhoneNumbersInContent(content);
    if (phoneCheck.hadPhoneNumbers) {
      content = phoneCheck.masked;
    }

    // Check for flaggable content (extortion patterns — COMM-05)
    const flagCheck = isMessageFlaggable(content);

    // ALGO-3.4.1: Sensitive data fishing detection
    const hasSensitiveRequest = detectSensitiveDataFishing(content);

    // COMM-05: MTN MoMo pattern detection
    const hasMoMoActivity = detectMobileMoneyActivity(content);

    // Determine flag status
    const isFlagged = flagCheck.flagged || hasSensitiveRequest || hasMoMoActivity;

    let flagReason: string | null = null;
    const flagReasons: string[] = [];

    if (flagCheck.flagged && flagCheck.reason) {
      flagReasons.push(flagCheck.reason);
    }
    if (hasSensitiveRequest) {
      flagReasons.push('Message requests sensitive personal information (ID, phone, bank details)');
    }
    if (hasMoMoActivity) {
      flagReasons.push('Message contains mobile money transaction patterns');
    }
    if (phoneCheck.hadPhoneNumbers) {
      flagReasons.push('Phone number was automatically masked for privacy');
    }

    if (flagReasons.length > 0) {
      flagReason = flagReasons.join('; ');
    }

    // Log sensitive data fishing to audit
    if (hasSensitiveRequest || hasMoMoActivity) {
      try {
        await logAudit({
          actorId: userId,
          action: 'SENSITIVE_DATA_FISHING_DETECTED',
          resourceType: 'message',
          resourceId: parseInt(claimId),
          changes: {
            pattern_detected: true,
            sensitive_data_fishing: hasSensitiveRequest,
            mobile_money_activity: hasMoMoActivity,
            content_preview: content.substring(0, 50)
          },
          ipAddress: req.ip || 'unknown',
          userAgent: req.get('User-Agent') || ''
        });
      } catch (auditErr) {
        console.error('Failed to log sensitive data audit:', auditErr);
      }
    }

    // Create message (with masked content if phone was detected)
    const result = await query(
      `INSERT INTO messages (sender_id, receiver_id, claim_id, content, is_flagged, flag_reason)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [userId, receiverId, claimId, content, isFlagged, flagReason]
    );

    const message = result.rows[0];

    // Build response with appropriate warnings
    const warnings: string[] = [];
    if (flagCheck.flagged) {
      warnings.push('⚠️ Your message contains potentially suspicious content. Remember: Never pay money before verification.');
    }
    if (hasSensitiveRequest) {
      warnings.push('🔒 Never share your full ID number, phone number, or bank details in chat. Byaboneka+ will never ask for this information.');
    }
    if (hasMoMoActivity) {
      warnings.push('💰 Mobile money transactions detected. Never send money to recover your item. This is a common scam.');
    }
    if (phoneCheck.hadPhoneNumbers) {
      warnings.push('📱 Phone numbers are automatically hidden for your privacy. Use in-app messaging instead.');
    }

    const responseData = warnings.length > 0
      ? { ...message, warnings }
      : message;

    res.status(201).json({
      success: true,
      data: responseData
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
      safety_notice: 'Never pay money before item verification and handover. Never share your full ID number, phone number, or bank details. Report suspicious behavior using the Report button.'
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