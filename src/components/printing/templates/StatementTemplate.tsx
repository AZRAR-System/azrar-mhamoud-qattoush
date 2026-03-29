import React, { useMemo } from 'react';
import type { SystemSettings } from '@/types';
import { formatCurrencyJOD, LOCALE_AR_LATN_GREGORY } from '@/utils/format';
import { escapeHtml } from '../printPreviewTypes';
import { PrintPreviewModal, type PrintPreviewModalProps } from '../PrintPreviewModal';

export type StatementInstallmentRow = {
  description?: string;
  dueDate?: string;
  paid?: string | number;
  remaining?: string | number;
};

export type StatementTemplateData = {
  monthLabel: string;
  rows: StatementInstallmentRow[];
  totalPaid: string | number;
  totalRemaining: string | number;
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

export function buildStatementTemplateBodyHtml(
  data: StatementTemplateData,
  settings: SystemSettings
): string {
  const docTitle = escapeHtml(data.documentTitle || 'كشف حسابات شهري');
  const month = escapeHtml(data.monthLabel);

  const head = `<thead><tr>
<th style="text-align:right;padding:8px;border:1px solid #e5e7eb;background:#f1f5f9;font-weight:800;">البند / الوصف</th>
<th style="text-align:right;padding:8px;border:1px solid #e5e7eb;background:#f1f5f9;font-weight:800;">الاستحقاق</th>
<th style="text-align:right;padding:8px;border:1px solid #e5e7eb;background:#f1f5f9;font-weight:800;">المدفوع</th>
<th style="text-align:right;padding:8px;border:1px solid #e5e7eb;background:#f1f5f9;font-weight:800;">المتبقي</th>
</tr></thead>`;

  const bodyRows = (data.rows || [])
    .map((r) => {
      const d = escapeHtml(r.description || '—');
      const due = escapeHtml(r.dueDate || '—');
      const p = escapeHtml(displayMoney(r.paid, settings));
      const rem = escapeHtml(displayMoney(r.remaining, settings));
      return `<tr><td style="padding:8px;border:1px solid #e5e7eb;">${d}</td><td style="padding:8px;border:1px solid #e5e7eb;">${due}</td><td style="padding:8px;border:1px solid #e5e7eb;">${p}</td><td style="padding:8px;border:1px solid #e5e7eb;">${rem}</td></tr>`;
    })
    .join('');

  const totals = `<tfoot><tr>
<td colspan="2" style="text-align:right;padding:8px;border:1px solid #e5e7eb;font-weight:800;background:#f8fafc;">الإجماليات</td>
<td style="padding:8px;border:1px solid #e5e7eb;font-weight:800;background:#ecfdf5;">${escapeHtml(displayMoney(data.totalPaid, settings))}</td>
<td style="padding:8px;border:1px solid #e5e7eb;font-weight:800;background:#fff7ed;">${escapeHtml(displayMoney(data.totalRemaining, settings))}</td>
</tr></tfoot>`;

  return `<article style="font-family:${printFont};direction:rtl;text-align:right;color:#0f172a;">
<h2 style="margin:0 0 8px;font-size:18px;font-weight:800;">${docTitle}</h2>
<p style="margin:0 0 16px;font-size:13px;color:#475569;">الفترة: <strong>${month}</strong></p>
<table style="width:100%;border-collapse:collapse;font-size:12px;line-height:1.5;">${head}<tbody>${bodyRows}</tbody>${totals}</table>
</article>`;
}

export const StatementTemplate: React.FC<{
  data: StatementTemplateData;
  settings: SystemSettings;
  className?: string;
}> = ({ data, settings, className = '' }) => {
  const docTitle = data.documentTitle || 'كشف حسابات شهري';

  const rows = data.rows || [];

  return (
    <article
      dir="rtl"
      className={`text-right text-sm text-slate-900 ${className}`}
      style={{ fontFamily: '"Tajawal", system-ui, sans-serif' }}
    >
      <h2 className="mb-1 text-lg font-extrabold">{docTitle}</h2>
      <p className="mb-4 text-xs text-slate-600">
        الفترة: <strong className="text-slate-900">{data.monthLabel}</strong>
      </p>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] border-collapse border border-slate-200 text-xs">
          <thead>
            <tr className="bg-slate-100">
              <th className="border border-slate-200 px-2 py-2 text-right font-extrabold">البند / الوصف</th>
              <th className="border border-slate-200 px-2 py-2 text-right font-extrabold">الاستحقاق</th>
              <th className="border border-slate-200 px-2 py-2 text-right font-extrabold">المدفوع</th>
              <th className="border border-slate-200 px-2 py-2 text-right font-extrabold">المتبقي</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="border border-slate-200 px-2 py-4 text-center text-slate-500">
                  لا توجد أقساط للعرض
                </td>
              </tr>
            ) : (
              rows.map((r, i) => (
                <tr key={i}>
                  <td className="border border-slate-200 px-2 py-2">{r.description || '—'}</td>
                  <td className="border border-slate-200 px-2 py-2">{r.dueDate || '—'}</td>
                  <td className="border border-slate-200 px-2 py-2 text-emerald-800">
                    {displayMoney(r.paid, settings)}
                  </td>
                  <td className="border border-slate-200 px-2 py-2 text-amber-900">
                    {displayMoney(r.remaining, settings)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50 font-extrabold">
              <td colSpan={2} className="border border-slate-200 px-2 py-2 text-right">
                الإجماليات
              </td>
              <td className="border border-slate-200 bg-emerald-50 px-2 py-2 text-emerald-900">
                {displayMoney(data.totalPaid, settings)}
              </td>
              <td className="border border-slate-200 bg-amber-50 px-2 py-2 text-amber-950">
                {displayMoney(data.totalRemaining, settings)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </article>
  );
};

export type StatementPrintPreviewProps = Omit<PrintPreviewModalProps, 'bodyHtml'> & {
  data: StatementTemplateData;
};

export const StatementPrintPreview: React.FC<StatementPrintPreviewProps> = (props) => {
  const { data, settings, ...rest } = props;
  const bodyHtml = useMemo(() => buildStatementTemplateBodyHtml(data, settings), [data, settings]);
  return <PrintPreviewModal {...rest} settings={settings} bodyHtml={bodyHtml} />;
};
