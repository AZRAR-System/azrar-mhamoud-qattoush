import { get } from '../kv';
import { KEYS } from '../keys';
import { 
  الكمبيالات_tbl, 
  العقود_tbl, 
  الأشخاص_tbl, 
  العقارات_tbl, 
  العمولات_tbl, 
  اتفاقيات_البيع_tbl, 
  المستخدمين_tbl,
  ReportResult
} from '@/types';
import { INSTALLMENT_STATUS } from '../installmentConstants';
import { getInstallmentPaidAndRemaining } from '../installments';
import { toDateOnly, parseDateOnly } from '../utils/dates';
import {
  commissionPartiesOfficeTotal,
  computeEmployeeCommission,
  getRentalTier,
} from '@/utils/employeeCommission';
import { MOCK_REPORTS } from '../mockDbConstants';

const asUnknownRecord = (value: unknown): Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : Object.create(null);

/**
 * System Reporting service
 */

export const getAvailableReports = () => MOCK_REPORTS;

export const runReport = (id: string): ReportResult => {
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
    // x.due is guaranteed by the .filter((x) => !!x.due) on line 53
    const totalLate = withAmounts.filter(x => x.remaining > 0 && x.due.getTime() < todayDateOnly.getTime()).reduce((sum, x) => sum + x.remaining, 0);

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

  if (id === 'employee_commissions') {
    const commissions = get<العمولات_tbl>(KEYS.COMMISSIONS);
    const contracts = get<العقود_tbl>(KEYS.CONTRACTS);
    const agreements = get<اتفاقيات_البيع_tbl>(KEYS.SALES_AGREEMENTS);
    const properties = get<العقارات_tbl>(KEYS.PROPERTIES);
    const people = get<الأشخاص_tbl>(KEYS.PEOPLE);
    const users = get<المستخدمين_tbl>(KEYS.USERS);

    // Helpers for robust month extraction
    const getMonthKey = (c: العمولات_tbl) => {
      const pm = norm(c.شهر_دفع_العمولة);
      if (/^\d{4}-\d{2}$/.test(pm)) return pm;
      const dStr = norm(c.تاريخ_العقد);
      if (/^\d{4}-\d{2}/.test(dStr)) return dStr.slice(0, 7);
      if (/\d{1,2}\/\d{1,2}\/\d{4}/.test(dStr)) {
        const p = dStr.split('/');
        return `${p[2]}-${p[1].padStart(2, '0')}`;
      }
      return '0000-00';
    };

    // Pass 1: Aggregate monthly rental totals per user
    const monthlyUserRentalTotals: Record<string, number> = Object.create(null);
    commissions.forEach((c) => {
      if (c.نوع_العمولة === 'Sale') return;
      const key = `${norm(c.اسم_المستخدم)}|${getMonthKey(c)}`;
      monthlyUserRentalTotals[key] =
        (monthlyUserRentalTotals[key] || 0) + commissionPartiesOfficeTotal(c);
    });

    // Pass 2: Calculate individual rows
    const data = commissions.map((c) => {
      const type = c.نوع_العمولة || 'Rental';
      const userObj = users.find((u) => u.اسم_المستخدم === c.اسم_المستخدم);
      const employeeName = userObj
        ? userObj.اسم_للعرض || userObj.اسم_المستخدم
        : c.اسم_المستخدم || '—';

      const mKey = getMonthKey(c);
      const aggKey = `${norm(c.اسم_المستخدم)}|${mKey}`;
      const monthlyRentalTotal = monthlyUserRentalTotals[aggKey] || 0;

      let propCode = '—';
      const opportunity = c.رقم_الفرصة || '—';
      let clientName = '—';
      let ownerName = '—';

      if (type === 'Rental') {
        const contractId = norm(c.رقم_العقد);
        const contract = contracts.find((con) => norm(con.رقم_العقد) === contractId);
        if (contract) {
          const propId = norm(contract.رقم_العقار);
          const prop = properties.find((p) => norm(p.رقم_العقار) === propId);
          propCode = prop ? prop.الكود_الداخلي : '—';
          
          if (prop) {
            const oid = norm(prop.رقم_المالك);
            const owner = people.find((p) => norm(p.رقم_الشخص) === oid);
            ownerName = owner ? owner.الاسم : '—';
          }

          const tenantId = norm(contract.رقم_المستاجر);
          const tenant = people.find((p) => norm(p.رقم_الشخص) === tenantId);
          clientName = tenant ? tenant.الاسم : '—';
        }
      } else {
        const agreementId = norm(c.رقم_الاتفاقية);
        const agreement = agreements.find((a) => norm(a.id) === agreementId);
        if (agreement) {
          const propId = norm(agreement.رقم_العقار);
          const prop = properties.find((p) => norm(p.رقم_العقار) === propId);
          propCode = prop ? prop.الكود_الداخلي : '—';
          
          if (prop) {
            const sid = norm(prop.رقم_المالك);
            const seller = people.find((p) => norm(p.رقم_الشخص) === sid);
            ownerName = seller ? seller.الاسم : '—';
          }

          const buyerId = norm(agreement.رقم_المشتري);
          const buyer = people.find((p) => norm(p.رقم_الشخص) === buyerId);
          clientName = buyer ? buyer.الاسم : '—';
        }
      }

      // عمولة المكتب بين الأطراف فقط (بدون إدخال العقار — حصة الموظف تُحسب منفصلة)
      const officeCommission = commissionPartiesOfficeTotal(c);
      const _breakdown = computeEmployeeCommission({
        rentalOfficeCommissionTotal: type === 'Rental' ? monthlyRentalTotal : 0,
        saleOfficeCommissionTotal: type === 'Sale' ? officeCommission : 0,
        propertyIntroEnabled: !!c.يوجد_ادخال_عقار,
      });
      // Corrected: use the calculation for the specific row's share
      // Since computeEmployeeCommission uses the total to find the tier, 
      // we apply that tier's rate to the INDIVIDUAL commission.
      
      const isSale = type === 'Sale';
      const isRental = !isSale;
      const rentalTier = getRentalTier(monthlyRentalTotal);
      const rate = isSale ? 0.4 : rentalTier.rate;
      
      const employeeBase = officeCommission * rate;
      const introEarned = c.يوجد_ادخال_عقار ? officeCommission * 0.05 : 0;

      return {
        id: c.رقم_العمولة,
        type: isRental ? 'إيجار' : 'بيع',
        date: c.تاريخ_العقد || '—',
        reference: isRental ? c.رقم_العقد || '—' : c.رقم_الاتفاقية || '—',
        employee: employeeName,
        employeeUsername: c.اسم_المستخدم,
        property: propCode,
        opportunity: opportunity,
        client: clientName,
        ownerName: ownerName,
        officeCommission: officeCommission,
        tier: isRental ? rentalTier.tierId : 'N/A',
        employeeBase: employeeBase,
        intro: introEarned,
        employeeTotal: employeeBase + introEarned,
      };
    });

    return {
      title: 'تقرير عمولات الموظفين',
      generatedAt,
      columns: [
        { key: 'date', header: 'التاريخ' },
        { key: 'type', header: 'النوع' },
        { key: 'property', header: 'العقار' },
        { key: 'ownerName', header: 'المالك / البائع' },
        { key: 'client', header: 'المستأجر / المشتري' },
        { key: 'employee', header: 'الموظف' },
        { key: 'officeCommission', header: 'عمولة المكتب', type: 'currency' },
        { key: 'employeeTotal', header: 'حصة الموظف', type: 'currency' },
      ],
      data,
    };
  }

  // Fallback for other reports
  return { title: 'تقرير غير مكتمل', generatedAt, columns: [], data: [] };
};
