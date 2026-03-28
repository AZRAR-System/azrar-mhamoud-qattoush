import { useState, useEffect, useRef, useId } from 'react';
import { Search, User, Home, FileText, ChevronLeft, ArrowRight } from 'lucide-react';
import { useSmartModal } from '@/context/ModalContext';
import { formatContractNumberShort } from '@/utils/contractNumber';
import { domainSearchGlobalSmart } from '@/services/domainQueries';
import { AppModal } from '@/components/ui/AppModal';
import type { الأشخاص_tbl, العقارات_tbl, العقود_tbl } from '@/types';

export const GLOBAL_SEARCH_OPEN_EVENT = 'azrar:global-search:open';

type SearchPersonResult = الأشخاص_tbl & { matchReason?: string };
type SearchPropertyResult = العقارات_tbl & { matchReason?: string };
type SearchContractResult = العقود_tbl & { matchReason?: string };

type GlobalSearchResults = {
  people: SearchPersonResult[];
  properties: SearchPropertyResult[];
  contracts: SearchContractResult[];
};

const EMPTY_RESULTS: GlobalSearchResults = { people: [], properties: [], contracts: [] };

export const GlobalSearch: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GlobalSearchResults>(EMPTY_RESULTS);
  const inputRef = useRef<HTMLInputElement>(null);
  const modalSearchInputId = useId();
  const { openPanel } = useSmartModal();

  // Keyboard Shortcut (Ctrl + K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // External Open Trigger (e.g., Dashboard Quick Actions)
  useEffect(() => {
    const handleOpen: EventListener = () => setIsOpen(true);
    window.addEventListener(GLOBAL_SEARCH_OPEN_EVENT, handleOpen);
    return () => window.removeEventListener(GLOBAL_SEARCH_OPEN_EVENT, handleOpen);
  }, []);

  // Auto-focus when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setQuery('');
      setResults(EMPTY_RESULTS);
    }
  }, [isOpen]);

  // Perform Search
  useEffect(() => {
    let alive = true;
    const timer = setTimeout(async () => {
      const q = String(query || '').trim();
      if (!q) {
        if (alive) setResults(EMPTY_RESULTS);
        return;
      }

      const res = await domainSearchGlobalSmart(q);
      if (!alive) return;
      setResults(res);
    }, 300);

    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [query]);

  function handleSelect(type: string, id: string) {
    setIsOpen(false);
    if (type === 'person') openPanel('PERSON_DETAILS', id);
    if (type === 'property') openPanel('PROPERTY_DETAILS', id);
    if (type === 'contract') openPanel('CONTRACT_DETAILS', id);
  }

  const renderBadge = (matchReason: string) => {
    if (!matchReason || matchReason.includes('مباشرة') || matchReason.includes('رقم العقد'))
      return null;
    return (
      <span className="text-[10px] bg-amber-100/70 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded-lg flex items-center gap-1 border border-amber-200/70 dark:border-amber-500/20">
        <ArrowRight size={10} /> {matchReason}
      </span>
    );
  };

  return (
    <>
      {/* Trigger Button (Visible in Header) */}
      <div
        onClick={() => setIsOpen(true)}
        className="relative hidden xl:block group cursor-pointer"
      >
        <div className="flex items-center justify-between pl-4 pr-3 py-2.5 rounded-full bg-slate-100/80 dark:bg-slate-800/60 border border-transparent hover:border-indigo-300/60 dark:hover:border-indigo-400/20 transition-all w-64">
          <span className="text-sm text-slate-600 dark:text-slate-300">بحث شامل...</span>
          <span className="text-xs bg-white/70 dark:bg-slate-900/40 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded border border-slate-200/70 dark:border-slate-800">
            Ctrl+K
          </span>
        </div>
        <Search
          className="absolute right-4 top-3 text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity"
          size={18}
        />
      </div>

      {/* Mobile Trigger */}
      <button
        onClick={() => setIsOpen(true)}
        className="xl:hidden p-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-slate-800/60 rounded-full"
      >
        <Search size={20} />
      </button>

      {/* Overlay & Modal */}
      {isOpen && (
        <AppModal
          open={isOpen}
          onClose={() => setIsOpen(false)}
          size="2xl"
          hideHeader
          title="بحث شامل"
          initialFocusSelector={`#${modalSearchInputId}`}
          className="items-start pt-20"
          contentClassName="dark:bg-slate-900 dark:border-slate-800"
          bodyClassName="p-0 overflow-hidden"
        >
          <div className="flex flex-col">
            {/* Search Input */}
            <div className="flex items-center px-4 py-4 border-b border-slate-200/70 dark:border-slate-800 gap-3 bg-slate-50/70 dark:bg-slate-950/30">
              <Search className="text-indigo-500" size={22} />
              <input
                id={modalSearchInputId}
                ref={inputRef}
                type="text"
                className="flex-1 bg-transparent text-lg text-slate-900 dark:text-white outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 focus-visible:ring-2 focus-visible:ring-indigo-500/35 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50 dark:focus-visible:ring-offset-slate-950 rounded-lg px-2 py-1"
                placeholder="ابحث عن اسم، هاتف، عقار، أو عقد..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 bg-slate-100/80 dark:bg-slate-800/60 rounded-lg text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400"
              >
                <span className="text-xs font-bold px-1">ESC</span>
              </button>
            </div>

            {/* Results Area */}
            <div className="max-h-[60vh] overflow-y-auto custom-scrollbar bg-slate-50/60 dark:bg-slate-950/20">
              {!query && (
                <div className="p-12 text-center text-slate-400">
                  <p className="text-sm">ابدأ الكتابة للبحث العميق في النظام</p>
                </div>
              )}

              {query &&
                results.people.length === 0 &&
                results.properties.length === 0 &&
                results.contracts.length === 0 && (
                  <div className="p-8 text-center text-slate-500">
                    لا توجد نتائج مطابقة لـ "{query}"
                  </div>
                )}

              {/* People Results */}
              {results.people.length > 0 && (
                <div className="p-2">
                  <div className="px-3 py-2 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    الأشخاص
                  </div>
                  {results.people.map((p) => (
                    <div
                      key={p.رقم_الشخص}
                      onClick={() => handleSelect('person', p.رقم_الشخص)}
                      className="flex items-center gap-3 p-3 rounded-xl hover:bg-indigo-50/70 dark:hover:bg-indigo-500/10 cursor-pointer group transition"
                    >
                      <div className="p-2 bg-white dark:bg-slate-900 rounded-full text-indigo-600 dark:text-indigo-300 shadow-sm ring-1 ring-black/5 dark:ring-white/5">
                        <User size={18} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-slate-700 dark:text-slate-200">{p.الاسم}</p>
                          {renderBadge(p.matchReason)}
                        </div>
                        <p className="text-xs text-slate-400">
                          {p.رقم_الهاتف} • {p.الرقم_الوطني}
                        </p>
                      </div>
                      <ChevronLeft
                        size={16}
                        className="text-slate-300 opacity-0 group-hover:opacity-100 transition"
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Properties Results */}
              {results.properties.length > 0 && (
                <div className="p-2">
                  <div className="px-3 py-2 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    العقارات
                  </div>
                  {results.properties.map((p) => (
                    <div
                      key={p.رقم_العقار}
                      onClick={() => handleSelect('property', p.رقم_العقار)}
                      className="flex items-center gap-3 p-3 rounded-xl hover:bg-indigo-50/70 dark:hover:bg-indigo-500/10 cursor-pointer group transition"
                    >
                      <div className="p-2 bg-white dark:bg-slate-900 rounded-full text-indigo-600 dark:text-indigo-300 shadow-sm ring-1 ring-black/5 dark:ring-white/5">
                        <Home size={18} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-slate-700 dark:text-slate-200">
                            {p.الكود_الداخلي}
                          </p>
                          {renderBadge(p.matchReason)}
                        </div>
                        <p className="text-xs text-slate-400">{p.العنوان}</p>
                      </div>
                      <ChevronLeft
                        size={16}
                        className="text-slate-300 opacity-0 group-hover:opacity-100 transition"
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Contracts Results */}
              {results.contracts.length > 0 && (
                <div className="p-2">
                  <div className="px-3 py-2 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    العقود
                  </div>
                  {results.contracts.map((c) => (
                    <div
                      key={c.رقم_العقد}
                      onClick={() => handleSelect('contract', c.رقم_العقد)}
                      className="flex items-center gap-3 p-3 rounded-xl hover:bg-indigo-50/70 dark:hover:bg-indigo-500/10 cursor-pointer group transition"
                    >
                      <div className="p-2 bg-white dark:bg-slate-900 rounded-full text-indigo-600 dark:text-indigo-300 shadow-sm ring-1 ring-black/5 dark:ring-white/5">
                        <FileText size={18} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-slate-700 dark:text-slate-200">
                            عقد #{formatContractNumberShort(c.رقم_العقد)}
                          </p>
                          {renderBadge(c.matchReason)}
                        </div>
                        <p className="text-xs text-slate-400">
                          {c.تاريخ_البداية} - {c.تاريخ_النهاية}
                        </p>
                      </div>
                      <ChevronLeft
                        size={16}
                        className="text-slate-300 opacity-0 group-hover:opacity-100 transition"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="bg-slate-50/70 dark:bg-slate-950/30 p-3 text-center border-t border-slate-200/70 dark:border-slate-800">
              <p className="text-xs text-slate-400">
                استخدم{' '}
                <kbd className="font-sans bg-white/70 dark:bg-slate-900/40 px-1 rounded border border-slate-200/70 dark:border-slate-800">
                  ↑
                </kbd>{' '}
                <kbd className="font-sans bg-white/70 dark:bg-slate-900/40 px-1 rounded border border-slate-200/70 dark:border-slate-800">
                  ↓
                </kbd>{' '}
                للتنقل، و{' '}
                <kbd className="font-sans bg-white/70 dark:bg-slate-900/40 px-1 rounded border border-slate-200/70 dark:border-slate-800">
                  Enter
                </kbd>{' '}
                للاختيار
              </p>
            </div>
          </div>
        </AppModal>
      )}
    </>
  );
};
