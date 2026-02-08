import { Request, Response } from 'express';
import { query } from '../config/database';
import { parsePaginationParams, hashPassword } from '../utils';
import { logCreate, logUpdate, logModeration } from '../services/auditService';
import { UserRole, CooperativeStatus } from '../types';

// ============================================
// COOPERATIVES CONTROLLER
// ============================================

// Get all cooperatives (public)
export async function getCooperatives(req: Request, res: Response): Promise<void> {
  try {
    const { page, limit, offset } = parsePaginationParams(
      req.query.page as string,
      req.query.limit as string
    );
    const { status, search } = req.query;

    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (status) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(status);
    } else {
      // By default, only show verified cooperatives to public
      if (req.user?.role !== 'admin') {
        conditions.push(`status = 'VERIFIED'`);
      }
    }

    if (search) {
      conditions.push(`LOWER(name) LIKE LOWER($${paramIndex++})`);
      params.push(`%${search}%`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await query(`SELECT COUNT(*) FROM cooperatives ${whereClause}`, params);
    const total = parseInt(countResult.rows[0].count);

    const result = await query(
      `SELECT c.*, 
              (SELECT COUNT(*) FROM users WHERE cooperative_id = c.id) as staff_count,
              (SELECT COUNT(*) FROM found_items WHERE cooperative_id = c.id) as items_count
       FROM cooperatives c
       ${whereClause}
       ORDER BY c.name ASC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...params, limit, offset]
    );

    res.json({
      success: true,
      data: result.rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (error) {
    console.error('Get cooperatives error:', error);
    res.status(500).json({ success: false, message: 'Failed to get cooperatives' });
  }
}

// Get single cooperative
export async function getCooperative(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT c.*, 
              (SELECT COUNT(*) FROM users WHERE cooperative_id = c.id) as staff_count,
              (SELECT COUNT(*) FROM found_items WHERE cooperative_id = c.id) as items_count,
              (SELECT COUNT(*) FROM found_items WHERE cooperative_id = c.id AND status = 'RETURNED') as returned_count
       FROM cooperatives c
       WHERE c.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Cooperative not found' });
      return;
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Get cooperative error:', error);
    res.status(500).json({ success: false, message: 'Failed to get cooperative' });
  }
}

// Create cooperative (admin only)
export async function createCooperative(req: Request, res: Response): Promise<void> {
  try {
    const { name, registration_number, contact_info, address } = req.body;

    // Check for duplicate registration number
    const existing = await query(
      'SELECT id FROM cooperatives WHERE registration_number = $1',
      [registration_number]
    );

    if (existing.rows.length > 0) {
      res.status(409).json({ success: false, message: 'Registration number already exists' });
      return;
    }

    const result = await query(
      `INSERT INTO cooperatives (name, registration_number, contact_info, address, status)
       VALUES ($1, $2, $3, $4, 'PENDING')
       RETURNING *`,
      [name, registration_number, contact_info, address || null]
    );

    await logCreate(req, 'cooperative', result.rows[0].id, { name, registration_number });

    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Cooperative created successfully'
    });
  } catch (error) {
    console.error('Create cooperative error:', error);
    res.status(500).json({ success: false, message: 'Failed to create cooperative' });
  }
}

// Update cooperative status (admin only)
export async function updateCooperativeStatus(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const existing = await query('SELECT * FROM cooperatives WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Cooperative not found' });
      return;
    }

    const result = await query(
      `UPDATE cooperatives SET status = $1, verified_by = $2, verified_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [status, req.user!.userId, id]
    );

    await logModeration(req, 'COOPERATIVE_STATUS_CHANGED', 'cooperative', parseInt(id), {
      old_status: existing.rows[0].status,
      new_status: status
    });

    res.json({
      success: true,
      data: result.rows[0],
      message: `Cooperative ${status.toLowerCase()}`
    });
  } catch (error) {
    console.error('Update cooperative status error:', error);
    res.status(500).json({ success: false, message: 'Failed to update cooperative status' });
  }
}

// Add staff to cooperative (admin only)
export async function addCooperativeStaff(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { email, password, name, phone } = req.body;

    // Check cooperative exists and is verified
    const coopResult = await query(
      `SELECT id, status FROM cooperatives WHERE id = $1`,
      [id]
    );

    if (coopResult.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Cooperative not found' });
      return;
    }

    if (coopResult.rows[0].status !== 'VERIFIED') {
      res.status(400).json({ success: false, message: 'Cooperative must be verified first' });
      return;
    }

    // Check email not taken
    const existingUser = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existingUser.rows.length > 0) {
      res.status(409).json({ success: false, message: 'Email already registered' });
      return;
    }

    // Create staff user
    const passwordHash = await hashPassword(password);
    const result = await query(
      `INSERT INTO users (email, password_hash, name, phone, role, cooperative_id, trust_score)
       VALUES ($1, $2, $3, $4, $5, $6, 5)
       RETURNING id, email, name, phone, role`,
      [email.toLowerCase(), passwordHash, name, phone || null, UserRole.COOP_STAFF, id]
    );

    await logCreate(req, 'user', result.rows[0].id, {
      email: result.rows[0].email,
      role: UserRole.COOP_STAFF,
      cooperative_id: id
    });

    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Staff member added successfully'
    });
  } catch (error) {
    console.error('Add cooperative staff error:', error);
    res.status(500).json({ success: false, message: 'Failed to add staff member' });
  }
}

