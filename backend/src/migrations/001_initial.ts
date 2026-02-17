import { query } from '../config/database';

// ============================================
// BYABONEKA+ DATABASE MIGRATIONS
// Trust-Aware Lost & Found Infrastructure
// ============================================

export async function runMigrations(): Promise<void> {
  console.log('🚀 Running database migrations...');

  // ==========================================
  // CLEANUP: Fix orphaned composite types from prior DROP TABLE
  // PostgreSQL keeps composite types in pg_type even after DROP TABLE CASCADE.
  // If the type exists but the table doesn't, drop the orphaned type.
  // ==========================================
  await query(`
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'verification_attempts' AND typtype = 'c')
         AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'verification_attempts')
      THEN
        DROP TYPE IF EXISTS verification_attempts CASCADE;
      END IF;
    END $$;
  `);

  // ==========================================
  // EXTENSIONS
  // ==========================================
  await query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
  await query(`CREATE EXTENSION IF NOT EXISTS "pg_trgm";`);

  // ==========================================
  // ENUM TYPES (safe to re-run)
  // ==========================================
  await query(`DO $$ BEGIN CREATE TYPE user_role AS ENUM ('citizen', 'coop_staff', 'admin'); EXCEPTION WHEN duplicate_object THEN null; END $$;`);
  await query(`DO $$ BEGIN CREATE TYPE item_category AS ENUM ('PHONE', 'ID', 'WALLET', 'BAG', 'KEYS', 'OTHER'); EXCEPTION WHEN duplicate_object THEN null; END $$;`);
  await query(`DO $$ BEGIN CREATE TYPE lost_item_status AS ENUM ('ACTIVE', 'CLAIMED', 'RETURNED', 'EXPIRED'); EXCEPTION WHEN duplicate_object THEN null; END $$;`);
  await query(`DO $$ BEGIN CREATE TYPE found_item_status AS ENUM ('UNCLAIMED', 'MATCHED', 'RETURNED', 'EXPIRED'); EXCEPTION WHEN duplicate_object THEN null; END $$;`);
  await query(`DO $$ BEGIN CREATE TYPE item_source AS ENUM ('CITIZEN', 'COOPERATIVE'); EXCEPTION WHEN duplicate_object THEN null; END $$;`);
  await query(`DO $$ BEGIN CREATE TYPE claim_status AS ENUM ('PENDING', 'VERIFIED', 'REJECTED', 'RETURNED', 'DISPUTED', 'CANCELLED', 'EXPIRED'); EXCEPTION WHEN duplicate_object THEN null; END $$;`);
  await query(`DO $$ BEGIN CREATE TYPE verification_attempt_status AS ENUM ('PASSED', 'FAILED'); EXCEPTION WHEN duplicate_object THEN null; END $$;`);
  await query(`DO $$ BEGIN CREATE TYPE cooperative_status AS ENUM ('PENDING', 'VERIFIED', 'SUSPENDED'); EXCEPTION WHEN duplicate_object THEN null; END $$;`);
  await query(`DO $$ BEGIN CREATE TYPE scam_report_status AS ENUM ('OPEN', 'INVESTIGATING', 'RESOLVED'); EXCEPTION WHEN duplicate_object THEN null; END $$;`);
  await query(`DO $$ BEGIN CREATE TYPE dispute_status AS ENUM ('OPEN', 'UNDER_REVIEW', 'RESOLVED_OWNER', 'RESOLVED_FINDER', 'DISMISSED'); EXCEPTION WHEN duplicate_object THEN null; END $$;`);

  // ==========================================
  // COOPERATIVES TABLE
  // ==========================================
  await query(`
    CREATE TABLE IF NOT EXISTS cooperatives (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      registration_number VARCHAR(100) NOT NULL UNIQUE,
      status cooperative_status NOT NULL DEFAULT 'PENDING',
      contact_info TEXT NOT NULL,
      address TEXT,
      verified_at TIMESTAMP,
      verified_by INTEGER,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  // ==========================================
  // USERS TABLE
  // ==========================================
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      phone VARCHAR(20) UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      name VARCHAR(100) NOT NULL,
      role user_role NOT NULL DEFAULT 'citizen',
      trust_score INTEGER NOT NULL DEFAULT 0,
      cooperative_id INTEGER REFERENCES cooperatives(id),
      email_verified BOOLEAN NOT NULL DEFAULT FALSE,
      phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
      is_banned BOOLEAN NOT NULL DEFAULT FALSE,
      banned_at TIMESTAMP,
      ban_reason TEXT,
      failed_login_attempts INTEGER NOT NULL DEFAULT 0,
      locked_until TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_users_cooperative ON users(cooperative_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_users_trust_score ON users(trust_score)`);

  // Cooperatives FK to users
  await query(`
    DO $$ BEGIN
      ALTER TABLE cooperatives ADD CONSTRAINT fk_cooperatives_verified_by
        FOREIGN KEY (verified_by) REFERENCES users(id);
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$
  `);

  // ==========================================
  // LOST ITEMS TABLE
  // ==========================================
  await query(`
    CREATE TABLE IF NOT EXISTS lost_items (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      category item_category NOT NULL,
      title VARCHAR(100) NOT NULL,
      description TEXT NOT NULL,
      location_area VARCHAR(100) NOT NULL,
      location_hint TEXT,
      lost_date TIMESTAMP NOT NULL,
      status lost_item_status NOT NULL DEFAULT 'ACTIVE',
      keywords TEXT[] DEFAULT '{}',
      photo_url TEXT,
      expiry_warning_sent BOOLEAN NOT NULL DEFAULT FALSE,
      expired_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_lost_items_user ON lost_items(user_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_lost_items_category_status ON lost_items(category, status)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_lost_items_location ON lost_items(location_area)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_lost_items_lost_date ON lost_items(lost_date)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_lost_items_created ON lost_items(created_at)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_lost_items_keywords ON lost_items USING GIN(keywords)`);

  // ==========================================
  // FOUND ITEMS TABLE
  // ==========================================
  await query(`
    CREATE TABLE IF NOT EXISTS found_items (
      id SERIAL PRIMARY KEY,
      finder_id INTEGER NOT NULL REFERENCES users(id),
      cooperative_id INTEGER REFERENCES cooperatives(id),
      category item_category NOT NULL,
      title VARCHAR(100) NOT NULL,
      description TEXT NOT NULL,
      location_area VARCHAR(100) NOT NULL,
      location_hint TEXT,
      found_date TIMESTAMP NOT NULL,
      status found_item_status NOT NULL DEFAULT 'UNCLAIMED',
      source item_source NOT NULL DEFAULT 'CITIZEN',
      image_urls TEXT[] NOT NULL DEFAULT '{}',
      keywords TEXT[] DEFAULT '{}',
      expiry_warning_sent BOOLEAN NOT NULL DEFAULT FALSE,
      expired_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_found_items_finder ON found_items(finder_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_found_items_cooperative ON found_items(cooperative_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_found_items_category_status ON found_items(category, status)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_found_items_location ON found_items(location_area)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_found_items_found_date ON found_items(found_date)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_found_items_created ON found_items(created_at)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_found_items_keywords ON found_items USING GIN(keywords)`);

  // ==========================================
  // VERIFICATION SECRETS TABLE
  // ==========================================
  await query(`
    CREATE TABLE IF NOT EXISTS verification_secrets (
      id SERIAL PRIMARY KEY,
      lost_item_id INTEGER NOT NULL REFERENCES lost_items(id) ON DELETE CASCADE,
      question_1_text VARCHAR(255) NOT NULL,
      answer_1_hash VARCHAR(255) NOT NULL,
      answer_1_salt VARCHAR(64) NOT NULL,
      question_2_text VARCHAR(255) NOT NULL,
      answer_2_hash VARCHAR(255) NOT NULL,
      answer_2_salt VARCHAR(64) NOT NULL,
      question_3_text VARCHAR(255) NOT NULL,
      answer_3_hash VARCHAR(255) NOT NULL,
      answer_3_salt VARCHAR(64) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE(lost_item_id)
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_verification_secrets_lost_item ON verification_secrets(lost_item_id)`);

  // ==========================================
  // CLAIMS TABLE
  // ==========================================
  await query(`
    CREATE TABLE IF NOT EXISTS claims (
      id SERIAL PRIMARY KEY,
      lost_item_id INTEGER NOT NULL REFERENCES lost_items(id),
      found_item_id INTEGER NOT NULL REFERENCES found_items(id),
      claimant_id INTEGER NOT NULL REFERENCES users(id),
      status claim_status NOT NULL DEFAULT 'PENDING',
      verification_score DECIMAL(3,2) NOT NULL DEFAULT 0,
      attempts_made INTEGER NOT NULL DEFAULT 0,
      consecutive_failures INTEGER NOT NULL DEFAULT 0,
      next_attempt_at TIMESTAMP,
      last_attempt_at TIMESTAMP,
      dispute_reason TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_claims_claimant ON claims(claimant_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_claims_status ON claims(status)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_claims_lost_item ON claims(lost_item_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_claims_found_item ON claims(found_item_id)`);
  await query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_claims_unique_active ON claims(lost_item_id, found_item_id, claimant_id) WHERE status NOT IN ('CANCELLED', 'REJECTED', 'EXPIRED')`);

  // ==========================================
  // VERIFICATION ATTEMPTS TABLE
  // ==========================================
  await query(`
    CREATE TABLE IF NOT EXISTS verification_attempts (
      id SERIAL PRIMARY KEY,
      claim_id INTEGER NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id),
      correct_answers INTEGER NOT NULL DEFAULT 0,
      attempt_status verification_attempt_status NOT NULL,
      attempt_at TIMESTAMP NOT NULL DEFAULT NOW(),
      ip_address INET
    )
  `);

  await query(`CREATE INDEX IF NOT EXISTS idx_verification_attempts_claim ON verification_attempts(claim_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_verification_attempts_date ON verification_attempts(attempt_at)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_verification_attempts_user ON verification_attempts(user_id)`);

  // ==========================================
  // HANDOVER CONFIRMATIONS TABLE
  // ==========================================
  await query(`
    CREATE TABLE IF NOT EXISTS handover_confirmations (
      id SERIAL PRIMARY KEY,
      claim_id INTEGER NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
      otp_code_hash VARCHAR(255) NOT NULL,
      otp_expires_at TIMESTAMP NOT NULL,
      otp_verified BOOLEAN NOT NULL DEFAULT FALSE,
      verification_attempts INTEGER NOT NULL DEFAULT 0,
      max_attempts INTEGER NOT NULL DEFAULT 3,
      generated_by INTEGER REFERENCES users(id),
      returned_at TIMESTAMP,
      return_confirmed_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE(claim_id)
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_handover_claim ON handover_confirmations(claim_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_handover_expires ON handover_confirmations(otp_expires_at)`);

  // ==========================================
  // MESSAGES TABLE
  // ==========================================
  await query(`
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      sender_id INTEGER NOT NULL REFERENCES users(id),
      receiver_id INTEGER NOT NULL REFERENCES users(id),
      claim_id INTEGER NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      is_read BOOLEAN NOT NULL DEFAULT FALSE,
      is_flagged BOOLEAN NOT NULL DEFAULT FALSE,
      flag_reason TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_messages_claim ON messages(claim_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at)`);

  // ==========================================
  // SCAM REPORTS TABLE
  // ==========================================
  await query(`
    CREATE TABLE IF NOT EXISTS scam_reports (
      id SERIAL PRIMARY KEY,
      reporter_id INTEGER NOT NULL REFERENCES users(id),
      message_id INTEGER REFERENCES messages(id),
      reported_user_id INTEGER NOT NULL REFERENCES users(id),
      claim_id INTEGER REFERENCES claims(id),
      reason TEXT NOT NULL,
      status scam_report_status NOT NULL DEFAULT 'OPEN',
      resolved_at TIMESTAMP,
      resolved_by INTEGER REFERENCES users(id),
      resolution_notes TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_scam_reports_reporter ON scam_reports(reporter_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_scam_reports_reported ON scam_reports(reported_user_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_scam_reports_status ON scam_reports(status)`);

  // ==========================================
  // CLAIM DISPUTES TABLE
  // ==========================================
  await query(`
    CREATE TABLE IF NOT EXISTS claim_disputes (
      id SERIAL PRIMARY KEY,
      claim_id INTEGER NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
      initiated_by INTEGER NOT NULL REFERENCES users(id),
      reason TEXT NOT NULL,
      evidence_urls TEXT[] DEFAULT '{}',
      status dispute_status NOT NULL DEFAULT 'OPEN',
      admin_notes TEXT,
      resolved_by INTEGER REFERENCES users(id),
      resolved_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_claim_disputes_claim ON claim_disputes(claim_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_claim_disputes_status ON claim_disputes(status)`);

  // ==========================================
  // EMAIL VERIFICATION TOKENS TABLE
  // ==========================================
  await query(`
    CREATE TABLE IF NOT EXISTS email_verification_tokens (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash VARCHAR(255) NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      used_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_email_verification_user ON email_verification_tokens(user_id)`);

  // ==========================================
  // AUDIT LOGS TABLE
  // ==========================================
  await query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id BIGSERIAL PRIMARY KEY,
      actor_id INTEGER REFERENCES users(id),
      action VARCHAR(50) NOT NULL,
      resource_type VARCHAR(50) NOT NULL,
      resource_id INTEGER,
      changes JSONB,
      ip_address INET,
      user_agent TEXT,
      timestamp TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC)`);

  // ==========================================
  // MATCHES TABLE
  // ==========================================
  await query(`
    CREATE TABLE IF NOT EXISTS matches (
      id SERIAL PRIMARY KEY,
      lost_item_id INTEGER NOT NULL REFERENCES lost_items(id) ON DELETE CASCADE,
      found_item_id INTEGER NOT NULL REFERENCES found_items(id) ON DELETE CASCADE,
      score INTEGER NOT NULL,
      explanation TEXT[] NOT NULL,
      computed_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE(lost_item_id, found_item_id)
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_matches_lost ON matches(lost_item_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_matches_found ON matches(found_item_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_matches_score ON matches(score DESC)`);

  // ==========================================
  // REFRESH TOKENS TABLE
  // ==========================================
  await query(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash VARCHAR(255) NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      revoked_at TIMESTAMP
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens(expires_at)`);

  // ==========================================
  // PASSWORD RESET TOKENS TABLE
  // ==========================================
  await query(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash VARCHAR(255) NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      used_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_password_reset_user ON password_reset_tokens(user_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_password_reset_hash ON password_reset_tokens(token_hash)`);

  // ==========================================
  // UPDATED_AT TRIGGER FUNCTION
  // ==========================================
  await query(`
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ language 'plpgsql'
  `);

  // Apply updated_at triggers
  const tablesWithUpdatedAt = [
    'users', 'cooperatives', 'lost_items', 'found_items',
    'verification_secrets', 'claims', 'handover_confirmations', 'claim_disputes'
  ];

  for (const table of tablesWithUpdatedAt) {
    await query(`DROP TRIGGER IF EXISTS update_${table}_updated_at ON ${table}`);
    await query(`
      CREATE TRIGGER update_${table}_updated_at
        BEFORE UPDATE ON ${table}
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column()
    `);
  }

  console.log('✅ Database migrations completed successfully');
}

export async function rollbackMigrations(): Promise<void> {
  console.log('🔄 Rolling back migrations...');
  
  const tables = [
    'password_reset_tokens',
    'refresh_tokens',
    'matches',
    'audit_logs',
    'email_verification_tokens',
    'claim_disputes',
    'scam_reports',
    'messages',
    'handover_confirmations',
    'verification_attempts',
    'claims',
    'verification_secrets',
    'found_items',
    'lost_items',
    'users',
    'cooperatives'
  ];

  for (const table of tables) {
    await query(`DROP TABLE IF EXISTS ${table} CASCADE`);
  }

  await query(`DROP TYPE IF EXISTS user_role CASCADE`);
  await query(`DROP TYPE IF EXISTS item_category CASCADE`);
  await query(`DROP TYPE IF EXISTS lost_item_status CASCADE`);
  await query(`DROP TYPE IF EXISTS found_item_status CASCADE`);
  await query(`DROP TYPE IF EXISTS item_source CASCADE`);
  await query(`DROP TYPE IF EXISTS claim_status CASCADE`);
  await query(`DROP TYPE IF EXISTS verification_attempt_status CASCADE`);
  await query(`DROP TYPE IF EXISTS cooperative_status CASCADE`);
  await query(`DROP TYPE IF EXISTS scam_report_status CASCADE`);
  await query(`DROP TYPE IF EXISTS dispute_status CASCADE`);

  console.log('✅ Migrations rolled back successfully');
}

// Run migrations if executed directly
if (require.main === module) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}