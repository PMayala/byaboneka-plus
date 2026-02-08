import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils';
import { UserRole, TokenPayload } from '../types';
import { query } from '../config/database';

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload & { trust_score?: number; is_banned?: boolean };
    }
  }
}

// ============================================
// AUTHENTICATION MIDDLEWARE
// ============================================

export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        message: 'Access token required'
      });
      return;
    }

    const token = authHeader.substring(7);
    const payload = verifyAccessToken(token);

    // Check if user is banned
    const userResult = await query(
      'SELECT trust_score, is_banned FROM users WHERE id = $1',
      [payload.userId]
    );

    if (userResult.rows.length === 0) {
      res.status(401).json({
        success: false,
        message: 'User not found'
      });
      return;
    }

    const user = userResult.rows[0];

    if (user.is_banned) {
      res.status(403).json({
        success: false,
        message: 'Account has been suspended'
      });
      return;
    }

    req.user = {
      ...payload,
      trust_score: user.trust_score,
      is_banned: user.is_banned
    };

    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      res.status(401).json({
        success: false,
        message: 'Access token expired'
      });
      return;
    }

    if (error.name === 'JsonWebTokenError') {
      res.status(401).json({
        success: false,
        message: 'Invalid access token'
      });
      return;
    }

    console.error('Authentication error:', error);
    res.status(500).json({
      success: false,
      message: 'Authentication failed'
    });
  }
}

// Optional authentication - doesn't fail if no token
export async function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const payload = verifyAccessToken(token);

      const userResult = await query(
        'SELECT trust_score, is_banned FROM users WHERE id = $1',
        [payload.userId]
      );

      if (userResult.rows.length > 0 && !userResult.rows[0].is_banned) {
        req.user = {
          ...payload,
          trust_score: userResult.rows[0].trust_score,
          is_banned: userResult.rows[0].is_banned
        };
      }
    }

    next();
  } catch (error) {
    // Silently continue without auth
    next();
  }
}

// ============================================
// AUTHORIZATION MIDDLEWARE
// ============================================

export function authorize(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: 'You do not have permission to perform this action'
      });
      return;
    }

    next();
  };
}

// Admin only
export const adminOnly = authorize(UserRole.ADMIN);

// Admin or cooperative staff
export const adminOrCoopStaff = authorize(UserRole.ADMIN, UserRole.COOP_STAFF);

// Cooperative staff only (for their own cooperative)
export async function coopStaffForCooperative(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
    return;
  }

  if (req.user.role === UserRole.ADMIN) {
    // Admins can access any cooperative
    next();
    return;
  }

  if (req.user.role !== UserRole.COOP_STAFF) {
    res.status(403).json({
      success: false,
      message: 'Only cooperative staff can perform this action'
    });
    return;
  }

  // Get cooperative ID from request (could be param or body)
  const cooperativeId = req.params.cooperativeId || req.body.cooperative_id;

  if (!cooperativeId) {
    res.status(400).json({
      success: false,
      message: 'Cooperative ID required'
    });
    return;
  }

  // Check if user belongs to this cooperative
  const result = await query(
    'SELECT cooperative_id FROM users WHERE id = $1',
    [req.user.userId]
  );

  if (result.rows.length === 0 || result.rows[0].cooperative_id !== parseInt(cooperativeId)) {
    res.status(403).json({
      success: false,
      message: 'You can only manage your own cooperative'
    });
    return;
  }

  next();
}

// Check if user owns the resource
export function ownerOrAdmin(resourceUserIdExtractor: (req: Request) => Promise<number | null>) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
      return;
    }

    // Admins can access anything
    if (req.user.role === UserRole.ADMIN) {
      next();
      return;
    }

    try {
      const resourceOwnerId = await resourceUserIdExtractor(req);

      if (resourceOwnerId === null) {
        res.status(404).json({
          success: false,
          message: 'Resource not found'
        });
        return;
      }

      if (resourceOwnerId !== req.user.userId) {
        res.status(403).json({
          success: false,
          message: 'You can only access your own resources'
        });
        return;
      }

      next();
    } catch (error) {
      console.error('Owner check error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to verify resource ownership'
      });
    }
  };
}