// Get cooperative staff
export async function getCooperativeStaff(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT id, email, name, phone, trust_score, created_at
       FROM users
       WHERE cooperative_id = $1 AND role = 'coop_staff'
       ORDER BY name ASC`,
      [id]
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Get cooperative staff error:', error);
    res.status(500).json({ success: false, message: 'Failed to get staff' });
  }
}

// Get cooperative found items
export async function getCooperativeItems(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { page, limit, offset } = parsePaginationParams(
      req.query.page as string,
      req.query.limit as string
    );
    const { status } = req.query;

    let whereClause = 'WHERE f.cooperative_id = $1';
    const params: any[] = [id];

    if (status) {
      whereClause += ` AND f.status = $2`;
      params.push(status);
    }

    const countResult = await query(
      `SELECT COUNT(*) FROM found_items f ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    const paramOffset = params.length + 1;
    const result = await query(
      `SELECT f.*, u.name as finder_name
       FROM found_items f
       JOIN users u ON f.finder_id = u.id
       ${whereClause}
       ORDER BY f.created_at DESC
       LIMIT $${paramOffset} OFFSET $${paramOffset + 1}`,
      [...params, limit, offset]
    );

    res.json({
      success: true,
      data: result.rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (error) {
    console.error('Get cooperative items error:', error);
    res.status(500).json({ success: false, message: 'Failed to get items' });
  }
}

// Get cooperative dashboard (for coop staff)
export async function getCooperativeDashboard(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;

    // Get user's cooperative
    const userResult = await query(
      'SELECT cooperative_id FROM users WHERE id = $1',
      [userId]
    );

    if (!userResult.rows[0]?.cooperative_id) {
      res.status(403).json({ success: false, message: 'You are not assigned to a cooperative' });
      return;
    }

    const cooperativeId = userResult.rows[0].cooperative_id;

    const [coopInfo, itemStats, recentItems] = await Promise.all([
      query('SELECT * FROM cooperatives WHERE id = $1', [cooperativeId]),
      query(`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'UNCLAIMED') as unclaimed,
          COUNT(*) FILTER (WHERE status = 'MATCHED') as matched,
          COUNT(*) FILTER (WHERE status = 'RETURNED') as returned
        FROM found_items WHERE cooperative_id = $1
      `, [cooperativeId]),
      query(`
        SELECT f.*, u.name as finder_name
        FROM found_items f
        JOIN users u ON f.finder_id = u.id
        WHERE f.cooperative_id = $1
        ORDER BY f.created_at DESC
        LIMIT 10
      `, [cooperativeId])
    ]);

    res.json({
      success: true,
      data: {
        cooperative: coopInfo.rows[0],
        stats: itemStats.rows[0],
        recent_items: recentItems.rows
      }
    });
  } catch (error) {
    console.error('Get cooperative dashboard error:', error);
    res.status(500).json({ success: false, message: 'Failed to get dashboard' });
  }
}
