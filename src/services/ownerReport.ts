/**
 * نظام تقارير المالك
 * جمع وتصدير تقارير كشف حساب المالك
 */

import { getPersonById } from '@/services/db/people';
import { getProperties, getPropertyByOwnerId } from '@/services/db/properties';
import { getContractsByOwnerId, getContractDetails } from '@/services/db/contracts';
import { getInstallmentsByContractId } from '@/services/db/installments';
import { formatCurrencyJOD, formatDateYMD } from '@/utils/format';
import { buildFullPrintHtmlDocument, savePdfToPath } from '@/services/printing/unifiedPrint';
import { INSTALLMENT_STATUS } from '@/services/db/installmentConstants';

export interface OwnerReportData {
  owner: any;
  properties: any[];
  activeContracts: any[];
  totalCollected: number;
  totalCommissions: number;
  netOwnerAmount: number;
  pendingAmount: number;
  byMonth: Record<string, {
    collected: number;
    commission: number;
    net: number;
  }>;
  installments: any[];
  generatedAt: string;
}

/**
 * جلب بيانات تقرير المالك
 */
export function getOwnerReport(ownerId: string): OwnerReportData | null {
  const owner = getPersonById(ownerId);
  if (!owner) return null;

  const properties = getPropertyByOwnerId(ownerId);
  const contracts = getContractsByOwnerId(ownerId);
  const activeContracts = contracts.filter(c => c.حالة_العقد === 'نشط' && !c.isArchived);

  let totalCollected = 0;
  let totalCommissions = 0;
  let pendingAmount = 0;
  const allInstallments: any[] = [];
  const byMonth: OwnerReportData['byMonth'] = {};

  contracts.forEach(contract => {
    const installments = getInstallmentsByContractId(contract.رقم_العقد);
    
    installments.forEach(inst => {
      const month = inst.تاريخ_استحقاق?.slice(0, 7) || 'unknown';
      if (!byMonth[month]) {
        byMonth[month] = { collected: 0, commission: 0, net: 0 };
      }

      const isPaid = inst.حالة_الكمبيالة === INSTALLMENT_STATUS.PAID;
      const amount = Number(inst.القيمة) || 0;
      const commission = (amount * Number(contract.عمولة_المالك || 0)) / 100;
      const net = amount - commission;

      if (isPaid) {
        totalCollected += amount;
        totalCommissions += commission;
        byMonth[month].collected += amount;
        byMonth[month].commission += commission;
        byMonth[month].net += net;
      } else if (inst.حالة_الكمبيالة !== INSTALLMENT_STATUS.CANCELLED) {
        pendingAmount += amount;
      }

      allInstallments.push({
        ...inst,
        contractNumber: contract.رقم_العقد,
        propertyCode: contract.رقم_العقار,
        isPaid,
        commission,
        net
      });
    });
  });

  return {
    owner,
    properties,
    activeContracts,
    totalCollected,
    totalCommissions,
    netOwnerAmount: totalCollected - totalCommissions,
    pendingAmount,
    byMonth,
    installments: allInstallments,
    generatedAt: formatDateYMD(new Date())
  };
}

/**
 * بناء محتوى HTML لتقرير المالك
 */
