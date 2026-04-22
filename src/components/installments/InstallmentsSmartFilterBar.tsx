import { FC } from 'react';
import { 
  Calendar,
  DollarSign,
  Layers,
  Clock,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { SmartFilterBar } from '@/components/shared/SmartFilterBar';
import { Button } from '@/components/ui/Button';

interface InstallmentsSmartFilterBarProps {
  search: string;
  setSearch: (v: string) => void;
  status: string;
  setStatus: (v: string) => void;
  startDate: string;
  setStartDate: (v: string) => void;
  endDate: string;
  setEndDate: (v: string) => void;
  minAmount: number | '';
  setMinAmount: (v: number | '') => void;
  maxAmount: number | '';
  setMaxAmount: (v: number | '') => void;
  paymentMethod: string;
  setPaymentMethod: (v: string) => void;
  onRefresh: () => void;
  onExportXlsx: () => void;
  totalResults: number;
  currentPage: number;
  totalPages: number;
  onPageChange: (p: number) => void;
  isLoading?: boolean;
}

export const InstallmentsSmartFilterBar: FC<InstallmentsSmartFilterBarProps> = ({
  search, setSearch,
  status, setStatus,
  startDate, setStartDate,
  endDate, setEndDate,
  minAmount, setMinAmount,
  maxAmount, setMaxAmount,
  paymentMethod, setPaymentMethod,
  onRefresh,
  onExportXlsx,
  totalResults,
  currentPage,
  totalPages,
  onPageChange,
}) => {
  return (
    <SmartFilterBar
      searchPlaceholder="بحث في الأقساط (المستأجر، العقار)..."
      searchValue={search}
      onSearchChange={setSearch}
      tabs={[
        { id: 'all', label: 'الكل', icon: Layers },
        { id: 'due', label: 'مستحق', icon: Clock },
        { id: 'debt', label: 'ذمم', icon: XCircle },
        { id: 'paid', label: 'مسدد', icon: CheckCircle }
      ]}
      activeTab={status}
      onTabChange={setStatus}
      onRefresh={onRefresh}
      onExport={onExportXlsx}
      totalResults={totalResults}
      currentPage={currentPage}
      totalPages={totalPages}
      onPageChange={onPageChange}
    >
      <div className="flex flex-wrap items-center gap-2">
        {/* Date Filter */}
        <div className="relative group">
          <Button variant="outline" size="sm" className={`h-9 px-3 rounded-xl gap-2 font-bold ${startDate || endDate ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : ''}`}>
            <Calendar size={14} />
            <span className="text-[10px]">
              {startDate || endDate ? `${startDate || '..'} - ${endDate || '..'}` : 'التاريخ'}
            </span>
          </Button>
          <div className="absolute left-0 top-full mt-2 hidden group-hover:block z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl p-4 w-64 animate-in fade-in zoom-in duration-200">
             <div className="space-y-4">
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full p-2 bg-slate-50 dark:bg-slate-900 rounded-lg text-xs" />
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full p-2 bg-slate-50 dark:bg-slate-900 rounded-lg text-xs" />
             </div>
          </div>
        </div>

        {/* Amount Filter */}
        <div className="relative group">
          <Button variant="outline" size="sm" className={`h-9 px-3 rounded-xl gap-2 font-bold ${minAmount || maxAmount ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : ''}`}>
            <DollarSign size={14} />
            <span className="text-[10px]">
              {minAmount || maxAmount ? `${minAmount || 0} - ${maxAmount || '∞'}` : 'المبلغ'}
            </span>
          </Button>
          <div className="absolute left-0 top-full mt-2 hidden group-hover:block z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl p-4 w-64 animate-in fade-in zoom-in duration-200">
             <div className="flex gap-2">
                <input type="number" placeholder="من" value={minAmount} onChange={(e) => setMinAmount(e.target.value ? Number(e.target.value) : '')} className="w-full p-2 bg-slate-50 dark:bg-slate-900 rounded-lg text-xs" />
                <input type="number" placeholder="إلى" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value ? Number(e.target.value) : '')} className="w-full p-2 bg-slate-50 dark:bg-slate-900 rounded-lg text-xs" />
             </div>
          </div>
        </div>

        {/* Payment Method */}
        <select
          value={paymentMethod}
          onChange={(e) => setPaymentMethod(e.target.value)}
          className="h-9 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-[10px] font-bold outline-none ring-offset-2 focus:ring-2 focus:ring-indigo-500/20"
        >
          <option value="all">كل الطرق</option>
          <option value="Prepaid">دفع مسبق</option>
          <option value="Postpaid">دفع لاحق</option>
        </select>
      </div>
    </SmartFilterBar>
  );
};
