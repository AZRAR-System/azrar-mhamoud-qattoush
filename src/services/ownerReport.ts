/**
 * نظام تقارير المالك
 * جمع وتصدير تقارير كشف حساب المالك
 */

import { getPersonById } from '@/services/db/people';
import { getProperties } from '@/services/db/properties';
import { getContracts } from '@/services/db/contracts';
import { getInstallments } from '@/services/db/installments';
import { getSettings } from '@/services/db/settings';
import { getCommissions } from '@/services/db/financial';
import { formatCurrencyJOD, formatDateYMD } from '@/utils/format';
import { INSTALLMENT_STATUS } from '@/services/db/installmentConstants';
import type { الأشخاص_tbl, العقارات_tbl, العقود_tbl, الكمبيالات_tbl } from '@/types/types';

export interface OwnerReportData {
  owner: الأشخاص_tbl;
  properties: العقارات_tbl[];
  activeContracts: (العقود_tbl & { tenantName: string; internalCode: string })[];
  totalCollected: number;
  totalCommissions: number;
  netOwnerAmount: number;
  pendingAmount: number;
  // Metrics
  occupancyRate: number;      // % of properties rented
  collectionEfficiency: number; // % of expected funds collected
  totalExpected: number;
  byMonth: Record<string, {
    collected: number;
    expected: number;
    commission: number;
    net: number;
  }>;
  installments: (الكمبيالات_tbl & { 
    contractNumber: string; 
    propertyCode: string; 
    propertyInternalCode: string;
    tenantName: string;
    isPaid: boolean; 
    commission: number; 
    net: number 
  })[];
  generatedAt: string;
}

/**
 * جلب بيانات تقرير المالك (مع إمكانية الفلترة لعقد محدد)
 */
export function getOwnerReport(ownerId: string, contractId?: string): OwnerReportData | null {
  const owner = getPersonById(ownerId);
  if (!owner) return null;

  const settings = getSettings();
  const defaultCommPercent = settings.rentalCommissionOwnerPercent || 5;

  const properties = getProperties().filter(p => p.رقم_المالك === ownerId);
  let propertyIds = properties.map(p => p.رقم_العقار);
  const propertyMap = new Map(properties.map(p => [p.رقم_العقار, p]));

  let contracts = getContracts().filter(c => propertyIds.includes(c.رقم_العقار));
  
  // ✅ التصفية حسب عقد محدد إذا طلب المستخدم
  if (contractId) {
    contracts = contracts.filter(c => c.رقم_العقد === contractId);
    const filteredPropertyIds = contracts.map(c => c.رقم_العقار);
    propertyIds = propertyIds.filter(id => filteredPropertyIds.includes(id));
  }

  const activeContractsRaw = contracts.filter(c => c.حالة_العقد === 'نشط' && !c.isArchived);
  
  const activeContracts = activeContractsRaw.map(c => {
    const tenant = getPersonById(c.رقم_المستاجر || '');
    const prop = propertyMap.get(c.رقم_العقار || '');
    return {
      ...c,
      tenantName: tenant?.الاسم || 'غير معروف',
      internalCode: prop?.الكود_الداخلي || c.رقم_العقار || ''
    };
  });

  let totalCollected = 0;
  let totalCommissions = 0;
  let pendingAmount = 0;
  const allInstallments: (الكمبيالات_tbl & { 
    contractNumber: string; 
    propertyCode: string; 
    propertyInternalCode: string;
    tenantName: string;
    isPaid: boolean; 
    commission: number; 
    net: number 
  })[] = [];
  const byMonth: OwnerReportData['byMonth'] = {};

  const allCommissions = getCommissions();

  contracts.forEach(contract => {
    // جلب وتصفية كل الكمبيالات لهذا العقد وترتيبها زمنياً لضمان البدء بالدفعة الأولى
    const contractInstallments = getInstallments()
      .filter(i => i.رقم_العقد === contract.رقم_العقد)
      .sort((a, b) => String(a.تاريخ_استحقاق).localeCompare(String(b.تاريخ_استحقاق)));
    
    // محاولة العثور على سجل عمولة فعلي للعقد
    const actualCommissionRecord = allCommissions.find(c => c.رقم_العقد === contract.رقم_العقد);
    
    contractInstallments.forEach((inst, index) => {
      const month = inst.تاريخ_استحقاق?.slice(0, 7) || 'unknown';
      if (!byMonth[month]) {
        byMonth[month] = { collected: 0, expected: 0, commission: 0, net: 0 };
      }
      
      const isPaid = inst.حالة_الكمبيالة === INSTALLMENT_STATUS.PAID;
      const amount = Number(inst.القيمة) || 0;
      
      // ✅ الخوارزمية المطورة: العمولة تخصم من الإيجار الأول فقط
      // الأولوية 1: استخدام رقم العمولة الفعلي المسجل في النظام
      // الأولوية 2: استخدام نسبة العمولة الافتراضية
      const isFirstPayment = index === 0;
      let commission = 0;
      
      if (isFirstPayment) {
        if (actualCommissionRecord && actualCommissionRecord.عمولة_المالك > 0) {
          commission = actualCommissionRecord.عمولة_المالك;
        } else {
          commission = (amount * defaultCommPercent) / 100;
        }
      }

      const net = amount - commission;

      byMonth[month].expected += amount;

      if (isPaid) {
        totalCollected += amount;
        totalCommissions += commission;
        byMonth[month].collected += amount;
        byMonth[month].commission += commission;
        byMonth[month].net += net;
      } else if (inst.حالة_الكمبيالة !== INSTALLMENT_STATUS.CANCELLED) {
        pendingAmount += amount;
      }

      const prop = propertyMap.get(contract.رقم_العقار || '');
      const tenant = getPersonById(contract.رقم_المستاجر || '');

      allInstallments.push({
        ...inst,
        contractNumber: contract.رقم_العقد,
        propertyCode: contract.رقم_العقار || '',
        propertyInternalCode: prop?.الكود_الداخلي || contract.رقم_العقار || '',
        tenantName: tenant?.الاسم || 'غير معروف',
        isPaid,
        commission,
        net
      });
    });
  });

  const totalExpected = totalCollected + pendingAmount;
  const occupancyRate = properties.length > 0 ? (activeContracts.length / properties.length) * 100 : 0;
  const collectionEfficiency = totalExpected > 0 ? (totalCollected / totalExpected) * 100 : 0;

  return {
    owner,
    properties,
    activeContracts,
    totalCollected,
    totalCommissions,
    netOwnerAmount: totalCollected - totalCommissions,
    pendingAmount,
    totalExpected,
    occupancyRate,
    collectionEfficiency,
    byMonth,
    installments: allInstallments.sort((a,b) => String(b.تاريخ_استحقاق).localeCompare(String(a.تاريخ_استحقاق))),
    generatedAt: formatDateYMD(new Date())
  };
}

