import { query } from '../config/database';

/**
 * Patch migration: Adds tables and columns referenced by services
 * but missing from the initial migration.
 */
export async function runPatchMigrations(): Promise<void> {
  console.log('🔧 Running patch migrations...');

  // ==========================================
  // FRAUD ASSESSMENTS TABLE
  // Referenced by fraudDetectionService.ts
  // ==========================================
  await query(`
    CREATE TABLE IF NOT EXISTS fraud_assessments (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      action_type VARCHAR(50) NOT NULL,
      risk_level VARCHAR(20) NOT NULL DEFAULT 'LOW',
      risk_score DECIMAL(5,2) NOT NULL DEFAULT 0,
      signals JSONB NOT NULL DEFAULT '[]',
      metadata JSONB DEFAULT '{}',
      ip_address INET,
      blocked BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_fraud_assessments_user ON fraud_assessments(user_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_fraud_assessments_risk ON fraud_assessments(risk_level)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_fraud_assessments_created ON fraud_assessments(created_at DESC)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_fraud_assessments_action ON fraud_assessments(action_type)`);

  // ==========================================
  // NOTIFICATION PREFERENCES (future-ready)
  // ==========================================
  await query(`
    CREATE TABLE IF NOT EXISTS notification_preferences (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      email_matches BOOLEAN NOT NULL DEFAULT TRUE,
      email_claims BOOLEAN NOT NULL DEFAULT TRUE,
      email_messages BOOLEAN NOT NULL DEFAULT TRUE,
      email_expiry_warnings BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE(user_id)
    )
  `);

  // ==========================================
  // SEARCH LOGS (analytics / improvement)
  // ==========================================
  await query(`
    CREATE TABLE IF NOT EXISTS search_logs (
      id BIGSERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      query_text TEXT,
      category VARCHAR(20),
      location_area VARCHAR(100),
      results_count INTEGER NOT NULL DEFAULT 0,
      ip_address INET,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_search_logs_created ON search_logs(created_at DESC)`);

  // ==========================================
  // Add full-text search indexes for better search performance
  // ==========================================
  await query(`
    CREATE INDEX IF NOT EXISTS idx_lost_items_title_trgm 
    ON lost_items USING GIN(title gin_trgm_ops)
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS idx_lost_items_description_trgm 
    ON lost_items USING GIN(description gin_trgm_ops)
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS idx_found_items_title_trgm 
    ON found_items USING GIN(title gin_trgm_ops)
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS idx_found_items_description_trgm 
    ON found_items USING GIN(description gin_trgm_ops)
  `);

  // ==========================================
  // Add updated_at trigger for notification_preferences
  // ==========================================
  await query(`DROP TRIGGER IF EXISTS update_notification_preferences_updated_at ON notification_preferences`);
  await query(`
    CREATE TRIGGER update_notification_preferences_updated_at
      BEFORE UPDATE ON notification_preferences
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column()
  `);

  console.log('✅ Patch migrations completed successfully');
}
