import React, { useMemo } from 'react';
import type { SystemSettings } from '@/types';
import { formatCurrencyJOD, LOCALE_AR_LATN_GREGORY } from '@/utils/format';
import { escapeHtml } from '../printPreviewTypes';
import { PrintPreviewModal, type PrintPreviewModalProps } from '../PrintPreviewModal';

export type ContractTemplateData = {
  lessorName: string;
  tenantName: string;
  propertyDetails: string;
  durationText: string;
  rentAmount: string | number;
  /** نص الشروط (نص عادي؛ يُعرض مع الحفاظ على الأسطر) */
  terms: string;
  contractTitle?: string;
};

const printFont = '"Tajawal",system-ui,-apple-system,"Segoe UI",Arial,sans-serif';

function displayRent(v: string | number | undefined, settings: SystemSettings): string {
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

export function buildContractTemplateBodyHtml(
  data: ContractTemplateData,
  settings: SystemSettings
): string {
  const title = escapeHtml(data.contractTitle || 'عقد إيجار');
  const termsEscaped = escapeHtml(data.terms).replace(/\r\n/g, '\n').replace(/\n/g, '<br/>');

  const rows: [string, string][] = [
    ['المؤجر (الطرف الأول)', escapeHtml(data.lessorName)],
    ['المستأجر (الطرف الثاني)', escapeHtml(data.tenantName)],
    ['بيانات العقار', escapeHtml(data.propertyDetails)],
    ['مدة العقد', escapeHtml(data.durationText)],
    ['الإيجار', escapeHtml(displayRent(data.rentAmount, settings))],
  ];

  const tableRows = rows
    .map(
      ([k, v]) =>
        `<tr><th style="text-align:right;padding:8px;border:1px solid #e5e7eb;width:28%;background:#f8fafc;font-weight:700;">${k}</th><td style="padding:8px;border:1px solid #e5e7eb;vertical-align:top;">${v}</td></tr>`
    )
    .join('');

  return `<article style="font-family:${printFont};direction:rtl;text-align:right;color:#0f172a;">
<h2 style="margin:0 0 16px;font-size:18px;font-weight:800;">${title}</h2>
<table style="width:100%;border-collapse:collapse;font-size:13px;line-height:1.5;margin-bottom:16px;">${tableRows}</table>
<section>
<h3 style="margin:0 0 8px;font-size:14px;font-weight:800;">الشروط والأحكام</h3>
<div style="font-size:12px;line-height:1.7;color:#334155;border:1px solid #e5e7eb;padding:12px;border-radius:8px;background:#fafafa;">${termsEscaped}</div>
</section>
</article>`;
}

export const ContractTemplate: React.FC<{
  data: ContractTemplateData;
  settings: SystemSettings;
  className?: string;
}> = ({ data, settings, className = '' }) => {
  const title = data.contractTitle || 'عقد إيجار';

  const rows = useMemo(
    () =>
      [
        ['المؤجر (الطرف الأول)', data.lessorName],
        ['المستأجر (الطرف الثاني)', data.tenantName],
        ['بيانات العقار', data.propertyDetails],
        ['مدة العقد', data.durationText],
        ['الإيجار', displayRent(data.rentAmount, settings)],
      ] as [string, string][],
    [data, settings]
  );

  return (
    <article
      dir="rtl"
      className={`text-right text-sm text-slate-900 ${className}`}
      style={{ fontFamily: '"Tajawal", system-ui, sans-serif' }}
    >
      <h2 className="mb-4 text-lg font-extrabold">{title}</h2>
      <table className="mb-4 w-full border-collapse border border-slate-200 text-sm leading-relaxed">
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k}>
              <th className="w-[28%] border border-slate-200 bg-slate-50 px-2 py-2 align-top font-bold">
                {k}
              </th>
              <td className="border border-slate-200 px-2 py-2 align-top whitespace-pre-wrap">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <section>
        <h3 className="mb-2 text-sm font-extrabold text-slate-900">الشروط والأحكام</h3>
        <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 text-xs leading-relaxed text-slate-700 whitespace-pre-wrap">
          {data.terms}
        </div>
      </section>
    </article>
  );
};

export type ContractPrintPreviewProps = Omit<PrintPreviewModalProps, 'bodyHtml'> & {
  data: ContractTemplateData;
};

export const ContractPrintPreview: React.FC<ContractPrintPreviewProps> = (props) => {
  const { data, settings, ...rest } = props;
  const bodyHtml = useMemo(() => buildContractTemplateBodyHtml(data, settings), [data, settings]);
  return <PrintPreviewModal {...rest} settings={settings} bodyHtml={bodyHtml} />;
};
