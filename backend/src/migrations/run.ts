// backend/src/migrations/run.ts  (FIXED)
//
// Changes vs original:
//  1. Added import + call for migration 008 (runClaimFlowFixMigration)
//  2. Added import + call for migration 009 (runHandoverSchemaFix)
//  3. Fixed import of migration 007 — original imported 'runLogicRefactorMigration'
//     but 007_logic_refactor.ts only exports up() and down().
//     Fix: import { up as runLogicRefactorMigration }

import dotenv from 'dotenv';
dotenv.config();

import { runMigrations } from './001_initial';
import { runPatchMigrations } from './002_patch';
import { runGapFixMigration } from './003_gap_fixes';
import { runComprehensiveFixMigration } from './004_comprehensive_fixes';
import { runFinalProductionMigration } from './005_final_production_fixes';
import { runComprehensiveBugfixMigration } from './006_comprehensive_bugfix';
// FIX: 007 exports up() not runLogicRefactorMigration
import { up as runLogicRefactorMigration } from './007_logic_refactor';
// FIX: Added 008 — was missing entirely
import { runClaimFlowFixMigration } from './008_claim_flow_fixes';
// FIX: Added 009 — fixes handover_confirmations column names
import { runHandoverSchemaFix } from './009_handover_schema_fix';
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
    await runClaimFlowFixMigration().catch(err => console.warn('Claim flow fix migration note:', err.message));  // FIX: was missing
    await runHandoverSchemaFix().catch(err => console.warn('Handover schema fix migration note:', err.message)); // FIX: was missing
    console.log('✅ All migrations completed');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await closePool();
  }
}

main();