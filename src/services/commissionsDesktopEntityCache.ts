import type { الأشخاص_tbl, العقارات_tbl, العقود_tbl } from '@/types';

/**
 * ذاكرة مؤقتة مشتركة لصفحة العمولات في وضع الديسكتوب السريع.
 * تُبقى بعد مغادرة الصفحة حتى لا تُعرض «—» للمالك/المستأجر/الكود عند كل تنقل.
 */
export const commissionsFastContractById = new Map<string, العقود_tbl>();
export const commissionsFastPropertyById = new Map<string, العقارات_tbl>();
export const commissionsFastPersonById = new Map<string, الأشخاص_tbl>();

/** يُطلق بعد التفريغ حتى تعيد صفحة العمولات رسم الحقول المشتقة من العقد */
export const COMMISSIONS_DESKTOP_CACHE_CLEARED_EVENT = 'azrar:commissions-desktop-cache-cleared';

export function clearCommissionsDesktopEntityCache(): void {
  commissionsFastContractById.clear();
  commissionsFastPropertyById.clear();
  commissionsFastPersonById.clear();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(COMMISSIONS_DESKTOP_CACHE_CLEARED_EVENT));
  }
}
