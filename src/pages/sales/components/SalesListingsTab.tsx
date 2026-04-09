import React from 'react';
import { Button } from '@/components/ui/Button';
import { LoadingSkeleton } from './LoadingSkeleton';
import { عروض_البيع_tbl } from '@/types';

const t = (s: string) => s;

interface SalesListingsTabProps {
  listings: عروض_البيع_tbl[];
  isLoading: boolean;
  listingMarketingFilter: 'all' | 'sale-only' | 'also-rentable';
  setListingMarketingFilter: (value: 'all' | 'sale-only' | 'also-rentable') => void;
  statusFilter: string;
  searchQuery: string;
}

export const SalesListingsTab: React.FC<SalesListingsTabProps> = ({
  listings: _listings,
  isLoading,
  listingMarketingFilter,
  setListingMarketingFilter,
  statusFilter: _statusFilter,
  searchQuery: _searchQuery
}) => {
  if (isLoading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-900/30 p-4 rounded-[1.5rem] border border-slate-100 dark:border-slate-800">
        <label
          htmlFor="listingMarketingFilter"
          className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest"
        >
          {t('تصنيف عروض البيع حسب الإيجار')}
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <select
            id="listingMarketingFilter"
            aria-label={t('تصنيف عروض البيع حسب الإيجار')}
            value={listingMarketingFilter}
            onChange={(e) => {
              const next = String(e.target.value || '').trim();
              if (next === 'all' || next === 'sale-only' || next === 'also-rentable') {
setListingMarketingFilter(next as 'all' | 'sale-only' | 'also-rentable');
              }
            }}
            className="border-none p-3 px-5 rounded-xl text-xs font-black bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 shadow-soft outline-none ring-1 ring-slate-200 dark:ring-slate-700 focus:ring-2 focus:ring-indigo-500/20 transition-all"
          >
            <option value="all">{t('الكل')}</option>
            <option value="also-rentable">{t('معروضة للبيع (قد تكون للإيجار أيضاً)')}</option>
            <option value="sale-only">{t('للبيع فقط (غير متاح للإيجار)')}</option>
          </select>
          <Button
            type="button"
            variant="outline"
            className="rounded-xl text-xs font-black"
            onClick={() => setListingMarketingFilter('all')}
          >
            {t('مسح الفلاتر')}
          </Button>
        </div>
      </div>

      <div className="text-center py-12">
        <h3 className="text-xl font-bold text-gray-500">جدول عروض البيع</h3>
        <p className="text-gray-400 mt-2">قيد التنفيذ</p>
      </div>
    </div>
  );
};