export function buildOwnerReportHtml(data: OwnerReportData): string {
  return `
    <div class="owner-report" style="max-width: 900px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif;">
      
      <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #1e3a8a; padding-bottom: 20px;">
        <h1 style="color: #1e3a8a; font-size: 22px; margin-bottom: 8px;">كشف حساب المالك</h1>
        <h2 style="color: #374151; font-size: 18px; margin-bottom: 5px;">${data.owner.الاسم}</h2>
        <p style="color: #6b7280; margin: 0;">تاريخ التقرير: ${data.generatedAt}</p>
      </div>

      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 30px;">
        <div style="background: #f0fdf4; padding: 15px; border-radius: 8px; text-align: center;">
          <div style="font-size: 12px; color: #166534; margin-bottom: 5px;">إجمالي المُحصل</div>
          <div style="font-size: 18px; font-weight: bold; color: #166534;">${formatCurrencyJOD(data.totalCollected)}</div>
        </div>
        <div style="background: #fef3c7; padding: 15px; border-radius: 8px; text-align: center;">
          <div style="font-size: 12px; color: #92400e; margin-bottom: 5px;">إجمالي العمولات</div>
          <div style="font-size: 18px; font-weight: bold; color: #92400e;">${formatCurrencyJOD(data.totalCommissions)}</div>
        </div>
        <div style="background: #dbeafe; padding: 15px; border-radius: 8px; text-align: center;">
          <div style="font-size: 12px; color: #1e40af; margin-bottom: 5px;">صافي المالك</div>
          <div style="font-size: 18px; font-weight: bold; color: #1e40af;">${formatCurrencyJOD(data.netOwnerAmount)}</div>
        </div>
        <div style="background: #fef2f2; padding: 15px; border-radius: 8px; text-align: center;">
          <div style="font-size: 12px; color: #991b1b; margin-bottom: 5px;">المبلغ المعلق</div>
          <div style="font-size: 18px; font-weight: bold; color: #991b1b;">${formatCurrencyJOD(data.pendingAmount)}</div>
        </div>
      </div>

      <div style="margin-bottom: 25px;">
        <h3 style="color: #1f2937; font-size: 16px; margin-bottom: 12px; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px;">العقارات المملوكة</h3>
        <table width="100%" style="border-collapse: collapse; font-size: 13px;">
          <thead>
            <tr style="background: #f3f4f6;">
              <th style="padding: 10px; border: 1px solid #e5e7eb; text-align: right;">كود العقار</th>
              <th style="padding: 10px; border: 1px solid #e5e7eb; text-align: right;">العنوان</th>
              <th style="padding: 10px; border: 1px solid #e5e7eb; text-align: right;">الحالة</th>
            </tr>
          </thead>
          <tbody>
            ${data.properties.map(p => `
              <tr>
                <td style="padding: 8px; border: 1px solid #e5e7eb;">${p.الكود_الداخلي || p.رقم_العقار}</td>
                <td style="padding: 8px; border: 1px solid #e5e7eb;">${p.العنوان || '-'}</td>
                <td style="padding: 8px; border: 1px solid #e5e7eb; color: ${p.حالة_العقار === 'مؤجر' ? '#16a34a' : p.حالة_العقار === 'شاغر' ? '#dc2626' : '#92400e'}">${p.حالة_العقار || '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div style="margin-bottom: 25px;">
        <h3 style="color: #1f2937; font-size: 16px; margin-bottom: 12px; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px;">تفاصيل الدفعات</h3>
        <table width="100%" style="border-collapse: collapse; font-size: 12px;">
          <thead>
            <tr style="background: #f3f4f6;">
              <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: right;">تاريخ الاستحقاق</th>
              <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: right;">رقم العقد</th>
              <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: right;">المبلغ</th>
              <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: right;">العمولة</th>
              <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: right;">صافي المالك</th>
              <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: right;">الحالة</th>
            </tr>
          </thead>
          <tbody>
            ${data.installments.slice(0, 50).map(i => `
              <tr>
                <td style="padding: 6px; border: 1px solid #e5e7eb;">${i.تاريخ_استحقاق || '-'}</td>
                <td style="padding: 6px; border: 1px solid #e5e7eb;">${i.contractNumber || '-'}</td>
                <td style="padding: 6px; border: 1px solid #e5e7eb;">${formatCurrencyJOD(i.القيمة)}</td>
                <td style="padding: 6px; border: 1px solid #e5e7eb;">${formatCurrencyJOD(i.commission)}</td>
                <td style="padding: 6px; border: 1px solid #e5e7eb;">${formatCurrencyJOD(i.net)}</td>
                <td style="padding: 6px; border: 1px solid #e5e7eb; color: ${i.isPaid ? '#16a34a' : '#dc2626'}">${i.isPaid ? 'مدفوع' : 'معلق'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div style="margin-top: 60px; text-align: center; font-size: 11px; color: #9ca3af;">
        <hr style="margin-bottom: 10px; border: 0; border-top: 1px solid #e5e7eb;" />
        هذا التقرير تم إنشاؤه تلقائياً من النظام
      </div>

    </div>
  `;
}

/**
 * تصدير تقرير المالك كملف PDF
 */
export async function exportOwnerReportPdf(ownerId: string): Promise<string | null> {
  try {
    const data = getOwnerReport(ownerId);
    if (!data) return null;

    const htmlContent = buildOwnerReportHtml(data);
    const fullHtml = buildFullPrintHtmlDocument(htmlContent, `كشف حساب المالك - ${data.owner.الاسم}`);
    
    const fileName = `owner_report_${ownerId}_${Date.now()}.pdf`;
    return await savePdfToPath(fullHtml, fileName);
  } catch (error) {
    console.error('[OwnerReport] Failed to generate PDF', error);
    return null;
  }
}