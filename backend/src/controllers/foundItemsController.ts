import { Request, Response } from 'express';
import { query } from '../config/database';
import { extractKeywords, parsePaginationParams } from '../utils';
import { logCreate, logUpdate, logDelete } from '../services/auditService';
import { onItemCreated, findMatchesForFoundItem } from '../services/matchingService';
import { ItemCategory, FoundItemStatus, ItemSource, UserRole } from '../types';
import { redactSensitiveContent, redactItemList } from '../services/sensitiveRedactionService';

// ============================================
// FOUND ITEMS CONTROLLER
// ============================================

// Create found item report
export async function createFoundItem(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const {
      category,
      subcategory,
      title,
      description,
      location_area,
      location_hint,
      found_date,
      cooperative_id
    } = req.body;

    // Determine source
    let source = ItemSource.CITIZEN;
    let coopId = null;

    if (req.user!.role === UserRole.COOP_STAFF && cooperative_id) {
      const userResult = await query(
        'SELECT cooperative_id FROM users WHERE id = $1',
        [userId]
      );

      if (userResult.rows[0]?.cooperative_id === cooperative_id) {
        source = ItemSource.COOPERATIVE;
        coopId = cooperative_id;
      }
    }

    const keywords = extractKeywords(`${title} ${description}`);

    const result = await query(
      `INSERT INTO found_items (finder_id, cooperative_id, category, subcategory, title, description, 
        location_area, location_hint, found_date, source, keywords, image_urls)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [userId, coopId, category, subcategory || null, title, description, location_area,
       location_hint || null, found_date, source, keywords, []]
    );

    const foundItem = result.rows[0];
    await logCreate(req, 'found_item', foundItem.id, { title, category, source });
    setImmediate(() => onItemCreated('found', foundItem.id));

    res.status(201).json({
      success: true,
      data: foundItem,
      message: 'Found item report created successfully'
    });
  } catch (error) {
    console.error('Create found item error:', error);
    res.status(500).json({ success: false, message: 'Failed to create found item report' });
  }
}

// Get all found items (public, with filters)
export async function getFoundItems(req: Request, res: Response): Promise<void> {
  try {
    const { page, limit, offset } = parsePaginationParams(
      req.query.page as string,
      req.query.limit as string
    );

    const { category, location_area, date_from, date_to, keyword, status } = req.query;

    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (status) {
      conditions.push(`f.status = $${paramIndex++}`);
      params.push(status);
    } else {
      conditions.push(`f.status = 'UNCLAIMED'`);
    }

    if (category) {
      conditions.push(`f.category = $${paramIndex++}`);
      params.push(category);
    }

    if (location_area) {
      conditions.push(`LOWER(f.location_area) LIKE LOWER($${paramIndex++})`);
      params.push(`%${location_area}%`);
    }

    if (date_from) {
      conditions.push(`f.found_date >= $${paramIndex++}`);
      params.push(date_from);
    }

    if (date_to) {
      conditions.push(`f.found_date <= $${paramIndex++}`);
      params.push(date_to);
    }

    if (keyword) {
      conditions.push(
        `(LOWER(f.title) LIKE LOWER($${paramIndex}) OR LOWER(f.description) LIKE LOWER($${paramIndex}))`
      );
      params.push(`%${keyword}%`);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await query(`SELECT COUNT(*) FROM found_items f ${whereClause}`, params);
    const total = parseInt(countResult.rows[0].count);

    const result = await query(
      `SELECT f.id, f.category, f.subcategory, f.title, f.description,
              f.location_area, f.found_date, f.status, f.source,
              f.image_urls, f.finder_id,
              f.created_at, u.name as finder_name, c.name as cooperative_name
       FROM found_items f
       JOIN users u ON f.finder_id = u.id
       LEFT JOIN cooperatives c ON f.cooperative_id = c.id
       ${whereClause}
       ORDER BY f.created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...params, limit, offset]
    );

    const userId = req.user?.userId;
    const redactedItems = redactItemList(result.rows, userId);
    for (const item of redactedItems) {
      const canSeeImages =
        (userId !== undefined && item.finder_id === userId) ||
        req.user?.role === 'coop_staff' ||
        req.user?.role === 'admin';

      if (!canSeeImages) {
        item.image_urls = [];
      }
    }

    res.json({
      success: true,
      data: redactedItems,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get found items error:', error);
    res.status(500).json({ success: false, message: 'Failed to get found items' });
  }
}

export async function getFoundItem(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT f.*, u.name as finder_name, c.name as cooperative_name
       FROM found_items f
       JOIN users u ON f.finder_id = u.id
       LEFT JOIN cooperatives c ON f.cooperative_id = c.id
       WHERE f.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Found item not found' });
      return;
    }

    const item = result.rows[0];
    const userId = req.user?.userId;

    const isOwner = userId === item.finder_id;

    const canSeeImages =
      userId === item.finder_id ||
      req.user?.role === 'coop_staff' ||
      req.user?.role === 'admin';

    if (!isOwner) {
      // Redact sensitive patterns in description
      const descResult = redactSensitiveContent(item.description, item.category, false);
      item.description = descResult.redacted_text;

      // Redact sensitive patterns in title
      const titleResult = redactSensitiveContent(item.title, item.category, false);
      item.title = titleResult.redacted_text;

      // Add privacy notice if redactions were applied
      if (descResult.redactions_applied.length > 0 || titleResult.redactions_applied.length > 0) {
        item._privacy_notice =
          'Some sensitive information has been redacted for privacy protection. Full details visible after ownership verification.';
        item._redaction_count =
          descResult.redactions_applied.length + titleResult.redactions_applied.length;
      }
    }

    if (!canSeeImages) {
      item.image_urls = [];
      item._images_hidden = true;
      item._images_note = 'Images are hidden for privacy. Verify ownership to see full details.';
    }

    res.json({ success: true, data: item });
  } catch (error) {
    console.error('Get found item error:', error);
    res.status(500).json({ success: false, message: 'Failed to get found item' });
  }
}

