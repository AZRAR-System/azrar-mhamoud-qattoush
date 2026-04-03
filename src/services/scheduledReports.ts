/**
 * تقارير مالية مجدولة — KPIs + أقساط قادمة + عقود تنتهي + متأخرات.
 * التخزين: KEYS.SCHEDULED_REPORTS_CONFIG
 */

import type { SystemSettings } from '@/types';
import type { FinancialReportTemplateData } from '@/components/printing/templates/FinancialReportTemplate';
import { buildFinancialReportTemplateBodyHtml } from '@/components/printing/templates/FinancialReportTemplate';
import {
  buildFullPrintHtmlDocument,
  DEFAULT_PRINT_MARGINS_MM,
} from '@/components/printing/printPreviewTypes';
import { getSettings } from '@/services/db/settings';
import { KEYS } from '@/services/db/keys';
import { storage } from '@/services/storage';
import { getPaymentNotificationTargetsInternal } from '@/services/db/paymentNotifications';
import { notificationCenter } from '@/services/notificationCenter';
import { formatCurrencyJOD, formatNumber } from '@/utils/format';

export type ScheduledReportsKvState = {
  lastDailyYmd?: string;
  /** تاريخ يوم الاثنين (YYYY-MM-DD) لأسبوع آخر تشغيل أسبوعي */
  lastWeeklyMondayYmd?: string;
  lastMonthlyYm?: string;
  snapshot?: { generatedAt: string; data: FinancialReportTemplateData };
};

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function ymdLocal(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** يوم الاثنين لأسبوع التاريخ المحلي */
function mondayOfWeekLocal(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = x.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  x.setDate(x.getDate() + diff);
  return x;
}

function parseTimeToMinutes(t: string | undefined): number {
  const s = String(t || '08:00').trim();
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!m) return 8 * 60;
  const h = Math.min(23, Math.max(0, parseInt(m[1], 10)));
  const min = Math.min(59, Math.max(0, parseInt(m[2], 10)));
  return h * 60 + min;
}

