import React, { useState, useEffect } from 'react';
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
  Printer,
  FileSpreadsheet,
  type LucideIcon,
  RefreshCcw,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PaginationControls } from '@/components/shared/PaginationControls';
import { SmartPageHero } from '@/components/shared/SmartPageHero';
import { StatCard } from '@/components/shared/StatCard';
import { FinancialReportPrintPreview } from '@/components/printing/templates/FinancialReportTemplate';
import { DbService } from '@/services/mockDb';
import { PageLayout } from '@/components/shared/PageLayout';
import { StatsCardRow } from '@/components/shared/StatsCardRow';
import { DS } from '@/constants/designSystem';
import { formatCurrencyJOD, formatNumber } from '@/utils/format';
import type { useReports } from '@/hooks/useReports';
import type { ReportDefinition, ReportCategory } from '@/types';

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
    <div className="app-card overflow-hidden group">
      <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center gap-4 bg-slate-50/50 dark:bg-slate-900/50 relative overflow-hidden">
        <div className="absolute inset-x-0 bottom-0 h-[2px] bg-indigo-500/20 group-hover:bg-indigo-500 transition-colors" />
        <div className={`p-3 rounded-2xl text-white shadow-lg ${cat.color} group-hover:scale-110 transition-transform`}>
          <cat.icon size={24} />
        </div>
        <div className="flex flex-wrap items-center justify-between w-full gap-4">
          <div>
            <h3 className="font-black text-xl text-slate-800 dark:text-white">{cat.label}</h3>
            <span className="text-xs font-black text-slate-400 uppercase tracking-widest mt-1 block">
              {formatNumber(catReports.length)} تقرير مخصص
            </span>
          </div>
          <PaginationControls page={page} pageCount={pageCount} onPageChange={setPage} />
        </div>
      </div>

      <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {visible.map((rep) => (
          <button
            key={rep.id}
            onClick={() => openPanel('REPORT_VIEWER', rep.id)}
            className="flex items-start gap-4 p-5 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all text-right group relative border border-transparent hover:border-indigo-100 dark:hover:border-slate-700 shadow-none hover:shadow-soft"
          >
            <div className="mt-1 p-3 bg-slate-100 dark:bg-slate-800 rounded-xl group-hover:bg-white dark:group-hover:bg-slate-700 text-slate-400 dark:text-slate-500 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-all shadow-sm">
              <BarChart3 size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-black text-slate-700 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-1">
                {rep.title}
              </h4>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-2 leading-relaxed line-clamp-2">
                {rep.description}
              </p>
            </div>
            <div className="self-center translate-x-2 group-hover:translate-x-0 opacity-0 group-hover:opacity-100 transition-all duration-300">
              <ArrowRight size={18} className="text-indigo-500" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

interface ReportsPageViewProps {
  page: ReturnType<typeof useReports>;
}

export const ReportsPageView: React.FC<ReportsPageViewProps> = ({ page }) => {
  const {
    isDesktop,
    search,
    setSearch,
    financialPrintOpen,
    setFinancialPrintOpen,
    isExportingAll,
    kpis,
    kpisError,
    openPanel,
    filteredReports,
    financialPrintData,
    handlePrintDashboard,
    handleExportAllToExcel,
  } = page;

  const reportsCount = filteredReports.length;

  return (
    <PageLayout>
      <SmartPageHero
        variant="premium"
        title="مركز التقارير المتقدم"
        description="توليد تقارير تفصيلية عن جميع عمليات النظام مع إمكانية التصدير والطباعة."
        icon={<BarChart3 size={32} />}
        actions={
          <div className="flex flex-wrap items-center gap-4">
             <div className="relative group min-w-[300px] print:hidden">
              <Search
                size={18}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50 group-focus-within:text-white transition-colors"
              />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ابحث عن تقرير مالي أو إداري..."
                className="pr-12 py-3 bg-white/10 border-white/20 text-white placeholder:text-white/40 rounded-2xl outline-none focus:ring-4 focus:ring-white/10 transition-all font-bold shadow-soft backdrop-blur-md"
              />
            </div>
            <Button
              variant="secondary"
              className="bg-white/10 border-white/20 text-white font-black px-6 py-3 rounded-2xl shadow-soft hover:bg-white/20 transition-all active:scale-95 print:hidden backdrop-blur-md"
              onClick={handlePrintDashboard}
              leftIcon={<Printer size={20} />}
            >
              طباعة
            </Button>
          </div>
        }
      />

      <StatsCardRow>
        <StatCard
          label="المحصّل"
          value={formatCurrencyJOD(kpis?.totalPaid ?? 0, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          icon={Wallet}
          color="emerald"
        />
        <StatCard
          label="المتأخر"
          value={formatCurrencyJOD(kpis?.totalLate ?? 0, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          icon={AlertCircle}
          color="rose"
        />
        <StatCard
          label="العقود النشطة"
          value={kpis?.activeContracts ?? 0}
          icon={FileText}
          color="indigo"
        />
        <StatCard
          label="عدد التقارير"
          value={reportsCount}
          icon={BarChart3}
          color="slate"
        />
      </StatsCardRow>

      <Card className="p-0 border-none shadow-soft overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div>
            <h3 className="font-black text-xl text-slate-800 dark:text-white flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center text-white">
                 <RefreshCcw size={16} />
              </div>
              ملخص سريع للبيانات الحقيقية
            </h3>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1">
              إحصائيات مباشرة من محرك التقارير المركزي
            </p>
          </div>
          <div className="flex items-center gap-3">
            {isDesktop && financialPrintData && !kpisError && (
              <Button
                variant="secondary"
                className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/50 text-indigo-600 dark:text-indigo-400 font-black px-6 py-3 rounded-2xl shadow-soft hover:bg-white dark:hover:bg-slate-800 transition-all"
                onClick={() => setFinancialPrintOpen(true)}
                leftIcon={<Printer size={18} />}
              >
                تصدير تقرير مالي
              </Button>
            )}
            <Button
              variant="primary"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-6 py-3 rounded-2xl shadow-lg shadow-emerald-500/20 transition-all active:scale-95 disabled:opacity-50"
              onClick={handleExportAllToExcel}
              disabled={isExportingAll || reportsCount === 0}
              leftIcon={<FileSpreadsheet size={18} />}
            >
              تصدير شامل (Excel)
            </Button>
          </div>
        </div>

        {kpisError && (
          <div className="p-6 bg-red-50 dark:bg-red-900/10 border-b border-red-100 dark:border-red-900/30">
            <div className="flex items-center gap-3 text-red-600 dark:text-red-400 text-sm font-bold">
              <AlertCircle size={20} />
              {kpisError}
            </div>
          </div>
        )}

        <div className="p-6 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 bg-white dark:bg-slate-950">
          {[
            { label: 'المتأخر (متبقي)', value: kpis?.totalLate ?? 0, sub: `${formatNumber(kpis?.lateCount ?? 0)} كمبيالة`, color: 'text-rose-600', isCurrency: true },
            { label: 'المحصّل', value: kpis?.totalPaid ?? 0, color: 'text-emerald-600', isCurrency: true },
            { label: 'القادم', value: kpis?.totalUpcoming ?? 0, color: 'text-blue-600', isCurrency: true },
            { label: 'المتبقي', value: kpis?.remaining ?? 0, color: 'text-indigo-600', isCurrency: true },
            { label: 'إجمالي المتوقع', value: kpis?.totalExpected ?? 0, color: 'text-slate-800 dark:text-white', isCurrency: true },
            { label: 'العقود النشطة', value: kpis?.activeContracts ?? 0, color: 'text-slate-800 dark:text-white' },
            { label: 'تذاكر الصيانة', value: kpis?.openTickets ?? 0, color: 'text-slate-800 dark:text-white' },
            { label: 'عدد التقارير', value: reportsCount, color: 'text-slate-400' },
          ].map((kpi, idx) => (
            <div key={idx} className="group p-4 rounded-2xl border border-slate-50 dark:border-slate-900 bg-slate-50/20 dark:bg-slate-900/10 hover:bg-white dark:hover:bg-slate-900 hover:border-indigo-100 dark:hover:border-slate-800 transition-all">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{kpi.label}</div>
              <div className={`text-lg font-black ${kpi.color}`}>
                {kpi.isCurrency ? formatCurrencyJOD(kpi.value, { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : formatNumber(kpi.value)}
              </div>
              {kpi.sub && <div className="text-[10px] font-bold text-slate-400 mt-1">{kpi.sub}</div>}
            </div>
          ))}
        </div>
      </Card>

      <div className="space-y-8">
        {reportsCount === 0 ? (
          <div className="app-card p-12 text-center bg-slate-50/50 dark:bg-slate-900/20 border-slate-100 dark:border-slate-800">
             <Search size={48} className="mx-auto mb-4 text-slate-300 opacity-50" />
            <div className="text-xl font-black text-slate-800 dark:text-white">
              لا توجد تقارير مطابقة.
            </div>
            <div className="text-sm font-bold text-slate-400 mt-2">
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

      {isDesktop && financialPrintOpen && financialPrintData && (
        <FinancialReportPrintPreview
          open
          onClose={() => setFinancialPrintOpen(false)}
          title="تقرير مالي سريع"
          settings={DbService.getSettings()}
          data={financialPrintData}
          documentType="financial_report_summary"
          entityId="reports_kpis"
          defaultFileName={`تقرير_مالي_${new Date().toISOString().slice(0, 10)}`}
        />
      )}
    </PageLayout>
  );
};
