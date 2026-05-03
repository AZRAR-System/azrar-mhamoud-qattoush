import type { FC } from 'react';
import { CommissionsSmartFilterBar } from '@/components/commissions/CommissionsSmartFilterBar';
import { CommissionsSectionShell } from '@/components/commissions/CommissionsSectionShell';
import { CommissionsSharedModals } from '@/components/commissions/CommissionsSharedModals';
import { CommissionsContractsTabPanel } from '@/components/commissions/panels/CommissionsContractsTabPanel';
import { CommissionsEmployeeTabPanel } from '@/components/commissions/panels/CommissionsEmployeeTabPanel';
import { CommissionsExternalTabPanel } from '@/components/commissions/panels/CommissionsExternalTabPanel';
import { HandCoins, Globe, Users, ArrowUp } from 'lucide-react';
import { SmartPageHero } from '@/components/shared/SmartPageHero';
import { StatCard } from '@/components/shared/StatCard';
import { formatCurrencyJOD } from '@/utils/format';
import type { useCommissions } from '@/hooks/useCommissions';
import { PageLayout } from '@/components/shared/PageLayout';
import { StatsCardRow } from '@/components/shared/StatsCardRow';

interface CommissionsPageViewProps {
  page: ReturnType<typeof useCommissions>;
}

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
    filteredCommissions,
    filteredExternal,
    filteredEmployeeRows,
    employeePageCount,
    contractsPageCount,
    externalPageCount,
    grandTotalContracts,
    totalExternal,
    employeeTotals,
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
    availableTypes,
    handleExportEmployeeCsv,
    handleExportEmployeeXlsx,
    handleExportContractCommissionsXlsx,
  } = page;

  return (
    <PageLayout containWidth className="space-y-6 pb-10 sm:space-y-8 sm:pb-12">
      <SmartPageHero
        variant="premium"
        icon={<HandCoins size={32} />}
        title="العمولات والإيرادات"
        description="مراجعة عمولات العقود (إيجار وبيع)، عمولات التجديد، الدخل الخارجي، وعمولات الموظفين حسب الشهر المحاسبي."
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
          activeTab === 'contracts'
            ? filteredCommissions.length
            : activeTab === 'external'
              ? filteredExternal.length
              : filteredEmployeeRows.length
        }
        currentPage={
          activeTab === 'contracts' ? contractsPage : activeTab === 'external' ? externalPage : employeePage
        }
        totalPages={
          activeTab === 'contracts'
            ? contractsPageCount
            : activeTab === 'external'
              ? externalPageCount
              : employeePageCount
        }
        onPageChange={
          activeTab === 'contracts'
            ? setContractsPage
            : activeTab === 'external'
              ? setExternalPage
              : setEmployeePage
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
            الملخص أدناه يجمع أرقام الشهر من كل التبويبات للمقارنة السريعة.
          </span>
        </p>
      </div>

      <CommissionsSectionShell
        kicker="ملخص الشهر"
        title="إجماليات سريعة"
        subtitle="أرقام مستقلة عن التبويب الظاهر — تتبع الشهر المحاسبي المختار والبيانات المحمّلة."
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
        {activeTab === 'employee' ? <CommissionsEmployeeTabPanel page={page} /> : null}
        {activeTab === 'contracts' ? <CommissionsContractsTabPanel page={page} /> : null}
        {activeTab === 'external' ? <CommissionsExternalTabPanel page={page} /> : null}
      </div>

      <CommissionsSharedModals page={page} />
    </PageLayout>
  );
};
