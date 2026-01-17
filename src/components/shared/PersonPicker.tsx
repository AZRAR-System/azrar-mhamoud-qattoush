
import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Search, Plus, X, User, Phone, Activity, Check, Filter, ChevronDown, UserPlus, FileText } from 'lucide-react';
import { DbService } from '@/services/mockDb';
import { الأشخاص_tbl, PersonRole } from '@/types';
import { useToast } from '@/context/ToastContext';
import { domainGetSmart, domainSearchSmart } from '@/services/domainQueries';

type UnknownRecord = Record<string, unknown>;
const isRecord = (value: unknown): value is UnknownRecord => typeof value === 'object' && value !== null;

interface PersonPickerProps {
  label?: string;
  value?: string;
  onChange: (personId: string, personObj?: الأشخاص_tbl) => void;
  required?: boolean;
  defaultRole?: PersonRole; // The role to filter by default, or assign when adding
    initialRoleFilter?: PersonRole | 'All'; // Which role tab is selected when opening (defaults to defaultRole)
  placeholder?: string;
  disabled?: boolean;
    enableUnlinkedFirst?: boolean;
    unlinkedFirstByDefault?: boolean;
}

export const PersonPicker: React.FC<PersonPickerProps> = ({
  label,
  value,
  onChange,
  required = false,
  defaultRole,
    initialRoleFilter,
  placeholder = "اختر الشخص...",
    disabled = false,
    enableUnlinkedFirst = false,
    unlinkedFirstByDefault = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<الأشخاص_tbl | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const isRtl = typeof document !== 'undefined' && document?.documentElement?.dir === 'rtl';
  
  // Modal State
  const [searchTerm, setSearchTerm] = useState('');
  const [activeRoleFilter, setActiveRoleFilter] = useState<PersonRole | 'All'>('All');
  const [peopleList, setPeopleList] = useState<الأشخاص_tbl[]>([]);
  const [view, setView] = useState<'list' | 'add'>('list');
    const [unlinkedFirst, setUnlinkedFirst] = useState(false);
        const [linkedOnly, setLinkedOnly] = useState(true);

  // New Person Form
  const [newPersonForm, setNewPersonForm] = useState({
    الاسم: '',
    الرقم_الوطني: '',
    رقم_الهاتف: '',
    العنوان: '',
    ملاحظات: ''
  });

    const [newPersonRole, setNewPersonRole] = useState<PersonRole>(defaultRole ?? 'مستأجر');

  const toast = useToast();

    // Load initial selected person details (avoid loading full people list on Desktop)
    useEffect(() => {
        let alive = true;
        const run = async () => {
            if (!value) {
                if (alive) setSelectedPerson(null);
                return;
            }

            const person = (await domainGetSmart('people', value)) as unknown;
            if (!alive) return;
            setSelectedPerson((person as الأشخاص_tbl) || null);
        };
        void run();
        return () => {
            alive = false;
        };
    }, [value]);

    const refreshPeople = async (q: string) => {
        setIsLoading(true);
        try {
            const items = (await domainSearchSmart('people', q, 200)) as unknown;
            setPeopleList(Array.isArray(items) ? (items as الأشخاص_tbl[]) : []);
        } finally {
            setIsLoading(false);
        }
    };

    // Open handler: Load data
    const handleOpen = () => {
    if (disabled) return;
                setActiveRoleFilter(initialRoleFilter ?? defaultRole ?? 'All');
    setSearchTerm('');
    setView('list');
        setUnlinkedFirst(!!unlinkedFirstByDefault);
        setLinkedOnly(true);
    setIsOpen(true);
        void refreshPeople('');
  };

    const openAddView = () => {
        const nextRole: PersonRole = defaultRole ?? (activeRoleFilter !== 'All' ? activeRoleFilter : 'مستأجر');
        setNewPersonRole(nextRole);
        setView('add');
    };

    // Desktop-friendly: fetch a limited list for the current query instead of filtering a 200k array.
    useEffect(() => {
        if (!isOpen) return;
        if (view !== 'list') return;

        let alive = true;
        const timer = setTimeout(async () => {
            if (!alive) return;
            await refreshPeople(searchTerm);
        }, 200);

        return () => {
            alive = false;
            clearTimeout(timer);
        };
    }, [isOpen, view, searchTerm]);

    const linkSets = useMemo(() => {
        const empty = {
            all: new Set<string>(),
            owner: new Set<string>(),
            tenant: new Set<string>(),
            guarantor: new Set<string>(),
            buyer: new Set<string>(),
            contract: new Set<string>(),
        };
        if (!isOpen) return empty;
        try {
            const props = DbService.getProperties?.() || [];
            const ownerByPropertyId = new Map<string, string>();
            for (const p of props as unknown[]) {
                if (!isRecord(p)) continue;
                const pid = String(p['رقم_العقار'] ?? '').trim();
                const ownerId = String(p['رقم_المالك'] ?? '').trim();
                if (ownerId) empty.owner.add(ownerId);
                if (pid && ownerId) ownerByPropertyId.set(pid, ownerId);
            }

            const contracts = DbService.getContracts?.() || [];
            for (const c of contracts as unknown[]) {
                if (!isRecord(c)) continue;
                const tenantId = c['رقم_المستاجر'];
                const guarantorId = c['رقم_الكفيل'];
                if (tenantId) empty.tenant.add(String(tenantId));
                if (guarantorId) empty.guarantor.add(String(guarantorId));
                if (tenantId) empty.contract.add(String(tenantId));
                if (guarantorId) empty.contract.add(String(guarantorId));

                const propertyId = String(c['رقم_العقار'] ?? '').trim();
                if (propertyId) {
                    const ownerId = ownerByPropertyId.get(propertyId);
                    if (ownerId) empty.contract.add(ownerId);
                }
            }

            const salesDb = DbService as unknown as {
                getSalesListings?: () => unknown;
                getSalesAgreements?: () => unknown;
            };

            const listingsRaw = salesDb.getSalesListings?.() || [];
            const listings = Array.isArray(listingsRaw) ? listingsRaw : [];
            for (const l of listings) {
                if (!isRecord(l)) continue;
                const sellerId = l['رقم_المالك'];
                if (sellerId) empty.owner.add(String(sellerId));
            }

            const agreementsRaw = salesDb.getSalesAgreements?.() || [];
            const agreements = Array.isArray(agreementsRaw) ? agreementsRaw : [];
            for (const a of agreements) {
                if (!isRecord(a)) continue;
                const buyerId = a['رقم_المشتري'];
                const sellerId = a['رقم_البائع'];
                if (buyerId) empty.buyer.add(String(buyerId));
                if (sellerId) empty.owner.add(String(sellerId));
            }
        } catch {
            // If anything goes wrong, keep sets empty.
        }

        for (const id of empty.owner) empty.all.add(id);
        for (const id of empty.tenant) empty.all.add(id);
        for (const id of empty.guarantor) empty.all.add(id);
        for (const id of empty.buyer) empty.all.add(id);
        for (const id of empty.contract) empty.all.add(id);

        return empty;
    }, [isOpen]);

  // Search & Filter Logic
  const filteredPeople = useMemo(() => {
    let result = peopleList;

    // 1. Role Filter
    if (activeRoleFilter !== 'All') {
      result = result.filter(p => {
        const roles = DbService.getPersonRoles(p.رقم_الشخص);
        return roles.includes(activeRoleFilter);
      });
    }

                // 1.5 Linked-only smart filter (when role is selected)
                if (activeRoleFilter !== 'All' && linkedOnly) {
                        const wanted =
                                activeRoleFilter === 'مالك'
                                        ? linkSets.owner
                                        : activeRoleFilter === 'مستأجر'
                                            ? linkSets.tenant
                                            : activeRoleFilter === 'كفيل'
                                                ? linkSets.guarantor
                                                : activeRoleFilter === 'مشتري'
                                                    ? linkSets.buyer
                                                                    : linkSets.all;

                        result = result.filter((p) => {
                                const pid = String(p.رقم_الشخص);
                                if (value && pid === String(value)) return true;
                                // If we can't determine linkage yet, don't hide everything.
                                if (wanted.size === 0 && linkSets.all.size === 0) return true;
                                return wanted.size ? wanted.has(pid) : linkSets.all.has(pid);
                        });
                }

        // 2. Search Text
        // NOTE: When on Desktop, we already fetch a filtered list via SQL; this is a lightweight extra filter.
        if (searchTerm.trim()) {
            const lowerTerm = searchTerm.toLowerCase();
            result = result.filter(p =>
                String(p.الاسم || '').toLowerCase().includes(lowerTerm) ||
                String(p.رقم_الهاتف || '').includes(lowerTerm) ||
                String(p.الرقم_الوطني || '').includes(lowerTerm)
            );
        }

        if (enableUnlinkedFirst && unlinkedFirst) {
            result = [...result].sort((a, b) => {
                const aLinked = linkSets.all.has(String(a.رقم_الشخص));
                const bLinked = linkSets.all.has(String(b.رقم_الشخص));
                if (aLinked !== bLinked) return aLinked ? 1 : -1;
                return String(a.الاسم || '').localeCompare(String(b.الاسم || ''), 'ar', { numeric: true, sensitivity: 'base' });
            });
        }

    return result;
    }, [peopleList, searchTerm, activeRoleFilter, enableUnlinkedFirst, unlinkedFirst, linkedOnly, linkSets, value]);

  const handleSelect = (person: الأشخاص_tbl) => {
    setSelectedPerson(person);
    onChange(person.رقم_الشخص, person);
    setIsOpen(false);
  };

  const handleAddPerson = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPersonForm.الاسم || !newPersonForm.رقم_الهاتف) {
        toast.warning('الاسم ورقم الهاتف حقول إجبارية');
        return;
    }

    // Determine roles: Default role is mandatory, others optional
        const roles: PersonRole[] = [newPersonRole];

    const res = DbService.addPerson(newPersonForm, roles);
    if (res.success && res.data) {
        toast.success('تمت إضافة الشخص واختياره بنجاح');
        handleSelect(res.data); // Auto select and close
        // Reset form
        setNewPersonForm({ الاسم: '', الرقم_الوطني: '', رقم_الهاتف: '', العنوان: '', ملاحظات: '' });
    } else {
        toast.error(res.message);
    }
  };

  const getRoleBadgeColor = (role: string) => {
      switch(role) {
          case 'مالك': return 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-500/10 dark:text-purple-300 dark:border-purple-500/20';
          case 'مستأجر': return 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-300 dark:border-indigo-500/20';
          case 'كفيل': return 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-500/10 dark:text-orange-300 dark:border-orange-500/20';
          case 'مشتري': return 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20';
          default: return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700';
      }
  };

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}

      {/* Trigger Input */}
      <div 
        onClick={handleOpen}
        className={`
            relative w-full bg-white dark:bg-slate-900 border text-sm rounded-xl p-3 flex items-center justify-between cursor-pointer transition-all hover:border-indigo-400/70
            ${disabled ? 'opacity-60 cursor-not-allowed bg-slate-100 dark:bg-slate-800/60' : ''}
            ${value ? 'border-indigo-200/70 dark:border-slate-700' : 'border-slate-200/80 dark:border-slate-700'}
        `}
      >
        <div className="flex items-center gap-3 min-w-0">
            <div className={`p-1.5 rounded-full ${selectedPerson ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300' : 'bg-slate-100 text-slate-400 dark:bg-slate-800/60 dark:text-slate-500'}`}>
                <User size={16} />
            </div>
            <div className="flex flex-col min-w-0">
                <span className={`font-bold whitespace-normal break-words ${selectedPerson ? 'text-slate-800 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>
                    {selectedPerson ? selectedPerson.الاسم : placeholder}
                </span>
                {selectedPerson && (
                    <span className="text-[10px] text-slate-500 flex flex-wrap items-start gap-2">
                        <span className="whitespace-normal break-words dir-ltr font-mono tabular-nums">{selectedPerson.رقم_الهاتف}</span>
                        {selectedPerson.الرقم_الوطني && <span className="whitespace-normal break-words">| {selectedPerson.الرقم_الوطني}</span>}
                    </span>
                )}
            </div>
        </div>
        <ChevronDown size={16} className="text-slate-400" />
      </div>

            {/* MODAL (Portal to avoid nested-modal clipping) */}
            {isOpen &&
                (typeof document !== 'undefined'
                    ? createPortal(
                            <div
                                className="modal-overlay app-modal-overlay animate-fade-in"
                                role="dialog"
                                aria-modal="true"
                                onClick={() => setIsOpen(false)}
                            >
                                <div
                                    className="modal-content app-modal-content dark:bg-slate-900 dark:border-slate-800 w-full max-w-4xl flex flex-col max-h-[85vh] animate-scale-up overflow-hidden"
                                    onClick={(e) => e.stopPropagation()}
                                >
                
                {/* Header */}
                                <div className="p-5 border-b border-slate-200/70 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/30 flex justify-between items-center">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 text-white rounded-lg shadow-lg ${view === 'list' ? 'bg-indigo-600 shadow-indigo-600/20' : 'bg-emerald-600 shadow-emerald-600/20'}`}>
                                                {view === 'list' ? <User size={22} /> : <UserPlus size={22} />}
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-lg text-slate-800 dark:text-white">
                                                    {view === 'list' ? 'اختيار شخص' : 'إضافة شخص جديد'}
                                                </h3>
                                                <p className="text-xs text-slate-500">
                                                    {view === 'list'
                                                        ? 'ابحث واختر الشخص المناسب للعملية'
                                                        : 'أدخل البيانات الأساسية ثم احفظ واختيار'}
                                                </p>
                                            </div>
                                        </div>
                    <button
                      type="button"
                      onClick={() => setIsOpen(false)}
                      className="p-2 hover:bg-slate-200/70 dark:hover:bg-slate-800/60 rounded-full transition text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400"
                    >
                        <X size={22} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    
                    {/* VIEW: LIST */}
                    {view === 'list' && (
                        <>
                            {/* Search & Filter Bar */}
                                                        <div className="p-4 space-y-4 bg-white dark:bg-slate-900 border-b border-slate-200/70 dark:border-slate-800">
                                                            <div
                                                                className={`flex flex-col gap-3 sm:items-center ${
                                                                    isRtl ? 'sm:flex-row-reverse' : 'sm:flex-row'
                                                                }`}
                                                            >
                                                                <div className="relative flex-1 min-w-0">
                                                                    <input
                                                                        autoFocus
                                                                        type="text"
                                                                        placeholder="بحث: الاسم، الهاتف، أو الرقم الوطني..."
                                                                        dir={isRtl ? 'rtl' : 'ltr'}
                                                                        className={`w-full py-3 bg-slate-50/70 dark:bg-slate-950/30 border border-slate-200/80 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/35 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-950 transition text-sm text-slate-900 dark:text-white placeholder-slate-400 ${isRtl ? 'pr-4 pl-12 text-right' : 'pl-4 pr-12 text-left'}`}
                                                                        value={searchTerm}
                                                                        onChange={(e) => setSearchTerm(e.target.value)}
                                                                    />
                                                                    <Search className={`absolute top-3 text-gray-400 ${isRtl ? 'left-4' : 'right-4'}`} size={20} />
                                                                </div>

                                                                <div
                                                                    className={`flex items-center gap-2 flex-nowrap overflow-x-auto custom-scrollbar pb-0.5 ${
                                                                        isRtl ? 'sm:justify-start' : 'sm:justify-end'
                                                                    }`}
                                                                >
                                                                    <select
                                                                        className="h-[46px] min-w-[140px] px-4 py-3 bg-slate-50/70 dark:bg-slate-950/30 border border-slate-200/80 dark:border-slate-800 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/35 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-950 text-slate-900 dark:text-white"
                                                                        value={activeRoleFilter}
                                                                        onChange={(e) => {
                                                                            const next = e.target.value;
                                                                            if (
                                                                                next === 'All' ||
                                                                                next === 'مالك' ||
                                                                                next === 'مستأجر' ||
                                                                                next === 'كفيل' ||
                                                                                next === 'مشتري'
                                                                            ) {
                                                                                setActiveRoleFilter(next);
                                                                            } else {
                                                                                setActiveRoleFilter('All');
                                                                            }
                                                                        }}
                                                                    >
                                                                        <option value="All">كل الأدوار</option>
                                                                        <option value="مالك">مالك</option>
                                                                        <option value="مستأجر">مستأجر</option>
                                                                        <option value="كفيل">كفيل</option>
                                                                        <option value="مشتري">مشتري</option>
                                                                    </select>

                                                                    {activeRoleFilter !== 'All' ? (
                                                                        <button
                                                                            onClick={() => setLinkedOnly((v) => !v)}
                                                                            className={`h-[46px] px-4 py-3 rounded-xl text-sm font-bold whitespace-nowrap transition border flex items-center gap-2
                                                                                ${linkedOnly
                                                                                    ? 'bg-indigo-600 text-white border-indigo-600'
                                                                                    : 'bg-slate-50/70 dark:bg-slate-950/30 text-slate-700 dark:text-slate-300 border-slate-200/80 dark:border-slate-800 hover:bg-slate-100/70 dark:hover:bg-slate-800/60'
                                                                                }
                                                                            `}
                                                                            title={linkedOnly ? 'إخفاء غير المرتبطين' : 'إظهار غير المرتبطين'}
                                                                            type="button"
                                                                        >
                                                                            <Filter size={14} />
                                                                            مرتبطين فقط
                                                                        </button>
                                                                    ) : null}

                                                                    {enableUnlinkedFirst ? (
                                                                        <button
                                                                            onClick={() => setUnlinkedFirst((v) => !v)}
                                                                            className={`h-[46px] px-4 py-3 rounded-xl text-sm font-bold whitespace-nowrap transition border flex items-center gap-2
                                                                                ${unlinkedFirst
                                                                                    ? 'bg-indigo-600 text-white border-indigo-600'
                                                                                    : 'bg-slate-50/70 dark:bg-slate-950/30 text-slate-700 dark:text-slate-300 border-slate-200/80 dark:border-slate-800 hover:bg-slate-100/70 dark:hover:bg-slate-800/60'
                                                                                }
                                                                            `}
                                                                            title="ترتيب الأشخاص غير المرتبطين بعقود/عقارات في الأعلى"
                                                                            type="button"
                                                                        >
                                                                            <Filter size={14} />
                                                                            غير مرتبطين
                                                                        </button>
                                                                    ) : null}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* List */}
                                                        <div className="flex-1 overflow-auto bg-slate-50/60 dark:bg-slate-950/20 custom-scrollbar">
                                {isLoading ? (
                                    <div className="px-3 py-2 text-xs font-bold text-slate-500 dark:text-slate-400">
                                        جاري التحميل...
                                    </div>
                                ) : null}
                                {filteredPeople.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-48 text-slate-400">
                                        <Search size={40} className="mb-2 opacity-50"/>
                                        <p>لا توجد نتائج مطابقة</p>
                                        <button 
                                                                                        type="button"
                                            onClick={openAddView}
                                            className="mt-4 text-indigo-600 font-bold hover:underline"
                                        >
                                            إضافة "{searchTerm}" كشخص جديد؟
                                        </button>
                                    </div>
                                ) : (
                                                                    <table
                                                                        dir={isRtl ? 'rtl' : 'ltr'}
                                                                        className="w-full text-right border-collapse table-fixed"
                                                                    >
                                                                        <colgroup>
                                                                            <col style={{ width: '44%' }} />
                                                                            <col style={{ width: '18%' }} />
                                                                            <col style={{ width: '18%' }} />
                                                                            <col style={{ width: '16%' }} />
                                                                            <col style={{ width: '4%' }} />
                                                                        </colgroup>
                                                                    <thead className="bg-slate-100/70 dark:bg-slate-950/40 text-slate-600 dark:text-slate-300 text-xs font-bold sticky top-0 z-10 shadow-sm whitespace-nowrap [overflow-wrap:normal] [word-break:normal]">
                                                                            <tr>
                                                                    <th className="px-4 py-3 whitespace-nowrap">الاسم</th>
                                                                        <th className="px-4 py-3 whitespace-nowrap text-center">الهاتف</th>
                                                                        <th className="px-4 py-3 whitespace-nowrap text-center hidden md:table-cell">الرقم الوطني</th>
                                                                                            <th className="px-4 py-3 whitespace-nowrap text-center">الأدوار</th>
                                                                        <th className="px-4 py-3"></th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                                                                            {filteredPeople.map((p) => {
                                                                                const roles = DbService.getPersonRoles(p.رقم_الشخص);
                                                                                const isContractLinked = linkSets.contract.has(String(p.رقم_الشخص));
                                                                                return (
                                                                                    <tr
                                                                                        key={p.رقم_الشخص}
                                                                                        onClick={() => handleSelect(p)}
                                                                                        className={`group bg-white dark:bg-slate-900 hover:bg-indigo-50/70 dark:hover:bg-indigo-500/10 cursor-pointer transition
                                                                                            ${value === p.رقم_الشخص ? 'bg-indigo-50/70 dark:bg-indigo-500/10' : ''}
                                                                                        `}
                                                                                    >
                                                                                        <td className="px-4 py-3">
                                                                                            <div className="flex items-center gap-3 min-w-0">
                                                                                                <div className={`w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800/60 flex items-center justify-center text-slate-600 dark:text-slate-300 font-bold flex-shrink-0 ${isContractLinked ? 'ring-2 ring-emerald-400/60 dark:ring-emerald-400/40' : ''}`}>
                                                                                                    {String(p.الاسم || '').trim().charAt(0) || '؟'}
                                                                                                </div>
                                                                                                <div className="min-w-0">
                                                                                                    <div className="font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition whitespace-normal break-words">
                                                                                                        {p.الاسم}
                                                                                                    </div>
                                                                                                    {isContractLinked ? (
                                                                                                        <div className="mt-1 flex justify-end">
                                                                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border whitespace-nowrap bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20">
                                                                                                                <FileText size={12} className="opacity-80" />
                                                                                                                مرتبط بعقد
                                                                                                            </span>
                                                                                                        </div>
                                                                                                    ) : null}
                                                                                                    {p.العنوان ? (
                                                                                                        <div className="text-[11px] text-slate-500 dark:text-slate-400 whitespace-normal break-words line-clamp-1">
                                                                                                            {p.العنوان}
                                                                                                        </div>
                                                                                                    ) : null}
                                                                                                </div>
                                                                                            </div>
                                                                                        </td>

                                                                                        <td className="px-4 py-3 text-center">
                                                                                            <div className="text-xs text-slate-600 dark:text-slate-300 font-mono tabular-nums dir-ltr whitespace-nowrap flex items-center justify-center gap-2">
                                                                                                <Phone size={12} className="opacity-70" />
                                                                                                <span>{p.رقم_الهاتف || '—'}</span>
                                                                                            </div>
                                                                                        </td>

                                                                                        <td className="px-4 py-3 text-center hidden md:table-cell">
                                                                                            <div className="text-xs text-slate-600 dark:text-slate-300 font-mono tabular-nums whitespace-nowrap flex items-center justify-center gap-2">
                                                                                                <Activity size={12} className="opacity-70" />
                                                                                                <span>{p.الرقم_الوطني || '—'}</span>
                                                                                            </div>
                                                                                        </td>

                                                                                        <td className="px-4 py-3 text-center">
                                                                                            <div className="flex gap-1 flex-wrap justify-center">
                                                                                                {(roles?.length ? roles : ['—']).map((r) => (
                                                                                                    <span key={r} className={`px-2 py-0.5 rounded text-[10px] font-bold border whitespace-nowrap ${getRoleBadgeColor(r)}`}>
                                                                                                        {r}
                                                                                                    </span>
                                                                                                ))}
                                                                                            </div>
                                                                                        </td>

                                                                                        <td className="px-4 py-3 text-center">
                                                                                            {value === p.رقم_الشخص ? (
                                                                                                <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center">
                                                                                                    <Check size={16} />
                                                                                                </div>
                                                                                            ) : (
                                                                                                <div className="w-8 h-8 rounded-full border-2 border-slate-200 dark:border-slate-700 group-hover:border-indigo-400/70 transition"></div>
                                                                                            )}
                                                                                        </td>
                                                                                    </tr>
                                                                                );
                                                                            })}
                                                                        </tbody>
                                                                    </table>
                                )}
                            </div>

                            {/* Footer Action */}
                            <div className="p-4 border-t border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800">
                                <button 
                                    type="button"
                                    onClick={openAddView}
                                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition shadow-lg shadow-indigo-600/20"
                                >
                                    <Plus size={20} /> إضافة شخص جديد
                                </button>
                            </div>
                        </>
                    )}

                    {/* VIEW: ADD FORM */}
                    {view === 'add' && (
                        <form onSubmit={handleAddPerson} className="flex-1 flex flex-col">
                            <div className="flex-1 overflow-y-auto p-6 space-y-4">
                                <div className="bg-indigo-50/70 dark:bg-indigo-500/10 p-4 rounded-xl text-sm text-indigo-800 dark:text-indigo-300 mb-4 border border-indigo-200/70 dark:border-indigo-500/20">
                                    سيتم إضافة الشخص الجديد بالدور: <span className="font-bold">{newPersonRole}</span>. يمكنك تعديل الأدوار لاحقاً من إدارة الأشخاص.
                                </div>

                                <div>
                                    <label className="block text-sm font-bold mb-1">الدور <span className="text-red-500">*</span></label>
                                    <select
                                        className="w-full border border-slate-200/80 dark:border-slate-800 p-3 rounded-xl bg-gray-50 dark:bg-slate-900 text-sm outline-none focus:ring-2 focus:ring-indigo-500/35 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-950 text-slate-900 dark:text-slate-100"
                                        value={newPersonRole}
                                        onChange={(e) => {
                                            const next = e.target.value;
                                            if (next === 'مالك' || next === 'مستأجر' || next === 'كفيل' || next === 'مشتري') {
                                                setNewPersonRole(next);
                                            }
                                        }}
                                    >
                                        <option value="مالك">مالك</option>
                                        <option value="مستأجر">مستأجر</option>
                                        <option value="كفيل">كفيل</option>
                                        <option value="مشتري">مشتري</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold mb-1">الاسم الكامل <span className="text-red-500">*</span></label>
                                    <input required className="w-full border border-slate-200/80 dark:border-slate-800 p-3 rounded-xl bg-gray-50 dark:bg-slate-900 text-sm outline-none focus:ring-2 focus:ring-indigo-500/35 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-950 text-slate-900 dark:text-slate-100" 
                                        value={newPersonForm.الاسم} onChange={e => setNewPersonForm({...newPersonForm, الاسم: e.target.value})} />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold mb-1">رقم الهاتف <span className="text-red-500">*</span></label>
                                        <input required className="w-full border border-slate-200/80 dark:border-slate-800 p-3 rounded-xl bg-gray-50 dark:bg-slate-900 text-sm outline-none focus:ring-2 focus:ring-indigo-500/35 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-950 text-slate-900 dark:text-slate-100" 
                                            value={newPersonForm.رقم_الهاتف} onChange={e => setNewPersonForm({...newPersonForm, رقم_الهاتف: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold mb-1">الرقم الوطني</label>
                                        <input className="w-full border border-slate-200/80 dark:border-slate-800 p-3 rounded-xl bg-gray-50 dark:bg-slate-900 text-sm outline-none focus:ring-2 focus:ring-indigo-500/35 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-950 text-slate-900 dark:text-slate-100" 
                                            value={newPersonForm.الرقم_الوطني} onChange={e => setNewPersonForm({...newPersonForm, الرقم_الوطني: e.target.value})} />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold mb-1">العنوان</label>
                                    <input className="w-full border border-slate-200/80 dark:border-slate-800 p-3 rounded-xl bg-gray-50 dark:bg-slate-900 text-sm outline-none focus:ring-2 focus:ring-indigo-500/35 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-950 text-slate-900 dark:text-slate-100" 
                                        value={newPersonForm.العنوان} onChange={e => setNewPersonForm({...newPersonForm, العنوان: e.target.value})} />
                                </div>
                            </div>

                            <div className="p-4 border-t border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800 flex gap-3">
                                <button type="button" onClick={() => setView('list')} className="flex-1 py-3 text-slate-600 bg-gray-100 hover:bg-gray-200 rounded-xl font-bold transition">
                                    رجوع للقائمة
                                </button>
                                <button type="submit" className="flex-[2] py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold transition shadow-lg shadow-green-600/20">
                                    حفظ واختيار
                                </button>
                            </div>
                        </form>
                    )}

                </div>
                                </div>
                            </div>,
                            document.body
                        )
                    : null)}
    </div>
  );
};
