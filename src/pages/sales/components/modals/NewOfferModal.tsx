import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { UserPlus } from 'lucide-react';
import { Modal } from '@/components/shared/Modal';
import { PersonPicker } from '@/components/shared/PersonPicker';
import { عروض_الشراء_tbl } from '@/types';

const t = (s: string) => s;

interface NewOfferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (offer: Partial<عروض_الشراء_tbl>) => void;
}

export const NewOfferModal: React.FC<NewOfferModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [formData, setFormData] = useState<Partial<عروض_الشراء_tbl>>({
    رقم_المشتري: '',
    قيمة_العرض: 0,
    ملاحظات: '',
    شروط_إضافية: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.رقم_المشتري) return;
    onSubmit({
      ...formData,
      قيمة_العرض: Number(formData.قيمة_العرض)
    });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('عرض شراء جديد')} icon={<UserPlus size={24} />}>
      <form onSubmit={handleSubmit} className="space-y-6 p-2">
        <PersonPicker
          label={t('اختر المشتري')}
          value={formData.رقم_المشتري}
          onChange={(id) => setFormData({ ...formData, رقم_المشتري: id })}
          defaultRole="مشتري"
          required
        />

        <div>
          <label className="text-sm font-black text-slate-700 dark:text-slate-300 mb-2 block">
            {t('السعر المعروض بالدينار الأردني')}
          </label>
          <Input
            type="number"
            step="0.01"
            value={formData.قيمة_العرض}
            onChange={(e) => setFormData({ ...formData, قيمة_العرض: Number(e.target.value) })}
            placeholder={t('مثال: 240000')}
            required
          />
        </div>

        <div>
          <label className="text-sm font-black text-slate-700 dark:text-slate-300 mb-2 block">
            {t('ملاحظات المشتري')}
          </label>
          <textarea
            className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
            rows={3}
            value={formData.ملاحظات}
            onChange={(e) => setFormData({ ...formData, ملاحظات: e.target.value })}
          />
        </div>

        <div>
          <label className="text-sm font-black text-slate-700 dark:text-slate-300 mb-2 block">
            {t('شروط إضافية')}
          </label>
          <textarea
            className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
            rows={2}
            value={formData.شروط_إضافية}
            onChange={(e) => setFormData({ ...formData, شروط_إضافية: e.target.value })}
          />
        </div>

        <div className="flex gap-4 pt-4 border-t border-slate-100 dark:border-slate-700">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
            {t('إلغاء')}
          </Button>
          <Button type="submit" className="flex-1 bg-indigo-600" disabled={!formData.رقم_المشتري}>
            {t('إضافة عرض الشراء')}
          </Button>
        </div>
      </form>
    </Modal>
  );
};