
import React, { useState, useEffect, useMemo } from 'react';
import { Search, Plus, X, User, Phone, Activity, Check, Filter, ChevronDown, UserPlus } from 'lucide-react';
import { DbService } from '@/services/mockDb';
import { الأشخاص_tbl, PersonRole } from '@/types';
import { useToast } from '@/context/ToastContext';
import { domainGetSmart, domainSearchSmart } from '@/services/domainQueries';

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
  
  // Modal State
  const [searchTerm, setSearchTerm] = useState('');
  const [activeRoleFilter, setActiveRoleFilter] = useState<PersonRole | 'All'>('All');
  const [peopleList, setPeopleList] = useState<الأشخاص_tbl[]>([]);
  const [view, setView] = useState<'list' | 'add'>('list');
    const [unlinkedFirst, setUnlinkedFirst] = useState(false);

  // New Person Form
  const [newPersonForm, setNewPersonForm] = useState({
    الاسم: '',
    الرقم_الوطني: '',
    رقم_الهاتف: '',
    العنوان: '',
    ملاحظات: ''
  });

  const toast = useToast();

    // Load initial selected person details (avoid loading full people list on Desktop)
    useEffect(() => {
        let alive = true;
        const run = async () => {
            if (!value) {
                if (alive) setSelectedPerson(null);
                return;
            }

            const person = (await domainGetSmart('people', value)) as any;
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
            const items = (await domainSearchSmart('people', q, 200)) as any[];
            setPeopleList(Array.isArray(items) ? (items as any) : []);
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
    setIsOpen(true);
        void refreshPeople('');
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

    const linkedPersonIds = useMemo(() => {
        if (!isOpen || !enableUnlinkedFirst) return new Set<string>();
        const ids = new Set<string>();
        try {
            const props = DbService.getProperties?.() || [];
            for (const p of props as any[]) {
                if (p?.رقم_المالك) ids.add(String(p.رقم_المالك));
            }

            const contracts = DbService.getContracts?.() || [];
            for (const c of contracts as any[]) {
                if (c?.رقم_المستاجر) ids.add(String(c.رقم_المستاجر));
                if (c?.رقم_الكفيل) ids.add(String(c.رقم_الكفيل));
            }
        } catch {
            // If anything goes wrong, just treat everyone as "unknown" linkage.
        }
        return ids;
    }, [isOpen, enableUnlinkedFirst]);

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
                const aLinked = linkedPersonIds.has(String(a.رقم_الشخص));
                const bLinked = linkedPersonIds.has(String(b.رقم_الشخص));
                if (aLinked !== bLinked) return aLinked ? 1 : -1;
                return String(a.الاسم || '').localeCompare(String(b.الاسم || ''), 'ar', { numeric: true, sensitivity: 'base' });
            });
        }

    return result;
    }, [peopleList, searchTerm, activeRoleFilter, enableUnlinkedFirst, unlinkedFirst, linkedPersonIds]);

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
    const roles: PersonRole[] = defaultRole ? [defaultRole] : ['مستأجر']; 

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
                <span className={`font-bold whitespace-normal break-words ${selectedPerson ? 'text-slate-800 dark:text-white' : 'text-slate-400'}`}>
                    {selectedPerson ? selectedPerson.الاسم : placeholder}
                </span>
                {selectedPerson && (
                    <span className="text-[10px] text-slate-500 flex flex-wrap items-start gap-2">
                        <span className="whitespace-normal break-words">{selectedPerson.رقم_الهاتف}</span>
                        {selectedPerson.الرقم_الوطني && <span className="whitespace-normal break-words">| {selectedPerson.الرقم_الوطني}</span>}
                    </span>
                )}
            </div>
        </div>
        <ChevronDown size={16} className="text-slate-400" />
      </div>

      {/* MODAL */}
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200/80 dark:border-slate-800 ring-1 ring-black/5 dark:ring-white/5 flex flex-col max-h-[85vh] animate-scale-up overflow-hidden">
                
                {/* Header */}
                <div className="p-4 border-b border-slate-200/70 dark:border-slate-800 flex justify-between items-center bg-slate-50/70 dark:bg-slate-950/30">
                    <h3 className="font-bold text-lg text-slate-800 dark:text-white flex items-center gap-2">
                        {view === 'list' ? (
                            <> <Search size={20} className="text-indigo-600"/> اختيار شخص </>
                        ) : (
                            <> <UserPlus size={20} className="text-green-600"/> إضافة شخص جديد </>
                        )}
                    </h3>
                    <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-full transition">
                        <X size={20} className="text-slate-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    
                    {/* VIEW: LIST */}
                    {view === 'list' && (
                        <>
                            {/* Search & Filter Bar */}
                            <div className="p-4 space-y-3 bg-white dark:bg-slate-800">
                                <div className="relative">
                                    <input 
                                        autoFocus
                                        type="text" 
                                        placeholder="بحث بالاسم، الهاتف، أو الرقم الوطني..." 
                                        className="w-full pl-4 pr-10 py-3 bg-slate-50/70 dark:bg-slate-950/30 border border-slate-200/80 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/35 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-950 transition"
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                    />
                                    <Search className="absolute right-3 top-3 text-gray-400" size={20} />
                                </div>

                                <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                                    {['All', 'مالك', 'مستأجر', 'كفيل', 'مشتري'].map((role) => (
                                        <button
                                            key={role}
                                            onClick={() => setActiveRoleFilter(role as any)}
                                            className={`px-4 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition border
                                                ${activeRoleFilter === role 
                                                    ? 'bg-indigo-600 text-white border-indigo-600' 
                                                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200/80 dark:border-slate-700 hover:bg-slate-50/70 dark:hover:bg-slate-800/60'
                                                }
                                            `}
                                        >
                                            {role === 'All' ? 'الكل' : role}
                                        </button>
                                    ))}

                                    {enableUnlinkedFirst && (
                                        <button
                                            onClick={() => setUnlinkedFirst(v => !v)}
                                            className={`px-4 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition border flex items-center gap-1
                                                ${unlinkedFirst
                                                    ? 'bg-indigo-600 text-white border-indigo-600'
                                                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200/80 dark:border-slate-700 hover:bg-slate-50/70 dark:hover:bg-slate-800/60'
                                                }
                                            `}
                                            title="ترتيب الأشخاص غير المرتبطين بعقود/عقارات في الأعلى"
                                            type="button"
                                        >
                                            <Filter size={12} /> غير مرتبطين أولاً
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* List */}
                            <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-slate-900/50 p-2">
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
                                            onClick={() => setView('add')}
                                            className="mt-4 text-indigo-600 font-bold hover:underline"
                                        >
                                            إضافة "{searchTerm}" كشخص جديد؟
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {filteredPeople.map(p => {
                                            const roles = DbService.getPersonRoles(p.رقم_الشخص);
                                            return (
                                                <div 
                                                    key={p.رقم_الشخص}
                                                    onClick={() => handleSelect(p)}
                                                    className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/70 dark:border-slate-800 hover:border-indigo-400/70 dark:hover:border-indigo-400/30 cursor-pointer transition shadow-sm flex justify-between items-center group"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500 font-bold">
                                                            {p.الاسم.charAt(0)}
                                                        </div>
                                                        <div>
                                                            <h4 className="font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition">{p.الاسم}</h4>
                                                            <div className="flex items-center gap-3 text-xs text-slate-500">
                                                                <span className="flex items-center gap-1"><Phone size={10}/> {p.رقم_الهاتف}</span>
                                                                <span className="flex items-center gap-1"><Activity size={10}/> {p.الرقم_الوطني || '-'}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="flex flex-col items-end gap-2">
                                                        <div className="flex gap-1">
                                                            {roles.map(r => (
                                                                <span key={r} className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getRoleBadgeColor(r)}`}>
                                                                    {r}
                                                                </span>
                                                            ))}
                                                        </div>
                                                        {value === p.رقم_الشخص && <Check size={16} className="text-indigo-600 dark:text-indigo-300" />}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Footer Action */}
                            <div className="p-4 border-t border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800">
                                <button 
                                    onClick={() => setView('add')}
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
                                    سيتم إضافة الشخص الجديد بالدور: <span className="font-bold">{defaultRole || 'عام'}</span>. يمكنك تعديل الأدوار لاحقاً من إدارة الأشخاص.
                                </div>

                                <div>
                                    <label className="block text-sm font-bold mb-1">الاسم الكامل <span className="text-red-500">*</span></label>
                                    <input required className="w-full border p-3 rounded-xl bg-gray-50 dark:bg-slate-900 dark:border-slate-600" 
                                        value={newPersonForm.الاسم} onChange={e => setNewPersonForm({...newPersonForm, الاسم: e.target.value})} />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold mb-1">رقم الهاتف <span className="text-red-500">*</span></label>
                                        <input required className="w-full border p-3 rounded-xl bg-gray-50 dark:bg-slate-900 dark:border-slate-600" 
                                            value={newPersonForm.رقم_الهاتف} onChange={e => setNewPersonForm({...newPersonForm, رقم_الهاتف: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold mb-1">الرقم الوطني</label>
                                        <input className="w-full border p-3 rounded-xl bg-gray-50 dark:bg-slate-900 dark:border-slate-600" 
                                            value={newPersonForm.الرقم_الوطني} onChange={e => setNewPersonForm({...newPersonForm, الرقم_الوطني: e.target.value})} />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold mb-1">العنوان</label>
                                    <input className="w-full border p-3 rounded-xl bg-gray-50 dark:bg-slate-900 dark:border-slate-600" 
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
        </div>
      )}
    </div>
  );
};
