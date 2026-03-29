import React, { useMemo } from 'react';
import type { SystemSettings } from '@/types';
import { formatCurrencyJOD, LOCALE_AR_LATN_GREGORY } from '@/utils/format';
import { escapeHtml } from '../printPreviewTypes';
import { PrintPreviewModal, type PrintPreviewModalProps } from '../PrintPreviewModal';

export type InvoiceTemplateData = {
  contractNumber: string;
  tenantName: string;
  propertyLabel: string;
  installmentAmount: string | number;
  dueDate: string;
  paidAmount: string | number;
  remainingAmount: string | number;
  installmentLabel?: string;
};

const printFont = '"Tajawal",system-ui,-apple-system,"Segoe UI",Arial,sans-serif';

function displayMoney(v: string | number | undefined, settings: SystemSettings): string {
  if (typeof v === 'string' && v.trim()) return v.trim();
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return '—';
  const cur = String(settings.currency || 'JOD').toUpperCase();
  if (cur === 'JOD') return formatCurrencyJOD(n);
  try {
    return new Intl.NumberFormat(LOCALE_AR_LATN_GREGORY, {
      style: 'currency',
      currency: cur,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return formatCurrencyJOD(n);
  }
}

export function buildInvoiceTemplateBodyHtml(
  data: InvoiceTemplateData,
  settings: SystemSettings
): string {
  const rowTuples: [string, string][] = [
    ['رقم العقد', escapeHtml(data.contractNumber)],
    ['اسم المستأجر', escapeHtml(data.tenantName)],
    ['العقار', escapeHtml(data.propertyLabel)],
  ];
  if (data.installmentLabel) {
    rowTuples.push(['القسط', escapeHtml(data.installmentLabel)]);
  }
  rowTuples.push(
    ['مبلغ القسط', escapeHtml(displayMoney(data.installmentAmount, settings))],
    ['تاريخ الاستحقاق', escapeHtml(data.dueDate)],
    ['المبالغ المدفوعة', escapeHtml(displayMoney(data.paidAmount, settings))],
    ['المتبقي', escapeHtml(displayMoney(data.remainingAmount, settings))]
  );

  const tableRows = rowTuples
    .map(
      ([k, v]) =>
        `<tr><th style="text-align:right;padding:8px;border:1px solid #e5e7eb;width:32%;background:#f8fafc;font-weight:700;">${k}</th><td style="padding:8px;border:1px solid #e5e7eb;">${v}</td></tr>`
    )
    .join('');

  return `<article style="font-family:${printFont};direction:rtl;text-align:right;color:#0f172a;">
<h2 style="margin:0 0 16px;font-size:18px;font-weight:800;">فاتورة قسط</h2>
<table style="width:100%;border-collapse:collapse;font-size:13px;line-height:1.5;">${tableRows}</table>
</article>`;
}

export const InvoiceTemplate: React.FC<{
  data: InvoiceTemplateData;
  settings: SystemSettings;
  className?: string;
}> = ({ data, settings, className = '' }) => {
  const rowTuples = useMemo(() => {
    const tuples: [string, string][] = [
      ['رقم العقد', data.contractNumber],
      ['اسم المستأجر', data.tenantName],
      ['العقار', data.propertyLabel],
    ];
    if (data.installmentLabel) tuples.push(['القسط', data.installmentLabel]);
    tuples.push(
      ['مبلغ القسط', displayMoney(data.installmentAmount, settings)],
      ['تاريخ الاستحقاق', data.dueDate],
      ['المبالغ المدفوعة', displayMoney(data.paidAmount, settings)],
      ['المتبقي', displayMoney(data.remainingAmount, settings)]
    );
    return tuples;
  }, [data, settings]);

  return (
    <article
      dir="rtl"
      className={`text-right text-sm text-slate-900 ${className}`}
      style={{ fontFamily: '"Tajawal", system-ui, sans-serif' }}
    >
      <h2 className="mb-4 text-lg font-extrabold text-slate-900">فاتورة قسط</h2>
      <table className="w-full border-collapse border border-slate-200 text-sm leading-relaxed">
        <tbody>
          {rowTuples.map(([k, v]) => (
            <tr key={k}>
              <th className="w-[32%] border border-slate-200 bg-slate-50 px-2 py-2 text-right font-bold text-slate-800">
                {k}
              </th>
              <td className="border border-slate-200 px-2 py-2 text-slate-900">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </article>
  );
};

export type InvoicePrintPreviewProps = Omit<PrintPreviewModalProps, 'bodyHtml'> & {
  data: InvoiceTemplateData;
};

export const InvoicePrintPreview: React.FC<InvoicePrintPreviewProps> = (props) => {
  const { data, settings, ...rest } = props;
  const bodyHtml = useMemo(() => buildInvoiceTemplateBodyHtml(data, settings), [data, settings]);
  return <PrintPreviewModal {...rest} settings={settings} bodyHtml={bodyHtml} />;
};
