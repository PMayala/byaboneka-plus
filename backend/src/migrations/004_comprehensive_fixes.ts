// ============================================
// DATABASE MIGRATION 004: Comprehensive Production Fixes
// Addresses ALL remaining gaps from the audit and gap analysis
// ============================================

import { query } from '../config/database';

export async function runComprehensiveFixMigration(): Promise<void> {
  console.log('🔄 Running comprehensive fix migration (004)...\n');

  // ── 1. Lost items: support image uploads (was only on found items) ──
  console.log('  → Adding image_urls column to lost_items...');
  await query(`ALTER TABLE lost_items ADD COLUMN IF NOT EXISTS image_urls TEXT[] DEFAULT '{}'`);

  // ── 2. Expiry warning tracking for lost items ──
  console.log('  → Adding expiry_warning_sent to lost_items...');
  await query(`ALTER TABLE lost_items ADD COLUMN IF NOT EXISTS expiry_warning_sent BOOLEAN DEFAULT false`);

  // ── 3. Expiry warning tracking for found items (if missing) ──
  console.log('  → Ensuring expiry_warning_sent exists on found_items...');
  await query(`ALTER TABLE found_items ADD COLUMN IF NOT EXISTS expiry_warning_sent BOOLEAN DEFAULT false`);

  // ── 4. Expired_at columns ──
  console.log('  → Adding expired_at columns...');
  await query(`ALTER TABLE lost_items ADD COLUMN IF NOT EXISTS expired_at TIMESTAMP`);
  await query(`ALTER TABLE found_items ADD COLUMN IF NOT EXISTS expired_at TIMESTAMP`);

  // ── 5. Match dismissal table ──
  console.log('  → Creating match_dismissals table...');
  await query(`
    CREATE TABLE IF NOT EXISTS match_dismissals (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      lost_item_id INTEGER REFERENCES lost_items(id) ON DELETE CASCADE,
      found_item_id INTEGER REFERENCES found_items(id) ON DELETE CASCADE,
      dismissed_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(user_id, lost_item_id, found_item_id)
    )
  `);

  // ── 6. Safe handover locations table ──
  console.log('  → Creating safe_handover_locations table...');
  await query(`
    CREATE TABLE IF NOT EXISTS safe_handover_locations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      type VARCHAR(50) NOT NULL DEFAULT 'OTHER',
      area VARCHAR(100) NOT NULL,
      address TEXT,
      latitude DECIMAL(10, 8),
      longitude DECIMAL(11, 8),
      operating_hours VARCHAR(255),
      safety_rating INTEGER DEFAULT 3 CHECK (safety_rating BETWEEN 1 AND 5),
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // ── 7. Insert default safe handover locations for Kigali ──
  console.log('  → Inserting default safe handover locations...');
  const locationCount = await query(`SELECT COUNT(*) FROM safe_handover_locations`);
  if (parseInt(locationCount.rows[0].count) === 0) {
    await query(`
      INSERT INTO safe_handover_locations (name, type, area, address, operating_hours, safety_rating)
      VALUES
        ('Kimironko Sector Office', 'SECTOR_OFFICE', 'Kimironko', 'Kimironko, Gasabo District', '8:00 - 17:00 Mon-Fri', 5),
        ('Remera Police Post', 'POLICE_POST', 'Remera', 'KG 11 Ave, Remera', '24/7', 5),
        ('Kacyiru Sector Office', 'SECTOR_OFFICE', 'Kacyiru', 'Kacyiru, Gasabo District', '8:00 - 17:00 Mon-Fri', 5),
        ('Nyabugogo Bus Terminal', 'TRANSIT_HUB', 'Nyabugogo', 'Nyabugogo Bus Terminal', '6:00 - 20:00 Daily', 4),
        ('Kigali Bus Terminal Downtown', 'TRANSIT_HUB', 'Muhima', 'KN 4 Ave, Muhima', '6:00 - 21:00 Daily', 4),
        ('Royal Express Cooperative Office', 'COOP_OFFICE', 'Remera', 'KG 9 Ave, Remera', '7:00 - 18:00 Mon-Sat', 4),
        ('RFTC Head Office', 'COOP_OFFICE', 'Kacyiru', 'Kacyiru, Gasabo District', '8:00 - 17:00 Mon-Fri', 4),
        ('Gisozi Sector Office', 'SECTOR_OFFICE', 'Gisozi', 'Gisozi, Gasabo District', '8:00 - 17:00 Mon-Fri', 5),
        ('Kicukiro Sector Office', 'SECTOR_OFFICE', 'Kicukiro', 'Kicukiro District', '8:00 - 17:00 Mon-Fri', 5),
        ('Nyamirambo Police Post', 'POLICE_POST', 'Nyamirambo', 'KN 45 St, Nyamirambo', '24/7', 5),
        ('Kanombe Sector Office', 'SECTOR_OFFICE', 'Kanombe', 'Kanombe, Kicukiro District', '8:00 - 17:00 Mon-Fri', 5),
        ('Muhima Sector Office', 'SECTOR_OFFICE', 'Muhima', 'Muhima, Nyarugenge District', '8:00 - 17:00 Mon-Fri', 5),
        ('Kimisagara Sector Office', 'SECTOR_OFFICE', 'Kimisagara', 'Kimisagara, Nyarugenge District', '8:00 - 17:00 Mon-Fri', 5),
        ('Huye District Office', 'SECTOR_OFFICE', 'Huye', 'Huye District', '8:00 - 17:00 Mon-Fri', 5),
        ('Musanze District Office', 'SECTOR_OFFICE', 'Musanze', 'Musanze District', '8:00 - 17:00 Mon-Fri', 5),
        ('Rubavu District Office', 'SECTOR_OFFICE', 'Rubavu', 'Rubavu District', '8:00 - 17:00 Mon-Fri', 5)
      ON CONFLICT DO NOTHING
    `);
  }

  // ── 8. Contact messages table (store contact form submissions) ──
  console.log('  → Creating contact_messages table...');
  await query(`
    CREATE TABLE IF NOT EXISTS contact_messages (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      ip_address VARCHAR(45),
      read BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // ── 9. Subcategory field for items (ALGO-3.1.2) ──
  console.log('  → Adding subcategory columns...');
  await query(`ALTER TABLE lost_items ADD COLUMN IF NOT EXISTS subcategory VARCHAR(100)`);
  await query(`ALTER TABLE found_items ADD COLUMN IF NOT EXISTS subcategory VARCHAR(100)`);

  // ── 10. Data retention: archived_at tracking ──
  console.log('  → Adding archived_at columns...');
  await query(`ALTER TABLE lost_items ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP`);
  await query(`ALTER TABLE found_items ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP`);

  // ── 11. Handover location tracking on claims ──
  console.log('  → Adding handover location columns to claims...');
  await query(`ALTER TABLE claims ADD COLUMN IF NOT EXISTS handover_location_id INTEGER REFERENCES safe_handover_locations(id)`);
  await query(`ALTER TABLE claims ADD COLUMN IF NOT EXISTS handover_location_acknowledged BOOLEAN DEFAULT false`);

  // ── 12. Password reset rate limiting tracking ──
  console.log('  → Adding password reset tracking...');
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_count INTEGER DEFAULT 0`);
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_password_reset_request TIMESTAMP`);

  console.log('\n✅ Comprehensive fix migration (004) complete!');
}

// Direct execution
if (require.main === module) {
  require('dotenv').config();
  runComprehensiveFixMigration()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}