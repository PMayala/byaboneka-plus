import { Router, Request, Response } from 'express';
import { authenticate, adminOnly, authorize } from '../middleware/auth';
import { query } from '../config/database';
import { UserRole } from '../types';
import { fraudCheck } from '../services/fraudDetectionService';
import { getFlaggedUsers } from '../services/fraudDetectionService';
import {
  analyzeVerificationStrength,
  getTemplatesForCategory,
  QUESTION_TEMPLATES
} from '../services/verificationStrengthService';
import { redactSensitiveContent } from '../services/sensitiveRedactionService';
import {
  recommendHandoverLocations,
  SAFE_HANDOVER_POINTS
} from '../services/cooperativeAccountabilityService';

import { getTrustScoreExplanation } from '../services/trustTransparencyService';

const router = Router();

// ======================================================
// 1) TRUST TRANSPARENCY ENDPOINT
// ======================================================

/**
 * GET /api/v1/trust/transparency
 * Returns: explanation of *my* trust score (events + rules + permissions)
 */
router.get('/trust/transparency',
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.userId;
      const explanation = await getTrustScoreExplanation(userId);
      res.json({ success: true, data: explanation });
    } catch (error) {
      console.error('Trust transparency error:', error);
      res.status(500).json({ success: false, message: 'Failed to load trust transparency data' });
    }
  }
);

/**
 * (Optional, Admin) GET /api/v1/trust/transparency/:userId
 * Lets admins view an explanation for any user (useful for disputes/support).
 */
router.get('/trust/transparency/:userId',
  authenticate,
  adminOnly,
  async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.userId);
      if (!Number.isFinite(userId)) {
        res.status(400).json({ success: false, message: 'Invalid userId' });
        return;
      }
      const explanation = await getTrustScoreExplanation(userId);
      res.json({ success: true, data: explanation });
    } catch (error) {
      console.error('Admin trust transparency error:', error);
      res.status(500).json({ success: false, message: 'Failed to load trust transparency data' });
    }
  }
);

// ======================================================
// 2) COOPERATIVE STAFF AUDIT ENDPOINT
// ======================================================
// Reads from VIEW: cooperative_staff_audit (created in migration 005)

/**
 * GET /api/v1/cooperatives/staff-audit
 * Access:
 *  - admin: can see all cooperatives
 *  - coop_staff: can see only their cooperative
 *
 * Query params:
 *  - cooperative_id (admin only, optional)
 *  - page, limit
 *  - sort = trust_score | items_returned | total_items_handled | handovers_confirmed | avg_return_hours
 *  - order = asc | desc
 */
router.get('/cooperatives/staff-audit',
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const role = req.user!.role;
      const myUserId = req.user!.userId;

      // Pagination
      const page = Math.max(1, parseInt(String(req.query.page || '1')) || 1);
      const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || '20')) || 20));
      const offset = (page - 1) * limit;

      // Sorting whitelist
      const sortRaw = String(req.query.sort || 'items_returned');
      const orderRaw = String(req.query.order || 'desc').toLowerCase();
      const order = orderRaw === 'asc' ? 'ASC' : 'DESC';

      const SORT_MAP: Record<string, string> = {
        trust_score: 'trust_score',
        items_returned: 'items_returned',
        total_items_handled: 'total_items_handled',
        handovers_confirmed: 'handovers_confirmed',
        avg_return_hours: 'avg_return_hours',
      };

      const sortCol = SORT_MAP[sortRaw] || 'items_returned';

      // Determine cooperative scope
      let cooperativeId: number | null = null;

      if (role === UserRole.COOP_STAFF) {
        const r = await query('SELECT cooperative_id FROM users WHERE id = $1', [myUserId]);
        cooperativeId = r.rows[0]?.cooperative_id ?? null;

        if (!cooperativeId) {
          res.status(400).json({ success: false, message: 'No cooperative linked to this staff account' });
          return;
        }
      } else if (role === UserRole.ADMIN) {
        if (req.query.cooperative_id) {
          const cid = parseInt(String(req.query.cooperative_id));
          if (Number.isFinite(cid)) cooperativeId = cid;
        }
      } else {
        res.status(403).json({ success: false, message: 'Not authorized' });
        return;
      }

      // Build WHERE
      const conditions: string[] = [];
      const params: any[] = [];
      let i = 1;

      if (cooperativeId) {
        conditions.push(`cooperative_id = $${i++}`);
        params.push(cooperativeId);
      }

      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

      // Total count
      const countRes = await query(
        `SELECT COUNT(*) FROM cooperative_staff_audit ${where}`,
        params
      );
      const total = parseInt(countRes.rows[0].count || '0', 10);

      // Data
      const dataRes = await query(
        `
        SELECT
          staff_id,
          staff_name,
          cooperative_id,
          cooperative_name,
          items_returned,
          total_items_handled,
          handovers_confirmed,
          avg_return_hours,
          trust_score
        FROM cooperative_staff_audit
        ${where}
        ORDER BY ${sortCol} ${order} NULLS LAST
        LIMIT $${i++} OFFSET $${i++}
        `,
        [...params, limit, offset]
      );

      res.json({
        success: true,
        data: dataRes.rows,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        },
        meta: {
          scope: cooperativeId ? { cooperative_id: cooperativeId } : { scope: 'all_cooperatives' },
          sort: { by: sortCol, order }
        }
      });
    } catch (error) {
      console.error('Cooperative staff audit error:', error);
      res.status(500).json({ success: false, message: 'Failed to load cooperative staff audit' });
    }
  }
);

