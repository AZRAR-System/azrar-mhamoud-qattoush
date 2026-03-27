import { DbService } from '@/services/mockDb';
import type { ReportResult } from '@/types';

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null;

const hasUnknownProp = <K extends string>(
  obj: UnknownRecord,
  key: K
): obj is UnknownRecord & Record<K, unknown> => Object.prototype.hasOwnProperty.call(obj, key);

const isDesktop = (): boolean => typeof window !== 'undefined' && !!window.desktopDb;

export async function runReportSmart(id: string): Promise<ReportResult> {
  const reportId = String(id || '').trim();
  if (!reportId) throw new Error('Invalid report id');

  const bridge = typeof window !== 'undefined' ? window.desktopDb : undefined;
  if (isDesktop() && typeof bridge?.runReport === 'function') {
    try {
      const res: unknown = await bridge.runReport(reportId);
      const ok = isRecord(res) && hasUnknownProp(res, 'ok') && res.ok === true;
      const result = isRecord(res) && hasUnknownProp(res, 'result') ? res.result : undefined;
      if (ok && result) return result as ReportResult;
      // If SQL report is unsupported (or failed), fall back to the legacy in-renderer report engine.
    } catch {
      // fall back
    }
  }

  return DbService.runReport(reportId) as unknown as ReportResult;
}
