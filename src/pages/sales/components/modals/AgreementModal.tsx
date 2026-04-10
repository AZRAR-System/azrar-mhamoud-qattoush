import React, { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Check, FileSignature, AlertCircle, Coins, BadgePercent, CheckCircle } from 'lucide-react';
import { Modal } from '@/components/shared/Modal';
import { اتفاقيات_البيع_tbl, عروض_البيع_tbl, عروض_الشراء_tbl } from '@/types';
import { formatCurrencyJOD } from '@/utils/format';

const t = (s: string) => s;

interface AgreementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (agreement: Partial<اتفاقيات_البيع_tbl>) => void;
  listings: عروض_البيع_tbl[];
  offers: عروض_الشراء_tbl[];
  getPropertyLabel: (id: string) => string;
  getPersonName: (id: string) => string;
  employees: Array<{ id: string; label: string }>;
  initialData?: اتفاقيات_البيع_tbl | null;
}

export const AgreementModal: React.FC<AgreementModalProps> = ({ 
  isOpen, 
  onClose, 
  onSubmit,
  listings,
  offers,
  getPropertyLabel,
  getPersonName,
  employees,
  initialData
}) => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<any>({
    listingId: '',
    عرض_الشراء_الرقم: '',
    رقم_المشتري: '',
    رقم_العقار: '',
    رقم_البائع: '',
    تاريخ_الاتفاقية: new Date().toISOString().split('T')[0],
    السعر_النهائي: 0,
    عمولة_البائع: 0,
    عمولة_المشتري: 0,
    العمولة_الإجمالية: 0,
    إجمالي_المصاريف: 0,
    isCompleted: false,
    transferDate: '',
    ملاحظات: '',
    موظف_إدخال_العقار: '',
    عمولة_إدخال_عقار: 0
  });

  const [commPercentages, setCommPercentages] = useState({
    seller: 0,
    buyer: 0
  });

  // Load initial data
  useEffect(() => {
    if (initialData && isOpen) {
      setFormData({
        ...initialData,
        تاريخ_الاتفاقية: initialData.تاريخ_الاتفاقية || new Date().toISOString().split('T')[0],
      });
      const price = Number(initialData.السعر_النهائي) || 1;
      setCommPercentages({
        seller: (Number(initialData.عمولة_البائع) / price) * 100,
        buyer: (Number(initialData.عمولة_المشتري) / price) * 100
      });
    } else if (!initialData && isOpen) {
       // Reset for new creation
       setFormData({
        listingId: '',
        عرض_الشراء_الرقم: '',
        رقم_المشتري: '',
        رقم_العقار: '',
        رقم_البائع: '',
        تاريخ_الاتفاقية: new Date().toISOString().split('T')[0],
        السعر_النهائي: 0,
        عمولة_البائع: 0,
        عمولة_المشتري: 0,
        العمولة_الإجمالية: 0,
        إجمالي_المصاريف: 0,
        isCompleted: false,
        transferDate: '',
        ملاحظات: '',
        موظف_إدخال_العقار: '',
        عمولة_إدخال_عقار: 0
      });
      setCommPercentages({ seller: 0, buyer: 0 });
    }
  }, [initialData, isOpen]);

  // Handle Percentage Changes
  const handlePctChange = (type: 'seller' | 'buyer', pct: string) => {
    const p = parseFloat(pct) || 0;
    const price = Number(formData.السعر_النهائي) || 0;
    const amount = (price * p) / 100;
    
    setCommPercentages(prev => ({ ...prev, [type]: p }));
    setFormData(prev => ({ 
      ...prev, 
      [type === 'seller' ? 'عمولة_البائع' : 'عمولة_المشتري']: amount 
    }));
  };

  // Handle Amount Changes (manually)
  const handleAmountChange = (type: 'seller' | 'buyer', amt: string) => {
    const a = parseFloat(amt) || 0;
    const price = Number(formData.السعر_النهائي) || 1;
    const p = (a / price) * 100;
    
    setCommPercentages(prev => ({ ...prev, [type]: p }));
    setFormData(prev => ({ 
      ...prev, 
      [type === 'seller' ? 'عمولة_البائع' : 'عمولة_المشتري']: a 
    }));
  };

  // Auto-calculate total and intake commission
  useEffect(() => {
    const seller = Number(formData.عمولة_البائع) || 0;
    const buyer = Number(formData.عمولة_المشتري) || 0;
    const total = seller + buyer;
    const intake = total * 0.05; // 5% Rule

    if (formData.العمولة_الإجمالية !== total || formData.عمولة_إدخال_عقار !== intake) {
      setFormData(prev => ({ 
        ...prev, 
        العمولة_الإجمالية: total,
        عمولة_إدخال_عقار: intake
      }));
    }
  }, [formData.عمولة_البائع, formData.عمولة_المشتري]);

  const steps = [
    { id: 1, label: t('ربط العروض'), icon: Check },
    { id: 2, label: t('اتفاق السعر والعمولة'), icon: Coins },
    { id: 3, label: t('تاريخ النقل'), icon: Check },
    { id: 4, label: t('تأكيد والحفظ'), icon: FileSignature }
  ];

  const activeListings = useMemo(() => listings.filter(l => l.الحالة === 'Active' || l.id === formData.listingId), [listings, formData.listingId]);
  const availableOffers = useMemo(() => {
    if (!formData.listingId) return [];
    return offers.filter(o => o.listingId === formData.listingId && (o.الحالة === 'Pending' || o.id === formData.عرض_الشراء_الرقم));
  }, [offers, formData.listingId, formData.عرض_الشراء_الرقم]);

  const handleSubmit = () => {
    onSubmit({
      ...formData,
      السعر_النهائي: Number(formData.السعر_النهائي),
      عمولة_البائع: Number(formData.عمولة_البائع),
      عمولة_المشتري: Number(formData.عمولة_المشتري),
      العمولة_الإجمالية: Number(formData.العمولة_الإجمالية),
      إجمالي_المصاريف: Number(formData.إجمالي_المصاريف),
      موظف_إدخال_العقار: formData.موظف_إدخال_العقار,
      عمولة_إدخال_عقار: Number(formData.عمولة_إدخال_عقار)
    });
    onClose();
    setStep(1);
  };

  const handleListingChange = (id: string) => {
    const l = listings.find(item => item.id === id);
    setFormData(prev => ({
      ...prev,
      listingId: id,
      رقم_العقار: l?.رقم_العقار,
      رقم_البائع: l?.رقم_المالك,
      السعر_النهائي: l?.السعر_المطلوب || 0,
      عرض_الشراء_الرقم: '',
      رقم_المشتري: ''
    }));
  };

  const handleOfferChange = (id: string) => {
    const o = offers.find(item => item.id === id);
    setFormData(prev => ({
      ...prev,
      عرض_الشراء_الرقم: id,
      رقم_المشتري: o?.رقم_المشتري || o?.مشتري_الرقم || '',
      السعر_النهائي: o?.قيمة_العرض || o?.السعر_المعروض || prev.السعر_النهائي
    }));
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={initialData ? t('تعديل اتفاقية البيع') : t('إنشاء اتفاقية بيع جديدة')} icon={<FileSignature size={24} />} size="lg">
      <div className="p-2">
        <div className="flex items-center justify-between mb-8 bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl">
          {steps.map((s, idx) => (
            <React.Fragment key={s.id}>
              <div className={`flex flex-col items-center gap-2 ${step >= s.id ? 'text-indigo-600' : 'text-gray-400'}`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${step > s.id ? 'bg-green-500 text-white border-green-500' : step === s.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-gray-100 text-gray-400 border-gray-200'}`}>
                  {step > s.id ? <Check size={18} /> : <span>{idx + 1}</span>}
                </div>
                <span className="text-[10px] font-bold">{s.label}</span>
              </div>
              {idx < steps.length - 1 && (
                <div className={`flex-1 h-1 mx-2 rounded ${step > s.id ? 'bg-green-500' : 'bg-gray-200'}`} />
              )}
            </React.Fragment>
          ))}
        </div>

        <div className="min-h-[350px] space-y-6">
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <label className="text-sm font-black text-slate-700 dark:text-slate-300 mb-2 block">
                  {t('اختر عرض البيع (العقار)')}
                </label>
                <select
                  value={formData.listingId}
                  onChange={(e) => handleListingChange(e.target.value)}
                  className="w-full p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 font-bold shadow-soft"
                  required
                >
                  <option value="">{t('--- اختر عرض البيع ---')}</option>
                  {activeListings.map(l => (
                    <option key={l.id} value={l.id}>
                      {getPropertyLabel(l.رقم_العقار)} - {formatCurrencyJOD(l.السعر_المطلوب)}
                    </option>
                  ))}
                </select>
              </div>

              {formData.listingId && (
                <div>
                  <label className="text-sm font-black text-slate-700 dark:text-slate-300 mb-2 block">
                    {t('اختر عرض الشراء المرتبط')}
                  </label>
                  {availableOffers.length > 0 ? (
                    <select
                      value={formData.عرض_الشراء_الرقم}
                      onChange={(e) => handleOfferChange(e.target.value)}
                      className="w-full p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 font-bold shadow-soft"
                      required
                    >
                      <option value="">{t('--- اختر عرض الشراء ---')}</option>
                      {availableOffers.map(o => (
                        <option key={o.id} value={o.id}>
                          {getPersonName(o.رقم_المشتري || o.مشتري_الرقم || '')} - {formatCurrencyJOD(o.قيمة_العرض || o.السعر_المعروض || 0)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="p-4 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 rounded-xl text-sm flex items-center gap-2 border border-amber-100 dark:border-amber-800">
                      <AlertCircle size={18} />
                      {t('لا توجد عروض شراء معلقة لهذا العقار. يمكنك المتابعة بدون ربط عرض محدد.')}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
              <div className="p-6 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-2xl border border-indigo-100 dark:border-indigo-900/30">
                <label className="text-lg font-black text-indigo-900 dark:text-indigo-300 mb-4 flex items-center gap-2">
                  <BadgePercent size={24} />
                  {t('سعر الاتفاق و العمولات')}
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className="text-sm font-black text-slate-600 dark:text-slate-400 mb-2 block">{t('سعر البيع النهائي')}</label>
                    <Input 
                      type="number" 
                      value={formData.السعر_النهائي} 
                      onChange={(e) => setFormData({...formData, السعر_النهائي: e.target.value})} 
                      className="text-xl font-black text-indigo-600 h-14"
                    />
                  </div>
                  
                  <div className="p-4 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800">
                    <label className="text-xs font-black text-slate-500 mb-2 block uppercase tracking-wider">{t('عمولة المالك (البائع)')}</label>
                    <div className="flex gap-2">
                       <Input 
                        type="number" 
                        value={formData.عمولة_البائع} 
                        onChange={(e) => handleAmountChange('seller', e.target.value)}
                        placeholder="0.00"
                        className="flex-1"
                      />
                      <div className="relative w-24">
                        <Input 
                          type="number" 
                          value={commPercentages.seller.toFixed(1)} 
                          onChange={(e) => handlePctChange('seller', e.target.value)}
                          className="pr-6 text-indigo-600 font-bold"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-indigo-400">%</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800">
                    <label className="text-xs font-black text-slate-500 mb-2 block uppercase tracking-wider">{t('عمولة المشتري')}</label>
                    <div className="flex gap-2">
                      <Input 
                        type="number" 
                        value={formData.عمولة_المشتري} 
                        onChange={(e) => handleAmountChange('buyer', e.target.value)}
                        placeholder="0.00"
                        className="flex-1"
                      />
                      <div className="relative w-24">
                        <Input 
                          type="number" 
                          value={commPercentages.buyer.toFixed(1)} 
                          onChange={(e) => handlePctChange('buyer', e.target.value)}
                          className="pr-6 text-indigo-600 font-bold"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-indigo-400">%</span>
                      </div>
                    </div>
                  </div>

                  <div className="md:col-span-2 p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl border border-emerald-100 dark:border-emerald-800/30 flex justify-between items-center">
                    <span className="font-black text-emerald-800 dark:text-emerald-400">{t('إجمالي عمولة المكتب :')}</span>
                    <span className="text-2xl font-black text-emerald-600">{formatCurrencyJOD(formData.العمولة_الإجمالية)}</span>
                  </div>

                  <div className="md:col-span-2">
                    <label className="text-sm font-black text-slate-600 dark:text-slate-400 mb-2 block">{t('مصاريف/رسوم تقديرية أخرى')}</label>
                    <Input 
                      type="number" 
                      value={formData.إجمالي_المصاريف} 
                      onChange={(e) => setFormData({...formData, إجمالي_المصاريف: e.target.value})}
                      placeholder="0.00"
                    />
                  </div>

                  <div className="md:col-span-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <label className="text-sm font-black text-slate-700 dark:text-slate-300 mb-4 block flex items-center gap-2">
                      <CheckCircle size={18} className="text-indigo-500" />
                      {t('عمولة إدخال العقار (Listing Commission)')}
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold text-slate-500 mb-1 block">{t('موظف الإدخال')}</label>
                        <select
                          value={formData.موظف_إدخال_العقار}
                          onChange={(e) => setFormData({...formData, موظف_إدخال_العقار: e.target.value})}
                          className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 font-bold"
                        >
                          <option value="">{t('--- اختر الموظف ---')}</option>
                          {employees.map(emp => (
                            <option key={emp.id} value={emp.id}>{emp.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-500 mb-1 block">{t('قيمة عمولة الإدخال')}</label>
                        <Input 
                          type="number" 
                          value={formData.عمولة_إدخال_عقار} 
                          onChange={(e) => setFormData({...formData, عمولة_إدخال_عقار: e.target.value})}
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div>
                <label className="text-sm font-black text-slate-700 dark:text-slate-300 mb-2 block">
                  {t('تاريخ التنازل المتوقع')}
                </label>
                <Input
                  type="date"
                  value={formData.transferDate}
                  onChange={(e) => setFormData({ ...formData, transferDate: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="text-sm font-black text-slate-700 dark:text-slate-300 mb-2 block">
                  {t('ملاحظات الاتفاقية')}
                </label>
                <textarea
                  className="w-full p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 font-bold shadow-soft"
                  rows={4}
                  value={formData.ملاحظات}
                  onChange={(e) => setFormData({ ...formData, ملاحظات: e.target.value })}
                  placeholder={t('شروط خاصة، تفاصيل الدفع، الخ...')}
                />
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="text-center py-4 space-y-6">
              <div className="bg-indigo-50 dark:bg-indigo-900/30 rounded-[2.5rem] p-8 max-w-md mx-auto border border-indigo-100 dark:border-indigo-800 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                   <Coins size={120} />
                </div>
                <FileSignature size={56} className="mx-auto text-indigo-600 mb-4" />
                <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-2">
                  {t('مراجعة البيانات')}
                </h3>
                <div className="text-right space-y-4 mt-6 text-sm">
                  <div className="flex justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                    <span className="text-slate-500">{t('العقار:')}</span>
                    <span className="font-black">{getPropertyLabel(formData.رقم_العقار || '')}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                    <span className="text-slate-500">{t('المشتري:')}</span>
                    <span className="font-black">{getPersonName(formData.رقم_المشتري || '')}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                    <span className="text-slate-500">{t('السعر النهائي:')}</span>
                    <span className="font-black text-indigo-600 text-lg">{formatCurrencyJOD(formData.السعر_النهائي || 0)}</span>
                  </div>
                  <div className="flex justify-between bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-lg">
                    <span className="text-emerald-700 dark:text-emerald-400 font-bold">{t('إجمالي العمولات:')}</span>
                    <span className="font-black text-emerald-600">{formatCurrencyJOD(formData.العمولة_الإجمالية || 0)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-4 pt-6 border-t border-slate-100 dark:border-slate-700 mt-6">
          {step > 1 && (
            <Button type="button" variant="outline" className="px-8 rounded-xl font-black h-12" onClick={() => setStep(step - 1)}>
              {t('السابق')}
            </Button>
          )}
          <div className="flex-1" />
          {step < steps.length ? (
            <Button 
              type="button" 
              onClick={() => setStep(step + 1)} 
              disabled={step === 1 && !formData.listingId}
              className="px-12 rounded-xl font-black h-12 bg-indigo-600 shadow-lg shadow-indigo-600/20"
            >
              {t('التالي')}
            </Button>
          ) : (
            <Button type="button" onClick={handleSubmit} className="px-12 rounded-xl font-black h-12 bg-green-600 shadow-lg shadow-green-600/20">
              {t('اعتماد الاتفاقية')}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
};