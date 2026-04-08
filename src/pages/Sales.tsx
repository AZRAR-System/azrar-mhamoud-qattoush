import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { DbService } from '@/services/mockDb';

const t = (s: string) => s;
import { الأشخاص_tbl, العقارات_tbl, عروض_البيع_tbl, اتفاقيات_البيع_tbl, SalesType } from '@/types';
import {
  Plus,
  Briefcase,
  FileSignature,
  CheckCircle,
  Clock,
  Home,
  User,
  BadgeDollarSign,
  ArrowUpRight,
  Lock,
  HandCoins,
  Edit2,
  Trash2,
  Search,
  Filter,
  ChevronRight,
  Check,
  FileText,
  DollarSign,
  GitMerge,
} from 'lucide-react';
import { useSmartModal } from '@/context/ModalContext';
import { useToast } from '@/context/ToastContext';
import { useAppDialogs } from '@/hooks/useAppDialogs';
import { useDbSignal } from '@/hooks/useDbSignal';
import { domainGetSmart } from '@/services/domainQueries';
import { DatePicker } from '@/components/ui/DatePicker';
import { PropertyPicker } from '@/components/shared/PropertyPicker';
import { Input } from '@/components/ui/Input';
import { MoneyInput } from '@/components/ui/MoneyInput';
import { Button } from '@/components/ui/Button';
import { AppModal } from '@/components/ui/AppModal';
import { PaginationControls } from '@/components/shared/PaginationControls';
import { DS } from '@/constants/designSystem';
import { PageHero } from '@/components/shared/PageHero';
import { computeEmployeeCommission as _computeEmployeeCommission } from '@/utils/employeeCommission';
import { formatCurrencyJOD, formatDateYMD, formatNumber } from '@/utils/format';
import { getErrorMessage } from '@/utils/errors';
import { readSessionFilterJson, writeSessionFilterJson } from '@/utils/sessionFilterStorage';

// --- ANIMATION STYLES ---
const ANIMATIONS = {
  cardAppear: 'animate-[card-appear_0.4s_ease-out_forwards] opacity-0 translate-y-2',
  tabSlideIn: 'animate-[tab-slide-in_0.3s_ease-out_forwards]',
  skeletonPulse: 'animate-pulse bg-gray-200 dark:bg-gray-700 rounded'
};

// --- STATUS FILTER OPTIONS ---
const STATUS_FILTERS = [
  { id: 'all', label: 'الكل', color: 'gray' },
  { id: 'active', label: 'نشط', color: 'green' },
  { id: 'completed', label: 'مكتمل', color: 'emerald' },
  { id: 'cancelled', label: 'ملغي', color: 'red' }
];

