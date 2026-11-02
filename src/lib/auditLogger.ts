/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AuditLogEntry, UserRole } from '../types';
import { insertAuditLog } from './api';

export async function logAuditEvent(params: {
  actorUid: string;
  actorEmail: string;
  actorRole: UserRole | 'SYSTEM';
  action: string;
  entityType: AuditLogEntry['entityType'];
  entityId: string;
  details: Record<string, unknown> | string;
}): Promise<void> {
  const safeDetails = typeof params.details === 'string'
    ? params.details
    : JSON.stringify(sanitizeLogPayload(params.details));

  try {
    await insertAuditLog({
      actorUid: params.actorUid || 'SYSTEM',
      actorEmail: params.actorEmail || 'system@topclues.in',
      actorRole: params.actorRole || 'SYSTEM',
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      timestamp: new Date().toISOString(),
      details: safeDetails,
      ipAddress: 'client-web',
    });
  } catch (error) {
    // Audit logs must never break the application if the write fails
    console.warn('Failed to record audit log event:', error);
  }
}

/**
 * Remove sensitive data like raw account numbers or keys before recording logs
 */
function sanitizeLogPayload(obj: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (
      lowerKey.includes('password') ||
      lowerKey.includes('token') ||
      lowerKey.includes('secret') ||
      lowerKey.includes('privatekey')
    ) {
      sanitized[key] = '[REDACTED]';
    } else if (lowerKey.includes('accountnumber') && typeof val === 'string' && val.length > 4) {
      sanitized[key] = 'XXXXXX' + val.slice(-4);
    } else if (val && typeof val === 'object' && !Array.isArray(val)) {
      sanitized[key] = sanitizeLogPayload(val as Record<string, unknown>);
    } else {
      sanitized[key] = val;
    }
  }
  return sanitized;
}
