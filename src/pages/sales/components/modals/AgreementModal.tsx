import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Check, Circle, FileSignature } from 'lucide-react';
import { Modal } from '@/components/shared/Modal';
import { اتفاقيات_البيع_tbl } from '@/types';

const t = (s: string) => s;

interface AgreementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (agreement: Partial<اتفاقيات_البيع_tbl>) => void;
}

export const AgreementModal: React.FC<AgreementModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [step, setStep] = useState(1);
const [formData, setFormData] = useState<Partial<اتفاقيات_البيع_tbl>>({
    id: '',
    listingId: '',
    رقم_العقار: '',
    رقم_البائع: '',
    رقم_المشتري: '',
    رقم_الفرصة: '',
    يوجد_ادخال_عقار: false,
    اسم_المستخدم: '',
    تاريخ_الاتفاقية: '',
    السعر_النهائي: '',
    العمولة_الإجمالية: '',
    عمولة_البائع: '',
    عمولة_المشتري: '',
    عمولة_وسيط_خارجي: '',
    مصاريف_البيع: '',
    إجمالي_المصاريف: '',
    إجمالي_العمولات: '',
    قيمة_الدفعة_الاولى: '',
    قيمة_المتبقي: '',
    طريقة_الدفع: '',
    isCompleted: false,
    transferDate: '',
    transactionId: ''
  } as unknown as Partial<اتفاقيات_البيع_tbl>);

  const steps = [
    { id: 1, label: 'ربط العروض', icon: Check },
    { id: 2, label: 'اتفاق السعر', icon: Check },
    { id: 3, label: 'تاريخ النقل', icon: Check },
    { id: 4, label: 'تأكيد والاحفظ', icon: FileSignature }
  ];

  const handleSubmit = () => {
onSubmit({
      عقد_الرقم: formData.عقد_الرقم,
      عرض_البيع_الرقم: formData.عرض_البيع_الرقم,
      عرض_الشراء_الرقم: formData.عرض_الشراء_الرقم,
      سعر_الاتفاق: Number(formData.سعر_الاتفاق),
      تاريخ_الانتقال: formData.تاريخ_الانتقال,
      ملاحظات: formData.ملاحظات
    });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('إنشاء اتفاقية بيع')} icon={<FileSignature size={24} />} size="lg">
      <div className="p-2">
        {/* Stepper Progress */}
        <div className="flex items-center justify-between mb-8 bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl">
          {steps.map((s, idx) => (
            <React.Fragment key={s.id}>
              <div className={`flex flex-col items-center gap-2 ${step >= s.id ? 'text-indigo-600' : 'text-gray-400'}`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${step > s.id ? 'bg-green-500 text-white border-green-500' : step === s.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-gray-100 text-gray-400 border-gray-200'}`}>
                  {step > s.id ? <Check size={18} /> : <Circle size={18} />}
                </div>
                <span className="text-[10px] font-bold">{s.label}</span>
              </div>
              {idx < steps.length - 1 && (
                <div className={`flex-1 h-1 mx-2 rounded ${step > s.id ? 'bg-green-500' : 'bg-gray-200'}`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Step Content */}
        <div className="min-h-[300px]">
          {step === 1 && (
            <div className="space-y-6">
              <div>
<label className="text-sm font-black text-slate-700 dark:text-slate-300 mb-2 block">
          {t('رقم عرض البيع')}
        </label>
        <Input
          type="number"
          value={formData.عرض_البيع_الرقم}
          onChange={(e) => setFormData({ ...formData, عرض_البيع_الرقم: e.target.value })}
          required
        />
              </div>
              <div>
<label className="text-sm font-black text-slate-700 dark:text-slate-300 mb-2 block">
          {t('رقم عرض الشراء')}
        </label>
        <Input
          type="number"
          value={formData.عرض_الشراء_الرقم}
          onChange={(e) => setFormData({ ...formData, عرض_الشراء_الرقم: e.target.value })}
          required
        />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div>
<label className="text-sm font-black text-slate-700 dark:text-slate-300 mb-2 block">
          {t('سعر الاتفاق النهائي بالدينار')}
        </label>
        <Input
          type="number"
          step="0.01"
          value={formData.سعر_الاتفاق}
onChange={(e) => setFormData({ ...formData, سعر_الاتفاق: Number(e.target.value) })}
          required
        />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div>
<label className="text-sm font-black text-slate-700 dark:text-slate-300 mb-2 block">
          {t('تاريخ نقل الملكية المتوقع')}
        </label>
        <Input
          type="date"
          value={formData.تاريخ_الانتقال}
          onChange={(e) => setFormData({ ...formData, تاريخ_الانتقال: e.target.value })}
          required
        />
              </div>
              <div>
<label className="text-sm font-black text-slate-700 dark:text-slate-300 mb-2 block">
          {t('ملاحظات إضافية')}
        </label>
        <textarea
          className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
          rows={3}
          value={formData.ملاحظات}
          onChange={(e) => setFormData({ ...formData, ملاحظات: e.target.value })}
        />
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="text-center py-8 space-y-6">
              <div className="bg-green-50 dark:bg-green-900/30 rounded-2xl p-6 max-w-sm mx-auto">
                <Check size={48} className="mx-auto text-green-600 mb-4" />
                <h3 className="text-xl font-black text-green-700 dark:text-green-400">
                  {t('جاهز لإنشاء الاتفاقية')}
                </h3>
                <p className="text-sm text-green-600 dark:text-green-500 mt-2">
                  {t('يرجى التأكد من صحة جميع البيانات قبل الحفظ')}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex gap-4 pt-6 border-t border-slate-100 dark:border-slate-700 mt-6">
          {step > 1 && (
            <Button type="button" variant="outline" onClick={() => setStep(step - 1)}>
              {t('السابق')}
            </Button>
          )}
          <div className="flex-1" />
          {step < steps.length ? (
            <Button type="button" onClick={() => setStep(step + 1)}>
              {t('التالي')}
            </Button>
          ) : (
            <Button type="button" onClick={handleSubmit} className="bg-green-600">
              {t('إنشاء الاتفاقية')}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
};