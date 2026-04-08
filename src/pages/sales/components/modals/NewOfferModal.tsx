import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { UserPlus } from 'lucide-react';
import { عروض_الشراء_tbl } from '@/types';

const t = (s: string) => s;

interface NewOfferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (offer: Partial<عروض_الشراء_tbl>) => void;
}

export const NewOfferModal: React.FC<NewOfferModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    مشتري_الرقم: '',
    السعر_المعروض: '',
    ملاحظات: '',
    شروط_إضافية: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      مشتري_الرقم: Number(formData.مشتري_الرقم),
      السعر_المعروض: Number(formData.السعر_المعروض),
      ملاحظات: formData.ملاحظات,
      شروط_إضافية: formData.شروط_إضافية
    });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('عرض شراء جديد')} icon={<UserPlus size={24} />}>
      <form onSubmit={handleSubmit} className="space-y-6 p-2">
        <div>
          <label className="text-sm font-black text-slate-700 dark:text-slate-300 mb-2 block">
            {t('رقم المشتري')}
          </label>
          <Input
            type="number"
            value={formData.مشتري_الرقم}
            onChange={(e) => setFormData({ ...formData, مشتري_الرقم: e.target.value })}
            placeholder={t('أدخل رقم المشتري المسجل في النظام')}
            required
          />
        </div>

        <div>
          <label className="text-sm font-black text-slate-700 dark:text-slate-300 mb-2 block">
            {t('السعر المعروض بالدينار الأردني')}
          </label>
          <Input
            type="number"
            step="0.01"
            value={formData.السعر_المعروض}
            onChange={(e) => setFormData({ ...formData, السعر_المعروض: e.target.value })}
            placeholder={t('مثال: 240000')}
            required
          />
        </div>

        <div>
          <label className="text-sm font-black text-slate-700 dark:text-slate-300 mb-2 block">
            {t('ملاحظات المشتري')}
          </label>
          <Textarea
            value={formData.ملاحظات}
            onChange={(e) => setFormData({ ...formData, ملاحظات: e.target.value })}
            placeholder={t('الملاحظات التي ذكرها المشتري في عرضه')}
            rows={3}
          />
        </div>

        <div>
          <label className="text-sm font-black text-slate-700 dark:text-slate-300 mb-2 block">
            {t('شروط إضافية')}
          </label>
          <Textarea
            value={formData.شروط_إضافية}
            onChange={(e) => setFormData({ ...formData, شروط_إضافية: e.target.value })}
            placeholder={t('أي شروط خاصة أو ملاحظات إضافية')}
            rows={2}
          />
        </div>

        <div className="flex gap-4 pt-4 border-t border-slate-100 dark:border-slate-700">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
            {t('إلغاء')}
          </Button>
          <Button type="submit" className="flex-1 bg-indigo-600">
            {t('إضافة عرض الشراء')}
          </Button>
        </div>
      </form>
    </Modal>
  );
};