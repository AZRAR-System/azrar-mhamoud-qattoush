import type { FC } from 'react';
import { CommissionsContractCommissionCard } from '@/components/commissions/CommissionsContractCommissionCard';
import { CommissionsSectionShell } from '@/components/commissions/CommissionsSectionShell';
import type { CommissionsPageModel } from '@/components/commissions/commissionsPageTypes';
import { Button } from '@/components/ui/Button';
import { StatsCardRow } from '@/components/shared/StatsCardRow';
import { DS } from '@/constants/designSystem';
import { formatCurrencyJOD } from '@/utils/format';
import { ArrowUp, Briefcase, Inbox } from 'lucide-react';

export const CommissionsContractsTabPanel: FC<{ page: CommissionsPageModel }> = ({ page }) => {
  const {
    selectedMonth,
    contractSearchTerm,
    setContractSearchTerm,
    commissionsForSelectedMonth,
    filteredCommissions,
    filteredRenewalCommissions,
    commissionsRenewalForSelectedMonth,
    renewalTotalOwner,
    renewalTotalTenant,
    renewalGrandTotal,
    getRenewalParentContractId,
    visibleContractCommissions,
    grandTotalContracts,
    totalOwner,
    totalTenant,
    getPropCode,
    getNames,
    openEditContractModal,
    handlePostponeCommissionCollection,
    handleDeleteContractCommission,
  } = page;

  return (
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
              <p className="mt-2 text-[10px] font-black uppercase text-emerald-100/70">
                مجموع المالك + المستأجر (أو البيع) للشهر
              </p>
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
        subtitle={`قائمة بجميع عمليات الشهر ${selectedMonth} بعد تطبيق البحث النصي في شريط التصفية (إيجار وبيع).`}
        accent="slate"
        bodyClassName="!p-3 sm:!p-4"
      >
        {commissionsForSelectedMonth.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-6 py-14 text-center dark:border-slate-700 dark:bg-slate-900/40">
            <Briefcase className="h-12 w-12 text-slate-300 dark:text-slate-600" strokeWidth={1.25} aria-hidden />
            <p className="max-w-sm text-sm font-bold text-slate-600 dark:text-slate-300">لا توجد عمولات مسجلة لهذا الشهر</p>
            <p className="max-w-md text-xs text-slate-500 dark:text-slate-400">
              عند اعتماد عمولة من أدوات ذكية أو من العقد أو اتفاقية البيع ستظهر هنا ضمن الشهر المحاسبي المختار.
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
  );
};
