import React, { useState, useEffect } from 'react';
import { useTabs } from '@/context/TabsContext';
import { NAV_ITEMS } from '@/routes/registry';
import { X, Search, LayoutGrid, LucideIcon } from 'lucide-react';

interface NavItem {
    path: string;
    label: string;
    icon: LucideIcon;
    children?: NavItem[];
}

export const PageSelector: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const { openTab } = useTabs();

    useEffect(() => {
        const handler = () => setIsOpen(true);
        window.addEventListener('azrar:open-page-selector', handler);
        return () => window.removeEventListener('azrar:open-page-selector', handler);
    }, []);

    // Also close on Escape
    useEffect(() => {
        if (!isOpen) return;
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setIsOpen(false);
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isOpen]);

    if (!isOpen) return null;

    // Flatten NAV_ITEMS to get all clickable pages
    const allPages: { path: string; label: string; icon: LucideIcon }[] = [];
    const collect = (items: NavItem[]) => {
        items.forEach(item => {
            if (item.path && item.path.startsWith('/')) {
                allPages.push({ path: item.path, label: item.label, icon: item.icon });
            }
            if (item.children) collect(item.children);
        });
    };
    collect(NAV_ITEMS);

    const filtered = allPages.filter(p => 
        p.label.includes(search) || p.path.includes(search.toLowerCase())
    );

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 lg:p-12 bg-slate-950/80 backdrop-blur-xl animate-fade-in">
            <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-[2.5rem] shadow-2xl border border-white/10 overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-300">
                {/* Header Section */}
                <div className="p-8 pb-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-600/30">
                            <LayoutGrid size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-800 dark:text-white">قائمة الوصول السريع</h2>
                            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest">Open Any Module Instantly</p>
                        </div>
                    </div>
                    <button 
                        onClick={() => setIsOpen(false)}
                        className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Search Bar */}
                <div className="px-8 py-4">
                    <div className="relative group">
                        <div className="absolute inset-y-0 right-5 flex items-center text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                            <Search size={22} strokeWidth={2.5} />
                        </div>
                        <input 
                            autoFocus
                            type="text"
                            placeholder="ابحث عن صفحة بالاسم أو المسار..."
                            className="w-full h-16 pr-14 pl-6 bg-slate-100 dark:bg-slate-800/80 border-2 border-transparent focus:border-indigo-500/50 rounded-2xl text-lg font-bold text-slate-800 dark:text-white transition-all shadow-inner placeholder:text-slate-400"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>

                {/* Grid Content */}
                <div className="flex-1 overflow-y-auto p-8 pt-4 custom-scrollbar">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pb-8">
                        {filtered.map(page => {
                            const Icon = page.icon;
                            return (
                                <button
                                    key={page.path}
                                    onClick={() => {
                                        openTab(page.path, page.label, '📄');
                                        setIsOpen(false);
                                        setSearch('');
                                    }}
                                    className="group flex flex-col items-center gap-4 p-5 rounded-[2rem] bg-slate-50 dark:bg-slate-800/40 hover:bg-white dark:hover:bg-indigo-600/10 border border-slate-100 dark:border-slate-800 hover:border-indigo-500/30 hover:shadow-2xl hover:shadow-indigo-500/10 transition-all duration-300 text-center active:scale-95"
                                >
                                    <div className="w-16 h-16 flex items-center justify-center bg-white dark:bg-slate-800 rounded-2xl shadow-sm text-slate-500 dark:text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:scale-110 transition-all duration-300">
                                        <Icon size={32} strokeWidth={1.5} />
                                    </div>
                                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300 group-hover:text-indigo-700 dark:group-hover:text-white transition-colors">
                                        {page.label}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {filtered.length === 0 && (
                        <div className="p-20 text-center flex flex-col items-center gap-6 text-slate-400">
                            <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center opacity-50">
                                <Search size={40} />
                            </div>
                            <div>
                                <p className="text-xl font-black text-slate-300 dark:text-slate-700">لا توجد نتائج</p>
                                <p className="text-[11px] font-bold uppercase tracking-tighter opacity-50">Try searching for something else</p>
                            </div>
                        </div>
                    )}
                </div>
                
                {/* Footer hints */}
                <div className="px-8 py-4 bg-slate-50/50 dark:bg-slate-950/20 text-center border-t border-slate-100 dark:border-slate-800">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        Press <kbd className="px-1.5 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500">ESC</kbd> to close &bull; Click any page to open in a new tab
                    </p>
                </div>
            </div>
        </div>
    );
};
