import React, { useMemo, useState, useEffect } from 'react';
import { DbService } from '@/services/mockDb';
import { ReportDefinition, ReportCategory } from '@/types';
import {
  BarChart3,
  Wallet,
  FileText,
  Building2,
  Users,
  Wrench,
  ArrowRight,
  Search,
  AlertCircle,
  type LucideIcon,
} from 'lucide-react';
import { useSmartModal } from '@/context/ModalContext';
import { formatCurrencyJOD, formatDateYMD, formatNumber } from '@/utils/format';
import { DS } from '@/constants/designSystem';
import { Input } from '@/components/ui/Input';
import { useDbSignal } from '@/hooks/useDbSignal';
import { runReportSmart } from '@/services/reporting';
import { PaginationControls } from '@/components/shared/PaginationControls';
import { getErrorMessage } from '@/utils/errors';

const CATEGORIES: { id: ReportCategory; label: string; icon: LucideIcon; color: string }[] = [
  { id: 'Financial', label: 'التقارير المالية', icon: Wallet, color: 'bg-emerald-500' },
  { id: 'Contracts', label: 'تقارير العقود', icon: FileText, color: 'bg-indigo-500' },
  { id: 'Properties', label: 'تقارير العقارات', icon: Building2, color: 'bg-purple-500' },
  { id: 'Tenants', label: 'تقارير المستأجرين', icon: Users, color: 'bg-orange-500' },
  { id: 'Maintenance', label: 'الصيانة والدعم', icon: Wrench, color: 'bg-slate-500' },
];

const CategorySection: React.FC<{
  cat: { id: ReportCategory; label: string; icon: LucideIcon; color: string };
  catReports: ReportDefinition[];
  openPanel: (type: string, id: string) => void;
  resetKey: string;
}> = ({ cat, catReports, openPanel, resetKey }) => {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);

  useEffect(() => {
    const compute = () => {
      if (typeof window === 'undefined') return;
      const w = window.innerWidth;
      if (w < 640) setPageSize(4);
      else if (w < 1024) setPageSize(6);
      else setPageSize(9);
    };
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, []);

  useEffect(() => {
    setPage(1);
  }, [resetKey, cat.id]);

  const safePageSize = Math.max(1, Math.floor(pageSize));
  const pageCount = Math.max(1, Math.ceil(catReports.length / safePageSize));

  useEffect(() => {
    setPage((p) => Math.min(Math.max(1, p), pageCount));
  }, [pageCount]);

  const visible = catReports.slice((page - 1) * safePageSize, page * safePageSize);

  return (
    <div className="app-card">
      <div className="p-4 border-b border-gray-100 dark:border-slate-700 flex items-center gap-3 bg-gray-50 dark:bg-slate-900/50">
        <div className={`p-2 rounded-lg text-white ${cat.color}`}>
          <cat.icon size={20} />
        </div>
        <div className="flex flex-wrap items-center justify-between w-full gap-3">
          <div>
            <h3 className="font-bold text-lg text-slate-800 dark:text-white">{cat.label}</h3>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {formatNumber(catReports.length)} تقرير
            </span>
          </div>
          <PaginationControls page={page} pageCount={pageCount} onPageChange={setPage} />
        </div>
      </div>

      <div className="p-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {visible.map((rep) => (
          <button
            key={rep.id}
            onClick={() => openPanel('REPORT_VIEWER', rep.id)}
            className="flex items-start gap-4 p-4 rounded-xl hover:bg-indigo-50 dark:hover:bg-slate-700/50 transition text-right group border border-transparent hover:border-indigo-100 dark:hover:border-slate-600"
          >
            <div className="mt-1 p-2 bg-gray-100 dark:bg-slate-700 rounded-lg group-hover:bg-white dark:group-hover:bg-slate-600 text-slate-500 dark:text-slate-400 transition">
              <BarChart3 size={18} />
            </div>
            <div>
              <h4 className="font-bold text-slate-700 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">
                {rep.title}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                {rep.description}
              </p>
            </div>
            <ArrowRight
              size={16}
              className="mr-auto text-gray-300 group-hover:text-indigo-500 opacity-0 group-hover:opacity-100 transition-all self-center"
            />
          </button>
        ))}
      </div>
    </div>
  );
};

