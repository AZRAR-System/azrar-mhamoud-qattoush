import type { InstallmentsPageModel } from '@/hooks/useInstallments';
import { useAppDialogs } from '@/hooks/useAppDialogs';
import {
  BadgeDollarSign,
  Calendar,
  ChevronDown,
  DollarSign,
  Filter,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';

type Props = { page: InstallmentsPageModel };

const STATUS_CHIPS: {
  id: 'all' | 'debt' | 'paid' | 'due';
  label: string;
  color?: string;
}[] = [
  { id: 'all', label: 'الكل' },
  { id: 'due', label: 'مستحق قريباً', color: 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300' },
  { id: 'debt', label: 'عليهم ذمم', color: 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300' },
  { id: 'paid', label: 'مسدد بالكامل', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' },
];

/**
 * شريط بحث وتصفية موحّد لصفحة الدفعات (نمط app-card كصفحة العمولات).
 */
export function InstallmentsFiltersPanel({ page }: Props) {
  const dialogs = useAppDialogs();
  const {
    search,
    setSearch,
    sortMode,
    setSortMode,
    filter,
    setFilter,
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
    favoriteFilters,
    saveCurrentFilter,
    applyFavFilter,
    deleteFavFilter,
    clearFilters,
  } = page;

  return (
    <div className="app-card p-4 md:p-5 space-y-5 border border-slate-200/80 dark:border-slate-800/80">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
          <SlidersHorizontal size={18} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
          <h3 className="text-sm font-black">البحث والتصفية</h3>
        </div>
        <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 sm:text-end">
          نطاق التواريخ والمبالغ اختياري — يُطبّق مع حالة الدفع والبحث
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-3 lg:items-stretch">
        <div className="relative flex-1 min-w-0 group/search">
          <Search
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within/search:text-indigo-500 transition-colors pointer-events-none"
            size={18}
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث: مستأجر، رقم عقد، عقار..."
            className="w-full pr-11 pl-4 py-3 rounded-2xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all"
          />
        </div>

        <div className="w-full lg:w-[min(100%,22rem)] shrink-0">
          <label className="sr-only">ترتيب العرض</label>
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
            className="w-full rounded-2xl text-sm h-[46px]"
            options={[
              { value: 'due-asc', label: 'الأولوية: متأخر ثم الأقرب استحقاقاً' },
              { value: 'due-desc', label: 'الأولوية: متأخر ثم الأبعد استحقاقاً' },
              { value: 'tenant-asc', label: 'المستأجر: أ-ي' },
              { value: 'tenant-desc', label: 'المستأجر: ي-أ' },
              { value: 'amount-asc', label: 'المبلغ: من الأقل' },
              { value: 'amount-desc', label: 'المبلغ: من الأعلى' },
            ]}
          />
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={clearFilters}
          className="h-[46px] rounded-2xl font-black border-slate-200 dark:border-slate-600 shrink-0"
        >
          مسح الكل
        </Button>
      </div>

      <div className="space-y-2">
        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">حالة الدفع</span>
        <div className="flex flex-wrap gap-2">
          {STATUS_CHIPS.map((st) => (
            <button
              key={st.id}
              type="button"
              onClick={() => setFilter(st.id)}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all border ${
                filter === st.id
                  ? st.color || 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-500/25'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-indigo-300'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-slate-200/80 dark:border-slate-800 pt-4">
        <button
          type="button"
          onClick={() => setIsAdvancedFiltersOpen(!isAdvancedFiltersOpen)}
          className="flex w-full items-center justify-between gap-3 rounded-2xl px-3 py-2.5 text-start font-bold text-sm text-indigo-800 dark:text-indigo-300 bg-indigo-50/80 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-colors"
        >
          <span className="flex items-center gap-2 min-w-0">
            <Filter size={16} className="shrink-0" />
            <span className="truncate">تصفية تفصيلية: التواريخ، المبلغ، طريقة الدفع</span>
          </span>
          <ChevronDown
            size={18}
            className={`shrink-0 transition-transform ${isAdvancedFiltersOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {isAdvancedFiltersOpen && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 animate-in slide-in-from-top-2 duration-300">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <Calendar size={14} /> من تاريخ الاستحقاق
              </label>
              <input
                type="date"
                value={filterStartDate}
                onChange={(e) => setFilterStartDate(e.target.value)}
                className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-indigo-500/20 outline-none text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <Calendar size={14} /> إلى تاريخ الاستحقاق
              </label>
              <input
                type="date"
                value={filterEndDate}
                onChange={(e) => setFilterEndDate(e.target.value)}
                className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-indigo-500/20 outline-none text-sm"
              />
            </div>
            <div className="space-y-2 md:col-span-2 xl:col-span-1">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <DollarSign size={14} /> المبلغ (د.أ)
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="من"
                  value={filterMinAmount}
                  onChange={(e) => setFilterMinAmount(e.target.value ? Number(e.target.value) : '')}
                  className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-indigo-500/20 outline-none text-sm"
                />
                <input
                  type="number"
                  placeholder="إلى"
                  value={filterMaxAmount}
                  onChange={(e) => setFilterMaxAmount(e.target.value ? Number(e.target.value) : '')}
                  className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-indigo-500/20 outline-none text-sm"
                />
              </div>
            </div>
            <div className="space-y-2 md:col-span-2 xl:col-span-1">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <BadgeDollarSign size={14} /> طريقة الدفع
              </label>
              <Select
                value={filterPaymentMethod}
                onChange={(e) => setFilterPaymentMethod(e.target.value)}
                className="w-full rounded-2xl text-sm h-[46px]"
                options={[
                  { value: 'all', label: 'جميع الطرق' },
                  { value: 'Prepaid', label: 'دفع مقدم' },
                  { value: 'Postpaid', label: 'دفع مؤخر' },
                ]}
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 pt-1 border-t border-slate-200/80 dark:border-slate-800">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={async () => {
            const name = await dialogs.prompt({
              title: 'حفظ فلتر مفضل',
              message: 'أدخل اسماً لهذا الفلتر:',
              inputType: 'text',
              placeholder: 'اسم الفلتر',
            });
            const trimmed = name?.trim();
            if (trimmed) saveCurrentFilter(trimmed);
          }}
          className="text-indigo-600 dark:text-indigo-400 font-bold"
        >
          حفظ كفلتر مفضل
        </Button>

        {favoriteFilters.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 shrink-0">محفوظة:</span>
            {favoriteFilters.map((fav) => (
              <div
                key={fav.name}
                className="flex items-center gap-1 bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-full px-3 py-1"
              >
                <button
                  type="button"
                  onClick={() => applyFavFilter(fav)}
                  className="text-[11px] font-bold text-slate-700 dark:text-slate-300 hover:text-indigo-600 max-w-[12rem] truncate"
                >
                  {fav.name}
                </button>
                <button
                  type="button"
                  onClick={() => deleteFavFilter(fav.name)}
                  className="text-slate-400 hover:text-rose-500 p-0.5"
                  aria-label={`حذف ${fav.name}`}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