function nowMinutesLocal(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

export function loadScheduledReportsState(): ScheduledReportsKvState {
  try {
    const raw = localStorage.getItem(KEYS.SCHEDULED_REPORTS_CONFIG);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    return { ...(parsed as ScheduledReportsKvState) };
  } catch {
    return {};
  }
}

export function saveScheduledReportsState(next: ScheduledReportsKvState): void {
  const serialized = JSON.stringify(next);
  localStorage.setItem(KEYS.SCHEDULED_REPORTS_CONFIG, serialized);
  void storage.setItem(KEYS.SCHEDULED_REPORTS_CONFIG, serialized);
  try {
    window.dispatchEvent(
      new CustomEvent('azrar:db-changed', { detail: { key: KEYS.SCHEDULED_REPORTS_CONFIG } })
    );
  } catch {
    /* ignore */
  }
}

export function getLastScheduledReportSnapshot(): ScheduledReportsKvState['snapshot'] {
  return loadScheduledReportsState().snapshot;
}

function shouldRunForPeriod(
  settings: SystemSettings,
  state: ScheduledReportsKvState,
  now: Date
): boolean {
  if (!settings.scheduledReportsEnabled) return false;

  const freq = settings.scheduledReportFrequency ?? 'daily';
  const schedMin = parseTimeToMinutes(settings.scheduledReportTime);
  if (nowMinutesLocal(now) < schedMin) return false;

  const todayYmd = ymdLocal(now);
  const monYmd = ymdLocal(mondayOfWeekLocal(now));
  const ym = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;

  if (freq === 'daily') {
    return state.lastDailyYmd !== todayYmd;
  }
  if (freq === 'weekly') {
    return state.lastWeeklyMondayYmd !== monYmd;
  }
  if (freq === 'monthly') {
    if (now.getDate() !== 1) return false;
    return state.lastMonthlyYm !== ym;
  }
  return false;
}

function patchStateAfterRun(
  state: ScheduledReportsKvState,
  settings: SystemSettings,
  now: Date
): ScheduledReportsKvState {
  const freq = settings.scheduledReportFrequency ?? 'daily';
  const todayYmd = ymdLocal(now);
  const monYmd = ymdLocal(mondayOfWeekLocal(now));
  const ym = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;
  const next = { ...state };
  if (freq === 'daily') next.lastDailyYmd = todayYmd;
  if (freq === 'weekly') next.lastWeeklyMondayYmd = monYmd;
  if (freq === 'monthly') next.lastMonthlyYm = ym;
  return next;
}

async function buildFinancialReportPayload(): Promise<FinancialReportTemplateData> {
  const { runReportSmart } = await import('@/services/reporting');

  const financial = await runReportSmart('financial_summary');
  const late = await runReportSmart('late_installments');
  const expiring = await runReportSmart('contracts_expiring');

  const isRecord = (v: unknown): v is Record<string, unknown> =>
    typeof v === 'object' && v !== null;

  const lookup = new Map<string, unknown>();
  for (const row of Array.isArray(financial?.data) ? financial.data : []) {
    if (!isRecord(row)) continue;
    const item = row.item;
    if (typeof item !== 'string' || !item.trim()) continue;
    lookup.set(item, row.value);
  }

  const totalExpected = Number(lookup.get('إجمالي المتوقع') ?? 0) || 0;
  const totalPaid = Number(lookup.get('إجمالي المحصل') ?? 0) || 0;
  const totalLate = Number(lookup.get('إجمالي المتأخر') ?? 0) || 0;
  const totalUpcoming = Number(lookup.get('إجمالي القادم') ?? 0) || 0;
  const remaining = Number(lookup.get('المتبقي') ?? totalExpected - totalPaid) || 0;

  const lateRows = Array.isArray(late?.data) ? late.data : [];
  const lateCount = lateRows.length;

  const expiringRows = Array.isArray(expiring?.data) ? expiring.data : [];
  const expiringCount = expiringRows.length;

  const contractsActive = await runReportSmart('contracts_active');
  const activeContractsCount = Array.isArray(contractsActive?.data) ? contractsActive.data.length : 0;

  const upcomingTargets = getPaymentNotificationTargetsInternal(60);
  let upcomingInstallmentCount = 0;
  let upcomingAmountSum = 0;
  const upcomingLines: string[] = [];
  for (const t of upcomingTargets) {
    for (const it of t.items) {
      upcomingInstallmentCount += 1;
      upcomingAmountSum += Number(it.amountRemaining) || 0;
      if (upcomingLines.length < 8) {
        upcomingLines.push(
          `• ${t.tenantName} — ${it.dueDate} — ${formatCurrencyJOD(Number(it.amountRemaining) || 0)} (${it.daysUntilDue} يوم)`
        );
      }
    }
  }

  const lateLines: string[] = [];
  for (let i = 0; i < Math.min(6, lateRows.length); i++) {
    const r = lateRows[i] as Record<string, unknown>;
    lateLines.push(
      `• ${String(r.tenant ?? '—')} — ${String(r.dueDate ?? '—')} — ${formatCurrencyJOD(Number(r.amount) || 0)}`
    );
  }

  const expLines: string[] = [];
  for (let i = 0; i < Math.min(6, expiringRows.length); i++) {
    const r = expiringRows[i] as Record<string, unknown>;
    expLines.push(
      `• ${String(r.contractNo ?? '—')} — ${String(r.tenant ?? '—')} — ينتهي ${String(r.endDate ?? '—')}`
    );
  }

  const periodLabel = financial?.generatedAt
    ? String(financial.generatedAt)
    : new Date().toLocaleString('ar-JO');

  const footerNote = [
    `المتبقي الإجمالي: ${formatCurrencyJOD(remaining, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
    `القادم (إجمالي KPI): ${formatCurrencyJOD(totalUpcoming, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
    '',
    `— أقساط قادمة (خلال 60 يوماً) —`,
    `عدد الدفعات: ${formatNumber(upcomingInstallmentCount)} — المجموع: ${formatCurrencyJOD(upcomingAmountSum, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
    ...upcomingLines,
    upcomingInstallmentCount > 8 ? `… و${formatNumber(upcomingInstallmentCount - 8)} أخرى` : '',
    '',
    `— عقود تنتهي خلال 30 يوماً —`,
    `العدد: ${formatNumber(expiringCount)}`,
    ...expLines,
    expiringCount > 6 ? `… و${formatNumber(expiringCount - 6)} أخرى` : '',
    '',
    `— متأخرات —`,
    `عدد الكمبيالات: ${formatNumber(lateCount)}`,
    ...lateLines,
    lateCount > 6 ? `… و${formatNumber(lateCount - 6)} أخرى` : '',
  ]
    .filter((x) => x !== '')
    .join('\n');

  return {
    periodLabel,
    totalRevenue: totalExpected,
    contractsCount: activeContractsCount,
    collections: totalPaid,
    arrears: totalLate,
    documentTitle: 'تقرير مالي مجدول',
    footerNote,
  };
}

async function savePdfIfConfigured(
  settings: SystemSettings,
  bodyInnerHtml: string,
  dateYmd: string
): Promise<string | undefined> {
  const dir = String(settings.scheduledReportExportPath || '').trim();
  if (!dir) return undefined;
  if (typeof window === 'undefined' || !window.desktopPrinting?.savePdfToPath) return undefined;

  const settingsFull = settings;
  const fullHtml = buildFullPrintHtmlDocument(settingsFull, bodyInnerHtml, {
    orientation: 'portrait',
    marginsMm: DEFAULT_PRINT_MARGINS_MM,
  });

  const safeName = `تقرير-مالي-${dateYmd}.pdf`;
  const sep = dir.includes('\\') ? '\\' : '/';
  const filePath = dir.endsWith(sep) || dir.endsWith('/') || dir.endsWith('\\')
    ? `${dir}${safeName}`
    : `${dir}${sep}${safeName}`;

  const res = await window.desktopPrinting.savePdfToPath({
    html: fullHtml,
    filePath,
    orientation: 'portrait',
    marginsMm: DEFAULT_PRINT_MARGINS_MM,
    copies: 1,
  });

  if (res && typeof res === 'object' && 'ok' in res && res.ok === true && 'savedPath' in res) {
    return String((res as { savedPath?: string }).savedPath || filePath);
  }
  return undefined;
}

/**
 * يُستدعى عند بدء الجلسة (قبل قفل المجدول اليومي) للتحقق من الوقت والفترة.
 */
export async function runScheduledReportsTick(): Promise<void> {
  const settings = getSettings();
  const state = loadScheduledReportsState();
  const now = new Date();

  if (!shouldRunForPeriod(settings, state, now)) return;

  let data: FinancialReportTemplateData;
  try {
    data = await buildFinancialReportPayload();
  } catch (e) {
    console.warn('[scheduledReports] build failed', e);
    return;
  }

  const generatedAt = new Date().toISOString();
  const dateYmd = generatedAt.slice(0, 10);

  const nextState = patchStateAfterRun(state, settings, now);
  nextState.snapshot = { generatedAt, data };
  saveScheduledReportsState(nextState);

  let pdfNote = '';
  try {
    const bodyHtml = buildFinancialReportTemplateBodyHtml(data, settings);
    const saved = await savePdfIfConfigured(settings, bodyHtml, dateYmd);
    if (saved) pdfNote = ` — حُفظ: ${saved}`;
  } catch (e) {
    console.warn('[scheduledReports] pdf save failed', e);
  }

  notificationCenter.add({
    type: 'info',
    title: 'تقرير مالي مجدول جاهز',
    message: `تم توليد التقرير (${settings.scheduledReportFrequency ?? 'daily'}). اضغط لعرض المعاينة.${pdfNote}`,
    category: 'scheduled_financial_report',
    entityId: 'scheduled_financial_report',
  });
}
