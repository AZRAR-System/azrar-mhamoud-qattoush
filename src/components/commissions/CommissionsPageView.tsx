import type { FC, ReactNode } from 'react';
import { CommissionsSmartFilterBar } from '@/components/commissions/CommissionsSmartFilterBar';
import { CommissionsContractCommissionCard } from '@/components/commissions/CommissionsContractCommissionCard';
import {
  HandCoins,
  Globe,
  Users,
  Plus,
  ArrowUp,
  Briefcase,
  Inbox,
  Pencil,
  Tags,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { AppModal } from '@/components/ui/AppModal';
import { Input } from '@/components/ui/Input';
import { MoneyInput } from '@/components/ui/MoneyInput';
import { DynamicSelect } from '@/components/ui/DynamicSelect';
import { SmartPageHero } from '@/components/shared/SmartPageHero';
import { StatCard } from '@/components/shared/StatCard';
import { formatCurrencyJOD } from '@/utils/format';
import { formatContractNumberShort } from '@/utils/contractNumber';
import type { useCommissions } from '@/hooks/useCommissions';

import { PageLayout } from '@/components/shared/PageLayout';
import { StatsCardRow } from '@/components/shared/StatsCardRow';
import { DS } from '@/constants/designSystem';
import { cn } from '@/utils/cn';

function CommissionsSectionShell(props: {
  title: string;
  subtitle?: string;
  kicker?: string;
  accent?: 'emerald' | 'indigo' | 'amber' | 'slate' | 'violet';
  headerRight?: ReactNode;
  children: ReactNode;
  bodyClassName?: string;
  className?: string;
}) {
  const { title, subtitle, kicker, accent = 'slate', headerRight, children, bodyClassName, className } = props;
  const bar =
    accent === 'emerald'
      ? 'from-emerald-500 to-teal-600'
      : accent === 'indigo'
        ? 'from-indigo-500 to-violet-600'
        : accent === 'amber'
          ? 'from-amber-500 to-orange-600'
          : accent === 'violet'
            ? 'from-violet-500 to-indigo-600'
            : 'from-slate-400 to-slate-600';
  return (
    <section
      className={cn(
        'overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm dark:border-slate-700/80 dark:bg-slate-900/50',
        className
      )}
    >
      <header className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/60 px-4 py-4 sm:flex-row sm:items-start sm:justify-between dark:border-slate-800 dark:bg-slate-900/70">
        <div className="flex min-w-0 gap-3">
          <div className={cn('w-1 shrink-0 self-stretch rounded-full bg-gradient-to-b', bar)} aria-hidden />
          <div className="min-w-0">
            {kicker ? (
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {kicker}
              </p>
            ) : null}
            <h2 className="text-base font-black text-slate-900 dark:text-white">{title}</h2>
            {subtitle ? (
              <p className="mt-1 text-xs font-medium leading-relaxed text-slate-600 dark:text-slate-400">{subtitle}</p>
            ) : null}
          </div>
        </div>
        {headerRight ? <div className="shrink-0">{headerRight}</div> : null}
      </header>
      <div className={cn('p-4 sm:p-5', bodyClassName)}>{children}</div>
    </section>
  );
}

interface CommissionsPageViewProps {
  page: ReturnType<typeof useCommissions>;
}

const inputClass =
  'w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-white rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-indigo-500 transition text-sm';

const asString = (v: unknown): string => String(v ?? '');

export const CommissionsPageView: FC<CommissionsPageViewProps> = ({ page }) => {
  const {
    activeTab,
    setActiveTab,
    employeePage,
    setEmployeePage,
    contractsPage,
    setContractsPage,
    externalPage,
    setExternalPage,
    commissionsForSelectedMonth,
    filteredCommissions,
    filteredRenewalCommissions,
    commissionsRenewalForSelectedMonth,
    renewalTotalOwner,
    renewalTotalTenant,
    renewalGrandTotal,
    getRenewalParentContractId,
    filteredExternal,
    filteredEmployeeRows,
    visibleEmployeeRows,
    visibleContractCommissions,
    visibleExternal,
    employeePageCount,
    contractsPageCount,
    externalPageCount,
    totalOwner,
    totalTenant,
    grandTotalContracts,
    totalExternal,
    employeeTotals,
    employeeMonthSummary,
    selectedMonth,
    setSelectedMonth,
    searchTerm,
    setSearchTerm,
    contractSearchTerm,
    setContractSearchTerm,
    filterType,
    setFilterType,
    systemUsers,
    employeeUserFilter,
    setEmployeeUserFilter,
    isExternalModalOpen,
    externalModalMode,
    newExtComm,
    setNewExtComm,
    isContractModalOpen,
    editingContractComm,
    setEditingContractComm,
    contractEmployeeBreakdown,
    handleAddExternal,
    handleDeleteExternal,
    openAddExternalModal,
    openEditExternalModal,
    closeExternalModal,
    openEditContractModal,
    closeContractModal,
    handleSaveContractEdit,
    handleDeleteContractCommission,
    handlePostponeCommissionCollection,
    handleExportEmployeeCsv,
    handleExportEmployeeXlsx,
    handleExportContractCommissionsXlsx,
    getPropCode,
    getNames,
    availableTypes,
    user,
  } = page;

  return (
    <PageLayout containWidth className="space-y-6 pb-10 sm:space-y-8 sm:pb-12">
      <SmartPageHero
        variant="premium"
        icon={<HandCoins size={32} />}
        title="العمولات والإيرادات"
        description="واجهة موحّدة لمراجعة عمولات العقود (إيجار وبيع)، عمولات التجديد، الدخل الخارجي، وتوزيع عمولات الموظفين حسب الشهر المحاسبي والسياسات المعتمدة."
      />

      <CommissionsSmartFilterBar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        selectedMonth={selectedMonth}
        setSelectedMonth={setSelectedMonth}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        contractSearchTerm={contractSearchTerm}
        setContractSearchTerm={setContractSearchTerm}
        filterType={filterType}
        setFilterType={setFilterType}
        employeeUserFilter={employeeUserFilter}
        setEmployeeUserFilter={setEmployeeUserFilter}
        systemUsers={systemUsers}
        availableTypes={availableTypes}
        onRefresh={() => page.loadData()}
        onExportEmployeeXlsx={handleExportEmployeeXlsx}
        onExportEmployeeCsv={handleExportEmployeeCsv}
        onExportContractCommissionsXlsx={handleExportContractCommissionsXlsx}
        totalResults={
          activeTab === 'contracts' ? filteredCommissions.length :
          activeTab === 'external' ? filteredExternal.length :
          filteredEmployeeRows.length
        }
        currentPage={
          activeTab === 'contracts' ? contractsPage :
          activeTab === 'external' ? externalPage :
          employeePage
        }
        totalPages={
          activeTab === 'contracts' ? contractsPageCount :
          activeTab === 'external' ? externalPageCount :
          employeePageCount
        }
        onPageChange={
          activeTab === 'contracts' ? setContractsPage :
          activeTab === 'external' ? setExternalPage :
          setEmployeePage
        }
      />

      <div className="rounded-2xl border border-slate-200/80 bg-slate-50/40 px-4 py-3 text-center dark:border-slate-700/60 dark:bg-slate-900/40 sm:text-start">
        <p className="text-[11px] font-bold leading-relaxed text-slate-600 dark:text-slate-400">
          <span className="text-slate-500 dark:text-slate-500">الشهر المحاسبي النشط:</span>{' '}
          <span className="font-mono font-black text-indigo-700 dark:text-indigo-300" dir="ltr">
            {selectedMonth}
          </span>
          <span className="mx-2 text-slate-300 dark:text-slate-600">|</span>
          <span className="text-slate-500 dark:text-slate-500">
            المؤشرات التالية تلخّص أرقاماً من كل التبويبات لمساعدتك على المقارنة السريعة قبل الدخول في التفاصيل.
          </span>
        </p>
      </div>

      <CommissionsSectionShell
        kicker="مؤشرات موجزة"
        title="لوحة مقارنة سريعة"
        subtitle="إجماليات مستقلة عن التبويب الحالي — تُحدَّث مع الشهر والبيانات المحمّلة."
        accent="slate"
        bodyClassName="!p-3 sm:!p-4"
      >
        <StatsCardRow>
          <StatCard
            label="عمولات العقود (الشهر)"
            value={formatCurrencyJOD(grandTotalContracts)}
            icon={HandCoins}
            color="emerald"
          />
          <StatCard
            label="عمولات خارجية (الشهر)"
            value={formatCurrencyJOD(totalExternal)}
            icon={Globe}
            color="blue"
          />
          <StatCard
            label="عمولات الموظفين (المفلترة)"
            value={formatCurrencyJOD(employeeTotals.totalEmployee)}
            icon={Users}
            color="indigo"
          />
          <StatCard
            label="عمليات الموظفين (المفلترة)"
            value={employeeTotals.count}
            icon={ArrowUp}
            color="amber"
          />
        </StatsCardRow>
      </CommissionsSectionShell>

      <div className="space-y-8">
      {activeTab === 'employee' && (
        <div
          className="animate-slide-up space-y-8"
          role="tabpanel"
          id="comm-panel-employee"
          aria-labelledby="comm-tab-employee"
        >
          <CommissionsSectionShell
            kicker="مؤشرات الموظفين"
            title="ملخص العمليات والعمولات (المفلترة)"
            subtitle={`أرقام تبويب الموظفين بعد تطبيق الشهر ${selectedMonth} وفلتر الموظف والبحث. العمولة «للموظف» تشمل قاعدة العملية وإدخال العقار عند وجوده.`}
            accent="indigo"
            bodyClassName="!p-3 sm:!p-4"
          >
            <StatsCardRow>
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-800 p-6 text-white shadow-xl shadow-indigo-600/25 ring-1 ring-white/10">
                <div className="relative z-10">
                  <p className="mb-1 flex items-center gap-2 font-black text-indigo-100">
                    <Users size={16} aria-hidden /> عدد العمليات
                  </p>
                  <h3 className="text-3xl font-black tabular-nums">
                    {employeeTotals.count.toLocaleString()}{' '}
                    <span className="text-lg font-medium opacity-80">عملية</span>
                  </h3>
                </div>
                <HandCoins className="absolute -bottom-6 -left-6 h-36 w-36 text-white opacity-10" aria-hidden />
              </div>

              <div className={DS.components.card + ' p-6'}>
                <p className="mb-2 text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  إجمالي عمولة الموظفين
                </p>
                <h3 className="text-2xl font-black tabular-nums text-slate-900 dark:text-white">
                  {formatCurrencyJOD(employeeTotals.totalEmployee)}
                </h3>
                <div className="mt-2 flex items-center gap-1 text-[10px] font-black text-slate-400 dark:text-slate-500">
                  <div className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                  يشمل إدخال العقار (إن وجد)
                </div>
              </div>

              <div className={DS.components.card + ' p-6'}>
                <p className="mb-2 text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  إجمالي عمولات العمليات (المكتب)
                </p>
                <h3 className="text-2xl font-black tabular-nums text-slate-900 dark:text-white">
                  {formatCurrencyJOD(employeeTotals.totalOffice)}
                </h3>
                <div className="mt-2 flex items-center gap-1 text-[10px] font-black text-slate-400 dark:text-slate-500">
                  <div className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                  إدخال العقار: {formatCurrencyJOD(employeeTotals.totalIntro)}
                </div>
              </div>
            </StatsCardRow>
          </CommissionsSectionShell>

          <CommissionsSectionShell
            kicker="تفكيك الشهر"
            title={`ملخص أرباح الشهر — ${selectedMonth}`}
            subtitle="فصل بين إيجار وبيع قبل إدخال العقار، ثم إدخال العقار، الدخل الخارجي المرتبط بالموظف، والإجمالي الشامل."
            accent="amber"
            headerRight={
              <p className="text-end text-xs font-bold text-slate-600 dark:text-slate-400">
                المستخدم:{' '}
                <b className="font-mono text-slate-900 dark:text-white" dir="ltr">
                  {String(user?.اسم_المستخدم || '—')}
                </b>
              </p>
            }
            bodyClassName="!p-3 sm:!p-4"
          >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
              <div className="bg-gray-50 dark:bg-slate-900 rounded-xl p-3">
                <div className="text-xs text-slate-500 dark:text-slate-400 font-bold">
                  إيجار (قبل الإدخال)
                </div>
                <div className="text-lg font-bold text-slate-800 dark:text-white">
                  {formatCurrencyJOD(employeeMonthSummary.rentBase)}
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-slate-900 rounded-xl p-3">
                <div className="text-xs text-slate-500 dark:text-slate-400 font-bold">
                  بيع (قبل الإدخال)
                </div>
                <div className="text-lg font-bold text-slate-800 dark:text-white">
                  {formatCurrencyJOD(employeeMonthSummary.saleBase)}
                </div>
              </div>
              <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl p-3">
                <div className="text-xs text-orange-700 dark:text-orange-300 font-bold">
                  إدخال عقار
                </div>
                <div className="text-lg font-bold text-orange-700 dark:text-orange-300">
                  {formatCurrencyJOD(employeeMonthSummary.intro)}
                </div>
              </div>
              <div className="bg-sky-50 dark:bg-sky-900/20 rounded-xl p-3">
                <div className="text-xs text-sky-700 dark:text-sky-300 font-bold">دخل خارجي</div>
                <div className="text-lg font-bold text-sky-700 dark:text-sky-300">
                  {formatCurrencyJOD(employeeMonthSummary.external)}
                </div>
              </div>
              <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-3">
                <div className="text-xs text-emerald-700 dark:text-emerald-300 font-bold">
                  الإجمالي (شامل الدخل الخارجي)
                </div>
                <div className="text-lg font-bold text-emerald-700 dark:text-emerald-300">
                  {formatCurrencyJOD(employeeMonthSummary.totalWithExternal)}
                </div>
              </div>
            </div>
          </CommissionsSectionShell>

          <CommissionsSectionShell
            kicker="السجل التفصيلي"
            title="عمليات عمولة الموظفين"
            subtitle={`كل سطر يمثل عملية واحدة بعد التصفية. الشهر ${selectedMonth}.`}
            accent="violet"
            bodyClassName="!p-3 sm:!p-4"
          >
            <div className="space-y-3">
              {filteredEmployeeRows.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-6 py-14 text-center dark:border-slate-700 dark:bg-slate-900/40">
                  <Users className="h-12 w-12 text-slate-300 dark:text-slate-600" strokeWidth={1.25} aria-hidden />
                  <p className="max-w-sm text-sm font-bold text-slate-600 dark:text-slate-300">
                    لا توجد عمليات ضمن الفلاتر الحالية
                  </p>
                  <p className="max-w-md text-xs text-slate-500 dark:text-slate-400">
                    جرّب تغيير الشهر، أو تصفية الموظف، أو توسيع نطاق البحث.
                  </p>
                </div>
              ) : (
                visibleEmployeeRows.map((r, idx) => (
                  <div key={`${String(r.reference || '')}-${idx}`} className="app-card p-4">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`font-bold ${String(r.type) === 'بيع' ? 'text-purple-600 dark:text-purple-300' : 'text-emerald-600 dark:text-emerald-300'}`}
                          >
                            {String(r.type || '')}
                          </span>
                          <span className="text-slate-500 dark:text-slate-400 text-sm">
                            | التاريخ:{' '}
                            <b className="text-slate-700 dark:text-slate-200">
                              {String(r.date || '')}
                            </b>
                          </span>
                          <span className="text-slate-500 dark:text-slate-400 text-sm">
                            | العقار:{' '}
                            <b className="text-slate-700 dark:text-slate-200">
                              {String(r.property || '—')}
                            </b>
                          </span>
                        </div>

                        <div className="text-sm text-slate-600 dark:text-slate-400">
                          المرجع:{' '}
                          <b className="text-slate-700 dark:text-slate-200" dir="ltr">
                            {String(r.reference || '—')}
                          </b>
                          <span className="text-slate-500 dark:text-slate-400">
                            {' '}
                            — الشريحة:{' '}
                            <b className="text-slate-700 dark:text-slate-200">
                              {String(r.tier || '—')}
                            </b>
                          </span>
                        </div>

                        <div className="text-sm text-slate-600 dark:text-slate-400">
                          رقم الفرصة:{' '}
                          <b className="text-slate-900 dark:text-white" dir="ltr">
                            {String(r.opportunity || '—')}
                          </b>
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-bold border-t border-slate-100 dark:border-slate-800 pt-2">
                          <div className="flex items-center gap-1.5">
                            <Briefcase size={14} className="text-indigo-500" />
                            <span className="text-slate-500 dark:text-slate-400">المالك/البائع:</span>
                            <span className="text-indigo-600 dark:text-indigo-400">{String(r.ownerName || '—')}</span>
                          </div>
                          <div className="flex items-center gap-1.5 border-r border-slate-200 dark:border-slate-700 pr-4">
                            <Users size={14} className="text-emerald-500" />
                            <span className="text-slate-500 dark:text-slate-400">المستأجر/المشتري:</span>
                            <span className="text-emerald-600 dark:text-emerald-400">{String(r.client || '—')}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 justify-end">
                        <div className="px-3 py-2 rounded-xl bg-gray-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-sm">
                          عمولة العملية: {formatCurrencyJOD(Number(r.officeCommission || 0))}
                        </div>
                        <div className="px-3 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 font-bold text-sm">
                          قبل الإدخال: {formatCurrencyJOD(Number(r.employeeBase || 0))}
                        </div>
                        <div className="px-3 py-2 rounded-xl bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 font-bold text-sm">
                          إدخال عقار: {formatCurrencyJOD(Number(r.intro || 0))}
                        </div>
                        <div className="px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 font-bold text-sm">
                          الإجمالي: {formatCurrencyJOD(Number(r.employeeTotal || 0))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CommissionsSectionShell>
        </div>
      )}

      {/* View 1: Contract Commissions */}
      {activeTab === 'contracts' && (
        <div
          className="animate-slide-up space-y-8"
          role="tabpanel"
          id="comm-panel-contracts"
          aria-labelledby="comm-tab-contracts"
        >
          <CommissionsSectionShell
            kicker="تحليل توزيع"
            title="عمولات العقود — تفكيك حسب مصدر التحصيل"
            subtitle={`الشهر ${selectedMonth}. النسب المعروضة نسبية إلى إجمالي عمولات العقود للشهر (مجموع طرفي المالك/المستأجر أو البائع/المشتري حسب نوع العمولة).`}
            accent="emerald"
            bodyClassName="!p-3 sm:!p-4"
          >
            <StatsCardRow>
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-800 p-6 text-white shadow-xl shadow-emerald-500/25 ring-1 ring-white/10">
                <div className="relative z-10">
                  <p className="mb-1 flex items-center gap-2 font-black text-emerald-100">
                    <ArrowUp size={16} aria-hidden /> إجمالي العمولات
                  </p>
                  <h3 className="text-3xl font-black tracking-tight tabular-nums">{formatCurrencyJOD(grandTotalContracts)}</h3>
                  <p className="mt-2 text-[10px] font-black uppercase text-emerald-100/70">مجموع المالك + المستأجر (أو البيع) للشهر</p>
                </div>
                <Briefcase className="absolute -bottom-6 -left-6 h-36 w-36 text-white opacity-10" aria-hidden />
              </div>

              <div className={DS.components.card + ' p-6'}>
                <p className="mb-2 flex items-center justify-between text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  من الملاك / البائع
                  <span className="text-[10px] font-black text-indigo-500">
                    {grandTotalContracts > 0 ? ((totalOwner / grandTotalContracts) * 100).toFixed(0) : 0}%
                  </span>
                </p>
                <h3 className="text-2xl font-black tabular-nums text-slate-900 dark:text-white">{formatCurrencyJOD(totalOwner)}</h3>
                <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-full bg-indigo-500 transition-all duration-500"
                    style={{
                      width: `${grandTotalContracts > 0 ? (totalOwner / grandTotalContracts) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>

              <div className={DS.components.card + ' p-6'}>
                <p className="mb-2 flex items-center justify-between text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  من المستأجرين / المشترين
                  <span className="text-[10px] font-black text-purple-500">
                    {grandTotalContracts > 0 ? ((totalTenant / grandTotalContracts) * 100).toFixed(0) : 0}%
                  </span>
                </p>
                <h3 className="text-2xl font-black tabular-nums text-slate-900 dark:text-white">{formatCurrencyJOD(totalTenant)}</h3>
                <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-full bg-purple-500 transition-all duration-500"
                    style={{
                      width: `${grandTotalContracts > 0 ? (totalTenant / grandTotalContracts) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            </StatsCardRow>
          </CommissionsSectionShell>

          <CommissionsSectionShell
            kicker="إيجار مرتبط بعقد سابق"
            title="عمولات عقود التجديد"
            subtitle={`إيجار فقط — عقود لها عقد سابق (تجديد). الشهر ${selectedMonth}${
              contractSearchTerm.trim() ? ' — يُطبَّق عليها نفس بحث العقود في شريط التصفية' : ''
            }`}
            accent="indigo"
            headerRight={
              <div className="flex flex-wrap gap-2 text-xs font-bold">
                <span className="rounded-lg border border-indigo-200/80 bg-indigo-50 px-2.5 py-1.5 text-indigo-900 dark:border-indigo-800/60 dark:bg-indigo-950/50 dark:text-indigo-100">
                  {commissionsRenewalForSelectedMonth.length} عملية
                </span>
                <span className="rounded-lg border border-slate-200/80 bg-slate-50 px-2.5 py-1.5 text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
                  إجمالي: {formatCurrencyJOD(renewalGrandTotal)}
                </span>
              </div>
            }
            bodyClassName="!p-3 sm:!p-4"
          >
            {commissionsForSelectedMonth.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                لا عمولات لهذا الشهر — لن تظهر عمولات التجديد حتى تُسجَّل عمولات للشهر.
              </p>
            ) : commissionsRenewalForSelectedMonth.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                لا توجد عمولات لعقود تجديد في هذا الشهر (لا عقود إيجار مرتبطة بعقد سابق ضمن العمولات المعروضة).
              </p>
            ) : filteredRenewalCommissions.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <Inbox className="h-9 w-9 text-slate-300 dark:text-slate-600" strokeWidth={1.25} aria-hidden />
                <p className="text-sm font-bold text-slate-600 dark:text-slate-300">لا نتائج تطابق البحث ضمن عمولات التجديد</p>
                <Button type="button" variant="outline" size="sm" onClick={() => setContractSearchTerm('')}>
                  مسح البحث
                </Button>
              </div>
            ) : (
              <div className="max-h-[min(28rem,70vh)] space-y-3 overflow-y-auto pe-1">
                {filteredRenewalCommissions.map((c) => (
                  <CommissionsContractCommissionCard
                    key={c.رقم_العمولة}
                    c={c}
                    variant="renewal"
                    parentContractId={getRenewalParentContractId(c) ?? undefined}
                    getPropCode={getPropCode}
                    getNames={getNames}
                    onEdit={() => openEditContractModal(c)}
                    onPostpone={() => void handlePostponeCommissionCollection(c)}
                    onDelete={() => handleDeleteContractCommission(c)}
                  />
                ))}
              </div>
            )}
            {(renewalTotalOwner > 0 || renewalTotalTenant > 0) && commissionsRenewalForSelectedMonth.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-3 border-t border-slate-100 pt-4 text-xs text-slate-600 dark:border-slate-800 dark:text-slate-400">
                <span>
                  من الملاك (تجديد): <b className="text-slate-900 dark:text-white">{formatCurrencyJOD(renewalTotalOwner)}</b>
                </span>
                <span className="hidden text-slate-300 sm:inline dark:text-slate-600">|</span>
                <span>
                  من المستأجرين (تجديد):{' '}
                  <b className="text-slate-900 dark:text-white">{formatCurrencyJOD(renewalTotalTenant)}</b>
                </span>
              </div>
            ) : null}
          </CommissionsSectionShell>

          <CommissionsSectionShell
            kicker="السجل الكامل"
            title="جميع عمولات العقود للشهر"
            subtitle={`قائمة مرقّمة بجميع عمليات الشهر ${selectedMonth} بعد تطبيق نوع العمولة والبحث في شريط التصفية.`}
            accent="slate"
            bodyClassName="!p-3 sm:!p-4"
          >
            {commissionsForSelectedMonth.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-6 py-14 text-center dark:border-slate-700 dark:bg-slate-900/40">
                <Briefcase className="h-12 w-12 text-slate-300 dark:text-slate-600" strokeWidth={1.25} aria-hidden />
                <p className="max-w-sm text-sm font-bold text-slate-600 dark:text-slate-300">لا توجد عمولات مسجلة لهذا الشهر</p>
                <p className="max-w-md text-xs text-slate-500 dark:text-slate-400">
                  عند اعتماد عمولة من أدوات ذكية أو من العقد ستظهر هنا ضمن الشهر المحاسبي المختار.
                </p>
              </div>
            ) : filteredCommissions.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-6 py-12 text-center dark:border-slate-700 dark:bg-slate-900/40">
                <Inbox className="h-10 w-10 text-slate-300 dark:text-slate-600" strokeWidth={1.25} aria-hidden />
                <p className="text-sm font-bold text-slate-600 dark:text-slate-300">لا نتائج تطابق البحث الحالي</p>
                <Button type="button" variant="outline" size="sm" onClick={() => setContractSearchTerm('')}>
                  مسح البحث
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {visibleContractCommissions.map((c) => (
                  <CommissionsContractCommissionCard
                    key={c.رقم_العمولة}
                    c={c}
                    variant="default"
                    getPropCode={getPropCode}
                    getNames={getNames}
                    onEdit={() => openEditContractModal(c)}
                    onPostpone={() => void handlePostponeCommissionCollection(c)}
                    onDelete={() => handleDeleteContractCommission(c)}
                  />
                ))}
              </div>
            )}
          </CommissionsSectionShell>
        </div>
      )}

      {/* View 2: External Commissions */}
      {activeTab === 'external' && (
        <div
          className="animate-slide-up space-y-8"
          role="tabpanel"
          id="comm-panel-external"
          aria-labelledby="comm-tab-external"
        >
          <CommissionsSectionShell
            kicker="مؤشرات الدخل الخارجي"
            title="ملخص العمولات الخارجية (المفلترة)"
            subtitle={`الشهر ${selectedMonth} مع نوع الدخل والبحث من شريط التصفية. المجموع وعدد العمليات يعكسان القائمة المفلترة فقط.`}
            accent="indigo"
            bodyClassName="!p-3 sm:!p-4"
          >
            <StatsCardRow cols={2}>
              <div className="relative flex flex-col justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-800 p-6 text-white shadow-xl shadow-indigo-600/25 ring-1 ring-white/10">
                <div className="relative z-10">
                  <p className="mb-1 flex items-center gap-2 font-black text-indigo-100">
                    <Globe size={16} aria-hidden /> مجموع القيم
                  </p>
                  <h3 className="text-3xl font-black tracking-tight tabular-nums">{formatCurrencyJOD(totalExternal)}</h3>
                </div>
                <Globe className="absolute -bottom-6 -left-6 h-36 w-36 text-white opacity-10" aria-hidden />
              </div>

              <div className={DS.components.card + ' flex flex-col justify-center p-6'}>
                <div className="flex items-center gap-4">
                  <div className="rounded-2xl bg-orange-500/10 p-3.5 text-orange-600 dark:text-orange-400">
                    <Tags size={28} aria-hidden />
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                      عدد العمليات
                    </p>
                    <h3 className="text-2xl font-black tabular-nums text-slate-900 dark:text-white">
                      {filteredExternal.length} عملية
                    </h3>
                  </div>
                </div>
              </div>
            </StatsCardRow>
          </CommissionsSectionShell>

          <CommissionsSectionShell
            kicker="السجل"
            title="سجل العمولات الخارجية"
            subtitle="إدخال يدوي لدخل لا يرتبط مباشرة بعمولة عقد — يُستخدم للتقارير والمقارنة مع عمولات العقود."
            accent="slate"
            headerRight={
              <Button type="button" variant="primary" size="sm" onClick={openAddExternalModal}>
                <Plus size={16} aria-hidden /> إضافة عمولة
              </Button>
            }
            bodyClassName="!p-3 sm:!p-4"
          >
            <div className="space-y-3">
              {filteredExternal.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-6 py-14 text-center dark:border-slate-700 dark:bg-slate-900/40">
                  <Globe className="h-12 w-12 text-slate-300 dark:text-slate-600" strokeWidth={1.25} aria-hidden />
                  <p className="max-w-sm text-sm font-bold text-slate-600 dark:text-slate-300">
                    لا توجد عمولات خارجية تطابق الشهر أو الفلاتر
                  </p>
                  <p className="max-w-md text-xs text-slate-500 dark:text-slate-400">
                    أضف عمولة خارجية جديدة أو غيّر شهر العرض أو نوع الدخل.
                  </p>
                  <Button type="button" variant="primary" size="sm" onClick={openAddExternalModal}>
                    <Plus size={16} aria-hidden /> إضافة عمولة
                  </Button>
                </div>
              ) : (
                visibleExternal.map((c) => (
                  <div
                    key={c.id}
                    className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm dark:border-slate-700/80 dark:bg-slate-900/50 sm:p-5"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-slate-800 dark:text-white">{c.العنوان}</span>
                          <span className="text-sm text-slate-500 dark:text-slate-400">| {c.النوع}</span>
                        </div>
                        <div className="text-sm text-slate-600 dark:text-slate-400">
                          التاريخ: <b className="text-slate-700 dark:text-slate-200">{c.التاريخ}</b>
                        </div>
                        <div className="text-sm text-slate-600 dark:text-slate-400">
                          ملاحظات: <span className="text-slate-700 dark:text-slate-200">{c.ملاحظات || '-'}</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <div className="rounded-xl bg-indigo-50 px-3 py-2 text-sm font-bold text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300">
                          {formatCurrencyJOD(Number(c.القيمة || 0))}
                        </div>
                        <button
                          type="button"
                          onClick={() => openEditExternalModal(c)}
                          className="flex items-center gap-2 rounded-xl bg-gray-100 px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-gray-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                        >
                          <Pencil size={16} aria-hidden /> تعديل
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteExternal(c.id)}
                          className="flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-red-600 transition hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30"
                        >
                          <Trash2 size={16} aria-hidden /> حذف
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CommissionsSectionShell>

          {/* External Modal (Add/Edit) */}
          {isExternalModalOpen && (
            <AppModal
              open={isExternalModalOpen}
              title={
                externalModalMode === 'add' ? (
                  <>
                    <Plus size={20} /> إضافة عمولة خارجية
                  </>
                ) : (
                  <>
                    <Pencil size={20} /> تعديل عمولة خارجية
                  </>
                )
              }
              onClose={closeExternalModal}
              size="lg"
              footer={
                <div className="flex gap-3">
                  <button
                    type="submit"
                    form="external-commission-form"
                    className="flex-1 bg-indigo-600 text-white py-2.5 rounded-lg hover:bg-indigo-700 font-bold transition"
                  >
                    {externalModalMode === 'add' ? 'حفظ' : 'حفظ التعديل'}
                  </button>
                  <button
                    type="button"
                    onClick={closeExternalModal}
                    className="flex-1 bg-gray-200 dark:bg-slate-700 text-slate-800 dark:text-white py-2.5 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-600 font-bold transition"
                  >
                    إلغاء
                  </button>
                </div>
              }
            >
              <form
                id="external-commission-form"
                onSubmit={handleAddExternal}
                className="space-y-4"
              >
                <Input
                  type="date"
                  className={inputClass}
                  value={newExtComm.التاريخ || ''}
                  onChange={(e) => setNewExtComm({ ...newExtComm, التاريخ: e.target.value })}
                />
                <input
                  type="text"
                  placeholder="العنوان"
                  className={inputClass}
                  value={newExtComm.العنوان || ''}
                  onChange={(e) => setNewExtComm({ ...newExtComm, العنوان: e.target.value })}
                />
                <DynamicSelect
                  label="نوع الدخل الخارجي"
                  category="ext_comm_type"
                  value={newExtComm.النوع || ''}
                  onChange={(val) => setNewExtComm((prev) => ({ ...prev, النوع: val }))}
                  placeholder="اختر نوع الدخل..."
                  required
                />
                <MoneyInput
                  placeholder="القيمة"
                  className={inputClass}
                  value={typeof newExtComm.القيمة === 'number' ? newExtComm.القيمة : undefined}
                  onValueChange={(v) => setNewExtComm({ ...newExtComm, القيمة: v })}
                />
                <textarea
                  placeholder="ملاحظات (اختياري)"
                  className={`${inputClass} resize-none`}
                  rows={3}
                  value={newExtComm.ملاحظات || ''}
                  onChange={(e) => setNewExtComm({ ...newExtComm, ملاحظات: e.target.value })}
                />
              </form>
            </AppModal>
          )}
        </div>
      )}

      {/* Contract Commission Modal (Edit) */}
      {isContractModalOpen && editingContractComm && (
        <AppModal
          open={isContractModalOpen}
          title={
            <>
              <Pencil size={20} /> تعديل عمولة العقد
            </>
          }
          onClose={closeContractModal}
          size="lg"
          footer={
            <div className="flex gap-3">
              <button
                type="submit"
                form="contract-commission-form"
                className="flex-1 bg-indigo-600 text-white py-2.5 rounded-lg hover:bg-indigo-700 font-bold transition"
              >
                حفظ التعديل
              </button>
              <button
                type="button"
                onClick={closeContractModal}
                className="flex-1 bg-gray-200 dark:bg-slate-700 text-slate-800 dark:text-white py-2.5 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-600 font-bold transition"
              >
                إلغاء
              </button>
            </div>
          }
        >
          <form
            id="contract-commission-form"
            onSubmit={handleSaveContractEdit}
            className="space-y-4"
          >
            <div className="text-sm text-slate-600 dark:text-slate-400">
              {editingContractComm.نوع_العمولة === 'Sale' ? 'الاتفاقية' : 'العقد'}:{' '}
              <b className="font-mono text-slate-800 dark:text-white" dir="ltr">
                #{formatContractNumberShort(asString((editingContractComm.نوع_العمولة === 'Sale' ? editingContractComm.رقم_الاتفاقية : editingContractComm.رقم_العقد)))}
              </b>
            </div>
            <Input
              type="date"
              className={inputClass}
              value={asString(editingContractComm.تاريخ_العقد) || ''}
              onChange={(e) =>
                setEditingContractComm({ ...editingContractComm, تاريخ_العقد: e.target.value })
              }
            />

            <select
              className={inputClass}
              value={asString(editingContractComm.اسم_المستخدم) || ''}
              onChange={(e) =>
                setEditingContractComm({ ...editingContractComm, اسم_المستخدم: e.target.value })
              }
              title="الموظف المسؤول عن هذه العمولة"
            >
              <option value="">(بدون تحديد موظف)</option>
              {systemUsers
                .filter((u) => !!u?.isActive)
                .map((u) => {
                  const username = String(u?.اسم_المستخدم || '').trim();
                  const display = String(u?.اسم_للعرض || u?.اسم_المستخدم || '').trim();
                  return (
                    <option key={username} value={username}>
                      {display || username}
                    </option>
                  );
                })}
            </select>

            <input
              type="text"
              placeholder="رقم الفرصة (اختياري)"
              className={inputClass}
              value={asString(editingContractComm.رقم_الفرصة) || ''}
              onChange={(e) =>
                setEditingContractComm({ ...editingContractComm, رقم_الفرصة: e.target.value })
              }
            />

            <label className="flex items-center justify-between gap-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2">
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                يوجد إدخال عقار
              </span>
              <input
                type="checkbox"
                checked={!!editingContractComm.يوجد_ادخال_عقار}
                onChange={(e) =>
                  setEditingContractComm({
                    ...editingContractComm,
                    يوجد_ادخال_عقار: e.target.checked,
                  })
                }
              />
            </label>

            <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl p-3">
              <div className="text-xs text-orange-700 dark:text-orange-300 font-bold">
                عمولة إدخال عقار (5%) — محسوبة تلقائياً
              </div>
              <div className="text-lg font-bold text-orange-700 dark:text-orange-300 mt-1">
                {formatCurrencyJOD(contractEmployeeBreakdown?.introEarned || 0)}
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-300 mt-1" dir="rtl">
                المعادلة: {formatCurrencyJOD(contractEmployeeBreakdown?.officeTotal || 0)} × 5% ={' '}
                {formatCurrencyJOD(contractEmployeeBreakdown?.introEarned || 0)}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                الشريحة (حسب إجمالي الإيجار لهذا الشهر):{' '}
                {String(contractEmployeeBreakdown?.tierId || '—')} — قبل الإدخال:{' '}
                {formatCurrencyJOD(contractEmployeeBreakdown?.baseEarned || 0)} — الإجمالي:{' '}
                {formatCurrencyJOD(contractEmployeeBreakdown?.finalEarned || 0)}
              </div>
            </div>
            <MoneyInput
              placeholder={editingContractComm.نوع_العمولة === 'Sale' ? "عمولة البائع" : "عمولة المالك"}
              className={inputClass}
              value={
                editingContractComm.نوع_العمولة === 'Sale'
                  ? (typeof editingContractComm.عمولة_البائع === 'number' ? editingContractComm.عمولة_البائع : Number(editingContractComm.عمولة_البائع ?? 0))
                  : (typeof editingContractComm.عمولة_المالك === 'number' ? editingContractComm.عمولة_المالك : Number(editingContractComm.عمولة_المالك ?? 0))
              }
              onValueChange={(v) =>
                setEditingContractComm({ 
                  ...editingContractComm, 
                  ...(editingContractComm.نوع_العمولة === 'Sale' ? { عمولة_البائع: v ?? 0 } : { عمولة_المالك: v ?? 0 })
                })
              }
            />
            <MoneyInput
              placeholder={editingContractComm.نوع_العمولة === 'Sale' ? "عمولة المشتري" : "عمولة المستأجر"}
              className={inputClass}
              value={
                editingContractComm.نوع_العمولة === 'Sale'
                  ? (typeof editingContractComm.عمولة_المشتري === 'number' ? editingContractComm.عمولة_المشتري : Number(editingContractComm.عمولة_المشتري ?? 0))
                  : (typeof editingContractComm.عمولة_المستأجر === 'number' ? editingContractComm.عمولة_المستأجر : Number(editingContractComm.عمولة_المستأجر ?? 0))
              }
              onValueChange={(v) =>
                setEditingContractComm({ 
                  ...editingContractComm, 
                  ...(editingContractComm.نوع_العمولة === 'Sale' ? { عمولة_المشتري: v ?? 0 } : { عمولة_المستأجر: v ?? 0 })
                })
              }
            />
          </form>
        </AppModal>
      )}
      </div>
    </PageLayout>
  );
};
