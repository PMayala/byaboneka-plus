import { Request, Response } from 'express';
import { query, transaction } from '../config/database';
import { verifyPassword } from '../utils';
import { logAudit, extractRequestMeta } from '../services/auditService';

export async function deleteAccount(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const { password, confirmation } = req.body;

    if (confirmation !== 'DELETE MY ACCOUNT') {
      res.status(400).json({ success: false, message: 'Please type "DELETE MY ACCOUNT" to confirm' });
      return;
    }
    if (!password) {
      res.status(400).json({ success: false, message: 'Password is required to delete your account' });
      return;
    }

    const userResult = await query('SELECT password_hash, email, name FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    const user = userResult.rows[0];
    const isValidPassword = await verifyPassword(password, user.password_hash);
    if (!isValidPassword) {
      res.status(401).json({ success: false, message: 'Incorrect password' });
      return;
    }

    const { ipAddress, userAgent } = extractRequestMeta(req);
    await logAudit({
      actorId: userId, action: 'ACCOUNT_DELETED', resourceType: 'user', resourceId: userId,
      changes: { email: user.email, reason: 'User-initiated account deletion' }, ipAddress, userAgent
    });

    await transaction(async (client) => {
      const anonymizedEmail = `deleted_${userId}_${Date.now()}@anonymized.local`;
      const anonymizedName = `Deleted User #${userId}`;

      await client.query(
        `UPDATE users SET email=$1, name=$2, phone=NULL, password_hash='DELETED',
         is_banned=true, ban_reason='Account deleted by user',
         email_verified=false, phone_verified=false, updated_at=NOW() WHERE id=$3`,
        [anonymizedEmail, anonymizedName, userId]
      );
      await client.query('DELETE FROM refresh_tokens WHERE user_id = $1', [userId]);
      await client.query('DELETE FROM email_verification_tokens WHERE user_id = $1', [userId]);
      await client.query('UPDATE messages SET sender_id = NULL WHERE sender_id = $1', [userId]);
      await client.query('DELETE FROM notification_preferences WHERE user_id = $1', [userId]).catch(() => {});
    });

    res.status(200).json({ success: true, message: 'Your account has been deleted and your personal data has been anonymized.' });
  } catch (error) {
    console.error('Account deletion error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete account. Please try again or contact support.' });
  }
}

export async function exportUserData(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const [userResult, lostItems, foundItems, claims, messages, auditLogs] = await Promise.all([
      query('SELECT id, email, name, phone, role, trust_score, email_verified, phone_verified, created_at FROM users WHERE id = $1', [userId]),
      query('SELECT id, category, title, description, location_area, location_hint, lost_date, status, created_at FROM lost_items WHERE user_id = $1 ORDER BY created_at DESC', [userId]),
      query('SELECT id, category, title, description, location_area, location_hint, found_date, status, created_at FROM found_items WHERE finder_id = $1 ORDER BY created_at DESC', [userId]),
      query('SELECT id, lost_item_id, found_item_id, status, verification_score, attempts_made, created_at FROM claims WHERE claimant_id = $1 ORDER BY created_at DESC', [userId]),
      query('SELECT id, claim_id, content, is_read, created_at FROM messages WHERE sender_id = $1 ORDER BY created_at DESC', [userId]),
      query('SELECT action, resource_type, resource_id, timestamp FROM audit_logs WHERE actor_id = $1 ORDER BY timestamp DESC LIMIT 100', [userId]),
    ]);

    const exportData = {
      exported_at: new Date().toISOString(), platform: 'Byaboneka+',
      user: userResult.rows[0] || null, lost_items: lostItems.rows,
      found_items: foundItems.rows, claims: claims.rows,
      messages_sent: messages.rows, recent_activity: auditLogs.rows,
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="byaboneka-data-export-${userId}.json"`);
    res.status(200).json({ success: true, data: exportData });
  } catch (error) {
    console.error('Data export error:', error);
    res.status(500).json({ success: false, message: 'Failed to export data' });
  }
}

/** FIX: This was missing — caused 404 on GET /users/me/export/preview */
export async function exportDataPreview(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const [lostCount, foundCount, claimCount, messageCount, disputeCount] = await Promise.all([
      query('SELECT COUNT(*)::int AS count FROM lost_items WHERE user_id = $1', [userId]),
      query('SELECT COUNT(*)::int AS count FROM found_items WHERE finder_id = $1', [userId]),
      query('SELECT COUNT(*)::int AS count FROM claims WHERE claimant_id = $1', [userId]),
      query('SELECT COUNT(*)::int AS count FROM messages WHERE sender_id = $1', [userId]),
      query('SELECT COUNT(*)::int AS count FROM claim_disputes WHERE initiated_by = $1', [userId]).catch(() => ({ rows: [{ count: 0 }] })),
    ]);

    const totals = {
      total_lost_items: lostCount.rows[0]?.count || 0,
      total_found_items: foundCount.rows[0]?.count || 0,
      total_claims: claimCount.rows[0]?.count || 0,
      total_messages: messageCount.rows[0]?.count || 0,
      total_disputes: disputeCount.rows[0]?.count || 0,
    };

    res.json({
      success: true,
      data: {
        ...totals,
        estimated_size_bytes: Object.values(totals).reduce((a, b) => a + b, 0) * 500 + 1024,
      },
    });
  } catch (error) {
    console.error('Data export preview error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate data preview' });
  }
}