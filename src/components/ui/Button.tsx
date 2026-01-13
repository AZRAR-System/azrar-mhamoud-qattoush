
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
  children, variant = 'primary', size = 'md', isLoading, leftIcon, rightIcon, className = '', disabled, ...props 
}) => {
  const base = "font-bold transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950";
  
  const variants = {
    primary: `${DS.colors.primary} shadow-sm shadow-indigo-600/10 dark:shadow-indigo-400/10`,
    secondary: DS.colors.secondary,
    danger: DS.colors.danger,
    ghost: DS.colors.ghost,
    outline: DS.colors.outline,
  };

  const sizes = {
    sm: "px-3 py-1.5 text-xs rounded-lg",
    md: "px-5 py-2.5 text-sm rounded-xl",
    lg: "px-6 py-3 text-base rounded-2xl",
    icon: "p-2 rounded-xl aspect-square"
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
