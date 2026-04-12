import React from 'react';
import { Button } from '@/components/ui/Button';
import { LoadingSkeleton } from './LoadingSkeleton';
import { عروض_البيع_tbl } from '@/types';
import { formatCurrencyJOD, formatDateYMD } from '@/utils/format';
import { Eye, Edit, Trash2, Plus } from 'lucide-react';

const t = (s: string) => s;

interface SalesListingsTabProps {
  listings: عروض_البيع_tbl[];
  isLoading: boolean;
  listingMarketingFilter: 'all' | 'sale-only' | 'also-rentable';
  setListingMarketingFilter: (value: 'all' | 'sale-only' | 'also-rentable') => void;
  statusFilter: string;
  searchQuery: string;
  getPropertyLabel: (id: string) => string;
  getPersonName: (id: string) => string;
  onView?: (listing: عروض_البيع_tbl) => void;
  onEdit?: (listing: عروض_البيع_tbl) => void;
  onDelete?: (listing: عروض_البيع_tbl) => void;
  onCreateOffer?: (listing: عروض_البيع_tbl) => void;
}

export const SalesListingsTab: React.FC<SalesListingsTabProps> = ({
  listings,
  isLoading,
  listingMarketingFilter,
  setListingMarketingFilter,
  statusFilter: _statusFilter,
  searchQuery: _searchQuery,
  getPropertyLabel,
  getPersonName,
  onView,
  onEdit,
  onDelete,
  onCreateOffer
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

      <div className="overflow-x-auto">
        {listings.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            لا توجد عروض بيع حالياً
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest p-4 text-right">العقار</th>
                <th className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest p-4 text-right">المالك</th>
                <th className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest p-4 text-right">السعر المطلوب</th>
                <th className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest p-4 text-right">الحالة</th>
                <th className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest p-4 text-right">تاريخ العرض</th>
                <th className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest p-4 text-right">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {listings.map((listing) => (
                <tr key={listing.id} className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="p-4 font-bold text-slate-800 dark:text-slate-200">{getPropertyLabel(listing.رقم_العقار)}</td>
                  <td className="p-4 text-slate-600 dark:text-slate-400">{getPersonName(listing.رقم_المالك)}</td>
                  <td className="p-4 font-bold text-indigo-600 dark:text-indigo-400">{formatCurrencyJOD(listing.السعر_المطلوب)}</td>
                  <td className="p-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      listing.الحالة === 'Active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                      listing.الحالة === 'Sold' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                      listing.الحالة === 'Cancelled' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                      'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                    }`}>
                      {listing.الحالة}
                    </span>
                  </td>
                  <td className="p-4 text-slate-600 dark:text-slate-400">{formatDateYMD(listing.تاريخ_العرض)}</td>
                  <td className="p-4">
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => onView?.(listing)}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-500 hover:text-indigo-600 transition-colors"
                        title="عرض"
                      >
                        <Eye size={18} />
                      </button>
                      <button
                        onClick={() => onEdit?.(listing)}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-500 hover:text-indigo-600 transition-colors"
                        title="تعديل"
                      >
                        <Edit size={18} />
                      </button>
                      <button
                        onClick={() => onCreateOffer?.(listing)}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-500 hover:text-green-600 transition-colors"
                        title="إضافة عرض شراء"
                      >
                        <Plus size={18} />
                      </button>
                      <button
                        onClick={() => onDelete?.(listing)}
                        className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-slate-500 hover:text-red-600 transition-colors"
                        title="حذف"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
