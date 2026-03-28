import { useEffect, useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: { value: string; label: string }[];
  placeholder?: string;
}

export const Select: React.FC<SelectProps> = ({
  options,
  placeholder,
  className = '',
  ...props
}) => {
  const isRtl = typeof document !== 'undefined' && document?.documentElement?.dir === 'rtl';
  const chevronPos = isRtl ? 'left-3' : 'right-3';
  const padding = isRtl ? 'pl-10 pr-4' : 'pr-10 pl-4';

  const { value, defaultValue, onChange, ...rest } = props;
  const [selectedValue, setSelectedValue] = useState<string>(
    String((value ?? defaultValue ?? '') as string)
  );

  useEffect(() => {
    if (value !== undefined) setSelectedValue(String(value));
  }, [value]);

  const selectedLabel = useMemo(() => {
    const v = String(selectedValue ?? '');
    if (!v) return placeholder ?? '';
    return options.find((o) => String(o.value) === v)?.label ?? v;
  }, [options, placeholder, selectedValue]);

  const isEmpty = !String(selectedValue ?? '').trim();

  return (
    <div className="relative min-w-[140px]">
      <div
        className={`w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl ${padding} py-2.5 text-sm outline-none transition text-slate-800 dark:text-white focus-within:ring-2 focus-within:ring-indigo-500 focus-within:ring-offset-2 focus-within:ring-offset-white dark:focus-within:ring-offset-slate-950 ${className}`}
      >
        <div
          className={`whitespace-normal break-words leading-snug ${isEmpty ? 'text-slate-400 dark:text-slate-400' : ''}`}
        >
          {selectedLabel}
        </div>

        <select
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          onChange={(e) => {
            setSelectedValue(e.target.value);
            onChange?.(e);
          }}
          {...(value !== undefined
            ? { value: value as string | number | readonly string[] }
            : { defaultValue: defaultValue as string | number | readonly string[] | undefined })}
          {...rest}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <ChevronDown
        size={16}
        className={`absolute ${chevronPos} top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none`}
      />
    </div>
  );
};
