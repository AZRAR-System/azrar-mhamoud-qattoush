import React from 'react';
import { FinancialStepProps } from './types';
import { DatePicker } from '@/components/ui/DatePicker';
import { CurrencySuffix } from '@/components/ui/CurrencySuffix';
import { Calculator } from 'lucide-react';
import { formatCurrencyJOD } from '@/utils/format';
import { normalizeDigitsToLatin, parseIntOrUndefined, parseNumberOrUndefined } from '@/utils/numberInput';
import { roundCurrency } from '@/utils/format';
import { PaymentMethodType } from '@/types';

export const ContractStep2_Financial: React.FC<FinancialStepProps> = ({
  contract,
  setContract,
  baseId,
  t,
  dayDiffValue,
  contractValueInfo,
}) => {
  return (
    <div className="space-y-6 animate-fade-in">
      <h4 className="text-lg font-bold border-b pb-2">{t('2. البيانات المالية')}</h4>
      
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-bold mb-1">{t('تاريخ البداية')}</label>
          <DatePicker
            value={contract.تاريخ_البداية}
            onChange={(d) => setContract((prev) => ({ ...prev, تاريخ_البداية: d }))}
          />
        </div>
        <div>
          <label htmlFor={`${baseId}-months`} className="block text-sm font-bold mb-1">{t('المدة (أشهر)')}</label>
          <input
            id={`${baseId}-months`}
            type="text"
            inputMode="numeric"
            className="w-full border border-gray-300 dark:border-slate-600 p-2 rounded-lg bg-white dark:bg-slate-700"
            dir="ltr"
            value={contract.مدة_العقد_بالاشهر ?? ''}
            onChange={(e) => {
              const raw = normalizeDigitsToLatin(e.target.value);
              const n = parseIntOrUndefined(raw);
              setContract((prev) => ({ ...prev, مدة_العقد_بالاشهر: n }));
            }}
          />
        </div>
        <div>
          <label htmlFor={`${baseId}-annual`} className="block text-sm font-bold mb-1">{t('القيمة السنوية')}</label>
          <div className="relative">
            <input
              id={`${baseId}-annual`}
              type="text"
              inputMode="decimal"
              className="w-full border border-gray-300 dark:border-slate-600 p-2 pr-10 rounded-lg bg-white dark:bg-slate-700"
              dir="ltr"
              value={contract.القيمة_السنوية ?? ''}
              onChange={(e) => {
                const raw = normalizeDigitsToLatin(e.target.value);
                const n = parseNumberOrUndefined(raw);
                setContract((prev) => ({ ...prev, القيمة_السنوية: n }));
              }}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
              <CurrencySuffix />
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-emerald-50 dark:bg-emerald-900/10 p-3 rounded-lg border border-emerald-100">
           <div className="text-[10px] uppercase font-bold text-emerald-800">{t('شهري')}</div>
           <div className="text-lg font-black text-emerald-700">{formatCurrencyJOD(contractValueInfo.monthly)}</div>
        </div>
        <div className="bg-indigo-50 dark:bg-indigo-900/10 p-3 rounded-lg border border-indigo-100">
           <div className="text-[10px] uppercase font-bold text-indigo-800">{t('إجمالي العقد')}</div>
           <div className="text-lg font-black text-indigo-700">{formatCurrencyJOD(contractValueInfo.total)}</div>
        </div>
        <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-lg flex items-center justify-center">
           <div className="text-xs font-bold text-slate-600">{contractValueInfo.months} {t('شهر')}</div>
        </div>
      </div>

      <div className="bg-gray-50 dark:bg-slate-900/50 p-4 rounded-xl border border-gray-200 dark:border-slate-700 space-y-4">
         <h5 className="font-bold flex items-center gap-2"><Calculator size={16} /> {t('تفاصيل الدفع والفرقية')}</h5>
         
         <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold mb-1">{t('طريقة الدفع')}</label>
              <select 
                className="w-full border p-2 rounded-lg bg-white dark:bg-slate-700 text-sm"
                value={contract.طريقة_الدفع}
                onChange={(e) => setContract(prev => ({ ...prev, طريقة_الدفع: e.target.value as PaymentMethodType }))}
              >
                <option value="Prepaid">{t('دفع مقدم')}</option>
                <option value="Postpaid">{t('دفع مؤخر')}</option>
                <option value="DownPayment_Monthly">{t('دفعة أولى + شهري')}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold mb-1">{t('يوم الدفع')}</label>
              <select 
                className="w-full border p-2 rounded-lg bg-white dark:bg-slate-700 text-sm"
                value={contract.يوم_الدفع || 1}
                onChange={(e) => setContract(prev => ({ ...prev, يوم_الدفع: Number(e.target.value) }))}
              >
                {Array.from({length: 28}, (_, i) => i + 1).map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
         </div>

         <div className="flex gap-4 p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200">
            <label className="flex items-center gap-2 cursor-pointer">
              <input 
                type="checkbox" 
                checked={!!contract.احتساب_فرق_ايام} 
                onChange={e => setContract(prev => ({ ...prev, احتساب_فرق_ايام: e.target.checked }))}
              />
              <span className="text-sm font-bold">{t('احتساب فرقية أيام')} ({formatCurrencyJOD(dayDiffValue)})</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input 
                type="checkbox" 
                checked={!!contract.يوجد_دفعة_اولى} 
                onChange={e => setContract(prev => ({ ...prev, يوجد_دفعة_اولى: e.target.checked }))}
              />
              <span className="text-sm font-bold">{t('يوجد دفعة أولى')}</span>
            </label>
         </div>

         {contract.يوجد_دفعة_اولى && (
           <div className="p-4 bg-indigo-50/30 border border-indigo-100 rounded-lg animate-slide-down space-y-3">
              <div className="flex items-center gap-3">
                 <input 
                    type="checkbox" 
                    checked={Number(contract.عدد_أشهر_الدفعة_الأولى || 0) > 0} 
                    onChange={e => setContract(prev => ({ ...prev, عدد_أشهر_الدفعة_الأولى: e.target.checked ? 3 : undefined }))}
                 />
                 <span className="text-xs font-bold">{t('دفعة أولى تغطي عدد أشهر محدد')}</span>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                 {Number(contract.عدد_أشهر_الدفعة_الأولى || 0) > 0 ? (
                   <>
                    <input 
                      type="number" 
                      className="border p-2 rounded-lg text-sm" 
                      placeholder={t('عدد الأشهر')}
                      value={contract.عدد_أشهر_الدفعة_الأولى}
                      onChange={e => setContract(prev => ({ ...prev, عدد_أشهر_الدفعة_الأولى: Number(e.target.value) }))}
                    />
                    <div className="bg-white p-2 rounded-lg border font-bold text-center text-sm text-indigo-600">
                       {formatCurrencyJOD(roundCurrency((contractValueInfo.monthly) * (contract.عدد_أشهر_الدفعة_الأولى || 0)))}
                    </div>
                   </>
                 ) : (
                   <input 
                      type="text" 
                      className="w-full border p-2 rounded-lg text-sm" 
                      placeholder={t('قيمة الدفعة يدوياً')}
                      value={contract.قيمة_الدفعة_الاولى || ''}
                      onChange={e => setContract(prev => ({ ...prev, قيمة_الدفعة_الاولى: Number(normalizeDigitsToLatin(e.target.value)) }))}
                   />
                 )}
              </div>
           </div>
         )}
      </div>
    </div>
  );
};
