import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  type FC,
} from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { computePortalMenuLayout } from '@/utils/portalMenuLayout';

const portalMenuPanelClass =
  'layer-portal-dropdown overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl py-1.5 shadow-2xl shadow-slate-900/10 dark:shadow-black/45 ring-1 ring-black/[0.04] dark:ring-white/[0.06] animate-in fade-in zoom-in-95 duration-200';

const portalMenuListClass =
  'flex min-h-0 flex-col gap-0.5 overflow-y-auto px-1.5 custom-scrollbar';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: { value: string; label: string }[];
  placeholder?: string;
}

export const Select: FC<SelectProps> = ({
  options,
  placeholder,
  className = '',
  value: valueProp,
  defaultValue,
  onChange,
  required,
  disabled,
  name,
  id: idProp,
  autoFocus,
  form,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
}) => {
  const reactId = useId();
  const controlId = idProp ?? `select-${reactId}`;
  const listboxId = `${controlId}-listbox`;

  const isRtl =
    typeof document !== 'undefined' && document?.documentElement?.dir === 'rtl';
  const chevronSide = isRtl ? 'right-3' : 'left-3';
  const padX = isRtl ? 'pr-10 pl-4' : 'pl-10 pr-4';

  const [selectedValue, setSelectedValue] = useState<string>(
    String((valueProp ?? defaultValue ?? '') as string)
  );
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const [menuListMaxHeightPx, setMenuListMaxHeightPx] = useState(320);

  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (valueProp !== undefined) setSelectedValue(String(valueProp));
  }, [valueProp]);

  const selectedLabel = useMemo(() => {
    const v = String(selectedValue ?? '');
    const hit = options.find((o) => String(o.value) === v);
    if (hit) return hit.label;
    return placeholder ?? '';
  }, [options, placeholder, selectedValue]);

  const isEmpty = !options.some((o) => String(o.value) === String(selectedValue));

  const syncPosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const { outerStyle, listMaxHeightPx } = computePortalMenuLayout(rect, {
      chromeReserve: 22,
      footerReserve: 0,
      minWidthPx: 140,
    });
    setMenuListMaxHeightPx(listMaxHeightPx);
    setDropdownStyle(outerStyle);
  }, []);

  const toggleOpen = () => {
    if (disabled) return;
    if (!isOpen) {
      syncPosition();
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  useLayoutEffect(() => {
    if (!isOpen) return;
    syncPosition();
    let rafId: number | null = null;
    const onScrollOrResize = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        syncPosition();
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
  }, [isOpen, syncPosition]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (wrapRef.current?.contains(target)) return;
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

  const pick = (val: string) => {
    setSelectedValue(val);
    onChange?.({
      target: { value: val },
    } as React.ChangeEvent<HTMLSelectElement>);
    setIsOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const dropdownPanel =
    isOpen && !disabled ? (
      <div
        ref={dropdownRef}
        style={dropdownStyle}
        className={portalMenuPanelClass}
        role="listbox"
        id={listboxId}
      >
        <div className={portalMenuListClass} style={{ maxHeight: menuListMaxHeightPx }}>
          {!required && Boolean(placeholder) && (
            <button
              type="button"
              role="option"
              aria-selected={isEmpty}
              onClick={() => pick('')}
              className={`w-full whitespace-normal break-words rounded-xl px-3 py-2 text-right text-xs font-bold leading-snug transition-colors
                ${isEmpty
                  ? 'bg-indigo-600/[0.12] text-indigo-800 ring-1 ring-inset ring-indigo-500/25 dark:bg-indigo-500/15 dark:text-indigo-100 dark:ring-indigo-400/25'
                  : 'text-slate-500 hover:bg-slate-100/90 dark:text-slate-400 dark:hover:bg-slate-800/90'
                }`}
            >
              {placeholder}
            </button>
          )}
          {options.map((opt) => {
            const sel = String(selectedValue) === String(opt.value);
            return (
              <button
                key={String(opt.value)}
                type="button"
                role="option"
                aria-selected={sel}
                onClick={() => pick(String(opt.value))}
                className={`w-full whitespace-normal break-words rounded-xl px-3 py-2 text-right text-xs font-bold leading-snug transition-colors
                  ${sel
                    ? 'bg-indigo-600/[0.12] text-indigo-800 ring-1 ring-inset ring-indigo-500/25 dark:bg-indigo-500/15 dark:text-indigo-100 dark:ring-indigo-400/25'
                    : 'text-slate-600 hover:bg-slate-100/90 dark:text-slate-300 dark:hover:bg-slate-800/90'
                  }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
    ) : null;

  return (
    <div ref={wrapRef} className={`relative min-w-[140px] ${className}`}>
      {name ? <input type="hidden" name={name} form={form} value={selectedValue} /> : null}
      <button
        ref={triggerRef}
        type="button"
        id={controlId}
        disabled={disabled}
        autoFocus={autoFocus}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listboxId : undefined}
        aria-required={required || undefined}
        onClick={toggleOpen}
        className={`relative flex w-full items-center justify-between gap-2 rounded-xl border border-gray-200 bg-white py-2.5 ${padX} text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:focus-visible:ring-offset-slate-950 ${
          isEmpty ? 'text-slate-400 dark:text-slate-400' : 'text-slate-800 dark:text-white'
        } `}
      >
        <span className="min-w-0 flex-1 whitespace-normal break-words text-right leading-snug">
          {selectedLabel}
        </span>
        <ChevronDown
          size={16}
          className={`pointer-events-none absolute ${chevronSide} top-1/2 shrink-0 -translate-y-1/2 text-gray-400 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
          aria-hidden
        />
      </button>

      {typeof document !== 'undefined' && dropdownPanel ? createPortal(dropdownPanel, document.body) : null}
    </div>
  );
};
