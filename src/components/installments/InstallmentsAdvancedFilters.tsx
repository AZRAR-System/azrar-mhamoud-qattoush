import React from 'react';
import type { InstallmentsPageModel } from '@/hooks/useInstallments';
import { BadgeDollarSign, Calendar, DollarSign, Filter, LayoutDashboard, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';

type Props = { page: InstallmentsPageModel };

export function InstallmentsAdvancedFilters({ page }: Props) {
  const {
    isAdvancedFiltersOpen,
    setIsAdvancedFiltersOpen,
    filterStartDate,
    setFilterStartDate,
    filterEndDate,
    setFilterEndDate,
    filterMinAmount,
    setFilterMinAmount,
    filterMaxAmount,
    setFilterMaxAmount,
    filterPaymentMethod,
    setFilterPaymentMethod,
    sortMode,
    setSortMode,
    filter,
    setFilter,
    search,
    setSearch,
    favoriteFilters,
    saveCurrentFilter,
    applyFavFilter,
    deleteFavFilter,
  } = page;

  return (
    <>
    {isAdvancedFiltersOpen && (
      <div className="mb-6 p-6 rounded-[2.5rem] bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800/50 animate-in slide-in-from-top duration-500">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-sm font-black text-indigo-800 dark:text-indigo-300 flex items-center gap-2">
            <Filter size={16} />
            إعدادات التصفية المتقدمة
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsAdvancedFiltersOpen(false)}
            className="rounded-full h-8 w-8 p-0"
          >
            <X size={16} />
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <Calendar size={14} /> من تاريخ
            </label>
            <input
              type="date"
              value={filterStartDate}
              onChange={(e) => setFilterStartDate(e.target.value)}
              className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 outline-none text-sm transition-all"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <Calendar size={14} /> إلى تاريخ
            </label>
            <input
              type="date"
              value={filterEndDate}
              onChange={(e) => setFilterEndDate(e.target.value)}
              className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 outline-none text-sm transition-all"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <DollarSign size={14} /> القيمة (د.أ)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                placeholder="من"
                value={filterMinAmount}
                onChange={(e) =>
                  setFilterMinAmount(e.target.value ? Number(e.target.value) : '')
                }
                className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 outline-none text-sm transition-all"
              />
              <input
                type="number"
                placeholder="إلى"
                value={filterMaxAmount}
                onChange={(e) =>
                  setFilterMaxAmount(e.target.value ? Number(e.target.value) : '')
                }
                className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 outline-none text-sm transition-all"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <BadgeDollarSign size={14} /> طريقة الدفع
            </label>
            <Select
              value={filterPaymentMethod}
              onChange={(e) => setFilterPaymentMethod(e.target.value)}
              className="w-full rounded-2xl text-sm"
              options={[
                { value: 'all', label: 'جميع الطرق' },
                { value: 'Prepaid', label: 'دفع مقدم' },
                { value: 'Postpaid', label: 'دفع مؤخر' },
              ]}
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <LayoutDashboard size={14} /> الترتيب والعرض
            </label>
            <div className="flex gap-2">
              <Select
                value={sortMode}
                onChange={(e) =>
                  setSortMode(
                    e.target.value as
                      | 'tenant-asc'
                      | 'tenant-desc'
                      | 'due-asc'
                      | 'due-desc'
                      | 'amount-asc'
                      | 'amount-desc'
                  )
                }
                className="w-full rounded-2xl text-sm"
                options={[
                  { value: 'due-asc', label: 'الاستحقاق: الأقرب' },
                  { value: 'due-desc', label: 'الاستحقاق: الأبعد' },
                  { value: 'tenant-asc', label: 'المستأجر: تصاعدي' },
                  { value: 'tenant-desc', label: 'المستأجر: تنازلي' },
                  { value: 'amount-asc', label: 'المبلغ: من الأقل' },
                  { value: 'amount-desc', label: 'المبلغ: من الأعلى' },
                ]}
              />
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-indigo-100 dark:border-indigo-800/50 pt-6">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 ml-2">
            حالة الدفع:
          </span>
          {[
            { id: 'all', label: 'الكل' },
            { id: 'due', label: 'مستحق قريباً', color: 'bg-amber-100 text-amber-700' },
            { id: 'debt', label: 'عليهم ذمم', color: 'bg-rose-100 text-rose-700' },
            { id: 'paid', label: 'مسدد بالكامل', color: 'bg-emerald-100 text-emerald-700' },
          ].map((st) => (
            <button
              key={st.id}
              onClick={() => setFilter(st.id as 'all' | 'debt' | 'paid' | 'due')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                filter === st.id
                  ? st.color || 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:border-indigo-300'
              }`}
            >
              {st.label}
            </button>
          ))}

          <div className="flex-1"></div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const name = prompt('أدخل اسماً لهذا الفلتر:');
              if (name) saveCurrentFilter(name);
            }}
            className="text-xs text-indigo-600 hover:bg-indigo-50"
          >
            حفظ كفلتر مفضل
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setFilter('all');
              setFilterStartDate('');
              setFilterEndDate('');
              setFilterMinAmount('');
              setFilterMaxAmount('');
              setSearch('');
            }}
            className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50"
          >
            مسح جميع الفلاتر
          </Button>
        </div>

        {favoriteFilters.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2 items-center">
            <span className="text-[10px] font-black uppercase text-slate-400">
              الفلاتر المحفوظة:
            </span>
            {favoriteFilters.map((fav) => (
              <div
                key={fav.name}
                className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-full px-3 py-1"
              >
                <button
                  onClick={() => applyFavFilter(fav)}
                  className="text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:text-indigo-600"
                >
                  {fav.name}
                </button>
                <button
                  onClick={() => deleteFavFilter(fav.name)}
                  className="text-slate-400 hover:text-rose-500"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    )}
    </>
  );
}
