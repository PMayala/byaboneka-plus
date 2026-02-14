import { Request, Response } from 'express';
import { query, transaction } from '../config/database';
import {
  hashPassword,
  verifyPassword,
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  hashToken,
  generateUUID
} from '../utils';
import { UserRole, TokenPayload } from '../types';
import { logLogin, logAudit, extractRequestMeta } from '../services/auditService';

// ============================================
// AUTHENTICATION CONTROLLER
// ============================================

// Register new user
export async function register(req: Request, res: Response): Promise<void> {
  try {
    const { email, password, name, phone } = req.body;

    // Check if email already exists
    const existingUser = await query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (existingUser.rows.length > 0) {
      res.status(409).json({
        success: false,
        message: 'Email is already registered'
      });
      return;
    }

    // Check if phone already exists (if provided)
    if (phone) {
      const existingPhone = await query(
        'SELECT id FROM users WHERE phone = $1',
        [phone]
      );

      if (existingPhone.rows.length > 0) {
        res.status(409).json({
          success: false,
          message: 'Phone number is already registered'
        });
        return;
      }
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const result = await query(
      `INSERT INTO users (email, password_hash, name, phone, role, trust_score)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, email, name, phone, role, trust_score, email_verified, phone_verified, created_at`,
      [email.toLowerCase(), passwordHash, name, phone || null, UserRole.CITIZEN, 0]
    );

    const user = result.rows[0];

    // Generate tokens
    const tokenPayload: TokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role
    };

    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    // Store refresh token
    await query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '7 days')`,
      [user.id, hashToken(refreshToken)]
    );

    // Log the registration
    const { ipAddress, userAgent } = extractRequestMeta(req);
    await logAudit({
      actorId: user.id,
      action: 'CREATE',
      resourceType: 'user',
      resourceId: user.id,
      changes: { email: user.email, name: user.name },
      ipAddress,
      userAgent
    });

    // FIX #5: Include email_verified and phone_verified in response
    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          phone: user.phone,
          role: user.role,
          trust_score: user.trust_score,
          email_verified: user.email_verified || false,
          phone_verified: user.phone_verified || false,
          created_at: user.created_at
        },
        tokens: {
          accessToken,
          refreshToken
        }
      },
      message: 'Registration successful'
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Registration failed'
    });
  }
}

// Login
export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body;

    // FIX #5 & #17: Include email_verified, phone_verified, cooperative fields in login query
    const result = await query(
      `SELECT u.id, u.email, u.password_hash, u.name, u.phone, u.role, u.trust_score,
              u.is_banned, u.ban_reason, u.email_verified, u.phone_verified,
              u.cooperative_id, c.name as cooperative_name, u.created_at
       FROM users u
       LEFT JOIN cooperatives c ON u.cooperative_id = c.id
       WHERE u.email = $1`,
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
      return;
    }

    const user = result.rows[0];

    // Check if banned
    if (user.is_banned) {
      res.status(403).json({
        success: false,
        message: 'Account has been suspended',
        reason: user.ban_reason
      });
      return;
    }

    // Verify password
    const isValidPassword = await verifyPassword(password, user.password_hash);

    if (!isValidPassword) {
      res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
      return;
    }

    // Generate tokens
    const tokenPayload: TokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role
    };

    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    // Store refresh token
    await query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '7 days')`,
      [user.id, hashToken(refreshToken)]
    );

    // Log login
    await logLogin(req, user.id);

    // FIX #5 & #17: Include all fields frontend expects
    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          phone: user.phone,
          role: user.role,
          trust_score: user.trust_score,
          email_verified: user.email_verified || false,
          phone_verified: user.phone_verified || false,
          cooperative_id: user.cooperative_id || undefined,
          cooperative_name: user.cooperative_name || undefined,
          created_at: user.created_at
        },
        tokens: {
          accessToken,
          refreshToken
        }
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed'
    });
  }
}

// Refresh token
export async function refreshToken(req: Request, res: Response): Promise<void> {
  try {
    const { refreshToken: token } = req.body;

    // Verify token
    let payload: TokenPayload;
    try {
      payload = verifyRefreshToken(token);
    } catch (error) {
      res.status(401).json({
        success: false,
        message: 'Invalid refresh token'
      });
      return;
    }

    // Check if token exists in database and is not revoked
    const tokenHash = hashToken(token);
    const result = await query(
      `SELECT id FROM refresh_tokens
       WHERE user_id = $1 AND token_hash = $2 AND revoked_at IS NULL AND expires_at > NOW()`,
      [payload.userId, tokenHash]
    );

    if (result.rows.length === 0) {
      res.status(401).json({
        success: false,
        message: 'Refresh token has been revoked or expired'
      });
      return;
    }

    // Get current user data
    const userResult = await query(
      'SELECT id, email, role, is_banned FROM users WHERE id = $1',
      [payload.userId]
    );

    if (userResult.rows.length === 0 || userResult.rows[0].is_banned) {
      res.status(401).json({
        success: false,
        message: 'User not found or account suspended'
      });
      return;
    }

    const user = userResult.rows[0];

    // Generate new tokens
    const newPayload: TokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role
    };

    const newAccessToken = generateAccessToken(newPayload);
    const newRefreshToken = generateRefreshToken(newPayload);

    // Revoke old refresh token and create new one
    await transaction(async (client) => {
      await client.query(
        'UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1',
        [tokenHash]
      );
      await client.query(
        `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
         VALUES ($1, $2, NOW() + INTERVAL '7 days')`,
        [user.id, hashToken(newRefreshToken)]
      );
    });

    res.json({
      success: true,
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken
      }
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({
      success: false,
      message: 'Token refresh failed'
    });
  }
}

