// backend/src/migrations/009_handover_schema_fix.ts
//
// ROOT CAUSE: handover_confirmations was created in migration 001 with columns
//   otp_code_hash  and  otp_expires_at
// but claimsController.ts queries/inserts using:
//   otp_hash       and  expires_at
//
// This mismatch causes PostgreSQL error "column does not exist" on every
// OTP endpoint, breaking all 6 OTP-related integration tests.
//
// Fix: rename the columns to match the controller, and add verified_at
// which the controller also writes but was never created.

import { query } from '../config/database';

const MIGRATION_ID = '009_handover_schema_fix';

export async function runHandoverSchemaFix(): Promise<void> {
  // Idempotency guard
  await query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const already = await query(
    `SELECT 1 FROM schema_migrations WHERE id = $1`,
    [MIGRATION_ID]
  );
  if (already.rows.length > 0) {
    console.log(`↩️  Migration ${MIGRATION_ID} already applied — skipping`);
    return;
  }

  console.log('🚀 Running migration 009: Fix handover_confirmations schema...');

  // 1. Rename otp_code_hash → otp_hash
  //    (controller uses: INSERT INTO handover_confirmations (claim_id, otp_hash, expires_at))
  await query(`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'handover_confirmations' AND column_name = 'otp_code_hash'
      ) THEN
        ALTER TABLE handover_confirmations RENAME COLUMN otp_code_hash TO otp_hash;
        RAISE NOTICE 'Renamed otp_code_hash → otp_hash';
      ELSE
        RAISE NOTICE 'Column otp_hash already exists or otp_code_hash not found — skipping rename';
      END IF;
    END $$;
  `);

  // 2. Rename otp_expires_at → expires_at
  //    (controller uses: WHERE expires_at > NOW())
  await query(`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'handover_confirmations' AND column_name = 'otp_expires_at'
      ) THEN
        ALTER TABLE handover_confirmations RENAME COLUMN otp_expires_at TO expires_at;
        RAISE NOTICE 'Renamed otp_expires_at → expires_at';
      ELSE
        RAISE NOTICE 'Column expires_at already exists or otp_expires_at not found — skipping rename';
      END IF;
    END $$;
  `);

  // 3. Add verified_at column
  //    (controller writes: UPDATE handover_confirmations SET otp_verified = true, verified_at = NOW())
  await query(`
    ALTER TABLE handover_confirmations ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ DEFAULT NULL;
  `);

  // 4. Drop the UNIQUE(claim_id) constraint from 001 if it exists, because the
  //    controller's generateHandoverOTP checks for existing valid OTPs and rejects
  //    if one exists — but old records may block regeneration. The unique constraint
  //    on claim_id is actually fine for one-at-a-time OTPs; keep it.
  //    (No change needed here.)

  // 5. Fix getClaim query: it JOINs handover_confirmations and selects h.otp_expires_at
  //    which is now renamed to h.expires_at. This is a code fix in claimsController.ts,
  //    documented below. The migration itself just fixes the DB.

  // Mark applied
  await query(`INSERT INTO schema_migrations (id) VALUES ($1)`, [MIGRATION_ID]);

  console.log('✅ Migration 009 completed: handover_confirmations columns renamed.');
  console.log('   ⚠️  IMPORTANT: Also update claimsController.ts getClaim query:');
  console.log('      Change "h.otp_expires_at" → "h.expires_at" in the SELECT at ~line 6254');
}

// Direct execution support
if (require.main === module) {
  require('dotenv').config();
  runHandoverSchemaFix()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Migration 009 failed:', err);
      process.exit(1);
    });
}