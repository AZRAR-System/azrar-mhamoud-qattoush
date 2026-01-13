
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { DbService } from '@/services/mockDb';
import { openWhatsAppForPhones } from '@/utils/whatsapp';
import { User, Activity, MapPin, Phone, Star, FileText, ShieldAlert, Ban, Edit2, Trash2, Printer, Briefcase } from 'lucide-react';
import { useSmartModal } from '@/context/ModalContext';
import { ROUTE_PATHS } from '@/routes/paths';
import { AttachmentManager } from '@/components/AttachmentManager';
import { useToast } from '@/context/ToastContext';
import { RBACGuard } from '@/components/shared/RBACGuard';
import { DynamicFieldsDisplay } from '@/components/dynamic/DynamicFieldsDisplay';
import { PrintLetterhead } from '@/components/print/PrintLetterhead';
import { isTenancyRelevant, pickBestTenancyContract } from '@/utils/tenancy';
import { formatContractNumberShort } from '@/utils/contractNumber';
import { storage } from '@/services/storage';
import { personDetailsSmart, personTenancyContractsSmart } from '@/services/domainQueries';
import type { PersonDetailsResult, الأشخاص_tbl, العقارات_tbl, العقود_tbl, سجل_الملكية_tbl, عروض_البيع_tbl, اتفاقيات_البيع_tbl } from '@/types';

