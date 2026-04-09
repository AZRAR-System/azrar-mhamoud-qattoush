import { get, save } from '../kv';
import { KEYS } from '../keys';
import { العمليات_tbl } from '@/types';
import { auditLog } from '@/services/auditLog';

export type LogMeta = {
  ipAddress?: string;
  deviceInfo?: string;
};

/**
 * سجل العمليات (Internal logger for all DB mutations)
 */
export const logOperationInternal = (
  user: string,
  action: string,
  table: string,
  recordId: string,
  details: string,
  meta?: LogMeta
) => {
  const logs = get<العمليات_tbl>(KEYS.LOGS);
  const newLog: العمليات_tbl = {
    id: Math.random().toString(36).substr(2, 9),
    اسم_المستخدم: user || 'System',
    نوع_العملية: action,
    اسم_الجدول: table,
    رقم_السجل: recordId,
    تاريخ_العملية: new Date().toISOString(),
    details: details,
    ipAddress: meta?.ipAddress,
    deviceInfo: meta?.deviceInfo,
  };
  save(KEYS.LOGS, [...logs, newLog]);
  try {
    auditLog.appendFromLegacyLog(user, action, table, recordId, details, meta);
  } catch (e) {
    console.warn('[Logger] auditLog sync failed', e);
  }
};

export const getSystemLogs = (): العمليات_tbl[] => get<العمليات_tbl>(KEYS.LOGS);

export const clearSystemLogs = () => {
  save(KEYS.LOGS, []);
};
