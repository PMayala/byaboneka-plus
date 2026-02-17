import dotenv from 'dotenv';
dotenv.config();

import { rollbackMigrations } from './001_initial';
import { closePool } from '../config/database';

async function main() {
  try {
    await rollbackMigrations();
    console.log('✅ Rollback completed');
  } catch (error) {
    console.error('❌ Rollback failed:', error);
    process.exit(1);
  } finally {
    await closePool();
  }
}

main();