export const PersonPanel: React.FC<{ id: string; onClose?: () => void }> = ({ id, onClose }) => {
  const [profileData, setProfileData] = useState<PersonDetailsResult | null>(null);
  const [fastTenancy, setFastTenancy] = useState<Array<{ contract: any; propertyCode?: string; propertyAddress?: string; tenantName?: string }>>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { openPanel } = useSmartModal();
  const toast = useToast();

  const isDesktop = storage.isDesktop() && !!(window as any)?.desktopDb;
  const isDesktopFast =
    isDesktop &&
    !!(window as any)?.desktopDb?.domainPersonDetails &&
    !!(window as any)?.desktopDb?.domainPersonTenancyContracts;
  const desktopUnsupported = isDesktop && !isDesktopFast;

  const loadData = useCallback(() => {
    let alive = true;

    const run = async () => {
      if (desktopUnsupported) {
        if (!alive) return;
        setProfileData(null);
        setFastTenancy([]);
        setLoadError('هذه الشاشة تحتاج وضع السرعة/SQL في نسخة الديسكتوب');
        return;
      }

      if (isDesktopFast) {
        try {
          const [details, tenancy] = await Promise.all([
            personDetailsSmart(id),
            personTenancyContractsSmart(id),
          ]);

          if (!alive) return;

          setLoadError(null);
          if (details) setProfileData(details as any);
          else setProfileData(null);

          setFastTenancy(Array.isArray(tenancy) ? tenancy : []);
        } catch {
          if (!alive) return;
          setLoadError('تعذر تحميل بيانات الشخص في وضع السرعة');
          setProfileData(null);
          setFastTenancy([]);
        }
        return;
      }

      const data = DbService.getPersonDetails(id);
      if (data) setProfileData(data);
    };

    void run();

    return () => {
      alive = false;
    };
  }, [id, isDesktopFast]);

  useEffect(() => {
    const cleanup = loadData();
    return () => {
      if (typeof cleanup === 'function') cleanup();
    };
  }, [loadData]);

  const handleRemoveFromBlacklist = async () => {
      const ok = await toast.confirm({
        title: 'تأكيد رفع الحظر',
        message: 'هل أنت متأكد من رفع الحظر عن هذا الشخص؟',
        confirmText: 'نعم',
        cancelText: 'إلغاء',
      });
      if (!ok) return;
      DbService.removeFromBlacklist(id);
      toast.success('تم رفع الحظر بنجاح');
      loadData();
  };

    const handleEdit = () => {
      openPanel('PERSON_FORM', id, {
        onSuccess: () => setTimeout(loadData, 300)
      });
    };

    const handleDelete = async () => {
      const ok = await toast.confirm({
        title: 'تأكيد الحذف',
        message: 'هل أنت متأكد من حذف هذا الملف؟',
        confirmText: 'حذف',
        cancelText: 'إلغاء',
      });
      if (!ok) return;
      const res = DbService.deletePerson(id);
      if (res.success) {
        toast.success(res.message);
        if (onClose) onClose();
      } else {
        toast.error(res.message);
      }
    };

  if (desktopUnsupported) {
    return (
      <div className="p-10 text-center text-slate-600 dark:text-slate-300">
        <div className="mx-auto mb-3 w-12 h-12 rounded-full bg-yellow-100 dark:bg-yellow-900/20 flex items-center justify-center">
          <ShieldAlert className="w-6 h-6 text-yellow-700 dark:text-yellow-300" />
        </div>
        <div className="font-bold">غير مدعوم في وضع الديسكتوب الحالي</div>
        <div className="text-sm mt-2">يرجى تحديث نسخة الديسكتوب أو تفعيل وضع السرعة/SQL.</div>
      </div>
    );
  }

  if (!profileData) {
    return (
      <div className="p-10 text-center text-slate-600 dark:text-slate-300">
        {loadError ? (
          <div>
            <div className="mx-auto mb-3 w-12 h-12 rounded-full bg-yellow-100 dark:bg-yellow-900/20 flex items-center justify-center">
              <ShieldAlert className="w-6 h-6 text-yellow-700 dark:text-yellow-300" />
            </div>
            <div className="font-bold">تعذر تحميل البيانات</div>
            <div className="text-sm mt-2">{loadError}</div>
          </div>
        ) : (
          'جاري التحميل...'
        )}
      </div>
    );
  }

  const { person: p, roles, stats, ownedProperties, blacklistRecord } = profileData;
  const ownershipHistory: سجل_الملكية_tbl[] = DbService.getOwnershipHistory(undefined, id);
  const propsIndex = isDesktopFast ? [] : DbService.getProperties();
  const peopleIndex = isDesktopFast ? [] : DbService.getPeople();

  const tenancyContractsRaw: any[] = isDesktopFast ? (fastTenancy || []).map((x) => x.contract).filter(Boolean) : DbService.getContracts();
  const tenancyContracts = (tenancyContractsRaw || []).filter(isTenancyRelevant);

  const peopleById = useMemo(() => {
    const map = new Map<string, الأشخاص_tbl>();
    if (isDesktopFast) return map;
    for (const person of peopleIndex) map.set(String((person as any).رقم_الشخص), person as any);
    return map;
  }, [isDesktopFast, peopleIndex]);

  const propertiesById = useMemo(() => {
    const map = new Map<string, العقارات_tbl>();
    if (isDesktopFast) return map;
    for (const prop of propsIndex) map.set(String((prop as any).رقم_العقار), prop as any);
    return map;
  }, [isDesktopFast, propsIndex]);

  const tenantNameByContractId = useMemo(() => {
    const map = new Map<string, string>();
    if (!isDesktopFast) return map;
    for (const it of fastTenancy || []) {
      const cId = String(it?.contract?.رقم_العقد || '');
      if (!cId) continue;
      map.set(cId, String(it?.tenantName || ''));
    }
    return map;
  }, [isDesktopFast, fastTenancy]);

  const propertyCodeById = useMemo(() => {
    const map = new Map<string, string>();
    for (const prop of ownedProperties || []) {
      const pid = String((prop as any).رقم_العقار || '');
      const code = String((prop as any).الكود_الداخلي || '').trim();
      if (pid && code) map.set(pid, code);
    }
    if (isDesktopFast) {
      for (const it of fastTenancy || []) {
        const pid = String(it?.contract?.رقم_العقار || '');
        const code = String(it?.propertyCode || '').trim();
        if (pid && code) map.set(pid, code);
      }
      return map;
    }
    for (const prop of propsIndex || []) {
      const pid = String((prop as any).رقم_العقار || '');
      const code = String((prop as any).الكود_الداخلي || '').trim();
      if (pid && code) map.set(pid, code);
    }
    return map;
  }, [ownedProperties, isDesktopFast, fastTenancy, propsIndex]);

  const propertyAddressById = useMemo(() => {
    const map = new Map<string, string>();
    if (!isDesktopFast) return map;
    for (const it of fastTenancy || []) {
      const pid = String(it?.contract?.رقم_العقار || '');
      const addr = String(it?.propertyAddress || '').trim();
      if (pid && addr && !map.has(pid)) map.set(pid, addr);
    }
    return map;
  }, [isDesktopFast, fastTenancy]);

  const getPropCode = (propId: string) => propertyCodeById.get(String(propId || '')) || propId;

  const contractsByPropertyId = (() => {
    const map = new Map<string, العقود_tbl[]>();
    for (const c of tenancyContracts) {
      const propId = String(c.رقم_العقار || '');
      if (!propId) continue;
      const arr = map.get(propId);
      if (arr) arr.push(c);
      else map.set(propId, [c]);
    }
    for (const [k, arr] of map) {
      arr.sort((a, b) => String(b.تاريخ_البداية || '').localeCompare(String(a.تاريخ_البداية || '')));
      map.set(k, arr);
    }
    return map;
  })();

  const ownedPropertyIds = new Set<string>((ownedProperties || []).map((x) => String(x.رقم_العقار)));
  const contractsAsTenant = tenancyContracts
    .filter((c) => String(c.رقم_المستاجر) === String(id))
    .slice()
    .sort((a, b) => String(b.تاريخ_البداية || '').localeCompare(String(a.تاريخ_البداية || '')));
  const contractsAsGuarantor = tenancyContracts
    .filter((c) => String(c.رقم_الكفيل) === String(id))
    .slice()
    .sort((a, b) => String(b.تاريخ_البداية || '').localeCompare(String(a.تاريخ_البداية || '')));
  const contractsAsOwner = tenancyContracts
    .filter((c) => ownedPropertyIds.has(String(c.رقم_العقار)))
    .slice()
    .sort((a, b) => String(b.تاريخ_البداية || '').localeCompare(String(a.تاريخ_البداية || '')));

  const safeString = (val: unknown) => (val ? String(val) : '');
  const safeNum = (val: unknown) => (isNaN(Number(val)) ? 0 : Number(val));

  const handlePrint = () => window.print();

    const handleEditAgreementFromPerson = (agreementId: string) => {
      try {
        localStorage.setItem('ui_sales_edit_agreement_id', agreementId);
      } catch {
        // ignore
      }
      window.location.hash = '#' + ROUTE_PATHS.SALES;
      if (onClose) onClose();
    };

    const salesListingsForPerson: عروض_البيع_tbl[] = (() => {
      const listings: عروض_البيع_tbl[] = DbService.getSalesListings();
      return listings.filter(l => String(l.رقم_المالك) === String(id));
    })();

    const salesAgreementsForPerson: Array<{ a: اتفاقيات_البيع_tbl; listing?: عروض_البيع_tbl; sellerId?: string }> = (() => {
      const agreements: اتفاقيات_البيع_tbl[] = DbService.getSalesAgreements();
      const listings: عروض_البيع_tbl[] = DbService.getSalesListings();
      return agreements
        .map(a => {
          const l = listings.find(x => x.id === a.listingId);
          const sellerId = a.رقم_البائع || l?.رقم_المالك;
          return { a, listing: l, sellerId };
        })
        .filter(x => String(x.a.رقم_المشتري) === String(id) || String(x.sellerId) === String(id));
    })();

  type PersonExtras = { رقم_هاتف_اضافي?: unknown; حقول_ديناميكية?: Record<string, unknown> };
  const pExtra = p as الأشخاص_tbl & PersonExtras;
  const extraPhone = safeString(pExtra.رقم_هاتف_اضافي);

  return (
    <div className="space-y-6">

      {/* Print Template */}
      <div className="hidden print:block">
        <PrintLetterhead className="mb-6" />
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold">نموذج ملف شخص</h1>
          <div className="text-sm text-slate-600">التاريخ: {new Date().toISOString().slice(0, 10)}</div>
        </div>

        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-right text-sm">
            <tbody className="divide-y divide-gray-200">
              <tr>
                <td className="p-3 bg-gray-50 font-bold w-48">الاسم</td>
                <td className="p-3">{safeString(p.الاسم) || '—'}</td>
              </tr>
              <tr>
                <td className="p-3 bg-gray-50 font-bold">الهاتف</td>
                <td className="p-3 dir-ltr">{safeString(p.رقم_الهاتف) || '—'}</td>
              </tr>
              {extraPhone ? (
                <tr>
                  <td className="p-3 bg-gray-50 font-bold">الهاتف (إضافي)</td>
                  <td className="p-3 dir-ltr">{extraPhone || '—'}</td>
                </tr>
              ) : null}
              <tr>
                <td className="p-3 bg-gray-50 font-bold">الرقم الوطني</td>
                <td className="p-3">{safeString(p.الرقم_الوطني) || '—'}</td>
              </tr>
              <tr>
                <td className="p-3 bg-gray-50 font-bold">العنوان</td>
                <td className="p-3">{safeString(p.العنوان) || '—'}</td>
              </tr>
              <tr>
                <td className="p-3 bg-gray-50 font-bold">الأدوار</td>
                <td className="p-3">{(roles || []).join(' • ') || '—'}</td>
              </tr>
              <tr>
                <td className="p-3 bg-gray-50 font-bold">التصنيف / التقييم</td>
                <td className="p-3">{safeString(p.تصنيف) || '—'} {typeof p.تقييم !== 'undefined' ? `• ${safeNum(p.تقييم)}/5` : ''}</td>
              </tr>
              {blacklistRecord ? (
                <tr>
                  <td className="p-3 bg-gray-50 font-bold">القائمة السوداء</td>
                  <td className="p-3">
                    محظور • السبب: {safeString(blacklistRecord.reason)} • التاريخ: {safeString(blacklistRecord.dateAdded).split('T')[0]}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-6 print:hidden">
      
      {/* Blacklist Warning Banner */}
      {blacklistRecord && (
          <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-2xl p-4 flex items-start gap-4 animate-pulse">
              <div className="p-2 bg-red-100 dark:bg-red-800 rounded-full text-red-600 dark:text-white">
                  <ShieldAlert size={24} />
              </div>
              <div className="flex-1">
                  <h3 className="text-lg font-bold text-red-700 dark:text-red-400">هذا الشخص مدرج في القائمة السوداء!</h3>
                  <p className="text-sm text-red-600 dark:text-red-300 mt-1">
                      <span className="font-bold">السبب:</span> {blacklistRecord.reason} <br/>
                      <span className="font-bold">تاريخ الإضافة:</span> {blacklistRecord.dateAdded.split('T')[0]} • <span className="font-bold">الدرجة:</span> {blacklistRecord.severity}
                  </p>
              </div>
              <button 
                onClick={handleRemoveFromBlacklist}
                className="bg-white dark:bg-slate-800 text-red-600 text-xs font-bold px-3 py-2 rounded-lg border border-red-200 hover:bg-red-50 transition"
              >
                  رفع الحظر
              </button>
          </div>
      )}

      {/* Header */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-gray-100 dark:border-slate-700 relative overflow-hidden">
        <div className={`absolute top-0 left-0 h-2 w-full ${blacklistRecord ? 'bg-red-600' : 'bg-gradient-to-r from-indigo-500 to-purple-600'}`}></div>
        <div className="flex flex-col md:flex-row justify-between gap-6 pt-2">
          <div className="flex gap-5 items-center">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center border-4 shadow-lg ${blacklistRecord ? 'bg-red-100 border-red-500 text-red-600' : 'bg-slate-100 dark:bg-slate-700 border-white dark:border-slate-600 text-slate-400 dark:text-slate-500'}`}>
              {blacklistRecord ? <Ban size={40} /> : <User size={40} />}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  {safeString(p.الاسم)}
                  {blacklistRecord && <span className="bg-red-600 text-white text-[10px] px-2 py-0.5 rounded-full">محظور</span>}
              </h1>
              <div className="flex gap-2 my-2 flex-wrap">
                {roles.map((r: string) => (
                  <span key={r} className="px-3 py-0.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-full text-xs font-bold border border-indigo-100 dark:border-indigo-800">
                    {r}
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-600 dark:text-slate-400 flex-wrap">
                <span className="flex items-center gap-1"><Activity size={14} /> {safeString(p.الرقم_الوطني)}</span>
                <span className="flex items-center gap-1"><MapPin size={14} /> {safeString(p.العنوان) || 'غير محدد'}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2 min-w-[160px]">
             <div className="bg-yellow-50 dark:bg-yellow-900/10 p-2 rounded-lg text-center border border-yellow-100 dark:border-yellow-800">
                <div className="flex justify-center text-yellow-400 mb-1">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={14} fill={i < safeNum(p.تقييم) ? "currentColor" : "none"} />
                  ))}
                </div>
                <span className="text-xs font-bold text-yellow-700 dark:text-yellow-400">{safeString(p.تصنيف)}</span>
             </div>

             <div className="flex gap-2">
                <RBACGuard requiredPermission="EDIT_PERSON">
                    <button
                      onClick={handleEdit}
                      className="flex-1 flex items-center justify-center gap-2 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition text-xs font-bold"
                    >
                      <Edit2 size={14} /> تعديل
                    </button>
                </RBACGuard>
                <RBACGuard requiredPermission="DELETE_PERSON">
                    <button
                      onClick={handleDelete}
                      className="flex-1 flex items-center justify-center gap-2 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition text-xs font-bold"
                    >
                      <Trash2 size={14} /> حذف
                    </button>
                </RBACGuard>
             </div>
             <button
                onClick={handlePrint}
                className="flex items-center justify-center gap-2 w-full py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg transition text-xs font-bold"
              >
                <Printer size={14} /> طباعة / PDF
              </button>
             <button
                onClick={() => void openWhatsAppForPhones('', [safeString(p.رقم_الهاتف), extraPhone], { defaultCountryCode: '962', delayMs: 10_000 })}
                className="flex items-center justify-center gap-2 w-full py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition text-xs font-bold shadow-md shadow-green-500/20"
              >
                <Phone size={14} /> واتساب
              </button>
          </div>
        </div>
      </div>

      {/* Attachments Section */}
      <AttachmentManager referenceType="Person" referenceId={id} />

      <DynamicFieldsDisplay formId="people" values={pExtra.حقول_ديناميكية} />


      {/* Financial Stats */}
      <div className="grid grid-cols-3 gap-4">
          <div className="bg-gray-50 dark:bg-slate-800 p-4 rounded-xl border border-gray-100 dark:border-slate-700 text-center">
            <p className="text-xs text-slate-500 mb-1">إجمالي الكمبيالات</p>
            <p className="text-xl font-bold text-slate-800 dark:text-white">{safeNum(stats.totalInstallments)}</p>
          </div>
          <div className="bg-red-50 dark:bg-red-900/10 p-4 rounded-xl border border-red-100 dark:border-red-900/30 text-center">
            <p className="text-xs text-red-500 mb-1">متأخرات</p>
            <p className="text-xl font-bold text-red-600">{safeNum(stats.lateInstallments)}</p>
          </div>
          <div className="bg-green-50 dark:bg-green-900/10 p-4 rounded-xl border border-green-100 dark:border-green-900/30 text-center">
            <p className="text-xs text-green-500 mb-1">نسبة الالتزام</p>
            <p className="text-xl font-bold text-green-600">{safeNum(stats.commitmentRatio)}%</p>
          </div>
      </div>

      {/* Lists */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 overflow-hidden">
         {roles.includes('مالك') && ownedProperties.length > 0 && (
            <div className="p-4 border-b border-gray-100 dark:border-slate-700">
               <h4 className="font-bold text-sm mb-3 flex items-center gap-2 text-slate-700 dark:text-slate-300">
                 <FileText size={16} className="text-indigo-500"/> العقارات المملوكة
               </h4>
               <div className="space-y-2">
                 {ownedProperties.map((prop) => (
                   (() => {
                     const propId = String(prop.رقم_العقار);
                     const propContracts = contractsByPropertyId.get(propId) || [];
                     const best = pickBestTenancyContract(propContracts);
                     const tenantName = best?.رقم_المستاجر ? (peopleById.get(String(best.رقم_المستاجر))?.الاسم || 'غير معروف') : '';
                     const shortContractId = best ? formatContractNumberShort(best.رقم_العقد) : '';
                     return (
                   <div key={prop.رقم_العقار} 
                        onClick={() => openPanel('PROPERTY_DETAILS', prop.رقم_العقار)}
                        className="flex justify-between items-center p-3 bg-gray-50 dark:bg-slate-900/50 rounded-lg hover:bg-indigo-50 dark:hover:bg-slate-700 cursor-pointer transition">
                      <div className="flex items-center gap-3">
                         <span className="font-mono bg-white dark:bg-slate-800 px-2 py-1 rounded border border-gray-200 dark:border-slate-600 text-xs font-bold">{prop.الكود_الداخلي}</span>
                         <div className="min-w-0">
                           <div className="text-sm min-w-0 whitespace-normal break-words">{prop.العنوان}</div>
                           {best ? (
                             <div className="text-[11px] mt-0.5 text-indigo-700 dark:text-indigo-200 flex flex-wrap items-center gap-2">
                               <span className="font-bold">مرتبط بعقد</span>
                               <span className="font-mono">#{shortContractId}</span>
                               {tenantName ? (<><span>•</span><span className="font-semibold">{tenantName}</span></>) : null}
                               <button
                                 onClick={(e) => {
                                   e.stopPropagation();
                                   openPanel('CONTRACT_DETAILS', best.رقم_العقد);
                                 }}
                                 className="text-[11px] font-bold text-indigo-600 hover:underline"
                               >
                                 فتح العقد
                               </button>
                             </div>
                           ) : (
                             <div className="text-[11px] mt-0.5 text-slate-500 dark:text-slate-400">غير مرتبط بعقد</div>
                           )}

                           {propContracts.length > 0 ? (
                             <div className="mt-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white/60 dark:bg-slate-900/30 p-2">
                               <div className="text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">كل العقود</div>
                               <div className="space-y-1">
                                 {propContracts.map((c) => {
                                   const cId = String(c.رقم_العقد || '');
                                   const tenant = c.رقم_المستاجر ? (peopleById.get(String(c.رقم_المستاجر))?.الاسم || 'غير معروف') : '';
                                   return (
                                     <div key={cId} className="flex items-start justify-between gap-2">
                                       <div className="min-w-0 text-[11px] text-slate-600 dark:text-slate-300 whitespace-normal break-words">
                                         <span className="font-bold">#{formatContractNumberShort(cId)}</span>
                                         <span className="text-slate-400"> • </span>
                                         <span className="font-semibold">{safeString(c.حالة_العقد)}</span>
                                         {tenant ? <><span className="text-slate-400"> • </span><span>{tenant}</span></> : null}
                                         {(c.تاريخ_البداية || c.تاريخ_النهاية) ? (
                                           <>
                                             <span className="text-slate-400"> • </span>
                                             <span>{safeString(c.تاريخ_البداية)} - {safeString(c.تاريخ_النهاية)}</span>
                                           </>
                                         ) : null}
                                       </div>
                                       <button
                                         onClick={(e) => {
                                           e.stopPropagation();
                                           openPanel('CONTRACT_DETAILS', c.رقم_العقد);
                                         }}
                                         className="text-[11px] font-bold text-indigo-600 hover:underline flex-shrink-0"
                                       >
                                         فتح
                                       </button>
                                     </div>
                                   );
                                 })}
                               </div>
                             </div>
                           ) : null}
                         </div>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded ${prop.IsRented ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>{prop.حالة_العقار}</span>
                   </div>
                     );
                   })()
                 ))}
               </div>
            </div>
         )}

         {(contractsAsTenant.length > 0 || contractsAsGuarantor.length > 0 || contractsAsOwner.length > 0) && (
            <div className="p-4">
               <h4 className="font-bold text-sm mb-3 flex items-center gap-2 text-slate-700 dark:text-slate-300">
                 <FileText size={16} className="text-purple-500"/> العقود المرتبطة
               </h4>

               {contractsAsTenant.length > 0 && (
                 <div className="mb-4">
                   <div className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">كمستأجر</div>
                   <div className="space-y-2">
                     {contractsAsTenant.map((c) => (
                       <div
                         key={c.رقم_العقد}
                         onClick={() => openPanel('CONTRACT_DETAILS', c.رقم_العقد)}
                         className="flex justify-between items-start gap-3 p-3 bg-gray-50 dark:bg-slate-900/50 rounded-lg hover:bg-purple-50 dark:hover:bg-slate-700 cursor-pointer transition"
                       >
                         <div className="min-w-0">
                           <div className="text-sm font-bold whitespace-normal break-words">عقد #{formatContractNumberShort(c.رقم_العقد)}</div>
                           <div className="text-xs text-slate-500 whitespace-normal break-words">
                             عقار: <span className="font-mono">{getPropCode(String(c.رقم_العقار))}</span>
                             {c.تاريخ_البداية || c.تاريخ_النهاية ? <> • {safeString(c.تاريخ_البداية)} - {safeString(c.تاريخ_النهاية)}</> : null}
                           </div>
                         </div>
                         <div className="text-right flex-shrink-0">
                           <div className="text-[10px] bg-white dark:bg-slate-800 border px-2 py-0.5 rounded">{safeString(c.حالة_العقد)}</div>
                         </div>
                       </div>
                     ))}
                   </div>
                 </div>
               )}

               {contractsAsGuarantor.length > 0 && (
                 <div className="mb-4">
                   <div className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">ككفيل</div>
                   <div className="space-y-2">
                     {contractsAsGuarantor.map((c) => {
                       const tenantName = isDesktopFast
                         ? (tenantNameByContractId.get(String(c.رقم_العقد)) || '')
                         : (c.رقم_المستاجر ? (peopleById.get(String(c.رقم_المستاجر))?.الاسم || 'غير معروف') : '');
                       return (
                         <div
                           key={c.رقم_العقد}
                           onClick={() => openPanel('CONTRACT_DETAILS', c.رقم_العقد)}
                           className="flex justify-between items-start gap-3 p-3 bg-gray-50 dark:bg-slate-900/50 rounded-lg hover:bg-purple-50 dark:hover:bg-slate-700 cursor-pointer transition"
                         >
                           <div className="min-w-0">
                             <div className="text-sm font-bold whitespace-normal break-words">عقد #{formatContractNumberShort(c.رقم_العقد)}</div>
                             <div className="text-xs text-slate-500 whitespace-normal break-words">
                               عقار: <span className="font-mono">{getPropCode(String(c.رقم_العقار))}</span>
                               {tenantName ? <> • المستأجر: <span className="font-semibold">{tenantName}</span></> : null}
                             </div>
                           </div>
                           <div className="text-right flex-shrink-0">
                             <div className="text-[10px] bg-white dark:bg-slate-800 border px-2 py-0.5 rounded">{safeString(c.حالة_العقد)}</div>
                           </div>
                         </div>
                       );
                     })}
                   </div>
                 </div>
               )}

               {contractsAsOwner.length > 0 && (
                 <div>
                   <div className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">عبر العقارات المملوكة</div>
                   <div className="space-y-2">
                     {contractsAsOwner.map((c) => {
                       const tenantName = isDesktopFast
                         ? (tenantNameByContractId.get(String(c.رقم_العقد)) || '')
                         : (c.رقم_المستاجر ? (peopleById.get(String(c.رقم_المستاجر))?.الاسم || 'غير معروف') : '');
                       const propAddress = isDesktopFast
                         ? (propertyAddressById.get(String(c.رقم_العقار)) || '')
                         : (propertiesById.get(String(c.رقم_العقار))?.العنوان || '');
                       return (
                         <div
                           key={c.رقم_العقد}
                           className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-100 dark:border-indigo-500/30"
                         >
                           <div className="flex justify-between items-start gap-3">
                             <div className="min-w-0">
                               <div className="text-sm font-bold text-indigo-800 dark:text-indigo-200 whitespace-normal break-words">
                                 عقد #{formatContractNumberShort(c.رقم_العقد)} • عقار <span className="font-mono">{getPropCode(String(c.رقم_العقار))}</span>
                               </div>
                               <div className="text-xs text-indigo-700 dark:text-indigo-300 mt-0.5 whitespace-normal break-words">
                                 {propAddress ? <span>{propAddress}</span> : null}
                                 {tenantName ? <> {propAddress ? '• ' : ''}المستأجر: <span className="font-semibold">{tenantName}</span></> : null}
                               </div>
                             </div>
                             <div className="flex gap-2 flex-shrink-0">
                               <button
                                 onClick={() => openPanel('CONTRACT_DETAILS', c.رقم_العقد)}
                                 className="text-xs font-bold text-indigo-700 hover:underline"
                               >
                                 فتح العقد
                               </button>
                               <button
                                 onClick={() => openPanel('PROPERTY_DETAILS', String(c.رقم_العقار))}
                                 className="text-xs font-bold text-indigo-700 hover:underline"
                               >
                                 فتح العقار
                               </button>
                             </div>
                           </div>
                           <div className="mt-1 text-[10px] text-indigo-700 dark:text-indigo-300">
                             الحالة: <span className="font-bold">{safeString(c.حالة_العقد)}</span>
                             {c.تاريخ_البداية || c.تاريخ_النهاية ? <> • {safeString(c.تاريخ_البداية)} - {safeString(c.تاريخ_النهاية)}</> : null}
                           </div>
                         </div>
                       );
                     })}
                   </div>
                 </div>
               )}
            </div>
         )}

         {ownershipHistory.length > 0 && (
            <div className="p-4 border-t border-gray-100 dark:border-slate-700">
               <h4 className="font-bold text-sm mb-3 flex items-center gap-2 text-slate-700 dark:text-slate-300">
                 <FileText size={16} className="text-emerald-600"/> سجل نقل الملكية
               </h4>
               <div className="space-y-2">
                 {ownershipHistory
                   .slice()
                   .sort((a, b) => String(b.تاريخ_نقل_الملكية || '').localeCompare(String(a.تاريخ_نقل_الملكية || '')))
                   .slice(0, 30)
                   .map((r) => {
                     const direction = r.رقم_المالك_القديم === id ? 'باع' : 'اشترى';
                     return (
                       <div
                         key={r.id}
                         className="p-3 bg-gray-50 dark:bg-slate-900/50 rounded-lg border border-gray-100 dark:border-slate-700"
                       >
                         <div className="flex justify-between items-center">
                           <div className="text-sm font-bold text-slate-700 dark:text-slate-200">
                             {direction} عقار {getPropCode(r.رقم_العقار)}
                           </div>
                           <button
                             onClick={() => openPanel('PROPERTY_DETAILS', r.رقم_العقار)}
                             className="text-xs font-bold text-indigo-600 hover:underline"
                           >
                             فتح العقار
                           </button>
                         </div>
                         <div className="text-xs text-slate-500 mt-1">
                           {r.تاريخ_نقل_الملكية} {r.رقم_المعاملة ? `• معاملة: ${r.رقم_المعاملة}` : ''}
                         </div>
                       </div>
                     );
                   })}
               </div>
            </div>
         )}

         {(salesListingsForPerson.length > 0 || salesAgreementsForPerson.length > 0) && (
          <div className="p-4 border-t border-gray-100 dark:border-slate-700">
             <h4 className="font-bold text-sm mb-3 flex items-center gap-2 text-slate-700 dark:text-slate-300">
             <Briefcase size={16} className="text-emerald-600"/> المبيعات
             </h4>

             {salesListingsForPerson.length > 0 && (
               <div className="mb-4">
                 <div className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">عروض البيع (كمالك)</div>
                 <div className="space-y-2">
                   {salesListingsForPerson
                     .slice()
                     .sort((a, b) => String(b.تاريخ_العرض || '').localeCompare(String(a.تاريخ_العرض || '')))
                     .slice(0, 10)
                     .map((l) => (
                       <div key={l.id} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-slate-900/50 rounded-lg border border-gray-100 dark:border-slate-700">
                         <div className="min-w-0">
                           <div className="text-sm font-bold text-slate-800 dark:text-white">{getPropCode(String(l.رقم_العقار))}</div>
                           <div className="text-[11px] text-slate-500 mt-0.5">
                             الحالة: <b>{l.الحالة}</b> • السعر: <b className="text-emerald-600">{Number(l.السعر_المطلوب || 0).toLocaleString()}</b>
                           </div>
                         </div>
                         <div className="flex gap-2">
                           <button
                             onClick={() => openPanel('PROPERTY_DETAILS', String(l.رقم_العقار))}
                             className="text-xs font-bold text-indigo-600 hover:underline"
                           >
                             ملف العقار
                           </button>
                           <button
                             onClick={() => openPanel('SALES_LISTING_DETAILS', String(l.id))}
                             className="text-xs font-bold text-indigo-600 hover:underline"
                           >
                             تفاصيل البيع
                           </button>
                         </div>
                       </div>
                     ))}
                 </div>
               </div>
             )}

             {salesAgreementsForPerson.length > 0 && (
               <div>
                 <div className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">اتفاقيات البيع</div>
                 <div className="space-y-2">
                   {salesAgreementsForPerson
                     .slice()
                     .sort((x, y) => String((y.a.transferDate || y.a.تاريخ_الاتفاقية || '')).localeCompare(String((x.a.transferDate || x.a.تاريخ_الاتفاقية || ''))))
                     .slice(0, 10)
                     .map(({ a, listing }) => (
                       <div key={a.id} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-slate-900/50 rounded-lg border border-gray-100 dark:border-slate-700">
                         <div className="min-w-0">
                           <div className="text-sm font-bold text-slate-800 dark:text-white">
                             {listing?.رقم_العقار ? getPropCode(String(listing.رقم_العقار)) : '—'}
                           </div>
                           <div className="text-[11px] text-slate-500 mt-0.5">
                             السعر النهائي: <b className="text-emerald-600">{Number(a.السعر_النهائي || 0).toLocaleString()}</b>
                             {' • '}
                             الحالة: <b>{a.isCompleted ? 'مكتملة' : 'قيد الإجراء'}</b>
                           </div>
                         </div>
                         <div className="flex gap-2">
                           {listing?.رقم_العقار ? (
                             <button
                               onClick={() => openPanel('PROPERTY_DETAILS', String(listing.رقم_العقار))}
                               className="text-xs font-bold text-indigo-600 hover:underline"
                             >
                               ملف العقار
                             </button>
                           ) : null}
                           <button
                             onClick={() => handleEditAgreementFromPerson(String(a.id))}
                             className="text-xs font-bold text-indigo-600 hover:underline"
                           >
                             فتح الاتفاقية
                           </button>
                         </div>
                       </div>
                     ))}
                 </div>
               </div>
             )}
          </div>
         )}
      </div>

      </div>
    </div>
  );
};
