/**
 * Clears operational KV data while preserving users, lookups, permissions, legal templates.
 */

import { storage } from '@/services/storage';
import { buildCache, DbCache } from '@/services/dbCache';
import { KEYS, type DbStorageKey } from './keys';

const asUnknownRecord = (value: unknown): Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : Object.create(null);

export function resetOperationalData() {
  if (storage.isDesktop()) {
    const desktopDb = window.desktopDb;
    const resetAll = asUnknownRecord(desktopDb)['resetAll'];
    if (typeof resetAll === 'function') void (resetAll as () => unknown)();
  }

  const RESET_KEYS: DbStorageKey[] = [
    KEYS.PEOPLE,
    KEYS.ROLES,
    KEYS.PROPERTIES,
    KEYS.CONTRACTS,
    KEYS.INSTALLMENTS,
    KEYS.COMMISSIONS,
    KEYS.EXTERNAL_COMMISSIONS,
    KEYS.SALES_LISTINGS,
    KEYS.SALES_OFFERS,
    KEYS.SALES_AGREEMENTS,
    KEYS.ALERTS,
    KEYS.LOGS,
    KEYS.MAINTENANCE,
    KEYS.DYNAMIC_TABLES,
    KEYS.CLEARANCE_RECORDS,
    KEYS.DASHBOARD_NOTES,
    KEYS.REMINDERS,
    KEYS.CLIENT_INTERACTIONS,
    KEYS.FOLLOW_UPS,
    KEYS.INSPECTIONS,
  ];

  RESET_KEYS.forEach((key) => {
    void storage.removeItem(key);
    localStorage.removeItem(key);
    if (DbCache.arrays[key as string]) {
      DbCache.arrays[key as string] = [];
    }
  });

  buildCache();

  console.warn('✅ تم مسح كامل البيانات التجريبية');
  console.warn('📊 البيانات المحفوظة: Users, UserPermissions, Lookups, Templates');
  console.warn('🗑️  البيانات المحذوفة: ' + RESET_KEYS.length + ' جداول');

  return {
    success: true,
    message: 'تم مسح البيانات التجريبية بنجاح - النظام جاهز للبيانات الحقيقية',
    deletedTables: RESET_KEYS.length,
    timestamp: new Date().toISOString(),
    propertiesReset: true,
  };
}
