
export type FilterOperator = 'contains' | 'equals' | 'gte' | 'lte' | 'between' | 'dateBetween' | 'in';

export interface FilterRule {
  field: string;
  operator: FilterOperator;
  value: any;
}

export const SearchEngine = {
  applyFilters: <T>(data: T[], rules: FilterRule[]): T[] => {
    if (!rules || rules.length === 0) return data;

    return data.filter(item => {
      return rules.every(rule => {
        const val = (item as any)[rule.field];
        if (val === undefined || val === null) return false;

        switch (rule.operator) {
          case 'contains':
            return String(val).toLowerCase().includes(String(rule.value).toLowerCase());
          case 'equals':
            return String(val) === String(rule.value);
          case 'gte':
            return Number(val) >= Number(rule.value);
          case 'lte':
            return Number(val) <= Number(rule.value);
          case 'between':
            return Number(val) >= rule.value[0] && Number(val) <= rule.value[1];
          case 'dateBetween':
             const d = new Date(val);
             const start = new Date(rule.value[0]);
             const end = new Date(rule.value[1]);
             // Fix date comparison by resetting time
             d.setHours(0,0,0,0);
             start.setHours(0,0,0,0);
             end.setHours(23,59,59,999);
             return d >= start && d <= end;
          case 'in':
             return Array.isArray(rule.value) && rule.value.includes(val);
          default:
            return true;
        }
      });
    });
  }
};
