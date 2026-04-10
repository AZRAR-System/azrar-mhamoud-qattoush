import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { BadgeDollarSign } from 'lucide-react';
import { Modal } from '@/components/shared/Modal';
import { PropertyPicker } from '@/components/shared/PropertyPicker';
import { عروض_البيع_tbl } from '@/types';

const t = (s: string) => s;

interface NewListingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (listing: Partial<عروض_البيع_tbl>) => void;
  initialData?: Partial<عروض_البيع_tbl> | null;
}

export const NewListingModal: React.FC<NewListingModalProps> = ({ isOpen, onClose, onSubmit, initialData }) => {
  const [formData, setFormData] = React.useState<any>({
    رقم_العقار: '',
    السعر_المطلوب: '',
    ملاحظات: '',
    متاح_للإيجار_أيضا: false
  });

  React.useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setFormData({
          ...initialData,
          السعر_المطلوب: initialData.السعر_المطلوب?.toString() || ''
        });
      } else {
        setFormData({
          رقم_العقار: '',
          السعر_المطلوب: '',
          ملاحظات: '',
          متاح_للإيجار_أيضا: false
        });
      }
    }
  }, [isOpen, initialData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
onSubmit({
      رقم_العقار: formData.رقم_العقار,
      السعر_المطلوب: Number(formData.السعر_المطلوب),
      ملاحظات: formData.ملاحظات,
      متاح_للإيجار_أيضا: formData.متاح_للإيجار_أيضا
    });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('عرض بيع جديد')} icon={<BadgeDollarSign size={24} />}>
      <form onSubmit={handleSubmit} className="space-y-6 p-2">
        <PropertyPicker
          label={t('اختر العقار المعروض للبيع')}
          value={formData.رقم_العقار}
          onChange={(id) => setFormData({ ...formData, رقم_العقار: id })}
          required
        />

        <div>
<label className="text-sm font-black text-slate-700 dark:text-slate-300 mb-2 block">
          {t('السعر المطلوب بالدينار الأردني')}
        </label>
        <Input
          type="number"
          step="0.01"
          value={formData.السعر_المطلوب}
onChange={(e) => setFormData({ ...formData, السعر_المطلوب: Number(e.target.value) })}
          placeholder={t('مثال: 250000')}
          required
        />
        </div>

        <div>
<label className="text-sm font-black text-slate-700 dark:text-slate-300 mb-2 block">
          {t('ملاحظات إضافية')}
        </label>
        <textarea
          className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
          rows={4}
          value={formData.ملاحظات}
          onChange={(e) => setFormData({ ...formData, ملاحظات: e.target.value })}
        />
        </div>

        <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
          <input
            type="checkbox"
            id="alsoRent"
            checked={formData.متاح_للإيجار_أيضا}
            onChange={(e) => setFormData({ ...formData, متاح_للإيجار_أيضا: e.target.checked })}
            className="w-5 h-5 accent-indigo-600"
          />
          <label htmlFor="alsoRent" className="text-sm font-bold text-slate-600 dark:text-slate-300">
            {t('العقار متاح للإيجار أيضاً')}
          </label>
        </div>

        <div className="flex gap-4 pt-4 border-t border-slate-100 dark:border-slate-700">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
            {t('إلغاء')}
          </Button>
          <Button type="submit" className="flex-1 bg-indigo-600">
            {t('إنشاء عرض البيع')}
          </Button>
        </div>
      </form>
    </Modal>
  );
};