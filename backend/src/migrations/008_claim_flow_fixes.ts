// backend/src/migrations/008_claim_flow_fixes.ts
import { query } from '../config/database';

const MIGRATION_ID = '008_claim_flow_fixes';

export async function runClaimFlowFixMigration(): Promise<void> {
  // Ensure migrations table exists (if your project already has it, this is harmless)
  await query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const already = await query(`SELECT 1 FROM schema_migrations WHERE id = $1`, [MIGRATION_ID]);
  if (already.rows.length > 0) {
    console.log(`↩️  Migration ${MIGRATION_ID} already applied — skipping`);
    return;
  }

  console.log('🚀 Running migration 008: Claim Flow Fixes...');

  // 1. Ensure PENDING_QUESTIONS status exists
  await query(`
    DO $$ BEGIN
      ALTER TYPE claim_status ADD VALUE IF NOT EXISTS 'PENDING_QUESTIONS';
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;
  `);

  // 2. Ensure verification_secrets has claim_id + created_by, and lost_item_id is nullable
  await query(`
    ALTER TABLE verification_secrets
    ADD COLUMN IF NOT EXISTS claim_id INTEGER REFERENCES claims(id) ON DELETE CASCADE
  `);
  await query(`
    ALTER TABLE verification_secrets
    ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id)
  `);
  await query(`
    ALTER TABLE verification_secrets ALTER COLUMN lost_item_id DROP NOT NULL
  `).catch(() => { /* already nullable */ });

  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_verification_secrets_claim_unique
    ON verification_secrets(claim_id) WHERE claim_id IS NOT NULL
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS idx_verification_secrets_claim
    ON verification_secrets(claim_id)
  `);

  // 3. Fast lookup: claims by found_item_id
  await query(`
    CREATE INDEX IF NOT EXISTS idx_claims_found_item_id ON claims(found_item_id)
  `);

  // 4. disputes table
  await query(`
    CREATE TABLE IF NOT EXISTS disputes (
      id            SERIAL PRIMARY KEY,
      claim_id      INTEGER NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
      opened_by     INTEGER NOT NULL REFERENCES users(id),
      reason        TEXT NOT NULL,
      evidence_urls JSONB NOT NULL DEFAULT '[]',
      status        VARCHAR(30) NOT NULL DEFAULT 'OPEN'
                    CHECK (status IN ('OPEN','UNDER_REVIEW','RESOLVED_OWNER','RESOLVED_FINDER','DISMISSED')),
      resolution_notes TEXT,
      resolved_by   INTEGER REFERENCES users(id),
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      resolved_at   TIMESTAMPTZ
    )
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS idx_disputes_claim_id ON disputes(claim_id)
  `);

  // 5. Backfill stuck claims to PENDING_QUESTIONS if no verification secrets exist
  await query(`
    UPDATE claims
    SET status = 'PENDING_QUESTIONS'
    WHERE status = 'PENDING'
    AND id NOT IN (
      SELECT claim_id FROM verification_secrets WHERE claim_id IS NOT NULL
    )
  `);

  // Mark applied
  await query(`INSERT INTO schema_migrations (id) VALUES ($1)`, [MIGRATION_ID]);

  console.log('✅ Migration 008 completed successfully');
}