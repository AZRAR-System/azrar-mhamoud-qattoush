/**
 * KV / localStorage keys for persisted arrays (single source for mockDb domain layer).
 */

export const KEYS = {
  PEOPLE: 'db_people',
  COMPANIES: 'db_companies',
  CONTACTS: 'db_contacts',
  PROPERTIES: 'db_properties',
  CONTRACTS: 'db_contracts',
  INSTALLMENTS: 'db_installments',
  ROLES: 'db_roles',
  COMMISSIONS: 'db_commissions',
  USERS: 'db_users',
  USER_PERMISSIONS: 'db_user_permissions',
  ALERTS: 'db_alerts',
  SALES_LISTINGS: 'db_sales_listings',
  SALES_OFFERS: 'db_sales_offers',
  SALES_AGREEMENTS: 'db_sales_agreements',
  OWNERSHIP_HISTORY: 'db_ownership_history',
  MAINTENANCE: 'db_maintenance_tickets',
  LOOKUPS: 'db_lookups',
  LOOKUP_CATEGORIES: 'db_lookup_categories',
  SETTINGS: 'db_settings',
  LOGS: 'db_operations',
  BLACKLIST: 'db_blacklist',
  DYNAMIC_TABLES: 'db_dynamic_tables',
  DYNAMIC_RECORDS: 'db_dynamic_records',
  DYNAMIC_FORM_FIELDS: 'db_dynamic_form_fields',
  ATTACHMENTS: 'db_attachments',
  ACTIVITIES: 'db_activities',
  NOTES: 'db_notes',
  LEGAL_TEMPLATES: 'db_legal_templates',
  LEGAL_HISTORY: 'db_legal_history',
  EXTERNAL_COMMISSIONS: 'db_external_commissions',
  MARQUEE: 'db_marquee',
  DASHBOARD_CONFIG: 'db_dashboard_config',
  CLEARANCE_RECORDS: 'db_clearance_records',
  DASHBOARD_NOTES: 'db_dashboard_notes',
  REMINDERS: 'db_reminders',
  CLIENT_INTERACTIONS: 'db_client_interactions',
  FOLLOW_UPS: 'db_followups',
  NOTIFICATION_SEND_LOGS: 'db_notification_send_logs',
  INSPECTIONS: 'db_property_inspections',
  /** أنماط الإدخال / الأدوات الذكية (انظر smartEngine) */
  SMART_BEHAVIOR: 'db_smart_behavior',
  /** إعدادات/حالة التقارير المالية المجدولة + آخر لقطة للمعاينة */
  SCHEDULED_REPORTS_CONFIG: 'db_scheduled_reports_config',
  /** سجل التدقيق — مصفوفة آخر 500 سجل */
  AUDIT_LOG: 'db_audit_log',
  /** قوالب رسائل قابلة للتعديل (نصوص) — يُكمّل notificationTemplates الافتراضية */
  MESSAGE_TEMPLATES: 'db_message_templates',
} as const;

export type DbStorageKey = (typeof KEYS)[keyof typeof KEYS];

/** كل مفاتيح KV المعرفة للمزامنة مع SQL (نفس سلسلة `k` في الرفع/السحب). */
export const ALL_KV_DATA_KEYS: readonly string[] = Object.freeze(
  Array.from(new Set(Object.values(KEYS))).sort()
);
