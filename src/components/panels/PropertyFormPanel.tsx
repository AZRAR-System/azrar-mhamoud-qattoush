
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { DbService } from '@/services/mockDb';
import { العقارات_tbl, SmartSuggestion } from '@/types';
import { useToast } from '@/context/ToastContext';
import { Home, MapPin, Layers, Briefcase, LayoutGrid, Check, X, type LucideIcon } from 'lucide-react';
import { PersonPicker } from '@/components/shared/PersonPicker';
import { DynamicSelect } from '@/components/ui/DynamicSelect';
import { SmartEngine } from '@/services/smartEngine';
import { SmartAssistant } from '@/components/smart/SmartAssistant';
import { DynamicFieldsSection } from '@/components/dynamic/DynamicFieldsSection';
import { storage } from '@/services/storage';
import { Button } from '@/components/ui/Button';

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
      isForRent: true,
      isForSale: false,
      salePrice: 0,
      minSalePrice: 0
  });
  
    const [suggestions, setSuggestions] = useState<SmartSuggestion[]>([]);
        const [dynamicValues, setDynamicValues] = useState<Record<string, unknown>>({});
  const toast = useToast();
        const isDesktop = storage.isDesktop();

    const initialFormDataRef = useRef(formData);

    const tabs = useMemo(
            () =>
                    [
                            { id: 'basic', label: 'البيانات الأساسية', icon: Home },
                            { id: 'specs', label: 'المواصفات', icon: MapPin },
                            { id: 'reg', label: 'التسجيل', icon: Layers },
                            { id: 'sales', label: 'البيع', icon: Briefcase },
                            { id: 'notes', label: 'ملاحظات', icon: LayoutGrid },
                    ] as const satisfies ReadonlyArray<{ id: typeof activeTab; label: string; icon: LucideIcon }>,
            []
    );

  useEffect(() => {
    if (id && id !== 'new') {
        const prop = DbService.getProperties().find(p => p.رقم_العقار === id);
        if (prop) {
            setFormData(prop);
            setInitialIsForSale(!!prop.isForSale);
            setDynamicValues(prop.حقول_ديناميكية || {});
        }
    } else {
        setInitialIsForSale(false);
        setDynamicValues({});
        // Only run smart engine on new forms
        const recs = SmartEngine.predict('property', initialFormDataRef.current);
        setSuggestions(recs);
    }
  }, [id]);

  const applySuggestions = (recs: SmartSuggestion[]) => {
      const coerceString = (v: unknown): string => String(v ?? '');
      const coerceNumber = (v: unknown): number => {
          const n = typeof v === 'number' ? v : Number(v);
          return Number.isFinite(n) ? n : 0;
      };

      setFormData(prev => {
          const next: Partial<العقارات_tbl> = { ...prev };
          for (const s of recs) {
              const field = String(s.field || '').trim();
              const v = s.suggestedValue;

              if (field === 'الكود_الداخلي') next.الكود_الداخلي = coerceString(v);
              else if (field === 'العنوان') next.العنوان = coerceString(v);
              else if (field === 'حالة_العقار') next.حالة_العقار = coerceString(v);
              else if (field === 'رقم_المالك') next.رقم_المالك = coerceString(v);
              else if (field === 'النوع') next.النوع = coerceString(v);
              else if (field === 'المدينة') next.المدينة = coerceString(v);
              else if (field === 'المنطقة') next.المنطقة = coerceString(v);
              else if (field === 'الطابق') next.الطابق = coerceString(v);
              else if (field === 'عدد_الغرف') next.عدد_الغرف = coerceString(v);
              else if (field === 'نوع_التاثيث') next.نوع_التاثيث = coerceString(v);
              else if (field === 'رقم_اشتراك_الكهرباء') next.رقم_اشتراك_الكهرباء = coerceString(v);
              else if (field === 'رقم_اشتراك_المياه') next.رقم_اشتراك_المياه = coerceString(v);
              else if (field === 'اسم_الحوض') next.اسم_الحوض = coerceString(v);
              else if (field === 'رقم_قطعة') next.رقم_قطعة = coerceString(v);
              else if (field === 'رقم_لوحة') next.رقم_لوحة = coerceString(v);
              else if (field === 'رقم_شقة') next.رقم_شقة = coerceString(v);
              else if (field === 'حدود_المأجور') next.حدود_المأجور = coerceString(v);
              else if (field === 'ملاحظات') next.ملاحظات = coerceString(v);
              else if (field === 'الإيجار_التقديري') next.الإيجار_التقديري = coerceNumber(v);
              else if (field === 'المساحة') next.المساحة = coerceNumber(v);
              else if (field === 'isForSale' && typeof v === 'boolean') next.isForSale = v;
              else if (field === 'isForRent' && typeof v === 'boolean') next.isForRent = v;
              else if (field === 'salePrice') next.salePrice = coerceNumber(v);
              else if (field === 'minSalePrice') next.minSalePrice = coerceNumber(v);
          }
          return next;
      });
      setSuggestions([]); // Dismiss after applying
      toast.success('تم تعبئة الحقول تلقائياً');
  };

  const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if(!formData.الكود_الداخلي || !formData.رقم_المالك) {
          toast.warning('بيانات ناقصة: الكود الداخلي والمالك مطلوبان');
          return;
      }

      // Sales requirements: when enabled, asking price is mandatory
      if (formData.isForSale) {
          const asking = Number(formData.salePrice || 0);
          if (!asking || asking <= 0) {
              toast.warning('عند تفعيل خيار (للبيع) يجب إدخال السعر المطلوب');
              setActiveTab('sales');
              return;
          }
      }

      const dynamicFields = Object.keys(dynamicValues || {}).length ? dynamicValues : undefined;
      const basePatch: Partial<العقارات_tbl> = { ...formData, حقول_ديناميكية: dynamicFields };

      const ownerId = String(formData.رقم_المالك || '').trim();
      const status = (formData.حالة_العقار ?? 'شاغر') as العقارات_tbl['حالة_العقار'];
      const commonCreate = {
          ...basePatch,
          رقم_المالك: ownerId,
          حالة_العقار: status,
          IsRented: status === 'مؤجر',
      };
      
      const res = (id && id !== 'new')
                ? DbService.updateProperty(id, commonCreate)
                : DbService.addProperty({
                      الكود_الداخلي: String(commonCreate.الكود_الداخلي || '').trim(),
                      رقم_المالك: ownerId,
                      النوع: String(commonCreate.النوع || 'شقة'),
                      العنوان: String(commonCreate.العنوان || ''),
                      حالة_العقار: status,
                      IsRented: status === 'مؤجر',
                      المساحة: Number(commonCreate.المساحة || 0) || 0,
                      الإيجار_التقديري: commonCreate.الإيجار_التقديري,
                      المدينة: commonCreate.المدينة,
                      المنطقة: commonCreate.المنطقة,
                      الطابق: commonCreate.الطابق,
                      عدد_الغرف: commonCreate.عدد_الغرف,
                      نوع_التاثيث: commonCreate.نوع_التاثيث,
                      رقم_اشتراك_الكهرباء: commonCreate.رقم_اشتراك_الكهرباء,
                      رقم_اشتراك_المياه: commonCreate.رقم_اشتراك_المياه,
                      اسم_الحوض: commonCreate.اسم_الحوض,
                      رقم_قطعة: commonCreate.رقم_قطعة,
                      رقم_لوحة: commonCreate.رقم_لوحة,
                      رقم_شقة: commonCreate.رقم_شقة,
                      isForRent: commonCreate.isForRent,
                      isForSale: commonCreate.isForSale,
                      salePrice: commonCreate.salePrice,
                      minSalePrice: commonCreate.minSalePrice,
                      حدود_المأجور: commonCreate.حدود_المأجور,
                      ملاحظات: commonCreate.ملاحظات,
                      الصفة: commonCreate.الصفة,
                      حقول_ديناميكية: commonCreate.حقول_ديناميكية,
                  });
        
      if(res.success) {
          // Auto-create/update (upsert) a Sales Listing when the property is marked for sale
          try {
              const propId = res.data?.رقم_العقار || (id && id !== 'new' ? id : undefined);
              if (propId) {
                  const isForSale = !!formData.isForSale;
                  if (isForSale) {
                      const asking = Number(formData.salePrice || 0);
                      const min = Number(formData.minSalePrice || 0);
                      DbService.createSalesListing({
                          رقم_العقار: propId,
                          رقم_المالك: ownerId,
                          السعر_المطلوب: asking,
                          أقل_سعر_مقبول: min,
                          نوع_البيع: 'Cash',
                          الحالة: 'Active',
                          تاريخ_العرض: new Date().toISOString().split('T')[0],
                      });
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

    const inputClass =
        'w-full py-3 bg-slate-50/70 dark:bg-slate-950/30 border border-slate-200/80 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/35 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-950 transition text-sm text-slate-900 dark:text-white placeholder-slate-400';
    const labelClass = 'block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1';
    const sectionClass = 'bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 shadow-sm p-5';
    const helperTextClass = 'text-[11px] text-slate-500 dark:text-slate-400 mt-1';

  return (
    <div className="flex flex-col h-full">
        {/* Header */}
        <div className="p-5 border-b border-slate-200/70 dark:border-slate-800 flex justify-between items-start bg-slate-50/70 dark:bg-slate-950/30">
            <div>
                <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <Home className="text-indigo-600" /> {id && id !== 'new' ? 'تعديل بيانات العقار' : 'إضافة عقار جديد'}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    أدخل البيانات الأساسية ثم أكمل باقي التفاصيل حسب الحاجة
                    {isDesktop ? ' • وضع الديسكتوب' : ''}
                </p>
            </div>

            <button
                type="button"
                onClick={onClose}
                className="p-2 hover:bg-slate-200/70 dark:hover:bg-slate-800/60 rounded-xl transition text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400"
                title="إغلاق"
                aria-label="إغلاق"
            >
                <X size={18} />
            </button>
        </div>
        
        {/* Tabs */}
        <div className="flex bg-slate-100 dark:bg-slate-900/50 p-1 mx-5 mt-4 rounded-xl overflow-x-auto border border-slate-200/70 dark:border-slate-800">
            {tabs.map(tab => (
                <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1 transition whitespace-nowrap px-2
                        ${activeTab === tab.id 
                            ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-sm ring-1 ring-black/5 dark:ring-white/10' 
                            : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}
                    `}
                >
                    <tab.icon size={14} /> <span>{tab.label}</span>
                </button>
            ))}
        </div>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-4">
                {/* Smart Assistant */}
                <SmartAssistant suggestions={suggestions} onAccept={applySuggestions} onDismiss={() => setSuggestions([])} />

            {activeTab === 'basic' && (
                <div className={`${sectionClass} space-y-5 animate-fade-in`}>
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <div className="text-sm font-bold text-slate-800 dark:text-white">البيانات الأساسية</div>
                            <div className={helperTextClass}>الكود الداخلي والمالك مطلوبان لإنشاء العقار</div>
                        </div>
                    </div>

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
                            <input
                                required
                                className={`${inputClass} font-mono font-bold`}
                                value={formData.الكود_الداخلي}
                                onChange={e => setFormData({...formData, الكود_الداخلي: e.target.value})}
                                placeholder="CODE-001"
                                dir="ltr"
                            />
                            <div className={helperTextClass}>مثال: `A-101` أو `SHOP-12`</div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <DynamicSelect label="النوع" category="prop_type" value={formData.النوع} onChange={(val) => setFormData({...formData, النوع: val})} />
                            <DynamicSelect label="الحالة الحالية" category="prop_status" value={formData.حالة_العقار} onChange={(val) => setFormData({...formData, حالة_العقار: val})} />
                        </div>
                        <div>
                            <label className={labelClass}>الإيجار التقديري (سنوي)</label>
                            <input
                                type="number"
                                className={inputClass}
                                value={formData.الإيجار_التقديري}
                                onChange={e => setFormData({...formData, الإيجار_التقديري: Number(e.target.value)})}
                                placeholder="0"
                                min={0}
                            />
                            <div className={helperTextClass}>اختياري — يساعد في التقارير والتقديرات</div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'specs' && (
                <div className={`${sectionClass} space-y-5 animate-fade-in`}>
                    <div>
                        <div className="text-sm font-bold text-slate-800 dark:text-white">المواصفات</div>
                        <div className={helperTextClass}>معلومات عامة عن العقار لتسهيل البحث والفلاتر</div>
                    </div>
                    <div>
                        <label className={labelClass}>العنوان التفصيلي</label>
                        <input className={inputClass} value={formData.العنوان} onChange={e => setFormData({...formData, العنوان: e.target.value})} placeholder="مثال: عمان - شارع ..." />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <DynamicSelect label="المدينة" category="prop_city" value={formData.المدينة} onChange={(val) => setFormData({...formData, المدينة: val})} />
                        <DynamicSelect label="المنطقة" category="prop_region" value={formData.المنطقة} onChange={(val) => setFormData({...formData, المنطقة: val})} />
                        
                        <div>
                            <label className={labelClass}>المساحة (م²)</label>
                            <input type="number" className={inputClass} value={formData.المساحة} onChange={e => setFormData({...formData, المساحة: Number(e.target.value)})} min={0} />
                        </div>
                        
                        <DynamicSelect label="اسم الدور" category="prop_floor" value={formData.الطابق} onChange={(val) => setFormData({...formData, الطابق: val})} />
                        
                        <div>
                            <label className={labelClass}>عدد الغرف</label>
                            <input className={inputClass} value={formData.عدد_الغرف} onChange={e => setFormData({...formData, عدد_الغرف: e.target.value})} placeholder="مثال: 3" />
                        </div>
                        
                        <DynamicSelect label="صفة العقار" category="prop_furnishing" value={formData.نوع_التاثيث} onChange={(val) => setFormData({...formData, نوع_التاثيث: val})} />
                    </div>
                </div>
            )}

            {activeTab === 'reg' && (
                <div className={`${sectionClass} space-y-5 animate-fade-in`}>
                    <div>
                        <div className="text-sm font-bold text-slate-800 dark:text-white">بيانات التسجيل</div>
                        <div className={helperTextClass}>هذه المعلومات مهمة للجودة والتقارير (كهرباء/مياه/قطعة/لوحة)</div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div>
                            <label className={labelClass}>اسم الحوض</label>
                            <input className={inputClass} value={formData.اسم_الحوض} onChange={e => setFormData({...formData, اسم_الحوض: e.target.value})} />
                        </div>
                        <div>
                            <label className={labelClass}>رقم القطعة</label>
                            <input className={inputClass} value={formData.رقم_قطعة} onChange={e => setFormData({...formData, رقم_قطعة: e.target.value})} />
                        </div>
                        <div>
                            <label className={labelClass}>رقم اللوحة</label>
                            <input className={inputClass} value={formData.رقم_لوحة} onChange={e => setFormData({...formData, رقم_لوحة: e.target.value})} />
                        </div>
                        <div>
                            <label className={labelClass}>رقم الشقة</label>
                            <input className={inputClass} value={formData.رقم_شقة} onChange={e => setFormData({...formData, رقم_شقة: e.target.value})} />
                        </div>
                        <div>
                            <label className={labelClass}>رقم اشتراك الكهرباء</label>
                            <input className={inputClass} value={formData.رقم_اشتراك_الكهرباء} onChange={e => setFormData({...formData, رقم_اشتراك_الكهرباء: e.target.value})} />
                        </div>
                        <div>
                            <label className={labelClass}>رقم اشتراك المياه</label>
                            <input className={inputClass} value={formData.رقم_اشتراك_المياه} onChange={e => setFormData({...formData, رقم_اشتراك_المياه: e.target.value})} />
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'sales' && (
                <div className={`${sectionClass} space-y-5 animate-fade-in`}>
                    <div>
                        <div className="text-sm font-bold text-slate-800 dark:text-white">إعدادات البيع</div>
                        <div className={helperTextClass}>فعّل خيار البيع فقط إذا كان العقار معروض للبيع فعلاً</div>
                    </div>

                    <label className="flex items-center justify-between gap-3 p-4 bg-emerald-50/70 dark:bg-emerald-900/10 rounded-xl border border-emerald-200/60 dark:border-emerald-800 cursor-pointer">
                        <div className="flex items-center gap-3">
                                                        <input
                                                            type="checkbox"
                                                            className="w-5 h-5"
                                                            checked={!!formData.isForSale}
                                                            onChange={e => setFormData(prev => {
                                                                const nextIsForSale = e.target.checked;
                                                                // Backward-compatible default: properties are rentable unless explicitly marked otherwise.
                                                                const nextIsForRent = prev.isForRent;
                                                                return {
                                                                    ...prev,
                                                                    isForSale: nextIsForSale,
                                                                    isForRent: typeof nextIsForRent === 'boolean' ? nextIsForRent : true,
                                                                };
                                                            })}
                                                        />
                            <div>
                                <div className="font-bold text-emerald-800 dark:text-emerald-300">عرض للبيع</div>
                                <div className="text-[11px] text-emerald-700/80 dark:text-emerald-300/80">سيتم إنشاء/تحديث عرض بيع تلقائياً</div>
                            </div>
                        </div>
                        <span className={`text-[11px] font-bold px-2 py-1 rounded-full border ${formData.isForSale ? 'bg-emerald-100/70 border-emerald-200 text-emerald-800 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-300' : 'bg-slate-100/70 border-slate-200 text-slate-600 dark:bg-slate-800/60 dark:border-slate-700 dark:text-slate-300'}`}
                        >
                            {formData.isForSale ? 'مفعل' : 'غير مفعل'}
                        </span>
                    </label>

                                        {formData.isForSale && (
                                            <label className="flex items-center justify-between gap-3 p-4 bg-slate-50/70 dark:bg-slate-900/40 rounded-xl border border-slate-200/70 dark:border-slate-800 cursor-pointer">
                                                <div>
                                                    <div className="font-bold text-slate-800 dark:text-white">للبيع فقط</div>
                                                    <div className={helperTextClass}>إذا تم تفعيله، سيتم إخفاء العقار من قوائم الإيجار (العقود/المستأجرين)</div>
                                                </div>
                                                <input
                                                    type="checkbox"
                                                    className="w-5 h-5"
                                                    checked={formData.isForRent === false}
                                                    onChange={(e) => setFormData(prev => ({
                                                        ...prev,
                                                        // checked = sale-only => not for rent
                                                        isForRent: e.target.checked ? false : true,
                                                    }))}
                                                />
                                            </label>
                                        )}
                    {formData.isForSale && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className={labelClass}>السعر المطلوب <span className="text-red-500">*</span></label>
                                <input type="number" className={inputClass} value={formData.salePrice} onChange={e => setFormData({...formData, salePrice: Number(e.target.value)})} min={0} />
                                <div className={helperTextClass}>إجباري عند تفعيل خيار البيع</div>
                            </div>
                            <div>
                                <label className={labelClass}>أقل سعر</label>
                                <input type="number" className={inputClass} value={formData.minSalePrice} onChange={e => setFormData({...formData, minSalePrice: Number(e.target.value)})} min={0} />
                                <div className={helperTextClass}>اختياري — لتحديد الحد الأدنى للتفاوض</div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'notes' && (
                <div className={`${sectionClass} space-y-4 animate-fade-in`}>
                    <div>
                        <div className="text-sm font-bold text-slate-800 dark:text-white">ملاحظات وحقول إضافية</div>
                        <div className={helperTextClass}>اكتب أي تفاصيل مهمة لتظهر لاحقاً في التقارير</div>
                    </div>
                    <div>
                        <label className={labelClass}>حدود المأجور</label>
                        <textarea className={inputClass} rows={3} value={formData.حدود_المأجور} onChange={e => setFormData({...formData, حدود_المأجور: e.target.value})}></textarea>
                    </div>
                    <div>
                        <label className={labelClass}>ملاحظات</label>
                        <textarea className={inputClass} rows={4} value={formData.ملاحظات} onChange={e => setFormData({...formData, ملاحظات: e.target.value})}></textarea>
                    </div>
                    <DynamicFieldsSection formId="properties" values={dynamicValues} onChange={setDynamicValues} />
                </div>
            )}
            </div>

            <div className="p-5 border-t border-slate-200/70 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/30 flex justify-end gap-3">
                <Button type="button" variant="secondary" onClick={onClose}>
                    إلغاء
                </Button>
                <Button type="submit" variant="primary" rightIcon={<Check size={18} />}>
                    حفظ
                </Button>
            </div>
        </form>
    </div>
  );
};
