// backend/src/migrations/007_logic_refactor.ts  (PATCHED)
//
// ADDED: export alias so run.ts can import { runLogicRefactorMigration }
// All other logic is unchanged from original.

import { query } from '../config/database';

/**
 * Migration 007: Logic Refactor
 *
 * Changes the verification flow:
 * - Verification secrets are now linked to claims (not lost items)
 * - Finder sets questions, owner answers them
 * - Photos on found items are marked private
 * - New claim statuses: PENDING_QUESTIONS
 */
export async function up(): Promise<void> {
  console.log('🚀 Running migration 007: Logic Refactor...');

  // 1. Add new claim statuses
  await query(`
    DO $$ BEGIN
      ALTER TYPE claim_status ADD VALUE IF NOT EXISTS 'PENDING_QUESTIONS';
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;
  `);

  // 2. Add claim_id and created_by to verification_secrets
  console.log('  → Adding claim_id and created_by to verification_secrets...');
  await query(
    `ALTER TABLE verification_secrets ADD COLUMN IF NOT EXISTS claim_id INTEGER REFERENCES claims(id) ON DELETE CASCADE`
  );
  await query(
    `ALTER TABLE verification_secrets ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id)`
  );

  // 3. Make lost_item_id nullable (new secrets won't have it)
  console.log('  → Making lost_item_id nullable on verification_secrets...');
  await query(
    `ALTER TABLE verification_secrets ALTER COLUMN lost_item_id DROP NOT NULL`
  ).catch(() => { /* may already be nullable */ });

  // 4. Drop the old unique constraint on lost_item_id and add one for claim_id
  console.log('  → Updating unique constraints...');
  await query(`
    DO $$ BEGIN
      ALTER TABLE verification_secrets DROP CONSTRAINT IF EXISTS verification_secrets_lost_item_id_key;
    EXCEPTION WHEN undefined_object THEN null;
    END $$;
  `);
  await query(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_verification_secrets_claim_unique ON verification_secrets(claim_id) WHERE claim_id IS NOT NULL`
  );

  // 5. Add indexes
  console.log('  → Creating new indexes...');
  await query(
    `CREATE INDEX IF NOT EXISTS idx_verification_secrets_claim ON verification_secrets(claim_id)`
  );
  await query(
    `CREATE INDEX IF NOT EXISTS idx_verification_secrets_created_by ON verification_secrets(created_by)`
  );

  // 6. Add images_private flag to found_items
  console.log('  → Adding images_private flag to found_items...');
  await query(
    `ALTER TABLE found_items ADD COLUMN IF NOT EXISTS images_private BOOLEAN NOT NULL DEFAULT TRUE`
  );

  // 7. Migrate existing data: link old verification_secrets to their claims where possible
  console.log('  → Migrating existing verification secrets to claim-based...');
  await query(`
    UPDATE verification_secrets vs
    SET claim_id = c.id
    FROM claims c
    WHERE c.lost_item_id = vs.lost_item_id
    AND vs.claim_id IS NULL
    AND c.status IN ('PENDING', 'VERIFIED', 'RETURNED')
  `);

  console.log('✅ Migration 007 completed successfully');
}

export async function down(): Promise<void> {
  console.log('🔄 Rolling back migration 007...');
  await query(`ALTER TABLE verification_secrets DROP COLUMN IF EXISTS claim_id`);
  await query(`ALTER TABLE verification_secrets DROP COLUMN IF EXISTS created_by`);
  await query(`ALTER TABLE found_items DROP COLUMN IF EXISTS images_private`);
}

// FIX: Export alias so run.ts can import { runLogicRefactorMigration }
export const runLogicRefactorMigration = up;

// Direct execution
if (require.main === module) {
  up()
    .then(() => {
      console.log('Done');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}