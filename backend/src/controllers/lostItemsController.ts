import { Request, Response } from 'express';
import { query, transaction } from '../config/database';
import { extractKeywords, hashSecretAnswer, parsePaginationParams } from '../utils';
import { logCreate, logUpdate, logDelete } from '../services/auditService';
import { onItemCreated, findMatchesForLostItem } from '../services/matchingService';
import { ItemCategory, LostItemStatus } from '../types';

// ============================================
// LOST ITEMS CONTROLLER
// ============================================

// Create lost item report with verification secrets
export async function createLostItem(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const {
      category,
      title,
      description,
      location_area,
      location_hint,
      lost_date,
      photo_url,
      verification_questions
    } = req.body;

    // Extract keywords for matching
    const keywords = extractKeywords(`${title} ${description}`);

    // Create lost item and verification secrets in transaction
    const result = await transaction(async (client) => {
      // Create lost item
      const itemResult = await client.query(
        `INSERT INTO lost_items (user_id, category, title, description, location_area, location_hint, lost_date, keywords, photo_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [userId, category, title, description, location_area, location_hint || null, lost_date, keywords, photo_url || null]
      );

      const lostItem = itemResult.rows[0];

      // Hash verification answers
      const q1Answer = await hashSecretAnswer(verification_questions[0].answer);
      const q2Answer = await hashSecretAnswer(verification_questions[1].answer);
      const q3Answer = await hashSecretAnswer(verification_questions[2].answer);

      // Create verification secrets
      await client.query(
        `INSERT INTO verification_secrets (lost_item_id, 
          question_1_text, answer_1_hash, answer_1_salt,
          question_2_text, answer_2_hash, answer_2_salt,
          question_3_text, answer_3_hash, answer_3_salt)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          lostItem.id,
          verification_questions[0].question, q1Answer.hash, q1Answer.salt,
          verification_questions[1].question, q2Answer.hash, q2Answer.salt,
          verification_questions[2].question, q3Answer.hash, q3Answer.salt
        ]
      );

      return lostItem;
    });

    // Log creation
    await logCreate(req, 'lost_item', result.id, { title, category });

    // Trigger matching in background
    setImmediate(() => onItemCreated('lost', result.id));

    res.status(201).json({
      success: true,
      data: {
        id: result.id,
        category: result.category,
        title: result.title,
        description: result.description,
        location_area: result.location_area,
        location_hint: result.location_hint,
        lost_date: result.lost_date,
        status: result.status,
        photo_url: result.photo_url,
        created_at: result.created_at
      },
      message: 'Lost item report created successfully'
    });
  } catch (error) {
    console.error('Create lost item error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create lost item report'
    });
  }
}

