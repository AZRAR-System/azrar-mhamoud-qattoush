import React from 'react';
import { LoadingSkeleton } from './LoadingSkeleton';
import { اتفاقيات_البيع_tbl, عروض_البيع_tbl } from '@/types';
import { formatCurrencyJOD, formatDateYMD } from '@/utils/format';
import { FileCheck, Clock, CheckCircle2, Pencil } from 'lucide-react';

const t = (s: string) => s;

interface SalesAgreementsTabProps {
  agreements: اتفاقيات_البيع_tbl[];
  isLoading: boolean;
  listings: عروض_البيع_tbl[];
  getPropertyLabel: (id: string) => string;
  getPersonName: (id: string) => string;
  onFinalize: (agreement: اتفاقيات_البيع_tbl) => void;
  onEdit?: (agreement: اتفاقيات_البيع_tbl) => void;
}

export const SalesAgreementsTab: React.FC<SalesAgreementsTabProps> = ({ 
  agreements, 
  isLoading, 
  listings,
  getPropertyLabel,
  getPersonName,
  onFinalize,
  onEdit
}) => {
  if (isLoading) {
    return <LoadingSkeleton />;
  }

  const getListingPropertyLabel = (listingId?: string) => {
    if (!listingId) return t('غير محدد');
    const listing = listings.find(l => l.id === listingId);
    return listing ? getPropertyLabel(listing.رقم_العقار) : t('عقار غير معروف');
  };

  return (
    <div className="overflow-x-auto">
      {agreements.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          {t('لا توجد اتفاقيات بيع حالياً')}
        </div>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700">
              <th className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest p-4 text-right">{t('العقار')}</th>
              <th className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest p-4 text-right">{t('المشتري')}</th>
              <th className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest p-4 text-right">{t('السعر النهائي')}</th>
              <th className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest p-4 text-right">{t('العمولة')}</th>
              <th className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest p-4 text-right">{t('تاريخ التنازل')}</th>
              <th className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest p-4 text-right">{t('الحالة')}</th>
              <th className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest p-4 text-center">{t('الإجراءات')}</th>
            </tr>
          </thead>
          <tbody>
            {agreements.map((agreement) => (
              <tr key={agreement.id} className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                <td className="p-4 font-bold text-slate-800 dark:text-slate-200">
                  {getListingPropertyLabel(agreement.listingId)}
                </td>
                <td className="p-4 text-slate-600 dark:text-slate-400">
                  {getPersonName(agreement.رقم_المشتري)}
                </td>
                <td className="p-4 font-bold text-indigo-600 dark:text-indigo-400">
                  {formatCurrencyJOD(agreement.السعر_النهائي)}
                </td>
                <td className="p-4 text-emerald-600 dark:text-emerald-400 font-bold">
                  {formatCurrencyJOD(agreement.العمولة_الإجمالية)}
                </td>
                <td className="p-4 text-slate-600 dark:text-slate-400">
                  {agreement.transferDate ? formatDateYMD(agreement.transferDate) : t('لم يحدد بعد')}
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    {agreement.isCompleted ? (
                      <span className="flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full text-xs font-bold">
                        <CheckCircle2 size={14} />
                        {t('مكتملة')}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded-full text-xs font-bold">
                        <Clock size={14} />
                        {t('قيد التنفيذ')}
                      </span>
                    )}
                  </div>
                </td>
                <td className="p-4 text-center">
                  <div className="flex items-center justify-center gap-2">
                    {!agreement.isCompleted && (
                      <button
                        onClick={() => onFinalize(agreement)}
                        className="flex items-center gap-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-600/20"
                      >
                        <FileCheck size={14} />
                        {t('إتمام النقل')}
                      </button>
                    )}
                    
                    {!agreement.isCompleted && onEdit && (
                       <button
                        onClick={() => onEdit(agreement)}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 hover:text-indigo-600 rounded-lg transition-colors border border-slate-200 dark:border-slate-700"
                        title={t('تعديل الاتفاقية')}
                      >
                        <Pencil size={14} />
                      </button>
                    )}

                    {agreement.isCompleted && (
                      <div className="text-green-500 font-black text-xs flex items-center justify-center gap-1">
                        <CheckCircle2 size={16} />
                        {t('تم التنازل')}
                      </div>
                    )}
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