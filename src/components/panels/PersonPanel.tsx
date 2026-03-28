import { useCallback, useEffect, useMemo, useState } from 'react';
import { DbService } from '@/services/mockDb';
import { openWhatsAppForPhones } from '@/utils/whatsapp';
import { getDefaultWhatsAppCountryCodeSync } from '@/services/geoSettings';
import {
  User,
  Activity,
  MapPin,
  Phone,
  Star,
  FileText,
  ShieldAlert,
  Ban,
  Edit2,
  Trash2,
  Printer,
  Briefcase,
  Home,
  ArrowRight,
  ArrowUpToLine,
  ArrowDownToLine,
  Calendar,
  History as HistoryIcon,
} from 'lucide-react';
import { useSmartModal } from '@/context/ModalContext';
import { ROUTE_PATHS } from '@/routes/paths';
import { AttachmentManager } from '@/components/AttachmentManager';
import { useToast } from '@/context/ToastContext';
import { RBACGuard } from '@/components/shared/RBACGuard';
import { DynamicFieldsDisplay } from '@/components/dynamic/DynamicFieldsDisplay';
import { PrintLetterhead } from '@/components/print/PrintLetterhead';
import { printCurrentViewUnified } from '@/services/printing/unifiedPrint';
import { isTenancyRelevant, pickBestTenancyContract } from '@/utils/tenancy';
import { formatContractNumberShort } from '@/utils/contractNumber';
import { storage } from '@/services/storage';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { safeNumber, safeString } from '@/utils/safe';
import {
  deletePersonSmart,
  ownershipHistorySmart,
  personDetailsSmart,
  personTenancyContractsSmart,
  removeFromBlacklistSmart,
  salesForPersonSmart,
} from '@/services/domainQueries';
import type {
  PersonDetailsResult,
  الأشخاص_tbl,
  العقارات_tbl,
  العقود_tbl,
  سجل_الملكية_tbl,
  عروض_البيع_tbl,
  اتفاقيات_البيع_tbl,
} from '@/types';

type FastTenancyItem = {
  contract: العقود_tbl;
  propertyCode?: string;
  propertyAddress?: string;
  tenantName?: string;
};

