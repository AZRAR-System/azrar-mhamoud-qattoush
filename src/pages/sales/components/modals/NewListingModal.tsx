import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { BadgeDollarSign } from 'lucide-react';
import { عروض_البيع_tbl } from '@/types';

const t = (s: string) => s;

interface NewListingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (listing: Partial<عروض_البيع_tbl>) => void;
}

export const NewListingModal: React.FC<NewListingModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    عقار_الرقم: '',
    السعر_المطلوب: '',
    ملاحظات: '',
    متاح_للإيجار_أيضا: false
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      عقار_الرقم: Number(formData.عقار_الرقم),
      السعر_المطلوب: Number(formData.السعر_المطلوب),
      ملاحظات: formData.ملاحظات,
      متاح_للإيجار_أيضا: formData.متاح_للإيجار_أيضا
    });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('عرض بيع جديد')} icon={<BadgeDollarSign size={24} />}>
      <form onSubmit={handleSubmit} className="space-y-6 p-2">
        <div>
          <label className="text-sm font-black text-slate-700 dark:text-slate-300 mb-2 block">
            {t('رقم العقار')}
          </label>
          <Input
            type="number"
            value={formData.عقار_الرقم}
            onChange={(e) => setFormData({ ...formData, عقار_الرقم: e.target.value })}
            placeholder={t('أدخل رقم العقار')}
            required
          />
        </div>

        <div>
          <label className="text-sm font-black text-slate-700 dark:text-slate-300 mb-2 block">
            {t('السعر المطلوب بالدينار الأردني')}
          </label>
          <Input
            type="number"
            step="0.01"
            value={formData.السعر_المطلوب}
            onChange={(e) => setFormData({ ...formData, السعر_المطلوب: e.target.value })}
            placeholder={t('مثال: 250000')}
            required
          />
        </div>

        <div>
          <label className="text-sm font-black text-slate-700 dark:text-slate-300 mb-2 block">
            {t('ملاحظات إضافية')}
          </label>
          <Textarea
            value={formData.ملاحظات}
            onChange={(e) => setFormData({ ...formData, ملاحظات: e.target.value })}
            placeholder={t('أي تفاصيل إضافية تتعلق بعرض البيع')}
            rows={4}
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