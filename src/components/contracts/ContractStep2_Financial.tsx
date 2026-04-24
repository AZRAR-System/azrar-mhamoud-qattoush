import React from 'react';
import { FinancialStepProps } from './types';
import { DatePicker } from '@/components/ui/DatePicker';
import { CurrencySuffix } from '@/components/ui/CurrencySuffix';
import { Calculator } from 'lucide-react';
import { formatCurrencyJOD } from '@/utils/format';
import { normalizeDigitsToLatin, parseIntOrUndefined, parseNumberOrUndefined } from '@/utils/numberInput';
import { roundCurrency } from '@/utils/format';
import { PaymentMethodType } from '@/types';
import { DynamicSelect } from '@/components/ui/DynamicSelect';
import { tafkeet } from '@/utils/tafkeet';

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
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-bold mb-1">{t('تاريخ البداية')}</label>
          <DatePicker
            value={contract.تاريخ_البداية}
            onChange={(d) => setContract((prev) => ({ ...prev, تاريخ_البداية: d }))}
          />
        </div>
        <div>
          <label htmlFor={`${baseId}-months`} className="block text-[10px] uppercase font-black text-slate-500 mb-1 tracking-widest text-center">{t('المدة (أشهر)')}</label>
          <input
            id={`${baseId}-months`}
            type="text"
            inputMode="numeric"
            className="w-full bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 p-3 rounded-xl text-lg font-black shadow-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 outline-none transition-all text-center"
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
          <label htmlFor={`${baseId}-annual`} className="block text-[10px] uppercase font-black text-slate-500 mb-1 tracking-widest text-center">{t('القيمة السنوية')}</label>
          <div className="relative">
            <input
              id={`${baseId}-annual`}
              type="text"
              inputMode="decimal"
              className="w-full bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 p-3 rounded-xl text-lg font-black shadow-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 outline-none transition-all text-center text-indigo-700 dark:text-indigo-400"
              dir="ltr"
              value={contract.القيمة_السنوية ?? ''}
              onChange={(e) => {
                const raw = normalizeDigitsToLatin(e.target.value);
                const n = parseNumberOrUndefined(raw);
                setContract((prev) => ({ ...prev, القيمة_السنوية: n }));
              }}
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400 pointer-events-none">
              <CurrencySuffix />
            </span>
          </div>
        </div>

        <div>
          <label className="block text-[10px] uppercase font-black text-slate-500 mb-1 tracking-widest text-center">{t('قيمة التأمين')}</label>
          <div className="relative">
            <input
              type="text"
              inputMode="decimal"
              className="w-full bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 p-3 rounded-xl text-lg font-black shadow-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 outline-none transition-all text-center text-emerald-700 dark:text-emerald-400"
              dir="ltr"
              value={contract.قيمة_التأمين ?? ''}
              onChange={(e) => {
                const raw = normalizeDigitsToLatin(e.target.value);
                const n = parseNumberOrUndefined(raw);
                setContract((prev) => ({ ...prev, قيمة_التأمين: n }));
              }}
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400 pointer-events-none">
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
         
         <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold mb-1">{t('نمط الدفع')}</label>
              <select 
                className="w-full border border-gray-200 dark:border-slate-600 p-2 rounded-lg bg-white dark:bg-slate-700 text-sm shadow-sm transition-all focus:ring-2 focus:ring-indigo-500"
                value={contract.تكرار_الدفع || 12}
                onChange={(e) => setContract(prev => ({ ...prev, تكرار_الدفع: Number(e.target.value) }))}
              >
                <option value={12}>{t('كل شهر (شهري)')}</option>
                <option value={6}>{t('كل شهرين')}</option>
                <option value={4}>{t('كل 3 شهور (ربع سنوي)')}</option>
                <option value={3}>{t('كل 4 شهور')}</option>
                <option value={2}>{t('كل 6 شهور (نصف سنوي)')}</option>
                <option value={1}>{t('كل سنة (دفعة كاملة)')}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold mb-1">{t('نوع التحصيل')}</label>
              <select 
                className="w-full border border-gray-200 dark:border-slate-600 p-2 rounded-lg bg-white dark:bg-slate-700 text-sm shadow-sm"
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
                className="w-full border border-gray-200 dark:border-slate-600 p-2 rounded-lg bg-white dark:bg-slate-700 text-sm shadow-sm"
                value={contract.يوم_الدفع || 1}
                onChange={(e) => setContract(prev => ({ ...prev, يوم_الدفع: Number(e.target.value) }))}
              >
                {Array.from({length: 28}, (_, i) => i + 1).map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
         </div>

         <div className="pt-2 border-t border-dashed border-gray-200 dark:border-slate-700">
             <label className="flex items-center gap-2 cursor-pointer group">
                <input 
                  type="checkbox" 
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                  checked={Boolean(contract.بداية_المرحلة_الثانية_من_شهر)}
                  onChange={e => setContract(prev => ({ 
                    ...prev, 
                    بداية_المرحلة_الثانية_من_شهر: e.target.checked ? 6 : undefined,
                    تكرار_الدفع_المرحلة_الثانية: e.target.checked ? 4 : undefined
                  }))}
                />
                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 group-hover:text-indigo-700 transition-colors">
                  {t('تفعيل نمط دفع هجين (تغيير التكرار منتصف العقد)')}
                </span>
             </label>
             
             {contract.بداية_المرحلة_الثانية_من_شهر !== undefined && (
               <div className="mt-3 grid grid-cols-2 gap-4 p-4 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-xl border border-indigo-100 dark:border-indigo-900/30 animate-slide-down">
                  <div>
                    <label className="block text-[10px] font-bold mb-1 text-slate-500 uppercase">{t('ابدأ النمط الجديد من الشهر رقم')}</label>
                    <input 
                      type="number" 
                      className="w-full border border-gray-200 dark:border-slate-600 p-2 rounded-lg text-sm bg-white dark:bg-slate-800" 
                      value={contract.بداية_المرحلة_الثانية_من_شهر}
                      min={1}
                      max={contract.مدة_العقد_بالاشهر || 12}
                      onChange={e => setContract(prev => ({ ...prev, بداية_المرحلة_الثانية_من_شهر: Number(e.target.value) }))}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold mb-1 text-slate-500 uppercase">{t('التكرار الجديد')}</label>
                    <select 
                      className="w-full border border-gray-200 dark:border-slate-600 p-2 rounded-lg text-sm bg-white dark:bg-slate-800"
                      value={contract.تكرار_الدفع_المرحلة_الثانية || 4}
                      onChange={e => setContract(prev => ({ ...prev, تكرار_الدفع_المرحلة_الثانية: Number(e.target.value) }))}
                    >
                      <option value={12}>{t('كل شهر (شهري)')}</option>
                      <option value={6}>{t('كل شهرين')}</option>
                      <option value={4}>{t('كل 3 شهور (ربع سنوي)')}</option>
                      <option value={3}>{t('كل 4 شهور')}</option>
                      <option value={2}>{t('كل 6 شهور (نصف سنوي)')}</option>
                      <option value={1}>{t('كل سنة (دفعة كاملة)')}</option>
                    </select>
                  </div>
               </div>
             )}
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
                      className="w-full bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 p-2 rounded-xl text-center font-black text-indigo-600 focus:border-indigo-500 outline-none transition-all" 
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
                      className="w-full bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 p-2 rounded-xl text-center font-black text-indigo-600 focus:border-indigo-500 outline-none transition-all" 
                      placeholder={t('قيمة الدفعة يدوياً')}
                      value={contract.قيمة_الدفعة_الاولى || ''}
                      onChange={e => setContract(prev => ({ ...prev, قيمة_الدفعة_الاولى: Number(normalizeDigitsToLatin(e.target.value)) }))}
                   />
                 )}
              </div>
           </div>
         )}
      </div>


       <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800 animate-slide-up">
          <div className="group">
             <div className="flex justify-between items-center mb-1">
                <label className="text-[10px] uppercase font-black text-slate-500 dark:text-slate-400 tracking-widest">{t('بدل الإيجار (كتابة)')}</label>
                <button 
                  type="button"
                  onClick={() => setContract(prev => ({ ...prev, نص_بدل_الإيجار: tafkeet(prev.القيمة_السنوية || 0) }))}
                  className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                >
                  ✨ {t('توليد تلقائي من القيمة')}
                </button>
             </div>
             <input 
               type="text" 
               className="w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 p-3 rounded-xl text-sm font-medium shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
               value={contract.نص_بدل_الإيجار || ''}
               onChange={e => setContract(prev => ({ ...prev, نص_بدل_الإيجار: e.target.value }))}
               placeholder={t('أدخل قيمة الإيجار كتابياً...')}
             />
          </div>

          <DynamicSelect 
             label={t('كيفية أداء البدل (كتابة)')}
             category="contract_rent_payment_text"
             value={contract.نص_كيفية_أداء_البدل}
             placeholder={t('مثال: تدفع مقدماً بأقساط شهرية بقيمة...')}
             onChange={val => setContract(prev => ({ ...prev, نص_كيفية_أداء_البدل: val }))}
          />
       </div>
    </div>
  );
};
