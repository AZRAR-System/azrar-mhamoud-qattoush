import React from 'react';
import { getCurrencySuffix, getMoneySettingsSync } from '@/services/moneySettings';

export const CurrencySuffix: React.FC<{ code?: string; className?: string }> = ({
  code,
  className = 'text-xs text-slate-500 dark:text-slate-400',
}) => {
  const resolved = String(code || getMoneySettingsSync().currencyCode || '')
    .trim()
    .toUpperCase();
  const suffix = getCurrencySuffix(resolved || 'JOD');
  if (!suffix) return null;
  return <span className={className}>{suffix}</span>;
};

export default CurrencySuffix;
