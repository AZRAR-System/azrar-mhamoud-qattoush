import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { DS } from '@/constants/designSystem';

interface SmartPageHeroProps {
  title: string;
  description?: string;
  subtitle?: string;
  icon?: LucideIcon;
  iconColor?: string;
  iconBg?: string;
  actions?: React.ReactNode;
  stats?: { label: string; value: string | number; color?: string }[];
  className?: string; // Add this
  topContent?: React.ReactNode; // Add this
  bottomContent?: React.ReactNode; // Add this
}

export const SmartPageHero: React.FC<SmartPageHeroProps> = ({
  title,
  description,
  subtitle,
  icon: Icon,
  iconColor = 'text-indigo-600 dark:text-indigo-400',
  iconBg = 'bg-indigo-50 dark:bg-indigo-950/40',
  actions,
  stats,
  className, // Add this
  topContent, // Add this
  bottomContent, // Add this
}) => {
  return (
    <div className={`${DS.components.pageHeader} ${className || ''} animate-in fade-in slide-in-from-top-4 duration-500`}>
      <div className="flex items-start gap-4 min-w-0">
        {Icon && (
          <div className={`p-3 rounded-2xl ${iconBg} shrink-0 ring-1 ring-black/5 dark:ring-white/10`}>
            <Icon className={`w-6 h-6 lg:w-7 lg:h-7 ${iconColor}`} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          {topContent && <div className="mb-4">{topContent}</div>}
          <h2 className={DS.components.pageTitle}>
            {title}
          </h2>
          {subtitle && (
            <p className={DS.components.pageSubtitleUppercase}>
              {subtitle}
            </p>
          )}
          {description && (
            <p className={DS.components.pageSubtitle}>
              {description}
            </p>
          )}
          {stats && stats.length > 0 && (
            <div className="flex flex-wrap gap-4 mt-3">
              {stats.map((s, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <span className={`text-lg font-black ${s.color ?? 'text-indigo-600 dark:text-indigo-400'}`}>
                    {s.value}
                  </span>
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                    {s.label}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex flex-wrap items-center justify-end gap-2 lg:gap-3 shrink-0">
          {actions}
        </div>
      )}
      {bottomContent && (
        <div className="w-full mt-6 pt-6 border-t border-slate-100/50 dark:border-white/5">
          {bottomContent}
        </div>
      )}
    </div>
  );
};
