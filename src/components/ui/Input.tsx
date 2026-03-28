import React, { useCallback } from 'react';
import { normalizeDigitsToLatin } from '@/utils/numberInput';

type UiSize = 'sm' | 'md' | 'lg';

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  icon?: React.ReactNode;
  error?: string;
  wrapperClassName?: string;
  uiSize?: UiSize;
  normalizeDigits?: boolean;
  coerceLocalizedTypes?: boolean;
}

export const Input: React.FC<InputProps> = ({
  icon,
  error,
  className = '',
  wrapperClassName = '',
  uiSize = 'md',
  normalizeDigits = true,
  coerceLocalizedTypes = true,
  dir: dirProp,
  ...props
}) => {
  const isRtl = typeof document !== 'undefined' && document?.documentElement?.dir === 'rtl';
  const sizeClasses =
    uiSize === 'sm'
      ? 'px-3 py-2 text-xs'
      : uiSize === 'lg'
        ? 'px-5 py-3 text-base'
        : 'px-4 py-2.5 text-sm';

  const iconPaddingClass = icon ? (isRtl ? 'pr-10' : 'pl-10') : '';
  const iconPositionClass = isRtl ? 'right-3' : 'left-3';

  const requestedType = String(props.type || 'text');
  const shouldCoerceType =
    coerceLocalizedTypes && ['number', 'time', 'datetime-local'].includes(requestedType);

  const effectiveType = shouldCoerceType ? 'text' : requestedType;
  /** افتراضي RTL؛ استخدم dir="ltr" للحقول التقنية (IP، توكن، …). */
  const resolvedDir: React.HTMLAttributes<HTMLInputElement>['dir'] = shouldCoerceType
    ? 'ltr'
    : dirProp ?? 'rtl';
  const textAlignClass =
    shouldCoerceType || dirProp === 'ltr' ? 'text-left' : 'text-right';
  const effectiveLang = shouldCoerceType ? 'en' : (props as Record<string, unknown>)?.lang;

  const effectiveInputMode: React.InputHTMLAttributes<HTMLInputElement>['inputMode'] = (() => {
    if (!shouldCoerceType) return props.inputMode;
    if (requestedType === 'number') return props.inputMode || 'decimal';
    if (requestedType === 'time') return props.inputMode || 'numeric';
    if (requestedType === 'datetime-local') return props.inputMode || 'numeric';
    return props.inputMode;
  })();

  const effectivePattern: string | undefined = (() => {
    if (!shouldCoerceType) return props.pattern;
    if (requestedType === 'number') return props.pattern || '[0-9.,]*';
    if (requestedType === 'time') return props.pattern || '[0-9:]*';
    if (requestedType === 'datetime-local') return props.pattern || '[-0-9T:]*';
    return props.pattern;
  })();

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (normalizeDigits) {
        const inputEl = e.target;
        const before = String(inputEl.value ?? '');
        const after = normalizeDigitsToLatin(before);
        if (after !== before) {
          const start = inputEl.selectionStart;
          const end = inputEl.selectionEnd;
          inputEl.value = after;
          if (start !== null && end !== null) {
            try {
              inputEl.setSelectionRange(start, end);
            } catch {
              // ignore
            }
          }
        }
      }

      props.onChange?.(e);
    },
    [normalizeDigits, props]
  );

  return (
    <div className={`w-full ${wrapperClassName}`}>
      <div className="relative">
        <input
          className={`w-full bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl ${sizeClasses} ${textAlignClass} focus-visible:ring-2 focus-visible:ring-indigo-500/35 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950 outline-none transition text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 disabled:opacity-60 disabled:cursor-not-allowed ${iconPaddingClass} ${error ? 'border-rose-500 focus-visible:ring-rose-500/35' : ''} ${className}`}
          {...props}
          type={effectiveType}
          inputMode={effectiveInputMode}
          pattern={effectivePattern}
          dir={resolvedDir}
          lang={effectiveLang as string | undefined}
          onChange={handleChange}
        />
        {icon && (
          <div
            className={`absolute ${iconPositionClass} top-2.5 text-gray-400 pointer-events-none`}
          >
            {icon}
          </div>
        )}
      </div>
      {error && <p className="text-xs text-rose-500 mt-1">{error}</p>}
    </div>
  );
};
