import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, X, Check, Loader2, ChevronDown } from 'lucide-react';
import { DbService } from '@/services/mockDb';
import type { SystemLookup } from '@/types';
import { useToast } from '@/context/ToastContext';
import { computePortalMenuLayout } from '@/utils/portalMenuLayout';

/** نفس مظهر قوائم SmartFilterBar (بورتال + زجاجي) — يظهر فوق المودالات */
const portalMenuPanelClass =
  'layer-portal-dropdown overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl py-1.5 shadow-2xl shadow-slate-900/10 dark:shadow-black/45 ring-1 ring-black/[0.04] dark:ring-white/[0.06] animate-in fade-in zoom-in-95 duration-200';

const portalMenuListClass =
  'flex min-h-0 flex-col gap-0.5 overflow-y-auto px-1.5 custom-scrollbar';

interface DynamicSelectProps {
  label?: string;
  category: string;
  value: string | undefined;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
}

export const DynamicSelect: React.FC<DynamicSelectProps> = ({
  label,
  category,
  value,
  onChange,
  placeholder = 'اختر...',
  required = false,
  className,
}) => {
  const controlId = useId();
  const listboxId = `${controlId}-listbox`;
  const [items, setItems] = useState<SystemLookup[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newItemLabel, setNewItemLabel] = useState('');
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  /** ارتفاع منطقة التمرير — يُحسب من المساحة فوق/تحت الزر */
  const [menuListMaxHeightPx, setMenuListMaxHeightPx] = useState(320);

  const controlRowRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const toast = useToast();

  const selectedLabel = useMemo(() => {
    const v = String(value ?? '').trim();
    if (!v) return placeholder;
    return items.find((x) => x.label === v)?.label ?? v;
  }, [items, placeholder, value]);

  const loadItems = useCallback(() => {
    const data = DbService.getLookupsByCategory(category);
    setItems(data);
  }, [category]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  /** إغلاق القائمة عند تبديل التصنيف أو إعادة التحميل لتفادي عرض خيارات خاطئة */
  useEffect(() => {
    setIsOpen(false);
  }, [category]);

  const syncDropdownPosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const { outerStyle, listMaxHeightPx } = computePortalMenuLayout(rect, {
      chromeReserve: 22,
      footerReserve: 0,
    });
    setMenuListMaxHeightPx(listMaxHeightPx);
    setDropdownStyle(outerStyle);
  }, []);

  const toggleOpen = () => {
    if (!isOpen) {
      syncDropdownPosition();
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  useLayoutEffect(() => {
    if (!isOpen) return;
    syncDropdownPosition();
    let rafId: number | null = null;
    const onScrollOrResize = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        syncDropdownPosition();
      });
    };
    const scrollOpts: AddEventListenerOptions = { capture: true, passive: true };
    const resizeOpts: AddEventListenerOptions = { passive: true };
    window.addEventListener('scroll', onScrollOrResize, scrollOpts);
    window.addEventListener('resize', onScrollOrResize, resizeOpts);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, scrollOpts);
      window.removeEventListener('resize', onScrollOrResize, resizeOpts);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [isOpen, syncDropdownPosition]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (controlRowRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [isOpen]);

  const handleAddItem = (e: React.FormEvent | React.KeyboardEvent) => {
    e.preventDefault();
    if (!newItemLabel.trim()) return;

    setLoading(true);
    setTimeout(() => {
      try {
        DbService.addLookup(category, newItemLabel.trim());
        toast.success(`تم إضافة "${newItemLabel}" بنجاح`);
        loadItems();
        onChange(newItemLabel.trim());
        setNewItemLabel('');
        setIsAdding(false);
      } catch {
        toast.error('حدث خطأ أثناء الإضافة');
      } finally {
        setLoading(false);
      }
    }, 500);
  };

  const pickOption = (val: string) => {
    onChange(val);
    setIsOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const listEmpty = items.length === 0;

  const dropdownPanel =
    isOpen && !isAdding ? (
      <div ref={dropdownRef} style={dropdownStyle} className={portalMenuPanelClass} role="listbox" id={listboxId}>
        <div className={portalMenuListClass} style={{ maxHeight: menuListMaxHeightPx }}>
          {!required && (
            <button
              type="button"
              role="option"
              aria-selected={!String(value ?? '').trim()}
              onClick={() => pickOption('')}
              className={`w-full whitespace-normal break-words rounded-xl px-3 py-2 text-right text-xs font-bold leading-snug transition-colors
                ${!String(value ?? '').trim()
                  ? 'bg-indigo-600/[0.12] text-indigo-800 ring-1 ring-inset ring-indigo-500/25 dark:bg-indigo-500/15 dark:text-indigo-100 dark:ring-indigo-400/25'
                  : 'text-slate-500 hover:bg-slate-100/90 dark:text-slate-400 dark:hover:bg-slate-800/90'
                }`}
            >
              {placeholder}
            </button>
          )}
          {listEmpty ? (
            <div className="rounded-xl px-3 py-2.5 text-right text-xs font-bold text-slate-500 dark:text-slate-400">
              لا توجد قيم محفوظة لهذا الحقل. استخدم + لإضافة خيار.
            </div>
          ) : (
            items.map((item) => {
              const selected = String(value ?? '').trim() === item.label;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => pickOption(item.label)}
                  className={`w-full whitespace-normal break-words rounded-xl px-3 py-2 text-right text-xs font-bold leading-snug transition-colors
                    ${selected
                      ? 'bg-indigo-600/[0.12] text-indigo-800 ring-1 ring-inset ring-indigo-500/25 dark:bg-indigo-500/15 dark:text-indigo-100 dark:ring-indigo-400/25'
                      : 'text-slate-600 hover:bg-slate-100/90 dark:text-slate-300 dark:hover:bg-slate-800/90'
                    }`}
                >
                  {item.label}
                </button>
              );
            })
          )}
        </div>
      </div>
    ) : null;

  return (
    <div className={`relative ${className ?? ''}`}>
      {label && (
        <label htmlFor={controlId} className="mb-1 block text-xs font-bold text-slate-500 dark:text-slate-400">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}

      {!isAdding ? (
        <div className="flex gap-2" ref={controlRowRef}>
          <div className="relative min-w-0 flex-1">
            <button
              ref={triggerRef}
              type="button"
              id={controlId}
              aria-haspopup="listbox"
              aria-expanded={isOpen}
              aria-controls={isOpen ? listboxId : undefined}
              onClick={toggleOpen}
              className={`flex w-full items-center justify-between gap-2 rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-3 pr-4 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-slate-700 dark:bg-slate-900 dark:focus-visible:ring-offset-slate-950 ${
                !String(value ?? '').trim()
                  ? 'text-slate-400 dark:text-slate-400'
                  : 'text-slate-800 dark:text-white'
              } `}
            >
              <span className="min-w-0 flex-1 whitespace-normal break-words text-right leading-snug">
                {selectedLabel}
              </span>
              <ChevronDown
                size={14}
                className={`shrink-0 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                aria-hidden
              />
            </button>

            {typeof document !== 'undefined' && dropdownPanel ? createPortal(dropdownPanel, document.body) : null}
          </div>

          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="shrink-0 rounded-xl bg-indigo-50 p-2.5 text-indigo-600 transition hover:bg-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400 dark:hover:bg-indigo-900/40"
            title="إضافة عنصر جديد"
            aria-label="إضافة عنصر جديد"
          >
            <Plus size={18} />
          </button>
        </div>
      ) : (
        <div className="flex animate-fade-in gap-2">
          <input
            id={controlId}
            autoFocus
            type="text"
            placeholder="أدخل القيمة الجديدة..."
            className="flex-1 rounded-xl border border-indigo-300 bg-white px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:border-indigo-700 dark:bg-slate-800"
            value={newItemLabel}
            onChange={(e) => setNewItemLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddItem(e);
              if (e.key === 'Escape') setIsAdding(false);
            }}
          />
          <button
            type="button"
            onClick={handleAddItem}
            disabled={loading || !newItemLabel.trim()}
            className="rounded-xl bg-green-500 p-2.5 text-white shadow-sm transition hover:bg-green-600 disabled:opacity-50"
            title="تأكيد الإضافة"
            aria-label="تأكيد الإضافة"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
          </button>
          <button
            type="button"
            onClick={() => setIsAdding(false)}
            className="rounded-xl bg-gray-100 p-2.5 text-slate-500 transition hover:bg-gray-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
            title="إلغاء"
            aria-label="إلغاء"
          >
            <X size={18} />
          </button>
        </div>
      )}
    </div>
  );
};
