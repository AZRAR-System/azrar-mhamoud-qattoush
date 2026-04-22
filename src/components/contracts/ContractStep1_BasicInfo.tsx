import React from 'react';
import { ContractStepProps } from './types';
import { PersonPicker } from '@/components/shared/PersonPicker';
import { PropertyPicker } from '@/components/shared/PropertyPicker';

export const ContractStep1_BasicInfo: React.FC<ContractStepProps> = ({
  contract,
  setContract,
  t,
}) => {
  return (
    <div className="space-y-6 animate-fade-in">
      <h4 className="text-lg font-bold border-b pb-2">{t('1. اختيار العقار والأطراف')}</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold mb-2">{t('العقار')}</label>
            <PropertyPicker
              value={contract.رقم_العقار || ''}
              onChange={(id, code) =>
                setContract((prev) => ({ ...prev, رقم_العقار: id, propertyCode: code }))
              }
            />
          </div>
          <div>
            <label className="block text-sm font-bold mb-2">{t('المستأجر')}</label>
            <PersonPicker
              value={contract.رقم_المستاجر || ''}
              onChange={(id) => setContract((prev) => ({ ...prev, رقم_المستاجر: id }))}
            />
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold mb-1">{t('رقم الفرصة (اختياري)')}</label>
            <input
              type="text"
              className="w-full border border-gray-300 dark:border-slate-600 p-2 rounded-lg bg-white dark:bg-slate-700"
              value={contract.رقم_الفرصة || ''}
              onChange={(e) => setContract((prev) => ({ ...prev, رقم_الفرصة: e.target.value }))}
              placeholder={t('مثال: OP-12345')}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold mb-1">{t('رقم المبنى')}</label>
              <input
                type="text"
                className="w-full border border-gray-300 dark:border-slate-600 p-2 rounded-lg bg-white dark:bg-slate-700"
                value={contract.رقم_المبنى || ''}
                onChange={(e) => setContract((prev) => ({ ...prev, رقم_المبنى: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1">{t('رقم الكفيل (اختياري)')}</label>
              <PersonPicker
                value={contract.رقم_الكفيل_1 || ''}
                onChange={(id) => setContract((prev) => ({ ...prev, رقم_الكفيل_1: id }))}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
