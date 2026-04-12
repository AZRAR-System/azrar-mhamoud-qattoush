import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/shared/Modal';
import { اتفاقيات_البيع_tbl } from '@/types';
import { formatCurrencyJOD } from '@/utils/format';
import { 
  Building2, 
  FileText, 
  Upload, 
  CheckCircle, 
  Hash, 
  Calculator,
  ShieldCheck
} from 'lucide-react';
import { DbService } from '@/services/mockDb';
import { useToast } from '@/context/ToastContext';

const t = (s: string) => s;

interface TransferOwnershipModalProps {
  isOpen: boolean;
  onClose: () => void;
  agreement: اتفاقيات_البيع_tbl | null;
  getPropertyLabel: (id: string) => string;
  getPersonName: (id: string) => string;
  employees: Array<{ id: string; label: string }>;
  onSuccess: () => void;
}

export const TransferOwnershipModal: React.FC<TransferOwnershipModalProps> = ({
  isOpen,
  onClose,
  agreement,
  getPropertyLabel,
  getPersonName,
  employees,
  onSuccess
}) => {
  const toast = useToast();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    transactionId: '',
    expenses: 0,
    targetStatus: 'شاغر',
    files: [] as File[],
    // Editable agreement data
    finalPrice: 0,
    sellerComm: 0,
    buyerComm: 0,
    totalComm: 0,
    listingComm: 0,
    listingEmployee: ''
  });

  const [commPercentages, setCommPercentages] = useState({
    seller: 0,
    buyer: 0
  });

  // Load agreement data into local state
  useEffect(() => {
    if (agreement && isOpen) {
      const price = Number(agreement.السعر_النهائي) || 1;
      setFormData(prev => ({
        ...prev,
        expenses: Number(agreement.إجمالي_المصاريف) || 0,
        finalPrice: Number(agreement.السعر_النهائي) || 0,
        sellerComm: Number(agreement.عمولة_البائع) || 0,
        buyerComm: Number(agreement.عمولة_المشتري) || 0,
        totalComm: Number(agreement.العمولة_الإجمالية) || 0,
        listingComm: Number(agreement.عمولة_إدخال_عقار) || 0,
        listingEmployee: agreement.موظف_إدخال_العقار || ''
      }));
      setCommPercentages({
        seller: (Number(agreement.عمولة_البائع) / price) * 100,
        buyer: (Number(agreement.عمولة_المشتري) / price) * 100
      });
    }
  }, [agreement, isOpen]);

  // Percentage Sync Logic (similar to AgreementModal)
  const handlePctChange = (type: 'seller' | 'buyer', pct: string) => {
    const p = parseFloat(pct) || 0;
    const price = Number(formData.finalPrice) || 0;
    const amount = (price * p) / 100;
    setCommPercentages(prev => ({ ...prev, [type]: p }));
    setFormData(prev => ({ ...prev, [type === 'seller' ? 'sellerComm' : 'buyerComm']: amount }));
  };

  const handleAmountChange = (type: 'seller' | 'buyer', amt: string) => {
    const a = parseFloat(amt) || 0;
    const price = Number(formData.finalPrice) || 1;
    const p = (a / price) * 100;
    setCommPercentages(prev => ({ ...prev, [type]: p }));
    setFormData(prev => ({ ...prev, [type === 'seller' ? 'sellerComm' : 'buyerComm']: a }));
  };

  // Auto-calculate total and 5% intake rule
  useEffect(() => {
    const seller = Number(formData.sellerComm) || 0;
    const buyer = Number(formData.buyerComm) || 0;
    const total = seller + buyer;
    const intake = total * 0.05; // 5% Rule

    if (formData.totalComm !== total || formData.listingComm !== intake) {
      setFormData(prev => ({ ...prev, totalComm: total, listingComm: intake }));
    }
  }, [formData.sellerComm, formData.buyerComm, formData.totalComm, formData.listingComm]);

  const propertyLabel = agreement ? getPropertyLabel(agreement.listingId || '') : '';
  const buyerName = agreement ? getPersonName(agreement.رقم_المشتري) : '';

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFormData(prev => ({ ...prev, files: [...prev.files, ...Array.from(e.target.files)] }));
    }
  };

  const handleFinalize = async () => {
    if (!agreement) return;

    // 1. Sync latest agreement data first
    await DbService.updateSalesAgreement(agreement.id, {
      السعر_النهائي: Number(formData.finalPrice),
      عمولة_البائع: Number(formData.sellerComm),
      عمولة_المشتري: Number(formData.buyerComm),
      العمولة_الإجمالية: Number(formData.totalComm),
      عمولة_إدخال_عقار: Number(formData.listingComm),
      موظف_إدخال_العقار: formData.listingEmployee,
      إجمالي_المصاريف: Number(formData.expenses)
    });

    // 2. Upload files
    if (formData.files.length > 0) {
      for (const file of formData.files) {
        if (agreement.رقم_العقار) {
          await DbService.uploadAttachment('Property', agreement.رقم_العقار, file);
        }
        await DbService.uploadAttachment('Person', agreement.رقم_المشتري, file);
      }
    }

    // 3. Finalize DB transfer
    const res = DbService.finalizeOwnershipTransfer(agreement.id, {
      transactionId: formData.transactionId,
      expenses: Number(formData.expenses),
      targetStatus: formData.targetStatus
    });

    if (res.success) {
      toast.success(res.message);
      onSuccess();
      onClose();
      setStep(1);
    } else {
      toast.error(res.message);
    }
  };

  if (!agreement) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('معالج نقل الملكية النهائي')} icon={<ShieldCheck size={24} />} size="lg">
      <div className="p-4">
        {/* Progress Tracker */}
        <div className="flex gap-4 mb-8">
          {[1, 2, 3].map((s) => (
            <div key={s} className={`flex-1 h-2 rounded-full transition-colors ${step >= s ? 'bg-indigo-600' : 'bg-slate-200'}`} />
          ))}
        </div>

        <div className="min-h-[400px]">
          {step === 1 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
              <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                  <Calculator size={20} className="text-indigo-600" />
                  {t('المعلومات المالية والعمولات النهائية')}
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="text-xs font-bold text-slate-500 mb-1 block">{t('سعر البيع النهائي')}</label>
                    <Input 
                      type="number" 
                      value={formData.finalPrice} 
                      onChange={(e) => setFormData({...formData, finalPrice: Number(e.target.value)})} 
                      className="text-xl font-black text-indigo-600 h-12"
                    />
                  </div>
                  
                  <div>
                    <label className="text-xs font-bold text-slate-500 mb-1 block">{t('عمولة البائع')}</label>
                    <div className="flex gap-2">
                      <Input 
                        type="number" 
                        value={formData.sellerComm} 
                        onChange={(e) => handleAmountChange('seller', e.target.value)}
                        className="flex-1"
                      />
                      <div className="relative w-20">
                        <Input 
                          type="number" 
                          value={commPercentages.seller.toFixed(1)} 
                          onChange={(e) => handlePctChange('seller', e.target.value)}
                        />
                        <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px]">%</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-500 mb-1 block">{t('عمولة المشتري')}</label>
                    <div className="flex gap-2">
                      <Input 
                        type="number" 
                        value={formData.buyerComm} 
                        onChange={(e) => handleAmountChange('buyer', e.target.value)}
                        className="flex-1"
                      />
                      <div className="relative w-20">
                        <Input 
                          type="number" 
                          value={commPercentages.buyer.toFixed(1)} 
                          onChange={(e) => handlePctChange('buyer', e.target.value)}
                        />
                        <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px]">%</span>
                      </div>
                    </div>
                  </div>

                  <div className="col-span-2 grid grid-cols-2 gap-4 p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                    <div>
                      <label className="text-xs font-extrabold text-indigo-600 mb-1 block uppercase">{t('عمولة الإدخال (5%)')}</label>
                      <div className="font-bold text-lg">{formatCurrencyJOD(formData.listingComm)}</div>
                    </div>
                    <div>
                       <label className="text-xs font-bold text-slate-500 mb-1 block">{t('موظف الإدخال')}</label>
                       <select
                          value={formData.listingEmployee}
                          onChange={(e) => setFormData({...formData, listingEmployee: e.target.value})}
                          className="w-full p-2 h-9 rounded-lg border border-gray-200 dark:border-gray-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold"
                        >
                          <option value="">{t('--- اختر الموظف ---')}</option>
                          {employees.map(emp => (
                            <option key={emp.id} value={emp.id}>{emp.label}</option>
                          ))}
                        </select>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-200 dark:border-slate-700 col-span-2" />

                  <div>
                    <label className="text-xs font-bold text-slate-500 mb-1 block">{t('رقم المعاملة (الأراضي)')}</label>
                    <Input 
                      value={formData.transactionId}
                      onChange={(e) => setFormData({...formData, transactionId: e.target.value})}
                      placeholder="TX-123456"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 mb-1 block">{t('رسوم التسجيل / المصاريف')}</label>
                    <Input 
                      type="number"
                      value={formData.expenses}
                      onChange={(e) => setFormData({...formData, expenses: Number(e.target.value)})}
                    />
                  </div>
                </div>
              </div>

              <div className="p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-xl text-sm text-amber-800 dark:text-amber-400">
                {t('ملاحظة: تأكد من دقة الرسوم قبل الاستمرار، سيتم تقييدها كمعدل نهائي لاتفاقية البيع.')}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
              <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                  <FileText size={20} className="text-indigo-600" />
                  {t('رفع وثائق العقار الجديدة')}
                </h3>
                
                <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-8 text-center hover:border-indigo-500 hover:bg-slate-100 transition-all cursor-pointer relative">
                  <input 
                    type="file" 
                    multiple 
                    onChange={handleFileChange}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  <Upload size={48} className="mx-auto text-slate-400 mb-4" />
                  <p className="text-slate-600 dark:text-slate-400 font-bold">{t('اسحب وألقِ سند الملكية الجديد هنا')}</p>
                  <p className="text-xs text-slate-500 mt-2">{t('يمكنك رفع عدة ملفات (PDF, JPG, PNG)')}</p>
                </div>

                {formData.files.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {formData.files.map((file, idx) => (
                      <div key={idx} className="flex justify-between items-center p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700">
                        <span className="text-sm font-bold truncate max-w-[200px]">{file.name}</span>
                        <CheckCircle size={16} className="text-green-500" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
               <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                  <Building2 size={20} className="text-indigo-600" />
                  {t('خطة العقار القادمة')}
                </h3>
                
                <div className="grid grid-cols-1 gap-4">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 block">{t('حالة العقار بعد نقل الملكية')}</label>
                  <select
                    value={formData.targetStatus}
                    onChange={(e) => setFormData({...formData, targetStatus: e.target.value})}
                    className="w-full p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 font-bold"
                  >
                    <option value="شاغر">{t('شاغر (متاح للإيجار أو البيع)')}</option>
                    <option value="مسكون من المالك">{t('مسكون من قبل المالك الجديد')}</option>
                    <option value="تحت الصيانة">{t('مغلق للصيانة / التجهيز')}</option>
                  </select>
                </div>

                <div className="mt-12 p-8 bg-indigo-600 rounded-2xl text-white text-center shadow-lg shadow-indigo-600/30">
                  <Hash size={32} className="mx-auto mb-4 opacity-50" />
                  <h4 className="text-xl font-black mb-2">{t('تأكيد النقل النهائي')}</h4>
                  <p className="text-indigo-100 text-sm">
                    {t('عقار:')} {propertyLabel} <br/>
                    {t('المالك الجديد:')} {buyerName}
                  </p>
                  <p className="mt-4 text-xs opacity-75">
                    {t('بمجرد المتابعة، سيتم تحديث السجلات المالية والقانونية للعقار بشكل دائم.')}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4 pt-6 mt-6 border-t border-slate-100 dark:border-slate-800">
          {step > 1 && (
            <Button variant="outline" onClick={() => setStep(step - 1)} className="px-8 rounded-xl font-black">
              {t('السابق')}
            </Button>
          )}
          <div className="flex-1" />
          {step < 3 ? (
            <Button 
              onClick={() => setStep(step + 1)} 
              disabled={
                (step === 1 && !formData.transactionId) || 
                (step === 2 && formData.files.length === 0)
              }
              className="px-12 rounded-xl font-black bg-indigo-600"
            >
              {t('متابعة')}
            </Button>
          ) : (
            <Button 
              onClick={handleFinalize} 
              className="px-12 rounded-xl font-black bg-green-600 shadow-lg shadow-green-600/20"
            >
              {t('إتمام نقل الملكية')}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
};