// --- SUB-COMPONENT: SALES DASHBOARD ---
const SalesDashboard = () => {
  const dbSignal = useDbSignal();
  void dbSignal;
  const listings = DbService.getSalesListings();
  const offers = DbService.getSalesOffers();
  const agreements = DbService.getSalesAgreements();
  const totalSales = agreements
    .filter((a) => a.isCompleted)
    .reduce((sum, a) => sum + a.السعر_النهائي, 0);
  const activeListings = listings.filter((l) => l.الحالة === 'Active');

  const cards = [
    {
      title: 'مبيعات مكتملة',
      value: totalSales,
      subtitle: 'إجمالي المبيعات المحققة',
      icon: BadgeDollarSign,
      color: 'emerald',
      suffix: 'د.أ',
      trend: '+12%'
    },
    {
      title: 'عروض نشطة',
      value: activeListings.length,
      subtitle: 'عقارات معروضة حالياً',
      icon: Briefcase,
      color: 'indigo',
      suffix: '',
      trend: '+3'
    },
    {
      title: 'عروض الشراء',
      value: offers.length,
      subtitle: `${offers.filter((o) => o.الحالة === 'Pending').length} قيد الانتظار`,
      icon: User,
      color: 'purple',
      suffix: '',
      trend: '+5'
    },
    {
      title: 'اتفاقيات موقعة',
      value: agreements.length,
      subtitle: `${agreements.filter((a) => !a.isCompleted).length} بانتظار نقل الملكية`,
      icon: FileSignature,
      color: 'orange',
      suffix: '',
      trend: '+2'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {cards.map((card, idx) => (
        <div
          key={card.title}
          className={`app-card p-6 flex flex-col justify-between min-h-32 hover:scale-[1.02] transition-all cursor-default ${ANIMATIONS.cardAppear}`}
          style={{ animationDelay: `${idx * 0.1}s` }}
        >
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-500 dark:text-slate-400 text-xs font-black uppercase tracking-wider">
                {t(card.title)}
              </p>
              <h3 className="text-2xl font-black text-slate-800 dark:text-white mt-2">
                {card.color === 'emerald' ? formatCurrencyJOD(card.value, { maximumFractionDigits: 0 }) : formatNumber(card.value)}
                {card.suffix && <span className="text-sm font-bold text-slate-400 ml-1">{card.suffix}</span>}
              </h3>
            </div>
            <div className={`p-3 bg-${card.color}-500/10 text-${card.color}-600 dark:text-${card.color}-400 rounded-2xl border border-${card.color}-200/50 dark:border-${card.color}-500/20 shadow-inner`}>
              <card.icon size={24} />
            </div>
          </div>
          <div className={`text-[10px] text-${card.color}-700 dark:text-${card.color}-400 font-bold flex items-center gap-1 mt-4 bg-${card.color}-50/50 dark:bg-${card.color}-900/20 w-fit px-2 py-0.5 rounded-full border border-${card.color}-100 dark:border-${card.color}-800/50`}>
            <ArrowUpRight size={12} /> {t(card.subtitle)} • <span className="text-green-600">{card.trend}</span>
          </div>
        </div>
      ))}
    </div>
  );
};

// --- SUB-COMPONENT: TIMELINE STATUS ---
const SalesTimeline: React.FC<{ status: string }> = ({ status }) => {
  const steps = [
    { id: 'offer', label: 'عرض', icon: FileText, completed: true },
    { id: 'negotiation', label: 'مفاوضة', icon: GitMerge, completed: status === 'Pending' || status === 'Sold' },
    { id: 'agreement', label: 'اتفاقية', icon: FileSignature, completed: status === 'Sold' },
    { id: 'closed', label: 'إغلاق', icon: CheckCircle, completed: false }
  ];

  return (
    <div className="flex items-center gap-1 mt-2">
      {steps.map((step, idx) => (
        <React.Fragment key={step.id}>
          <div className={`flex items-center gap-1 p-1 rounded-full text-xs ${step.completed ? 'bg-green-100 text-green-700 dark:bg-green-900/30' : 'bg-gray-100 text-gray-400 dark:bg-gray-800'}`}>
            <step.icon size={12} />
            <span className="hidden sm:inline">{step.label}</span>
          </div>
          {idx < steps.length - 1 && (
            <div className={`h-0.5 w-4 ${steps[idx + 1].completed ? 'bg-green-400' : 'bg-gray-200 dark:bg-gray-700'}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

// --- SUB-COMPONENT: SALES CARD (MOBILE) ---
const SalesCard: React.FC<{ item: عروض_البيع_tbl | اتفاقيات_البيع_tbl, type: 'listing' | 'agreement' | 'offer' }> = ({ item, type }) => {
  const { openPanel } = useSmartModal();

  // Type guards
  const isListing = 'السعر_المطلوب' in item;
  const isAgreement = 'السعر_النهائي' in item;
  
  const code = '#' + item.id?.substring(6, 12);
  const status = isListing ? item.الحالة : item.isCompleted ? 'Sold' : 'Pending';
  const price = isListing ? item.السعر_المطلوب : item.السعر_النهائي;
  const date = isListing ? item.تاريخ_العرض : item.تاريخ_الاتفاقية;

  return (
    <div className={`app-card p-4 ${ANIMATIONS.cardAppear}`}>
      <div className="flex justify-between items-start mb-3">
        <div>
          <div className="font-black text-slate-800 dark:text-white">{code}</div>
          <SalesTimeline status={status} />
        </div>
        <span className={`px-2 py-1 rounded-full text-[10px] font-black border ${
          status === 'Active' ? 'bg-green-100 text-green-700 border-green-200' :
          status === 'Sold' ? 'bg-slate-100 text-slate-500 border-slate-200' :
          status === 'Cancelled' ? 'bg-red-100 text-red-700 border-red-200' :
          'bg-orange-100 text-orange-700 border-orange-200'
        }`}>
          {status}
        </span>
      </div>
      
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-slate-500">السعر</span>
          <span className="font-bold text-emerald-600">{formatCurrencyJOD(price)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">التاريخ</span>
          <span className="font-medium">{formatDateYMD(date)}</span>
        </div>
      </div>
      
      <div className="flex gap-2 mt-4 pt-3 border-t border-gray-100 dark:border-gray-800">
        <Button size="sm" variant="ghost" className="flex-1 text-indigo-600" onClick={() => openPanel(type === 'agreement' ? 'CONTRACT_DETAILS' : 'SALES_LISTING_DETAILS', item.id)}>
          تفاصيل
        </Button>
        <Button size="sm" variant="ghost" className="text-emerald-600">
          <Edit2 size={16} />
        </Button>
        <Button size="sm" variant="ghost" className="text-rose-600">
          <Trash2 size={16} />
        </Button>
      </div>
    </div>
  );
};

// --- SUB-COMPONENT: STEPPER MODAL ---
const AgreementStepper: React.FC<{
  step: number;
  onNext: () => void;
  onPrev: () => void;
  onSubmit: (e?: React.FormEvent) => void;
  children: React.ReactNode;
}> = ({ step, onNext, onPrev, onSubmit, children }) => {
  const steps = [
    { id: 1, label: 'بيانات الصفقة', icon: FileText },
    { id: 2, label: 'التفاصيل المالية', icon: DollarSign },
    { id: 3, label: 'العمولات', icon: HandCoins },
    { id: 4, label: 'المراجعة', icon: CheckCircle }
  ];

  return (
    <div className="space-y-6">
      {/* Stepper Header */}
      <div className="flex items-center justify-between mb-6">
        {steps.map((s, idx) => (
          <React.Fragment key={s.id}>
            <div className={`flex flex-col items-center gap-1 ${step >= s.id ? 'text-indigo-600' : 'text-gray-400'}`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${step >= s.id ? 'bg-indigo-100 dark:bg-indigo-900/30' : 'bg-gray-100 dark:bg-gray-800'}`}>
                {step > s.id ? <Check size={18} /> : <s.icon size={18} />}
              </div>
              <span className="text-xs font-medium hidden md:block">{s.label}</span>
            </div>
            {idx < steps.length - 1 && (
              <div className={`flex-1 h-1 mx-2 rounded-full ${step > s.id ? 'bg-indigo-400' : 'bg-gray-200 dark:bg-gray-700'}`} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Step Content */}
      <div className="min-h-[350px]">
        {Array.isArray(children) ? children[step - 1] : children}
      </div>

      {/* Step Actions */}
      <div className="flex justify-between pt-4 border-t border-gray-100 dark:border-gray-800">
        <Button
          type="button"
          variant="secondary"
          onClick={onPrev}
          disabled={step === 1}
        >
          السابق
        </Button>
        {step < 4 ? (
          <Button type="button" onClick={onNext}>
            التالي <ChevronRight size={16} />
          </Button>
        ) : (
          <Button type="button" onClick={onSubmit} variant="primary" className="bg-emerald-600 hover:bg-emerald-700">
            <Check size={16} /> حفظ الاتفاقية
          </Button>
        )}
      </div>
    </div>
  );
};

// --- SUB-COMPONENT: LOADING SKELETON ---
const LoadingSkeleton: React.FC = () => (
  <div className="space-y-4">
    {[1, 2, 3].map((i) => (
      <div key={i} className={`app-card p-4 space-y-3 ${ANIMATIONS.skeletonPulse}`}>
        <div className="h-5 w-1/3 rounded" />
        <div className="h-4 w-1/2 rounded" />
        <div className="h-4 w-2/3 rounded" />
        <div className="flex gap-2 mt-2">
          <div className="h-8 w-20 rounded" />
          <div className="h-8 w-20 rounded" />
        </div>
      </div>
    ))}
  </div>
);

// --- MAIN SALES PAGE ---
export const Sales: React.FC = () => {
  const dbSignal = useDbSignal();
  const isDesktopFast = typeof window !== 'undefined' && !!window.desktopDb?.domainGet;
  const [isLoading, setIsLoading] = useState(true);

  const formId = useId();
  const formIds = {
    listingSaleType: `${formId}-listing-saleType`,
    agreementAcceptedOffer: `${formId}-agreement-accepted-offer`,
    agreementTotalCommission: `${formId}-agreement-total-commission`,
    agreementOpportunityNumber: `${formId}-agreement-opportunity-number`,
    agreementDownPayment: `${formId}-agreement-down-payment`,
    agreementPaymentMethod: `${formId}-agreement-payment-method`,
    agreementCommissionSeller: `${formId}-agreement-commission-seller`,
    agreementCommissionBuyer: `${formId}-agreement-commission-buyer`,
    agreementCommissionExternal: `${formId}-agreement-commission-external`,
    agreementExpenseFee: `${formId}-agreement-expense-fee`,
    agreementExpenseBuildingTax: `${formId}-agreement-expense-building-tax`,
    agreementExpenseElectricity: `${formId}-agreement-expense-electricity`,
    agreementExpenseWater: `${formId}-agreement-expense-water`,
    agreementExpenseDeposits: `${formId}-agreement-expense-deposits`,
    agreementExpenseNotes: `${formId}-agreement-expense-notes`,
  };

  const fastPropByIdRef = useRef<Map<string, العقارات_tbl>>(new Map());
  const fastPersonByIdRef = useRef<Map<string, الأشخاص_tbl>>(new Map());
  const [fastCacheVersion, setFastCacheVersion] = useState(0);
  const [activeTab, setActiveTab] = useState<'listings' | 'offers' | 'agreements'>('listings');
  const [listings, setListings] = useState<عروض_البيع_tbl[]>([]);
  const [_offers, setOffers] = useState<any[]>([]);
  const [agreements, setAgreements] = useState<اتفاقيات_البيع_tbl[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saleOnly, setSaleOnly] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  type SalesFiltersSaved = { listingMarketingFilter?: 'all' | 'sale-only' | 'also-rentable' };
  const savedSalesFilters = readSessionFilterJson<SalesFiltersSaved>('sales');
  const [listingMarketingFilter, setListingMarketingFilter] = useState<
    'all' | 'sale-only' | 'also-rentable'
  >(() => {
    const v = savedSalesFilters?.listingMarketingFilter;
    return v === 'sale-only' || v === 'also-rentable' || v === 'all' ? v : 'all';
  });
  const [isAgreementModalOpen, setIsAgreementModalOpen] = useState(false);
  const [editingAgreementId, setEditingAgreementId] = useState<string | null>(null);
  const [agreementStep, setAgreementStep] = useState(1);

  const [pageSize, setPageSize] = useState(12);
  const [agreementsPage, setAgreementsPage] = useState(1);

  // Forms
  const [newListing, setNewListing] = useState<Partial<عروض_البيع_tbl>>({
    السعر_المطلوب: 0,
    أقل_سعر_مقبول: 0,
    نوع_البيع: 'Cash',
    الحالة: 'Active',
    تاريخ_العرض: new Date().toISOString().split('T')[0],
  });

  const [newAgreement, setNewAgreement] = useState<Partial<اتفاقيات_البيع_tbl>>({
    تاريخ_الاتفاقية: new Date().toISOString().split('T')[0],
    العمولة_الإجمالية: 0,
    طريقة_الدفع: 'Cash',
    رقم_الفرصة: '',
    يوجد_ادخال_عقار: false,
  });

  // Detailed Commissions for Sales Agreement
  const [salesCommissions, setSalesCommissions] = useState({
    buyer: 0,
    seller: 0,
    external: 0,
  });

  const [saleExpenses, setSaleExpenses] = useState({
    رسوم_التنازل: 0,
    ضريبة_الابنية: 0,
    نقل_اشتراك_الكهرباء: 0,
    نقل_اشتراك_المياه: 0,
    قيمة_التأمينات: 0,
    ملاحظات: '',
  });

  const [selectedOfferId, setSelectedOfferId] = useState('');

  const { openPanel } = useSmartModal();
  const toast = useToast();
  const dialogs = useAppDialogs();

  const handleEditAgreementRef = useRef<(agreementId: string) => void>(() => {
    // no-op (assigned after handler definition)
  });
  const handlePropertySelectRef = useRef<(propId: string) => Promise<void>>(async () => {
    // no-op (assigned after handler definition)
  });

  useEffect(() => {
    const compute = () => {
      if (typeof window === 'undefined') return;
      const w = window.innerWidth;
      if (w < 640) setPageSize(6);
      else if (w < 1024) setPageSize(8);
      else setPageSize(12);
    };
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, []);

  useEffect(() => {
    writeSessionFilterJson('sales', { listingMarketingFilter });
  }, [listingMarketingFilter]);

  useEffect(() => {
    if (activeTab === 'agreements') setAgreementsPage(1);
  }, [activeTab]);

  useEffect(() => {
    // Allow deep-linking into agreement edit from other panels (e.g., Property details)
    let agreementId: string | null = null;
    try {
      agreementId = localStorage.getItem('ui_sales_edit_agreement_id');
      if (agreementId) localStorage.removeItem('ui_sales_edit_agreement_id');
    } catch {
      agreementId = null;
    }
    if (!agreementId) return;

    setActiveTab('agreements');
    // Defer until after initial render/state hydration
    setTimeout(() => {
      try {
        handleEditAgreementRef.current(String(agreementId));
      } catch {
        // ignore
      }
    }, 0);
  }, []);

  useEffect(() => {
    // Allow deep-linking into create-listing from other pages (e.g., Properties page)
    let propertyId: string | null = null;
    try {
      propertyId = localStorage.getItem('ui_sales_prefill_property_id');
      if (propertyId) localStorage.removeItem('ui_sales_prefill_property_id');
    } catch {
      propertyId = null;
    }
    if (!propertyId) return;

    setActiveTab('listings');
    setSaleOnly(false);
    setIsModalOpen(true);

    // Defer to allow modal/state hydration and caches
    setTimeout(() => {
      try {
        void handlePropertySelectRef.current(String(propertyId));
      } catch {
        // ignore
      }
    }, 0);
  }, []);

  const loadData = useCallback(() => {
    try {
      setIsLoading(true);
      setListings(DbService.getSalesListings());
      setOffers(DbService.getSalesOffers());
      setAgreements(DbService.getSalesAgreements());
      setTimeout(() => setIsLoading(false), 500);
    } catch (e: unknown) {
      toast.error(getErrorMessage(e) || 'فشل تحميل بيانات المبيعات');
      setListings([]);
      setOffers([]);
      setAgreements([]);
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [dbSignal, loadData]);

  const safeAgreementsPageSize = Math.max(1, Math.floor(pageSize));
  const agreementsPageCount = Math.max(1, Math.ceil(agreements.length / safeAgreementsPageSize));

  useEffect(() => {
    setAgreementsPage((p) => Math.min(Math.max(1, p), agreementsPageCount));
  }, [agreementsPageCount]);

  const visibleAgreements = agreements.slice(
    (agreementsPage - 1) * safeAgreementsPageSize,
    agreementsPage * safeAgreementsPageSize
  );

  const resetAgreementForm = () => {
    setEditingAgreementId(null);
    setSelectedOfferId('');
    setAgreementStep(1);
    setNewAgreement({
      تاريخ_الاتفاقية: new Date().toISOString().split('T')[0],
      العمولة_الإجمالية: 0,
      طريقة_الدفع: 'Cash',
      رقم_الفرصة: '',
      يوجد_ادخال_عقار: false,
    });
    setSalesCommissions({ buyer: 0, seller: 0, external: 0 });
    setSaleExpenses({
      رسوم_التنازل: 0,
      ضريبة_الابنية: 0,
      نقل_اشتراك_الكهرباء: 0,
      نقل_اشتراك_المياه: 0,
      قيمة_التأمينات: 0,
      ملاحظات: '',
    });
  };

  const ListingsStatusTable: React.FC<{
    status: 'Active' | 'Pending' | 'Sold' | 'Cancelled';
    rows: عروض_البيع_tbl[];
    resetKey: string;
  }> = ({ status, rows, resetKey }) => {
    const [page, setPage] = useState(1);
    const safePageSize = Math.max(1, Math.floor(pageSize));
    const pageCount = Math.max(1, Math.ceil(rows.length / safePageSize));

    useEffect(() => {
      setPage(1);
    }, [resetKey]);

    useEffect(() => {
      setPage((p) => Math.min(Math.max(1, p), pageCount));
    }, [pageCount]);

    const visible = rows.slice((page - 1) * safePageSize, page * safePageSize);

    // Responsive: cards on mobile, table on desktop
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

    if (isMobile) {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4">
          {visible.map((l) => (
            <SalesCard key={l.id} item={l} type="listing" />
          ))}
        </div>
      );
    }

    return (
      <div className="app-table-wrapper overflow-hidden animate-slide-up">
        <div className="p-4 flex flex-wrap items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-950/20 border-b border-slate-100 dark:border-slate-800">
          <h3 className="font-black text-slate-800 dark:text-white flex items-center gap-2">
            <div className="w-2 h-6 bg-indigo-500 rounded-full"></div>
            {listingStatusLabel[status]}{' '}
            <span className="text-indigo-500 text-xs font-bold px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/30 rounded-full border border-indigo-100 dark:border-indigo-800/50">
              {rows.length}
            </span>
          </h3>
          <PaginationControls page={page} pageCount={pageCount} onPageChange={setPage} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="app-table-thead">
              <tr>
                <th className="app-table-th">{t('العقار')}</th>
                <th className="app-table-th">{t('المالك')}</th>
                <th className="app-table-th">{t('السعر المطلوب')}</th>
                <th className="app-table-th">{t('تاريخ العرض')}</th>
                <th className="app-table-th">{t('الحالة')}</th>
                <th className="app-table-th">{t('ال Timeline')}</th>
                <th className="app-table-th text-center">{t('إجراء')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
              {visible.map((l) => {
                const meta = getPropMeta(l.رقم_العقار);
                return (
                  <tr key={l.id} className="app-table-row group">
                    <td className="app-table-td">
                      <div className="font-black text-slate-800 dark:text-slate-200">
                        {getPropCode(l.رقم_العقار)}
                      </div>
                      {(meta.status || meta.furnishing) && (
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 font-bold">
                          {meta.status}
                          {meta.furnishing ? ` • ${meta.furnishing}` : ''}
                        </div>
                      )}
                    </td>
                    <td className="app-table-td font-bold text-slate-700 dark:text-slate-300">
                      {getPersonName(l.رقم_المالك)}
                    </td>
                    <td className="app-table-td">
                      <div className="text-emerald-600 dark:text-emerald-400 font-black text-base">
                        {formatCurrencyJOD(l.السعر_المطلوب)}
                      </div>
                    </td>
                    <td className="app-table-td font-medium text-slate-500">{formatDateYMD(l.تاريخ_العرض)}</td>
                    <td className="app-table-td">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-black border ${l.الحالة === 'Active' ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:border-green-800/50' : l.الحالة === 'Sold' ? 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:border-slate-700' : l.الحالة === 'Cancelled' ? 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:border-red-800/50' : 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:border-orange-800/50'}`}
                      >
                        {listingStatusLabel[l.الحالة] || l.الحالة}
                      </span>
                    </td>
                    <td className="app-table-td">
                      <SalesTimeline status={l.الحالة} />
                    </td>
                    <td className="app-table-td text-center">
                      <div className="flex justify-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openPanel('SALES_LISTING_DETAILS', l.id)}
                          className="text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 font-black text-xs rounded-xl"
                        >
                          تفاصيل
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-emerald-600 hover:bg-emerald-50 font-black text-xs rounded-xl"
                        >
                          <Edit2 size={14} />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-rose-600 hover:bg-rose-50 font-black text-xs rounded-xl"
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const openCreateAgreementModal = () => {
    resetAgreementForm();
    setIsAgreementModalOpen(true);
  };

  const handleEditAgreement = useCallback(
    (agreementId: string) => {
      const ag =
        agreements.find((a) => a.id === agreementId) ||
        DbService.getSalesAgreements().find((a) => a.id === agreementId);
      if (!ag) return;

      setEditingAgreementId(agreementId);
      setSelectedOfferId('');
      setAgreementStep(1);
      setNewAgreement({
        تاريخ_الاتفاقية: ag.تاريخ_الاتفاقية,
        العمولة_الإجمالية: Number(ag.العمولة_الإجمالية || 0),
        طريقة_الدفع: ag.طريقة_الدفع,
        قيمة_الدفعة_الاولى: ag.قيمة_الدفعة_الاولى ?? 0,
        رقم_الفرصة: String(ag.رقم_الفرصة || ''),
        يوجد_ادخال_عقار: !!ag.يوجد_ادخال_عقار,
      });
      setSalesCommissions({
        buyer: Number(ag.عمولة_المشتري || 0),
        seller: Number(ag.عمولة_البائع || 0),
        external: Number(ag.عمولة_وسيط_خارجي || 0),
      });
      setSaleExpenses({
        رسوم_التنازل: Number(ag.مصاريف_البيع?.رسوم_التنازل || 0),
        ضريبة_الابنية: Number(ag.مصاريف_البيع?.ضريبة_الابنية || 0),
        نقل_اشتراك_الكهرباء: Number(ag.مصاريف_البيع?.نقل_اشتراك_الكهرباء || 0),
        نقل_اشتراك_المياه: Number(ag.مصاريف_البيع?.نقل_اشتراك_المياه || 0),
        قيمة_التأمينات: Number(ag.مصاريف_البيع?.قيمة_التأمينات || 0),
        ملاحظات: String(ag.مصاريف_البيع?.ملاحظات || ''),
      });
      setIsAgreementModalOpen(true);
    },
    [agreements]
  );

  handleEditAgreementRef.current = handleEditAgreement;

  const handleDeleteAgreement = async (agreementId: string) => {
    const ok = await toast.confirm({
      title: 'حذف اتفاقية',
      message: 'هل أنت متأكد من حذف هذه الاتفاقية؟',
      confirmText: 'حذف',
      cancelText: 'إلغاء',
      isDangerous: true,
    });
    if (!ok) return;
    const res = DbService.deleteSalesAgreement(agreementId);
    if (res.success) {
      toast.success(res.message);
      loadData();
    } else {
      toast.error(res.message);
    }
  };

  const handleCreateListing = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListing.رقم_العقار || !newListing.رقم_المالك) {
      toast.warning('بيانات العقار أو المالك ناقصة');
      return;
    }
    const res = DbService.createSalesListing(newListing);
    if (res.success) {
      toast.success(res.message);

      // Optional: Mark the property as sale-only (not rentable) to separate sale vs rent workflows
      if (saleOnly) {
        try {
          const pid = String(newListing.رقم_العقار || '').trim();
          if (pid) {
            const upd = DbService.updateProperty(pid, { isForRent: false, isForSale: true });
            if (!upd.success) toast.warning('تم حفظ العرض، لكن تعذر تحديث إعدادات الإيجار للعقار');
          }
        } catch {
          // ignore
        }
      }

      setIsModalOpen(false);
      setSaleOnly(false);
      loadData();
    } else {
      toast.error(res.message);
    }
  };

  // Called when property is picked from the modal
  const handlePropertySelect = async (propId: string) => {
    if (isDesktopFast) {
      const prop = await domainGetSmart('properties', propId);
      if (prop) {
        fastPropByIdRef.current.set(String(prop.رقم_العقار || propId), prop);
        setFastCacheVersion((v) => v + 1);
        setNewListing({
          ...newListing,
          رقم_العقار: String(prop.رقم_العقار || propId),
          رقم_المالك: String(prop.رقم_المالك || ''),
        });
      }
      return;
    }

    const prop = props.find((p) => p.رقم_العقار === propId);
    if (prop) {
      setNewListing({
        ...newListing,
        رقم_العقار: prop.رقم_العقار,
        رقم_المالك: prop.رقم_المالك, // AUTO SET OWNER
      });
    }
  };

  handlePropertySelectRef.current = handlePropertySelect;

  // Desktop-fast: preload lookups for currently rendered rows (avoid full-array scans)
  useEffect(() => {
    if (!isDesktopFast) return;

    const propIds = new Set<string>();
    const personIds = new Set<string>();

    for (const l of listings) {
      if (l?.رقم_العقار) propIds.add(String(l.رقم_العقار));
      if (l?.رقم_المالك) personIds.add(String(l.رقم_المالك));
    }
    for (const a of agreements) {
      if (a?.رقم_العقار) propIds.add(String(a.رقم_العقار));
      if (a?.رقم_المشتري) personIds.add(String(a.رقم_المشتري));
    }

    if (isAgreementModalOpen) {
      for (const o of DbService.getSalesOffers()) {
        if (o?.الحالة === 'Accepted' && o?.رقم_المشتري) personIds.add(String(o.رقم_المشتري));
      }
    }

    const idsToFetchProps = Array.from(propIds).filter(
      (id) => id && !fastPropByIdRef.current.has(id)
    );
    const idsToFetchPeople = Array.from(personIds).filter(
      (id) => id && !fastPersonByIdRef.current.has(id)
    );

    const cap = 300;
    const toFetch = [
      ...idsToFetchProps.slice(0, cap).map((id) => ({ entity: 'properties' as const, id })),
      ...idsToFetchPeople.slice(0, cap).map((id) => ({ entity: 'people' as const, id })),
    ];

    if (toFetch.length === 0) return;

    let cancelled = false;
    void (async () => {
      let changed = false;
      for (const item of toFetch) {
        const row = await domainGetSmart(item.entity, item.id);
        if (cancelled || !row) continue;
        if (item.entity === 'properties') {
          if (!fastPropByIdRef.current.has(item.id)) {
            fastPropByIdRef.current.set(item.id, row as العقارات_tbl);
            changed = true;
          }
        } else {
          if (!fastPersonByIdRef.current.has(item.id)) {
            fastPersonByIdRef.current.set(item.id, row as الأشخاص_tbl);
            changed = true;
          }
        }
      }
      if (!cancelled && changed) setFastCacheVersion((v) => v + 1);
    })();

    return () => {
      cancelled = true;
    };
  }, [isDesktopFast, listings, agreements, isAgreementModalOpen]);

  // When offer is selected, auto-calculate commissions based on settings
  useEffect(() => {
    if (selectedOfferId) {
      const offer = DbService.getSalesOffers().find((o) => o.id === selectedOfferId);
      if (offer) {
        const settings = DbService.getSettings();
        const percentage = settings.salesCommissionPercent || 2;
        const commValue = Math.round(offer.قيمة_العرض * (percentage / 100));

        setSalesCommissions({
          buyer: commValue, // Default: Each pays X%
          seller: commValue,
          external: 0,
        });

        setNewAgreement((prev) => ({
          ...prev,
          العمولة_الإجمالية: commValue * 2, // Initial total
        }));
      }
    }
  }, [selectedOfferId]);

  // Update total commission when components change
  useEffect(() => {
    const total = (salesCommissions.buyer || 0) + (salesCommissions.seller || 0); // External is usually separate or deducted
    setNewAgreement((prev) => ({ ...prev, العمولة_الإجمالية: total }));
  }, [salesCommissions]);

  const handleCreateAgreement = (e: React.FormEvent) => {
    e.preventDefault();

    if (editingAgreementId) {
      const res = DbService.updateSalesAgreement(
        editingAgreementId,
        {
          تاريخ_الاتفاقية: String(
            newAgreement.تاريخ_الاتفاقية || new Date().toISOString().split('T')[0]
          ),
          قيمة_الدفعة_الاولى: Number(newAgreement.قيمة_الدفعة_الاولى || 0),
          طريقة_الدفع: (newAgreement.طريقة_الدفع as SalesType) || 'Cash',
          العمولة_الإجمالية: Number(newAgreement.العمولة_الإجمالية || 0),
          رقم_الفرصة: String(newAgreement.رقم_الفرصة || ''),
          يوجد_ادخال_عقار: !!newAgreement.يوجد_ادخال_عقار,
        },
        { ...salesCommissions, expenses: saleExpenses }
      );

      if (res.success) {
        toast.success('تم تعديل الاتفاقية بنجاح');
        setIsAgreementModalOpen(false);
        setEditingAgreementId(null);
        loadData();
      } else {
        toast.error(res.message);
      }
      return;
    }

    if (!selectedOfferId) return toast.warning('يجب اختيار عرض مقبول لإنشاء الاتفاقية');

    const offer = DbService.getSalesOffers().find((o) => o.id === selectedOfferId);
    const listing = listings.find((l) => l.id === offer?.listingId);

    if (!offer || !listing) return;

    const res = DbService.createSalesAgreement(
      {
        ...newAgreement,
        listingId: listing.id,
        رقم_المشتري: offer.رقم_المشتري,
        السعر_النهائي: offer.قيمة_العرض,
        قيمة_المتبقي: offer.قيمة_العرض - (newAgreement.قيمة_الدفعة_الاولى || 0),
      },
      listing,
      { ...salesCommissions, expenses: saleExpenses }
    ); // Pass commission + expenses breakdown

    if (res.success) {
      toast.success(res.message);
      setIsAgreementModalOpen(false);
      setEditingAgreementId(null);
      loadData();
      setActiveTab('agreements');
    }
  };

  const handleTransfer = async (agreementId: string) => {
    const ag = agreements.find((x) => x.id === agreementId);
    const listing = listings.find((l) => l.id === ag?.listingId);
    const propId = ag?.رقم_العقار || listing?.رقم_العقار;
    const buyerId = ag?.رقم_المشتري;

    if (propId && buyerId) {
      const propAtt = DbService.getAttachments('Property', propId);
      const buyerAtt = DbService.getAttachments('Person', buyerId);
      if (propAtt.length === 0 || buyerAtt.length === 0) {
        toast.warning(
          'قبل إتمام النقل يجب رفع مستندات البيع/نقل الملكية في مرفقات العقار ومرفقات المشتري (مثل سند الملكية الجديد أو غيره)'
        );
        openPanel('PROPERTY_DETAILS', propId);
        openPanel('PERSON_DETAILS', buyerId);
        return;
      }
    }

    const txId = await dialogs.prompt({
      title: 'نقل الملكية',
      message: 'أدخل رقم المعاملة في دائرة الأراضي:',
      inputType: 'text',
      placeholder: 'رقم المعاملة',
      required: true,
    });
    if (!txId || !txId.trim()) return;

    const res = DbService.finalizeOwnershipTransfer(agreementId, txId.trim());
    if (res.success) {
      toast.success(res.message);
      // Optional: after a sale completes, the new owner may want to rent the property.
      // Keep it flexible (do not force). Offer a quick toggle.
      if (propId) {
        const makeRentable = await toast.confirm({
          title: 'تفعيل الإيجار؟',
          message:
            'هل تريد جعل العقار متاحاً للإيجار الآن؟ (يمكن تغيير ذلك لاحقاً من تعديل العقار)',
          confirmText: 'نعم، متاح للإيجار',
          cancelText: 'لا',
        });
        if (makeRentable) {
          const upd = DbService.updateProperty(String(propId), { isForRent: true });
          if (upd.success) toast.success('تم تفعيل العقار للإيجار');
          else toast.warning('تم نقل الملكية، لكن تعذر تفعيل الإيجار');
        }
      }
      loadData();
    } else {
      toast.error(res.message);
    }
  };

  // Helper Lookups
  void fastCacheVersion;
  const props = isDesktopFast ? [] : DbService.getProperties();
  const people = isDesktopFast ? [] : DbService.getPeople();
  const getPropCode = (id: string) => {
    const safeId = String(id || '').trim();
    if (!safeId) return '';
    if (isDesktopFast) return String(fastPropByIdRef.current.get(safeId)?.الكود_الداخلي || safeId);
    return props.find((p) => p.رقم_العقار === safeId)?.الكود_الداخلي || safeId;
  };
  const getPersonName = (id: string) => {
    const safeId = String(id || '').trim();
    if (!safeId) return '';
    if (isDesktopFast) return String(fastPersonByIdRef.current.get(safeId)?.الاسم || safeId);
    return people.find((p) => p.رقم_الشخص === safeId)?.الاسم || safeId;
  };
  const getAcceptedOffers = () => DbService.getSalesOffers().filter((o) => o.الحالة === 'Accepted');

  const listingStatusLabel: Record<string, string> = {
    Active: 'متاح',
    Pending: 'قيد التفاوض',
    Sold: 'مباع',
    Cancelled: 'ملغي',
  };
  const listingStatusOrder: Array<'Active' | 'Pending' | 'Sold' | 'Cancelled'> = [
    'Active',
    'Pending',
    'Sold',
    'Cancelled',
  ];
  const getPropMeta = (propId: string) => {
    const safeId = String(propId || '').trim();
    const p = isDesktopFast
      ? fastPropByIdRef.current.get(safeId)
      : props.find((x) => x.رقم_العقار === safeId);
    const status = p?.حالة_العقار ? String(p.حالة_العقار) : '';
    const furnishing = p?.نوع_التاثيث ? String(p.نوع_التاثيث) : '';
    const isForRent = p?.isForRent;
    return { status, furnishing, isForRent };
  };

  const listingMatchesMarketing = (listing: عروض_البيع_tbl) => {
    if (listingMarketingFilter === 'all') return true;
    const meta = getPropMeta(listing?.رقم_العقار);
    const isSaleOnly = meta?.isForRent === false;
    return listingMarketingFilter === 'sale-only' ? isSaleOnly : !isSaleOnly;
  };

  // Filter data
  const filteredListings = listings.filter(l => {
    if (statusFilter !== 'all' && l.الحالة?.toLowerCase() !== statusFilter) return false;
    if (searchQuery && !getPropCode(l.رقم_العقار).includes(searchQuery) && !getPersonName(l.رقم_المالك).includes(searchQuery)) return false;
    return true;
  });

  // Stepper step handlers
  const handleNextStep = () => setAgreementStep(s => Math.min(4, s + 1));
  const handlePrevStep = () => setAgreementStep(s => Math.max(1, s - 1));

  return (
    <div className="space-y-8 animate-fade-in pb-10">
      <PageHero
        icon={<BadgeDollarSign size={28} />}
        iconVariant="featured"
        title={t('إدارة المبيعات')}
        subtitle={t('نظام متكامل لإدارة عروض البيع، المفاوضات، ونقل الملكية')}
        actions={
          <>
            <Button
              variant="secondary"
              onClick={openCreateAgreementModal}
              className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-black px-6 py-3 rounded-2xl shadow-soft hover:shadow-md transition-all active:scale-95"
              leftIcon={<FileSignature size={20} />}
            >
              {t('إنشاء اتفاقية')}
            </Button>
            <Button
              onClick={() => {
                setSaleOnly(false);
                setIsModalOpen(true);
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-6 py-3 rounded-2xl shadow-lg shadow-indigo-600/20 transition-all active:scale-95"
              leftIcon={<Plus size={20} />}
            >
              {t('عرض بيع جديد')}
            </Button>
          </>
        }
      />

      <SalesDashboard />

      {/* Tabs */}
      <div className="app-card overflow-hidden">
        <div className="flex bg-slate-50/50 dark:bg-slate-950/20 p-2 border-b border-slate-100 dark:border-slate-800">
          <button
            onClick={() => setActiveTab('listings')}
            className={`flex-1 py-4 font-black text-sm flex items-center justify-center gap-2 rounded-2xl transition-all duration-300 ${activeTab === 'listings' ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-soft border border-slate-100 dark:border-slate-700' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
          >
            <Home size={20} /> {t('عروض البيع')}
          </button>
          <button
            onClick={() => setActiveTab('offers')}
            className={`flex-1 py-4 font-black text-sm flex items-center justify-center gap-2 rounded-2xl transition-all duration-300 ${activeTab === 'offers' ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-soft border border-slate-100 dark:border-slate-700' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
          >
            <User size={20} /> {t('عروض الشراء')}
          </button>
          <button
            onClick={() => setActiveTab('agreements')}
            className={`flex-1 py-4 font-black text-sm flex items-center justify-center gap-2 rounded-2xl transition-all duration-300 ${activeTab === 'agreements' ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-soft border border-slate-100 dark:border-slate-700' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
          >
            <FileSignature size={20} /> {t('الاتفاقيات والعقود')}
          </button>
        </div>

        {/* Filter Bar */}
        <div className="p-4 bg-slate-50/30 dark:bg-slate-900/20 border-b border-slate-100 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <Input
                placeholder="بحث بالعقار، المالك، السعر..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-10"
              />
            </div>
            
            <div className="flex items-center gap-2 flex-wrap">
              <Filter size={18} className="text-gray-400" />
              {STATUS_FILTERS.map(filter => (
                <button
                  key={filter.id}
                  onClick={() => setStatusFilter(filter.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    statusFilter === filter.id
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-8">
          {isLoading ? (
            <LoadingSkeleton />
          ) : activeTab === 'listings' ? (
            <div className="space-y-8">
              <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-900/30 p-4 rounded-[1.5rem] border border-slate-100 dark:border-slate-800">
                <label
                  htmlFor="listingMarketingFilter"
                  className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest"
                >
                  {t('تصنيف عروض البيع حسب الإيجار')}
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    id="listingMarketingFilter"
                    aria-label={t('تصنيف عروض البيع حسب الإيجار')}
                    value={listingMarketingFilter}
                    onChange={(e) => {
                      const next = String(e.target.value || '').trim();
                      if (next === 'all' || next === 'sale-only' || next === 'also-rentable') {
                        setListingMarketingFilter(next);
                      }
                    }}
                    className="border-none p-3 px-5 rounded-xl text-xs font-black bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 shadow-soft outline-none ring-1 ring-slate-200 dark:ring-slate-700 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  >
                    <option value="all">{t('الكل')}</option>
                    <option value="also-rentable">{t('معروضة للبيع (قد تكون للإيجار أيضاً)')}</option>
                    <option value="sale-only">{t('للبيع فقط (غير متاح للإيجار)')}</option>
                  </select>
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl text-xs font-black"
                    onClick={() => setListingMarketingFilter('all')}
                  >
                    {t('مسح الفلاتر')}
                  </Button>
                </div>
              </div>
              {listingStatusOrder.map((status) => {
                const rows = filteredListings
                  .filter((l) => l.الحالة === status)
                  .filter(listingMatchesMarketing);
                if (rows.length === 0) return null;
                return (
                  <ListingsStatusTable
                    key={status}
                    status={status}
                    rows={rows}
                    resetKey={listingMarketingFilter + statusFilter + searchQuery}
                  />
                );
              })}
            </div>
          ) : activeTab === 'offers' ? (
            <div className="text-center py-16">
              <User size={64} className="mx-auto text-gray-300 mb-4" />
              <h3 className="text-xl font-bold text-gray-500">قسم عروض الشراء</h3>
              <p className="text-gray-400 mt-2">سيتم تفعيل هذا القسم في التحديث القادم</p>
            </div>
          ) : (
            <div className="app-table-wrapper animate-slide-up">
              <div className="p-4 flex flex-wrap items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-950/20 border-b border-slate-100 dark:border-slate-800">
                <div className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  {t('إجمالي الاتفاقيات')}:{' '}
                  <span className="text-indigo-600 dark:text-indigo-400">{agreements.length}</span>
                </div>
                <PaginationControls
                  page={agreementsPage}
                  pageCount={agreementsPageCount}
                  onPageChange={setAgreementsPage}
                />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-right text-sm">
                  <thead className="app-table-thead">
                    <tr>
                      <th className="app-table-th">{t('رقم الاتفاقية')}</th>
                      <th className="app-table-th">{t('العقار')}</th>
                      <th className="app-table-th">{t('المشتري')}</th>
                      <th className="app-table-th">{t('السعر النهائي')}</th>
                      <th className="app-table-th">{t('المدفوع / المتبقي')}</th>
                      <th className="app-table-th">{t('الحالة')}</th>
                      <th className="app-table-th">{t('ال Timeline')}</th>
                      <th className="app-table-th text-center">{t('إجراء')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                    {visibleAgreements.map((a) => {
                      const listing = listings.find((l) => l.id === a.listingId);
                      const propId = a.رقم_العقار || listing?.رقم_العقار;
                      return (
                        <tr key={a.id} className="app-table-row group">
                          <td className="app-table-td">
                            <div className="font-mono font-black text-slate-800 dark:text-slate-200">
                              #{a.id.substring(6, 12)}
                            </div>
                            {String(a.رقم_الفرصة || '').trim() ? (
                              <div className="text-[10px] text-slate-500 mt-1 dir-ltr font-bold">
                                {t('فرصة')}:{' '}
                                <b className="text-indigo-600 dark:text-indigo-400">
                                  {String(a.رقم_الفرصة)}
                                </b>
                              </div>
                            ) : null}
                          </td>
                          <td className="app-table-td font-black text-slate-800 dark:text-slate-200">
                            {listing ? getPropCode(listing.رقم_العقار) : '-'}
                          </td>
                          <td className="app-table-td font-bold text-slate-700 dark:text-slate-300">
                            {getPersonName(a.رقم_المشتري)}
                          </td>
                          <td className="app-table-td">
                            <div className="font-black text-emerald-600 dark:text-emerald-400 text-base">
                              {formatCurrencyJOD(a.السعر_النهائي)}
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 space-y-0.5 font-bold">
                              <div>
                                {t('إجمالي المصاريف')}:{' '}
                                <b>{formatCurrencyJOD(a.إجمالي_المصاريف || 0)}</b>
                              </div>
                              <div>
                                {t('إجمالي العمولات')}:{' '}
                                <b className="text-indigo-600 dark:text-indigo-400">
                                  {formatCurrencyJOD(a.إجمالي_العمولات || 0)}
                                </b>
                              </div>
                            </div>
                          </td>
                          <td className="app-table-td">
                            <div className="flex flex-col gap-1 font-bold text-xs">
                              <div className="text-slate-600 dark:text-slate-400">
                                {t('مدفوع')}: {formatCurrencyJOD(a.قيمة_الدفعة_الاولى)}
                              </div>
                              <div className="text-rose-600">
                                {t('متبقي')}: {formatCurrencyJOD(a.قيمة_المتبقي)}
                              </div>
                            </div>
                          </td>
                          <td className="app-table-td">
                            {a.isCompleted ? (
                              <span className="flex items-center gap-1.5 text-green-600 text-[10px] font-black bg-green-50 dark:bg-green-900/20 px-2.5 py-1 rounded-full border border-green-200 dark:border-green-800/50 w-fit shadow-sm">
                                <CheckCircle size={14} /> {t('ملكية منقولة')}
                              </span>
                            ) : (
                              <span className="flex items-center gap-1.5 text-orange-600 text-[10px] font-black bg-orange-50 dark:bg-orange-900/20 px-2.5 py-1 rounded-full border border-orange-200 dark:border-orange-800/50 w-fit shadow-sm">
                                <Clock size={14} /> {t('قيد الإجراء')}
                              </span>
                            )}
                          </td>
                          <td className="app-table-td">
                            <SalesTimeline status={a.isCompleted ? 'Sold' : 'Pending'} />
                          </td>
                          <td className="app-table-td">
                            <div className="flex flex-col gap-2">
                              <div className="flex flex-wrap gap-1 justify-end">
                                {listing?.id && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => openPanel('SALES_LISTING_DETAILS', listing.id)}
                                    className="text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 font-black text-[10px] h-7 px-2 rounded-lg"
                                  >
                                    {t('العرض')}
                                  </Button>
                                )}
                                {propId && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => openPanel('PROPERTY_DETAILS', propId)}
                                    className="text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 font-black text-[10px] h-7 px-2 rounded-lg"
                                  >
                                    {t('العقار')}
                                  </Button>
                                )}
                              </div>

                              <div className="flex gap-2 justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
                                <button
                                  onClick={() => handleEditAgreement(a.id)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-all border border-indigo-200 dark:border-indigo-800/50"
                                >
                                  <Edit2 size={14} /> {t('تعديل')}
                                </button>
                                <button
                                  onClick={() => handleDeleteAgreement(a.id)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-all border border-rose-200 dark:border-rose-800/50"
                                >
                                  <Trash2 size={14} /> {t('حذف')}
                                </button>
                              </div>

                              {!a.isCompleted && (
                                <Button
                                  size="sm"
                                  onClick={() => handleTransfer(a.id)}
                                  className="bg-slate-800 hover:bg-slate-900 text-white text-[10px] font-black py-1.5 h-8 rounded-xl shadow-md transition-all active:scale-95 mt-1"
                                >
                                  {t('إتمام النقل')}
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Listing Modal */}
      {isModalOpen && (
        <AppModal
          open={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          size="lg"
          title={
            <div className="flex items-center gap-3">
              <span className="p-2 bg-indigo-600 text-white rounded-lg shadow-lg shadow-indigo-600/20">
                <Briefcase size={20} />
              </span>
              <span className="flex flex-col">
                <span className="font-bold text-slate-900 dark:text-white">إدراج عقار للبيع</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  اختر العقار ثم أدخل تفاصيل العرض
                </span>
              </span>
            </div>
          }
          footer={
            <div className="flex items-center justify-end gap-3">
              <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
                إلغاء
              </Button>
              <Button type="submit" variant="primary" form="create-listing-form">
                حفظ العرض
              </Button>
            </div>
          }
        >
          <form id="create-listing-form" onSubmit={handleCreateListing} className="space-y-4">
            <div className={`${DS.components.card} p-4`}>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">
                العقار <span className="text-red-500">*</span>
              </label>
              <PropertyPicker
                value={newListing.رقم_العقار}
                onChange={handlePropertySelect}
                required
                placeholder="اختر العقار للبيع..."
                defaultLinkedOnly={false}
              />
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                يمكن البحث بالكود أو اسم المالك أو رقم القطعة
              </div>

              <label className="mt-3 flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-200/70 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/30 cursor-pointer">
                <div>
                  <div className="text-xs font-bold text-slate-800 dark:text-white">للبيع فقط</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    سيتم إخفاء العقار من قوائم الإيجار (اختيار العقار في العقود)
                  </div>
                </div>
                <input
                  type="checkbox"
                  className="w-5 h-5"
                  checked={saleOnly}
                  onChange={(e) => setSaleOnly(e.target.checked)}
                />
              </label>
            </div>

            <div className={`${DS.components.card} p-4`}>
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <Lock size={10} /> المالك (تلقائي)
                </label>
              </div>
              <div className="font-bold text-sm text-slate-900 dark:text-white mt-2 whitespace-normal break-words">
                {newListing.رقم_المالك ? (
                  getPersonName(newListing.رقم_المالك)
                ) : (
                  <span className="text-slate-400">يرجى اختيار العقار أولاً</span>
                )}
              </div>
            </div>

            <div className={`${DS.components.card} p-4 space-y-4`}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">
                    السعر المطلوب <span className="text-red-500">*</span>
                  </label>
                  <MoneyInput
                    className="w-full px-4 py-3 bg-slate-50/70 dark:bg-slate-950/30 border border-slate-200/80 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/35 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-950 transition text-sm"
                    required
                    placeholder="0.00"
                    value={newListing.السعر_المطلوب ?? undefined}
                    onValueChange={(v) =>
                      setNewListing({ ...newListing, السعر_المطلوب: Math.max(0, Number(v ?? 0)) })
                    }
                    step={0.001}
                  />
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    سيظهر للمستخدمين كـ “السعر المطلوب”
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">
                    أقل سعر مقبول
                  </label>
                  <MoneyInput
                    className="w-full px-4 py-3 bg-slate-50/70 dark:bg-slate-950/30 border border-slate-200/80 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/35 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-950 transition text-sm"
                    placeholder="0.00"
                    value={newListing.أقل_سعر_مقبول ?? undefined}
                    onValueChange={(v) =>
                      setNewListing({ ...newListing, أقل_سعر_مقبول: Math.max(0, Number(v ?? 0)) })
                    }
                    step={0.001}
                  />
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    اختياري — لتحديد حد التفاوض
                  </div>
                </div>
              </div>

              <div>
                <label
                  htmlFor={formIds.listingSaleType}
                  className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1"
                >
                  نوع البيع
                </label>
                <select
                  id={formIds.listingSaleType}
                  className="w-full px-4 py-3 bg-slate-50/70 dark:bg-slate-950/30 border border-slate-200/80 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/35 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-950 transition text-sm"
                  value={newListing.نوع_البيع}
                  onChange={(e) =>
                    setNewListing({ ...newListing, نوع_البيع: e.target.value as SalesType })
                  }
                >
                  <option value="Cash">نقد (Cash)</option>
                  <option value="Installment">أقساط (Installment)</option>
                  <option value="Mortgage">رهن عقاري (Mortgage)</option>
                </select>
              </div>
            </div>
          </form>
        </AppModal>
      )}

      {/* Create Agreement Modal with Stepper */}
      {isAgreementModalOpen && (
        <AppModal
          open={isAgreementModalOpen}
          onClose={() => {
            setIsAgreementModalOpen(false);
            setEditingAgreementId(null);
          }}
          size="xl"
          headerClassName="bg-emerald-600 text-white border-b border-emerald-500"
          titleClassName="text-white"
          title={editingAgreementId ? 'تعديل اتفاقية بيع' : 'إنشاء اتفاقية بيع نهائية'}
          bodyClassName="p-6"
        >
          <form id="create-agreement-form" onSubmit={handleCreateAgreement} className="space-y-4">
            <AgreementStepper
              step={agreementStep}
              onNext={handleNextStep}
              onPrev={handlePrevStep}
              onSubmit={handleCreateAgreement}
            >
              {/* Step 1: بيانات الصفقة */}
              <div className="space-y-4">
                {!editingAgreementId ? (
                  <>
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg text-xs text-yellow-800 dark:text-yellow-300 mb-4">
                      يرجى اختيار العرض المقبول الذي سيتم بناء الاتفاقية عليه. سيتم تعبئة بيانات المشتري
                      والسعر تلقائياً.
                    </div>
                    <div>
                      <label
                        htmlFor={formIds.agreementAcceptedOffer}
                        className="block text-sm font-bold mb-1"
                      >
                        العرض المقبول
                      </label>
                      <select
                        id={formIds.agreementAcceptedOffer}
                        className="w-full p-3 border rounded-lg text-sm bg-white dark:bg-slate-900 border-gray-300 dark:border-slate-600"
                        required
                        value={selectedOfferId}
                        onChange={(e) => setSelectedOfferId(e.target.value)}
                      >
                        <option value="">-- اختر العرض --</option>
                        {getAcceptedOffers().map((o) => {
                          const l = listings.find((lst) => lst.id === o.listingId);
                          return (
                            <option key={o.id} value={o.id}>
                              {getPersonName(o.رقم_المشتري)} - {formatCurrencyJOD(o.قيمة_العرض)} -{' '}
                              {l ? getPropCode(l.رقم_العقار) : ''}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </>
                ) : (
                  <div className="bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-lg text-xs text-indigo-800 dark:text-indigo-300 mb-4">
                    تعديل بيانات الاتفاقية فقط (لا يتم تغيير المشتري/العقار من هنا).
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold mb-1">تاريخ الاتفاقية</label>
                    <DatePicker
                      value={newAgreement.تاريخ_الاتفاقية}
                      onChange={(d) => setNewAgreement({ ...newAgreement, تاريخ_الاتفاقية: d })}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor={formIds.agreementTotalCommission}
                      className="block text-sm font-bold mb-1"
                    >
                      إجمالي العمولة
                    </label>
                    <Input
                      id={formIds.agreementTotalCommission}
                      type="text"
                      className="w-full p-3 border rounded-lg text-sm bg-gray-100 dark:bg-slate-800 border-gray-300 dark:border-slate-600"
                      readOnly
                      value={formatCurrencyJOD(newAgreement.العمولة_الإجمالية)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor={formIds.agreementOpportunityNumber}
                      className="block text-sm font-bold mb-1"
                    >
                      رقم الفرصة
                    </label>
                    <Input
                      id={formIds.agreementOpportunityNumber}
                      type="text"
                      dir="ltr"
                      inputMode="numeric"
                      className="w-full p-3 border rounded-lg text-sm bg-white dark:bg-slate-900 border-gray-300 dark:border-slate-600"
                      value={String(newAgreement.رقم_الفرصة ?? '')}
                      onChange={(e) =>
                        setNewAgreement((prev) => ({ ...prev, رقم_الفرصة: e.target.value }))
                      }
                      placeholder="Opportunity #"
                    />
                  </div>
                  <div className="flex items-end">
                    <label className="inline-flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200 select-none">
                      <input
                        type="checkbox"
                        checked={!!newAgreement.يوجد_ادخال_عقار}
                        onChange={(e) =>
                          setNewAgreement((prev) => ({ ...prev, يوجد_ادخال_عقار: e.target.checked }))
                        }
                      />
                      عمولة إدخال عقار (5%)
                    </label>
                  </div>
                </div>
              </div>
            </AgreementStepper>
          </form>
        </AppModal>
      )}
    </div>
  );
};
