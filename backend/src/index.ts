import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';
import cron from 'node-cron';

import routes from './routes';
import { checkConnection, closePool } from './config/database';
import { apiLimiter } from './middleware/rateLimiter';
import { runMigrations } from './migrations/001_initial';
import { query } from './config/database';

// Load environment variables
dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 4000;

// ============================================
// MIDDLEWARE
// ============================================

// Security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// CORS
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Request logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
app.use('/api', apiLimiter);

// Static files for uploads
const uploadPath = process.env.UPLOAD_PATH || './uploads';
app.use('/uploads', express.static(path.resolve(uploadPath)));

// ============================================
// ROUTES
// ============================================

// API routes
app.use('/api/v1', routes);

// Root endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({
    name: 'Byaboneka+ API',
    version: '1.0.0',
    description: 'Trust-Aware Lost & Found Infrastructure for Rwanda',
    documentation: '/api/v1/docs',
    health: '/api/v1/health'
  });
});

// ============================================
// ERROR HANDLING
// ============================================

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    path: req.path
  });
});

// Global error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err);

  // Multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      message: 'File too large. Maximum size is 5MB.'
    });
  }

  if (err.message === 'Invalid file type. Only JPEG, PNG, and WebP are allowed.') {
    return res.status(400).json({
      success: false,
      message: err.message
    });
  }

  // Default error
  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' 
      ? 'An unexpected error occurred' 
      : err.message
  });
});

// ============================================
// SCHEDULED JOBS
// ============================================

// Auto-expire old reports (daily at 2 AM)
cron.schedule('0 2 * * *', async () => {
  console.log('🕐 Running auto-expiry job...');
  try {
    // Expire lost items
    const expiredLost = await query(`
      UPDATE lost_items 
      SET status = 'EXPIRED', expired_at = NOW()
      WHERE status = 'ACTIVE' 
      AND updated_at < NOW() - INTERVAL '30 days'
      RETURNING id
    `);

    // Expire found items
    const expiredFound = await query(`
      UPDATE found_items 
      SET status = 'EXPIRED', expired_at = NOW()
      WHERE status = 'UNCLAIMED' 
      AND updated_at < NOW() - INTERVAL '30 days'
      RETURNING id
    `);

    // Expire pending claims
    const expiredClaims = await query(`
      UPDATE claims 
      SET status = 'EXPIRED'
      WHERE status = 'PENDING' 
      AND created_at < NOW() - INTERVAL '7 days'
      RETURNING id
    `);

    console.log(`✅ Expired: ${expiredLost.rowCount} lost items, ${expiredFound.rowCount} found items, ${expiredClaims.rowCount} claims`);
  } catch (error) {
    console.error('❌ Auto-expiry job failed:', error);
  }
});

// Send expiry warnings (daily at 1 AM)
cron.schedule('0 1 * * *', async () => {
  console.log('🕐 Sending expiry warnings...');
  try {
    // Mark items for expiry warning
    await query(`
      UPDATE lost_items 
      SET expiry_warning_sent = true
      WHERE status = 'ACTIVE' 
      AND updated_at < NOW() - INTERVAL '23 days'
      AND expiry_warning_sent = false
    `);

    await query(`
      UPDATE found_items 
      SET expiry_warning_sent = true
      WHERE status = 'UNCLAIMED' 
      AND updated_at < NOW() - INTERVAL '23 days'
      AND expiry_warning_sent = false
    `);

    console.log('✅ Expiry warnings sent');
  } catch (error) {
    console.error('❌ Expiry warning job failed:', error);
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

    // Run migrations
    await runMigrations();

    // Create uploads directory if it doesn't exist
    const fs = await import('fs');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }

    // Start server
    const server = app.listen(PORT, () => {
      console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   🚀 Byaboneka+ API Server                                 ║
║                                                            ║
║   Port: ${PORT}                                              ║
║   Environment: ${process.env.NODE_ENV || 'development'}                            ║
║   API: http://localhost:${PORT}/api/v1                        ║
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
