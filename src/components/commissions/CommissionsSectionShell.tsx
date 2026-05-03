import type { FC, ReactNode } from 'react';
import { cn } from '@/utils/cn';

export type CommissionsSectionAccent = 'emerald' | 'indigo' | 'amber' | 'slate' | 'violet';

export interface CommissionsSectionShellProps {
  title: string;
  subtitle?: string;
  kicker?: string;
  accent?: CommissionsSectionAccent;
  headerRight?: ReactNode;
  children: ReactNode;
  bodyClassName?: string;
  className?: string;
}

export const CommissionsSectionShell: FC<CommissionsSectionShellProps> = ({
  title,
  subtitle,
  kicker,
  accent = 'slate',
  headerRight,
  children,
  bodyClassName,
  className,
}) => {
  const bar =
    accent === 'emerald'
      ? 'from-emerald-500 to-teal-600'
      : accent === 'indigo'
        ? 'from-indigo-500 to-violet-600'
        : accent === 'amber'
          ? 'from-amber-500 to-orange-600'
          : accent === 'violet'
            ? 'from-violet-500 to-indigo-600'
            : 'from-slate-400 to-slate-600';
  return (
    <section
      className={cn(
        'overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm dark:border-slate-700/80 dark:bg-slate-900/50',
        className
      )}
    >
      <header className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/60 px-4 py-4 sm:flex-row sm:items-start sm:justify-between dark:border-slate-800 dark:bg-slate-900/70">
        <div className="flex min-w-0 gap-3">
          <div className={cn('w-1 shrink-0 self-stretch rounded-full bg-gradient-to-b', bar)} aria-hidden />
          <div className="min-w-0">
            {kicker ? (
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {kicker}
              </p>
            ) : null}
            <h2 className="text-base font-black text-slate-900 dark:text-white">{title}</h2>
            {subtitle ? (
              <p className="mt-1 text-xs font-medium leading-relaxed text-slate-600 dark:text-slate-400">{subtitle}</p>
            ) : null}
          </div>
        </div>
        {headerRight ? <div className="shrink-0">{headerRight}</div> : null}
      </header>
      <div className={cn('p-4 sm:p-5', bodyClassName)}>{children}</div>
    </section>
  );
};
