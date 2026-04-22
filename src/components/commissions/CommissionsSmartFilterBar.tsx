import { FC } from 'react';
import { 
  Users, 
  HandCoins, 
  Globe,
  Filter,
  Download
} from 'lucide-react';
import { SmartFilterBar, FilterOptionItem } from '@/components/shared/SmartFilterBar';
import { المستخدمين_tbl } from '@/types';

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
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm transition-all hover:border-indigo-300">
           <Filter size={14} className="text-slate-400" />
           <input 
             type="month" 
             className="bg-transparent text-[11px] font-bold outline-none cursor-pointer text-slate-700 dark:text-slate-200"
             value={selectedMonth}
             onChange={(e) => setSelectedMonth(e.target.value)}
           />
        </div>
      </div>
    </SmartFilterBar>
  );
};
