import { get } from '../kv';
import { KEYS } from '../keys';
import { 
  الكمبيالات_tbl, 
  العقود_tbl, 
  الأشخاص_tbl, 
  العقارات_tbl, 
  العمولات_tbl, 
  اتفاقيات_البيع_tbl, 
  عروض_البيع_tbl, 
  تذاكر_الصيانة_tbl, 
  شخص_دور_tbl, 
  المستخدمين_tbl 
} from '@/types';
import { INSTALLMENT_STATUS } from '../installmentConstants';
import { getInstallmentPaidAndRemaining } from '../installments';
import { isTenancyRelevant, pickBestTenancyContract } from '@/utils/tenancy';
import { toDateOnly, parseDateOnly, daysBetweenDateOnly } from '../utils/dates';
import { formatCurrencyJOD } from '@/utils/format';
import { computeEmployeeCommission, getRentalTier } from '@/utils/employeeCommission';
import { MOCK_REPORTS } from '../mockDbConstants';

const asUnknownRecord = (value: unknown): Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : Object.create(null);

/**
 * System Reporting service
 */

export const getAvailableReports = () => MOCK_REPORTS;

export const runReport = (id: string): any => {
  const generatedAt = new Date().toLocaleString('ar-JO', { dateStyle: 'full', timeStyle: 'short' });
  const today = new Date();
  const todayDateOnly = toDateOnly(today);
  const norm = (v: unknown) => String(v ?? '').trim();
  const isArchived = (rec: unknown) => asUnknownRecord(rec)['isArchived'] === true;

  // Implementation of different reports (Financial, Late Installments, etc.)
  // Ported from mockDb.ts lines 2695-3500+
  
  if (id === 'financial_summary') {
    const installments = get<الكمبيالات_tbl>(KEYS.INSTALLMENTS)
      .filter((i) => i.نوع_الكمبيالة !== 'تأمين' && !isArchived(i) && norm(i.حالة_الكمبيالة) !== INSTALLMENT_STATUS.CANCELLED);

    const withAmounts = installments.map((inst) => {
      const { paid, remaining } = getInstallmentPaidAndRemaining(inst);
      const due = parseDateOnly(inst.تاريخ_استحقاق);
      return { inst, paid, remaining, due };
    }).filter((x) => !!x.due);

    const totalExpected = installments.reduce((sum, inst) => sum + (Number(inst.القيمة) || 0), 0);
    const totalPaid = withAmounts.reduce((sum, x) => sum + (Number(x.paid) || 0), 0);
    const totalLate = withAmounts.filter(x => x.remaining > 0 && x.due!.getTime() < todayDateOnly.getTime()).reduce((sum, x) => sum + x.remaining, 0);

    return {
      title: 'الملخص المالي',
      generatedAt,
      columns: [
        { key: 'item', header: 'البند' },
        { key: 'value', header: 'القيمة', type: 'currency' as const },
      ],
      data: [
        { item: 'إجمالي المتوقع', value: totalExpected },
        { item: 'إجمالي المحصل', value: totalPaid },
        { item: 'إجمالي المتأخر', value: totalLate },
        { item: 'المتبقي', value: totalExpected - totalPaid },
      ],
      summary: [{ label: 'نسبة التحصيل', value: `${totalExpected > 0 ? Math.round((totalPaid / totalExpected) * 100) : 0}%` }],
    };
  }

  // Fallback for other reports (Simplified for now, can be fully ported if needed)
  return { title: 'تقرير غير مكتمل', generatedAt, data: [] };
};
