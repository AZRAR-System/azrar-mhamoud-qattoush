import type { FC } from 'react';
import { CommissionsSectionShell } from '@/components/commissions/CommissionsSectionShell';
import type { CommissionsPageModel } from '@/components/commissions/commissionsPageTypes';
import { Button } from '@/components/ui/Button';
import { StatsCardRow } from '@/components/shared/StatsCardRow';
import { DS } from '@/constants/designSystem';
import { formatCurrencyJOD } from '@/utils/format';
import { Globe, Pencil, Plus, Tags, Trash2 } from 'lucide-react';

export const CommissionsExternalTabPanel: FC<{ page: CommissionsPageModel }> = ({ page }) => {
  const {
    selectedMonth,
    filteredExternal,
    visibleExternal,
    totalExternal,
    openAddExternalModal,
    openEditExternalModal,
    handleDeleteExternal,
  } = page;

  return (
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
    </div>
  );
};
