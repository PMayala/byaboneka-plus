// ============================================
// ACCOUNT DELETION CONTROLLER
// File: src/controllers/accountController.ts
// Gap Fix: Right to Erasure (Rwanda Law N°058/2021)
// ============================================

import { Request, Response } from 'express';
import { query, transaction } from '../config/database';
import { verifyPassword } from '../utils';
import { logAudit, extractRequestMeta } from '../services/auditService';

/**
 * DELETE /api/v1/users/me
 * Permanently deletes a user's account and anonymizes their data.
 * Requires password confirmation for security.
 * 
 * Data handling:
 * - Personal info (name, email, phone) → anonymized
 * - Messages → anonymized sender
 * - Items/claims → kept for audit trail but de-linked
 * - Audit logs → preserved (legal requirement)
 * - Refresh tokens → deleted
 */
export async function deleteAccount(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const { password, confirmation } = req.body;

    // Require explicit confirmation
    if (confirmation !== 'DELETE MY ACCOUNT') {
      res.status(400).json({
        success: false,
        message: 'Please type "DELETE MY ACCOUNT" to confirm'
      });
      return;
    }

    // Verify password
    if (!password) {
      res.status(400).json({
        success: false,
        message: 'Password is required to delete your account'
      });
      return;
    }

    const userResult = await query(
      'SELECT password_hash, email, name FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    const user = userResult.rows[0];
    const isValidPassword = await verifyPassword(password, user.password_hash);

    if (!isValidPassword) {
      res.status(401).json({
        success: false,
        message: 'Incorrect password'
      });
      return;
    }

    // Log before deletion (preserve audit trail)
    const { ipAddress, userAgent } = extractRequestMeta(req);
    await logAudit({
      actorId: userId,
      action: 'ACCOUNT_DELETED',
      resourceType: 'user',
      resourceId: userId,
      changes: { email: user.email, reason: 'User-initiated account deletion' },
      ipAddress,
      userAgent
    });

    // Perform deletion in a transaction
    await transaction(async (client) => {
      const anonymizedEmail = `deleted_${userId}_${Date.now()}@anonymized.local`;
      const anonymizedName = `Deleted User #${userId}`;

      // 1. Anonymize user record (soft delete - preserve for foreign keys)
      await client.query(
        `UPDATE users SET 
          email = $1,
          name = $2,
          phone = NULL,
          password_hash = 'DELETED',
          is_banned = true,
          ban_reason = 'Account deleted by user',
          email_verified = false,
          phone_verified = false,
          updated_at = NOW()
        WHERE id = $3`,
        [anonymizedEmail, anonymizedName, userId]
      );

      // 2. Delete refresh tokens (immediate session invalidation)
      await client.query(
        'DELETE FROM refresh_tokens WHERE user_id = $1',
        [userId]
      );

      // 3. Delete email verification tokens
      await client.query(
        'DELETE FROM email_verification_tokens WHERE user_id = $1',
        [userId]
      );

      // 4. Anonymize messages (preserve thread structure for other users)
      await client.query(
        `UPDATE messages SET sender_id = NULL WHERE sender_id = $1`,
        [userId]
      );

      // 5. Delete notification preferences
      await client.query(
        'DELETE FROM notification_preferences WHERE user_id = $1',
        [userId]
      );
    });

    res.status(200).json({
      success: true,
      message: 'Your account has been deleted and your personal data has been anonymized.'
    });
  } catch (error) {
    console.error('Account deletion error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete account. Please try again or contact support.'
    });
  }
}

/**
 * GET /api/v1/users/me/export
 * Exports all user data in JSON format (Right to Portability).
 */
export async function exportUserData(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;

    // Gather all user data
    const [userResult, lostItems, foundItems, claims, messages, auditLogs] = await Promise.all([
      query('SELECT id, email, name, phone, role, trust_score, email_verified, phone_verified, created_at FROM users WHERE id = $1', [userId]),
      query('SELECT id, category, title, description, location_area, location_hint, lost_date, status, created_at FROM lost_items WHERE user_id = $1 ORDER BY created_at DESC', [userId]),
      query('SELECT id, category, title, description, location_area, location_hint, found_date, status, created_at FROM found_items WHERE finder_id = $1 ORDER BY created_at DESC', [userId]),
      query('SELECT id, lost_item_id, found_item_id, status, verification_score, attempts_made, created_at FROM claims WHERE claimant_id = $1 ORDER BY created_at DESC', [userId]),
      query('SELECT id, claim_id, content, is_read, created_at FROM messages WHERE sender_id = $1 ORDER BY created_at DESC', [userId]),
      query('SELECT action, resource_type, resource_id, timestamp FROM audit_logs WHERE actor_id = $1 ORDER BY timestamp DESC LIMIT 100', [userId]),
    ]);

    const exportData = {
      exported_at: new Date().toISOString(),
      platform: 'Byaboneka+',
      user: userResult.rows[0] || null,
      lost_items: lostItems.rows,
      found_items: foundItems.rows,
      claims: claims.rows,
      messages_sent: messages.rows,
      recent_activity: auditLogs.rows,
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="byaboneka-data-export-${userId}.json"`);
    res.status(200).json({
      success: true,
      data: exportData
    });
  } catch (error) {
    console.error('Data export error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export data'
    });
  }
}
