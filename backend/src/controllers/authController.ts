import { Request, Response } from 'express';
import { query, transaction } from '../config/database';
import {
  hashPassword,
  verifyPassword,
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  hashToken,
  generateUUID,
  generateTokenFamily
} from '../utils';
import { UserRole, TokenPayload } from '../types';
import { logLogin, logAudit, extractRequestMeta } from '../services/auditService';
import { sendWelcomeEmail, sendPasswordResetEmail } from '../services/emailService';
import { checkAccountLockout, recordFailedLogin, resetFailedLogins } from '../services/accountLockoutService';

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
        message: 'An account with this email already exists'
      });
      return;
    }

    // Check phone uniqueness if provided
    if (phone) {
      const existingPhone = await query(
        'SELECT id FROM users WHERE phone = $1',
        [phone]
      );
      if (existingPhone.rows.length > 0) {
        res.status(409).json({
          success: false,
          message: 'An account with this phone number already exists'
        });
        return;
      }
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user with consent tracking
    const result = await query(
      `INSERT INTO users (email, password_hash, name, phone, role, trust_score, accepted_terms_at, accepted_privacy_at, age_confirmed)
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW(), true)
      RETURNING id, email, name, phone, role, trust_score, email_verified, phone_verified, created_at`,
      [email.toLowerCase(), passwordHash, name, phone || null, UserRole.CITIZEN, 0]
    );

    const user = result.rows[0];

    // Create default notification preferences
    await query(
      `INSERT INTO notification_preferences (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
      [user.id]
    ).catch(() => { /* table might not exist yet */ });

    // Generate tokens with token family for rotation
    const tokenPayload: TokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role
    };

    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);
    const tokenFamily = generateTokenFamily();

    // Store refresh token with family tracking
    await query(
      `INSERT INTO refresh_tokens (user_id, token_hash, token_family, expires_at)
       VALUES ($1, $2, $3, NOW() + INTERVAL '7 days')`,
      [user.id, hashToken(refreshToken), tokenFamily]
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

    // Send welcome email (async, don't block registration)
    sendWelcomeEmail(user.email, user.name).catch(err =>
      console.error('Welcome email failed:', err.message)
    );

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

    // Check account lockout (brute-force protection)
    const lockout = await checkAccountLockout(email);
    if (lockout.locked) {
      res.status(423).json({
        success: false,
        message: `Account temporarily locked due to too many failed attempts. Try again in ${lockout.minutesRemaining} minutes.`
      });
      return;
    }

    // Include all needed fields
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
        message: `Account suspended: ${user.ban_reason || 'Contact support for details'}`
      });
      return;
    }

    // Verify password
    const isValidPassword = await verifyPassword(password, user.password_hash);

    if (!isValidPassword) {
      // Record failed login attempt (brute-force protection)
      await recordFailedLogin(email);
      res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
      return;
    }

    // Reset failed login counter on success
    await resetFailedLogins(email);

    // Generate tokens with family for rotation
    const tokenPayload: TokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role
    };

    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);
    const tokenFamily = generateTokenFamily();

    // Store refresh token with family
    await query(
      `INSERT INTO refresh_tokens (user_id, token_hash, token_family, expires_at)
       VALUES ($1, $2, $3, NOW() + INTERVAL '7 days')`,
      [user.id, hashToken(refreshToken), tokenFamily]
    );

    // Log login
    await logLogin(req, user.id);

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
          cooperative_id: user.cooperative_id,
          cooperative_name: user.cooperative_name,
          created_at: user.created_at
        },
        tokens: {
          accessToken,
          refreshToken
        }
      },
      message: 'Login successful'
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed'
    });
  }
}

// Refresh Token — WITH ROTATION (security fix)
export async function refreshToken(req: Request, res: Response): Promise<void> {
  try {
    const { refreshToken: token } = req.body;

    if (!token) {
      res.status(400).json({
        success: false,
        message: 'Refresh token is required'
      });
      return;
    }

    // Verify JWT
    let payload: TokenPayload;
    try {
      payload = verifyRefreshToken(token);
    } catch (err) {
      res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token'
      });
      return;
    }

    const tokenHash = hashToken(token);

    // Find the token in database
    const tokenResult = await query(
      `SELECT id, user_id, token_family, is_revoked, revoked_at, replaced_by
       FROM refresh_tokens
       WHERE token_hash = $1 AND expires_at > NOW()`,
      [tokenHash]
    );

    if (tokenResult.rows.length === 0) {
      res.status(401).json({
        success: false,
        message: 'Refresh token not found or expired'
      });
      return;
    }

    const storedToken = tokenResult.rows[0];

    // SECURITY: Detect token reuse (rotation theft detection)
    // If this token was already replaced, someone stole the old token
    if (storedToken.is_revoked || storedToken.replaced_by) {
      // Revoke ALL tokens in this family (potential theft)
      console.warn(`⚠️ Refresh token reuse detected for user ${storedToken.user_id}. Revoking token family.`);
      await query(
        `UPDATE refresh_tokens SET is_revoked = true, revoked_at = NOW()
         WHERE token_family = $1`,
        [storedToken.token_family]
      );

      res.status(401).json({
        success: false,
        message: 'Session invalidated due to suspected token theft. Please log in again.'
      });
      return;
    }

    // Get user
    const userResult = await query(
      `SELECT id, email, name, role, is_banned FROM users WHERE id = $1`,
      [storedToken.user_id]
    );

    if (userResult.rows.length === 0 || userResult.rows[0].is_banned) {
      res.status(401).json({
        success: false,
        message: 'User not found or account suspended'
      });
      return;
    }

    const user = userResult.rows[0];

    // Generate new token pair
    const newPayload: TokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role
    };

    const newAccessToken = generateAccessToken(newPayload);
    const newRefreshToken = generateRefreshToken(newPayload);
    const newTokenHash = hashToken(newRefreshToken);

    // ROTATION: Mark old token as replaced, insert new one in same family
    await transaction(async (client) => {
      // Mark old token as used/replaced
      await client.query(
        `UPDATE refresh_tokens
         SET is_revoked = true, revoked_at = NOW(), replaced_by = $1
         WHERE id = $2`,
        [newTokenHash, storedToken.id]
      );

      // Insert new token in the same family
      await client.query(
        `INSERT INTO refresh_tokens (user_id, token_hash, token_family, expires_at)
         VALUES ($1, $2, $3, NOW() + INTERVAL '7 days')`,
        [user.id, newTokenHash, storedToken.token_family]
      );
    });

    res.json({
      success: true,
      data: {
        tokens: {
          accessToken: newAccessToken,
          refreshToken: newRefreshToken
        }
      }
    });
  } catch (error) {
    console.error('Refresh token error:', error);
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
      const tokenHash = hashToken(token);
      await query(
        `UPDATE refresh_tokens SET revoked_at = NOW(), is_revoked = true WHERE token_hash = $1`,
        [tokenHash]
      );
    }

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ success: false, message: 'Logout failed' });
  }
}

// Forgot Password — with per-email rate limiting
export async function forgotPassword(req: Request, res: Response): Promise<void> {
  try {
    const { email } = req.body;

    // Find user
    const result = await query(
      'SELECT id, email, name, password_reset_count, last_password_reset_request FROM users WHERE email = $1',
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

    // Per-email rate limiting: max 3 reset requests per hour (security fix)
    if (user.last_password_reset_request) {
      const lastRequest = new Date(user.last_password_reset_request);
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      if (lastRequest > oneHourAgo && (user.password_reset_count || 0) >= 3) {
        // Don't reveal that we're rate-limiting (prevents enumeration)
        res.json({
          success: true,
          message: 'If the email exists, a password reset link has been sent'
        });
        return;
      }

      // Reset counter if the window has passed
      if (lastRequest <= oneHourAgo) {
        await query(
          `UPDATE users SET password_reset_count = 0 WHERE id = $1`,
          [user.id]
        );
      }
    }

    // Increment reset request counter
    await query(
      `UPDATE users SET
        password_reset_count = COALESCE(password_reset_count, 0) + 1,
        last_password_reset_request = NOW()
      WHERE id = $1`,
      [user.id]
    );

    // Generate reset token
    const resetToken = generateUUID();
    const tokenHash = hashToken(resetToken);

    // Store token (valid for 1 hour)
    await query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '1 hour')`,
      [user.id, tokenHash]
    );

    // Send reset email via Brevo
    console.log(`Password reset token for ${user.email}: ${resetToken}`);
    sendPasswordResetEmail(user.email, user.name, resetToken).catch(err =>
      console.error('Password reset email failed:', err.message)
    );

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
        'UPDATE users SET password_hash = $1, password_reset_count = 0 WHERE id = $2',
        [passwordHash, userId]
      );
      await client.query(
        'UPDATE password_reset_tokens SET used_at = NOW() WHERE token_hash = $1',
        [tokenHash]
      );
      // Revoke all refresh tokens for this user
      await client.query(
        `UPDATE refresh_tokens SET revoked_at = NOW(), is_revoked = true WHERE user_id = $1`,
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

// Get profile
export async function getProfile(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;

    const result = await query(
      `SELECT u.id, u.email, u.name, u.phone, u.role, u.trust_score,
              u.email_verified, u.phone_verified, u.cooperative_id,
              c.name as cooperative_name, u.created_at, u.updated_at
       FROM users u
       LEFT JOIN cooperatives c ON u.cooperative_id = c.id
       WHERE u.id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ success: false, message: 'Failed to get profile' });
  }
}

// Update profile
export async function updateProfile(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const { name, phone } = req.body;

    const result = await query(
      `UPDATE users SET
        name = COALESCE($1, name),
        phone = COALESCE($2, phone),
        updated_at = NOW()
      WHERE id = $3
      RETURNING id, email, name, phone, role, trust_score, email_verified, phone_verified`,
      [name, phone, userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Profile updated successfully'
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ success: false, message: 'Failed to update profile' });
  }
}

// Change password
export async function changePassword(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      res.status(400).json({
        success: false,
        message: 'Current password and new password are required'
      });
      return;
    }

    // Verify current password
    const userResult = await query(
      'SELECT password_hash FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    const isValid = await verifyPassword(currentPassword, userResult.rows[0].password_hash);
    if (!isValid) {
      res.status(401).json({ success: false, message: 'Current password is incorrect' });
      return;
    }

    // Hash and update new password
    const newHash = await hashPassword(newPassword);
    await query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [newHash, userId]);

    // Revoke all refresh tokens (force re-login)
    await query(
      `UPDATE refresh_tokens SET revoked_at = NOW(), is_revoked = true WHERE user_id = $1`,
      [userId]
    );

    // Log
    const { ipAddress, userAgent } = extractRequestMeta(req);
    await logAudit({
      actorId: userId,
      action: 'UPDATE',
      resourceType: 'user',
      resourceId: userId,
      changes: { action: 'password_changed' },
      ipAddress,
      userAgent
    });

    res.json({
      success: true,
      message: 'Password changed successfully. Please log in again.'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ success: false, message: 'Failed to change password' });
  }
}