// Update found item (owner only)
export async function updateFoundItem(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;
    const { title, description, location_area, location_hint, subcategory } = req.body;

    const existing = await query(
      'SELECT * FROM found_items WHERE id = $1 AND finder_id = $2',
      [id, userId]
    );

    if (existing.rows.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Found item not found or you do not have permission to update it'
      });
      return;
    }

    const newKeywords = (title || description)
      ? extractKeywords(`${title || existing.rows[0].title} ${description || existing.rows[0].description}`)
      : existing.rows[0].keywords;

    const result = await query(
      `UPDATE found_items SET
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        location_area = COALESCE($3, location_area),
        location_hint = COALESCE($4, location_hint),
        subcategory = COALESCE($5, subcategory),
        keywords = $6,
        updated_at = NOW()
      WHERE id = $7
      RETURNING *`,
      [title, description, location_area, location_hint, subcategory, newKeywords, id]
    );

    await logUpdate(req, 'found_item', parseInt(id), existing.rows[0], result.rows[0]);

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Found item updated successfully'
    });
  } catch (error) {
    console.error('Update found item error:', error);
    res.status(500).json({ success: false, message: 'Failed to update found item' });
  }
}

// Delete found item (owner only)
export async function deleteFoundItem(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;

    const existing = await query(
      'SELECT * FROM found_items WHERE id = $1 AND finder_id = $2',
      [id, userId]
    );

    if (existing.rows.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Found item not found or you do not have permission to delete it'
      });
      return;
    }

    // Don't allow deletion if there's an active claim
    const activeClaim = await query(
      `SELECT id FROM claims WHERE found_item_id = $1 AND status IN ('PENDING', 'PENDING_QUESTIONS', 'VERIFIED')`,
      [id]
    );

    if (activeClaim.rows.length > 0) {
      res.status(400).json({
        success: false,
        message: 'Cannot delete found item with an active claim. Cancel or resolve the claim first.'
      });
      return;
    }

    // Clean up terminal claims and matches before delete
    try { await query(`DELETE FROM claims WHERE found_item_id = $1 AND status IN ('CANCELLED','REJECTED','EXPIRED')`, [id]); } catch (e) {}
    try { await query('DELETE FROM matches WHERE found_item_id = $1', [id]); } catch (e) {}

    await query('DELETE FROM found_items WHERE id = $1', [id]);
    await logDelete(req, 'found_item', parseInt(id), existing.rows[0]);

    res.json({ success: true, message: 'Found item deleted successfully' });
  } catch (error) {
    console.error('Delete found item error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete found item' });
  }
}

// Upload images for found item
export async function uploadFoundItemImages(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;

    const existing = await query(
      'SELECT * FROM found_items WHERE id = $1 AND finder_id = $2',
      [id, userId]
    );

    if (existing.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Found item not found or no permission' });
      return;
    }

    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      res.status(400).json({ success: false, message: 'No images uploaded' });
      return;
    }

    const newImageUrls = (req.files as Express.Multer.File[]).map(file => `/uploads/${file.filename}`);
    const currentImages = existing.rows[0].image_urls || [];
    const allImages = [...currentImages, ...newImageUrls].slice(0, 5);

    const result = await query(
      'UPDATE found_items SET image_urls = $1 WHERE id = $2 RETURNING *',
      [allImages, id]
    );

    res.json({ success: true, data: result.rows[0], message: 'Images uploaded successfully' });
  } catch (error) {
    console.error('Upload found item images error:', error);
    res.status(500).json({ success: false, message: 'Failed to upload images' });
  }
}

// Get matches for a found item
export async function getFoundItemMatches(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const itemResult = await query(
      'SELECT id, finder_id, status FROM found_items WHERE id = $1',
      [id]
    );

    if (itemResult.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Found item not found' });
      return;
    }

    const item = itemResult.rows[0];

    // Only finder can view matches for their item
    if (req.user?.userId !== item.finder_id && req.user?.role !== 'admin') {
      res.status(403).json({
        success: false,
        message: 'You can only view matches for your own found items'
      });
      return;
    }

    const matches = await findMatchesForFoundItem(parseInt(id));

    res.json({
      success: true,
      data: matches.map(m => ({
        lost_item: {
          id: m.lost_item.id,
          category: m.lost_item.category,
          title: m.lost_item.title,
          description: m.lost_item.description,
          location_area: m.lost_item.location_area,
          lost_date: m.lost_item.lost_date,
        },
        score: m.score,
        explanation: m.explanation
      }))
    });
  } catch (error) {
    console.error('Get found item matches error:', error);
    res.status(500).json({ success: false, message: 'Failed to get matches' });
  }
}

// Get user's own found items
export async function getMyFoundItems(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const { page, limit, offset } = parsePaginationParams(
      req.query.page as string,
      req.query.limit as string
    );

    const countResult = await query(
      'SELECT COUNT(*) FROM found_items WHERE finder_id = $1',
      [userId]
    );
    const total = parseInt(countResult.rows[0].count);

    const result = await query(
      `SELECT f.*,
              (SELECT COUNT(*) FROM claims c WHERE c.found_item_id = f.id AND c.status = 'VERIFIED') as claim_count
       FROM found_items f
       WHERE f.finder_id = $1
       ORDER BY f.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get my found items error:', error);
    res.status(500).json({ success: false, message: 'Failed to get your found items' });
  }
}