export const PersonPanel: React.FC<{ id: string; onClose?: () => void }> = ({ id, onClose }) => {
  const t = useCallback((s: string) => s, []);
  const [profileData, setProfileData] = useState<PersonDetailsResult | null>(null);
  const [fastTenancy, setFastTenancy] = useState<FastTenancyItem[]>([]);
  const [fastOwnershipHistory, setFastOwnershipHistory] = useState<سجل_الملكية_tbl[]>([]);
  const [fastSalesListings, setFastSalesListings] = useState<عروض_البيع_tbl[]>([]);
  const [fastSalesAgreements, setFastSalesAgreements] = useState<اتفاقيات_البيع_tbl[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { openPanel } = useSmartModal();
  const toast = useToast();

  const isDesktop = storage.isDesktop() && typeof window !== 'undefined' && !!window.desktopDb;
  const isDesktopFast =
    isDesktop &&
    !!window.desktopDb?.domainPersonDetails &&
    !!window.desktopDb?.domainPersonTenancyContracts &&
    !!window.desktopDb?.domainOwnershipHistory &&
    !!window.desktopDb?.domainSalesForPerson &&
    !!window.desktopDb?.domainPeopleDelete &&
    !!window.desktopDb?.domainBlacklistRemove;
  const desktopUnsupported = isDesktop && !isDesktopFast;

  const loadData = useCallback(() => {
    let alive = true;

    const run = async () => {
      if (desktopUnsupported) {
        if (!alive) return;
        setProfileData(null);
        setFastTenancy([]);
        setLoadError(t('هذه الشاشة تحتاج وضع السرعة/SQL في نسخة الديسكتوب'));
        return;
      }

      if (isDesktopFast) {
        try {
          const [details, tenancy, ownership, sales] = await Promise.all([
            personDetailsSmart(id),
            personTenancyContractsSmart(id),
            ownershipHistorySmart({ personId: id }),
            salesForPersonSmart(id),
          ]);

          if (!alive) return;

          setLoadError(null);
          if (details) setProfileData(details);
          else setProfileData(null);

          setFastTenancy(Array.isArray(tenancy) ? (tenancy as FastTenancyItem[]) : []);

          setFastOwnershipHistory(Array.isArray(ownership) ? (ownership as سجل_الملكية_tbl[]) : []);
          setFastSalesListings(
            sales && Array.isArray(sales.listings) ? (sales.listings as عروض_البيع_tbl[]) : []
          );
          setFastSalesAgreements(
            sales && Array.isArray(sales.agreements)
              ? (sales.agreements as اتفاقيات_البيع_tbl[])
              : []
          );
        } catch {
          if (!alive) return;
          setLoadError(t('تعذر تحميل بيانات الشخص في وضع السرعة'));
          setProfileData(null);
          setFastTenancy([]);
          setFastOwnershipHistory([]);
          setFastSalesListings([]);
          setFastSalesAgreements([]);
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
  }, [id, isDesktopFast, desktopUnsupported, t]);

  useEffect(() => {
    const cleanup = loadData();
    return () => {
      if (typeof cleanup === 'function') cleanup();
    };
  }, [loadData]);

  // Hooks MUST run on every render (prevents React error #310).
  // Use safe fallbacks so we can still render loading/unsupported states.
  const ownedProperties = useMemo(() => profileData?.ownedProperties ?? [], [profileData]);
  const propsIndex = useMemo<العقارات_tbl[]>(
    () => (!isDesktopFast && profileData ? (DbService.getProperties() as العقارات_tbl[]) : []),
    [isDesktopFast, profileData]
  );
  const peopleIndex = useMemo<الأشخاص_tbl[]>(
    () => (!isDesktopFast && profileData ? (DbService.getPeople() as الأشخاص_tbl[]) : []),
    [isDesktopFast, profileData]
  );
  const tenancyContractsRaw = useMemo<العقود_tbl[]>(() => {
    if (isDesktopFast) return (fastTenancy ?? []).map((x) => x.contract).filter(Boolean);
    if (profileData) return DbService.getContracts() as العقود_tbl[];
    return [];
  }, [isDesktopFast, fastTenancy, profileData]);
  const tenancyContracts = useMemo(
    () => (tenancyContractsRaw ?? []).filter(isTenancyRelevant),
    [tenancyContractsRaw]
  );

  const peopleById = useMemo(() => {
    const map = new Map<string, الأشخاص_tbl>();
    if (isDesktopFast) return map;
    for (const person of peopleIndex) map.set(String(person.رقم_الشخص), person);
    return map;
  }, [isDesktopFast, peopleIndex]);

  const propertiesById = useMemo(() => {
    const map = new Map<string, العقارات_tbl>();
    if (isDesktopFast) return map;
    for (const prop of propsIndex) map.set(String(prop.رقم_العقار), prop);
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
      const pid = String((prop as unknown as العقارات_tbl)?.رقم_العقار || '');
      const code = String((prop as unknown as العقارات_tbl)?.الكود_الداخلي || '').trim();
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
      const pid = String(prop?.رقم_العقار || '');
      const code = String(prop?.الكود_الداخلي || '').trim();
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

  const handleRemoveFromBlacklist = async () => {
    const ok = await toast.confirm({
      title: t('تأكيد رفع الحظر'),
      message: t('هل أنت متأكد من رفع الحظر عن هذا الشخص؟'),
      confirmText: t('نعم'),
      cancelText: t('إلغاء'),
    });
    if (!ok) return;
    const res = await removeFromBlacklistSmart(id);
    if (res.success) {
      toast.success(res.message);
      loadData();
    } else {
      toast.error(res.message);
    }
  };

  const handleEdit = () => {
    openPanel('PERSON_FORM', id, {
      onSuccess: () => setTimeout(loadData, 300),
    });
  };

  const handleDelete = async () => {
    const ok = await toast.confirm({
      title: t('تأكيد الحذف'),
      message: t('هل أنت متأكد من حذف هذا الملف؟'),
      confirmText: t('حذف'),
      cancelText: t('إلغاء'),
    });
    if (!ok) return;
    const res = await deletePersonSmart(id);
    if (res.success) {
      toast.success(res.message || t('تم الحذف'));
      if (onClose) onClose();
    } else {
      toast.error(res.message || t('فشل الحذف'));
    }
  };

  if (desktopUnsupported) {
    return (
      <div className="p-10 text-center text-slate-600 dark:text-slate-300">
        <div className="mx-auto mb-3 w-12 h-12 rounded-full bg-yellow-100 dark:bg-yellow-900/20 flex items-center justify-center">
          <ShieldAlert className="w-6 h-6 text-yellow-700 dark:text-yellow-300" />
        </div>
        <div className="font-bold">{t('غير مدعوم في وضع الديسكتوب الحالي')}</div>
        <div className="text-sm mt-2">
          {t('يرجى تحديث نسخة الديسكتوب أو تفعيل وضع السرعة/SQL.')}
        </div>
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
            <div className="font-bold">{t('تعذر تحميل البيانات')}</div>
            <div className="text-sm mt-2">{loadError}</div>
          </div>
        ) : (
          t('جاري التحميل...')
        )}
      </div>
    );
  }

  const { person: p, roles, stats, blacklistRecord } = profileData;
  const ownershipHistory: سجل_الملكية_tbl[] = isDesktopFast
    ? fastOwnershipHistory
    : DbService.getOwnershipHistory(undefined, id);

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
      arr.sort((a, b) =>
        String(b.تاريخ_البداية || '').localeCompare(String(a.تاريخ_البداية || ''))
      );
      map.set(k, arr);
    }
    return map;
  })();

  const ownedPropertyIds = new Set<string>(
    (ownedProperties || []).map((x) => String(x.رقم_العقار))
  );
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

  const handlePrint = () => {
    void printCurrentViewUnified({ documentType: 'person', entityId: id });
  };

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
    if (isDesktopFast) return fastSalesListings;
    const listings: عروض_البيع_tbl[] = DbService.getSalesListings();
    return listings.filter((l) => String(l.رقم_المالك) === String(id));
  })();

  const salesAgreementsForPerson: Array<{
    a: اتفاقيات_البيع_tbl;
    listing?: عروض_البيع_tbl;
    sellerId?: string;
  }> = (() => {
    const agreements: اتفاقيات_البيع_tbl[] = isDesktopFast
      ? fastSalesAgreements
      : DbService.getSalesAgreements();
    const listings: عروض_البيع_tbl[] = isDesktopFast
      ? fastSalesListings
      : DbService.getSalesListings();
    return agreements
      .map((a) => {
        const l = listings.find((x) => x.id === a.listingId);
        const sellerId = a.رقم_البائع || l?.رقم_المالك;
        return { a, listing: l, sellerId };
      })
      .filter((x) => String(x.a.رقم_المشتري) === String(id) || String(x.sellerId) === String(id));
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
          <h1 className="text-xl font-bold">{t('نموذج ملف شخص')}</h1>
          <div className="text-sm text-slate-600">
            {t('التاريخ:')} {new Date().toISOString().slice(0, 10)}
          </div>
        </div>

        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-right text-sm">
            <tbody className="divide-y divide-gray-200">
              <tr>
                <td className="p-3 bg-gray-50 font-bold w-48">{t('الاسم')}</td>
                <td className="p-3">{safeString(p.الاسم) || '—'}</td>
              </tr>
              <tr>
                <td className="p-3 bg-gray-50 font-bold">{t('الهاتف')}</td>
                <td className="p-3 dir-ltr">{safeString(p.رقم_الهاتف) || '—'}</td>
              </tr>
              {extraPhone ? (
                <tr>
                  <td className="p-3 bg-gray-50 font-bold">{t('الهاتف (إضافي)')}</td>
                  <td className="p-3 dir-ltr">{extraPhone || '—'}</td>
                </tr>
              ) : null}
              <tr>
                <td className="p-3 bg-gray-50 font-bold">{t('الرقم الوطني')}</td>
                <td className="p-3">{safeString(p.الرقم_الوطني) || '—'}</td>
              </tr>
              <tr>
                <td className="p-3 bg-gray-50 font-bold">{t('العنوان')}</td>
                <td className="p-3">{safeString(p.العنوان) || '—'}</td>
              </tr>
              <tr>
                <td className="p-3 bg-gray-50 font-bold">{t('الأدوار')}</td>
                <td className="p-3">{(roles || []).join(' • ') || '—'}</td>
              </tr>
              <tr>
                <td className="p-3 bg-gray-50 font-bold">{t('التصنيف / التقييم')}</td>
                <td className="p-3">
                  {safeString(p.تصنيف) || '—'}{' '}
                  {typeof p.تقييم !== 'undefined' ? `• ${safeNumber(p.تقييم)}/5` : ''}
                </td>
              </tr>
              {blacklistRecord ? (
                <tr>
                  <td className="p-3 bg-gray-50 font-bold">{t('القائمة السوداء')}</td>
                  <td className="p-3">
                    {t('محظور')} • {t('السبب:')} {safeString(blacklistRecord.reason)} •{' '}
                    {t('التاريخ:')} {safeString(blacklistRecord.dateAdded).split('T')[0]}
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
              <h3 className="text-lg font-bold text-red-700 dark:text-red-400">
                {t('هذا الشخص مدرج في القائمة السوداء!')}
              </h3>
              <p className="text-sm text-red-600 dark:text-red-300 mt-1">
                <span className="font-bold">{t('السبب:')}</span> {blacklistRecord.reason} <br />
                <span className="font-bold">{t('تاريخ الإضافة:')}</span>{' '}
                {blacklistRecord.dateAdded.split('T')[0]} •{' '}
                <span className="font-bold">{t('الدرجة:')}</span> {blacklistRecord.severity}
              </p>
            </div>
            <button
              onClick={handleRemoveFromBlacklist}
              className="bg-white dark:bg-slate-800 text-red-600 text-xs font-bold px-3 py-2 rounded-lg border border-red-200 hover:bg-red-50 transition"
            >
              {t('رفع الحظر')}
            </button>
          </div>
        )}

        {/* Header */}
        <div className="app-card relative overflow-hidden group">
          <div
            className={`absolute inset-0 opacity-10 transition-opacity duration-700 group-hover:opacity-20 ${blacklistRecord ? 'bg-rose-600' : 'bg-gradient-to-br from-indigo-600 to-purple-600'}`}
          />
          <div
            className={`absolute top-0 right-0 left-0 h-1.5 transition-all duration-500 ${blacklistRecord ? 'bg-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.4)]' : 'bg-gradient-to-l from-indigo-500 to-purple-500 shadow-[0_0_15px_rgba(99,102,241,0.3)]'}`}
          />

          <div className="relative p-8 flex flex-col md:flex-row justify-between gap-10">
            <div className="flex flex-col md:flex-row gap-8 items-center md:items-start text-center md:text-right">
              <div className="relative">
                <div
                  className={`w-28 h-28 rounded-[2.5rem] flex items-center justify-center border-4 shadow-2xl transition-transform duration-500 hover:scale-110 ${blacklistRecord ? 'bg-rose-50 dark:bg-rose-900/20 border-rose-100 dark:border-rose-800 text-rose-600 dark:text-rose-400' : 'bg-white dark:bg-slate-800 border-white dark:border-slate-700 text-slate-400 dark:text-slate-500'}`}
                >
                  {blacklistRecord ? <Ban size={48} /> : <User size={48} />}
                </div>
                {blacklistRecord && (
                  <div className="absolute -bottom-2 -right-2 p-2 bg-rose-600 text-white rounded-xl shadow-lg animate-bounce">
                    <ShieldAlert size={16} />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0 space-y-4">
                <div className="flex flex-col gap-2">
                  <h1 className="text-3xl font-black text-slate-800 dark:text-white leading-tight tracking-tight">
                    {safeString(p.الاسم)}
                  </h1>
                  <div className="flex flex-wrap justify-center md:justify-start gap-2">
                    {roles.map((r: string) => (
                      <span
                        key={r}
                        className="px-3.5 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-xl text-[10px] font-black border border-indigo-100 dark:border-indigo-800/50 uppercase tracking-widest shadow-sm"
                      >
                        {r}
                      </span>
                    ))}
                    {blacklistRecord && (
                      <span className="px-3.5 py-1.5 bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-xl text-[10px] font-black border border-rose-100 dark:border-rose-800/50 uppercase tracking-widest shadow-sm">
                        {t('محظور')}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap justify-center md:justify-start items-center gap-6 text-xs font-bold text-slate-500 dark:text-slate-400">
                  <span className="flex items-center gap-2 group/info">
                    <div className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg group-hover/info:text-indigo-500 transition-colors">
                      <Activity size={14} />
                    </div>
                    {safeString(p.الرقم_الوطني)}
                  </span>
                  <span className="flex items-center gap-2 group/info">
                    <div className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg group-hover/info:text-indigo-500 transition-colors">
                      <MapPin size={14} />
                    </div>
                    {safeString(p.العنوان) || t('غير محدد')}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 min-w-[200px] w-full md:w-auto">
              <div className="bg-white/80 dark:bg-slate-800/60 backdrop-blur-md p-4 rounded-[1.8rem] border border-slate-100 dark:border-slate-700 shadow-sm text-center">
                <div className="flex justify-center gap-1.5 text-amber-400 mb-2">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      size={16}
                      fill={i < safeNumber(p.تقييم) ? 'currentColor' : 'none'}
                      className="transition-transform hover:scale-125"
                    />
                  ))}
                </div>
                <div className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest">
                  {safeString(p.تصنيف)}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <RBACGuard requiredPermission="EDIT_PERSON">
                  <button
                    onClick={handleEdit}
                    className="flex items-center justify-center gap-2 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-2xl transition-all text-[11px] font-black shadow-sm hover:bg-indigo-50 dark:hover:bg-indigo-900/20 active:scale-95"
                  >
                    <Edit2 size={14} /> {t('تعديل')}
                  </button>
                </RBACGuard>
                <RBACGuard requiredPermission="DELETE_PERSON">
                  <button
                    onClick={handleDelete}
                    className="flex items-center justify-center gap-2 py-3 bg-white dark:bg-slate-800 border border-rose-100 dark:border-rose-900/30 text-rose-600 dark:text-rose-400 rounded-2xl transition-all text-[11px] font-black shadow-sm hover:bg-rose-50 dark:hover:bg-rose-900/20 active:scale-95"
                  >
                    <Trash2 size={14} /> {t('حذف')}
                  </button>
                </RBACGuard>
              </div>

              <div className="grid grid-cols-1 gap-2">
                <RBACGuard requiredPermission="PRINT_EXECUTE">
                  <button
                    onClick={handlePrint}
                    className="flex items-center justify-center gap-2 w-full py-3 bg-slate-900 text-white rounded-2xl transition-all text-[11px] font-black shadow-lg shadow-black/20 hover:bg-black active:scale-95"
                  >
                    <Printer size={14} /> {t('طباعة / PDF')}
                  </button>
                </RBACGuard>
                <button
                  onClick={() =>
                    void openWhatsAppForPhones('', [safeString(p.رقم_الهاتف), extraPhone], {
                      defaultCountryCode: getDefaultWhatsAppCountryCodeSync(),
                      delayMs: 10_000,
                    })
                  }
                  className="flex items-center justify-center gap-2 w-full py-3 bg-emerald-600 text-white rounded-2xl transition-all text-[11px] font-black shadow-lg shadow-emerald-500/20 hover:bg-emerald-700 active:scale-95"
                >
                  <Phone size={14} /> {t('واتساب')}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Attachments Section */}
        <AttachmentManager referenceType="Person" referenceId={id} />

        <DynamicFieldsDisplay formId="people" values={pExtra.حقول_ديناميكية} />

        {/* Financial Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="app-card p-8 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/50 shadow-xl shadow-slate-200/10 dark:shadow-black/20 flex flex-col items-center text-center group hover:scale-[1.02] transition-transform">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-4 group-hover:rotate-12 transition-transform">
              <FileText size={28} />
            </div>
            <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">
              {t('إجمالي الكمبيالات')}
            </div>
            <div className="text-3xl font-black text-slate-800 dark:text-white tracking-tighter">
              {safeNumber(stats.totalInstallments).toLocaleString()}
            </div>
          </div>

          <div className="app-card p-8 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/50 shadow-xl shadow-slate-200/10 dark:shadow-black/20 flex flex-col items-center text-center group hover:scale-[1.02] transition-transform">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-900/20 flex items-center justify-center text-rose-600 dark:text-rose-400 mb-4 group-hover:-rotate-12 transition-transform">
              <ShieldAlert size={28} />
            </div>
            <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">
              {t('متأخرات')}
            </div>
            <div className="text-3xl font-black text-rose-600 tracking-tighter">
              {safeNumber(stats.lateInstallments).toLocaleString()}
            </div>
          </div>

          <div className="app-card p-8 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/50 shadow-xl shadow-slate-200/10 dark:shadow-black/20 flex flex-col items-center text-center group hover:scale-[1.02] transition-transform">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-4 group-hover:scale-110 transition-transform">
              <Activity size={28} />
            </div>
            <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">
              {t('نسبة الالتزام')}
            </div>
            <div className="text-3xl font-black text-emerald-600 tracking-tighter">
              {safeNumber(stats.commitmentRatio)}%
            </div>
          </div>
        </div>

        {/* Lists Container */}
        <div className="space-y-8">
          {roles.includes('مالك') && ownedProperties.length > 0 && (
            <div className="app-card overflow-hidden border border-slate-200/60 dark:border-slate-800/50 shadow-xl shadow-slate-200/10 dark:shadow-black/20">
              <div className="p-6 border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-800/30 flex items-center gap-3">
                <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl text-indigo-600 dark:text-indigo-400">
                  <Home size={20} />
                </div>
                <h4 className="text-lg font-black text-slate-800 dark:text-white leading-tight">
                  {t('العقارات المملوكة')}
                </h4>
              </div>
              <div className="divide-y divide-slate-100/50 dark:divide-slate-800/50">
                {ownedProperties.map((prop) =>
                  (() => {
                    const propId = String(prop.رقم_العقار);
                    const propContracts = contractsByPropertyId.get(propId) || [];
                    const best = pickBestTenancyContract(propContracts);
                    const tenantName = best?.رقم_المستاجر
                      ? peopleById.get(String(best.رقم_المستاجر))?.الاسم || t('غير معروف')
                      : '';
                    const shortContractId = best ? formatContractNumberShort(best.رقم_العقد) : '';
                    return (
                      <div
                        key={prop.رقم_العقار}
                        onClick={() => openPanel('PROPERTY_DETAILS', prop.رقم_العقار)}
                        className="p-6 bg-white dark:bg-slate-900 hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 transition-all cursor-pointer group flex flex-col md:flex-row md:items-center justify-between gap-6"
                      >
                        <div className="flex items-start gap-5">
                          <div className="mt-1 font-mono bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-black text-slate-700 dark:text-slate-200 shadow-sm group-hover:border-indigo-200 transition-colors">
                            {prop.الكود_الداخلي}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-base font-bold text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 transition-colors">
                              {prop.العنوان}
                            </div>

                            {best ? (
                              <div className="mt-2 flex flex-wrap items-center gap-3">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-[10px] font-black rounded-lg border border-indigo-100 dark:border-indigo-800/50">
                                  <FileText size={12} />
                                  {t('عقد')} #{shortContractId}
                                </span>
                                {tenantName && (
                                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                                    {t('المستأجر:')}{' '}
                                    <span className="text-slate-800 dark:text-slate-200">
                                      {tenantName}
                                    </span>
                                  </span>
                                )}
                              </div>
                            ) : (
                              <div className="mt-2 text-[11px] font-black text-slate-400 uppercase tracking-widest">
                                {t('شاغر حالياً')}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <span
                            className={`px-4 py-1.5 rounded-2xl text-[10px] font-black border uppercase tracking-widest ${prop.IsRented ? 'bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-900/20 dark:border-rose-900/40' : 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/20 dark:border-emerald-900/40'}`}
                          >
                            {prop.حالة_العقار}
                          </span>
                          <ArrowRight
                            size={18}
                            className="text-slate-300 group-hover:translate-x-[-4px] transition-transform"
                          />
                        </div>
                      </div>
                    );
                  })()
                )}
              </div>
            </div>
          )}

          {(contractsAsTenant.length > 0 ||
            contractsAsGuarantor.length > 0 ||
            contractsAsOwner.length > 0) && (
            <div className="app-card overflow-hidden border border-slate-200/60 dark:border-slate-800/50 shadow-xl shadow-slate-200/10 dark:shadow-black/20">
              <div className="p-6 border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-800/30 flex items-center gap-3">
                <div className="p-2 bg-purple-50 dark:bg-purple-900/30 rounded-xl text-purple-600 dark:text-purple-400">
                  <FileText size={20} />
                </div>
                <h4 className="text-lg font-black text-slate-800 dark:text-white leading-tight">
                  {t('العقود المرتبطة')}
                </h4>
              </div>

              <div className="p-6 space-y-8">
                {contractsAsTenant.length > 0 && (
                  <div>
                    <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                      {t('كمستأجر')}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {contractsAsTenant.map((c) => (
                        <div
                          key={c.رقم_العقد}
                          onClick={() => openPanel('CONTRACT_DETAILS', c.رقم_العقد)}
                          className="group p-5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[1.5rem] hover:border-purple-200 dark:hover:border-purple-800 transition-all cursor-pointer shadow-sm hover:shadow-md"
                        >
                          <div className="flex justify-between items-start gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-black text-slate-800 dark:text-white group-hover:text-purple-600 transition-colors">
                                {t('عقد')} #{formatContractNumberShort(c.رقم_العقد)}
                              </div>
                              <div className="mt-1 text-[11px] font-bold text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-2">
                                <span className="font-mono bg-slate-50 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                                  {getPropCode(String(c.رقم_العقار))}
                                </span>
                                {c.تاريخ_البداية && <span>• {safeString(c.تاريخ_البداية)}</span>}
                              </div>
                            </div>
                            <StatusBadge
                              status={safeString(c.حالة_العقد)}
                              className="!text-[9px] !px-2 !py-0.5 !rounded-lg"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {contractsAsGuarantor.length > 0 && (
                  <div>
                    <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      {t('ككفيل')}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {contractsAsGuarantor.map((c) => {
                        const tenantName = isDesktopFast
                          ? tenantNameByContractId.get(String(c.رقم_العقد)) || ''
                          : c.رقم_المستاجر
                            ? peopleById.get(String(c.رقم_المستاجر))?.الاسم || t('غير معروف')
                            : '';
                        return (
                          <div
                            key={c.رقم_العقد}
                            onClick={() => openPanel('CONTRACT_DETAILS', c.رقم_العقد)}
                            className="group p-5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[1.5rem] hover:border-amber-200 dark:hover:border-amber-800 transition-all cursor-pointer shadow-sm hover:shadow-md"
                          >
                            <div className="flex justify-between items-start gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-black text-slate-800 dark:text-white group-hover:text-amber-600 transition-colors">
                                  {t('عقد')} #{formatContractNumberShort(c.رقم_العقد)}
                                </div>
                                <div className="mt-1 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                                  {t('عقار:')}{' '}
                                  <span className="font-mono">
                                    {getPropCode(String(c.رقم_العقار))}
                                  </span>
                                  {tenantName && (
                                    <span className="block mt-1 font-semibold text-slate-700 dark:text-slate-300">
                                      {t('المستأجر:')} {tenantName}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <StatusBadge
                                status={safeString(c.حالة_العقد)}
                                className="!text-[9px] !px-2 !py-0.5 !rounded-lg"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {contractsAsOwner.length > 0 && (
                  <div>
                    <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                      {t('عبر العقارات المملوكة')}
                    </div>
                    <div className="space-y-4">
                      {contractsAsOwner.map((c) => {
                        const tenantName = isDesktopFast
                          ? tenantNameByContractId.get(String(c.رقم_العقد)) || ''
                          : c.رقم_المستاجر
                            ? peopleById.get(String(c.رقم_المستاجر))?.الاسم || t('غير معروف')
                            : '';
                        const propAddress = isDesktopFast
                          ? propertyAddressById.get(String(c.رقم_العقار)) || ''
                          : propertiesById.get(String(c.رقم_العقار))?.العنوان || '';
                        return (
                          <div
                            key={c.رقم_العقد}
                            className="p-6 bg-indigo-50/30 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800/50 rounded-[2rem] transition-all hover:shadow-lg"
                          >
                            <div className="flex flex-col md:flex-row justify-between items-start gap-6">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-3 flex-wrap">
                                  <span className="text-base font-black text-indigo-800 dark:text-indigo-200">
                                    {t('عقد')} #{formatContractNumberShort(c.رقم_العقد)}
                                  </span>
                                  <span className="font-mono bg-white dark:bg-slate-800 px-2 py-0.5 rounded-lg border border-indigo-200 dark:border-indigo-800 text-[10px] font-black text-indigo-600 dark:text-indigo-400 shadow-sm">
                                    {getPropCode(String(c.رقم_العقار))}
                                  </span>
                                  <StatusBadge
                                    status={safeString(c.حالة_العقد)}
                                    className="!text-[9px] !px-2 !py-0.5 !rounded-lg"
                                  />
                                </div>
                                <div className="mt-2 text-xs font-bold text-slate-600 dark:text-slate-300">
                                  {propAddress && (
                                    <div className="flex items-center gap-1.5 mb-1">
                                      <MapPin size={12} className="text-indigo-400" /> {propAddress}
                                    </div>
                                  )}
                                  {tenantName && (
                                    <div className="flex items-center gap-1.5">
                                      <User size={12} className="text-indigo-400" />{' '}
                                      {t('المستأجر:')} {tenantName}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="flex gap-2 w-full md:w-auto">
                                <button
                                  onClick={() => openPanel('CONTRACT_DETAILS', c.رقم_العقد)}
                                  className="flex-1 md:w-28 py-2.5 bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 rounded-xl text-[10px] font-black hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all shadow-sm active:scale-95"
                                >
                                  {t('فتح العقد')}
                                </button>
                                <button
                                  onClick={() =>
                                    openPanel('PROPERTY_DETAILS', String(c.رقم_العقار))
                                  }
                                  className="flex-1 md:w-28 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-[10px] font-black hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm active:scale-95"
                                >
                                  {t('فتح العقار')}
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {ownershipHistory.length > 0 && (
            <div className="app-card overflow-hidden border border-slate-200/60 dark:border-slate-800/50 shadow-xl shadow-slate-200/10 dark:shadow-black/20">
              <div className="p-6 border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-800/30 flex items-center gap-3">
                <div className="p-2 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl text-emerald-600 dark:text-emerald-400">
                  <HistoryIcon size={20} />
                </div>
                <h4 className="text-lg font-black text-slate-800 dark:text-white leading-tight">
                  {t('سجل نقل الملكية')}
                </h4>
              </div>
              <div className="divide-y divide-slate-100/50 dark:divide-slate-800/50">
                {ownershipHistory
                  .slice()
                  .sort((a, b) =>
                    String(b.تاريخ_نقل_الملكية || '').localeCompare(
                      String(a.تاريخ_نقل_الملكية || '')
                    )
                  )
                  .slice(0, 30)
                  .map((r) => {
                    const directionKey = r.رقم_المالك_القديم === id ? 'باع' : 'اشترى';
                    return (
                      <div
                        key={r.id}
                        className="p-6 bg-white dark:bg-slate-900 hover:bg-emerald-50/30 dark:hover:bg-emerald-900/10 transition-all group flex flex-col md:flex-row md:items-center justify-between gap-4"
                      >
                        <div className="flex items-center gap-5">
                          <div
                            className={`p-3 rounded-2xl ${directionKey === 'باع' ? 'bg-rose-50 dark:bg-rose-900/20 text-rose-600' : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600'}`}
                          >
                            {directionKey === 'باع' ? (
                              <ArrowUpToLine size={20} />
                            ) : (
                              <ArrowDownToLine size={20} />
                            )}
                          </div>
                          <div>
                            <div className="text-base font-black text-slate-800 dark:text-slate-200">
                              {t(directionKey)} {t('عقار')}{' '}
                              <span className="font-mono text-indigo-600 dark:text-indigo-400">
                                {getPropCode(r.رقم_العقار)}
                              </span>
                            </div>
                            <div className="mt-1 text-xs font-bold text-slate-500 flex items-center gap-3">
                              <span className="flex items-center gap-1.5">
                                <Calendar size={12} /> {r.تاريخ_نقل_الملكية}
                              </span>
                              {r.رقم_المعاملة && (
                                <span className="flex items-center gap-1.5">
                                  <FileText size={12} /> {t('معاملة:')} {r.رقم_المعاملة}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => openPanel('PROPERTY_DETAILS', r.رقم_العقار)}
                          className="px-6 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-[10px] font-black text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:text-indigo-600 transition-all active:scale-95"
                        >
                          {t('فتح العقار')}
                        </button>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {(salesListingsForPerson.length > 0 || salesAgreementsForPerson.length > 0) && (
            <div className="p-4 border-t border-gray-100 dark:border-slate-700">
              <h4 className="font-bold text-sm mb-3 flex items-center gap-2 text-slate-700 dark:text-slate-300">
                <Briefcase size={16} className="text-emerald-600" /> {t('المبيعات')}
              </h4>

              {salesListingsForPerson.length > 0 && (
                <div className="mb-4">
                  <div className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">
                    {t('عروض البيع (كمالك)')}
                  </div>
                  <div className="space-y-2">
                    {salesListingsForPerson
                      .slice()
                      .sort((a, b) =>
                        String(b.تاريخ_العرض || '').localeCompare(String(a.تاريخ_العرض || ''))
                      )
                      .slice(0, 10)
                      .map((l) => (
                        <div
                          key={l.id}
                          className="flex justify-between items-center p-3 bg-gray-50 dark:bg-slate-900/50 rounded-lg border border-gray-100 dark:border-slate-700"
                        >
                          <div className="min-w-0">
                            <div className="text-sm font-bold text-slate-800 dark:text-white">
                              {getPropCode(String(l.رقم_العقار))}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              {t('الحالة:')} <b>{l.الحالة}</b> • {t('السعر:')}{' '}
                              <b className="text-emerald-600">
                                {Number(l.السعر_المطلوب || 0).toLocaleString()}
                              </b>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => openPanel('PROPERTY_DETAILS', String(l.رقم_العقار))}
                              className="text-xs font-bold text-indigo-600 hover:underline"
                            >
                              {t('ملف العقار')}
                            </button>
                            <button
                              onClick={() => openPanel('SALES_LISTING_DETAILS', String(l.id))}
                              className="text-xs font-bold text-indigo-600 hover:underline"
                            >
                              {t('تفاصيل البيع')}
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {salesAgreementsForPerson.length > 0 && (
                <div>
                  <div className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">
                    {t('اتفاقيات البيع')}
                  </div>
                  <div className="space-y-2">
                    {salesAgreementsForPerson
                      .slice()
                      .sort((x, y) =>
                        String(y.a.transferDate || y.a.تاريخ_الاتفاقية || '').localeCompare(
                          String(x.a.transferDate || x.a.تاريخ_الاتفاقية || '')
                        )
                      )
                      .slice(0, 10)
                      .map(({ a, listing }) => (
                        <div
                          key={a.id}
                          className="flex justify-between items-center p-3 bg-gray-50 dark:bg-slate-900/50 rounded-lg border border-gray-100 dark:border-slate-700"
                        >
                          <div className="min-w-0">
                            <div className="text-sm font-bold text-slate-800 dark:text-white">
                              {listing?.رقم_العقار ? getPropCode(String(listing.رقم_العقار)) : '—'}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              {t('السعر النهائي:')}{' '}
                              <b className="text-emerald-600">
                                {Number(a.السعر_النهائي || 0).toLocaleString()}
                              </b>
                              {' • '}
                              {t('الحالة:')} <b>{a.isCompleted ? t('مكتملة') : t('قيد الإجراء')}</b>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            {listing?.رقم_العقار ? (
                              <button
                                onClick={() =>
                                  openPanel('PROPERTY_DETAILS', String(listing.رقم_العقار))
                                }
                                className="text-xs font-bold text-indigo-600 hover:underline"
                              >
                                {t('ملف العقار')}
                              </button>
                            ) : null}
                            <button
                              onClick={() => handleEditAgreementFromPerson(String(a.id))}
                              className="text-xs font-bold text-indigo-600 hover:underline"
                            >
                              {t('فتح الاتفاقية')}
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
