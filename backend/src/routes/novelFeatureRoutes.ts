import { Router, Request, Response } from 'express';
import { authenticate, adminOnly } from '../middleware/auth';
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

const router = Router();

// ============================================
// FRAUD DETECTION ROUTES (Admin)
// ============================================

/**
 * GET /api/v1/admin/fraud/flagged-users
 * Returns users with high-risk fraud assessments in the last 7 days
 */
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

// ============================================
// VERIFICATION STRENGTH ROUTES
// ============================================

/**
 * POST /api/v1/verification/analyze-strength
 * Analyze the quality of verification questions before saving them
 * 
 * Body: { questions: string[], answers: string[], category: string, description: string }
 */
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

/**
 * GET /api/v1/verification/templates/:category
 * Get category-specific question templates
 */
router.get('/verification/templates/:category',
  authenticate,
  async (req: Request, res: Response) => {
    const { category } = req.params;
    const templates = getTemplatesForCategory(category);
    res.json({ success: true, data: templates });
  }
);

/**
 * GET /api/v1/verification/templates
 * Get all question templates grouped by category
 */
router.get('/verification/templates',
  authenticate,
  async (req: Request, res: Response) => {
    res.json({ success: true, data: QUESTION_TEMPLATES });
  }
);

// ============================================
// SENSITIVE CONTENT REDACTION ROUTES
// ============================================

/**
 * POST /api/v1/privacy/preview-redaction
 * Preview what a description would look like after redaction
 * (Useful for testing during development and for admin review)
 */
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

// ============================================
// COOPERATIVE ACCOUNTABILITY ROUTES
// ============================================
// NOTE: /cooperatives/leaderboard and /cooperatives/:id/accountability
// are now defined in routes/index.ts to avoid route ordering conflicts
// with /cooperatives/:id.

// ============================================
// SAFE HANDOVER LOCATION ROUTES
// ============================================

/**
 * GET /api/v1/handover/safe-locations
 * Get all safe handover locations
 */
router.get('/handover/safe-locations',
  authenticate,
  async (req: Request, res: Response) => {
    res.json({ success: true, data: SAFE_HANDOVER_POINTS });
  }
);

/**
 * GET /api/v1/handover/recommended-locations
 * Get recommended handover locations based on item area and category
 * 
 * Query: ?area=Kimironko&category=PHONE
 */
router.get('/handover/recommended-locations',
  authenticate,
  async (req: Request, res: Response) => {
    const { area, category } = req.query;

    if (!area) {
      res.status(400).json({ success: false, message: 'area query parameter is required' });
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
        safety_note: 'Always meet at the recommended location during operating hours. For sensitive items (ID, wallet, phone), cooperative offices and sector offices are strongly recommended.'
      }
    });
  }
);

export default router;