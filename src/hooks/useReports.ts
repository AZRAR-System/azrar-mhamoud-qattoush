import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { DbService } from '@/services/mockDb';
import { ReportDefinition } from '@/types';
import { useToast } from '@/context/ToastContext';
import { exportToXlsx, type ExtraSheet } from '@/utils/xlsx';
import { useSmartModal } from '@/context/ModalContext';
import { formatCurrencyJOD, formatDateYMD, formatNumber } from '@/utils/format';
import { useDbSignal } from '@/hooks/useDbSignal';
import { runReportSmart } from '@/services/reporting';
import { getErrorMessage } from '@/utils/errors';
import type { FinancialReportTemplateData } from '@/components/printing/templates/FinancialReportTemplate';

export const useReports = () => {
  const isDesktop = typeof window !== 'undefined' && !!window.desktopDb;
  const [reports, setReports] = useState<ReportDefinition[]>([]);
  const [search, setSearch] = useState('');
  const [financialPrintOpen, setFinancialPrintOpen] = useState(false);
  const [isExportingAll, setIsExportingAll] = useState(false);
  const [kpis, setKpis] = useState<{
    totalExpected: number;
    totalPaid: number;
    totalLate: number;
    totalUpcoming: number;
    remaining: number;
    lateCount: number;
    activeContracts: number;
    openTickets: number;
    generatedAt?: string;
  } | null>(null);
  const [kpisError, setKpisError] = useState<string | null>(null);

  const { openPanel } = useSmartModal();
  const toast = useToast();
  const dbSignal = useDbSignal();
  const kpisTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setReports(DbService.getAvailableReports());
  }, [dbSignal]);

  const loadKpis = useCallback(async () => {
    try {
      const financial = await runReportSmart('financial_summary');
      const late = await runReportSmart('late_installments');
      const contractsActive = await runReportSmart('contracts_active');
      const openTickets = await runReportSmart('maintenance_open_tickets');

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

      setKpisError(null);
      setKpis({
        totalExpected,
        totalPaid,
        totalLate,
        totalUpcoming,
        remaining,
        lateCount: Array.isArray(late?.data) ? late.data.length : 0,
        activeContracts: Array.isArray(contractsActive?.data) ? contractsActive.data.length : 0,
        openTickets: Array.isArray(openTickets?.data) ? openTickets.data.length : 0,
        generatedAt: financial?.generatedAt,
      });
    } catch (e: unknown) {
      console.error('Failed to compute report KPIs', e);
      setKpis(null);
      setKpisError(getErrorMessage(e) || 'تعذر تحميل ملخص التقارير السريع');
    }
  }, []);

  useEffect(() => {
    if (kpisTimerRef.current) clearTimeout(kpisTimerRef.current);
    kpisTimerRef.current = setTimeout(() => {
      void loadKpis();
    }, 400);
    return () => {
      if (kpisTimerRef.current) clearTimeout(kpisTimerRef.current);
    };
  }, [loadKpis, dbSignal]);

  const filteredReports = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return reports;
    return reports.filter((r) => {
      const title = String(r.title || '').toLowerCase();
      const desc = String(r.description || '').toLowerCase();
      return title.includes(q) || desc.includes(q);
    });
  }, [reports, search]);

  const financialPrintData: FinancialReportTemplateData | null = useMemo(() => {
    if (!kpis) return null;
    return {
      periodLabel: kpis.generatedAt ? formatDateYMD(kpis.generatedAt) : undefined,
      totalRevenue: kpis.totalExpected,
      contractsCount: kpis.activeContracts,
      collections: kpis.totalPaid,
      arrears: kpis.totalLate,
      documentTitle: 'تقرير مالي سريع',
      footerNote: [
        `المتبقي الإجمالي: ${formatCurrencyJOD(kpis.remaining, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
        `القادم: ${formatCurrencyJOD(kpis.totalUpcoming, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
        `عدد الكمبيالات المتأخرة: ${formatNumber(kpis.lateCount)}`,
      ].join('\n'),
    };
  }, [kpis]);

  const handlePrintDashboard = useCallback(() => {
    window.print();
  }, []);

  const handleExportAllToExcel = useCallback(async () => {
    if (isExportingAll) return;
    setIsExportingAll(true);
    const tid = toast.loading('جاري تشغيل كافة التقارير وتجميع البيانات...');

    try {
      const allReportIds = reports.map((r) => r.id);
      const results = await Promise.all(
        allReportIds.map(async (id) => {
          try {
            return { id, res: await runReportSmart(id) };
          } catch {
            return { id, res: null };
          }
        })
      );

      const sheets: ExtraSheet[] = results
        .filter((r) => r.res && r.res.data)
        .map((r) => {
          const rep = r.res;
          if (!rep) return null;
          const headers = rep.columns.map((c) => c.header);
          const dataRows = (rep.data || []).map((row: Record<string, unknown>) =>
            rep.columns.map((col) => row[col.key] ?? '')
          );
          return {
            name: String(rep.title || r.id).slice(0, 31).replace(/[\\/:*?"<>|]/g, '_'),
            rows: [headers, ...dataRows],
          };
        })
        .filter((s): s is ExtraSheet => s !== null);

      if (sheets.length === 0) {
        toast.error('لم يتم العثور على بيانات لتصديرها', { id: tid });
        return;
      }

      await exportToXlsx(
        'الملخص المالي',
        [{ key: 'label', header: 'المجال' }, { key: 'value', header: 'النتيجة' }],
        kpis ? [
          { label: 'إجمالي المتوقع', value: kpis.totalExpected },
          { label: 'إجمالي المحصل', value: kpis.totalPaid },
          { label: 'إجمالي المتأخر', value: kpis.totalLate },
          { label: 'العقود النشطة', value: kpis.activeContracts },
          { label: 'تذاكر الصيانة', value: kpis.openTickets },
        ] : [],
        `تقرير_شامل_${new Date().toISOString().slice(0, 10)}.xlsx`,
        { extraSheets: sheets }
      );

      toast.success('✅ تم تصدير كافة التقارير في ملف Excel واحد بنجاح', { id: tid });
    } catch (err) {
      console.error('Unified export failed:', err);
      toast.error('❌ فشل في تجميع البيانات وتصدير الملف', { id: tid });
    } finally {
      setIsExportingAll(false);
    }
  }, [reports, kpis, isExportingAll, toast]);

  return {
    isDesktop,
    reports,
    search,
    setSearch,
    financialPrintOpen,
    setFinancialPrintOpen,
    isExportingAll,
    kpis,
    kpisError,
    loadKpis,
    openPanel,
    filteredReports,
    financialPrintData,
    handlePrintDashboard,
    handleExportAllToExcel,
  };
};
