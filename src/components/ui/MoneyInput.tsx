import { useEffect, useMemo, useState } from 'react';

import { CurrencySuffix } from '@/components/ui/CurrencySuffix';
import { Input } from '@/components/ui/Input';
import { getCurrencySuffix, getMoneySettingsSync } from '@/services/moneySettings';
import { normalizeDigitsToLatin, parseNumberOrUndefined } from '@/utils/numberInput';

export type MoneyInputValue = number | undefined;

export interface MoneyInputProps extends Omit<
  React.ComponentProps<typeof Input>,
  'type' | 'value' | 'defaultValue' | 'onChange'
> {
  value?: MoneyInputValue;
  defaultValue?: MoneyInputValue;
  onValueChange?: (value: MoneyInputValue) => void;
  decimals?: number;
  /** When false, hides the currency suffix (e.g. very narrow inputs). Default true. */
  showCurrency?: boolean;
}

function roundToDecimals(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function formatMoneyText(value: number, decimals: number): string {
  // Keep simple and predictable: no thousands separators while editing.
  return value.toFixed(decimals);
}

export function MoneyInput({
  value,
  defaultValue,
  onValueChange,
  decimals = 2,
  normalizeDigits = true,
  showCurrency = true,
  icon,
  iconSide = 'left',
  ...props
}: MoneyInputProps) {
  const isControlled = typeof value !== 'undefined';

  const currencyCode = getMoneySettingsSync().currencyCode || 'JOD';
  const currencySuffixText = getCurrencySuffix(currencyCode);
  const currencyIcon =
    showCurrency && currencySuffixText ? (
      <CurrencySuffix
        code={currencyCode}
        className="text-[10px] font-bold text-slate-500 dark:text-slate-400 tabular-nums"
      />
    ) : undefined;

  const initial = useMemo(() => {
    const v = isControlled ? value : defaultValue;
    return typeof v === 'number' ? formatMoneyText(v, decimals) : '';
  }, [decimals, defaultValue, isControlled, value]);

  const [text, setText] = useState<string>(initial);

  useEffect(() => {
    if (!isControlled) return;
    if (typeof value === 'number') setText(formatMoneyText(value, decimals));
    else setText('');
  }, [decimals, isControlled, value]);

  return (
    <Input
      {...props}
      icon={icon ?? currencyIcon}
      iconSide={iconSide}
      textAlign="right"
      type="text"
      inputMode="decimal"
      dir="ltr"
      normalizeDigits={normalizeDigits}
      value={text}
      onChange={(e) => {
        const raw = e.target.value;
        const normalized = normalizeDigits ? normalizeDigitsToLatin(raw) : raw;

        // Allow only digits, dot, comma, and minus while typing.
        // Comma is treated as decimal separator.
        const cleaned = normalized.replace(/[^0-9.,-]/g, '');
        setText(cleaned);

        const parsed = parseNumberOrUndefined(cleaned.replace(/,/g, '.'));
        if (typeof parsed === 'number') onValueChange?.(roundToDecimals(parsed, decimals));
        else onValueChange?.(undefined);
      }}
      onBlur={(e) => {
        props.onBlur?.(e);
        const parsed = parseNumberOrUndefined(text.replace(/,/g, '.'));
        if (typeof parsed === 'number') {
          const rounded = roundToDecimals(parsed, decimals);
          setText(formatMoneyText(rounded, decimals));
          onValueChange?.(rounded);
        }
      }}
    />
  );
}