// Logout
export async function logout(req: Request, res: Response): Promise<void> {
  try {
    const { refreshToken: token } = req.body;

    if (token) {
      // Revoke refresh token
      await query(
        'UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1',
        [hashToken(token)]
      );
    }

    // Log logout
    if (req.user) {
      const { ipAddress, userAgent } = extractRequestMeta(req);
      await logAudit({
        actorId: req.user.userId,
        action: 'LOGOUT',
        resourceType: 'user',
        resourceId: req.user.userId,
        ipAddress,
        userAgent
      });
    }

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Logout failed'
    });
  }
}

// Request password reset
export async function forgotPassword(req: Request, res: Response): Promise<void> {
  try {
    const { email } = req.body;

    // Find user
    const result = await query(
      'SELECT id, email, name FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    // Always return success to prevent email enumeration
    if (result.rows.length === 0) {
      res.json({
        success: true,
        message: 'If the email exists, a password reset link has been sent'
      });
      return;
    }

    const user = result.rows[0];

    // Generate reset token
    const resetToken = generateUUID();
    const tokenHash = hashToken(resetToken);

    // Store token (valid for 1 hour)
    await query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '1 hour')`,
      [user.id, tokenHash]
    );

    // TODO: Send email with reset link
    // For MVP, we'll just log it
    console.log(`Password reset token for ${user.email}: ${resetToken}`);

    res.json({
      success: true,
      message: 'If the email exists, a password reset link has been sent',
      // In development, include token for testing
      ...(process.env.NODE_ENV === 'development' && { resetToken })
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Password reset request failed'
    });
  }
}

// Reset password with token
export async function resetPassword(req: Request, res: Response): Promise<void> {
  try {
    const { token, password } = req.body;

    // Find valid token
    const tokenHash = hashToken(token);
    const result = await query(
      `SELECT user_id FROM password_reset_tokens
       WHERE token_hash = $1 AND expires_at > NOW() AND used_at IS NULL`,
      [tokenHash]
    );

    if (result.rows.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token'
      });
      return;
    }

    const userId = result.rows[0].user_id;

    // Hash new password
    const passwordHash = await hashPassword(password);

    // Update password and mark token as used
    await transaction(async (client) => {
      await client.query(
        'UPDATE users SET password_hash = $1 WHERE id = $2',
        [passwordHash, userId]
      );
      await client.query(
        'UPDATE password_reset_tokens SET used_at = NOW() WHERE token_hash = $1',
        [tokenHash]
      );
      // Revoke all refresh tokens for this user
      await client.query(
        'UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1',
        [userId]
      );
    });

    // Log the password reset
    const { ipAddress, userAgent } = extractRequestMeta(req);
    await logAudit({
      actorId: userId,
      action: 'UPDATE',
      resourceType: 'user',
      resourceId: userId,
      changes: { action: 'password_reset' },
      ipAddress,
      userAgent
    });

    res.json({
      success: true,
      message: 'Password has been reset successfully'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Password reset failed'
    });
  }
}

// Get current user profile
export async function getProfile(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;

    const result = await query(
      `SELECT u.id, u.email, u.name, u.phone, u.role, u.trust_score, 
              u.email_verified, u.phone_verified, u.created_at,
              c.name as cooperative_name, c.id as cooperative_id
       FROM users u
       LEFT JOIN cooperatives c ON u.cooperative_id = c.id
       WHERE u.id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        success: false,
        message: 'User not found'
      });
      return;
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get profile'
    });
  }
}

// Update profile
export async function updateProfile(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const { name, phone } = req.body;

    // Check if phone is already used by another user
    if (phone) {
      const existingPhone = await query(
        'SELECT id FROM users WHERE phone = $1 AND id != $2',
        [phone, userId]
      );

      if (existingPhone.rows.length > 0) {
        res.status(409).json({
          success: false,
          message: 'Phone number is already in use'
        });
        return;
      }
    }

    // FIX: Return all fields the frontend needs
    const result = await query(
      `UPDATE users SET name = COALESCE($1, name), phone = COALESCE($2, phone)
       WHERE id = $3
       RETURNING id, email, name, phone, role, trust_score, email_verified, phone_verified, created_at`,
      [name, phone, userId]
    );

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Profile updated successfully'
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile'
    });
  }
}

// Change password (for logged-in users)
export async function changePassword(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const { currentPassword, newPassword } = req.body;

    // Validate input
    if (!currentPassword || !newPassword) {
      res.status(400).json({
        success: false,
        message: 'Current password and new password are required'
      });
      return;
    }

    if (newPassword.length < 8) {
      res.status(400).json({
        success: false,
        message: 'New password must be at least 8 characters long'
      });
      return;
    }

    // Get current password hash
    const userResult = await query(
      'SELECT password_hash FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      res.status(404).json({
        success: false,
        message: 'User not found'
      });
      return;
    }

    // Verify current password
    const isValidPassword = await verifyPassword(currentPassword, userResult.rows[0].password_hash);

    if (!isValidPassword) {
      res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
      return;
    }

    // Hash new password
    const newPasswordHash = await hashPassword(newPassword);

    // Update password
    await query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [newPasswordHash, userId]
    );

    // Revoke all refresh tokens except current one (optional security measure)
    await query(
      'UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL',
      [userId]
    );

    // Log the password change
    const { ipAddress, userAgent } = extractRequestMeta(req);
    await logAudit({
      actorId: userId,
      action: 'UPDATE',
      resourceType: 'user',
      resourceId: userId,
      changes: { action: 'password_change' },
      ipAddress,
      userAgent
    });

    res.json({
      success: true,
      message: 'Password changed successfully. Please log in again.'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to change password'
    });
  }
}