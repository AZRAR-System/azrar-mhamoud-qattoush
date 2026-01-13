
import React, { useState, useEffect, useRef } from 'react';
import { DbService } from '@/services/mockDb';
import { عروض_البيع_tbl, اتفاقيات_البيع_tbl, عروض_الشراء_tbl, SalesType } from '@/types';
import { Plus, Search, Filter, Briefcase, FileSignature, CheckCircle, Clock, Home, User, BadgeDollarSign, ArrowUpRight, BarChart3, Lock, HandCoins, Edit2, Trash2 } from 'lucide-react';
import { useSmartModal } from '@/context/ModalContext';
import { useToast } from '@/context/ToastContext';
import { useAppDialogs } from '@/hooks/useAppDialogs';
import { useDbSignal } from '@/hooks/useDbSignal';
import { domainGetSmart } from '@/services/domainQueries';
import { DatePicker } from '@/components/ui/DatePicker';
import { PersonPicker } from '@/components/shared/PersonPicker';
import { PropertyPicker } from '@/components/shared/PropertyPicker';
import { Button } from '@/components/ui/Button';
import { DS } from '@/constants/designSystem';
import { normalizeDigitsToLatin } from '@/utils/numberInput';
import { computeEmployeeCommission } from '@/utils/employeeCommission';
import { formatCurrencyJOD } from '@/utils/format';

// --- SUB-COMPONENT: SALES DASHBOARD ---
const SalesDashboard = () => {
    const dbSignal = useDbSignal();
    void dbSignal;
    const listings = DbService.getSalesListings();
    const offers = DbService.getSalesOffers();
    const agreements = DbService.getSalesAgreements();
    const totalSales = agreements.filter(a => a.isCompleted).reduce((sum, a) => sum + a.السعر_النهائي, 0);
    const activeListings = listings.filter(l => l.الحالة === 'Active');

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-fade-in">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 flex flex-col justify-between h-32">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">مبيعات مكتملة</p>
                        <h3 className="text-2xl font-black text-slate-800 dark:text-white mt-1">{totalSales.toLocaleString()} <span className="text-sm font-normal text-slate-400">د.أ</span></h3>
                    </div>
                    <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg"><BadgeDollarSign size={20}/></div>
                </div>
                <div className="text-xs text-emerald-600 font-bold flex items-center gap-1">
                    <ArrowUpRight size={14} /> إجمالي المبيعات المحققة
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 flex flex-col justify-between h-32">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">عروض نشطة</p>
                        <h3 className="text-2xl font-black text-slate-800 dark:text-white mt-1">{activeListings.length}</h3>
                    </div>
                    <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg"><Briefcase size={20}/></div>
                </div>
                <p className="text-xs text-slate-400">عقارات معروضة حالياً</p>
            </div>

            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 flex flex-col justify-between h-32">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">عروض الشراء</p>
                        <h3 className="text-2xl font-black text-slate-800 dark:text-white mt-1">{offers.length}</h3>
                    </div>
                    <div className="p-2 bg-purple-100 text-purple-600 rounded-lg"><User size={20}/></div>
                </div>
                <p className="text-xs text-slate-400">{offers.filter(o => o.الحالة === 'Pending').length} قيد الانتظار</p>
            </div>

            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 flex flex-col justify-between h-32">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">اتفاقيات موقعة</p>
                        <h3 className="text-2xl font-black text-slate-800 dark:text-white mt-1">{agreements.length}</h3>
                    </div>
                    <div className="p-2 bg-orange-100 text-orange-600 rounded-lg"><FileSignature size={20}/></div>
                </div>
                <p className="text-xs text-slate-400">{agreements.filter(a => !a.isCompleted).length} بانتظار نقل الملكية</p>
            </div>
        </div>
    );
};

