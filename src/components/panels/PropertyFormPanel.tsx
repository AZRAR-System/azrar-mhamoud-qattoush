
import React, { useState, useEffect } from 'react';
import { DbService } from '@/services/mockDb';
import { العقارات_tbl, SmartSuggestion } from '@/types';
import { useToast } from '@/context/ToastContext';
import { Home, MapPin, Layers, Briefcase, LayoutGrid, Check, ShieldAlert } from 'lucide-react';
import { PersonPicker } from '@/components/shared/PersonPicker';
import { DynamicSelect } from '@/components/ui/DynamicSelect';
import { SmartEngine } from '@/services/smartEngine';
import { SmartAssistant } from '@/components/smart/SmartAssistant';
import { DynamicFieldsSection } from '@/components/dynamic/DynamicFieldsSection';
import { storage } from '@/services/storage';

interface PropertyFormProps {
  id?: string;
  onClose?: () => void;
  onSuccess?: () => void;
}

export const PropertyFormPanel: React.FC<PropertyFormProps> = ({ id, onClose, onSuccess }) => {
  const [activeTab, setActiveTab] = useState<'basic' | 'specs' | 'reg' | 'sales' | 'notes'>('basic');
    const [initialIsForSale, setInitialIsForSale] = useState<boolean>(false);
  const [formData, setFormData] = useState<Partial<العقارات_tbl>>({
      الكود_الداخلي: '', 
      العنوان: '', 
      حالة_العقار: 'شاغر', 
      الإيجار_التقديري: 0, 
      رقم_المالك: '', 
      النوع: 'شقة', 
      المساحة: 100,
      المدينة: 'عمان',
      المنطقة: '',
      الطابق: '',
      عدد_الغرف: '',
      نوع_التاثيث: 'فارغ',
      isForSale: false,
      salePrice: 0,
      minSalePrice: 0
  });
  
  const [suggestions, setSuggestions] = useState<SmartSuggestion[]>([]);
    const [dynamicValues, setDynamicValues] = useState<Record<string, any>>({});
  const toast = useToast();
    const isDesktop = storage.isDesktop() && !!(window as any)?.desktopDb;

    if (isDesktop) {
        return (
            <div className="p-10 text-center text-slate-600 dark:text-slate-300">
                <div className="mx-auto mb-3 w-12 h-12 rounded-full bg-yellow-100 dark:bg-yellow-900/20 flex items-center justify-center">
                    <ShieldAlert className="w-6 h-6 text-yellow-700 dark:text-yellow-300" />
                </div>
                <div className="font-bold">غير مدعوم في وضع الديسكتوب الحالي</div>
                <div className="text-sm mt-2">تعديل/إضافة العقارات يتطلب مسار حفظ SQL عبر IPC (غير متوفر حالياً).</div>
            </div>
        );
    }

  useEffect(() => {
        if (isDesktop) return;
    if (id && id !== 'new') {
        const prop = DbService.getProperties().find(p => p.رقم_العقار === id);
        if (prop) {
            setFormData(prop);
            setInitialIsForSale(!!(prop as any).isForSale);
            setDynamicValues((prop as any).حقول_ديناميكية || {});
        }
    } else {
        setInitialIsForSale(false);
        setDynamicValues({});
        // Only run smart engine on new forms
        const recs = SmartEngine.predict('property', formData);
        setSuggestions(recs);
    }
  }, [id]);

  const applySuggestions = (recs: SmartSuggestion[]) => {
      const newValues: any = {};
      recs.forEach(s => newValues[s.field] = s.suggestedValue);
      setFormData(prev => ({ ...prev, ...newValues }));
      setSuggestions([]); // Dismiss after applying
      toast.success('تم تعبئة الحقول تلقائياً');
  };

  const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (isDesktop) {
          toast.error('غير مدعوم في وضع الديسكتوب الحالي');
          return;
      }
      if(!formData.الكود_الداخلي || !formData.رقم_المالك) {
          toast.warning('بيانات ناقصة: الكود الداخلي والمالك مطلوبان');
          return;
      }

      // Sales requirements: when enabled, asking price is mandatory
      if ((formData as any).isForSale) {
          const asking = Number((formData as any).salePrice || 0);
          if (!asking || asking <= 0) {
              toast.warning('عند تفعيل خيار (للبيع) يجب إدخال السعر المطلوب');
              setActiveTab('sales');
              return;
          }
      }
      
      const res = (id && id !== 'new')
                ? DbService.updateProperty(id, { ...formData, حقول_ديناميكية: Object.keys(dynamicValues || {}).length ? dynamicValues : undefined } as any)
                : DbService.addProperty({ ...(formData as العقارات_tbl), حقول_ديناميكية: Object.keys(dynamicValues || {}).length ? dynamicValues : undefined } as any);
        
      if(res.success) {
          // Auto-create/update (upsert) a Sales Listing when the property is marked for sale
          try {
              const propId = (res.data as any)?.رقم_العقار || (id && id !== 'new' ? id : undefined);
              if (propId) {
                  const isForSale = !!(formData as any).isForSale;
                  if (isForSale) {
                      const asking = Number((formData as any).salePrice || 0);
                      const min = Number((formData as any).minSalePrice || 0);
                      DbService.createSalesListing({
                          رقم_العقار: propId,
                          رقم_المالك: formData.رقم_المالك,
                          السعر_المطلوب: asking,
                          أقل_سعر_مقبول: min,
                          نوع_البيع: 'Cash',
                          الحالة: 'Active',
                          تاريخ_العرض: new Date().toISOString().split('T')[0],
                      } as any);
                  } else if (initialIsForSale) {
                      // If sale was turned off, cancel any open listing for this property
                      DbService.cancelOpenSalesListingsForProperty(propId);
                  }
              }
          } catch {
              // non-blocking
          }

          toast.success(res.message);
          if (onSuccess) onSuccess();
          if (onClose) onClose();
      } else {
          toast.error(res.message);
      }
  };

    const inputClass = "w-full p-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition text-sm";
  const labelClass = "block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1";

  return (
    <div className="flex flex-col h-full">
        {/* Header */}
        <div className="p-5 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center bg-gray-50 dark:bg-slate-900/50">
            <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Home className="text-indigo-600"/> {id && id !== 'new' ? 'تعديل بيانات العقار' : 'إضافة عقار جديد'}
            </h2>
        </div>
        
        {/* Tabs */}
        <div className="flex bg-gray-100 dark:bg-slate-900/50 p-1 mx-5 mt-4 rounded-xl overflow-x-auto">
            {[
                { id: 'basic', label: 'البيانات الأساسية', icon: Home },
                { id: 'specs', label: 'المواصفات', icon: MapPin },
                { id: 'reg', label: 'التسجيل', icon: Layers },
                { id: 'sales', label: 'البيع', icon: Briefcase },
                { id: 'notes', label: 'ملاحظات', icon: LayoutGrid },
            ].map(tab => (
                <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1 transition whitespace-nowrap px-2
                        ${activeTab === tab.id 
                            ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-sm' 
                            : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}
                    `}
                >
                    <tab.icon size={14} /> <span>{tab.label}</span>
                </button>
            ))}
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto custom-scrollbar p-6">
            
            {/* Smart Assistant */}
            <SmartAssistant 
                suggestions={suggestions} 
                onAccept={applySuggestions} 
                onDismiss={() => setSuggestions([])} 
            />

            {activeTab === 'basic' && (
                <div className="space-y-6 animate-fade-in">
                    <div className="grid grid-cols-1 gap-4">
                        <PersonPicker 
                            label="المالك" 
                            required 
                            value={formData.رقم_المالك} 
                            onChange={(pid) => setFormData({...formData, رقم_المالك: pid})} 
                            defaultRole="مالك" 
                            initialRoleFilter="All"
                            enableUnlinkedFirst
                            unlinkedFirstByDefault
                        />
                        <div>
                            <label className={labelClass}>الكود الداخلي <span className="text-red-500">*</span></label>
                            <input required className={`${inputClass} font-mono font-bold`}
                              value={formData.الكود_الداخلي} onChange={e => setFormData({...formData, الكود_الداخلي: e.target.value})} placeholder="CODE-001" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <DynamicSelect label="النوع" category="prop_type" value={formData.النوع} onChange={(val) => setFormData({...formData, النوع: val})} />
                            <DynamicSelect label="الحالة الحالية" category="prop_status" value={formData.حالة_العقار} onChange={(val) => setFormData({...formData, حالة_العقار: val})} />
                        </div>
                        <div>
                            <label className={labelClass}>الإيجار التقديري (سنوي)</label>
                            <input type="number" className={inputClass} value={formData.الإيجار_التقديري} onChange={e => setFormData({...formData, الإيجار_التقديري: Number(e.target.value)})} />
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'specs' && (
                <div className="space-y-6 animate-fade-in">
                    <div>
                        <label className={labelClass}>العنوان التفصيلي</label>
                        <input className={inputClass} value={formData.العنوان} onChange={e => setFormData({...formData, العنوان: e.target.value})} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <DynamicSelect label="المدينة" category="prop_city" value={formData.المدينة} onChange={(val) => setFormData({...formData, المدينة: val})} />
                        <DynamicSelect label="المنطقة" category="prop_region" value={formData.المنطقة} onChange={(val) => setFormData({...formData, المنطقة: val})} />
                        
                        <div><label className={labelClass}>المساحة (م²)</label><input type="number" className={inputClass} value={formData.المساحة} onChange={e => setFormData({...formData, المساحة: Number(e.target.value)})} /></div>
                        
                        <DynamicSelect label="الطابق" category="prop_floor" value={formData.الطابق} onChange={(val) => setFormData({...formData, الطابق: val})} />
                        
                        <div><label className={labelClass}>عدد الغرف</label><input className={inputClass} value={formData.عدد_الغرف} onChange={e => setFormData({...formData, عدد_الغرف: e.target.value})} /></div>
                        
                        <DynamicSelect label="صفة العقار" category="prop_furnishing" value={formData.نوع_التاثيث} onChange={(val) => setFormData({...formData, نوع_التاثيث: val})} />
                    </div>
                </div>
            )}

            {activeTab === 'reg' && (
                <div className="space-y-6 animate-fade-in">
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className={labelClass}>اسم الحوض</label><input className={inputClass} value={formData.اسم_الحوض} onChange={e => setFormData({...formData, اسم_الحوض: e.target.value})} /></div>
                        <div><label className={labelClass}>رقم القطعة</label><input className={inputClass} value={formData.رقم_قطعة} onChange={e => setFormData({...formData, رقم_قطعة: e.target.value})} /></div>
                        <div><label className={labelClass}>رقم اللوحة</label><input className={inputClass} value={formData.رقم_لوحة} onChange={e => setFormData({...formData, رقم_لوحة: e.target.value})} /></div>
                        <div><label className={labelClass}>رقم الشقة</label><input className={inputClass} value={formData.رقم_شقة} onChange={e => setFormData({...formData, رقم_شقة: e.target.value})} /></div>
                        <div><label className={labelClass}>كهرباء</label><input className={inputClass} value={formData.رقم_اشتراك_الكهرباء} onChange={e => setFormData({...formData, رقم_اشتراك_الكهرباء: e.target.value})} /></div>
                        <div><label className={labelClass}>مياه</label><input className={inputClass} value={formData.رقم_اشتراك_المياه} onChange={e => setFormData({...formData, رقم_اشتراك_المياه: e.target.value})} /></div>
                    </div>
                </div>
            )}

            {activeTab === 'sales' && (
                <div className="space-y-6 animate-fade-in">
                    <label className="flex items-center gap-3 p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl border border-emerald-100 dark:border-emerald-800 cursor-pointer">
                        <input type="checkbox" className="w-5 h-5" checked={formData.isForSale} onChange={e => setFormData({...formData, isForSale: e.target.checked})} />
                        <span className="font-bold text-emerald-800 dark:text-emerald-300">عرض للبيع</span>
                    </label>
                    {formData.isForSale && (
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className={labelClass}>السعر المطلوب</label><input type="number" className={inputClass} value={formData.salePrice} onChange={e => setFormData({...formData, salePrice: Number(e.target.value)})} /></div>
                            <div><label className={labelClass}>أقل سعر</label><input type="number" className={inputClass} value={formData.minSalePrice} onChange={e => setFormData({...formData, minSalePrice: Number(e.target.value)})} /></div>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'notes' && (
                <div className="space-y-4 animate-fade-in">
                    <div><label className={labelClass}>حدود المأجور</label><textarea className={inputClass} rows={3} value={formData.حدود_المأجور} onChange={e => setFormData({...formData, حدود_المأجور: e.target.value})}></textarea></div>
                    <div><label className={labelClass}>ملاحظات</label><textarea className={inputClass} rows={4} value={formData.ملاحظات} onChange={e => setFormData({...formData, ملاحظات: e.target.value})}></textarea></div>
                    <DynamicFieldsSection formId="properties" values={dynamicValues} onChange={setDynamicValues} />
                </div>
            )}
        </form>

        <div className="p-5 border-t border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-6 py-3 rounded-xl text-slate-500 hover:bg-gray-100 dark:hover:bg-slate-700 font-bold transition">إلغاء</button>
            <button onClick={handleSubmit} className="px-8 py-3 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 font-bold shadow-lg shadow-indigo-600/20 transition flex items-center gap-2">
                <Check size={18} /> حفظ
            </button>
        </div>
    </div>
  );
};
