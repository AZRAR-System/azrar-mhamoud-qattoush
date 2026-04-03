import type { ReactNode } from 'react';
import { DS } from '@/constants/designSystem';

export type PageHeroProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  /** يُعرض بجانب العنوان */
  icon?: ReactNode;
  /** `featured`: أيقونة داخل صندوق بنفسجي؛ `inline`: أيقونة ملوّنة كنص الصفحات التقريرية */
  iconVariant?: 'inline' | 'featured';
  actions?: ReactNode;
  /** افتراضياً: `DS.components.pageSubtitle` */
  subtitleClassName?: string;
  className?: string;
  /**
   * داخل بطاقة/غلاف جاهز (مثل صفحة الأقساط): بدون `glass` وبدون هامش سفلي كبير
   * حتى لا يتكرر الإطار الزجاجي.
   */
  embed?: boolean;
};

/**
 * رأس صفحة موحّد (زجاجي + عنوان فرعي + إجراءات اختيارية) ليتوافق مع بقية الواجهة.
 */
export function PageHero({
  title,
  subtitle,
  icon,
  iconVariant = 'inline',
  actions,
  subtitleClassName,
  className = '',
  embed = false,
}: PageHeroProps) {
  const iconNode =
    icon && iconVariant === 'featured' ? (
      <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-600/20 shrink-0">
        {icon}
      </div>
    ) : icon ? (
      <span className="shrink-0 text-indigo-600 dark:text-indigo-400 inline-flex items-center justify-center">
        {icon}
      </span>
    ) : null;

  const gap = iconVariant === 'featured' ? 'gap-3' : 'gap-2';

  const shell = embed
    ? 'flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-6 relative z-10'
    : DS.components.pageHeader;

  return (
    <div className={`${shell} ${className}`.trim()}>
      <div className="min-w-0">
        <h2 className={`${DS.components.pageTitle} flex items-center ${gap}`}>
          {iconNode}
          <span className="min-w-0">{title}</span>
        </h2>
        {(subtitle ?? '') !== '' ? (
          <p className={subtitleClassName ?? DS.components.pageSubtitle}>{subtitle}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center justify-end gap-2 lg:gap-3 shrink-0">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
