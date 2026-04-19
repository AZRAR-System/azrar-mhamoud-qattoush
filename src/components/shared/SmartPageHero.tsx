import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { DS } from '@/constants/designSystem';

interface SmartPageHeroProps {
  title: string;
  description?: string;
  subtitle?: string; // Additional subtitle if needed
  icon?: LucideIcon;
  iconColor?: string;
  actions?: React.ReactNode;
}

/**
 * SmartPageHero
 * A standardized, premium header component for administrative pages.
 * Supports consistent layout, iconography, and action buttons.
 */
export const SmartPageHero: React.FC<SmartPageHeroProps> = ({
  title,
  description,
  subtitle,
  icon: Icon,
  iconColor = 'text-indigo-600',
  actions,
}) => {
  return (
    <div className={`${DS.components.pageHeader} animate-in fade-in slide-in-from-top-4 duration-500`}>
      <div className="space-y-1">
        <h2 className={`${DS.components.pageTitle} flex items-center gap-3`}>
          {Icon && <Icon className={`${iconColor} drop-shadow-sm`} size={32} />}
          <span>{title}</span>
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
      </div>

      {actions && (
        <div className="flex flex-wrap items-center justify-end gap-3 lg:gap-4 mt-4 lg:mt-0">
          {actions}
        </div>
      )}
    </div>
  );
};
