
import React, { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { DbService } from '@/services/mockDb';
import { isTenancyRelevant, pickBestTenancyContract } from '@/utils/tenancy';
import { الأشخاص_tbl, العقارات_tbl, العقود_tbl, عروض_البيع_tbl, عروض_الشراء_tbl } from '@/types';
import { CheckCircle, XCircle, Clock, User, MessageCircle, FileText, Briefcase, Plus, Send } from 'lucide-react';
import { useSmartModal } from '@/context/ModalContext';
import { useToast } from '@/context/ToastContext';
import { PersonPicker } from '@/components/shared/PersonPicker';
import { MoneyInput } from '@/components/ui/MoneyInput';
import { storage } from '@/services/storage';
import { domainGetSmart, propertyContractsSmart } from '@/services/domainQueries';

export const SalesPanel: React.FC<{ id: string }> = ({ id }) => {
  const [listing, setListing] = useState<عروض_البيع_tbl | null>(null);
  const [offers, setOffers] = useState<عروض_الشراء_tbl[]>([]);
  const [showOfferForm, setShowOfferForm] = useState(false);
  const [newOffer, setNewOffer] = useState<Partial<عروض_الشراء_tbl>>({
      قيمة_العرض: 0,
      ملاحظات_التفاوض: ''
  });
    const noteDraftByOfferIdRef = useRef<Record<string, string>>({});
    const noteInputByOfferIdRef = useRef<Record<string, HTMLInputElement | null>>({});
  
  const { openPanel } = useSmartModal();
  const toast = useToast();

    const loadData = useCallback(() => {
        const allListings = DbService.getSalesListings();
        const current = allListings.find((l) => l.id === id);
        if (current) {
            setListing(current);
            setOffers(DbService.getSalesOffers(id));
        }
    }, [id]);

  useEffect(() => {
    loadData();
    }, [loadData]);

                const isDesktop = typeof window !== 'undefined' && storage.isDesktop() && !!window.desktopDb;
                const isDesktopFast = isDesktop && !!window.desktopDb?.domainGet;
                const desktopUnsupported = isDesktop && !isDesktopFast;
        const [desktopProperty, setDesktopProperty] = useState<العقارات_tbl | null>(null);
        const [desktopOwner, setDesktopOwner] = useState<الأشخاص_tbl | null>(null);
        const [desktopActiveContract, setDesktopActiveContract] = useState<العقود_tbl | null>(null);
        const [desktopBuyerById, setDesktopBuyerById] = useState<Map<string, الأشخاص_tbl>>(() => new Map());

        const listingPropertyId = listing?.رقم_العقار;
        const listingOwnerId = listing?.رقم_المالك;

    useEffect(() => {
        if (!isDesktopFast) return;
        let alive = true;
        const run = async () => {
                        if (!listingPropertyId) {
                if (alive) {
                    setDesktopProperty(null);
                    setDesktopOwner(null);
                    setDesktopActiveContract(null);
                }
                return;
            }

                        const pid = String(listingPropertyId);
            const prop = await domainGetSmart('properties', pid);
            if (!alive) return;
            setDesktopProperty(prop);

                        const ownerId = String(listingOwnerId ?? prop?.رقم_المالك ?? '').trim();
            const owner = ownerId ? await domainGetSmart('people', ownerId) : null;
            if (!alive) return;
            setDesktopOwner(owner);

            try {
                const items = (await propertyContractsSmart(pid, 200)) || [];
                                const contracts = items.map((x) => x.contract);
                                const best = pickBestTenancyContract(contracts);
                                const active = best && isTenancyRelevant(best) ? best : null;
                if (!alive) return;
                setDesktopActiveContract(active);
            } catch {
                if (!alive) return;
                setDesktopActiveContract(null);
            }
        };
        void run();
        return () => {
            alive = false;
        };
        }, [isDesktopFast, listingPropertyId, listingOwnerId]);

    useEffect(() => {
        if (!isDesktopFast) return;
        let alive = true;

        const run = async () => {
            const ids = Array.from(
                new Set(
                    offers
                        .map((o) => String(o.رقم_المشتري || '').trim())
                        .filter(Boolean)
                )
            );

            if (!ids.length) {
                if (alive && desktopBuyerById.size !== 0) setDesktopBuyerById(new Map());
                return;
            }

            const next = new Map(desktopBuyerById);
            let changed = false;
            await Promise.all(
                ids.map(async (buyerId) => {
                    if (next.has(buyerId)) return;
                    try {
                        const person = await domainGetSmart('people', buyerId);
                        if (person) {
                            next.set(buyerId, person);
                            changed = true;
                        }
                    } catch {
                        // ignore per-id failures
                    }
                })
            );

            if (alive && changed) setDesktopBuyerById(next);
        };

        void run();
        return () => {
            alive = false;
        };
    }, [isDesktopFast, offers, desktopBuyerById]);

  const handleOfferSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!newOffer.قيمة_العرض || !newOffer.رقم_المشتري) return;
      
      const res = DbService.submitSalesOffer({
          ...newOffer,
          listingId: id
      });
      
      if(res.success) {
          toast.success('تم تقديم العرض بنجاح');
          setShowOfferForm(false);
          setNewOffer({ قيمة_العرض: 0, ملاحظات_التفاوض: '' });
          loadData();
      } else {
          toast.error(res.message);
      }
  };

    const handleStatusChange = async (offerId: string, status: 'Accepted' | 'Rejected') => {
      if (status === 'Accepted' && listing?.أقل_سعر_مقبول) {
          const offer = offers.find(o => o.id === offerId);
          if (offer && offer.قيمة_العرض < listing.أقل_سعر_مقبول) {
                            const ok = await toast.confirm({
                                title: 'تأكيد القبول',
                                message: 'تنبيه: قيمة العرض أقل من الحد الأدنى المقبول. هل أنت متأكد من القبول؟',
                                confirmText: 'قبول',
                                cancelText: 'إلغاء',
                            });
                            if (!ok) return;
          }
      }
      
      const res = DbService.updateOfferStatus(offerId, status);
      if(res.success) {
          toast.success(res.message);
          loadData();
          if (status === 'Accepted') {
              // Trigger Agreement Wizard in parent or navigate
              toast.info('يرجى الانتقال لتبويب الاتفاقيات لإنشاء العقد النهائي');
          }
      } else {
          toast.error(res.message);
      }
  };

  const handleAppendNote = (offerId: string) => {
      const note = (noteDraftByOfferIdRef.current[offerId] || '').trim();
      if (!note) return;
      const res = DbService.addSalesOfferNote(offerId, note);
      if (res.success) {
          toast.success('تمت إضافة الملاحظة');
          noteDraftByOfferIdRef.current[offerId] = '';
          const inputEl = noteInputByOfferIdRef.current[offerId];
          if (inputEl) inputEl.value = '';
          loadData();
      } else {
          toast.error(res.message);
      }
  };

  // IMPORTANT: Hooks must run on every render (React error #310 prevention)
    const propertyLegacy = useMemo(
        () => ((isDesktopFast || desktopUnsupported) ? undefined : (listingPropertyId ? DbService.getProperties().find(p => p.رقم_العقار === listingPropertyId) : undefined)),
        [isDesktopFast, desktopUnsupported, listingPropertyId]
    );
    const ownerLegacy = useMemo(
        () => ((isDesktopFast || desktopUnsupported) ? undefined : (listingOwnerId ? DbService.getPeople().find(p => p.رقم_الشخص === listingOwnerId) : undefined)),
        [isDesktopFast, desktopUnsupported, listingOwnerId]
    );
    const activeContractLegacy = useMemo(() => {
        if (isDesktopFast || desktopUnsupported) return undefined;
        if (!listingPropertyId) return undefined;
        const contracts = DbService.getContracts();
        return contracts.find(c => c.رقم_العقار === listingPropertyId && isTenancyRelevant(c) && c.isArchived !== true);
    }, [isDesktopFast, desktopUnsupported, listingPropertyId]);

    const property: العقارات_tbl | undefined = isDesktopFast ? (desktopProperty ?? undefined) : propertyLegacy;
    const owner: الأشخاص_tbl | undefined = isDesktopFast ? (desktopOwner ?? undefined) : ownerLegacy;
    const activeContract: العقود_tbl | undefined = isDesktopFast ? (desktopActiveContract ?? undefined) : activeContractLegacy;

  if (!listing) return <div className="p-8 text-center">جاري التحميل...</div>;

  const canAddOffer = listing.الحالة === 'Active';

  return (
    <div className="space-y-6">
       {/* Header */}
    <div className="app-card p-6 relative overflow-hidden">
           <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
           <div className="flex justify-between items-start">
               <div>
                   <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                       <Briefcase className="text-emerald-600" /> عرض بيع: {property?.الكود_الداخلي}
                   </h2>
                   <p className="text-sm text-slate-500 mt-1">{property?.العنوان}</p>
                   <div className="mt-2 flex flex-wrap gap-2">
                       {property?.رقم_العقار && (
                           <button
                               onClick={() => openPanel('PROPERTY_DETAILS', property.رقم_العقار)}
                               className="text-xs font-bold text-indigo-600 hover:underline"
                           >
                               فتح ملف العقار
                           </button>
                       )}
                       {owner?.رقم_الشخص && (
                           <button
                               onClick={() => openPanel('PERSON_DETAILS', owner.رقم_الشخص)}
                               className="text-xs font-bold text-indigo-600 hover:underline"
                           >
                               فتح ملف المالك
                           </button>
                       )}
                       {activeContract?.رقم_العقد && (
                           <button
                               onClick={() => openPanel('CONTRACT_DETAILS', activeContract.رقم_العقد)}
                               className="text-xs font-bold text-orange-600 hover:underline flex items-center gap-1"
                           >
                               <FileText size={12} /> يوجد عقد إيجار نشط
                           </button>
                       )}
                   </div>
               </div>
               <div className="text-left">
                   <p className="text-xs text-slate-400">السعر المطلوب</p>
                   <p className="text-2xl font-bold text-emerald-600">{listing.السعر_المطلوب.toLocaleString()} <span className="text-sm">د.أ</span></p>
               </div>
           </div>
           
               <div className="mt-4 flex gap-4 text-sm text-slate-600 dark:text-slate-300 bg-gray-50 dark:bg-slate-900/50 p-3 rounded-xl">
               <span className="flex items-center gap-1"><User size={14}/> المالك: {owner?.الاسم}</span>
               <span className="text-gray-300">|</span>
               <span className="flex items-center gap-1"><Clock size={14}/> تاريخ العرض: {listing.تاريخ_العرض}</span>
               <span className="text-gray-300">|</span>
               <span className={`px-2 py-0.5 rounded text-xs font-bold ${listing.الحالة === 'Active' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                   {listing.الحالة}
               </span>
           </div>
       </div>

       {/* Offers Section */}
       <div className="app-card overflow-hidden">
           <div className="p-4 bg-gray-50 dark:bg-slate-900/50 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center">
               <h3 className="font-bold text-slate-700 dark:text-white flex items-center gap-2">
                   <MessageCircle size={18} className="text-indigo-500" /> العروض المستلمة ({offers.length})
               </h3>
               <button 
                  onClick={() => setShowOfferForm(!showOfferForm)}
                  disabled={!canAddOffer}
                  className={`text-sm px-3 py-1.5 rounded-lg transition flex items-center gap-1 ${canAddOffer ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-gray-200 text-gray-500 cursor-not-allowed'}`}
               >
                   <Plus size={14} /> عرض جديد
               </button>
           </div>

           {!canAddOffer && (
               <div className="p-3 text-xs bg-yellow-50 dark:bg-yellow-900/10 text-yellow-800 dark:text-yellow-300 border-b border-yellow-100 dark:border-yellow-800">
                   لا يمكن إضافة عروض جديدة لأن حالة عرض البيع الحالية هي: <b>{listing.الحالة}</b>
               </div>
           )}

           {/* Add Offer Form */}
           {showOfferForm && canAddOffer && (
               <form onSubmit={handleOfferSubmit} className="p-4 bg-indigo-50 dark:bg-indigo-900/10 border-b border-indigo-100 dark:border-indigo-800 grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div>
                      <PersonPicker
                        label="المشتري"
                        value={String(newOffer.رقم_المشتري || '')}
                        onChange={(personId) => setNewOffer({ ...newOffer, رقم_المشتري: personId })}
                        required
                        defaultRole="مشتري"
                        placeholder="اختر مشتري..."
                      />
                   </div>
                   <div>
                       <label className="block text-xs font-bold mb-1">قيمة العرض (د.أ)</label>
                       <MoneyInput
                          className="w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition text-slate-800 dark:text-white"
                          value={typeof newOffer.قيمة_العرض === 'number' ? newOffer.قيمة_العرض : undefined}
                          onValueChange={(v) => setNewOffer({ ...newOffer, قيمة_العرض: v })}
                          required
                       />
                   </div>
                   <div className="md:col-span-2">
                       <label className="block text-xs font-bold mb-1">ملاحظات التفاوض</label>
                       <textarea 
                                                    className="w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition text-slate-800 dark:text-white"
                          rows={2}
                          value={newOffer.ملاحظات_التفاوض}
                          onChange={e => setNewOffer({...newOffer, ملاحظات_التفاوض: e.target.value})}
                       ></textarea>
                   </div>
                   <div className="md:col-span-2 flex justify-end">
                       <button type="submit" className="bg-indigo-600 text-white px-6 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700">تقديم العرض</button>
                   </div>
               </form>
           )}

           {/* Offers List */}
           <div className="divide-y divide-gray-100 dark:divide-slate-700">
               {offers.length === 0 ? (
                   <p className="p-6 text-center text-gray-400 text-sm">لا توجد عروض مقدمة بعد.</p>
               ) : (
                   offers.map(offer => {
                       const buyerId = String(offer.رقم_المشتري || '').trim();
                       const buyer = isDesktopFast
                           ? (buyerId ? desktopBuyerById.get(buyerId) : undefined)
                           : (desktopUnsupported ? undefined : DbService.getPeople().find(b => b.رقم_الشخص === offer.رقم_المشتري));
                       return (
                           <div key={offer.id} className="p-4 hover:bg-gray-50 dark:hover:bg-slate-700/30 transition">
                               <div className="flex justify-between items-start mb-2">
                                   <div>
                                       <span className="font-bold text-slate-800 dark:text-white block">{buyer?.الاسم || 'Unknown'}</span>
                                       <span className="text-xs text-slate-500">{new Date(offer.تاريخ_العرض).toLocaleDateString()}</span>
                                       {buyer?.رقم_الشخص && (
                                           <button
                                               onClick={() => openPanel('PERSON_DETAILS', buyer.رقم_الشخص)}
                                               className="mt-1 block text-[11px] font-bold text-indigo-600 hover:underline"
                                           >
                                               فتح ملف المشتري
                                           </button>
                                       )}
                                   </div>
                                   <div className="text-right">
                                       <span className="block font-bold text-emerald-600">{offer.قيمة_العرض.toLocaleString()} د.أ</span>
                                       <span className={`text-[10px] px-2 py-0.5 rounded font-bold 
                                           ${offer.الحالة === 'Accepted' ? 'bg-green-100 text-green-700' : 
                                             offer.الحالة === 'Rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                           {offer.الحالة}
                                       </span>
                                   </div>
                               </div>
                               {offer.ملاحظات_التفاوض && (
                                   <pre className="whitespace-pre-wrap text-xs text-slate-600 bg-gray-100 dark:bg-slate-900 p-2 rounded mt-2">{offer.ملاحظات_التفاوض}</pre>
                               )}

                               <div className="mt-3 flex gap-2 items-center">
                                   <input
                                       type="text"
                                       ref={(el) => {
                                           noteInputByOfferIdRef.current[offer.id] = el;
                                       }}
                                       className="flex-1 p-2 rounded border text-xs bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                       placeholder="إضافة ملاحظة تفاوض..."
                                       onChange={(e) => {
                                           noteDraftByOfferIdRef.current[offer.id] = e.target.value;
                                       }}
                                   />
                                   <button
                                       type="button"
                                       onClick={() => handleAppendNote(offer.id)}
                                       className="px-3 py-2 rounded bg-slate-800 text-white text-xs font-bold hover:bg-slate-700 flex items-center gap-1"
                                   >
                                       <Send size={14} /> إرسال
                                   </button>
                               </div>
                               
                               {offer.الحالة === 'Pending' && (
                                   <div className="mt-3 flex gap-2 justify-end">
                                       <button onClick={() => handleStatusChange(offer.id, 'Rejected')} className="text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1 rounded text-xs font-bold flex items-center gap-1 transition">
                                           <XCircle size={14}/> رفض
                                       </button>
                                       <button onClick={() => handleStatusChange(offer.id, 'Accepted')} className="text-green-600 bg-green-50 hover:bg-green-100 px-3 py-1 rounded text-xs font-bold flex items-center gap-1 transition">
                                           <CheckCircle size={14}/> قبول
                                       </button>
                                   </div>
                               )}
                           </div>
                       );
                   })
               )}
           </div>
       </div>
    </div>
  );
};
