import { Request, Response } from 'express';
import { query, transaction } from '../config/database';
import { parsePaginationParams } from '../utils';
import { logModeration, getAuditLogs } from '../services/auditService';
import { onScamConfirmed, onFalseScamReport, recalculateTrustScore } from '../services/trustService';
import { runDailyCleanup } from '../services/expiryService';

// ============================================
// ADMIN CONTROLLER
// ============================================

// Get dashboard stats
export async function getDashboardStats(req: Request, res: Response): Promise<void> {
  try {
    const [
      usersResult,
      lostResult,
      foundResult,
      claimsResult,
      returnedResult,
      pendingReportsResult
    ] = await Promise.all([
      query('SELECT COUNT(*) FROM users WHERE role = $1', ['citizen']),
      query('SELECT COUNT(*) FROM lost_items'),
      query('SELECT COUNT(*) FROM found_items'),
      query('SELECT COUNT(*) FROM claims'),
      query(`SELECT COUNT(*) FROM claims WHERE status = 'RETURNED'`),
      query(`SELECT COUNT(*) FROM scam_reports WHERE status = 'OPEN'`),
    ]);

    res.json({
      success: true,
      data: {
        total_users: parseInt(usersResult.rows[0].count),
        total_lost_items: parseInt(lostResult.rows[0].count),
        total_found_items: parseInt(foundResult.rows[0].count),
        total_claims: parseInt(claimsResult.rows[0].count),
        successful_returns: parseInt(returnedResult.rows[0].count),
        pending_scam_reports: parseInt(pendingReportsResult.rows[0].count),
      }
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to get stats' });
  }
}

// Get all users
export async function getUsers(req: Request, res: Response): Promise<void> {
  try {
    const { page, limit, offset } = parsePaginationParams(
      req.query.page as string,
      req.query.limit as string
    );
    const { search, role, status } = req.query;

    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (search) {
      conditions.push(`(LOWER(u.name) LIKE LOWER($${paramIndex}) OR LOWER(u.email) LIKE LOWER($${paramIndex}))`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (role) {
      conditions.push(`u.role = $${paramIndex++}`);
      params.push(role);
    }

    if (status === 'banned') {
      conditions.push('u.is_banned = true');
    } else if (status === 'active') {
      conditions.push('u.is_banned = false');
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await query(`SELECT COUNT(*) FROM users u LEFT JOIN cooperatives c ON u.cooperative_id = c.id ${whereClause}`, params);
    const total = parseInt(countResult.rows[0].count);

    const result = await query(
      `SELECT u.id, u.email, u.name, u.phone, u.role, u.trust_score, u.is_banned, u.ban_reason, u.created_at,
              c.name as cooperative_name
       FROM users u
       LEFT JOIN cooperatives c ON u.cooperative_id = c.id
       ${whereClause}
       ORDER BY u.created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...params, limit, offset]
    );

    res.json({
      success: true,
      data: result.rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ success: false, message: 'Failed to get users' });
  }
}

// Ban user
export async function banUser(req: Request, res: Response): Promise<void> {
  try {
    const { userId } = req.params;
    const { reason } = req.body;

    const userResult = await query('SELECT * FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    if (userResult.rows[0].role === 'admin') {
      res.status(403).json({ success: false, message: 'Cannot ban admin users' });
      return;
    }

    await query(
      `UPDATE users SET is_banned = true, banned_at = NOW(), ban_reason = $1 WHERE id = $2`,
      [reason, userId]
    );

    await logModeration(req, 'USER_BANNED', 'user', parseInt(userId), { reason });

    res.json({ success: true, message: 'User banned successfully' });
  } catch (error) {
    console.error('Ban user error:', error);
    res.status(500).json({ success: false, message: 'Failed to ban user' });
  }
}

// Unban user
export async function unbanUser(req: Request, res: Response): Promise<void> {
  try {
    const { userId } = req.params;

    await query(
      `UPDATE users SET is_banned = false, banned_at = NULL, ban_reason = NULL WHERE id = $1`,
      [userId]
    );

    await logModeration(req, 'USER_UNBANNED', 'user', parseInt(userId), {});

    res.json({ success: true, message: 'User unbanned successfully' });
  } catch (error) {
    console.error('Unban user error:', error);
    res.status(500).json({ success: false, message: 'Failed to unban user' });
  }
}

// Get scam reports
export async function getScamReports(req: Request, res: Response): Promise<void> {
  try {
    const { page, limit, offset } = parsePaginationParams(
      req.query.page as string,
      req.query.limit as string
    );
    const { status } = req.query;

    let whereClause = '';
    const params: any[] = [];

    if (status) {
      whereClause = 'WHERE sr.status = $1';
      params.push(status);
    }

    const countResult = await query(
      `SELECT COUNT(*) FROM scam_reports sr ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    const result = await query(
      `SELECT sr.*, 
              reporter.name as reporter_name, reporter.email as reporter_email,
              reported.name as reported_name, reported.email as reported_email,
              m.content as message_content
       FROM scam_reports sr
       JOIN users reporter ON sr.reporter_id = reporter.id
       JOIN users reported ON sr.reported_user_id = reported.id
       LEFT JOIN messages m ON sr.message_id = m.id
       ${whereClause}
       ORDER BY sr.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    res.json({
      success: true,
      data: result.rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (error) {
    console.error('Get scam reports error:', error);
    res.status(500).json({ success: false, message: 'Failed to get scam reports' });
  }
}

// Resolve scam report
export async function resolveScamReport(req: Request, res: Response): Promise<void> {
  try {
    const { reportId } = req.params;
    const { resolution_notes, action } = req.body;

    const reportResult = await query('SELECT * FROM scam_reports WHERE id = $1', [reportId]);
    if (reportResult.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Report not found' });
      return;
    }

    const report = reportResult.rows[0];

    await transaction(async (client) => {
      // Update report
      await client.query(
        `UPDATE scam_reports SET status = 'RESOLVED', resolution_notes = $1, resolved_at = NOW(), resolved_by = $2
         WHERE id = $3`,
        [resolution_notes, req.user!.userId, reportId]
      );

      // Take action based on decision
      if (action === 'ban') {
        await client.query(
          `UPDATE users SET is_banned = true, banned_at = NOW(), ban_reason = $1 WHERE id = $2`,
          [`Scam report #${reportId}: ${resolution_notes}`, report.reported_user_id]
        );
        await onScamConfirmed(req, report.reported_user_id);
      } else if (action === 'warn') {
        await onScamConfirmed(req, report.reported_user_id);
      } else if (action === 'dismiss') {
        // False report - penalize reporter
        await onFalseScamReport(req, report.reporter_id);
      }
    });

    await logModeration(req, 'SCAM_REPORT_RESOLVED', 'scam_report', parseInt(reportId), {
      action, resolution_notes
    });

    res.json({ success: true, message: 'Scam report resolved' });
  } catch (error) {
    console.error('Resolve scam report error:', error);
    res.status(500).json({ success: false, message: 'Failed to resolve report' });
  }
}

// Get audit logs
export async function getAuditLogsHandler(req: Request, res: Response): Promise<void> {
  try {
    const { actorId, action, resourceType, resourceId, fromDate, toDate, page, limit } = req.query;

    const logs = await getAuditLogs({
      actorId: actorId ? parseInt(actorId as string) : undefined,
      action: action as string,
      resourceType: resourceType as string,
      resourceId: resourceId ? parseInt(resourceId as string) : undefined,
      fromDate: fromDate ? new Date(fromDate as string) : undefined,
      toDate: toDate ? new Date(toDate as string) : undefined,
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 50,
    });

    res.json({ success: true, ...logs });
  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({ success: false, message: 'Failed to get audit logs' });
  }
}

// Recalculate trust score
export async function recalculateUserTrust(req: Request, res: Response): Promise<void> {
  try {
    const { userId } = req.params;

    const newScore = await recalculateTrustScore(parseInt(userId));

    res.json({
      success: true,
      data: { user_id: parseInt(userId), new_trust_score: newScore },
      message: 'Trust score recalculated'
    });
  } catch (error) {
    console.error('Recalculate trust error:', error);
    res.status(500).json({ success: false, message: 'Failed to recalculate trust' });
  }
}

// Run daily cleanup manually
export async function triggerCleanup(req: Request, res: Response): Promise<void> {
  try {
    await runDailyCleanup();
    
    await logModeration(req, 'CLEANUP_TRIGGERED', 'system', 0, {});

    res.json({
      success: true,
      message: 'Cleanup job completed successfully'
    });
  } catch (error) {
    console.error('Cleanup trigger error:', error);
    res.status(500).json({ success: false, message: 'Failed to run cleanup' });
  }
}