import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DbService } from '@/services/mockDb';
import { العقارات_tbl, SmartSuggestion } from '@/types';
import { useToast } from '@/context/ToastContext';
import {
  Home,
  MapPin,
  Layers,
  Briefcase,
  LayoutGrid,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react';
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
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'basic' | 'specs' | 'reg' | 'sales' | 'notes'>(
    'basic'
  );
  const [initialIsForSale, setInitialIsForSale] = useState<boolean>(false);
  const reactId = useId();
  const fieldId = (suffix: string) => `property-form-${reactId}-${suffix}`;
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
    minSalePrice: 0,
  });

  const [suggestions, setSuggestions] = useState<SmartSuggestion[]>([]);
  const [dynamicValues, setDynamicValues] = useState<Record<string, unknown>>({});
  const toast = useToast();
  const isDesktop = storage.isDesktop();

  const ownerName = useMemo(() => {
    const ownerId = String(formData.رقم_المالك || '').trim();
    if (!ownerId) return '';
    try {
      const people = DbService.getPeople?.() || [];
      const owner = people.find((p) => String(p?.رقم_الشخص ?? '') === ownerId);
      return String(owner?.الاسم || '').trim();
    } catch {
      return '';
    }
  }, [formData.رقم_المالك]);

  const lastOwnerNameRef = useRef<string>('');

  // Auto-fill subscription names with owner name (and keep in sync)
  // only if the user hasn't explicitly overridden them.
  useEffect(() => {
    const prevOwnerName = lastOwnerNameRef.current;
    const nextOwnerName = String(ownerName || '').trim();

    // Track for next change; also avoid auto-filling until we have a name.
    lastOwnerNameRef.current = nextOwnerName;
    if (!nextOwnerName) return;

    setFormData((prev) => {
      const elec = String(prev.اسم_اشتراك_الكهرباء || '').trim();
      const water = String(prev.اسم_اشتراك_المياه || '').trim();

      const shouldSetElec = !elec || (!!prevOwnerName && elec === prevOwnerName);
      const shouldSetWater = !water || (!!prevOwnerName && water === prevOwnerName);

      if (!shouldSetElec && !shouldSetWater) return prev;
      return {
        ...prev,
        ...(shouldSetElec ? { اسم_اشتراك_الكهرباء: nextOwnerName } : null),
        ...(shouldSetWater ? { اسم_اشتراك_المياه: nextOwnerName } : null),
      };
    });
  }, [ownerName]);

  const initialFormDataRef = useRef(formData);

  const tabs = useMemo(
    () =>
      [
        { id: 'basic', label: t('البيانات الأساسية'), icon: Home },
        { id: 'specs', label: t('المواصفات'), icon: MapPin },
        { id: 'reg', label: t('التسجيل'), icon: Layers },
        { id: 'sales', label: t('البيع'), icon: Briefcase },
        { id: 'notes', label: t('ملاحظات'), icon: LayoutGrid },
      ] as const satisfies ReadonlyArray<{ id: typeof activeTab; label: string; icon: LucideIcon }>,
    [t]
  );

  useEffect(() => {
    if (id && id !== 'new') {
      const prop = DbService.getProperties().find((p) => p.رقم_العقار === id);
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

    setFormData((prev) => {
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
    toast.success(t('تم تعبئة الحقول تلقائياً'));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.الكود_الداخلي || !formData.رقم_المالك) {
      toast.warning(t('بيانات ناقصة: الكود الداخلي والمالك مطلوبان'));
      return;
    }

    // Sales requirements: when enabled, asking price is mandatory
    if (formData.isForSale) {
      const asking = Number(formData.salePrice || 0);
      if (!asking || asking <= 0) {
        toast.warning(t('عند تفعيل خيار (للبيع) يجب إدخال السعر المطلوب'));
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

    const res =
      id && id !== 'new'
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
            اسم_اشتراك_الكهرباء: commonCreate.اسم_اشتراك_الكهرباء,
            رقم_اشتراك_المياه: commonCreate.رقم_اشتراك_المياه,
            اسم_اشتراك_المياه: commonCreate.اسم_اشتراك_المياه,
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

    if (res.success) {
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

  const getNextTab = (current: typeof activeTab): typeof activeTab | null => {
    const idx = tabs.findIndex((t) => t.id === current);
    if (idx < 0) return null;
    return tabs[idx + 1]?.id ?? null;
  };

  const getPrevTab = (current: typeof activeTab): typeof activeTab | null => {
    const idx = tabs.findIndex((t) => t.id === current);
    if (idx <= 0) return null;
    return tabs[idx - 1]?.id ?? null;
  };

  const canProceedFromTab = (tab: typeof activeTab): boolean => {
    if (tab === 'basic') {
      if (
        !String(formData.رقم_المالك || '').trim() ||
        !String(formData.الكود_الداخلي || '').trim()
      ) {
        toast.warning(t('الرجاء إدخال المالك والكود الداخلي أولاً'));
        return false;
      }
    }
    if (tab === 'sales' && formData.isForSale) {
      const asking = Number(formData.salePrice || 0);
      if (!asking || asking <= 0) {
        toast.warning(t('عند تفعيل خيار (للبيع) يجب إدخال السعر المطلوب'));
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (!canProceedFromTab(activeTab)) return;
    const next = getNextTab(activeTab);
    if (!next) return;
    setActiveTab(next);
  };

  const handleBack = () => {
    const prev = getPrevTab(activeTab);
    if (!prev) return;
    setActiveTab(prev);
  };

  const inputClass =
    'w-full px-4 py-3 leading-6 bg-slate-50/70 dark:bg-slate-950/30 border border-slate-200/80 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/35 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-950 transition text-sm text-slate-900 dark:text-white placeholder-slate-400';
  const labelClass = 'block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1';
  const sectionClass =
    'bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 shadow-sm p-5';
  const helperTextClass = 'text-[11px] text-slate-500 dark:text-slate-400 mt-1';

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-5 border-b border-slate-200/70 dark:border-slate-800 flex justify-between items-start bg-slate-50/70 dark:bg-slate-950/30">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Home className="text-indigo-600" />{' '}
            {id && id !== 'new' ? t('تعديل بيانات العقار') : t('إضافة عقار جديد')}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {t('أدخل البيانات الأساسية ثم أكمل باقي التفاصيل حسب الحاجة')}
            {isDesktop ? (
              <>
                {' '}
                • {t('وضع الديسكتوب')}
              </>
            ) : null}
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-2 hover:bg-slate-200/70 dark:hover:bg-slate-800/60 rounded-xl transition text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400"
          title={t('إغلاق')}
          aria-label={t('إغلاق')}
        >
          <X size={18} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-100 dark:bg-slate-900/50 p-1 mx-5 mt-4 rounded-xl overflow-x-auto border border-slate-200/70 dark:border-slate-800">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1 transition whitespace-nowrap px-2
                        ${
                          activeTab === tab.id
                            ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-sm ring-1 ring-black/5 dark:ring-white/10'
                            : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                        }
                    `}
          >
            <tab.icon size={14} /> <span>{tab.label}</span>
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-4">
          {/* Smart Assistant */}
          <SmartAssistant
            suggestions={suggestions}
            onAccept={applySuggestions}
            onDismiss={() => setSuggestions([])}
          />

          {activeTab === 'basic' && (
            <div className={`${sectionClass} space-y-5 animate-fade-in`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-slate-800 dark:text-white">
                    {t('البيانات الأساسية')}
                  </div>
                  <div className={helperTextClass}>{t('الكود الداخلي والمالك مطلوبان لإنشاء العقار')}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <PersonPicker
                  label={t('المالك')}
                  required
                  value={formData.رقم_المالك}
                  onChange={(pid) => setFormData({ ...formData, رقم_المالك: pid })}
                  defaultRole="مالك"
                  initialRoleFilter="All"
                  enableUnlinkedFirst
                  unlinkedFirstByDefault
                />
                <div>
                  <label className={labelClass} htmlFor={fieldId('internalCode')}>
                    {t('الكود الداخلي')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    id={fieldId('internalCode')}
                    required
                    className={`${inputClass} font-mono font-bold`}
                    value={formData.الكود_الداخلي}
                    onChange={(e) => setFormData({ ...formData, الكود_الداخلي: e.target.value })}
                    placeholder="CODE-001"
                    dir="ltr"
                  />
                  <div className={helperTextClass}>{t('مثال: `A-101` أو `SHOP-12`')}</div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <DynamicSelect
                    label={t('النوع')}
                    category="prop_type"
                    value={formData.النوع}
                    onChange={(val) => setFormData({ ...formData, النوع: val })}
                  />
                  <DynamicSelect
                    label={t('الحالة الحالية')}
                    category="prop_status"
                    value={formData.حالة_العقار}
                    onChange={(val) => setFormData({ ...formData, حالة_العقار: val })}
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor={fieldId('estimatedRent')}>
                    {t('الإيجار التقديري (سنوي)')}
                  </label>
                  <input
                    id={fieldId('estimatedRent')}
                    type="number"
                    className={inputClass}
                    value={formData.الإيجار_التقديري}
                    onChange={(e) =>
                      setFormData({ ...formData, الإيجار_التقديري: Number(e.target.value) })
                    }
                    placeholder="0"
                    min={0}
                  />
                  <div className={helperTextClass}>{t('اختياري — يساعد في التقارير والتقديرات')}</div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'specs' && (
            <div className={`${sectionClass} space-y-5 animate-fade-in`}>
              <div>
                <div className="text-sm font-bold text-slate-800 dark:text-white">{t('المواصفات')}</div>
                <div className={helperTextClass}>{t('معلومات عامة عن العقار لتسهيل البحث والفلاتر')}</div>
              </div>
              <div>
                <label className={labelClass} htmlFor={fieldId('address')}>
                  {t('العنوان التفصيلي')}
                </label>
                <input
                  id={fieldId('address')}
                  className={inputClass}
                  value={formData.العنوان}
                  onChange={(e) => setFormData({ ...formData, العنوان: e.target.value })}
                  placeholder={t('مثال: عمان - شارع ...')}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <DynamicSelect
                  label={t('المدينة')}
                  category="prop_city"
                  value={formData.المدينة}
                  onChange={(val) => setFormData({ ...formData, المدينة: val })}
                />
                <DynamicSelect
                  label={t('المنطقة')}
                  category="prop_region"
                  value={formData.المنطقة}
                  onChange={(val) => setFormData({ ...formData, المنطقة: val })}
                />

                <div>
                  <label className={labelClass} htmlFor={fieldId('area')}>
                    {t('المساحة (م²)')}
                  </label>
                  <input
                    id={fieldId('area')}
                    type="number"
                    className={inputClass}
                    value={formData.المساحة}
                    onChange={(e) => setFormData({ ...formData, المساحة: Number(e.target.value) })}
                    min={0}
                  />
                </div>

                <DynamicSelect
                  label={t('اسم الدور')}
                  category="prop_floor"
                  value={formData.الطابق}
                  onChange={(val) => setFormData({ ...formData, الطابق: val })}
                />

                <div>
                  <label className={labelClass} htmlFor={fieldId('rooms')}>
                    {t('عدد الغرف')}
                  </label>
                  <input
                    id={fieldId('rooms')}
                    className={inputClass}
                    value={formData.عدد_الغرف}
                    onChange={(e) => setFormData({ ...formData, عدد_الغرف: e.target.value })}
                    placeholder={t('مثال: 3')}
                  />
                </div>

                <DynamicSelect
                  label={t('صفة العقار')}
                  category="prop_furnishing"
                  value={formData.نوع_التاثيث}
                  onChange={(val) => setFormData({ ...formData, نوع_التاثيث: val })}
                />
              </div>
            </div>
          )}

          {activeTab === 'reg' && (
            <div className={`${sectionClass} space-y-5 animate-fade-in`}>
              <div>
                <div className="text-sm font-bold text-slate-800 dark:text-white">
                  {t('بيانات التسجيل')}
                </div>
                <div className={helperTextClass}>
                  {t('هذه المعلومات مهمة للجودة والتقارير (كهرباء/مياه/قطعة/لوحة)')}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className={labelClass} htmlFor={fieldId('pondName')}>
                    {t('اسم الحوض')}
                  </label>
                  <input
                    id={fieldId('pondName')}
                    className={inputClass}
                    value={formData.اسم_الحوض}
                    onChange={(e) => setFormData({ ...formData, اسم_الحوض: e.target.value })}
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor={fieldId('plotNumber')}>
                    {t('رقم القطعة')}
                  </label>
                  <input
                    id={fieldId('plotNumber')}
                    className={inputClass}
                    value={formData.رقم_قطعة}
                    onChange={(e) => setFormData({ ...formData, رقم_قطعة: e.target.value })}
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor={fieldId('boardNumber')}>
                    {t('رقم اللوحة')}
                  </label>
                  <input
                    id={fieldId('boardNumber')}
                    className={inputClass}
                    value={formData.رقم_لوحة}
                    onChange={(e) => setFormData({ ...formData, رقم_لوحة: e.target.value })}
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor={fieldId('apartmentNumber')}>
                    {t('رقم الشقة')}
                  </label>
                  <input
                    id={fieldId('apartmentNumber')}
                    className={inputClass}
                    value={formData.رقم_شقة}
                    onChange={(e) => setFormData({ ...formData, رقم_شقة: e.target.value })}
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor={fieldId('electricitySub')}>
                    {t('رقم اشتراك الكهرباء')}
                  </label>
                  <input
                    id={fieldId('electricitySub')}
                    className={inputClass}
                    value={formData.رقم_اشتراك_الكهرباء}
                    onChange={(e) =>
                      setFormData({ ...formData, رقم_اشتراك_الكهرباء: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor={fieldId('electricitySubName')}>
                    {t('اسم اشتراك الكهرباء')}
                  </label>
                  <input
                    id={fieldId('electricitySubName')}
                    className={inputClass}
                    value={formData.اسم_اشتراك_الكهرباء}
                    onChange={(e) =>
                      setFormData({ ...formData, اسم_اشتراك_الكهرباء: e.target.value })
                    }
                    placeholder={ownerName ? ownerName : undefined}
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor={fieldId('waterSub')}>
                    {t('رقم اشتراك المياه')}
                  </label>
                  <input
                    id={fieldId('waterSub')}
                    className={inputClass}
                    value={formData.رقم_اشتراك_المياه}
                    onChange={(e) =>
                      setFormData({ ...formData, رقم_اشتراك_المياه: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor={fieldId('waterSubName')}>
                    {t('اسم اشتراك المياه')}
                  </label>
                  <input
                    id={fieldId('waterSubName')}
                    className={inputClass}
                    value={formData.اسم_اشتراك_المياه}
                    onChange={(e) => setFormData({ ...formData, اسم_اشتراك_المياه: e.target.value })}
                    placeholder={ownerName ? ownerName : undefined}
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'sales' && (
            <div className={`${sectionClass} space-y-5 animate-fade-in`}>
              <div>
                <div className="text-sm font-bold text-slate-800 dark:text-white">
                  {t('إعدادات البيع')}
                </div>
                <div className={helperTextClass}>
                  {t('فعّل خيار البيع فقط إذا كان العقار معروض للبيع فعلاً')}
                </div>
              </div>

              <label className="flex items-center justify-between gap-3 p-4 bg-emerald-50/70 dark:bg-emerald-900/10 rounded-xl border border-emerald-200/60 dark:border-emerald-800 cursor-pointer">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    className="w-5 h-5"
                    checked={!!formData.isForSale}
                    onChange={(e) =>
                      setFormData((prev) => {
                        const nextIsForSale = e.target.checked;
                        // Backward-compatible default: properties are rentable unless explicitly marked otherwise.
                        const nextIsForRent = prev.isForRent;
                        return {
                          ...prev,
                          isForSale: nextIsForSale,
                          isForRent: typeof nextIsForRent === 'boolean' ? nextIsForRent : true,
                        };
                      })
                    }
                  />
                  <div>
                    <div className="font-bold text-emerald-800 dark:text-emerald-300">
                      {t('عرض للبيع')}
                    </div>
                    <div className="text-[11px] text-emerald-700/80 dark:text-emerald-300/80">
                      {t('سيتم إنشاء/تحديث عرض بيع تلقائياً')}
                    </div>
                  </div>
                </div>
                <span
                  className={`text-[11px] font-bold px-2 py-1 rounded-full border ${formData.isForSale ? 'bg-emerald-100/70 border-emerald-200 text-emerald-800 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-300' : 'bg-slate-100/70 border-slate-200 text-slate-600 dark:bg-slate-800/60 dark:border-slate-700 dark:text-slate-300'}`}
                >
                  {formData.isForSale ? t('مفعل') : t('غير مفعل')}
                </span>
              </label>

              {formData.isForSale && (
                <label className="flex items-center justify-between gap-3 p-4 bg-slate-50/70 dark:bg-slate-900/40 rounded-xl border border-slate-200/70 dark:border-slate-800 cursor-pointer">
                  <div>
                    <div className="font-bold text-slate-800 dark:text-white">{t('للبيع فقط')}</div>
                    <div className={helperTextClass}>
                      {t('إذا تم تفعيله، سيتم إخفاء العقار من قوائم الإيجار (العقود/المستأجرين)')}
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    className="w-5 h-5"
                    checked={formData.isForRent === false}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        // checked = sale-only => not for rent
                        isForRent: e.target.checked ? false : true,
                      }))
                    }
                  />
                </label>
              )}
              {formData.isForSale && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass} htmlFor={fieldId('salePrice')}>
                      {t('السعر المطلوب')} <span className="text-red-500">*</span>
                    </label>
                    <input
                      id={fieldId('salePrice')}
                      type="number"
                      className={inputClass}
                      value={formData.salePrice}
                      onChange={(e) =>
                        setFormData({ ...formData, salePrice: Number(e.target.value) })
                      }
                      min={0}
                    />
                    <div className={helperTextClass}>{t('إجباري عند تفعيل خيار البيع')}</div>
                  </div>
                  <div>
                    <label className={labelClass} htmlFor={fieldId('minSalePrice')}>
                      {t('أقل سعر')}
                    </label>
                    <input
                      id={fieldId('minSalePrice')}
                      type="number"
                      className={inputClass}
                      value={formData.minSalePrice}
                      onChange={(e) =>
                        setFormData({ ...formData, minSalePrice: Number(e.target.value) })
                      }
                      min={0}
                    />
                    <div className={helperTextClass}>{t('اختياري — لتحديد الحد الأدنى للتفاوض')}</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'notes' && (
            <div className={`${sectionClass} space-y-4 animate-fade-in`}>
              <div>
                <div className="text-sm font-bold text-slate-800 dark:text-white">
                  {t('ملاحظات وحقول إضافية')}
                </div>
                <div className={helperTextClass}>{t('اكتب أي تفاصيل مهمة لتظهر لاحقاً في التقارير')}</div>
              </div>
              <div>
                <label className={labelClass} htmlFor={fieldId('leasedBounds')}>
                  {t('حدود المأجور')}
                </label>
                <textarea
                  id={fieldId('leasedBounds')}
                  className={inputClass}
                  rows={3}
                  value={formData.حدود_المأجور}
                  onChange={(e) => setFormData({ ...formData, حدود_المأجور: e.target.value })}
                ></textarea>
              </div>
              <div>
                <label className={labelClass} htmlFor={fieldId('notes')}>
                  {t('ملاحظات')}
                </label>
                <textarea
                  id={fieldId('notes')}
                  className={inputClass}
                  rows={4}
                  value={formData.ملاحظات}
                  onChange={(e) => setFormData({ ...formData, ملاحظات: e.target.value })}
                ></textarea>
              </div>
              <DynamicFieldsSection
                formId="properties"
                values={dynamicValues}
                onChange={setDynamicValues}
              />
            </div>
          )}
        </div>

        <div className="p-5 border-t border-slate-200/70 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/30 flex justify-end gap-3">
          <div className="flex-1 flex justify-start">
            {activeTab === 'basic' ? (
              <Button type="button" variant="secondary" onClick={onClose}>
                {t('إلغاء')}
              </Button>
            ) : (
              <Button
                type="button"
                variant="secondary"
                rightIcon={<ChevronRight size={18} />}
                onClick={handleBack}
              >
                {t('رجوع')}
              </Button>
            )}
          </div>

          {getNextTab(activeTab) ? (
            <Button
              type="button"
              variant="primary"
              rightIcon={<ChevronLeft size={18} />}
              onClick={handleNext}
            >
              {t('التالي')}
            </Button>
          ) : (
            <Button type="submit" variant="primary" rightIcon={<Check size={18} />}>
              {t('حفظ')}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
};