// --- MAIN SALES PAGE ---
export const Sales: React.FC = () => {
    const dbSignal = useDbSignal();
    const isDesktopFast = typeof window !== 'undefined' && !!window.desktopDb?.domainGet;

    const fastPropByIdRef = useRef<Map<string, any>>(new Map());
    const fastPersonByIdRef = useRef<Map<string, any>>(new Map());
    const [fastCacheVersion, setFastCacheVersion] = useState(0);
  const [activeTab, setActiveTab] = useState<'listings' | 'agreements'>('listings');
  const [listings, setListings] = useState<عروض_البيع_tbl[]>([]);
  const [agreements, setAgreements] = useState<اتفاقيات_البيع_tbl[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAgreementModalOpen, setIsAgreementModalOpen] = useState(false);
    const [editingAgreementId, setEditingAgreementId] = useState<string | null>(null);
  
  // Forms
  const [newListing, setNewListing] = useState<Partial<عروض_البيع_tbl>>({
      السعر_المطلوب: 0,
      أقل_سعر_مقبول: 0,
      نوع_البيع: 'Cash',
      الحالة: 'Active',
      تاريخ_العرض: new Date().toISOString().split('T')[0]
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
      external: 0
  });

  const [saleExpenses, setSaleExpenses] = useState({
      رسوم_التنازل: 0,
      ضريبة_الابنية: 0,
      نقل_اشتراك_الكهرباء: 0,
      نقل_اشتراك_المياه: 0,
      قيمة_التأمينات: 0,
      ملاحظات: ''
  });

  const [selectedOfferId, setSelectedOfferId] = useState('');

  const { openPanel } = useSmartModal();
  const toast = useToast();
    const dialogs = useAppDialogs();

  useEffect(() => {
    loadData();
    }, [dbSignal]);

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
              handleEditAgreement(agreementId as string);
          } catch {
              // ignore
          }
      }, 0);
  }, []);

  const loadData = () => {
    setListings(DbService.getSalesListings());
    setAgreements(DbService.getSalesAgreements());
  };

  const resetAgreementForm = () => {
      setEditingAgreementId(null);
      setSelectedOfferId('');
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
          ملاحظات: ''
      });
  };

  const openCreateAgreementModal = () => {
      resetAgreementForm();
      setIsAgreementModalOpen(true);
  };

  const handleEditAgreement = (agreementId: string) => {
      const ag = agreements.find(a => a.id === agreementId) || DbService.getSalesAgreements().find(a => a.id === agreementId);
      if (!ag) return;

      setEditingAgreementId(agreementId);
      setSelectedOfferId('');
      setNewAgreement({
          تاريخ_الاتفاقية: ag.تاريخ_الاتفاقية,
          العمولة_الإجمالية: Number(ag.العمولة_الإجمالية || 0),
          طريقة_الدفع: ag.طريقة_الدفع,
          قيمة_الدفعة_الاولى: ag.قيمة_الدفعة_الاولى ?? 0,
          رقم_الفرصة: String((ag as any).رقم_الفرصة || ''),
          يوجد_ادخال_عقار: !!(ag as any).يوجد_ادخال_عقار,
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
  };

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
          setIsModalOpen(false);
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
              setFastCacheVersion(v => v + 1);
              setNewListing({
                  ...newListing,
                  رقم_العقار: String(prop.رقم_العقار || propId),
                  رقم_المالك: String((prop as any).رقم_المالك || ''),
              });
          }
          return;
      }

      const prop = props.find(p => p.رقم_العقار === propId);
      if (prop) {
          setNewListing({ 
              ...newListing, 
              رقم_العقار: prop.رقم_العقار,
              رقم_المالك: prop.رقم_المالك // AUTO SET OWNER
          });
      }
  };

  // Desktop-fast: preload lookups for currently rendered rows (avoid full-array scans)
  useEffect(() => {
      if (!isDesktopFast) return;

      const propIds = new Set<string>();
      const personIds = new Set<string>();

      for (const l of listings) {
          if (l?.رقم_العقار) propIds.add(String(l.رقم_العقار));
          if ((l as any)?.رقم_المالك) personIds.add(String((l as any).رقم_المالك));
      }
      for (const a of agreements) {
          if ((a as any)?.رقم_العقار) propIds.add(String((a as any).رقم_العقار));
          if (a?.رقم_المشتري) personIds.add(String(a.رقم_المشتري));
      }

      if (isAgreementModalOpen) {
          for (const o of DbService.getSalesOffers()) {
              if (o?.الحالة === 'Accepted' && o?.رقم_المشتري) personIds.add(String(o.رقم_المشتري));
          }
      }

      const idsToFetchProps = Array.from(propIds).filter((id) => id && !fastPropByIdRef.current.has(id));
      const idsToFetchPeople = Array.from(personIds).filter((id) => id && !fastPersonByIdRef.current.has(id));

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
                      fastPropByIdRef.current.set(item.id, row);
                      changed = true;
                  }
              } else {
                  if (!fastPersonByIdRef.current.has(item.id)) {
                      fastPersonByIdRef.current.set(item.id, row);
                      changed = true;
                  }
              }
          }
          if (!cancelled && changed) setFastCacheVersion(v => v + 1);
      })();

      return () => {
          cancelled = true;
      };
  }, [isDesktopFast, listings, agreements, isAgreementModalOpen]);

  // When offer is selected, auto-calculate commissions based on settings
  useEffect(() => {
      if (selectedOfferId) {
          const offer = DbService.getSalesOffers().find(o => o.id === selectedOfferId);
          if (offer) {
              const settings = DbService.getSettings();
              const percentage = settings.salesCommissionPercent || 2;
              const commValue = Math.round(offer.قيمة_العرض * (percentage / 100));
              
              setSalesCommissions({
                  buyer: commValue, // Default: Each pays X%
                  seller: commValue,
                  external: 0
              });
              
              setNewAgreement(prev => ({
                  ...prev,
                  العمولة_الإجمالية: commValue * 2 // Initial total
              }));
          }
      }
  }, [selectedOfferId]);

  // Update total commission when components change
  useEffect(() => {
      const total = (salesCommissions.buyer || 0) + (salesCommissions.seller || 0); // External is usually separate or deducted
      setNewAgreement(prev => ({ ...prev, العمولة_الإجمالية: total }));
  }, [salesCommissions]);

  const handleCreateAgreement = (e: React.FormEvent) => {
      e.preventDefault();

      if (editingAgreementId) {
          const res = DbService.updateSalesAgreement(
              editingAgreementId,
              {
                  تاريخ_الاتفاقية: String(newAgreement.تاريخ_الاتفاقية || new Date().toISOString().split('T')[0]),
                  قيمة_الدفعة_الاولى: Number(newAgreement.قيمة_الدفعة_الاولى || 0),
                  طريقة_الدفع: (newAgreement.طريقة_الدفع as SalesType) || 'Cash',
                  العمولة_الإجمالية: Number(newAgreement.العمولة_الإجمالية || 0),
                  رقم_الفرصة: String((newAgreement as any).رقم_الفرصة || ''),
                  يوجد_ادخال_عقار: !!(newAgreement as any).يوجد_ادخال_عقار,
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
      
      const offer = DbService.getSalesOffers().find(o => o.id === selectedOfferId);
      const listing = listings.find(l => l.id === offer?.listingId);
      
      if (!offer || !listing) return;

      const res = DbService.createSalesAgreement({
          ...newAgreement,
          listingId: listing.id,
          رقم_المشتري: offer.رقم_المشتري,
          السعر_النهائي: offer.قيمة_العرض,
          قيمة_المتبقي: offer.قيمة_العرض - (newAgreement.قيمة_الدفعة_الاولى || 0)
      }, listing, { ...salesCommissions, expenses: saleExpenses }); // Pass commission + expenses breakdown

      if (res.success) {
          toast.success(res.message);
          setIsAgreementModalOpen(false);
          setEditingAgreementId(null);
          loadData();
          setActiveTab('agreements');
      }
  };

    const handleTransfer = async (agreementId: string) => {
      const ag = agreements.find(x => x.id === agreementId);
      const listing = listings.find(l => l.id === ag?.listingId);
      const propId = ag?.رقم_العقار || listing?.رقم_العقار;
      const buyerId = ag?.رقم_المشتري;

      if (propId && buyerId) {
          const propAtt = DbService.getAttachments('Property', propId);
          const buyerAtt = DbService.getAttachments('Person', buyerId);
          if (propAtt.length === 0 || buyerAtt.length === 0) {
              toast.warning('قبل إتمام النقل يجب رفع مستندات البيع/نقل الملكية في مرفقات العقار ومرفقات المشتري (مثل سند الملكية الجديد أو غيره)');
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
      return props.find(p => p.رقم_العقار === safeId)?.الكود_الداخلي || safeId;
  };
  const getPersonName = (id: string) => {
      const safeId = String(id || '').trim();
      if (!safeId) return '';
      if (isDesktopFast) return String(fastPersonByIdRef.current.get(safeId)?.الاسم || safeId);
      return people.find(p => p.رقم_الشخص === safeId)?.الاسم || safeId;
  };
  const getAcceptedOffers = () => DbService.getSalesOffers().filter(o => o.الحالة === 'Accepted');

  const listingStatusLabel: Record<string, string> = {
      Active: 'متاح',
      Pending: 'قيد التفاوض',
      Sold: 'مباع',
      Cancelled: 'ملغي',
  };
  const listingStatusOrder: Array<'Active' | 'Pending' | 'Sold' | 'Cancelled'> = ['Active', 'Pending', 'Sold', 'Cancelled'];
  const getPropMeta = (propId: string) => {
      const safeId = String(propId || '').trim();
      const p = isDesktopFast ? fastPropByIdRef.current.get(safeId) : props.find(x => x.رقم_العقار === safeId);
      const status = p?.حالة_العقار ? String(p.حالة_العقار) : '';
      const furnishing = (p as any)?.نوع_التاثيث ? String((p as any).نوع_التاثيث) : '';
      return { status, furnishing };
  };

  return (
    <div className="space-y-8 animate-fade-in pb-10">

       <div className={DS.components.pageHeader}>
           <div>
               <h2 className={`${DS.components.pageTitle} flex items-center gap-2`}>
                   <BadgeDollarSign className="text-indigo-600" /> إدارة المبيعات
               </h2>
               <p className={DS.components.pageSubtitle}>نظام متكامل لإدارة عروض البيع، المفاوضات، ونقل الملكية</p>
           </div>

           <div className="flex flex-wrap items-center justify-end gap-2">
               <Button variant="secondary" onClick={openCreateAgreementModal} leftIcon={<FileSignature size={18} />}>
                   إنشاء اتفاقية
               </Button>
               <Button onClick={() => setIsModalOpen(true)} leftIcon={<Plus size={18} />}>
                   عرض بيع جديد
               </Button>
           </div>
       </div>

       <SalesDashboard />

       {/* Tabs */}
       <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
           <div className="flex border-b border-gray-200 dark:border-slate-700">
               <button 
                  onClick={() => setActiveTab('listings')}
                        className={`flex-1 py-4 font-bold text-sm flex items-center justify-center gap-2 ${activeTab === 'listings' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50 dark:bg-slate-700' : 'text-slate-500 hover:bg-gray-50 dark:hover:bg-slate-700'}`}
               >
                   <Home size={18} /> عروض البيع
               </button>
               <button 
                  onClick={() => setActiveTab('agreements')}
                        className={`flex-1 py-4 font-bold text-sm flex items-center justify-center gap-2 ${activeTab === 'agreements' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50 dark:bg-slate-700' : 'text-slate-500 hover:bg-gray-50 dark:hover:bg-slate-700'}`}
               >
                   <FileSignature size={18} /> الاتفاقيات والعقود
               </button>
           </div>

           <div className="p-6">
               {activeTab === 'listings' && (
                   <div className="space-y-6">
                       {listingStatusOrder.map(status => {
                           const rows = listings.filter(l => l.الحالة === status);
                           if (rows.length === 0) return null;
                           return (
                               <div key={status} className="overflow-x-auto">
                                   <div className="flex items-center justify-between mb-2">
                                       <h3 className="font-black text-slate-800 dark:text-white">
                                           {listingStatusLabel[status]} <span className="text-slate-400 font-bold">({rows.length})</span>
                                       </h3>
                                   </div>
                                   <table className="w-full text-right text-sm">
                                       <thead className="bg-gray-50 dark:bg-slate-900 text-slate-500">
                                           <tr>
                                               <th className="p-4">العقار</th>
                                               <th className="p-4">المالك</th>
                                               <th className="p-4">السعر المطلوب</th>
                                               <th className="p-4">تاريخ العرض</th>
                                               <th className="p-4">الحالة</th>
                                               <th className="p-4">إجراء</th>
                                           </tr>
                                       </thead>
                                       <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                                           {rows.map(l => {
                                               const meta = getPropMeta(l.رقم_العقار);
                                               return (
                                                   <tr key={l.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition">
                                                       <td className="p-4">
                                                           <div className="font-bold">{getPropCode(l.رقم_العقار)}</div>
                                                           {(meta.status || meta.furnishing) && (
                                                               <div className="text-[11px] text-slate-500 mt-1">
                                                                   {meta.status}{meta.furnishing ? ` • ${meta.furnishing}` : ''}
                                                               </div>
                                                           )}
                                                       </td>
                                                       <td className="p-4">{getPersonName(l.رقم_المالك)}</td>
                                                       <td className="p-4 text-emerald-600 font-bold">{l.السعر_المطلوب.toLocaleString()}</td>
                                                       <td className="p-4">{l.تاريخ_العرض}</td>
                                                       <td className="p-4">
                                                           <span className={`px-2 py-1 rounded text-xs font-bold ${l.الحالة === 'Active' ? 'bg-green-100 text-green-700' : l.الحالة === 'Sold' ? 'bg-gray-100 text-gray-500' : l.الحالة === 'Cancelled' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                                                               {listingStatusLabel[l.الحالة] || l.الحالة}
                                                           </span>
                                                       </td>
                                                       <td className="p-4">
                                                           <button
                                                               onClick={() => openPanel('SALES_LISTING_DETAILS', l.id)}
                                                               className="text-indigo-600 hover:underline font-bold"
                                                           >
                                                               التفاصيل والعروض
                                                           </button>
                                                       </td>
                                                   </tr>
                                               );
                                           })}
                                       </tbody>
                                   </table>
                               </div>
                           );
                       })}
                   </div>
               )}

               {activeTab === 'agreements' && (
                   <div className="overflow-x-auto">
                       <table className="w-full text-right text-sm">
                           <thead className="bg-gray-50 dark:bg-slate-900 text-slate-500">
                               <tr>
                                   <th className="p-4">رقم الاتفاقية</th>
                                   <th className="p-4">العقار</th>
                                   <th className="p-4">المشتري</th>
                                   <th className="p-4">السعر النهائي</th>
                                   <th className="p-4">المدفوع / المتبقي</th>
                                   <th className="p-4">الحالة</th>
                                   <th className="p-4">إجراء</th>
                               </tr>
                           </thead>
                           <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                               {agreements.map(a => {
                                   const listing = listings.find(l => l.id === a.listingId);
                                   const propId = a.رقم_العقار || listing?.رقم_العقار;
                                   const sellerId = a.رقم_البائع || listing?.رقم_المالك;
                                   return (
                                       <tr key={a.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition">
                                           <td className="p-4">
                                               <div className="font-mono">#{a.id.substring(6, 12)}</div>
                                               {String((a as any).رقم_الفرصة || '').trim() ? (
                                                   <div className="text-[11px] text-slate-500 mt-1 dir-ltr">فرصة: <b className="text-slate-700 dark:text-slate-200">{String((a as any).رقم_الفرصة)}</b></div>
                                               ) : null}
                                           </td>
                                           <td className="p-4 font-bold">{listing ? getPropCode(listing.رقم_العقار) : '-'}</td>
                                           <td className="p-4">{getPersonName(a.رقم_المشتري)}</td>
                                           <td className="p-4">
                                               <div className="font-bold text-emerald-600">{a.السعر_النهائي.toLocaleString()}</div>
                                               <div className="text-[11px] text-slate-500 mt-1 space-y-0.5">
                                                   <div>إجمالي المصاريف: <b>{Number(a.إجمالي_المصاريف || 0).toLocaleString()}</b></div>
                                                   <div>عمولة البائع: <b>{Number(a.عمولة_البائع || 0).toLocaleString()}</b> • عمولة المشتري: <b>{Number(a.عمولة_المشتري || 0).toLocaleString()}</b></div>
                                                   <div>وسيط خارجي: <b>{Number(a.عمولة_وسيط_خارجي || 0).toLocaleString()}</b> • إجمالي العمولات: <b>{Number(a.إجمالي_العمولات || 0).toLocaleString()}</b></div>
                                               </div>
                                           </td>
                                           <td className="p-4 text-xs">
                                               <div>دفعة: {a.قيمة_الدفعة_الاولى}</div>
                                               <div className="text-red-500">متبقي: {a.قيمة_المتبقي}</div>
                                           </td>
                                           <td className="p-4">
                                               {a.isCompleted ? (
                                                   <span className="flex items-center gap-1 text-green-600 text-xs font-bold bg-green-50 px-2 py-1 rounded w-fit"><CheckCircle size={14}/> ملكية منقولة</span>
                                               ) : (
                                                   <span className="flex items-center gap-1 text-orange-600 text-xs font-bold bg-orange-50 px-2 py-1 rounded w-fit"><Clock size={14}/> قيد الإجراء</span>
                                               )}
                                           </td>
                                           <td className="p-4">
                                               <div className="flex flex-col gap-1">
                                                   {listing?.id && (
                                                       <button
                                                           onClick={() => openPanel('SALES_LISTING_DETAILS', listing.id)}
                                                           className="text-indigo-600 hover:underline font-bold text-xs text-right"
                                                       >
                                                           تفاصيل العرض
                                                       </button>
                                                   )}
                                                   {propId && (
                                                       <button
                                                           onClick={() => openPanel('PROPERTY_DETAILS', propId)}
                                                           className="text-indigo-600 hover:underline font-bold text-xs text-right"
                                                       >
                                                           ملف العقار
                                                       </button>
                                                   )}
                                                   {a.رقم_المشتري && (
                                                       <button
                                                           onClick={() => openPanel('PERSON_DETAILS', a.رقم_المشتري)}
                                                           className="text-indigo-600 hover:underline font-bold text-xs text-right"
                                                       >
                                                           ملف المشتري
                                                       </button>
                                                   )}
                                                   {sellerId && (
                                                       <button
                                                           onClick={() => openPanel('PERSON_DETAILS', sellerId)}
                                                           className="text-indigo-600 hover:underline font-bold text-xs text-right"
                                                       >
                                                           ملف البائع
                                                       </button>
                                                   )}

                                                   <div className="flex gap-2 justify-end pt-1">
                                                       <button
                                                           onClick={() => handleEditAgreement(a.id)}
                                                           className="inline-flex items-center gap-1 text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-indigo-700"
                                                       >
                                                           <Edit2 size={14} /> تعديل
                                                       </button>
                                                       <button
                                                           onClick={() => handleDeleteAgreement(a.id)}
                                                           className="inline-flex items-center gap-1 text-xs font-bold text-red-600 hover:text-red-700"
                                                       >
                                                           <Trash2 size={14} /> حذف
                                                       </button>
                                                   </div>
                                               </div>
                                               {!a.isCompleted && (
                                                   <button 
                                                      onClick={() => handleTransfer(a.id)}
                                                      className="bg-slate-800 text-white px-3 py-1.5 rounded-lg text-xs hover:bg-slate-700"
                                                   >
                                                       إتمام النقل
                                                   </button>
                                               )}
                                           </td>
                                       </tr>
                                   );
                               })}
                           </tbody>
                       </table>
                   </div>
               )}
           </div>
       </div>

       {/* Create Listing Modal */}
       {isModalOpen && (
           <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
               <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-lg shadow-xl overflow-hidden animate-scale-up">
                   <div className="p-5 border-b border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 flex justify-between">
                                             <h3 className="font-bold text-lg text-slate-900 dark:text-white">إدراج عقار للبيع</h3>
                                             <button
                                                 onClick={() => setIsModalOpen(false)}
                                                 className="p-2 rounded-lg text-slate-500 hover:bg-black/10 hover:text-slate-700 dark:text-slate-200 dark:hover:bg-white/10 dark:hover:text-white transition"
                                                 title="إغلاق"
                                                 aria-label="إغلاق"
                                             >
                                                 <span className="text-2xl leading-none">&times;</span>
                                             </button>
                   </div>
                   <form onSubmit={handleCreateListing} className="p-6 space-y-4">
                       <div>
                           <label className="block text-sm font-bold mb-1">العقار</label>
                           {/* REPLACED WITH PROPERTY PICKER */}
                           <PropertyPicker 
                               value={newListing.رقم_العقار}
                               onChange={handlePropertySelect}
                               required
                               placeholder="اختر العقار للبيع..."
                           />
                       </div>
                       
                       {/* Owner Display (Read Only) */}
                       <div className="bg-slate-100 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                           <label className="text-xs font-bold text-slate-500 dark:text-slate-300 mb-1 flex items-center gap-1">
                               <Lock size={10} /> المالك (تلقائي من السجل)
                           </label>
                           <div className="font-bold text-sm text-slate-900 dark:text-white">
                               {newListing.رقم_المالك ? getPersonName(newListing.رقم_المالك) : <span className="text-slate-400">يرجى اختيار العقار أولاً</span>}
                           </div>
                       </div>

                       <div className="grid grid-cols-2 gap-4">
                           <div>
                               <label className="block text-sm font-bold mb-1">السعر المطلوب</label>
                               <input type="number" className="w-full p-2 border rounded-lg text-sm bg-white dark:bg-slate-900 border-gray-300 dark:border-slate-600" required
                                   value={newListing.السعر_المطلوب} onChange={e => setNewListing({...newListing, السعر_المطلوب: Number(e.target.value)})} />
                           </div>
                           <div>
                               <label className="block text-sm font-bold mb-1">أقل سعر مقبول</label>
                               <input type="number" className="w-full p-2 border rounded-lg text-sm bg-white dark:bg-slate-900 border-gray-300 dark:border-slate-600" required
                                   value={newListing.أقل_سعر_مقبول} onChange={e => setNewListing({...newListing, أقل_سعر_مقبول: Number(e.target.value)})} />
                           </div>
                       </div>
                       <div>
                           <label className="block text-sm font-bold mb-1">نوع البيع</label>
                           <select className="w-full p-2 border rounded-lg text-sm bg-white dark:bg-slate-900 border-gray-300 dark:border-slate-600" 
                               value={newListing.نوع_البيع} onChange={e => setNewListing({...newListing, نوع_البيع: e.target.value as SalesType})}>
                               <option value="Cash">نقد (Cash)</option>
                               <option value="Installment">أقساط (Installment)</option>
                               <option value="Mortgage">رهن عقاري (Mortgage)</option>
                           </select>
                       </div>
                       <button type="submit" className="w-full bg-indigo-600 text-white py-2 rounded-lg font-bold hover:bg-indigo-700">حفظ العرض</button>
                   </form>
               </div>
           </div>
       )}

       {/* Create Agreement Modal */}
       {isAgreementModalOpen && (
           <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
               <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-lg shadow-xl overflow-hidden animate-scale-up h-[90vh] flex flex-col">
                   <div className="p-5 border-b border-gray-100 dark:border-slate-700 bg-emerald-600 text-white flex justify-between">
                       <h3 className="font-bold text-lg">{editingAgreementId ? 'تعديل اتفاقية بيع' : 'إنشاء اتفاقية بيع نهائية'}</h3>
                                             <button
                                                 onClick={() => { setIsAgreementModalOpen(false); setEditingAgreementId(null); }}
                                                 className="p-2 rounded-lg text-white/90 hover:text-white hover:bg-white/10 transition"
                                                 title="إغلاق"
                                                 aria-label="إغلاق"
                                             >
                                                 <span className="text-2xl leading-none">&times;</span>
                                             </button>
                   </div>
                   <form onSubmit={handleCreateAgreement} className="p-6 space-y-4 overflow-y-auto flex-1">
                       {!editingAgreementId ? (
                           <>
                               <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg text-xs text-yellow-800 dark:text-yellow-300 mb-4">
                                   يرجى اختيار العرض المقبول الذي سيتم بناء الاتفاقية عليه. سيتم تعبئة بيانات المشتري والسعر تلقائياً.
                               </div>
                               <div>
                                   <label className="block text-sm font-bold mb-1">العرض المقبول</label>
                                   <select className="w-full p-2 border rounded-lg text-sm bg-white dark:bg-slate-900 border-gray-300 dark:border-slate-600" required
                                       value={selectedOfferId} onChange={e => setSelectedOfferId(e.target.value)}>
                                       <option value="">-- اختر العرض --</option>
                                       {getAcceptedOffers().map(o => {
                                           const l = listings.find(lst => lst.id === o.listingId);
                                           return (
                                               <option key={o.id} value={o.id}>
                                                   {getPersonName(o.رقم_المشتري)} - {o.قيمة_العرض.toLocaleString()} - {l ? getPropCode(l.رقم_العقار) : ''}
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
                               <DatePicker value={newAgreement.تاريخ_الاتفاقية} onChange={d => setNewAgreement({...newAgreement, تاريخ_الاتفاقية: d})} />
                           </div>
                           <div>
                               <label className="block text-sm font-bold mb-1">إجمالي العمولة</label>
                               <input type="number" className="w-full p-2 border rounded-lg text-sm bg-gray-100 dark:bg-slate-800 border-gray-300 dark:border-slate-600" readOnly
                                   value={newAgreement.العمولة_الإجمالية} />
                           </div>
                       </div>

                       <div className="grid grid-cols-2 gap-4">
                           <div>
                               <label className="block text-sm font-bold mb-1">رقم الفرصة</label>
                               <input
                                   type="text"
                                   dir="ltr"
                                   inputMode="numeric"
                                   className="w-full p-2 border rounded-lg text-sm bg-white dark:bg-slate-900 border-gray-300 dark:border-slate-600"
                                   value={String((newAgreement as any).رقم_الفرصة ?? '')}
                                   onChange={(e) => {
                                       const next = normalizeDigitsToLatin(e.target.value);
                                       setNewAgreement({ ...(newAgreement as any), رقم_الفرصة: next } as any);
                                   }}
                                   placeholder="Opportunity #"
                               />
                           </div>
                           <div className="flex items-end">
                               <label className="inline-flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200 select-none">
                                   <input
                                       type="checkbox"
                                       checked={!!(newAgreement as any).يوجد_ادخال_عقار}
                                       onChange={(e) => setNewAgreement({ ...(newAgreement as any), يوجد_ادخال_عقار: e.target.checked } as any)}
                                   />
                                   عمولة إدخال عقار (5%)
                               </label>
                           </div>
                       </div>

                       <div className="grid grid-cols-2 gap-4">
                           <div>
                               <label className="block text-sm font-bold mb-1">الدفعة الأولى / العربون</label>
                               <input type="number" className="w-full p-2 border rounded-lg text-sm bg-white dark:bg-slate-900 border-gray-300 dark:border-slate-600" required
                                   value={newAgreement.قيمة_الدفعة_الاولى ?? ''}
                                   onChange={e => {
                                       const raw = e.target.value;
                                       setNewAgreement({
                                           ...newAgreement,
                                           قيمة_الدفعة_الاولى: raw === '' ? undefined : Number(raw)
                                       });
                                   }} />
                           </div>
                           <div>
                               <label className="block text-sm font-bold mb-1">طريقة الدفع</label>
                               <select className="w-full p-2 border rounded-lg text-sm bg-white dark:bg-slate-900 border-gray-300 dark:border-slate-600" 
                                   value={newAgreement.طريقة_الدفع} onChange={e => setNewAgreement({...newAgreement, طريقة_الدفع: e.target.value as SalesType})}>
                                   <option value="Cash">كاش كامل</option>
                                   <option value="Installment">أقساط</option>
                               </select>
                           </div>
                       </div>

                       {/* Detailed Commissions */}
                       <div className="bg-emerald-50 dark:bg-emerald-900/10 p-4 rounded-xl border border-emerald-100 dark:border-emerald-800 space-y-3">
                           <h4 className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-2 text-sm">
                               <HandCoins size={16}/> تفاصيل العمولات
                           </h4>
                           <div className="grid grid-cols-2 gap-3">
                               <div>
                                   <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">من البائع</label>
                                   <input type="number" className="w-full p-2 rounded border bg-white dark:bg-slate-900 border-gray-300 dark:border-slate-600 text-sm" 
                                      value={salesCommissions.seller} onChange={e => setSalesCommissions({...salesCommissions, seller: Number(e.target.value)})} />
                               </div>
                               <div>
                                   <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">من المشتري</label>
                                   <input type="number" className="w-full p-2 rounded border bg-white dark:bg-slate-900 border-gray-300 dark:border-slate-600 text-sm" 
                                      value={salesCommissions.buyer} onChange={e => setSalesCommissions({...salesCommissions, buyer: Number(e.target.value)})} />
                               </div>
                               <div className="col-span-2">
                                   <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">وسيط خارجي (إن وجد)</label>
                                   <input type="number" className="w-full p-2 rounded border bg-white dark:bg-slate-900 border-gray-300 dark:border-slate-600 text-sm" 
                                      value={salesCommissions.external} onChange={e => setSalesCommissions({...salesCommissions, external: Number(e.target.value)})} />
                               </div>
                           </div>
                       </div>

                       {/* Employee Commission (Sale) */}
                       {(() => {
                           const breakdown = computeEmployeeCommission({
                               rentalOfficeCommissionTotal: 0,
                               saleOfficeCommissionTotal: Number(newAgreement.العمولة_الإجمالية || 0),
                               propertyIntroEnabled: !!(newAgreement as any).يوجد_ادخال_عقار,
                           });

                           return (
                               <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700 space-y-3">
                                   <h4 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 text-sm">
                                       <HandCoins size={16}/> عمولة الموظف (تفصيل)
                                   </h4>
                                   <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
                                       <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-700">
                                           <div className="text-xs text-slate-500">إجمالي عمولة البيع (للمكتب)</div>
                                           <div className="font-black text-slate-800 dark:text-white">{formatCurrencyJOD(breakdown.sale.officeCommissionTotal, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
                                       </div>
                                       <div className="p-3 rounded-xl bg-indigo-50/60 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30">
                                           <div className="text-xs text-slate-500">نسبة الموظف (بيع)</div>
                                           <div className="font-black text-indigo-700 dark:text-indigo-300">40%</div>
                                       </div>
                                       <div className="p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30">
                                           <div className="text-xs text-slate-500">عمولة الموظف (بيع)</div>
                                           <div className="font-black text-emerald-700 dark:text-emerald-300">{formatCurrencyJOD(breakdown.sale.earned, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
                                       </div>
                                       <div className="p-3 rounded-xl bg-purple-50/60 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-900/30">
                                           <div className="text-xs text-slate-500">إدخال عقار (5% من إجمالي العمولة)</div>
                                           <div className="font-black text-purple-700 dark:text-purple-300">{formatCurrencyJOD(breakdown.propertyIntro.earned, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
                                       </div>
                                       <div className="p-3 rounded-xl bg-amber-50/60 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 md:col-span-4">
                                           <div className="text-xs text-slate-500">الإجمالي النهائي للموظف</div>
                                           <div className="font-black text-amber-700 dark:text-amber-300 text-lg">{formatCurrencyJOD(breakdown.totals.finalEarned, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
                                       </div>
                                   </div>
                               </div>
                           );
                       })()}

                       {/* Sale Expenses */}
                       <div className="bg-indigo-50 dark:bg-indigo-900/10 p-4 rounded-xl border border-indigo-100 dark:border-indigo-800 space-y-3">
                           <h4 className="font-bold text-indigo-800 dark:text-indigo-300 flex items-center gap-2 text-sm">
                               <HandCoins size={16}/> مصاريف البيع (توثيق كامل)
                           </h4>
                           <div className="grid grid-cols-2 gap-3">
                               <div>
                                   <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">رسوم التنازل</label>
                                   <input type="number" className="w-full p-2 rounded border bg-white dark:bg-slate-900 border-gray-300 dark:border-slate-600 text-sm"
                                      value={saleExpenses.رسوم_التنازل}
                                      onChange={e => setSaleExpenses({ ...saleExpenses, رسوم_التنازل: Number(e.target.value) })}
                                   />
                               </div>
                               <div>
                                   <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">ضريبة الأبنية</label>
                                   <input type="number" className="w-full p-2 rounded border bg-white dark:bg-slate-900 border-gray-300 dark:border-slate-600 text-sm"
                                      value={saleExpenses.ضريبة_الابنية}
                                      onChange={e => setSaleExpenses({ ...saleExpenses, ضريبة_الابنية: Number(e.target.value) })}
                                   />
                               </div>
                               <div>
                                   <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">نقل اشتراك الكهرباء</label>
                                   <input type="number" className="w-full p-2 rounded border bg-white dark:bg-slate-900 border-gray-300 dark:border-slate-600 text-sm"
                                      value={saleExpenses.نقل_اشتراك_الكهرباء}
                                      onChange={e => setSaleExpenses({ ...saleExpenses, نقل_اشتراك_الكهرباء: Number(e.target.value) })}
                                   />
                               </div>
                               <div>
                                   <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">نقل اشتراك المياه</label>
                                   <input type="number" className="w-full p-2 rounded border bg-white dark:bg-slate-900 border-gray-300 dark:border-slate-600 text-sm"
                                      value={saleExpenses.نقل_اشتراك_المياه}
                                      onChange={e => setSaleExpenses({ ...saleExpenses, نقل_اشتراك_المياه: Number(e.target.value) })}
                                   />
                               </div>
                               <div className="col-span-2">
                                   <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">قيمة التأمينات (إن لم يتنازل عنها البائع)</label>
                                   <input type="number" className="w-full p-2 rounded border bg-white dark:bg-slate-900 border-gray-300 dark:border-slate-600 text-sm"
                                      value={saleExpenses.قيمة_التأمينات}
                                      onChange={e => setSaleExpenses({ ...saleExpenses, قيمة_التأمينات: Number(e.target.value) })}
                                   />
                               </div>
                               <div className="col-span-2">
                                   <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">ملاحظات</label>
                                   <textarea className="w-full p-2 rounded border bg-white dark:bg-slate-900 border-gray-300 dark:border-slate-600 text-sm" rows={2}
                                      value={saleExpenses.ملاحظات}
                                      onChange={e => setSaleExpenses({ ...saleExpenses, ملاحظات: e.target.value })}
                                   />
                               </div>
                           </div>

                           <div className="text-xs text-slate-600 dark:text-slate-300 bg-white/60 dark:bg-slate-900/40 p-3 rounded-lg border border-indigo-100 dark:border-indigo-900/30">
                               <div>إجمالي مصاريف البيع: <b>{(Number(saleExpenses.رسوم_التنازل||0)+Number(saleExpenses.ضريبة_الابنية||0)+Number(saleExpenses.نقل_اشتراك_الكهرباء||0)+Number(saleExpenses.نقل_اشتراك_المياه||0)+Number(saleExpenses.قيمة_التأمينات||0)).toLocaleString()}</b> د.أ</div>
                               <div>إجمالي العمولات (بائع + مشتري + وسيط): <b>{(Number(salesCommissions.seller||0)+Number(salesCommissions.buyer||0)+Number(salesCommissions.external||0)).toLocaleString()}</b> د.أ</div>
                           </div>
                       </div>

                       <button type="submit" className="w-full bg-emerald-600 text-white py-3 rounded-lg font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-600/20">
                           {editingAgreementId ? 'حفظ التعديلات' : 'توليد الاتفاقية'}
                       </button>
                   </form>
               </div>
           </div>
       )}

    </div>
  );
};

