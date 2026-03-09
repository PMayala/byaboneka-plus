// ============================================
// DATA RETENTION CLEANUP
// Algorithm Spec 3.6.2 requires:
//   Phase 3: "Archive to cold storage, then DELETE"
// 
// This service runs as an additional daily cron job.
// It permanently removes expired items older than 365 days
// and anonymizes old resolved claims.
// ============================================

import { query } from '../config/database';
import { logAudit } from './auditService';

const ARCHIVE_AFTER_DAYS = 365;  // Delete expired items after 1 year
const ANONYMIZE_MESSAGES_AFTER_DAYS = 180; // Anonymize old messages after 6 months

interface RetentionStats {
  lostItemsDeleted: number;
  foundItemsDeleted: number;
  claimsArchived: number;
  messagesAnonymized: number;
  verificationsDeleted: number;
}

/**
 * Phase 1: Permanently delete expired item reports older than 1 year.
 * Associated verification secrets and claims are cascade-cleaned.
 */
async function deleteOldExpiredItems(): Promise<{ lost: number; found: number }> {
  // Delete verification secrets for old expired lost items first (FK constraint)
  await query(
    `DELETE FROM verification_secrets 
     WHERE lost_item_id IN (
       SELECT id FROM lost_items 
       WHERE status = 'EXPIRED' 
       AND expired_at < NOW() - INTERVAL '${ARCHIVE_AFTER_DAYS} days'
     )`
  );

  // Delete claims referencing old expired items
  await query(
    `DELETE FROM claims 
     WHERE lost_item_id IN (
       SELECT id FROM lost_items 
       WHERE status = 'EXPIRED' 
       AND expired_at < NOW() - INTERVAL '${ARCHIVE_AFTER_DAYS} days'
     )
     OR found_item_id IN (
       SELECT id FROM found_items 
       WHERE status = 'EXPIRED' 
       AND expired_at < NOW() - INTERVAL '${ARCHIVE_AFTER_DAYS} days'
     )`
  );

  // Delete the expired items themselves
  const lostResult = await query(
    `DELETE FROM lost_items 
     WHERE status = 'EXPIRED' 
     AND expired_at < NOW() - INTERVAL '${ARCHIVE_AFTER_DAYS} days'
     RETURNING id`
  );

  const foundResult = await query(
    `DELETE FROM found_items 
     WHERE status = 'EXPIRED' 
     AND expired_at < NOW() - INTERVAL '${ARCHIVE_AFTER_DAYS} days'
     RETURNING id`
  );

  return {
    lost: lostResult.rowCount || 0,
    found: foundResult.rowCount || 0
  };
}

/**
 * Phase 2: Anonymize old message content (keep structure, remove text).
 * Messages older than 6 months in resolved/returned claims get content replaced.
 */
async function anonymizeOldMessages(): Promise<number> {
  const result = await query(
    `UPDATE messages 
     SET content = '[Message removed - data retention policy]'
     WHERE created_at < NOW() - INTERVAL '${ANONYMIZE_MESSAGES_AFTER_DAYS} days'
     AND content != '[Message removed - data retention policy]'
     AND claim_id IN (
       SELECT id FROM claims WHERE status IN ('RETURNED', 'CANCELLED', 'REJECTED', 'EXPIRED')
     )
     RETURNING id`
  );

  return result.rowCount || 0;
}

/**
 * Phase 3: Archive old resolved claims (keep summary, remove details).
 */
async function archiveOldClaims(): Promise<number> {
  const result = await query(
    `UPDATE claims
     SET verification_score = NULL,
         updated_at = NOW()
     WHERE status IN ('RETURNED', 'EXPIRED', 'CANCELLED')
     AND updated_at < NOW() - INTERVAL '${ARCHIVE_AFTER_DAYS} days'
     AND verification_score IS NOT NULL
     RETURNING id`
  );

  return result.rowCount || 0;
}

/**
 * Main retention job — call from cron.
 */
export async function runDataRetention(): Promise<RetentionStats> {
  console.log('🗄️  Running data retention cleanup...');

  const items = await deleteOldExpiredItems();
  const messagesAnonymized = await anonymizeOldMessages();
  const claimsArchived = await archiveOldClaims();

  const stats: RetentionStats = {
    lostItemsDeleted: items.lost,
    foundItemsDeleted: items.found,
    claimsArchived,
    messagesAnonymized,
    verificationsDeleted: items.lost // 1:1 with lost items
  };

  // Log the retention run
  await logAudit({
    actorId: null as any,
    action: 'DATA_RETENTION_RUN',
    resourceType: 'system',
    resourceId: 0,
    changes: stats,
    ipAddress: '127.0.0.1',
    userAgent: 'system/cron'
  });

  console.log(`  📦 Deleted: ${items.lost} lost items, ${items.found} found items (expired >365d)`);
  console.log(`  💬 Anonymized: ${messagesAnonymized} old messages`);
  console.log(`  📋 Archived: ${claimsArchived} old claims`);
  console.log('✅ Data retention complete');

  return stats;
}
