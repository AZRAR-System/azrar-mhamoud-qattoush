import React from 'react';

export type SegmentedTabItem<T extends string> = {
  id: T;
  label: string;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
};

type Props<T extends string> = {
  tabs: Array<SegmentedTabItem<T>>;
  activeId: T;
  onChange: (id: T) => void;
  className?: string;
  showLabelClassName?: string;
};

export function SegmentedTabs<T extends string>({
  tabs,
  activeId,
  onChange,
  className,
  showLabelClassName = 'hidden md:inline',
}: Props<T>) {
  return (
    <div
      className={
        className ??
        'inline-flex items-center gap-1 bg-slate-50/80 dark:bg-slate-950/40 border border-slate-200/70 dark:border-slate-800 p-1 rounded-2xl max-w-full overflow-x-auto'
      }
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const active = activeId === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition whitespace-nowrap
              ${
                active
                  ? 'bg-white dark:bg-slate-900 shadow-sm ring-1 ring-indigo-100 dark:ring-slate-800 text-indigo-700 dark:text-indigo-300'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-white/70 dark:hover:bg-slate-900/40 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
          >
            {Icon ? <Icon size={14} /> : null}
            <span className={showLabelClassName}>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
