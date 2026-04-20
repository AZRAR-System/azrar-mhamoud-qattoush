import React from 'react';
import { DS } from '@/constants/designSystem';

interface SmartPageHeroProps {
  title: string;
  description?: string;
  subtitle?: string;
  icon?: React.ComponentType<{ className?: string }> | React.ReactNode;
  iconColor?: string;
  iconBg?: string;
  actions?: React.ReactNode;
  stats?: { label: string; value: string | number; color?: string }[];
  /** 
   * 'premium' (default): Indigo gradient, white text, matching Owner Portal
   * 'glass': Glassmorphism style, dark text/white text depending on bg
   */
  variant?: 'premium' | 'glass';
  className?: string;
  topContent?: React.ReactNode;
  bottomContent?: React.ReactNode;
}

/**
 * هيرو الصفحة الذكي - المكون الأساسي لرأس الصفحات في نظام AZRAR
 * يتبع تصميم "بوابة المالك" الاحترافي.
 */
export const SmartPageHero: React.FC<SmartPageHeroProps> = ({
  title,
  description,
  subtitle,
  icon: iconProp,
  iconColor = 'text-white',
  iconBg = 'bg-white/10 backdrop-blur-md border border-white/20',
  actions,
  stats,
  variant = 'premium',
  className,
  topContent,
  bottomContent,
}) => {
  const isPremium = variant === 'premium';
  
  const containerClass = isPremium ? DS.components.pageHeader : DS.components.pageHeaderLayout;
  const titleClass = isPremium ? DS.components.pageTitleWhite : DS.components.pageTitle;
  const subtitleClass = DS.components.pageSubtitleUppercase;
  const descriptionClass = isPremium ? DS.components.pageSubtitleWhite : DS.components.pageSubtitle;

  const renderIcon = () => {
    if (!iconProp) return null;
    
    if (React.isValidElement(iconProp)) {
      return iconProp;
    }

    const Icon = iconProp as React.ComponentType<{ className?: string }>;
    return <Icon className={`w-6 h-6 lg:w-8 lg:h-8 ${iconColor}`} />;
  };

  return (
    <div className={`${containerClass} ${className || ''} animate-in fade-in slide-in-from-top-4 duration-500`} dir="rtl">
      <div className="flex items-start gap-4 lg:gap-6 min-w-0">
        {iconProp && (
          <div className={`p-4 rounded-2xl ${iconBg} shrink-0 ring-1 ring-white/10 shadow-lg flex items-center justify-center`}>
            {renderIcon()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          {topContent && <div className="mb-4">{topContent}</div>}
          
          <h2 className={titleClass}>
            {title}
          </h2>
          
          {subtitle && (
            <p className={`${subtitleClass} ${isPremium ? 'text-white/60' : ''}`}>
              {subtitle}
            </p>
          )}
          
          {description && (
            <p className={descriptionClass}>
              {description}
            </p>
          )}

          {stats && stats.length > 0 && (
            <div className={`flex flex-wrap gap-4 mt-6 ${isPremium ? 'text-white' : ''}`}>
              {stats.map((s, i) => (
                <div key={i} className={`flex items-center gap-2 px-4 py-2 rounded-xl ${isPremium ? 'bg-white/5 border border-white/10' : 'bg-slate-50 dark:bg-slate-800'}`}>
                  <span className={`text-lg font-black ${s.color || (isPremium ? 'text-white' : 'text-indigo-600 dark:text-indigo-400')}`}>
                    {s.value}
                  </span>
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${isPremium ? 'text-white/60' : 'text-slate-500'}`}>
                    {s.label}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {actions && (
        <div className="flex flex-wrap items-center justify-end gap-2 lg:gap-4 shrink-0 mt-6 lg:mt-0">
          {actions}
        </div>
      )}

      {bottomContent && (
        <div className={`w-full mt-8 pt-8 border-t ${isPremium ? 'border-white/10' : 'border-slate-100 dark:border-white/5'}`}>
          {bottomContent}
        </div>
      )}
    </div>
  );
};
