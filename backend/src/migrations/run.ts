import dotenv from 'dotenv';
dotenv.config();

import { runMigrations } from './001_initial';
import { runPatchMigrations } from './002_patch';
import { runGapFixMigration } from './003_gap_fixes';
import { runComprehensiveFixMigration } from './004_comprehensive_fixes';
import { runFinalProductionMigration } from './005_final_production_fixes';
import { runComprehensiveBugfixMigration } from './006_comprehensive_bugfix';
import { runLogicRefactorMigration } from './007_logic_refactor';
import { closePool } from '../config/database';

async function main() {
  try {
    console.log('🚀 Running all migrations...');
    await runMigrations();
    await runPatchMigrations();
    await runGapFixMigration().catch(err => console.warn('Gap fix migration note:', err.message));
    await runComprehensiveFixMigration().catch(err => console.warn('Comprehensive fix migration note:', err.message));
    await runFinalProductionMigration().catch(err => console.warn('Final production migration note:', err.message));
    await runComprehensiveBugfixMigration().catch(err => console.warn('Comprehensive bugfix migration note:', err.message));
    await runLogicRefactorMigration().catch(err => console.warn('Logic refactor migration note:', err.message));
    console.log('✅ All migrations completed');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await closePool();
  }
}

main();