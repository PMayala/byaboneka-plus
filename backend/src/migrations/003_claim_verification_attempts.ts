import { query } from '../config/database';

export async function up(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS claim_verification_attempts (
      id SERIAL PRIMARY KEY,
      claim_id INT NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
      user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      attempted_at TIMESTAMP NOT NULL DEFAULT NOW(),
      success BOOLEAN NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_cva_claim_user_time
      ON claim_verification_attempts(claim_id, user_id, attempted_at DESC);
  `);
}

export async function down(): Promise<void> {
  await query(`
    DROP TABLE IF EXISTS claim_verification_attempts;
  `);
}
