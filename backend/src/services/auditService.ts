import { Request } from 'express';
import { query } from '../config/database';
import { AuditAction } from '../types';

// ============================================
// AUDIT LOGGING SERVICE
// ============================================

export interface AuditLogEntry {
  actorId?: number;
  action: AuditAction | string;
  resourceType: string;
  resourceId?: number;
  changes?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

export async function logAudit(entry: AuditLogEntry): Promise<void> {
  try {
    await query(
      `INSERT INTO audit_logs (actor_id, action, resource_type, resource_id, changes, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        entry.actorId || null,
        entry.action,
        entry.resourceType,
        entry.resourceId || null,
        entry.changes ? JSON.stringify(entry.changes) : null,
        entry.ipAddress || null,
        entry.userAgent || null
      ]
    );
  } catch (error) {
    console.error('Failed to create audit log:', error);
    // Don't throw - audit logging should not break main flow
  }
}

// Helper to extract request metadata
export function extractRequestMeta(req: Request): { ipAddress?: string; userAgent?: string } {
  return {
    ipAddress: req.ip || req.socket.remoteAddress,
    userAgent: req.headers['user-agent']
  };
}

// Convenience functions for common audit actions
export async function logCreate(
  req: Request,
  resourceType: string,
  resourceId: number,
  data: Record<string, any>
): Promise<void> {
  const { ipAddress, userAgent } = extractRequestMeta(req);
  await logAudit({
    actorId: req.user?.userId,
    action: AuditAction.CREATE,
    resourceType,
    resourceId,
    changes: { created: data },
    ipAddress,
    userAgent
  });
}

export async function logUpdate(
  req: Request,
  resourceType: string,
  resourceId: number,
  oldData: Record<string, any>,
  newData: Record<string, any>
): Promise<void> {
  const { ipAddress, userAgent } = extractRequestMeta(req);
  await logAudit({
    actorId: req.user?.userId,
    action: AuditAction.UPDATE,
    resourceType,
    resourceId,
    changes: { old: oldData, new: newData },
    ipAddress,
    userAgent
  });
}

export async function logDelete(
  req: Request,
  resourceType: string,
  resourceId: number,
  data: Record<string, any>
): Promise<void> {
  const { ipAddress, userAgent } = extractRequestMeta(req);
  await logAudit({
    actorId: req.user?.userId,
    action: AuditAction.DELETE,
    resourceType,
    resourceId,
    changes: { deleted: data },
    ipAddress,
    userAgent
  });
}

export async function logLogin(req: Request, userId: number): Promise<void> {
  const { ipAddress, userAgent } = extractRequestMeta(req);
  await logAudit({
    actorId: userId,
    action: AuditAction.LOGIN,
    resourceType: 'user',
    resourceId: userId,
    ipAddress,
    userAgent
  });
}

export async function logClaimAttempt(
  req: Request,
  claimId: number,
  success: boolean,
  score: number
): Promise<void> {
  const { ipAddress, userAgent } = extractRequestMeta(req);
  await logAudit({
    actorId: req.user?.userId,
    action: success ? AuditAction.CLAIM_VERIFIED : AuditAction.CLAIM_REJECTED,
    resourceType: 'claim',
    resourceId: claimId,
    changes: { success, score },
    ipAddress,
    userAgent
  });
}

export async function logOtpAction(
  req: Request,
  claimId: number,
  action: 'generated' | 'verified' | 'failed'
): Promise<void> {
  const { ipAddress, userAgent } = extractRequestMeta(req);
  const auditAction = action === 'generated' 
    ? AuditAction.OTP_GENERATED 
    : action === 'verified' 
      ? AuditAction.OTP_VERIFIED 
      : AuditAction.OTP_FAILED;
  
  await logAudit({
    actorId: req.user?.userId,
    action: auditAction,
    resourceType: 'handover',
    resourceId: claimId,
    ipAddress,
    userAgent
  });
}

export async function logTrustScoreChange(
  req: Request | null,
  userId: number,
  change: number,
  reason: string,
  newScore: number
): Promise<void> {
  const meta = req ? extractRequestMeta(req) : {};
  await logAudit({
    actorId: req?.user?.userId,
    action: AuditAction.TRUST_SCORE_CHANGED,
    resourceType: 'user',
    resourceId: userId,
    changes: { change, reason, newScore },
    ...meta
  });
}

export async function logModeration(
  req: Request,
  action: string,
  resourceType: string,
  resourceId: number,
  details: Record<string, any>
): Promise<void> {
  const { ipAddress, userAgent } = extractRequestMeta(req);
  await logAudit({
    actorId: req.user?.userId,
    action,
    resourceType,
    resourceId,
    changes: details,
    ipAddress,
    userAgent
  });
}

// Retrieve audit logs with filtering
export interface AuditLogFilter {
  actorId?: number;
  action?: string;
  resourceType?: string;
  resourceId?: number;
  fromDate?: Date;
  toDate?: Date;
  page?: number;
  limit?: number;
}

export async function getAuditLogs(filter: AuditLogFilter) {
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (filter.actorId) {
    conditions.push(`actor_id = $${paramIndex++}`);
    params.push(filter.actorId);
  }

  if (filter.action) {
    conditions.push(`action = $${paramIndex++}`);
    params.push(filter.action);
  }

  if (filter.resourceType) {
    conditions.push(`resource_type = $${paramIndex++}`);
    params.push(filter.resourceType);
  }

  if (filter.resourceId) {
    conditions.push(`resource_id = $${paramIndex++}`);
    params.push(filter.resourceId);
  }

  if (filter.fromDate) {
    conditions.push(`timestamp >= $${paramIndex++}`);
    params.push(filter.fromDate);
  }

  if (filter.toDate) {
    conditions.push(`timestamp <= $${paramIndex++}`);
    params.push(filter.toDate);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = filter.limit || 50;
  const offset = ((filter.page || 1) - 1) * limit;

  // Get total count
  const countResult = await query(
    `SELECT COUNT(*) FROM audit_logs ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0].count);

  // Get logs
  const result = await query(
    `SELECT al.*, u.name as actor_name, u.email as actor_email
     FROM audit_logs al
     LEFT JOIN users u ON al.actor_id = u.id
     ${whereClause}
     ORDER BY al.timestamp DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
    [...params, limit, offset]
  );

  return {
    logs: result.rows,
    pagination: {
      page: filter.page || 1,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
}
