// ============================================
// DATABASE MIGRATION 005: Final Production Fixes
// Addresses ALL remaining gaps for 10/10 audit score
// ============================================

import { query } from '../config/database';

export async function runFinalProductionMigration(): Promise<void> {
  console.log('🔄 Running final production fix migration (005)...\n');

  // ── 1. Refresh token family tracking (for token rotation) ──
  console.log('  → Adding token_family to refresh_tokens...');
  await query(`ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS token_family VARCHAR(64)`);
  await query(`ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS replaced_by VARCHAR(64)`);
  await query(`ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS is_revoked BOOLEAN DEFAULT false`);

  // ── 2. Failed login tracking columns (if not added by lockout service) ──
  console.log('  → Ensuring failed login columns exist...');
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0`);
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_failed_login TIMESTAMP`);

  // ── 3. Terms acceptance tracking ──
  console.log('  → Adding terms acceptance tracking...');
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS accepted_terms_at TIMESTAMP`);
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS accepted_privacy_at TIMESTAMP`);

  // ── 4. Notification preferences table ──
  console.log('  → Creating notification_preferences table...');
  await query(`
    CREATE TABLE IF NOT EXISTS notification_preferences (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      email_on_match BOOLEAN DEFAULT true,
      email_on_claim BOOLEAN DEFAULT true,
      email_on_handover BOOLEAN DEFAULT true,
      email_on_expiry_warning BOOLEAN DEFAULT true,
      email_on_message BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(user_id)
    )
  `);

  // ── 5. User age confirmation field ──
  console.log('  → Adding age confirmation field...');
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS age_confirmed BOOLEAN DEFAULT false`);

  // ── 6. Fraud risk assessments table (persistent storage for auditing) ──
  console.log('  → Creating fraud_risk_assessments table...');
  await query(`
    CREATE TABLE IF NOT EXISTS fraud_risk_assessments (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      action_type VARCHAR(50) NOT NULL,
      risk_score INTEGER NOT NULL,
      risk_level VARCHAR(20) NOT NULL,
      factors JSONB DEFAULT '[]',
      was_blocked BOOLEAN DEFAULT false,
      ip_address VARCHAR(45),
      user_agent TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_fraud_assessments_user ON fraud_risk_assessments(user_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_fraud_assessments_level ON fraud_risk_assessments(risk_level)`);

  // ── 7. Cooperative staff audit view (THREAT-7.8) ──
  console.log('  → Creating cooperative staff audit view...');
  await query(`
    CREATE OR REPLACE VIEW cooperative_staff_audit AS
    SELECT
      u.id AS staff_id,
      u.name AS staff_name,
      u.cooperative_id,
      c.name AS cooperative_name,
      COUNT(DISTINCT fi.id) FILTER (WHERE fi.status = 'RETURNED') AS items_returned,
      COUNT(DISTINCT fi.id) AS total_items_handled,
      COUNT(DISTINCT hc.id) FILTER (WHERE hc.otp_verified = true) AS handovers_confirmed,
      AVG(EXTRACT(EPOCH FROM (hc.returned_at - fi.created_at)) / 3600) 
        FILTER (WHERE hc.returned_at IS NOT NULL) AS avg_return_hours,
      u.trust_score
    FROM users u
    JOIN cooperatives c ON u.cooperative_id = c.id
    LEFT JOIN found_items fi ON fi.finder_id = u.id
    LEFT JOIN claims cl ON cl.found_item_id = fi.id
    LEFT JOIN handover_confirmations hc ON hc.claim_id = cl.id
    WHERE u.role = 'coop_staff'
    GROUP BY u.id, u.name, u.cooperative_id, c.name, u.trust_score
  `);

  // ── 8. Trust score explanation data (for transparency) ──
  console.log('  → Creating trust_score_events table...');
  await query(`
    CREATE TABLE IF NOT EXISTS trust_score_events (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      change_amount INTEGER NOT NULL,
      reason VARCHAR(255) NOT NULL,
      new_score INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_trust_events_user ON trust_score_events(user_id)`);

  // ── 9. Handover location acknowledgment on handover_confirmations ──
  console.log('  → Adding handover location tracking to handover_confirmations...');
  await query(`ALTER TABLE handover_confirmations ADD COLUMN IF NOT EXISTS handover_location_id INTEGER REFERENCES safe_handover_locations(id)`);
  await query(`ALTER TABLE handover_confirmations ADD COLUMN IF NOT EXISTS location_acknowledged BOOLEAN DEFAULT false`);
  await query(`ALTER TABLE handover_confirmations ADD COLUMN IF NOT EXISTS location_changed_warning BOOLEAN DEFAULT false`);

  // ── 10. Index for expired items queries ──
  console.log('  → Creating performance indexes...');
  await query(`CREATE INDEX IF NOT EXISTS idx_lost_items_status_updated ON lost_items(status, updated_at)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_found_items_status_updated ON found_items(status, updated_at)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_claims_status_created ON claims(status, created_at)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_action ON audit_logs(actor_id, action)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_messages_receiver_read ON messages(receiver_id, is_read)`);

  console.log('\n✅ Final production fix migration (005) complete!');
}

// Direct execution
if (require.main === module) {
  require('dotenv').config();
  runFinalProductionMigration()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}