import React from 'react';
import { ContractStepProps } from './types';
import { CheckCircle } from 'lucide-react';

export const ContractSettlement: React.FC<ContractStepProps> = ({
  t,
}) => {
  return (
    <div className="space-y-6 animate-fade-in text-center py-10">
      <div className="flex justify-center mb-4">
        <CheckCircle size={64} className="text-emerald-500" />
      </div>
      <h3 className="text-2xl font-bold text-slate-800 dark:text-white">
        {t('تسوية وإغلاق العقد')}
      </h3>
      <p className="text-slate-500 max-w-md mx-auto">
        {t('هذه الشاشة مخصصة لإجراء المخالصات النهائية وحل الالتزامات المالية المتبقية عند إنهاء العقد.')}
      </p>
      
      <div className="mt-8 p-6 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
         <span className="text-sm text-slate-400 italic">{t('سيتم إضافة أدوات التسوية في التحديث القادم...')}</span>
      </div>
    </div>
  );
};
