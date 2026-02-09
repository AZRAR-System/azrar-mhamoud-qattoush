const FALLBACK_PREFIX = 'db_';

const TABLE_LABELS: Record<string, string> = {
  people: 'الأشخاص',
  properties: 'العقارات',
  contracts: 'العقود',
  installments: 'الكمبيالات / الدفعات',
  maintenance: 'الصيانة',
  alerts: 'التنبيهات',
  users: 'المستخدمون',
  settings: 'الإعدادات',
  attachments: 'المرفقات',
  notification_templates: 'قوالب الإشعارات',
};

export const tableLabel = (dbKey: string): string => {
  const raw = String(dbKey || '').trim();
  if (!raw) return 'بيانات النظام';

  const key = raw.startsWith(FALLBACK_PREFIX) ? raw.slice(FALLBACK_PREFIX.length) : raw;
  const normalized = key.toLowerCase();

  if (TABLE_LABELS[normalized]) return TABLE_LABELS[normalized];

  // Best-effort: humanize unknown keys
  return key.replace(/_/g, ' ');
};
