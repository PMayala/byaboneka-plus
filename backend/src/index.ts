import fs from 'fs';
import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';
import cron from 'node-cron';

import routes from './routes';
import enhancedRoutes from './routes/enhancedRoutes';
import novelFeatureRoutes from './routes/novelFeatureRoutes';
import { checkConnection, closePool, query } from './config/database';
import { apiLimiter } from './middleware/rateLimiter';
import { notFoundHandler, errorHandler } from './middleware/errorHandler';
import { sendPendingExpiryWarnings, checkEmailHealth } from './services/emailService';
import { swaggerSpec } from './config/swagger';
import { csrfProtection } from './middleware/csrf';
import { runDataRetention } from './services/dataRetentionService';

import { runMigrations } from './migrations/001_initial';
import { runPatchMigrations } from './migrations/002_patch';
import { runGapFixMigration } from './migrations/003_gap_fixes';
import { runComprehensiveFixMigration } from './migrations/004_comprehensive_fixes';
import { runFinalProductionMigration } from './migrations/005_final_production_fixes';
import { runComprehensiveBugfixMigration } from './migrations/006_comprehensive_bugfix';
import { runLogicRefactorMigration } from './migrations/007_logic_refactor';
import { runClaimFlowFixMigration } from './migrations/008_claim_flow_fixes';



// swagger-ui-express is CJS — use require for reliable loading
// eslint-disable-next-line @typescript-eslint/no-var-requires
const swaggerUi = require('swagger-ui-express');

// Load environment variables
dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 4000;

// ============================================
// MIDDLEWARE
// ============================================

// Security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false, // Swagger UI needs inline scripts/styles
}));

// CORS — support multiple origins for Vercel + localhost
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000')
  .split(',')
  .map(o => o.trim().replace(/\/+$/, '')); // Strip trailing slashes

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Request logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Body parsing — 1MB limit to prevent DoS (security fix)
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// CSRF protection (origin validation for state-changing requests)
app.use(csrfProtection(allowedOrigins));

// Rate limiting
app.use('/api/v1', apiLimiter);

// Static files for uploads
const uploadPath = process.env.UPLOAD_PATH || './uploads';
app.use('/uploads', express.static(path.resolve(uploadPath)));

// ============================================
// SWAGGER API DOCS
// ============================================
const swaggerSetup = swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Byaboneka+ API Documentation'
});
app.use('/api-docs', swaggerUi.serve);
app.get('/api-docs', swaggerSetup);
console.log('📖 API docs available at /api-docs');

// ============================================
// ROUTES
// ============================================

// API routes (core + enhanced + novel features)
app.use('/api/v1', routes);
app.use('/api/v1', enhancedRoutes);
app.use('/api/v1', novelFeatureRoutes);

// Root endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({
    name: 'Byaboneka+ API',
    version: '1.0.0',
    description: 'Trust-Aware Lost & Found Infrastructure for Rwanda',
    health: '/api/v1/health'
  });
});

// ============================================
// ERROR HANDLING (using middleware from errorHandler.ts)
// ============================================

app.use(notFoundHandler);
app.use(errorHandler);

// ============================================
// SCHEDULED JOBS
// ============================================

// Auto-expire old reports (daily at 2 AM)
cron.schedule('0 2 * * *', async () => {
  console.log('🕐 Running auto-expiry job...');
  try {
    const expiredLost = await query(`
      UPDATE lost_items 
      SET status = 'EXPIRED', expired_at = NOW()
      WHERE status = 'ACTIVE' 
      AND updated_at < NOW() - INTERVAL '30 days'
      RETURNING id
    `);

    const expiredFound = await query(`
      UPDATE found_items 
      SET status = 'EXPIRED', expired_at = NOW()
      WHERE status = 'UNCLAIMED' 
      AND updated_at < NOW() - INTERVAL '30 days'
      RETURNING id
    `);

    const expiredClaims = await query(`
      UPDATE claims 
      SET status = 'EXPIRED'
      WHERE status = 'PENDING' 
      AND created_at < NOW() - INTERVAL '7 days'
      RETURNING id
    `);

    // ALGO-3.6.1: Expire VERIFIED claims with no handover after 14 days
    const expiredVerifiedClaims = await query(`
      UPDATE claims 
      SET status = 'EXPIRED'
      WHERE status = 'VERIFIED' 
      AND id NOT IN (SELECT claim_id FROM handover_confirmations WHERE otp_verified = true)
      AND created_at < NOW() - INTERVAL '14 days'
      RETURNING id
    `);

    // When verified claims expire, revert items to active/unclaimed
    if (expiredVerifiedClaims.rows.length > 0) {
      const expiredClaimIds = expiredVerifiedClaims.rows.map((r: any) => r.id);
      await query(`
        UPDATE lost_items SET status = 'ACTIVE'
        WHERE id IN (SELECT lost_item_id FROM claims WHERE id = ANY($1))
        AND status = 'CLAIMED'
      `, [expiredClaimIds]);
      await query(`
        UPDATE found_items SET status = 'UNCLAIMED'
        WHERE id IN (SELECT found_item_id FROM claims WHERE id = ANY($1))
        AND status = 'MATCHED'
      `, [expiredClaimIds]);
    }

    console.log(`✅ Expired: ${expiredLost.rowCount} lost items, ${expiredFound.rowCount} found items, ${expiredClaims.rowCount} pending claims, ${expiredVerifiedClaims.rowCount} stale verified claims`);
  } catch (error) {
    console.error('❌ Auto-expiry job failed:', error);
  }
});

