// ============================================
// DATABASE MIGRATION
// ============================================

import { query } from '../config/database';

export async function runGapFixMigration(): Promise<void> {
  console.log('🔄 Running gap fix migration...\n');

  // 1. Account lockout columns
  console.log('  → Adding account lockout columns...');
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INT DEFAULT 0`);
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_failed_login TIMESTAMP`);

  // 2. Consent tracking
  console.log('  → Adding consent tracking column...');
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS accepted_terms_at TIMESTAMP`);

  // 3. Update existing users to have consent (grandfathered)
  await query(`UPDATE users SET accepted_terms_at = created_at WHERE accepted_terms_at IS NULL`);

  console.log('\n✅ Voila! migration complete!');
}

// Direct execution
if (require.main === module) {
  require('dotenv').config();
  runGapFixMigration()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}
