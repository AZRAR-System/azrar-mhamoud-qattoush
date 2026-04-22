import type { FC } from 'react';
import { CommissionsSmartFilterBar } from '@/components/commissions/CommissionsSmartFilterBar';
import {
  HandCoins,
  Globe,
  Users,
  Plus,
  ArrowUp,
  Briefcase,
  Inbox,
  Pencil,
  CornerDownRight,
  Trash2,
  Tags,
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
    <PageLayout>
      <SmartPageHero
        variant="premium"
        icon={<HandCoins size={32} />}
        title="إدارة العمولات والإيرادات"
        description="تتبع عمولات العقود، الدخل الخارجي، وتقرير عمولات الموظفين بنظام أزرار."
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

      <StatsCardRow>
        <StatCard
          label="عمولات العقود"
          value={formatCurrencyJOD(grandTotalContracts)}
          icon={HandCoins}
          color="emerald"
        />
        <StatCard
          label="عمولات خارجية"
          value={formatCurrencyJOD(totalExternal)}
          icon={Globe}
          color="blue"
        />
        <StatCard
          label="عمولات الموظفين"
          value={formatCurrencyJOD(employeeTotals.totalEmployee)}
          icon={Users}
          color="indigo"
        />
        <StatCard
          label="عمليات الشهر"
          value={employeeTotals.count}
          icon={ArrowUp}
          color="amber"
        />
      </StatsCardRow>

      <div className="space-y-6">
      {activeTab === 'employee' && (
        <div
          className="animate-slide-up space-y-6"
          role="tabpanel"
          id="comm-panel-employee"
          aria-labelledby="comm-tab-employee"
        >

          {/* Stats */}
          <StatsCardRow>
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-800 p-6 text-white shadow-xl shadow-indigo-600/25 ring-1 ring-white/10">
              <div className="relative z-10">
                <p className="mb-1 font-black text-indigo-100 flex items-center gap-2">
                   <Users size={16} /> عدد العمليات
                </p>
                <h3 className="text-3xl font-black tabular-nums">
                  {employeeTotals.count.toLocaleString()}{' '}
                  <span className="text-lg font-medium opacity-80">عملية</span>
                </h3>
              </div>
              <HandCoins className="absolute -bottom-6 -left-6 text-white opacity-10 w-36 h-36" />
            </div>
            
            <div className={DS.components.card + " p-6"}>
              <p className="text-slate-500 dark:text-slate-400 text-xs font-black uppercase tracking-widest mb-2">
                إجمالي عمولة الموظفين
              </p>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white tabular-nums">
                {formatCurrencyJOD(employeeTotals.totalEmployee)}
              </h3>
              <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 mt-2 flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                يشمل إدخال العقار (إن وجد)
              </div>
            </div>

            <div className={DS.components.card + " p-6"}>
              <p className="text-slate-500 dark:text-slate-400 text-xs font-black uppercase tracking-widest mb-2">
                إجمالي عمولات العمليات (المكتب)
              </p>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white tabular-nums">
                {formatCurrencyJOD(employeeTotals.totalOffice)}
              </h3>
              <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 mt-2 flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                إدخال العقار: {formatCurrencyJOD(employeeTotals.totalIntro)}
              </div>
            </div>
          </StatsCardRow>

          <div className="app-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="font-bold text-slate-700 dark:text-white">
                ملخص أرباح هذا الشهر ({selectedMonth})
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-400">
                المستخدم المسجل:{' '}
                <b className="text-slate-900 dark:text-white" dir="ltr">
                  {String(user?.اسم_المستخدم || '—')}
                </b>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mt-3">
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
          </div>

          {/* List */}
          <div className="app-card">
            <div className="flex flex-col gap-3 border-b border-gray-100 bg-gray-50 p-4 dark:border-slate-700 dark:bg-slate-800 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-bold text-slate-700 dark:text-white">عمليات عمولة الموظفين</h3>
                <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                الشهر {selectedMonth}
                </p>
              </div>
            </div>
            <div className="space-y-3 p-4">
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
          </div>
        </div>
      )}

      {/* View 1: Contract Commissions */}
      {activeTab === 'contracts' && (
        <div className="animate-slide-up space-y-6" role="tabpanel" id="comm-panel-contracts" aria-labelledby="comm-tab-contracts">
          {/* Financial Cards */}
          <StatsCardRow>
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-800 p-6 text-white shadow-xl shadow-emerald-500/25 ring-1 ring-white/10">
              <div className="relative z-10">
                <p className="mb-1 flex items-center gap-2 font-black text-emerald-100">
                  <ArrowUp size={16} aria-hidden /> إجمالي العمولات
                </p>
                <h3 className="text-3xl font-black tracking-tight tabular-nums">{formatCurrencyJOD(grandTotalContracts)}</h3>
                <p className="mt-2 text-[10px] font-black uppercase text-emerald-100/70">مجموع المالك + المستأجر للشهر</p>
              </div>
              <Briefcase className="absolute -bottom-6 -left-6 h-36 w-36 text-white opacity-10" aria-hidden />
            </div>

            <div className={DS.components.card + " p-6"}>
              <p className="text-slate-500 dark:text-slate-400 text-xs font-black uppercase tracking-widest mb-2 flex items-center justify-between">
                من الملاك
                <span className="text-[10px] font-black text-indigo-500">
                  {grandTotalContracts > 0 ? ((totalOwner / grandTotalContracts) * 100).toFixed(0) : 0}%
                </span>
              </p>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white tabular-nums">
                {formatCurrencyJOD(totalOwner)}
              </h3>
              <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 mt-4 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 transition-all duration-500"
                  style={{
                    width: `${grandTotalContracts > 0 ? (totalOwner / grandTotalContracts) * 100 : 0}%`,
                  }}
                ></div>
              </div>
            </div>

            <div className={DS.components.card + " p-6"}>
              <p className="text-slate-500 dark:text-slate-400 text-xs font-black uppercase tracking-widest mb-2 flex items-center justify-between">
                من المستأجرين
                <span className="text-[10px] font-black text-purple-500">
                  {grandTotalContracts > 0 ? ((totalTenant / grandTotalContracts) * 100).toFixed(0) : 0}%
                </span>
              </p>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white tabular-nums">
                {formatCurrencyJOD(totalTenant)}
              </h3>
              <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 mt-4 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-500 transition-all duration-500"
                  style={{
                    width: `${grandTotalContracts > 0 ? (totalTenant / grandTotalContracts) * 100 : 0}%`,
                  }}
                ></div>
              </div>
            </div>
          </StatsCardRow>


          <div className="app-card">
            <div className="flex flex-col gap-3 border-b border-gray-100 bg-gray-50 p-4 dark:border-slate-700 dark:bg-slate-800 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-bold text-slate-700 dark:text-white">سجل عمولات العقود</h3>
                <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                  الشهر {selectedMonth}
                </p>
              </div>
            </div>
            <div className="space-y-3 p-4">
              {commissionsForSelectedMonth.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-6 py-14 text-center dark:border-slate-700 dark:bg-slate-900/40">
                  <Briefcase className="h-12 w-12 text-slate-300 dark:text-slate-600" strokeWidth={1.25} aria-hidden />
                  <p className="max-w-sm text-sm font-bold text-slate-600 dark:text-slate-300">
                    لا توجد عمولات مسجلة لهذا الشهر
                  </p>
                  <p className="max-w-md text-xs text-slate-500 dark:text-slate-400">
                    عند اعتماد عمولة من أدوات ذكية أو من العقد ستظهر هنا ضمن الشهر المحاسبي المختار.
                  </p>
                </div>
              ) : filteredCommissions.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-6 py-12 text-center dark:border-slate-700 dark:bg-slate-900/40">
                  <Inbox className="h-10 w-10 text-slate-300 dark:text-slate-600" strokeWidth={1.25} aria-hidden />
                  <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
                    لا نتائج تطابق البحث الحالي
                  </p>
                  <Button type="button" variant="outline" size="sm" onClick={() => setContractSearchTerm('')}>
                    مسح البحث
                  </Button>
                </div>
              ) : (
                visibleContractCommissions.map((c) => (
                  <div key={c.رقم_العمولة} className="app-card p-4">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-slate-800 dark:text-white">
                            {c.نوع_العمولة === 'Sale' ? 'عمولة بيع' : 'عمولة عقد'}
                          </span>
                          <span className="text-slate-500 dark:text-slate-400 text-sm font-mono">
                            #{formatContractNumberShort(c.نوع_العمولة === 'Sale' ? c.رقم_الاتفاقية : c.رقم_العقد)}
                          </span>
                          <span className="text-slate-500 dark:text-slate-400 text-sm">
                            | عقار:{' '}
                            <b className="text-slate-700 dark:text-slate-200">
                              {getPropCode(c)}
                            </b>
                          </span>
                        </div>
                        <div className="text-sm text-slate-600 dark:text-slate-400">
                          التاريخ:{' '}
                          <b className="text-slate-700 dark:text-slate-200">{c.تاريخ_العقد}</b>
                        </div>

                        <div className="text-sm text-slate-600 dark:text-slate-400">
                          رقم الفرصة:{' '}
                          <b className="text-slate-900 dark:text-white" dir="ltr">
                            {String(c.رقم_الفرصة || '—')}
                          </b>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 py-2.5 px-4 rounded-xl bg-slate-50/50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/60">
                          {(() => {
                            const names = getNames(c);
                            const isSale = c.نوع_العمولة === 'Sale';
                            return (
                              <>
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                                    <Briefcase size={16} />
                                  </div>
                                  <div>
                                    <span className="block text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                                      {isSale ? 'البائع' : 'المالك'}
                                    </span>
                                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                                      {names.p1}
                                    </span>
                                  </div>
                                </div>
                                
                                <div className="flex items-center gap-2 border-r border-slate-200 dark:border-slate-800 pr-6">
                                  <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                                    <Users size={16} />
                                  </div>
                                  <div>
                                    <span className="block text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                                      {isSale ? 'المشتري' : 'المستأجر'}
                                    </span>
                                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                                      {names.p2}
                                    </span>
                                  </div>
                                </div>
                              </>
                            );
                          })()}
                        </div>

                        {String(c.تاريخ_تحصيل_مؤجل || '').trim() && (
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            تحصيل مؤجل إلى:{' '}
                            <b className="text-slate-700 dark:text-slate-200">
                              {String(c.تاريخ_تحصيل_مؤجل)}
                            </b>
                            {String(c.جهة_تحصيل_مؤجل || '').trim() ? (
                              <span> — ({String(c.جهة_تحصيل_مؤجل)})</span>
                            ) : null}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEditContractModal(c)}
                          className="flex items-center gap-2 rounded-xl bg-gray-100 px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-gray-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                        >
                          <Pencil size={16} aria-hidden /> تعديل
                        </button>

                        <button
                          type="button"
                          onClick={() => void handlePostponeCommissionCollection(c)}
                          className="flex items-center gap-2 rounded-xl bg-indigo-50 px-3 py-2 text-sm font-bold text-indigo-700 transition hover:bg-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-200 dark:hover:bg-indigo-900/30"
                        >
                          <CornerDownRight size={16} aria-hidden /> تأجيل التحصيل
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteContractCommission(c)}
                          className="flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-red-600 transition hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30"
                        >
                          <Trash2 size={16} aria-hidden /> حذف
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
                      <div className="bg-gray-50 dark:bg-slate-800 rounded-xl p-3">
                        <div className="text-xs text-slate-500 dark:text-slate-400 font-bold">
                          {c.نوع_العمولة === 'Sale' ? 'عمولة البائع' : 'عمولة المالك'}
                        </div>
                        <div className="text-lg font-bold text-slate-800 dark:text-white">
                          {formatCurrencyJOD(Number((c.نوع_العمولة === 'Sale' ? c.عمولة_البائع : c.عمولة_المالك) || 0))}
                        </div>
                      </div>
                      <div className="bg-gray-50 dark:bg-slate-800 rounded-xl p-3">
                        <div className="text-xs text-slate-500 dark:text-slate-400 font-bold">
                          {c.نوع_العمولة === 'Sale' ? 'عمولة المشتري' : 'عمولة المستأجر'}
                        </div>
                        <div className="text-lg font-bold text-slate-800 dark:text-white">
                          {formatCurrencyJOD(Number((c.نوع_العمولة === 'Sale' ? c.عمولة_المشتري : c.عمولة_المستأجر) || 0))}
                        </div>
                      </div>
                      <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-3">
                        <div className="text-xs text-indigo-700 dark:text-indigo-300 font-bold">
                          المجموع {c.يوجد_ادخال_عقار && <span className="text-indigo-500">(+ إدخال)</span>}
                        </div>
                        <div className="text-lg font-bold text-indigo-700 dark:text-indigo-300">
                          {formatCurrencyJOD(Number(c.المجموع || 0))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* View 2: External Commissions */}
      {activeTab === 'external' && (
        <div
          className="animate-slide-up space-y-6"
          role="tabpanel"
          id="comm-panel-external"
          aria-labelledby="comm-tab-external"
        >

          {/* Stats Cards */}
          <StatsCardRow cols={2}>
            <div className="relative flex flex-col justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-800 p-6 text-white shadow-xl shadow-indigo-600/25 ring-1 ring-white/10">
              <div className="relative z-10">
                <p className="mb-1 flex items-center gap-2 font-black text-indigo-100">
                  <Globe size={16} aria-hidden /> مجموع العمولات الخارجية (المفلترة)
                </p>
                <h3 className="text-3xl font-black tracking-tight tabular-nums">{formatCurrencyJOD(totalExternal)}</h3>
              </div>
              <Globe className="absolute -bottom-6 -left-6 h-36 w-36 text-white opacity-10" aria-hidden />
            </div>

            <div className={DS.components.card + " p-6 flex flex-col justify-center"}>
              <div className="flex items-center gap-4">
                <div className="p-3.5 bg-orange-500/10 text-orange-600 dark:text-orange-400 rounded-2xl">
                  <Tags size={28} />
                </div>
                <div>
                  <p className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">
                    عدد العمليات (المفلترة)
                  </p>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white tabular-nums">
                    {filteredExternal.length} عملية
                  </h3>
                </div>
              </div>
            </div>
          </StatsCardRow>

          {/* External Commissions List (Cards) */}
          <div className="app-card">
            <div className="flex flex-col gap-3 border-b border-gray-100 bg-gray-50 p-4 dark:border-slate-700 dark:bg-slate-800 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-bold text-slate-700 dark:text-white">سجل العمولات الخارجية</h3>
              </div>
            </div>
            <div className="space-y-3 p-4">
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
                    <Plus size={16} /> إضافة عمولة
                  </Button>
                </div>
              ) : (
                visibleExternal.map((c) => (
                  <div key={c.id} className="app-card p-4">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-slate-800 dark:text-white">
                            {c.العنوان}
                          </span>
                          <span className="text-slate-500 dark:text-slate-400 text-sm">
                            | {c.النوع}
                          </span>
                        </div>
                        <div className="text-sm text-slate-600 dark:text-slate-400">
                          التاريخ: <b className="text-slate-700 dark:text-slate-200">{c.التاريخ}</b>
                        </div>
                        <div className="text-sm text-slate-600 dark:text-slate-400">
                          ملاحظات:{' '}
                          <span className="text-slate-700 dark:text-slate-200">
                            {c.ملاحظات || '-'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 justify-end">
                        <div className="px-3 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 font-bold text-sm">
                          {formatCurrencyJOD(Number(c.القيمة || 0))}
                        </div>
                        <button
                          onClick={() => openEditExternalModal(c)}
                          className="px-3 py-2 rounded-xl bg-gray-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-gray-200 dark:hover:bg-slate-700 transition text-sm font-bold flex items-center gap-2"
                        >
                          <Pencil size={16} /> تعديل
                        </button>
                        <button
                          onClick={() => handleDeleteExternal(c.id)}
                          className="px-3 py-2 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 transition text-sm font-bold flex items-center gap-2"
                        >
                          <Trash2 size={16} /> حذف
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

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