// Send expiry warnings (daily at 1 AM)
cron.schedule('0 1 * * *', async () => {
  console.log('🕐 Sending expiry warnings...');
  try {
    const sent = await sendPendingExpiryWarnings();
    console.log(`✅ Expiry warnings sent: ${sent} emails`);
  } catch (error) {
    console.error('❌ Expiry warning job failed:', error);
  }
});

// Data retention cleanup (weekly, Sunday at 3 AM)
cron.schedule('0 3 * * 0', async () => {
  console.log('🕐 Running data retention cleanup...');
  try {
    await runDataRetention();
  } catch (error) {
    console.error('❌ Data retention failed:', error);
  }
});

// ALGO-3.6.1: Archive and delete old data (monthly, 1st of month at 4 AM)
cron.schedule('0 4 1 * *', async () => {
  console.log('🕐 Running 365-day data archival...');
  try {
    // Archive items older than 365 days
    const archivedLost = await query(`
      UPDATE lost_items SET archived_at = NOW()
      WHERE status IN ('EXPIRED', 'RETURNED')
      AND updated_at < NOW() - INTERVAL '365 days'
      AND archived_at IS NULL
      RETURNING id
    `);
    const archivedFound = await query(`
      UPDATE found_items SET archived_at = NOW()
      WHERE status IN ('EXPIRED', 'RETURNED')
      AND updated_at < NOW() - INTERVAL '365 days'
      AND archived_at IS NULL
      RETURNING id
    `);

    // Permanently delete items archived more than 30 days ago
    const deletedLost = await query(`
      DELETE FROM lost_items WHERE archived_at < NOW() - INTERVAL '30 days' RETURNING id
    `);
    const deletedFound = await query(`
      DELETE FROM found_items WHERE archived_at < NOW() - INTERVAL '30 days' RETURNING id
    `);

    // Clean old audit logs (retain 90 days per spec, archive for 365)
    const cleanedAuditLogs = await query(`
      DELETE FROM audit_logs WHERE timestamp < NOW() - INTERVAL '365 days' RETURNING id
    `);

    // Clean old verification attempts
    const cleanedAttempts = await query(`
      DELETE FROM verification_attempts WHERE attempt_at < NOW() - INTERVAL '365 days' RETURNING id
    `);

    console.log(`✅ Archived: ${archivedLost.rowCount} lost, ${archivedFound.rowCount} found. Deleted: ${deletedLost.rowCount} lost, ${deletedFound.rowCount} found, ${cleanedAuditLogs.rowCount} audit logs, ${cleanedAttempts.rowCount} verification attempts.`);
  } catch (error) {
    console.error('❌ Data archival failed:', error);
  }
});

// Clean expired refresh tokens (daily at 5 AM)
cron.schedule('0 5 * * *', async () => {
  console.log('🕐 Cleaning expired refresh tokens...');
  try {
    const result = await query(`
      DELETE FROM refresh_tokens
      WHERE expires_at < NOW() OR is_revoked = true
      RETURNING id
    `);
    console.log(`✅ Cleaned ${result.rowCount} expired/revoked refresh tokens`);
  } catch (error) {
    console.error('❌ Token cleanup failed:', error);
  }
});

// ============================================
// SERVER STARTUP
// ============================================

async function startServer() {
  try {
    // Check database connection
    const connected = await checkConnection();
    if (!connected) {
      throw new Error('Failed to connect to database');
    }
    console.log('✅ Database connected');

    // Run migrations in order
    await runMigrations();
    await runPatchMigrations();
    await runGapFixMigration().catch(err => console.warn('Gap fix migration note:', err.message));
    await runComprehensiveFixMigration().catch(err => console.warn('Comprehensive fix migration note:', err.message));
    await runFinalProductionMigration().catch(err => console.warn('Final production migration note:', err.message));
    await runComprehensiveBugfixMigration().catch(err => console.warn('Comprehensive bugfix migration note:', err.message));
    await runLogicRefactorMigration().catch(err => console.warn('Logic refactor migration note:', err.message));
    await runClaimFlowFixMigration().catch(err => console.warn('Claim flow fix migration note:', err.message));

    // Create uploads directory if it doesn't exist
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }

    // Start server
    const server = app.listen(PORT, async () => {
      // Check email service status
      const emailStatus = await checkEmailHealth();

      console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   🚀 Byaboneka+ API Server                                 ║
║                                                            ║
║   Port: ${PORT}                                              ║
║   Environment: ${process.env.NODE_ENV || 'development'}                            ║
║   API: http://localhost:${PORT}/api/v1                        ║
║   Docs: http://localhost:${PORT}/api-docs                     ║
║   Email: ${emailStatus.connected ? '✅ Brevo SMTP connected' : emailStatus.configured ? '⚠️  Configured but not connected' : '❌ Not configured (set BREVO_SMTP_USER)'}
║                                                            ║
╚════════════════════════════════════════════════════════════╝
      `);
    });

    // Graceful shutdown
    const shutdown = async () => {
      console.log('\n🛑 Shutting down server...');
      server.close(async () => {
        await closePool();
        console.log('✅ Server shut down gracefully');
        process.exit(0);
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

export default app;