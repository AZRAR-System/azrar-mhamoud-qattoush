import { DbService } from '@/services/mockDb';
import type { ReportResult } from '@/types';

const isDesktop = (): boolean => typeof window !== 'undefined' && !!(window as any).desktopDb;

export async function runReportSmart(id: string): Promise<ReportResult> {
  const reportId = String(id || '').trim();
  if (!reportId) throw new Error('Invalid report id');

  const bridge = (window as any).desktopDb as any;
  if (isDesktop() && bridge?.runReport) {
    try {
      const res = await bridge.runReport(reportId);
      const ok = (res as any)?.ok === true;
      const result = (res as any)?.result;
      if (ok && result) return result as ReportResult;
      // If SQL report is unsupported (or failed), fall back to the legacy in-renderer report engine.
    } catch {
      // fall back
    }
  }

  return DbService.runReport(reportId) as unknown as ReportResult;
}
