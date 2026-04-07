/**
 * تقرير تسوية الحساب عند فسخ العقد
 * يجمع جميع البيانات ويصدر PDF تلقائياً
 */

import type { العقود_tbl, الأشخاص_tbl, العقارات_tbl, الكمبيالات_tbl } from '@/types';
import { formatCurrencyJOD } from '@/utils/format';
import { getContractDetails } from '@/services/db/contracts';
import { buildFullPrintHtmlDocument } from '@/services/print/printEngine';
import { savePdfToPath } from '@/services/print/pdfGenerator';
import { upsertAlert } from '@/services/db/alertsCore';
import { get } from './db/kv';
import { KEYS } from './db/keys';
import { INSTALLMENT_STATUS } from './db/installmentConstants';

interface TerminationReportData {
  contract: العقود_tbl;
  tenant: الأشخاص_tbl | undefined;
  property: العقارات_tbl | undefined;
  installments: {
    paid: الكمبيالات_tbl[];
    cancelled: الكمبيالات_tbl[];
    remaining: الكمبيالات_tbl[];
  };
  totals: {
    totalContractAmount: number;
    totalPaid: number;
    totalCancelled: number;
    totalRemaining: number;
    finalBalance: number;
  };
  terminationDate: string;
  reason: string;
}

export async function generateTerminationReport(
  contractId: string,
  terminationDate: string,
  reason: string
): Promise<string | null> {
  try {
    const details = getContractDetails(contractId);
    if (!details) return null;

    const { contract, tenant, property, installments } = details;

    // تصنيف الدفعات حسب الحالة
    const paid = installments.filter(i => i.حالة_الكمبيالة === INSTALLMENT_STATUS.PAID);
    const cancelled = installments.filter(i => i.حالة_الكمبيالة === INSTALLMENT_STATUS.CANCELLED);
    const remaining = installments.filter(i => 
      i.حالة_الكمبيالة !== INSTALLMENT_STATUS.PAID && 
      i.حالة_الكمبيالة !== INSTALLMENT_STATUS.CANCELLED
    );

    // حساب الإجماليات
    const totalContractAmount = installments.reduce((sum, i) => sum + (Number(i.المبلغ) || 0), 0);
    const totalPaid = paid.reduce((sum, i) => sum + (Number(i.المبلغ_المدفوع) || Number(i.المبلغ) || 0), 0);
    const totalCancelled = cancelled.reduce((sum, i) => sum + (Number(i.المبلغ) || 0), 0);
    const totalRemaining = remaining.reduce((sum, i) => sum + (Number(i.المبلغ) || 0), 0);
    const finalBalance = totalRemaining;

    const reportData: TerminationReportData = {
      contract,
      tenant,
      property,
      installments: { paid, cancelled, remaining },
      totals: {
        totalContractAmount,
        totalPaid,
        totalCancelled,
        totalRemaining,
        finalBalance
      },
      terminationDate,
      reason
    };

    // بناء محتوى HTML للتقرير
    const htmlContent = buildTerminationReportHtml(reportData);
    const fullHtml = buildFullPrintHtmlDocument(htmlContent, `تقرير تسوية الحساب - عقد ${contractId}`);

    // حفظ PDF
    const fileName = `termination_report_${contractId}_${Date.now()}.pdf`;
    const savePath = await savePdfToPath(fullHtml, fileName);

    // إضافة إشعار في مركز التنبيهات
    await upsertAlert({
      id: `ALR_TERM_REPORT_${contractId}`,
      تاريخ_الانشاء: new Date().toISOString().split('T')[0],
      نوع_التنبيه: 'تقرير تسوية حساب',
      الوصف: `تم إنشاء تقرير تسوية الحساب لعقد ${contractId} بنجاح`,
      category: 'Reports',
      تم_القراءة: false,
      مرجع_الجدول: 'العقود_tbl',
      مرجع_المعرف: contractId,
      metadata: {
        filePath: savePath,
        fileName
      }
    });

    return savePath;
  } catch (error) {
    console.error('[TerminationReport] Failed to generate report', error);
    return null;
  }
}

function buildTerminationReportHtml(data: TerminationReportData): string {
  return `
    <div class="termination-report">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #1e3a8a; font-size: 24px; margin-bottom: 10px;">تقرير تسوية الحساب النهائي</h1>
        <h2 style="color: #374151; font-size: 18px;">فسخ عقد إيجار عقاري</h2>
      </div>

      <div style="margin-bottom: 20px; border-bottom: 2px solid #e5e7eb; padding-bottom: 20px;">
        <h3>معلومات العقد</h3>
        <table width="100%">
          <tr>
            <td width="50%"><strong>رقم العقد:</strong> ${data.contract.رقم_العقد}</td>
            <td width="50%"><strong>تاريخ الفسخ:</strong> ${data.terminationDate}</td>
          </tr>
          <tr>
            <td><strong>المستأجر:</strong> ${data.tenant?.الاسم || 'غير محدد'}</td>
            <td><strong>العقار:</strong> ${data.property?.الكود_الداخلي || 'غير محدد'}</td>
          </tr>
        </table>
      </div>

      <div style="margin-bottom: 20px;">
        <h3>سبب الفسخ</h3>
        <div style="background: #f3f4f6; padding: 15px; border-radius: 8px;">
          ${data.reason}
        </div>
      </div>

      <div style="margin-bottom: 20px;">
        <h3>ملخص الحساب النهائي</h3>
        <table width="100%" style="border-collapse: collapse;">
          <tr style="background: #f3f4f6;">
            <td style="padding: 10px; border: 1px solid #e5e7eb;"><strong>إجمالي قيمة العقد</strong></td>
            <td style="padding: 10px; border: 1px solid #e5e7eb; text-align: left;">${formatCurrencyJOD(data.totals.totalContractAmount)}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #e5e7eb;"><strong>المبلغ المدفوع</strong></td>
            <td style="padding: 10px; border: 1px solid #e5e7eb; text-align: left; color: #16a34a;">${formatCurrencyJOD(data.totals.totalPaid)}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #e5e7eb;"><strong>المبلغ الملغي</strong></td>
            <td style="padding: 10px; border: 1px solid #e5e7eb; text-align: left; color: #6b7280;">${formatCurrencyJOD(data.totals.totalCancelled)}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #e5e7eb;"><strong>المبلغ المتبقي المستحق</strong></td>
            <td style="padding: 10px; border: 1px solid #e5e7eb; text-align: left; color: #dc2626;">${formatCurrencyJOD(data.totals.totalRemaining)}</td>
          </tr>
          <tr style="background: #1e3a8a; color: white; font-weight: bold;">
            <td style="padding: 12px; border: 1px solid #1e3a8a;">الرصيد النهائي</td>
            <td style="padding: 12px; border: 1px solid #1e3a8a; text-align: left;">${formatCurrencyJOD(data.totals.finalBalance)}</td>
          </tr>
        </table>
      </div>

      <div style="margin-top: 50px; display: flex; justify-content: space-between;">
        <div style="text-align: center;">
          <div style="border-top: 1px solid #374151; width: 200px; margin-top: 50px;"></div>
          <p>توقيع الإدارة</p>
        </div>
        <div style="text-align: center;">
          <div style="border-top: 1px solid #374151; width: 200px; margin-top: 50px;"></div>
          <p>توقيع المستأجر</p>
        </div>
      </div>

    </div>
  `;
}