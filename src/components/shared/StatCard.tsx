import React from 'react';
import type { LucideIcon } from 'lucide-react';

type Color = 'emerald' | 'amber' | 'indigo' | 'rose' | 'blue' | 'purple' | 'slate' | 'orange';

const colorMap: Record<Color, {
  bg: string; border: string; icon: string; value: string; label: string;
}> = {
  emerald: {
    bg:     'bg-emerald-50 dark:bg-emerald-900/20',
    border: 'border-emerald-200 dark:border-emerald-800/40',
    icon:   'bg-emerald-100 dark:bg-emerald-800/40 text-emerald-600 dark:text-emerald-300',
    value:  'text-emerald-700 dark:text-emerald-300',
    label:  'text-emerald-600/80 dark:text-emerald-400/80',
  },
  amber: {
    bg:     'bg-amber-50 dark:bg-amber-900/20',
    border: 'border-amber-200 dark:border-amber-800/40',
    icon:   'bg-amber-100 dark:bg-amber-800/40 text-amber-600 dark:text-amber-300',
    value:  'text-amber-700 dark:text-amber-300',
    label:  'text-amber-600/80 dark:text-amber-400/80',
  },
  indigo: {
    bg:     'bg-indigo-50 dark:bg-indigo-900/20',
    border: 'border-indigo-200 dark:border-indigo-800/40',
    icon:   'bg-indigo-100 dark:bg-indigo-800/40 text-indigo-600 dark:text-indigo-300',
    value:  'text-indigo-700 dark:text-indigo-300',
    label:  'text-indigo-600/80 dark:text-indigo-400/80',
  },
  rose: {
    bg:     'bg-rose-50 dark:bg-rose-900/20',
    border: 'border-rose-200 dark:border-rose-800/40',
    icon:   'bg-rose-100 dark:bg-rose-800/40 text-rose-600 dark:text-rose-300',
    value:  'text-rose-700 dark:text-rose-300',
    label:  'text-rose-600/80 dark:text-rose-400/80',
  },
  blue: {
    bg:     'bg-blue-50 dark:bg-blue-900/20',
    border: 'border-blue-200 dark:border-blue-800/40',
    icon:   'bg-blue-100 dark:bg-blue-800/40 text-blue-600 dark:text-blue-300',
    value:  'text-blue-700 dark:text-blue-300',
    label:  'text-blue-600/80 dark:text-blue-400/80',
  },
  purple: {
    bg:     'bg-purple-50 dark:bg-purple-900/20',
    border: 'border-purple-200 dark:border-purple-800/40',
    icon:   'bg-purple-100 dark:bg-purple-800/40 text-purple-600 dark:text-purple-300',
    value:  'text-purple-700 dark:text-purple-300',
    label:  'text-purple-600/80 dark:text-purple-400/80',
  },
  slate: {
    bg:     'bg-slate-50 dark:bg-slate-800/40',
    border: 'border-slate-200 dark:border-slate-700/40',
    icon:   'bg-slate-100 dark:bg-slate-700/40 text-slate-600 dark:text-slate-300',
    value:  'text-slate-700 dark:text-slate-300',
    label:  'text-slate-500 dark:text-slate-400',
  },
  orange: {
    bg:     'bg-orange-50 dark:bg-orange-900/20',
    border: 'border-orange-200 dark:border-orange-800/40',
    icon:   'bg-orange-100 dark:bg-orange-800/40 text-orange-600 dark:text-orange-300',
    value:  'text-orange-700 dark:text-orange-300',
    label:  'text-orange-600/80 dark:text-orange-400/80',
  },
};

export interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color?: Color;
  subtitle?: string;
  onClick?: () => void;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  icon: Icon,
  color = 'indigo',
  subtitle,
  onClick,
}) => {
  const c = colorMap[color];
  return (
    <div
      className={`app-card p-5 flex flex-col justify-between border-b-4 ${c.bg} ${c.border} hover:shadow-lg transition-all duration-200 ${onClick ? 'cursor-pointer hover:-translate-y-0.5' : ''}`}
      onClick={onClick}
    >
      <div className="flex justify-between items-start mb-3">
        <span className={`text-[10px] font-black uppercase tracking-widest ${c.label}`}>
          {label}
        </span>
        <div className={`p-2 rounded-xl shadow-sm ${c.icon}`}>
          <Icon size={18} strokeWidth={2.5} />
        </div>
      </div>
      <div>
        <p className={`text-2xl font-black tabular-nums truncate ${c.value}`}>
          {value}
        </p>
        {subtitle && (
          <p className={`text-xs font-bold mt-1 ${c.label}`}>{subtitle}</p>
        )}
      </div>
    </div>
  );
};
