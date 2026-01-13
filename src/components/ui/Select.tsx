
import React from 'react';
import { ChevronDown } from 'lucide-react';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: { value: string; label: string }[];
  placeholder?: string;
}

export const Select: React.FC<SelectProps> = ({ options, placeholder, className = '', ...props }) => {
  return (
    <div className="relative min-w-[140px]">
      <select 
        className={`w-full appearance-none bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-2.5 pl-10 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition cursor-pointer text-slate-800 dark:text-white ${className}`}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
      </select>
      <ChevronDown size={16} className="absolute left-3 top-3 text-gray-400 pointer-events-none" />
    </div>
  );
};