// Get all lost items (public, with filters)
export async function getLostItems(req: Request, res: Response): Promise<void> {
  try {
    const { page, limit, offset } = parsePaginationParams(
      req.query.page as string,
      req.query.limit as string
    );

    const {
      category,
      location_area,
      date_from,
      date_to,
      keyword,
      status
    } = req.query;

    // Build query conditions
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    // Only show active items by default for public view
    if (status) {
      conditions.push(`l.status = $${paramIndex++}`);
      params.push(status);
    } else {
      conditions.push(`l.status = 'ACTIVE'`);
    }

    if (category) {
      conditions.push(`l.category = $${paramIndex++}`);
      params.push(category);
    }

    if (location_area) {
      conditions.push(`LOWER(l.location_area) LIKE LOWER($${paramIndex++})`);
      params.push(`%${location_area}%`);
    }

    if (date_from) {
      conditions.push(`l.lost_date >= $${paramIndex++}`);
      params.push(date_from);
    }

    if (date_to) {
      conditions.push(`l.lost_date <= $${paramIndex++}`);
      params.push(date_to);
    }

    if (keyword) {
      conditions.push(`(
        LOWER(l.title) LIKE LOWER($${paramIndex}) OR 
        LOWER(l.description) LIKE LOWER($${paramIndex}) OR
        $${paramIndex}::text = ANY(l.keywords)
      )`);
      params.push(`%${keyword}%`);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) FROM lost_items l ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    // Get items with user info
    const result = await query(
      `SELECT l.id, l.category, l.title, l.description, l.location_area, 
              l.location_hint, l.lost_date, l.status, l.photo_url, l.created_at,
              u.name as user_name
       FROM lost_items l
       JOIN users u ON l.user_id = u.id
       ${whereClause}
       ORDER BY l.created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...params, limit, offset]
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
    console.error('Get lost items error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get lost items'
    });
  }
}

// Get single lost item
export async function getLostItem(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT l.*, u.name as user_name, u.id as user_id
       FROM lost_items l
       JOIN users u ON l.user_id = u.id
       WHERE l.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Lost item not found'
      });
      return;
    }

    const item = result.rows[0];

    // If user is the owner, include verification questions (not answers)
    let verificationQuestions = null;
    if (req.user?.userId === item.user_id) {
      const secretsResult = await query(
        `SELECT question_1_text, question_2_text, question_3_text
         FROM verification_secrets WHERE lost_item_id = $1`,
        [id]
      );
      if (secretsResult.rows.length > 0) {
        verificationQuestions = [
          secretsResult.rows[0].question_1_text,
          secretsResult.rows[0].question_2_text,
          secretsResult.rows[0].question_3_text
        ];
      }
    }

    res.json({
      success: true,
      data: {
        ...item,
        verification_questions: verificationQuestions
      }
    });
  } catch (error) {
    console.error('Get lost item error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get lost item'
    });
  }
}

// Update lost item (owner only)
export async function updateLostItem(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;
    const { title, description, location_area, location_hint, photo_url } = req.body;

    // Check ownership
    const existing = await query(
      'SELECT * FROM lost_items WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (existing.rows.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Lost item not found or you do not have permission to update it'
      });
      return;
    }

    // Update keywords if title/description changed
    const newKeywords = (title || description)
      ? extractKeywords(`${title || existing.rows[0].title} ${description || existing.rows[0].description}`)
      : existing.rows[0].keywords;

    const result = await query(
      `UPDATE lost_items SET
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        location_area = COALESCE($3, location_area),
        location_hint = COALESCE($4, location_hint),
        photo_url = COALESCE($5, photo_url),
        keywords = $6
       WHERE id = $7
       RETURNING *`,
      [title, description, location_area, location_hint, photo_url, newKeywords, id]
    );

    // Log update
    await logUpdate(req, 'lost_item', parseInt(id), existing.rows[0], result.rows[0]);

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Lost item updated successfully'
    });
  } catch (error) {
    console.error('Update lost item error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update lost item'
    });
  }
}

// Delete lost item (owner only)
export async function deleteLostItem(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;

    // Check ownership and status
    const existing = await query(
      'SELECT * FROM lost_items WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (existing.rows.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Lost item not found or you do not have permission to delete it'
      });
      return;
    }

    // Don't allow deletion if there's an active claim
    const activeClaim = await query(
      `SELECT id FROM claims WHERE lost_item_id = $1 AND status IN ('PENDING', 'VERIFIED')`,
      [id]
    );

    if (activeClaim.rows.length > 0) {
      res.status(400).json({
        success: false,
        message: 'Cannot delete lost item with an active claim'
      });
      return;
    }

    // Delete (will cascade to verification_secrets)
    await query('DELETE FROM lost_items WHERE id = $1', [id]);

    // Log deletion
    await logDelete(req, 'lost_item', parseInt(id), existing.rows[0]);

    res.json({
      success: true,
      message: 'Lost item deleted successfully'
    });
  } catch (error) {
    console.error('Delete lost item error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete lost item'
    });
  }
}

// Get matches for a lost item
export async function getLostItemMatches(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    // Verify item exists
    const itemResult = await query(
      'SELECT id, user_id, status FROM lost_items WHERE id = $1',
      [id]
    );

    if (itemResult.rows.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Lost item not found'
      });
      return;
    }

    const item = itemResult.rows[0];

    // Only owner can view matches for their item
    if (req.user?.userId !== item.user_id && req.user?.role !== 'admin') {
      res.status(403).json({
        success: false,
        message: 'You can only view matches for your own lost items'
      });
      return;
    }

    // Get matches
    const matches = await findMatchesForLostItem(parseInt(id));

    res.json({
      success: true,
      data: matches.map(m => ({
        found_item: {
          id: m.found_item.id,
          category: m.found_item.category,
          title: m.found_item.title,
          description: m.found_item.description,
          location_area: m.found_item.location_area,
          found_date: m.found_item.found_date,
          image_urls: m.found_item.image_urls,
          source: m.found_item.source
        },
        score: m.score,
        explanation: m.explanation
      }))
    });
  } catch (error) {
    console.error('Get lost item matches error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get matches'
    });
  }
}

// Get user's own lost items
export async function getMyLostItems(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const { page, limit, offset } = parsePaginationParams(
      req.query.page as string,
      req.query.limit as string
    );

    const countResult = await query(
      'SELECT COUNT(*) FROM lost_items WHERE user_id = $1',
      [userId]
    );
    const total = parseInt(countResult.rows[0].count);

    const result = await query(
      `SELECT l.*, 
              (SELECT COUNT(*) FROM matches m WHERE m.lost_item_id = l.id) as match_count,
              (SELECT COUNT(*) FROM claims c WHERE c.lost_item_id = l.id AND c.status = 'VERIFIED') as claim_count
       FROM lost_items l
       WHERE l.user_id = $1
       ORDER BY l.created_at DESC
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
    console.error('Get my lost items error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get your lost items'
    });
  }
}
