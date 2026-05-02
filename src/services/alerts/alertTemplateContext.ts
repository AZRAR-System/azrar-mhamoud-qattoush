/**
 * تحويل `tbl_Alerts` إلى {@link TemplateContext} لقوالب الرسائل / واتساب.
 *
 * | حقل السياق | مصدر على التنبيه | ملاحظات |
 * |------------|------------------|---------|
 * | `tenantName`, `اسم_المستأجر` | `alert.tenantName` | الافتراضي «المستأجر الكريم» إن فارغ |
 * | `propertyCode` | `alert.propertyCode` | الافتراضي «—» |
 * | `الوصف` | `alert.الوصف` | نص التنبيه |
 * | `count` | `alert.count` | عدد للدفعات المجمّعة؛ ≥1 |
 *
 * حقول مالية/تواريخ تفصيلية (مبلغ، تاريخ استحقاق) **ليست** على `tbl_Alerts` وحده —
 * تُترك للقالب كنص ثابت أو تُضاف لاحقاً عبر ربط دوميني.
 */

import type { tbl_Alerts } from '@/types';
import type { TemplateContext } from '@/services/notificationTemplates';

export function buildAlertTemplateContext(alert: tbl_Alerts): TemplateContext {
  const name = String(alert.tenantName ?? 'المستأجر الكريم').trim() || 'المستأجر الكريم';
  const code = String(alert.propertyCode ?? '—').trim() || '—';
  const desc = String(alert.الوصف ?? '').trim();
  const n = alert.count != null && Number(alert.count) > 0 ? Math.floor(Number(alert.count)) : 1;

  return {
    tenantName: name,
    اسم_المستأجر: name,
    propertyCode: code,
    الوصف: desc,
    count: n,
  };
}