/**
 * بناء محتوى HTML لتقرير المالك
 */
export function buildOwnerReportHtml(data: OwnerReportData): string {
  return `
    <div class="owner-report" style="max-width: 1000px; margin: 0 auto; padding: 40px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; direction: rtl; color: #1f2937;">
      
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; border-bottom: 3px solid #1e40af; padding-bottom: 25px;">
        <div>
          <h1 style="color: #1e40af; font-size: 28px; font-weight: 900; margin: 0 0 10px 0;">كشف حساب المالك المحاسبي</h1>
          <p style="font-size: 16px; margin: 0; font-weight: bold; color: #374151;">المالك: ${data.owner.الاسم}</p>
          <p style="font-size: 14px; margin: 5px 0 0 0; color: #6b7280;">الرقم الوطني/مرجع: ${data.owner.الرقم_الوطني || '-'}</p>
        </div>
        <div style="text-align: left;">
          <div style="font-size: 24px; font-weight: 900; color: #1e40af; margin-bottom: 5px;">AZRAR System</div>
          <p style="font-size: 12px; margin: 0; color: #9ca3af;">تاريخ التقرير: ${data.generatedAt}</p>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 40px;">
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 20px; border-radius: 12px; border-right: 5px solid #10b981;">
          <div style="font-size: 11px; font-weight: 900; color: #64748b; margin-bottom: 8px; text-transform: uppercase;">كفاءة التحصيل</div>
          <div style="font-size: 20px; font-weight: 900; color: #059669;">${data.collectionEfficiency.toFixed(1)}%</div>
        </div>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 20px; border-radius: 12px; border-right: 5px solid #6366f1;">
          <div style="font-size: 11px; font-weight: 900; color: #64748b; margin-bottom: 8px; text-transform: uppercase;">معدل الإشغال</div>
          <div style="font-size: 20px; font-weight: 900; color: #4f46e5;">${data.occupancyRate.toFixed(1)}%</div>
        </div>
        <div style="background: #fef2f2; border: 1px solid #fee2e2; padding: 20px; border-radius: 12px; border-right: 5px solid #ef4444;">
          <div style="font-size: 11px; font-weight: 900; color: #991b1b; margin-bottom: 8px; text-transform: uppercase;">المبالغ المعلقة</div>
          <div style="font-size: 20px; font-weight: 900; color: #dc2626;">${formatCurrencyJOD(data.pendingAmount)}</div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 40px; background: #1e40af; padding: 25px; border-radius: 16px; color: white;">
        <div>
          <div style="font-size: 13px; opacity: 0.8; margin-bottom: 5px;">صافي رصيد المالك المستحق</div>
          <div style="font-size: 32px; font-weight: 900;">${formatCurrencyJOD(data.netOwnerAmount)}</div>
        </div>
        <div style="text-align: left; border-right: 1px solid rgba(255,255,255,0.2); padding-right: 20px;">
          <div style="font-size: 12px; opacity: 0.8; margin-bottom: 5px;">إجمالي التحصيلات (GPR)</div>
          <div style="font-size: 20px; font-weight: bold;">${formatCurrencyJOD(data.totalCollected)}</div>
          <div style="font-size: 12px; opacity: 0.7; margin-top: 5px;">إجمالي العمولات المحسومة: ${formatCurrencyJOD(data.totalCommissions)}</div>
        </div>
      </div>

      <div style="margin-bottom: 30px;">
        <h3 style="color: #1f2937; font-size: 16px; margin-bottom: 15px; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">العقارات المملوكة والوحدات</h3>
        <table width="100%" style="border-collapse: collapse; font-size: 13px;">
          <thead>
            <tr style="background: #f8fafc;">
              <th style="padding: 12px; border: 1px solid #e2e8f0; text-align: right;">المستأجر</th>
              <th style="padding: 12px; border: 1px solid #e2e8f0; text-align: right;">الفترة</th>
              <th style="padding: 12px; border: 1px solid #e2e8f0; text-align: center;">الحالة</th>
            </tr>
          </thead>
          <tbody>
            ${data.activeContracts.map(c => `
              <tr>
                <td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: bold;">${c.internalCode}</td>
                <td style="padding: 10px; border: 1px solid #e2e8f0;">${c.tenantName}</td>
                <td style="padding: 10px; border: 1px solid #e2e8f0; font-size: 11px;">${c.تاريخ_البداية} إلى ${c.تاريخ_النهاية}</td>
                <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: center;">
                  <span style="padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: bold; background: #dcfce7; color: #166534;">نشط</span>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div style="margin-bottom: 30px;">
        <h3 style="color: #1f2937; font-size: 16px; margin-bottom: 15px; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">سجل الحركات المالية (المؤتمت)</h3>
        <table width="100%" style="border-collapse: collapse; font-size: 11px;">
          <thead>
            <tr style="background: #f8fafc;">
              <th style="padding: 10px; border: 1px solid #e2e8f0; text-align: right;">تاريخ الاستحقاق</th>
              <th style="padding: 10px; border: 1px solid #e2e8f0; text-align: right;">المستأجر</th>
              <th style="padding: 10px; border: 1px solid #e2e8f0; text-align: right;">العقار</th>
              <th style="padding: 10px; border: 1px solid #e2e8f0; text-align: right;">القيمة</th>
              <th style="padding: 10px; border: 1px solid #e2e8f0; text-align: right;">الصافي</th>
              <th style="padding: 10px; border: 1px solid #e2e8f0; text-align: center;">الحالة</th>
            </tr>
          </thead>
          <tbody>
            ${data.installments.slice(0, 100).map(i => `
              <tr>
                <td style="padding: 8px; border: 1px solid #e2e8f0; font-family: monospace;">${i.تاريخ_استحقاق || '-'}</td>
                <td style="padding: 8px; border: 1px solid #e2e8f0;">${i.tenantName}</td>
                <td style="padding: 8px; border: 1px solid #e2e8f0; font-size: 10px;">${i.propertyInternalCode}</td>
                <td style="padding: 8px; border: 1px solid #e2e8f0; font-weight: bold;">${formatCurrencyJOD(i.القيمة)}</td>
                <td style="padding: 8px; border: 1px solid #e2e8f0; font-weight: bold; color: #1e40af;">${formatCurrencyJOD(i.net)}</td>
                <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: center;">
                  <span style="color: ${i.isPaid ? '#10b981' : '#ef4444'}; font-weight: bold;">${i.isPaid ? '✔' : '✖'}</span>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div style="margin-top: 80px; text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 20px;">
        هذا المستند يعتبر كشف حساب تقديري صادر عن نظام AZRAR. <br/>
        جميع الحقوق محفوظة © ${new Date().getFullYear()}
      </div>

    </div>
  `;
}

/**
 * تصدير تقرير المالك كملف PDF (مع دعم الفلترة)
 */
export async function exportOwnerReportPdf(ownerId: string, contractId?: string): Promise<string | null> {
  try {
    const data = getOwnerReport(ownerId, contractId);
    if (!data) return null;

    const htmlContent = buildOwnerReportHtml(data);
    const fullHtml = `<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"><title>كشف حساب المالك - ${data.owner.الاسم}</title></head><body>${htmlContent}</body></html>`;
    
    const fileName = `owner_report_${ownerId}_${Date.now()}.pdf`;
    const result = await window.desktopPrinting?.savePdfToPath?.({ html: fullHtml, filePath: fileName }) ?? null;
    return (result && 'ok' in result && result.ok) ? (result.savedPath ?? null) : null;
  } catch (error) {
    console.error('[OwnerReport] Failed to generate PDF', error);
    return null;
  }
}
