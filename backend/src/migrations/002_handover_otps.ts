import { query } from '../config/database';

export async function up(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS handover_otps (
      id SERIAL PRIMARY KEY,
      claim_id INT NOT NULL UNIQUE REFERENCES claims(id) ON DELETE CASCADE,
      otp_hash VARCHAR(255) NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      used_at TIMESTAMP NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_handover_otps_claim_id ON handover_otps(claim_id);
    CREATE INDEX IF NOT EXISTS idx_handover_otps_expires_at ON handover_otps(expires_at);
  `);
}

export async function down(): Promise<void> {
  await query(`
    DROP TABLE IF EXISTS handover_otps;
  `);
}
