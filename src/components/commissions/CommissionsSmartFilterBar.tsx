import { FC, useMemo } from 'react';
import { Users, HandCoins, Globe, Filter, Download } from 'lucide-react';
import { SmartFilterBar, FilterOptionItem } from '@/components/shared/SmartFilterBar';
import { المستخدمين_tbl } from '@/types';

const YM_RE = /^\d{4}-\d{2}$/;

function ymKey(y: number, month1to12: number): string {
  return `${y}-${String(month1to12).padStart(2, '0')}`;
}

/** كل أشهر YYYY-MM من start إلى end بشكل شامل (start ≤ end). */
function enumerateMonthsInclusive(startYm: string, endYm: string): string[] {
  if (!YM_RE.test(startYm) || !YM_RE.test(endYm)) return [];
  let y = Number(startYm.slice(0, 4));
  let m = Number(startYm.slice(5, 7));
  const endY = Number(endYm.slice(0, 4));
  const endM = Number(endYm.slice(5, 7));
  const out: string[] = [];
  while (y < endY || (y === endY && m <= endM)) {
    out.push(ymKey(y, m));
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

interface CommissionsSmartFilterBarProps {
  activeTab: 'contracts' | 'external' | 'employee';
  setActiveTab: (t: 'contracts' | 'external' | 'employee') => void;
  selectedMonth: string;
  setSelectedMonth: (m: string) => void;
  searchTerm: string;
  setSearchTerm: (s: string) => void;
  contractSearchTerm: string;
  setContractSearchTerm: (s: string) => void;
  filterType: string;
  setFilterType: (t: string) => void;
  employeeUserFilter: string;
  setEmployeeUserFilter: (u: string) => void;
  systemUsers: المستخدمين_tbl[];
  availableTypes: string[];
  onRefresh: () => void;
  onExportEmployeeXlsx: () => void;
  onExportEmployeeCsv: () => void;
  onExportContractCommissionsXlsx: () => void;
  totalResults: number;
  currentPage: number;
  totalPages: number;
  onPageChange: (p: number) => void;
  isLoading?: boolean;
}

export const CommissionsSmartFilterBar: FC<CommissionsSmartFilterBarProps> = ({
  activeTab, setActiveTab,
  selectedMonth, setSelectedMonth,
  searchTerm, setSearchTerm,
  contractSearchTerm, setContractSearchTerm,
  filterType, setFilterType,
  employeeUserFilter, setEmployeeUserFilter,
  systemUsers,
  availableTypes,
  onRefresh,
  onExportEmployeeXlsx,
  onExportEmployeeCsv,
  onExportContractCommissionsXlsx,
  totalResults,
  currentPage,
  totalPages,
  onPageChange,
}) => {

  const isEmployee = activeTab === 'employee';
  const isExternal = activeTab === 'external';
  const isContracts = activeTab === 'contracts';

  const userOptions: FilterOptionItem[] = [
    { value: '', label: 'كل الموظفين' },
    ...systemUsers.filter(u => !!u?.isActive).map(u => ({
      value: String(u.اسم_المستخدم),
      label: String(u.اسم_للعرض || u.اسم_المستخدم)
    }))
  ];

  const typeOptions: FilterOptionItem[] = (isEmployee ? ['All', 'إيجار', 'بيع'] : ['All', ...availableTypes]).map(t => ({
    value: t,
    label: t === 'All' ? 'كل الأنواع' : t
  }));

  /** قائمة أشهر صريحة (عربي) — الأحدث أولاً لتسهيل الاختيار. */
  const monthOptions = useMemo(() => {
    const endCap = new Date();
    endCap.setMonth(endCap.getMonth() + 24);
    const end = ymKey(endCap.getFullYear(), endCap.getMonth() + 1);
    let keys = enumerateMonthsInclusive('2000-01', end);
    const sel = String(selectedMonth || '').trim();
    if (YM_RE.test(sel) && !keys.includes(sel)) {
      keys = [...keys, sel].sort((a, b) => a.localeCompare(b));
    }
    keys.sort((a, b) => b.localeCompare(a));
    const fmt = new Intl.DateTimeFormat('ar', { month: 'long', year: 'numeric' });
    return keys.map((value) => {
      const yy = Number(value.slice(0, 4));
      const mm = Number(value.slice(5, 7));
      return { value, label: fmt.format(new Date(yy, mm - 1, 1)) };
    });
  }, [selectedMonth]);

  return (
    <SmartFilterBar
      searchPlaceholder={
        isContracts ? "بحث في العقود والفرص والأسماء..." :
        isExternal ? "بحث في العنوان..." :
        "بحث (المرجع، العقار، الموظف)..."
      }
      searchValue={isContracts ? contractSearchTerm : searchTerm}
      onSearchChange={isContracts ? setContractSearchTerm : setSearchTerm}
      tabs={[
        { id: 'contracts', label: 'عمولات العقود', icon: HandCoins },
        { id: 'external', label: 'عمولات خارجية', icon: Globe },
        { id: 'employee', label: 'عمولات الموظفين', icon: Users }
      ]}
      activeTab={activeTab}
      onTabChange={(id) => setActiveTab(id as 'contracts' | 'external' | 'employee')}
      onRefresh={onRefresh}
      onExport={isContracts ? onExportContractCommissionsXlsx : onExportEmployeeXlsx}
      totalResults={totalResults}
      currentPage={currentPage}
      totalPages={totalPages}
      onPageChange={onPageChange}
      filters={[
        ...(isEmployee ? [{
          id: 'user-filter',
          label: 'الموظف',
          options: userOptions,
          value: employeeUserFilter,
          onChange: setEmployeeUserFilter
        }] : []),
        ...(!isContracts ? [{
          id: 'type-filter',
          label: 'النوع',
          options: typeOptions,
          value: filterType,
          onChange: setFilterType
        }] : [])
      ]}
      moreActions={[
        {
          label: 'تصدير CSV (موظفين)',
          icon: Download,
          onClick: onExportEmployeeCsv,
          permission: 'EXPORT_DATA'
        }
      ]}
    >
      <div className="flex items-center gap-2">
        <div className="flex min-w-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 shadow-sm transition-all hover:border-indigo-300 dark:border-slate-700 dark:bg-slate-800">
          <Filter size={14} className="shrink-0 text-slate-400" aria-hidden />
          <label
            htmlFor="commissions-month-select"
            className="shrink-0 text-[11px] font-black text-slate-500 dark:text-slate-400"
          >
            الشهر
          </label>
          <select
            id="commissions-month-select"
            value={monthOptions.some((o) => o.value === selectedMonth) ? selectedMonth : monthOptions[0]?.value}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="max-w-[min(100%,14rem)] min-w-[10.5rem] cursor-pointer truncate rounded-lg border-0 bg-transparent py-0.5 text-start text-xs font-bold text-slate-700 outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 dark:text-slate-200"
          >
            {monthOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </SmartFilterBar>
  );
};
