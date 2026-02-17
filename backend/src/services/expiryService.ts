import { query, transaction } from '../config/database';
import { logAudit } from './auditService';
import { clearStaleMatches } from './matchingService';

// ============================================
// AUTO-EXPIRY SERVICE
// Handles automatic expiration of stale reports
// ============================================

const EXPIRY_DAYS = 30; // Items expire after 30 days of inactivity
const WARNING_DAYS = 25; // Warn owners 5 days before expiry

// Expire old lost items
export async function expireLostItems(): Promise<{ expired: number; warned: number }> {
  let expired = 0;
  let warned = 0;

  // Find items to expire
  const toExpire = await query(
    `SELECT id, user_id, title FROM lost_items
     WHERE status = 'ACTIVE'
     AND created_at < NOW() - INTERVAL '${EXPIRY_DAYS} days'`
  );

  for (const item of toExpire.rows) {
    await query(
      `UPDATE lost_items SET status = 'EXPIRED', expired_at = NOW() WHERE id = $1`,
      [item.id]
    );
    
    // Log expiry
    await query(
      `INSERT INTO audit_logs (actor_id, action, resource_type, resource_id, changes)
       VALUES (NULL, 'AUTO_EXPIRED', 'lost_item', $1, $2)`,
      [item.id, JSON.stringify({ reason: 'inactivity', title: item.title })]
    );
    
    expired++;
  }

  // Find items to warn
  const toWarn = await query(
    `SELECT id, user_id, title FROM lost_items
     WHERE status = 'ACTIVE'
     AND expiry_warning_sent = FALSE
     AND created_at < NOW() - INTERVAL '${WARNING_DAYS} days'
     AND created_at >= NOW() - INTERVAL '${EXPIRY_DAYS} days'`
  );

  for (const item of toWarn.rows) {
    await query(
      `UPDATE lost_items SET expiry_warning_sent = TRUE WHERE id = $1`,
      [item.id]
    );
    
    // In production, send email notification here
    warned++;
  }

  return { expired, warned };
}

// Expire old found items
export async function expireFoundItems(): Promise<{ expired: number; warned: number }> {
  let expired = 0;
  let warned = 0;

  // Find items to expire
  const toExpire = await query(
    `SELECT id, finder_id, title FROM found_items
     WHERE status IN ('UNCLAIMED', 'MATCHED')
     AND created_at < NOW() - INTERVAL '${EXPIRY_DAYS} days'`
  );

  for (const item of toExpire.rows) {
    await query(
      `UPDATE found_items SET status = 'EXPIRED', expired_at = NOW() WHERE id = $1`,
      [item.id]
    );
    
    await query(
      `INSERT INTO audit_logs (actor_id, action, resource_type, resource_id, changes)
       VALUES (NULL, 'AUTO_EXPIRED', 'found_item', $1, $2)`,
      [item.id, JSON.stringify({ reason: 'inactivity', title: item.title })]
    );
    
    expired++;
  }

  // Find items to warn
  const toWarn = await query(
    `SELECT id, finder_id, title FROM found_items
     WHERE status IN ('UNCLAIMED', 'MATCHED')
     AND expiry_warning_sent = FALSE
     AND created_at < NOW() - INTERVAL '${WARNING_DAYS} days'
     AND created_at >= NOW() - INTERVAL '${EXPIRY_DAYS} days'`
  );

  for (const item of toWarn.rows) {
    await query(
      `UPDATE found_items SET expiry_warning_sent = TRUE WHERE id = $1`,
      [item.id]
    );
    
    warned++;
  }

  return { expired, warned };
}

// Expire stale claims
export async function expireStaleClaims(): Promise<number> {
  const result = await query(
    `UPDATE claims SET status = 'EXPIRED'
     WHERE status = 'PENDING'
     AND created_at < NOW() - INTERVAL '7 days'
     RETURNING id`
  );
  
  return result.rowCount || 0;
}

// Revoke expired OTPs (cleanup only, validation already checks expiry)
export async function cleanupExpiredOTPs(): Promise<number> {
  const result = await query(
    `DELETE FROM handover_confirmations
     WHERE otp_expires_at < NOW() - INTERVAL '7 days'
     AND otp_verified = FALSE
     RETURNING id`
  );
  
  return result.rowCount || 0;
}

// Clean up old audit logs (keep 90 days)
export async function cleanupOldAuditLogs(): Promise<number> {
  const result = await query(
    `DELETE FROM audit_logs
     WHERE timestamp < NOW() - INTERVAL '90 days'
     RETURNING id`
  );
  
  return result.rowCount || 0;
}

// Clean up expired tokens
export async function cleanupExpiredTokens(): Promise<{ refresh: number; reset: number }> {
  const refreshResult = await query(
    `DELETE FROM refresh_tokens
     WHERE expires_at < NOW()
     RETURNING id`
  );
  
  const resetResult = await query(
    `DELETE FROM password_reset_tokens
     WHERE expires_at < NOW()
     RETURNING id`
  );
  
  return {
    refresh: refreshResult.rowCount || 0,
    reset: resetResult.rowCount || 0
  };
}

// Main cleanup job - run daily
export async function runDailyCleanup(): Promise<void> {
  console.log('🧹 Starting daily cleanup job...');
  
  try {
    const lostExpiry = await expireLostItems();
    console.log(`  Lost items: ${lostExpiry.expired} expired, ${lostExpiry.warned} warned`);
    
    const foundExpiry = await expireFoundItems();
    console.log(`  Found items: ${foundExpiry.expired} expired, ${foundExpiry.warned} warned`);
    
    const staleClaims = await expireStaleClaims();
    console.log(`  Stale claims expired: ${staleClaims}`);
    
    const staleMatches = await clearStaleMatches();
    console.log(`  Stale matches cleared: ${staleMatches}`);
    
    const expiredOTPs = await cleanupExpiredOTPs();
    console.log(`  Expired OTPs cleaned: ${expiredOTPs}`);
    
    const tokens = await cleanupExpiredTokens();
    console.log(`  Expired tokens cleaned: ${tokens.refresh} refresh, ${tokens.reset} reset`);
    
    // Note: Audit log cleanup is optional, keep for compliance
    // const auditLogs = await cleanupOldAuditLogs();
    // console.log(`  Old audit logs cleaned: ${auditLogs}`);
    
    console.log('✅ Daily cleanup completed successfully');
  } catch (error) {
    console.error('❌ Daily cleanup failed:', error);
    throw error;
  }
}

// Export for manual triggering or cron job
export default {
  expireLostItems,
  expireFoundItems,
  expireStaleClaims,
  cleanupExpiredOTPs,
  cleanupExpiredTokens,
  cleanupOldAuditLogs,
  runDailyCleanup
};