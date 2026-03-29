import React, { useMemo } from 'react';
import type { SystemSettings } from '@/types';
import { formatCurrencyJOD, LOCALE_AR_LATN_GREGORY } from '@/utils/format';
import { escapeHtml } from '../printPreviewTypes';
import { PrintPreviewModal, type PrintPreviewModalProps } from '../PrintPreviewModal';

export type ReceiptTemplateData = {
  receiptNumber: string;
  amountReceived: string | number;
  paymentMethod: string;
  date: string;
  /** عنوان اختياري لقسم الخطاب الرسمي */
  officialLetterTitle?: string;
  /** نص الخطاب الرسمي (نص عادي) */
  officialLetterBody?: string;
  documentTitle?: string;
};

const printFont = '"Tajawal",system-ui,-apple-system,"Segoe UI",Arial,sans-serif';

function displayAmount(v: string | number | undefined, settings: SystemSettings): string {
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

export function buildReceiptTemplateBodyHtml(
  data: ReceiptTemplateData,
  settings: SystemSettings
): string {
  const docTitle = escapeHtml(data.documentTitle || 'إيصال دفع');
  const rows: [string, string][] = [
    ['رقم الإيصال', escapeHtml(data.receiptNumber)],
    ['المبلغ المستلم', escapeHtml(displayAmount(data.amountReceived, settings))],
    ['طريقة الدفع', escapeHtml(data.paymentMethod)],
    ['التاريخ', escapeHtml(data.date)],
  ];

  const tableRows = rows
    .map(
      ([k, v]) =>
        `<tr><th style="text-align:right;padding:8px;border:1px solid #e5e7eb;width:30%;background:#f8fafc;font-weight:700;">${k}</th><td style="padding:8px;border:1px solid #e5e7eb;">${v}</td></tr>`
    )
    .join('');

  let letter = '';
  if (data.officialLetterBody?.trim()) {
    const lt = data.officialLetterTitle
      ? `<h3 style="margin:0 0 8px;font-size:14px;font-weight:800;">${escapeHtml(data.officialLetterTitle)}</h3>`
      : `<h3 style="margin:0 0 8px;font-size:14px;font-weight:800;">خطاب رسمي</h3>`;
    const body = escapeHtml(data.officialLetterBody).replace(/\n/g, '<br/>');
    letter = `<section style="margin-top:20px;padding-top:16px;border-top:1px solid #e5e7eb;">${lt}<div style="font-size:12px;line-height:1.75;color:#334155;">${body}</div></section>`;
  }

  return `<article style="font-family:${printFont};direction:rtl;text-align:right;color:#0f172a;">
<h2 style="margin:0 0 16px;font-size:18px;font-weight:800;">${docTitle}</h2>
<table style="width:100%;border-collapse:collapse;font-size:13px;line-height:1.5;">${tableRows}</table>
${letter}
</article>`;
}

export const ReceiptTemplate: React.FC<{
  data: ReceiptTemplateData;
  settings: SystemSettings;
  className?: string;
}> = ({ data, settings, className = '' }) => {
  const docTitle = data.documentTitle || 'إيصال دفع';

  const rows = useMemo(
    () =>
      [
        ['رقم الإيصال', data.receiptNumber],
        ['المبلغ المستلم', displayAmount(data.amountReceived, settings)],
        ['طريقة الدفع', data.paymentMethod],
        ['التاريخ', data.date],
      ] as [string, string][],
    [data, settings]
  );

  return (
    <article
      dir="rtl"
      className={`text-right text-sm text-slate-900 ${className}`}
      style={{ fontFamily: '"Tajawal", system-ui, sans-serif' }}
    >
      <h2 className="mb-4 text-lg font-extrabold">{docTitle}</h2>
      <table className="w-full border-collapse border border-slate-200 text-sm leading-relaxed">
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k}>
              <th className="w-[30%] border border-slate-200 bg-slate-50 px-2 py-2 font-bold">{k}</th>
              <td className="border border-slate-200 px-2 py-2">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {data.officialLetterBody?.trim() ? (
        <section className="mt-6 border-t border-slate-200 pt-4">
          <h3 className="mb-2 text-sm font-extrabold">
            {data.officialLetterTitle || 'خطاب رسمي'}
          </h3>
          <div className="text-xs leading-relaxed text-slate-700 whitespace-pre-wrap">
            {data.officialLetterBody}
          </div>
        </section>
      ) : null}
    </article>
  );
};

export type ReceiptPrintPreviewProps = Omit<PrintPreviewModalProps, 'bodyHtml'> & {
  data: ReceiptTemplateData;
};

export const ReceiptPrintPreview: React.FC<ReceiptPrintPreviewProps> = (props) => {
  const { data, settings, ...rest } = props;
  const bodyHtml = useMemo(() => buildReceiptTemplateBodyHtml(data, settings), [data, settings]);
  return <PrintPreviewModal {...rest} settings={settings} bodyHtml={bodyHtml} />;
};
