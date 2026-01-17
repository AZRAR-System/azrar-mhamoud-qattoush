
import React from 'react';
import { ChevronDown } from 'lucide-react';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: { value: string; label: string }[];
  placeholder?: string;
}

export const Select: React.FC<SelectProps> = ({ options, placeholder, className = '', ...props }) => {
  const isRtl = typeof document !== 'undefined' && document?.documentElement?.dir === 'rtl';
  const chevronPos = isRtl ? 'left-3' : 'right-3';
  const padding = isRtl ? 'pl-10 pr-4' : 'pr-10 pl-4';
  return (
    <div className="relative min-w-[140px]">
      <select 
        className={`w-full appearance-none bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl ${padding} py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition cursor-pointer text-slate-800 dark:text-white ${className}`}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
      </select>
      <ChevronDown size={16} className={`absolute ${chevronPos} top-3 text-gray-400 pointer-events-none`} />
    </div>
  );
};
