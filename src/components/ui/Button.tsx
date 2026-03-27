import React from 'react';
import { Loader2 } from 'lucide-react';
import { DS } from '@/constants/designSystem';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading,
  leftIcon,
  rightIcon,
  className = '',
  disabled,
  ...props
}) => {
  const base =
    'font-bold transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950';

  const variants = {
    primary: `bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/20 active:scale-95 transition-all duration-300`,
    secondary: `bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 transition-all duration-300`,
    danger: `bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/20 active:scale-95 transition-all duration-300`,
    ghost: `bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 active:scale-95 transition-all duration-300`,
    outline: `bg-transparent border-2 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-indigo-600 hover:text-indigo-600 active:scale-95 transition-all duration-300`,
  };

  const sizes = {
    sm: 'px-4 py-2 text-xs rounded-xl',
    md: 'px-6 py-3 text-sm rounded-2xl',
    lg: 'px-8 py-4 text-base rounded-[1.25rem]',
    icon: 'p-3 rounded-2xl aspect-square',
  };

  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && <Loader2 size={16} className="animate-spin" />}
      {!isLoading && rightIcon}
      {children}
      {!isLoading && leftIcon}
    </button>
  );
};
