/**
 * © 2025 — Developed by Mahmoud Qattoush
 * AZRAR Real Estate Management System — All Rights Reserved
 *
 * Database Reset Service
 * أداة حذف جميع البيانات وإعادة النظام لحالته الأولية
 */

import { storage } from '@/services/storage';

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const getErrorMessage = (error: unknown): string => {
  const msg = isRecord(error) ? error['message'] : undefined;
  return String(msg);
};

// مفاتيح البيانات (db_*) المعروفة في النظام.
// ملاحظة: قد توجد مفاتيح إضافية db_* (إضافات/ميزات)؛ يتم التقاطها ديناميكياً أيضاً.
const BASE_DB_KEYS = [
  // الأساسية
  'db_people',
  'db_companies',
  'db_properties',
  'db_contracts',
  'db_installments',
  'db_payments',
  'db_roles',
  'db_commissions',
  'db_users',
  'db_user_permissions',
  'db_alerts',

  // البيع
  'db_sales', // legacy/compat
  'db_sales_listings',
  'db_sales_offers',
  'db_sales_agreements',
  'db_external_commissions',

  // الصيانة والإدارة
  'db_maintenance_tickets',
  'db_settings',
  'db_operations',
  'db_blacklist',

  // القوائم
  'db_lookups',
  'db_lookup_categories',

  // الجداول الديناميكية
  'db_dynamic_tables',
  'db_dynamic_records',
  'db_dynamic_form_fields',

  // المرفقات والملاحظات
  'db_attachments',
  'db_activities',
  'db_notes',

  // القانونية
  'db_legal_templates',
  'db_legal_history',

  // لوحة التحكم / إضافات
  'db_dashboard_config',
  'db_dashboard_notes',
  'db_notification_send_logs',
  'db_reminders',
  'db_client_interactions',
  'db_followups',
  'db_clearance_records',
  'db_ownership_history',
  'db_marquee',
  'db_smart_behavior',

  // علامات النظام
  'db_initialized',
];

// مفاتيح غير db_* لكنها تخص بيانات/حالة التطبيق
const APP_STATE_KEYS = [
  'khaberni_user',
  'khaberni_onboarding_completed',
  'notification_templates',
  'notificationLogs',
  'daily_scheduler_last_run',
  'audioConfig',
  'theme',
  'ui_sales_edit_agreement_id',
];

// مفاتيح قديمة/تجريبية نريد تنظيفها إن وُجدت (بدون إعادة إنشائها)
const LEGACY_CLEANUP_KEYS = ['demo_data_loaded'];

const unique = (arr: string[]): string[] => Array.from(new Set(arr.filter(Boolean)));

const isDesktop = (): boolean => typeof window !== 'undefined' && !!window.desktopDb;

const getKeysToClear = async (): Promise<string[]> => {
  const keys: string[] = [...BASE_DB_KEYS, ...APP_STATE_KEYS, ...LEGACY_CLEANUP_KEYS];

  try {
    keys.push(...Object.keys(localStorage));
  } catch {
    // ignore
  }

  try {
    const persisted = await storage.keys();
    keys.push(...persisted);
  } catch {
    // ignore
  }

  // Only keep relevant keys
  return unique(keys).filter(
    (k) =>
      k.startsWith('db_') ||
      k.startsWith('ui_') ||
      APP_STATE_KEYS.includes(k) ||
      LEGACY_CLEANUP_KEYS.includes(k)
  );
};

