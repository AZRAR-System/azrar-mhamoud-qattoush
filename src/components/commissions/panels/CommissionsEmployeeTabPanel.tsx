import type { FC } from 'react';
import { CommissionsSectionShell } from '@/components/commissions/CommissionsSectionShell';
import type { CommissionsPageModel } from '@/components/commissions/commissionsPageTypes';
import { StatsCardRow } from '@/components/shared/StatsCardRow';
import { DS } from '@/constants/designSystem';
import { formatCurrencyJOD } from '@/utils/format';
import { ArrowUp, Briefcase, HandCoins, Users } from 'lucide-react';

export const CommissionsEmployeeTabPanel: FC<{ page: CommissionsPageModel }> = ({ page }) => {
  const {
    selectedMonth,
    user,
    employeeTotals,
    employeeMonthSummary,
    filteredEmployeeRows,
    visibleEmployeeRows,
  } = page;

  return (
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
          <div className="rounded-xl bg-gray-50 p-3 dark:bg-slate-900">
            <div className="text-xs font-bold text-slate-500 dark:text-slate-400">إيجار (قبل الإدخال)</div>
            <div className="text-lg font-bold text-slate-800 dark:text-white">
              {formatCurrencyJOD(employeeMonthSummary.rentBase)}
            </div>
          </div>
          <div className="rounded-xl bg-gray-50 p-3 dark:bg-slate-900">
            <div className="text-xs font-bold text-slate-500 dark:text-slate-400">بيع (قبل الإدخال)</div>
            <div className="text-lg font-bold text-slate-800 dark:text-white">
              {formatCurrencyJOD(employeeMonthSummary.saleBase)}
            </div>
          </div>
          <div className="rounded-xl bg-orange-50 p-3 dark:bg-orange-900/20">
            <div className="text-xs font-bold text-orange-700 dark:text-orange-300">إدخال عقار</div>
            <div className="text-lg font-bold text-orange-700 dark:text-orange-300">
              {formatCurrencyJOD(employeeMonthSummary.intro)}
            </div>
          </div>
          <div className="rounded-xl bg-sky-50 p-3 dark:bg-sky-900/20">
            <div className="text-xs font-bold text-sky-700 dark:text-sky-300">دخل خارجي</div>
            <div className="text-lg font-bold text-sky-700 dark:text-sky-300">
              {formatCurrencyJOD(employeeMonthSummary.external)}
            </div>
          </div>
          <div className="rounded-xl bg-emerald-50 p-3 dark:bg-emerald-900/20">
            <div className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
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
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`font-bold ${String(r.type) === 'بيع' ? 'text-purple-600 dark:text-purple-300' : 'text-emerald-600 dark:text-emerald-300'}`}
                      >
                        {String(r.type || '')}
                      </span>
                      <span className="text-sm text-slate-500 dark:text-slate-400">
                        | التاريخ:{' '}
                        <b className="text-slate-700 dark:text-slate-200">{String(r.date || '')}</b>
                      </span>
                      <span className="text-sm text-slate-500 dark:text-slate-400">
                        | العقار:{' '}
                        <b className="text-slate-700 dark:text-slate-200">{String(r.property || '—')}</b>
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
                        <b className="text-slate-700 dark:text-slate-200">{String(r.tier || '—')}</b>
                      </span>
                    </div>

                    <div className="text-sm text-slate-600 dark:text-slate-400">
                      رقم الفرصة:{' '}
                      <b className="text-slate-900 dark:text-white" dir="ltr">
                        {String(r.opportunity || '—')}
                      </b>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-100 pt-2 text-sm font-bold dark:border-slate-800">
                      <div className="flex items-center gap-1.5">
                        <Briefcase size={14} className="text-indigo-500" />
                        <span className="text-slate-500 dark:text-slate-400">المالك/البائع:</span>
                        <span className="text-indigo-600 dark:text-indigo-400">{String(r.ownerName || '—')}</span>
                      </div>
                      <div className="flex items-center gap-1.5 border-r border-slate-200 pr-4 dark:border-slate-700">
                        <Users size={14} className="text-emerald-500" />
                        <span className="text-slate-500 dark:text-slate-400">المستأجر/المشتري:</span>
                        <span className="text-emerald-600 dark:text-emerald-400">{String(r.client || '—')}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <div className="rounded-xl bg-gray-100 px-3 py-2 text-sm font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                      عمولة العملية: {formatCurrencyJOD(Number(r.officeCommission || 0))}
                    </div>
                    <div className="rounded-xl bg-indigo-50 px-3 py-2 text-sm font-bold text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300">
                      قبل الإدخال: {formatCurrencyJOD(Number(r.employeeBase || 0))}
                    </div>
                    <div className="rounded-xl bg-orange-50 px-3 py-2 text-sm font-bold text-orange-700 dark:bg-orange-900/20 dark:text-orange-300">
                      إدخال عقار: {formatCurrencyJOD(Number(r.intro || 0))}
                    </div>
                    <div className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
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
  );
};
