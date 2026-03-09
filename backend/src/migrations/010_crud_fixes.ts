import { query } from '../config/database';

export async function runCrudFixMigration(): Promise<void> {
  console.log('🔧 Running migration 010: CRUD & Delete Fixes...');

  const fixFK = async (
    table: string,
    column: string,
    refTable: string,
    refColumn: string,
    onDelete: 'CASCADE' | 'SET NULL'
  ) => {
    const constraintName = `fk_${table}_${column}`;
    try {
      const existing = await query(`
        SELECT tc.constraint_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_name = $1
          AND kcu.column_name = $2
          AND tc.table_schema = 'public'
      `, [table, column]);

      for (const row of existing.rows) {
        await query(`ALTER TABLE ${table} DROP CONSTRAINT IF EXISTS "${row.constraint_name}"`);
      }

      await query(`
        ALTER TABLE ${table}
        ADD CONSTRAINT ${constraintName}
        FOREIGN KEY (${column}) REFERENCES ${refTable}(${refColumn})
        ON DELETE ${onDelete}
      `);
      console.log(`  ✅ ${table}.${column} → ${refTable}(${refColumn}) ON DELETE ${onDelete}`);
    } catch (err: any) {
      console.warn(`  ⚠️  FK fix for ${table}.${column}: ${err.message}`);
    }
  };

  // claims → items: CASCADE so deleting an item deletes its claims
  await fixFK('claims', 'lost_item_id', 'lost_items', 'id', 'CASCADE');
  await fixFK('claims', 'found_item_id', 'found_items', 'id', 'CASCADE');

  // scam_reports → claims: SET NULL
  await fixFK('scam_reports', 'claim_id', 'claims', 'id', 'SET NULL');

  // matches → items: CASCADE
  await fixFK('matches', 'lost_item_id', 'lost_items', 'id', 'CASCADE');
  await fixFK('matches', 'found_item_id', 'found_items', 'id', 'CASCADE');

  // match_dismissals → items: CASCADE (if table exists)
  const tableCheck = async (name: string) => {
    const r = await query(`SELECT 1 FROM information_schema.tables WHERE table_name=$1 AND table_schema='public'`, [name]);
    return r.rows.length > 0;
  };

  if (await tableCheck('match_dismissals')) {
    await fixFK('match_dismissals', 'lost_item_id', 'lost_items', 'id', 'CASCADE');
    await fixFK('match_dismissals', 'found_item_id', 'found_items', 'id', 'CASCADE');
  }

  if (await tableCheck('trust_events')) {
    try { await fixFK('trust_events', 'claim_id', 'claims', 'id', 'SET NULL'); } catch {}
  }

  if (await tableCheck('verification_questions')) {
    try { await fixFK('verification_questions', 'claim_id', 'claims', 'id', 'CASCADE'); } catch {}
  }

  // Add PENDING_QUESTIONS to claim_status enum if not present
  try {
    await query(`ALTER TYPE claim_status ADD VALUE IF NOT EXISTS 'PENDING_QUESTIONS'`);
    console.log('  ✅ Added PENDING_QUESTIONS to claim_status enum');
  } catch (err: any) {
    // Already exists or not supported
    console.log('  ℹ️  PENDING_QUESTIONS enum:', err.message);
  }

  // Add missing columns for verification_secrets to support claim_id based lookup
  try {
    await query(`ALTER TABLE verification_secrets ADD COLUMN IF NOT EXISTS claim_id INTEGER REFERENCES claims(id) ON DELETE CASCADE`);
    await query(`ALTER TABLE verification_secrets ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id)`);
    console.log('  ✅ Added claim_id, created_by to verification_secrets');
  } catch (err: any) {
    console.warn('  ⚠️  verification_secrets columns:', err.message);
  }

  // Fix messages.sender_id to allow NULL (for account deletion anonymization)
  try {
    await query(`ALTER TABLE messages ALTER COLUMN sender_id DROP NOT NULL`);
    console.log('  ✅ messages.sender_id now nullable');
  } catch (err: any) {
    console.warn('  ⚠️  messages.sender_id:', err.message);
  }

  console.log('✅ Migration 010 completed');
}