const deleteAllAttachmentFiles = async (): Promise<void> => {
  const bridge = typeof window !== 'undefined' ? window.desktopDb : undefined;
  if (typeof bridge?.deleteAttachmentFile !== 'function') return;

  try {
    const raw = (await storage.getItem('db_attachments')) ?? localStorage.getItem('db_attachments');
    if (!raw) return;
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return;

    const paths = unique(
      list
        .map((x: unknown) => {
          const filePath = isRecord(x) ? x['filePath'] : undefined;
          return String(filePath ?? '').trim();
        })
        .filter((p): p is string => p.length > 0)
    );

    for (const p of paths) {
      try {
        await bridge.deleteAttachmentFile(p);
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore
  }
};

/**
 * حذف جميع البيانات من localStorage
 */
export const clearAllData = async (): Promise<{
  success: boolean;
  message: string;
  deletedKeys: string[];
}> => {
  try {
    const deletedKeys: string[] = [];

    // Delete attachment files first (Desktop only) so references are still available.
    if (isDesktop()) {
      await deleteAllAttachmentFiles();
    }

    const keysToClear = await getKeysToClear();

    // In Desktop mode, wipe ALL db_* keys from SQLite even if localStorage wasn't hydrated.
    let desktopResetDone = false;
    if (isDesktop()) {
      try {
        const bridge = window.desktopDb;
        if (typeof bridge?.resetAll === 'function') {
          await bridge.resetAll();
          desktopResetDone = true;
        }
      } catch {
        desktopResetDone = false;
      }
    }

    // حذف جميع المفاتيح
    for (const key of keysToClear) {
      try {
        // If we already reset db_* in SQLite, we only need to clear localStorage copies.
        if (desktopResetDone && key.startsWith('db_')) {
          localStorage.removeItem(key);
        } else {
          await storage.removeItem(key);
        }
        deletedKeys.push(key);
      } catch {
        // ignore single-key failures
      }
    }

    return {
      success: true,
      message: `تم حذف/تصفير البيانات بنجاح (تمت معالجة ${deletedKeys.length} مفتاح)`,
      deletedKeys,
    };
  } catch (error: unknown) {
    return {
      success: false,
      message: `فشل حذف البيانات: ${getErrorMessage(error)}`,
      deletedKeys: [],
    };
  }
};

/**
 * إعادة تهيئة النظام بالبيانات الأساسية فقط
 */
export const resetToFreshState = async (): Promise<{ success: boolean; message: string }> => {
  try {
    // 1. حذف جميع البيانات
    const clearResult = await clearAllData();

    if (!clearResult.success) {
      return clearResult;
    }

    // 2. إنشاء مستخدم admin فقط
    const adminUser = {
      id: '1',
      اسم_المستخدم: 'admin',
      كلمة_المرور: '123456',
      الدور: 'SuperAdmin',
      isActive: true,
    };

    const users = [adminUser];
    await storage.setItem('db_users', JSON.stringify(users));

    // 3. إنشاء Lookups الأساسية
    const basicLookups = [
      { id: '1', category: 'person_roles', label: 'مالك' },
      { id: '2', category: 'person_roles', label: 'مستأجر' },
      { id: '3', category: 'person_roles', label: 'كفيل' },
      { id: '4', category: 'person_roles', label: 'وسيط' },
      { id: '4b', category: 'company_nature', label: 'شركة' },
      { id: '4c', category: 'company_nature', label: 'مؤسسة' },
      { id: '5', category: 'prop_type', label: 'شقة' },
      { id: '6', category: 'prop_type', label: 'محل تجاري' },
      { id: '7', category: 'prop_type', label: 'فيلا' },
      { id: '8', category: 'prop_type', label: 'أرض' },
      { id: '9', category: 'prop_status', label: 'شاغر' },
      { id: '10', category: 'prop_status', label: 'مؤجر' },
      { id: '11', category: 'prop_status', label: 'صيانة' },
    ];

    await storage.setItem('db_lookups', JSON.stringify(basicLookups));

    return {
      success: true,
      message: `تم إعادة تهيئة النظام بنجاح!\n- تم حذف ${clearResult.deletedKeys.length} مفتاح\n- تم إنشاء مستخدم admin\n- تم إنشاء ${basicLookups.length} lookup أساسي`,
    };
  } catch (error: unknown) {
    return {
      success: false,
      message: `فشلت إعادة التهيئة: ${getErrorMessage(error)}`,
    };
  }
};

/**
 * عرض إحصائيات البيانات الحالية
 */
export const getDatabaseStats = async (): Promise<Record<string, number>> => {
  const stats: Record<string, number> = {};
  const keys = unique(BASE_DB_KEYS.filter((k) => k.startsWith('db_')));

  for (const key of keys) {
    try {
      const data = (await storage.getItem(key)) ?? localStorage.getItem(key);
      if (!data) continue;
      const parsed = JSON.parse(data);
      stats[key] = Array.isArray(parsed) ? parsed.length : 1;
    } catch {
      // ignore
    }
  }

  return stats;
};
