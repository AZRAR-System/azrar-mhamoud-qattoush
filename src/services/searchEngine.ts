import { parseNumberOrUndefined } from '@/utils/numberInput';
import { normalizeSearchTextStrict } from '@/utils/searchNormalize';

export type FilterOperator =
  | 'contains'
  | 'equals'
  | 'gte'
  | 'lte'
  | 'between'
  | 'dateBetween'
  | 'in';

export interface FilterRule {
  field: string;
  operator: FilterOperator;
  value: unknown;
}

const toFiniteNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'string') return parseNumberOrUndefined(value);
  if (value === null || value === undefined) return undefined;
  return parseNumberOrUndefined(String(value));
};

export const SearchEngine = {
  applyFilters: <T>(data: T[], rules: FilterRule[]): T[] => {
    if (!rules || rules.length === 0) return data;

    return data.filter((item) => {
      return rules.every((rule) => {
        const val = (item as unknown as Record<string, unknown>)[rule.field];
        if (val === undefined || val === null) return false;

        switch (rule.operator) {
          case 'contains':
            return normalizeSearchTextStrict(val).includes(normalizeSearchTextStrict(rule.value));
          case 'equals':
            return normalizeSearchTextStrict(val) === normalizeSearchTextStrict(rule.value);
          case 'gte': {
            const a = toFiniteNumber(val);
            const b = toFiniteNumber(rule.value);
            if (a === undefined || b === undefined) return false;
            return a >= b;
          }
          case 'lte': {
            const a = toFiniteNumber(val);
            const b = toFiniteNumber(rule.value);
            if (a === undefined || b === undefined) return false;
            return a <= b;
          }
          case 'between': {
            const range = rule.value as unknown as [unknown, unknown];
            const n = toFiniteNumber(val);
            const a = toFiniteNumber(range?.[0]);
            const b = toFiniteNumber(range?.[1]);
            if (n === undefined || a === undefined || b === undefined) return false;
            return n >= a && n <= b;
          }
          case 'dateBetween': {
            const range = rule.value as unknown as [unknown, unknown];
            const d = new Date(String(val));
            const start = new Date(String(range?.[0]));
            const end = new Date(String(range?.[1]));
            // Fix date comparison by resetting time
            d.setHours(0, 0, 0, 0);
            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);
            return d >= start && d <= end;
          }
          case 'in':
            return Array.isArray(rule.value) && (rule.value as unknown[]).includes(val);
          default:
            return true;
        }
      });
    });
  },
};
