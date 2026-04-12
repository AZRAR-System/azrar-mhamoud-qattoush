import React from 'react';
import { LoadingSkeleton } from './LoadingSkeleton';
import { عروض_الشراء_tbl, عروض_البيع_tbl } from '@/types';
import { formatCurrencyJOD, formatDateYMD } from '@/utils/format';
import { CheckCircle, XCircle, Trash2 } from 'lucide-react';

const t = (s: string) => s;

interface SalesOffersTabProps {
  offers: عروض_الشراء_tbl[];
  isLoading: boolean;
  getPropertyLabel: (id: string) => string;
  getPersonName: (id: string) => string;
  listings: عروض_البيع_tbl[];
  onUpdateStatus?: (offerId: string, status: 'Accepted' | 'Rejected') => void;
  onDelete?: (offer: عروض_الشراء_tbl) => void;
}

export const SalesOffersTab: React.FC<SalesOffersTabProps> = ({ 
  offers, 
  isLoading, 
  getPropertyLabel, 
  getPersonName,
  listings,
  onUpdateStatus,
  onDelete
}) => {
  if (isLoading) {
    return <LoadingSkeleton />;
  }

  const getListingPropertyLabel = (listingId: string) => {
    const listing = listings.find(l => l.id === listingId);
    return listing ? getPropertyLabel(listing.رقم_العقار) : t('عقار غير معروف');
  };

  return (
    <div className="overflow-x-auto">
      {offers.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          {t('لا توجد عروض شراء حالياً')}
        </div>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700">
              <th className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest p-4 text-right">{t('المشتري')}</th>
              <th className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest p-4 text-right">{t('العقار المستهدف')}</th>
              <th className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest p-4 text-right">{t('المبلغ المعروض')}</th>
              <th className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest p-4 text-right">{t('الحالة')}</th>
              <th className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest p-4 text-right">{t('تاريخ العرض')}</th>
              <th className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest p-4 text-right">{t('إجراءات')}</th>
            </tr>
          </thead>
          <tbody>
            {offers.map((offer) => (
              <tr key={offer.id} className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                <td className="p-4 font-bold text-slate-800 dark:text-slate-200">
                  {getPersonName(offer.رقم_المشتري || offer.مشتري_الرقم || '')}
                </td>
                <td className="p-4 text-slate-600 dark:text-slate-400">
                  {getListingPropertyLabel(offer.listingId)}
                </td>
                <td className="p-4 font-bold text-emerald-600 dark:text-emerald-400">
                  {formatCurrencyJOD(offer.قيمة_العرض || offer.السعر_المعروض || 0)}
                </td>
                <td className="p-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    offer.الحالة === 'Accepted' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                    offer.الحالة === 'Rejected' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                    'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                  }`}>
                    {offer.الحالة}
                  </span>
                </td>
                <td className="p-4 text-slate-600 dark:text-slate-400">{formatDateYMD(offer.تاريخ_العرض)}</td>
                <td className="p-4">
                  <div className="flex items-center gap-2 justify-end">
                    {offer.الحالة === 'Pending' && (
                      <>
                        <button
                          onClick={() => offer.id && onUpdateStatus?.(offer.id, 'Accepted')}
                          className="p-2 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg text-green-500 hover:text-green-600 transition-colors"
                          title={t('قبول')}
                        >
                          <CheckCircle size={18} />
                        </button>
                        <button
                          onClick={() => offer.id && onUpdateStatus?.(offer.id, 'Rejected')}
                          className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-red-500 hover:text-red-600 transition-colors"
                          title={t('رفض')}
                        >
                          <XCircle size={18} />
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => onDelete?.(offer)}
                      className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-slate-500 hover:text-red-600 transition-colors"
                      title={t('حذف')}
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
  );
};