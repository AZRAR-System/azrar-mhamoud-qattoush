/**
 * سجل تدقيق — آخر 500 عملية في KV (db_audit_log).
 */

import type { المستخدمين_tbl } from '@/types';
import { get, save } from '@/services/db/kv';
import { KEYS } from '@/services/db/keys';

const MAX = 500;

export type AuditLogRecord = {
  id: string;
  userId?: string;
  userName: string;
  action: string;
  entity: string;
  entityId?: string;
  details?: string;
  timestamp: string;
  ip?: string;
};

function resolveUserIdByUsername(username: string): string | undefined {
  const u = String(username || '').trim();
  if (!u || u === 'System') return undefined;
  const users = get<المستخدمين_tbl>(KEYS.USERS);
  const row = users.find((x) => String(x.اسم_المستخدم || '').trim() === u);
  return row?.id;
}

function currentActorFromStorage(): { userId?: string; userName: string } {
  if (typeof localStorage === 'undefined') return { userName: 'System' };
  try {
    const raw = localStorage.getItem('khaberni_user');
    if (!raw) return { userName: 'System' };
    const u = JSON.parse(raw) as Record<string, unknown>;
    const id = String(u?.id ?? '').trim();
    const name = String(u?.اسم_للعرض ?? u?.اسم_المستخدم ?? 'User').trim();
    return { userId: id || undefined, userName: name || 'User' };
  } catch {
    return { userName: 'System' };
  }
}

export const auditLog = {
  /**
   * تسجيل عملية (يُستدعى من الواجهة أو من طبقة السجلات الموحدة).
   */
  record(
    action: string,
    entity: string,
    entityId?: string,
    details?: string,
    opts?: { userId?: string; userName?: string; ip?: string }
  ): AuditLogRecord {
    const actor = opts?.userName
      ? { userId: opts.userId, userName: opts.userName }
      : currentActorFromStorage();

    let userId = opts?.userId ?? actor.userId;
    const userName = opts?.userName ?? actor.userName;
    if (!userId && userName && userName !== 'System') {
      userId = resolveUserIdByUsername(userName);
    }

    const rec: AuditLogRecord = {
      id: `AUD-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      userId,
      userName,
      action,
      entity,
      entityId: entityId?.trim() || undefined,
      details: details?.trim() || undefined,
      timestamp: new Date().toISOString(),
      ip: opts?.ip,
    };

    const all = get<AuditLogRecord>(KEYS.AUDIT_LOG);
    const next = [rec, ...all.filter((x) => x && typeof x === 'object')].slice(0, MAX);
    save(KEYS.AUDIT_LOG, next);
    try {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('azrar:db-changed', { detail: { key: KEYS.AUDIT_LOG } }));
      }
    } catch {
      /* ignore */
    }
    return rec;
  },

  /** مزامنة مع سجل العمليات القديم (logOperationInternal). */
  appendFromLegacyLog(
    user: string,
    action: string,
    table: string,
    recordId: string,
    details: string,
    meta?: { ipAddress?: string; deviceInfo?: string }
  ): void {
    this.record(action, table, recordId === 'N/A' ? undefined : recordId, details, {
      userName: user || 'System',
      userId: resolveUserIdByUsername(user),
      ip: meta?.ipAddress,
    });
  },

  getAll(): AuditLogRecord[] {
    return get<AuditLogRecord>(KEYS.AUDIT_LOG).filter(
      (x) => x && typeof x === 'object' && typeof x.id === 'string'
    );
  },
};
