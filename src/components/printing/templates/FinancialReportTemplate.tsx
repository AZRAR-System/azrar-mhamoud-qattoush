import React, { useMemo } from 'react';
import type { SystemSettings } from '@/types';
import { formatCurrencyJOD, formatNumber, LOCALE_AR_LATN_GREGORY } from '@/utils/format';
import { escapeHtml } from '../printPreviewTypes';
import { PrintPreviewModal, type PrintPreviewModalProps } from '../PrintPreviewModal';

export type FinancialReportTemplateData = {
  periodLabel?: string;
  totalRevenue: string | number;
  contractsCount: string | number;
  collections: string | number;
  arrears: string | number;
  footerNote?: string;
  documentTitle?: string;
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

function displayCount(v: string | number | undefined): string {
  if (typeof v === 'string' && v.trim()) return v.trim();
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return '—';
  return formatNumber(n, { maximumFractionDigits: 0 });
}

export function buildFinancialReportTemplateBodyHtml(
  data: FinancialReportTemplateData,
  settings: SystemSettings
): string {
  const docTitle = escapeHtml(data.documentTitle || 'تقرير مالي');
  const period = data.periodLabel?.trim()
    ? `<p style="margin:0 0 16px;font-size:13px;color:#475569;">الفترة: <strong>${escapeHtml(data.periodLabel)}</strong></p>`
    : '';

  const rows: [string, string][] = [
    ['إجمالي الإيرادات', escapeHtml(displayMoney(data.totalRevenue, settings))],
    ['عدد العقود (النشطة / المعتمدة)', escapeHtml(displayCount(data.contractsCount))],
    ['التحصيلات', escapeHtml(displayMoney(data.collections, settings))],
    ['المتأخرات', escapeHtml(displayMoney(data.arrears, settings))],
  ];

  const tableRows = rows
    .map(
      ([k, v]) =>
        `<tr><th style="text-align:right;padding:10px;border:1px solid #e5e7eb;width:40%;background:#f8fafc;font-weight:700;">${k}</th><td style="padding:10px;border:1px solid #e5e7eb;font-weight:800;font-size:14px;">${v}</td></tr>`
    )
    .join('');

  const note = data.footerNote?.trim()
    ? `<footer style="margin-top:20px;padding-top:12px;border-top:1px solid #e5e7eb;font-size:11px;color:#64748b;line-height:1.6;">${escapeHtml(data.footerNote).replace(/\n/g, '<br/>')}</footer>`
    : '';

  return `<article style="font-family:${printFont};direction:rtl;text-align:right;color:#0f172a;">
<h2 style="margin:0 0 8px;font-size:18px;font-weight:800;">${docTitle}</h2>
${period}
<table style="width:100%;border-collapse:collapse;font-size:13px;line-height:1.5;">${tableRows}</table>
${note}
</article>`;
}

export const FinancialReportTemplate: React.FC<{
  data: FinancialReportTemplateData;
  settings: SystemSettings;
  className?: string;
}> = ({ data, settings, className = '' }) => {
  const docTitle = data.documentTitle || 'تقرير مالي';

  const rows = useMemo(
    () =>
      [
        ['إجمالي الإيرادات', displayMoney(data.totalRevenue, settings)],
        ['عدد العقود (النشطة / المعتمدة)', displayCount(data.contractsCount)],
        ['التحصيلات', displayMoney(data.collections, settings)],
        ['المتأخرات', displayMoney(data.arrears, settings)],
      ] as [string, string][],
    [data, settings]
  );

  return (
    <article
      dir="rtl"
      className={`text-right text-sm text-slate-900 ${className}`}
      style={{ fontFamily: '"Tajawal", system-ui, sans-serif' }}
    >
      <h2 className="mb-1 text-lg font-extrabold">{docTitle}</h2>
      {data.periodLabel?.trim() ? (
        <p className="mb-4 text-xs text-slate-600">
          الفترة: <strong className="text-slate-900">{data.periodLabel}</strong>
        </p>
      ) : (
        <div className="mb-4" />
      )}

      <table className="w-full border-collapse border border-slate-200 text-sm">
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k}>
              <th className="w-[40%] border border-slate-200 bg-slate-50 px-3 py-3 text-right font-bold">
                {k}
              </th>
              <td className="border border-slate-200 px-3 py-3 text-base font-extrabold text-slate-900">
                {v}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {data.footerNote?.trim() ? (
        <footer className="mt-5 border-t border-slate-200 pt-3 text-[11px] leading-relaxed text-slate-500 whitespace-pre-wrap">
          {data.footerNote}
        </footer>
      ) : null}
    </article>
  );
};

export type FinancialReportPrintPreviewProps = Omit<PrintPreviewModalProps, 'bodyHtml'> & {
  data: FinancialReportTemplateData;
};

export const FinancialReportPrintPreview: React.FC<FinancialReportPrintPreviewProps> = (props) => {
  const { data, settings, ...rest } = props;
  const bodyHtml = useMemo(
    () => buildFinancialReportTemplateBodyHtml(data, settings),
    [data, settings]
  );
  return <PrintPreviewModal {...rest} settings={settings} bodyHtml={bodyHtml} />;
};
