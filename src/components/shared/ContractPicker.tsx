import React, { useEffect, useState } from 'react';
import { Search, X, FileText, ChevronDown, ExternalLink } from 'lucide-react';
import { العقود_tbl, الأشخاص_tbl, العقارات_tbl } from '@/types';
import { formatDateYMD } from '@/utils/format';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatContractNumberShort } from '@/utils/contractNumber';
import { contractPickerSearchSmart, domainGetSmart } from '@/services/domainQueries';

interface ContractPickerProps {
  label?: string;
  value?: string;
  onChange: (contractId: string, contractObj?: العقود_tbl) => void;
  required?: boolean;
  placeholder?: string;
  disabled?: boolean;
  onOpenContract?: (contractId: string) => void;
}

type PickerRow = {
  contract: العقود_tbl;
  propertyCode?: string;
  ownerName?: string;
  tenantName?: string;
  ownerNationalId?: string;
  tenantNationalId?: string;
};

export const ContractPicker: React.FC<ContractPickerProps> = ({
  label,
  value,
  onChange,
  required = false,
  placeholder = 'اختر العقد...',
  disabled = false,
  onOpenContract,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Display-only state for the trigger when closed
  const [selectedContract, setSelectedContract] = useState<العقود_tbl | null>(null);
  const [selectedProperty, setSelectedProperty] = useState<العقارات_tbl | null>(null);
  const [selectedTenant, setSelectedTenant] = useState<الأشخاص_tbl | null>(null);
  const [selectedOwner, setSelectedOwner] = useState<الأشخاص_tbl | null>(null);

  // Modal data (Desktop: SQL-backed)
  const [rows, setRows] = useState<PickerRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    const run = async () => {
      if (!value) {
        if (alive) {
          setSelectedContract(null);
          setSelectedProperty(null);
          setSelectedTenant(null);
          setSelectedOwner(null);
        }
        return;
      }

      const c = (await domainGetSmart('contracts', value)) as any;
      const contract = (c as العقود_tbl) || null;
      const prop = contract?.رقم_العقار ? ((await domainGetSmart('properties', String(contract.رقم_العقار))) as any) : null;
      const tenant = contract?.رقم_المستاجر ? ((await domainGetSmart('people', String(contract.رقم_المستاجر))) as any) : null;
      const owner = prop?.رقم_المالك ? ((await domainGetSmart('people', String(prop.رقم_المالك))) as any) : null;

      if (!alive) return;
      setSelectedContract(contract);
      setSelectedProperty((prop as العقارات_tbl) || null);
      setSelectedTenant((tenant as الأشخاص_tbl) || null);
      setSelectedOwner((owner as الأشخاص_tbl) || null);
    };
    void run();
    return () => {
      alive = false;
    };
  }, [value]);

  const loadRows = async (q: string) => {
    setIsLoading(true);
    try {
      const items = await contractPickerSearchSmart({ query: q, limit: 250 });
      setRows(Array.isArray(items) ? (items as any) : []);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpen = () => {
    if (disabled) return;
    setSearchTerm('');
    setIsOpen(true);
    void loadRows('');
  };

  useEffect(() => {
    if (!isOpen) return;
    let alive = true;
    const t = setTimeout(async () => {
      if (!alive) return;
      await loadRows(searchTerm);
    }, 200);
    return () => {
      alive = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, searchTerm]);

  const handleSelect = (c: العقود_tbl) => {
    onChange(c.رقم_العقد, c);
    setIsOpen(false);
  };

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}

      {/* Trigger */}
      <div
        onClick={handleOpen}
        className={
          `relative w-full bg-white dark:bg-slate-900 border text-sm rounded-xl p-3 flex items-center justify-between cursor-pointer transition-all hover:border-indigo-400/70 group ` +
          (disabled ? 'opacity-60 cursor-not-allowed bg-slate-100 dark:bg-slate-800/60 ' : '') +
          (value ? 'border-indigo-200/70 dark:border-slate-700' : 'border-slate-200/80 dark:border-slate-700')
        }
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className={`p-2 rounded-lg ${selectedContract ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300' : 'bg-slate-100 text-slate-400 dark:bg-slate-800/60 dark:text-slate-500'}`}>
            <FileText size={18} />
          </div>
          <div className="flex flex-col min-w-0">
            <span className={`font-bold whitespace-normal break-words ${selectedContract ? 'text-slate-800 dark:text-white' : 'text-slate-400'}`}>
              {selectedContract
                ? `عقد #${formatContractNumberShort(selectedContract.رقم_العقد)}${selectedProperty?.الكود_الداخلي ? ` • ${selectedProperty.الكود_الداخلي}` : ''}`
                : placeholder}
            </span>
            {selectedContract ? (
              <span className="text-[10px] text-slate-500 flex flex-wrap items-start gap-2">
                <span className="min-w-0 whitespace-normal break-words">{selectedTenant?.الاسم || 'مستأجر غير معروف'}</span>
                <span className="opacity-70">|</span>
                <span className="whitespace-normal break-words">نهاية: {formatDateYMD(selectedContract.تاريخ_النهاية)}</span>
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {value && onOpenContract ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenContract(value);
              }}
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700/50"
            >
              <ExternalLink size={14} /> فتح
            </button>
          ) : null}
          <ChevronDown size={16} className="text-slate-400 group-hover:text-indigo-500 transition" />
        </div>
      </div>

      {/* MODAL */}
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-5xl h-[85vh] rounded-2xl shadow-2xl border border-slate-200/80 dark:border-slate-800 ring-1 ring-black/5 dark:ring-white/5 flex flex-col animate-scale-up overflow-hidden">
            {/* Header */}
            <div className="p-5 border-b border-slate-200/70 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/30 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-600 text-white rounded-lg shadow-lg shadow-indigo-600/20">
                  <FileText size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-800 dark:text-white">اختيار عقد</h3>
                  <p className="text-xs text-slate-500">بحث: الكود الداخلي، الرقم الوطني، اسم المالك/المستأجر، رقم العقد</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-full transition text-slate-500 hover:text-red-500"
              >
                <X size={24} />
              </button>
            </div>

            {/* Search */}
            <div className="p-4 bg-white dark:bg-slate-800 border-b border-gray-100 dark:border-slate-700">
              <div className="relative">
                <input
                  autoFocus
                  type="text"
                  placeholder="بحث سريع..."
                  className="w-full pl-4 pr-12 py-3 bg-slate-50/70 dark:bg-slate-950/30 border border-slate-200/80 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/35 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-950 transition text-sm"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
                <Search className="absolute right-4 top-3 text-gray-400" size={20} />
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-slate-900/50 p-2">
              {isLoading ? (
                <div className="p-4 text-center text-slate-500 text-sm">جاري التحميل...</div>
              ) : null}
              {(!isLoading && rows.length === 0) ? (
                <div className="flex flex-col items-center justify-center h-48 text-slate-400">
                  <Search size={40} className="mb-2 opacity-50" />
                  <p>لا توجد نتائج مطابقة</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {rows.map((r, idx) => {
                    const c = r.contract;
                    const isSelected = value === c.رقم_العقد;
                    return (
                      <div
                        key={`${c.رقم_العقد}_${idx}`}
                        onClick={() => handleSelect(c)}
                        className={
                          `bg-white dark:bg-slate-800 p-3 rounded-xl border cursor-pointer transition shadow-sm flex flex-col gap-2 ` +
                          (isSelected
                            ? 'border-indigo-500 ring-2 ring-indigo-200/60 dark:ring-indigo-500/20'
                            : 'border-slate-200/70 dark:border-slate-800 hover:border-indigo-400/70 dark:hover:border-indigo-400/30')
                        }
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-slate-800 dark:text-white">عقد #<span dir="ltr" className="font-mono break-all">{formatContractNumberShort(c.رقم_العقد)}</span></span>
                              <StatusBadge status={c.حالة_العقد} className="scale-90 origin-right" />
                              {r.propertyCode ? (
                                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">• {r.propertyCode}</span>
                              ) : null}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex flex-wrap gap-x-3 gap-y-1">
                              <span>المالك: {r.ownerName || '-'}</span>
                              <span>المستأجر: {r.tenantName || '-'}</span>
                              <span>النهاية: {formatDateYMD(c.تاريخ_النهاية)}</span>
                            </div>
                          </div>

                          {onOpenContract ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenContract(c.رقم_العقد);
                              }}
                              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700/50"
                            >
                              <ExternalLink size={14} /> فتح
                            </button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
