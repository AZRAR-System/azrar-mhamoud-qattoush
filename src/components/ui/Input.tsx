
import React from 'react';

type UiSize = 'sm' | 'md' | 'lg';

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  icon?: React.ReactNode;
  error?: string;
  wrapperClassName?: string;
  uiSize?: UiSize;
}

export const Input: React.FC<InputProps> = ({
  icon,
  error,
  className = '',
  wrapperClassName = '',
  uiSize = 'md',
  ...props
}) => {
  const isRtl = typeof document !== 'undefined' && document?.documentElement?.dir === 'rtl';
  const sizeClasses =
    uiSize === 'sm'
      ? 'px-3 py-2 text-xs'
      : uiSize === 'lg'
        ? 'px-5 py-3 text-base'
        : 'px-4 py-2.5 text-sm';

  const iconPaddingClass = icon ? (isRtl ? 'pr-10' : 'pl-10') : '';
  const iconPositionClass = isRtl ? 'right-3' : 'left-3';

  return (
    <div className={`w-full ${wrapperClassName}`}>
      <div className="relative">
        <input
          className={`w-full bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl ${sizeClasses} focus-visible:ring-2 focus-visible:ring-indigo-500/35 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950 outline-none transition text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 disabled:opacity-60 disabled:cursor-not-allowed ${iconPaddingClass} ${error ? 'border-rose-500 focus-visible:ring-rose-500/35' : ''} ${className}`}
          {...props}
        />
        {icon && <div className={`absolute ${iconPositionClass} top-2.5 text-gray-400 pointer-events-none`}>{icon}</div>}
      </div>
      {error && <p className="text-xs text-rose-500 mt-1">{error}</p>}
    </div>
  );
};