// Admin fraud flagged users
router.get('/admin/fraud/flagged-users',
  authenticate,
  adminOnly,
  async (req: Request, res: Response) => {
    try {
      const flaggedUsers = await getFlaggedUsers();
      res.json({ success: true, data: flaggedUsers });
    } catch (error) {
      console.error('Failed to get flagged users:', error);
      res.status(500).json({ success: false, message: 'Failed to retrieve flagged users' });
    }
  }
);

// Verification strength analysis
router.post('/verification/analyze-strength',
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const { questions, answers, category, description } = req.body;

      if (!questions || !answers || !category) {
        res.status(400).json({
          success: false,
          message: 'questions, answers, and category are required'
        });
        return;
      }

      const analysis = analyzeVerificationStrength(
        questions,
        answers,
        category,
        description || ''
      );

      res.json({ success: true, data: analysis });
    } catch (error) {
      console.error('Verification strength analysis error:', error);
      res.status(500).json({ success: false, message: 'Analysis failed' });
    }
  }
);

router.get('/verification/templates/:category',
  authenticate,
  async (req: Request, res: Response) => {
    const { category } = req.params;
    const templates = getTemplatesForCategory(category);
    res.json({ success: true, data: templates });
  }
);

router.get('/verification/templates',
  authenticate,
  async (req: Request, res: Response) => {
    res.json({ success: true, data: QUESTION_TEMPLATES });
  }
);

// Redaction preview
router.post('/privacy/preview-redaction',
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const { text, category } = req.body;

      if (!text) {
        res.status(400).json({ success: false, message: 'text is required' });
        return;
      }

      const result = redactSensitiveContent(text, category, false);
      res.json({ success: true, data: result });
    } catch (error) {
      console.error('Redaction preview error:', error);
      res.status(500).json({ success: false, message: 'Redaction failed' });
    }
  }
);

// Safe locations
router.get('/handover/recommended-locations',
  authenticate,
  async (req: Request, res: Response) => {
    const { area, category } = req.query;

    // If no area provided, return all safe locations as fallback instead of 400
    if (!area || (typeof area === 'string' && area.trim() === '')) {
      try {
        const allLocations = await query(
          `SELECT * FROM safe_handover_locations ORDER BY safety_rating DESC LIMIT 10`
        );
        res.json({
          success: true,
          data: allLocations.rows,
          meta: {
            search_area: 'all',
            category: category || 'OTHER',
            safety_note:
              'Always meet at the recommended location during operating hours. For sensitive items (ID, wallet, phone), cooperative offices and sector offices are strongly recommended.'
          }
        });
      } catch {
        // If safe_handover_locations table doesn't exist, use the function with a default area
        const recommendations = recommendHandoverLocations(
          'Kigali',
          (category as string) || 'OTHER'
        );
        res.json({
          success: true,
          data: recommendations,
          meta: {
            search_area: 'Kigali',
            category: category || 'OTHER',
            safety_note:
              'Always meet at the recommended location during operating hours.'
          }
        });
      }
      return;
    }

    const recommendations = recommendHandoverLocations(
      area as string,
      (category as string) || 'OTHER'
    );

    res.json({
      success: true,
      data: recommendations,
      meta: {
        search_area: area,
        category: category || 'OTHER',
        safety_note:
          'Always meet at the recommended location during operating hours. For sensitive items (ID, wallet, phone), cooperative offices and sector offices are strongly recommended.'
      }
    });
  }
);

export default router;