export const Reports: React.FC = () => {
  const [reports, setReports] = useState<ReportDefinition[]>([]);
  const [search, setSearch] = useState('');
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

  const dbSignal = useDbSignal();

  useEffect(() => {
    setReports(DbService.getAvailableReports());
  }, [dbSignal]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
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

        if (cancelled) return;
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
        if (cancelled) return;
        setKpis(null);
        setKpisError(getErrorMessage(e) || 'تعذر تحميل ملخص التقارير السريع');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dbSignal]);

  const filteredReports = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return reports;
    return reports.filter((r) => {
      const title = String(r.title || '').toLowerCase();
      const desc = String(r.description || '').toLowerCase();
      return title.includes(q) || desc.includes(q);
    });
  }, [reports, search]);

  const reportsCount = filteredReports.length;

  return (
    <div className="animate-fade-in space-y-8 pb-10">
      <div className={DS.components.pageHeader}>
        <div>
          <h2 className={`${DS.components.pageTitle} flex items-center gap-2`}>
            <BarChart3 className="text-indigo-600" /> مركز التقارير المتقدم
          </h2>
          <p className={DS.components.pageSubtitle}>
            توليد تقارير تفصيلية عن جميع عمليات النظام مع إمكانية التصدير والطباعة.
          </p>
          {kpis?.generatedAt ? (
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
              آخر تحديث: {formatDateYMD(kpis.generatedAt)}
            </p>
          ) : null}
        </div>
      </div>

      <div className="app-card">
        <div className="p-4 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between bg-gray-50 dark:bg-slate-900/50 gap-3">
          <div>
            <h3 className="font-bold text-lg text-slate-800 dark:text-white">
              ملخص سريع (بيانات حقيقية)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              مُحتسب مباشرة من محرك التقارير
            </p>
          </div>
          <div className="w-full max-w-md">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث عن تقرير..."
              icon={<Search size={16} />}
            />
          </div>
        </div>

        {kpisError ? (
          <div className="px-4 pb-2">
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
              <AlertCircle className="mt-0.5 shrink-0" size={18} aria-hidden />
              <span>{kpisError}</span>
            </div>
          </div>
        ) : null}

        <div className="p-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          <div className="rounded-xl border border-gray-100 dark:border-slate-700 p-3">
            <div className="text-xs text-slate-500 dark:text-slate-400">المتأخر (متبقي)</div>
            <div className="text-lg font-bold text-slate-800 dark:text-white">
              {formatCurrencyJOD(kpis?.totalLate ?? 0, {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })}
            </div>
            <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
              {formatNumber(kpis?.lateCount ?? 0)} كمبيالة
            </div>
          </div>
          <div className="rounded-xl border border-gray-100 dark:border-slate-700 p-3">
            <div className="text-xs text-slate-500 dark:text-slate-400">المحصّل</div>
            <div className="text-lg font-bold text-slate-800 dark:text-white">
              {formatCurrencyJOD(kpis?.totalPaid ?? 0, {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })}
            </div>
          </div>
          <div className="rounded-xl border border-gray-100 dark:border-slate-700 p-3">
            <div className="text-xs text-slate-500 dark:text-slate-400">القادم</div>
            <div className="text-lg font-bold text-slate-800 dark:text-white">
              {formatCurrencyJOD(kpis?.totalUpcoming ?? 0, {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })}
            </div>
          </div>
          <div className="rounded-xl border border-gray-100 dark:border-slate-700 p-3">
            <div className="text-xs text-slate-500 dark:text-slate-400">المتبقي</div>
            <div className="text-lg font-bold text-slate-800 dark:text-white">
              {formatCurrencyJOD(kpis?.remaining ?? 0, {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })}
            </div>
          </div>
          <div className="rounded-xl border border-gray-100 dark:border-slate-700 p-3">
            <div className="text-xs text-slate-500 dark:text-slate-400">إجمالي المتوقع</div>
            <div className="text-lg font-bold text-slate-800 dark:text-white">
              {formatCurrencyJOD(kpis?.totalExpected ?? 0, {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })}
            </div>
          </div>
          <div className="rounded-xl border border-gray-100 dark:border-slate-700 p-3">
            <div className="text-xs text-slate-500 dark:text-slate-400">العقود النشطة</div>
            <div className="text-lg font-bold text-slate-800 dark:text-white">
              {formatNumber(kpis?.activeContracts ?? 0)}
            </div>
          </div>
          <div className="rounded-xl border border-gray-100 dark:border-slate-700 p-3">
            <div className="text-xs text-slate-500 dark:text-slate-400">تذاكر الصيانة المفتوحة</div>
            <div className="text-lg font-bold text-slate-800 dark:text-white">
              {formatNumber(kpis?.openTickets ?? 0)}
            </div>
          </div>
          <div className="rounded-xl border border-gray-100 dark:border-slate-700 p-3">
            <div className="text-xs text-slate-500 dark:text-slate-400">عدد التقارير</div>
            <div className="text-lg font-bold text-slate-800 dark:text-white">
              {formatNumber(reportsCount)}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8">
        {reportsCount === 0 ? (
          <div className="app-card p-6">
            <div className="text-slate-600 dark:text-slate-300 font-semibold">
              لا توجد تقارير مطابقة.
            </div>
            <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              جرّب تعديل البحث أو تأكد من وجود بيانات داخل النظام.
            </div>
          </div>
        ) : (
          CATEGORIES.map((cat) => {
            const catReports = filteredReports.filter((r) => r.category === cat.id);
            if (catReports.length === 0) return null;

            return (
              <CategorySection
                key={cat.id}
                cat={cat}
                catReports={catReports}
                openPanel={openPanel}
                resetKey={search}
              />
            );
          })
        )}
      </div>
    </div>
  );
};
