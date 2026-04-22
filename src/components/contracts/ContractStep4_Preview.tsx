import React, { useState } from 'react';
import { PreviewStepProps, InstallmentPreviewRow } from './types';
import { formatCurrencyJOD } from '@/utils/format';
import { Pencil, Save, X, AlertCircle } from 'lucide-react';
import { normalizeDigitsToLatin } from '@/utils/numberInput';

export const ContractStep4_Preview: React.FC<PreviewStepProps> = ({
  contract,
  t,
  installmentsPreview,
  setInstallmentsPreview,
}) => {
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editValue, setEditValue] = useState<Partial<InstallmentPreviewRow>>({});

  const totalAmount = installmentsPreview.reduce((sum, i) => sum + i.amount, 0);
  const annualRent = Number(contract.القيمة_السنوية || 0);
  const diff = totalAmount - annualRent;

  const startEdit = (idx: number, i: InstallmentPreviewRow) => {
    setEditingIdx(idx);
    setEditValue({ ...i });
  };

  const saveEdit = () => {
    if (editingIdx === null) return;
    const updated = [...installmentsPreview];
    updated[editingIdx] = { 
      ...updated[editingIdx], 
      ...editValue, 
      isManual: true 
    } as InstallmentPreviewRow;
    setInstallmentsPreview(updated);
    setEditingIdx(null);
  };

  return (
    <div className="space-y-6 animate-fade-in relative">
      <div className="bg-gray-50 dark:bg-slate-900/50 p-4 rounded-xl border border-gray-200 dark:border-slate-700 max-h-96 overflow-auto">
        <h5 className="font-bold mb-4 flex items-center justify-between">
          <span className="flex items-center gap-2">📋 {t('جدول الدفعات المتوقع')}</span>
          <div className="flex gap-2">
            {Math.abs(diff) > 0.01 && (
               <div className="flex items-center gap-1 text-[10px] bg-amber-100 text-amber-700 px-2 py-1 rounded border border-amber-200 animate-pulse">
                <AlertCircle size={10} />
                {t('فرق عن السنوي:')} {formatCurrencyJOD(diff)}
               </div>
            )}
            <span className="bg-indigo-100 dark:bg-indigo-900/40 px-3 py-1 rounded-full text-xs text-indigo-700 dark:text-indigo-300 font-bold">
               {installmentsPreview.length} {t('دفعة')}
            </span>
          </div>
        </h5>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[600px] border-collapse" dir="rtl">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800 border-b-2 border-indigo-500">
                <th className="p-3 text-right text-xs w-12">#</th>
                <th className="p-3 text-right text-xs w-32">{t('النوع')}</th>
                <th className="p-3 text-right text-xs">{t('التاريخ')}</th>
                <th className="p-3 text-left text-xs w-44">{t('المبلغ')}</th>
                <th className="p-3 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {installmentsPreview.map((i, idx) => (
                <tr
                  key={idx}
                  className={`border-b transition ${
                    i.isManual ? 'bg-indigo-50/50 dark:bg-indigo-900/20' : ''
                  } hover:bg-slate-50 dark:hover:bg-slate-800/50`}
                >
                  <td className="p-3 text-right font-bold text-slate-400">{i.rank}</td>
                  <td className="p-3 text-right">
                    <div className="flex flex-col">
                       <span className={`px-2 py-0.5 rounded text-[10px] font-bold w-fit ${i.type === 'تأمين' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{t(i.type)}</span>
                       {i.isManual && <span className="text-[9px] text-indigo-500 font-bold mt-1">● {t('معدل يدوياً')}</span>}
                    </div>
                  </td>
                  <td className="p-3 text-right">
                   {editingIdx === idx ? (
                     <input 
                       type="date" 
                       className="border p-1 rounded text-xs" 
                       value={editValue.date} 
                       onChange={e => setEditValue(prev => ({ ...prev, date: e.target.value }))}
                     />
                   ) : i.date}
                  </td>
                  <td className="p-3 text-left font-bold tabular-nums">
                   {editingIdx === idx ? (
                     <input 
                       type="text" 
                       className="border p-1 rounded text-xs w-24" 
                       value={editValue.amount} 
                       onChange={e => setEditValue(prev => ({ ...prev, amount: Number(normalizeDigitsToLatin(e.target.value)) }))}
                     />
                   ) : formatCurrencyJOD(i.amount)}
                  </td>
                  <td className="p-3 text-center">
                    {editingIdx === idx ? (
                      <div className="flex gap-1 justify-center">
                        <button onClick={saveEdit} className="p-1 bg-green-100 text-green-700 rounded hover:bg-green-200"><Save size={14} /></button>
                        <button onClick={() => setEditingIdx(null)} className="p-1 bg-red-100 text-red-700 rounded hover:bg-red-200"><X size={14} /></button>
                      </div>
                    ) : (
                      <button onClick={() => startEdit(idx, i)} className="p-1 text-slate-400 hover:text-indigo-600 transition"><Pencil size={14} /></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {Math.abs(diff) > 0.01 && (
         <div className="p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-xl flex items-start gap-3">
            <AlertCircle className="text-amber-600 flex-shrink-0 mt-0.5" size={18} />
            <div className="text-sm text-amber-800 dark:text-amber-200">
               <p className="font-bold">{t('تنبيه: فرق في إجمالي الأقساط')}</p>
               <p>{t('المجموع الحالي يزيد بمقدار')} <span className="font-bold">{formatCurrencyJOD(diff)}</span> {t('عن الإيجار السنوي المقدر.')}</p>
            </div>
         </div>
      )}
    </div>
  );
};
