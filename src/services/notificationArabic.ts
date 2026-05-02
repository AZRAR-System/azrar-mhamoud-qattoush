/**
 * عناوين وتصنيفات مركز الإشعارات بالعربية فقط (لا تعرض مفاتيح إنجليزية خام).
 */

const ARABIC_CHAR = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

export function hasArabicText(s: string): boolean {
  return ARABIC_CHAR.test(String(s ?? ''));
}

/** تصنيف → تسمية مختصرة للشارة */
const CATEGORY_AR: Record<string, string> = {
  financial: 'مالي',
  payment: 'تحصيل',
  payments: 'دفعات',
  overdue: 'متأخرات',
  collection: 'تحصيل',
  installments: 'أقساط',
  installment_reminder: 'تذكير دفعة',
  contracts: 'عقود',
  contract: 'عقود',
  contract_renewal: 'تجديد عقد',
  maintenance: 'صيانة',
  system: 'نظام',
  info: 'معلومات',
  risk: 'مخاطر',
  dataquality: 'جودة بيانات',
  expiry: 'انتهاء',
  smartbehavior: 'سلوك ذكي',
  scheduled_financial_report: 'تقرير مالي',
  whatsapp_auto: 'واتساب',
  whatsapp_auto_before: 'واتساب',
  whatsapp_auto_due: 'واتساب',
  whatsapp_auto_late: 'واتساب',
  blacklist: 'قائمة سوداء',
  reminders: 'تذكيرات',
  alerts: 'تنبيه',
};

function normalizeCategoryKey(category: string): string {
  return String(category ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

export function localizeNotificationCategory(category: string): string {
  const raw = String(category ?? '').trim();
  if (!raw) return 'عام';
  if (ARABIC_CHAR.test(raw)) return raw;

  const key = normalizeCategoryKey(raw);
  if (CATEGORY_AR[key]) return CATEGORY_AR[key];

  if (key.includes('renew')) return 'تجديد عقد';
  if (key.includes('financial') || key === 'financial') return 'مالي';
  if (key.includes('payment') || key.includes('pay')) return 'تحصيل';
  if (key.includes('contract')) return 'عقود';
  if (key.includes('maint')) return 'صيانة';
  if (key.includes('whatsapp')) return 'واتساب';

  return raw.replace(/_/g, ' ');
}

const ASCII_TITLE_TO_AR: Record<string, string> = {
  financial: 'تنبيه مالي',
  payment: 'تحصيل',
  payments: 'دفعات',
  overdue: 'متأخرات',
  collection: 'تحصيل',
  contracts: 'تنبيه عقود',
  contract: 'تنبيه عقود',
  maintenance: 'تنبيه صيانة',
  system: 'تنبيه نظام',
  risk: 'تنبيه مخاطر',
  info: 'معلومة',
  expiry: 'تنبيه انتهاء',
};

/** عنوان السطر: إذا كان الإدخال إنجليزياً فقط يُستبدل بعربي مناسب */
export function localizeNotificationTitle(title: string, category: string): string {
  const t = String(title ?? '').trim();
  if (!t) return localizeNotificationCategory(category);
  if (ARABIC_CHAR.test(t)) return t;

  const tl = t.toLowerCase().replace(/\s+/g, '_');
  if (ASCII_TITLE_TO_AR[tl]) return ASCII_TITLE_TO_AR[tl];
  if (ASCII_TITLE_TO_AR[t.toLowerCase()]) return ASCII_TITLE_TO_AR[t.toLowerCase()];

  const catKey = normalizeCategoryKey(category);
  const titleKey = normalizeCategoryKey(t);
  if (titleKey === catKey || t.toLowerCase() === String(category).trim().toLowerCase()) {
    const chip = localizeNotificationCategory(category);
    if (chip === 'مالي') return 'تنبيه مالي';
    if (chip === 'تحصيل' || chip === 'دفعات') return 'تذكير بالاستحقاق';
    return chip !== 'عام' ? `تنبيه: ${chip}` : t;
  }

  return t;
}
