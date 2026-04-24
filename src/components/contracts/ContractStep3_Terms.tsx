import React from 'react';
import { TermsStepProps } from './types';
import { HandCoins, AlertTriangle } from 'lucide-react';
import { normalizeDigitsToLatin } from '@/utils/numberInput';
import { CurrencySuffix } from '@/components/ui/CurrencySuffix';
import { DynamicFieldsSection } from '@/components/dynamic/DynamicFieldsSection';

export const ContractStep3_Terms: React.FC<TermsStepProps> = ({
  contract,
  setContract,
  t,
  commOwner,
  setCommOwner,
  commTenant,
  setCommTenant,
  commissionPaidMonth,
  setCommissionPaidMonth,
  isEditMode,
  dynamicValues,
  setDynamicValues,
  hasPaidInstallments,
  regenerateInstallments,
  setRegenerateInstallments,
}) => {
  return (
    <div className="space-y-6 animate-fade-in">
      <h4 className="text-lg font-bold border-b pb-2">{t('3. الشروط والعمولات')}</h4>

      <div className="bg-red-50 dark:bg-red-900/10 p-4 rounded-xl border border-red-100 dark:border-red-900/30">
        <h5 className="font-bold mb-3 flex items-center gap-2 text-red-800 dark:text-red-400">
          <AlertTriangle size={16} /> {t('إعدادات غرامات التأخير')}
        </h5>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-bold mb-1">{t('نوع الغرامة')}</label>
            <select
              className="w-full border border-gray-300 dark:border-slate-600 p-2 rounded-lg bg-white dark:bg-slate-700 text-sm"
              value={contract.lateFeeType || 'none'}
              onChange={(e) => setContract(prev => ({ ...prev, lateFeeType: e.target.value as 'fixed' | 'percentage' | 'daily' | 'none' }))}
            >
              <option value="none">{t('بدون غرامات')}</option>
              <option value="fixed">{t('مبلغ ثابت')}</option>
              <option value="percentage">{t('نسبة مئوية')}</option>
              <option value="daily">{t('غرامة يومية')}</option>
            </select>
          </div>
          {contract.lateFeeType !== 'none' && (
             <div>
               <label className="block text-xs font-bold mb-1">{t('القيمة')}</label>
               <input 
                 type="number" 
                 className="w-full border p-2 rounded-lg text-sm" 
                 value={contract.lateFeeValue || 0}
                 onChange={e => setContract(prev => ({ ...prev, lateFeeValue: Number(e.target.value) }))}
               />
             </div>
          )}
        </div>
      </div>

      <div className="bg-gradient-to-br from-indigo-50/50 to-purple-50/50 dark:from-slate-800/50 dark:to-indigo-900/20 p-5 rounded-2xl border border-indigo-100/50 dark:border-indigo-500/20 shadow-xl backdrop-blur-md">
        <h5 className="font-bold text-indigo-900 dark:text-indigo-300 flex items-center gap-2 mb-4">
          <HandCoins size={20} className="text-indigo-600" /> {t('العمولات المالية')}
        </h5>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           {/* Tenant Commission */}
           <div className="group">
              <label className="text-[11px] uppercase font-black text-indigo-600 dark:text-indigo-400 mb-2 block tracking-widest text-center">{t('عمولة المستأجر')}</label>
              <div className="relative group-focus-within:scale-[1.05] transition-all duration-300">
                <input
                  type="text"
                  className="w-full bg-white/80 dark:bg-slate-800/90 border-2 border-indigo-100 dark:border-slate-700 p-4 rounded-2xl text-xl font-black shadow-lg focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 focus:outline-none transition-all text-center text-indigo-700 dark:text-indigo-300"
                  value={commTenant}
                  onChange={(e) => setCommTenant(Number(normalizeDigitsToLatin(e.target.value)) || '')}
                />
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-black text-indigo-400/40 pointer-events-none">
                  <CurrencySuffix />
                </span>
              </div>
           </div>
           {/* Owner Commission */}
           <div className="group">
              <label className="text-[11px] uppercase font-black text-indigo-600 dark:text-indigo-400 mb-2 block tracking-widest text-center">{t('عمولة المالك')}</label>
              <div className="relative group-focus-within:scale-[1.05] transition-all duration-300">
                <input
                  type="text"
                  className="w-full bg-white/80 dark:bg-slate-800/90 border-2 border-indigo-100 dark:border-slate-700 p-4 rounded-2xl text-xl font-black shadow-lg focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 focus:outline-none transition-all text-center text-indigo-700 dark:text-indigo-300"
                  value={commOwner}
                  onChange={(e) => setCommOwner(Number(normalizeDigitsToLatin(e.target.value)) || '')}
                />
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-black text-indigo-400/40 pointer-events-none">
                  <CurrencySuffix />
                </span>
              </div>
           </div>
           {/* Month */}
           <div className="group">
              <label className="text-[11px] uppercase font-black text-indigo-600 dark:text-indigo-400 mb-2 block tracking-widest text-center">{t('شهر تحصيل العمولة')}</label>
              <input 
                type="text" 
                className="w-full bg-white/80 dark:bg-slate-800/90 border-2 border-indigo-100 dark:border-slate-700 p-4 rounded-2xl text-lg font-black shadow-lg focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 focus:outline-none transition-all text-center"
                placeholder="YYYY-MM"
                value={commissionPaidMonth}
                onChange={e => setCommissionPaidMonth(e.target.value)}
              />
           </div>
        </div>
      </div>

      <DynamicFieldsSection
        formId="contracts"
        values={dynamicValues}
        onChange={setDynamicValues}
      />
      
      {isEditMode && (
         <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <label className="flex items-center gap-2 font-bold text-amber-800">
               <input 
                 type="checkbox" 
                 checked={regenerateInstallments} 
                 disabled={hasPaidInstallments}
                 onChange={e => setRegenerateInstallments(e.target.checked)}
               />
               {t('إعادة توليد جدول الدفعات عند الحفظ')}
            </label>
         </div>
      )}
    </div>
  );
};
