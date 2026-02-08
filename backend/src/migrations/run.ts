import dotenv from 'dotenv';
dotenv.config();

import { runMigrations } from './001_initial';
import { closePool } from '../config/database';

async function main() {
  try {
    await runMigrations();
    console.log('✅ All migrations completed');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await closePool();
  }
}

main();
