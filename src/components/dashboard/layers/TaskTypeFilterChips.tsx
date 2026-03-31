/**
 * Quick kind filter for dashboard Kanban tasks (عام / عقد / شخص / عقار).
 */

import React from 'react';
import type { TaskKindFilter } from './taskBuckets';

const OPTIONS: { id: TaskKindFilter; label: string }[] = [
  { id: 'all', label: 'الكل' },
  { id: 'general', label: 'عام' },
  { id: 'contract', label: 'عقد' },
  { id: 'person', label: 'شخص' },
  { id: 'property', label: 'عقار' },
];

export interface TaskTypeFilterChipsProps {
  value: TaskKindFilter;
  onChange: (next: TaskKindFilter) => void;
  className?: string;
}

export const TaskTypeFilterChips: React.FC<TaskTypeFilterChipsProps> = ({
  value,
  onChange,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-wrap items-center gap-2 ${className}`}
      role="group"
      aria-label="فلتر نوع المهمة"
    >
      {OPTIONS.map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={`rounded-full px-3 py-1.5 text-xs font-bold transition border ${
              active
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
};
