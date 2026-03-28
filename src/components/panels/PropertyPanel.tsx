import { useCallback, useEffect, useMemo, useState } from 'react';
import { DbService } from '@/services/mockDb';
import { formatContractNumberShort } from '@/utils/contractNumber';
import {
  Home,
  MapPin,
  User,
  Zap,
  Droplets,
  FileText,
  ArrowRight,
  History,
  Edit2,
  Trash2,
  Printer,
  Briefcase,
  ClipboardCheck,
  ListTodo,
} from 'lucide-react';
import { useSmartModal } from '@/context/ModalContext';
import { AttachmentManager } from '@/components/AttachmentManager';
import { ActivityTimeline } from '@/components/ActivityTimeline';
import { NotesSection } from '@/components/shared/NotesSection';
import { DynamicSelect } from '@/components/ui/DynamicSelect';
import { useToast } from '@/context/ToastContext';
import { RBACGuard } from '@/components/shared/RBACGuard';
import { DynamicFieldsDisplay } from '@/components/dynamic/DynamicFieldsDisplay';
import { PrintLetterhead } from '@/components/print/PrintLetterhead';
import { printCurrentViewUnified } from '@/services/printing/unifiedPrint';
import { isTenancyRelevant } from '@/utils/tenancy';
import { useAppDialogs } from '@/hooks/useAppDialogs';
import type {
  FollowUpTask,
  PropertyDetailsResult,
  PropertyInspection,
  سجل_الملكية_tbl,
  اتفاقيات_البيع_tbl,
  عروض_البيع_tbl,
  الأشخاص_tbl,
  العقود_tbl,
} from '@/types';
import { storage } from '@/services/storage';
import {
  addFollowUpSmart,
  deleteInspectionSmart,
  deleteSalesAgreementSmart,
  domainGetSmart,
  ownershipHistorySmart,
  propertyContractsSmart,
  propertyInspectionsSmart,
  salesForPropertySmart,
  updatePropertySmart,
} from '@/services/domainQueries';
import { pickBestTenancyContract } from '@/utils/tenancy';
import { ROUTE_PATHS } from '@/routes/paths';

export const PropertyPanel: React.FC<{ id: string; onClose?: () => void }> = ({ id, onClose }) => {
  const [data, setData] = useState<PropertyDetailsResult | null>(null);
  const [contractsMeta, setContractsMeta] = useState<{
    byContractId: Map<string, { tenantName?: string; guarantorName?: string }>;
  }>({ byContractId: new Map() });
  const [inspectionPeople, setInspectionPeople] = useState<{
    inspector?: الأشخاص_tbl | null;
    client?: الأشخاص_tbl | null;
  }>({});
  const [fastInspections, setFastInspections] = useState<PropertyInspection[]>([]);
  const [fastOwnershipHistory, setFastOwnershipHistory] = useState<سجل_الملكية_tbl[]>([]);
  const [fastSalesListings, setFastSalesListings] = useState<عروض_البيع_tbl[]>([]);
  type SaleAgreementItem = {
    a: اتفاقيات_البيع_tbl;
    propId?: string;
    sellerId?: string;
    listing?: عروض_البيع_tbl;
  };
  const [fastSaleAgreements, setFastSaleAgreements] = useState<SaleAgreementItem[]>([]);
  const [activeTab, setActiveTab] = useState<'info' | 'activity'>('info');
  const { openPanel } = useSmartModal();
  const toast = useToast();
  const dialogs = useAppDialogs();

  const isDefined = <T,>(v: T | null | undefined): v is T => v !== null && v !== undefined;

  const todayYMD = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const isDesktop = useMemo(() => {
    try {
      return !!storage.isDesktop() && typeof window !== 'undefined' && !!window.desktopDb;
    } catch {
      return false;
    }
  }, []);

  const isDesktopFast = useMemo(() => {
    try {
      return (
        !!storage.isDesktop() &&
        typeof window !== 'undefined' &&
        !!window.desktopDb?.domainGet &&
        !!window.desktopDb?.domainPropertyContracts &&
        !!window.desktopDb?.domainPropertyInspections &&
        !!window.desktopDb?.domainOwnershipHistory &&
        !!window.desktopDb?.domainSalesForProperty &&
        !!window.desktopDb?.domainPropertyUpdate &&
        !!window.desktopDb?.domainInspectionDelete &&
        !!window.desktopDb?.domainFollowUpAdd &&
        !!window.desktopDb?.domainSalesAgreementDelete
      );
    } catch {
      return false;
    }
  }, []);

  const desktopUnsupported = isDesktop && !isDesktopFast;

  const reload = useCallback(async () => {
    if (desktopUnsupported) {
      setData(null);
      setFastInspections([]);
      setFastOwnershipHistory([]);
      setFastSalesListings([]);
      setFastSaleAgreements([]);
      return;
    }

    if (!isDesktopFast) {
      const d = DbService.getPropertyDetails(id);
      if (d) setData(d);
      setFastInspections([]);
      setFastOwnershipHistory([]);
      setFastSalesListings([]);
      setFastSaleAgreements([]);
      return;
    }

    try {
      const prop = await domainGetSmart('properties', id);
      if (!prop) {
        setData(null);
        return;
      }

      const contractItems = (await propertyContractsSmart(id)) ?? [];
      const contracts = contractItems.map((x) => x.contract).filter(Boolean);

      const byContractId = new Map<string, { tenantName?: string; guarantorName?: string }>();
      for (const it of contractItems) {
        const cid = String(it.contract?.رقم_العقد || '').trim();
        if (!cid) continue;
        byContractId.set(cid, { tenantName: it.tenantName, guarantorName: it.guarantorName });
      }
      setContractsMeta({ byContractId });

      const activeContract = pickBestTenancyContract(contracts);
      const ownerId = String(prop?.رقم_المالك || '').trim();
      const tenantId = activeContract?.رقم_المستاجر
        ? String(activeContract.رقم_المستاجر || '').trim()
        : '';
      const guarantorId = activeContract?.رقم_الكفيل
        ? String(activeContract.رقم_الكفيل || '').trim()
        : '';

      const [owner, currentTenant, currentGuarantor] = await Promise.all([
        ownerId ? domainGetSmart('people', ownerId) : Promise.resolve(null),
        tenantId ? domainGetSmart('people', tenantId) : Promise.resolve(null),
        guarantorId ? domainGetSmart('people', guarantorId) : Promise.resolve(null),
      ]);

      const history = contracts.filter(
        (c) => !activeContract || String(c.رقم_العقد) !== String(activeContract.رقم_العقد)
      );

      setData({
        property: prop,
        owner: owner ?? undefined,
        currentTenant: currentTenant ?? null,
        currentGuarantor: currentGuarantor ?? null,
        currentContract: activeContract,
        history,
      });

      const [inspections, ownership, sales] = await Promise.all([
        propertyInspectionsSmart(id),
        ownershipHistorySmart({ propertyId: id }),
        salesForPropertySmart(id),
      ]);
      setFastInspections(Array.isArray(inspections) ? (inspections as PropertyInspection[]) : []);
      setFastOwnershipHistory(Array.isArray(ownership) ? (ownership as سجل_الملكية_tbl[]) : []);
      setFastSalesListings(
        sales && Array.isArray(sales.listings) ? (sales.listings as عروض_البيع_tbl[]) : []
      );
      setFastSaleAgreements(
        sales && Array.isArray(sales.agreements) ? (sales.agreements as SaleAgreementItem[]) : []
      );
    } catch {
      // Desktop focus: never fall back to legacy scans in renderer.
      if (isDesktop) {
        setData(null);
        setFastInspections([]);
        setFastOwnershipHistory([]);
        setFastSalesListings([]);
        setFastSaleAgreements([]);
        return;
      }
      const d = DbService.getPropertyDetails(id);
      if (d) setData(d);
    }
  }, [id, isDesktopFast, desktopUnsupported, isDesktop]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Hooks MUST run on every render (prevents React error #310).
  const propertyId = String(data?.property?.رقم_العقار || '').trim();
  const inspectionsForProperty: PropertyInspection[] = propertyId
    ? isDesktopFast
      ? fastInspections
      : DbService.getPropertyInspections(propertyId)
    : [];
  const latestInspection = inspectionsForProperty[0] || null;

  useEffect(() => {
    if (desktopUnsupported || !latestInspection) {
      setInspectionPeople({});
      return;
    }

    if (!isDesktopFast) {
      // Legacy mode: keep existing behavior (may be heavy).
      try {
        const people = DbService.getPeople();
        const inspector = latestInspection?.inspectorId
          ? people.find((x) => x.رقم_الشخص === latestInspection.inspectorId)
          : null;
        const client = latestInspection?.clientId
          ? people.find((x) => x.رقم_الشخص === latestInspection.clientId)
          : null;
        setInspectionPeople({ inspector, client });
      } catch {
        setInspectionPeople({});
      }
      return;
    }

    const inspectorId = String(latestInspection?.inspectorId || '').trim();
    const clientId = String(latestInspection?.clientId || '').trim();
    void (async () => {
      const [inspector, client] = await Promise.all([
        inspectorId ? domainGetSmart('people', inspectorId) : Promise.resolve(null),
        clientId ? domainGetSmart('people', clientId) : Promise.resolve(null),
      ]);
      setInspectionPeople({ inspector, client });
    })();
  }, [isDesktopFast, latestInspection, desktopUnsupported]);

  const allContractsForProperty = useMemo(() => {
    if (desktopUnsupported || !propertyId) {
      return [] as العقود_tbl[];
    }

    if (!isDesktopFast) {
      const all = DbService.getContracts();
      const arr = all
        .filter((c: العقود_tbl) => String(c.رقم_العقار) === propertyId && !c.isArchived)
        .slice();

      const seen = new Set<string>();
      const deduped: العقود_tbl[] = [];
      for (const c of arr) {
        const cid = String(c.رقم_العقد || '');
        if (!cid) continue;
        if (seen.has(cid)) continue;
        seen.add(cid);
        deduped.push(c);
      }

      deduped.sort((a, b) => {
        const bs = String(b.تاريخ_البداية || '');
        const as = String(a.تاريخ_البداية || '');
        const cmpStart = bs.localeCompare(as);
        if (cmpStart) return cmpStart;
        const be = String(b.تاريخ_النهاية || '');
        const ae = String(a.تاريخ_النهاية || '');
        const cmpEnd = be.localeCompare(ae);
        if (cmpEnd) return cmpEnd;
        return String(b.رقم_العقد || '').localeCompare(String(a.رقم_العقد || ''));
      });

      return deduped;
    }

    // Desktop fast: use the contracts already loaded through SQL in `data` (current + history)
    const all = [data?.currentContract, ...(data?.history ?? [])].filter(isDefined);
    const seen = new Set<string>();
    const out: العقود_tbl[] = [];
    for (const c of all) {
      const cid = String(c.رقم_العقد || '').trim();
      if (!cid) continue;
      if (seen.has(cid)) continue;
      seen.add(cid);
      out.push(c);
    }
    return out;
  }, [data, isDesktopFast, desktopUnsupported, propertyId]);

  if (desktopUnsupported) {
    return (
      <div className="p-10 text-center text-slate-600 dark:text-slate-300">
        <div className="mx-auto mb-3 w-12 h-12 rounded-full bg-yellow-100 dark:bg-yellow-900/20 flex items-center justify-center">
          <ClipboardCheck className="w-6 h-6 text-yellow-700 dark:text-yellow-300" />
        </div>
        <div className="font-bold">غير مدعوم في وضع الديسكتوب الحالي</div>
        <div className="text-sm mt-2">يرجى تحديث نسخة الديسكتوب أو تفعيل وضع السرعة/SQL.</div>
      </div>
    );
  }

  if (!data) return <div className="p-10 text-center">جاري التحميل...</div>;

  const { property: p, owner, currentTenant, currentGuarantor, currentContract } = data;
  const ownershipHistory = isDesktopFast
    ? fastOwnershipHistory
    : DbService.getOwnershipHistory(p.رقم_العقار);

  const inspectionInspector = inspectionPeople.inspector ?? null;
  const inspectionClient = inspectionPeople.client ?? null;

  const handleDeleteInspectionFromProperty = async (inspectionId: string) => {
    const ok = await toast.confirm({
      title: 'حذف كشف',
      message: 'هل أنت متأكد من حذف هذا الكشف؟ سيتم حذف المرفقات المرتبطة به أيضاً.',
      confirmText: 'حذف',
      cancelText: 'إلغاء',
      isDangerous: true,
    });
    if (!ok) return;

    const res = await deleteInspectionSmart(inspectionId);
    if (res.success) {
      toast.success(res.message || 'تم الحذف');
      reload();
    } else {
      toast.error(res.message || 'فشل الحذف');
    }
  };

  const salesListingsForProperty = (() => {
    if (isDesktopFast) return fastSalesListings;
    const all = DbService.getSalesListings();
    return all
      .filter((l) => String(l.رقم_العقار) === String(p.رقم_العقار))
      .slice()
      .sort((a: عروض_البيع_tbl, b: عروض_البيع_tbl) =>
        String(b.تاريخ_العرض || '').localeCompare(String(a.تاريخ_العرض || ''))
      );
  })();

  const openSalesListing =
    salesListingsForProperty.find((l) => l.الحالة !== 'Sold' && l.الحالة !== 'Cancelled') ||
    salesListingsForProperty[0];

  const handleQuickReminderForProperty = async () => {
    const propertyId = String(p?.رقم_العقار || '').trim();
    if (!propertyId) return;

    const code = String(p?.الكود_الداخلي || '').trim() || propertyId;
    const defaultTitle = `متابعة عقار ${code}`;

    const title = await dialogs.prompt({
      title: 'تذكير / متابعة',
      message: 'ما هي المتابعة المطلوبة؟',
      inputType: 'text',
      defaultValue: defaultTitle,
      required: true,
    });
    if (!title) return;

    const dueDate = await dialogs.prompt({
      title: 'تاريخ التذكير',
      message: 'اختر تاريخ التذكير',
      inputType: 'date',
      defaultValue: todayYMD,
      required: true,
    });
    if (!dueDate) return;

    const note = await dialogs.prompt({
      title: 'ملاحظة (اختياري)',
      inputType: 'textarea',
      defaultValue: '',
      placeholder: 'اكتب ملاحظة مختصرة تساعدك عند المتابعة...',
    });
    if (note === null) return;

    const ownerId = String(owner?.رقم_الشخص || '').trim() || undefined;

    const task: Omit<FollowUpTask, 'id' | 'status'> = {
      task: title,
      clientName: String(owner?.الاسم || '').trim() || undefined,
      phone: String(owner?.رقم_الهاتف || '').trim() || undefined,
      type: 'Task',
      dueDate,
      priority: 'Medium',
      propertyId,
      personId: ownerId,
      note: String(note || '').trim() || undefined,
    };

    const res = await addFollowUpSmart(task as unknown as Record<string, unknown>);
    if (!res.success) {
      dialogs.toast.error(res.message || 'فشل حفظ التذكير');
      return;
    }

    dialogs.toast.success(res.message || 'تم حفظ التذكير');
    openPanel('CALENDAR_EVENTS', dueDate, { title: 'مهام اليوم' });
  };
  const saleAgreementsForProperty = (() => {
    if (isDesktopFast) return fastSaleAgreements;
    const agreements = DbService.getSalesAgreements();
    const listings = DbService.getSalesListings();
    return agreements
      .map((a: اتفاقيات_البيع_tbl) => {
        const l = listings.find((x) => x.id === a.listingId);
        const propId = a.رقم_العقار || l?.رقم_العقار;
        const sellerId = a.رقم_البائع || l?.رقم_المالك;
        return { a, propId, sellerId, listing: l };
      })
      .filter((x) => x.propId === p.رقم_العقار);
  })();
  const latestSaleAgreement = saleAgreementsForProperty
    .filter((x) => !!x.a)
    .slice()
    .sort((x, y) =>
      String(y.a.transferDate || y.a.تاريخ_الاتفاقية || '').localeCompare(
        String(x.a.transferDate || x.a.تاريخ_الاتفاقية || '')
      )
    )[0];

  const handleChangeStatus = async (val: string) => {
    const res = await updatePropertySmart(String(p.رقم_العقار), {
      حالة_العقار: val,
      IsRented: val === 'مؤجر',
    });

    if (!res.success) {
      toast.error(res.message || 'فشل تحديث حالة العقار');
      return;
    }

    toast.success('تم تحديث حالة العقار');
    reload();
  };

  const handlePrint = () => {
    void printCurrentViewUnified({ documentType: 'property', entityId: id });
  };

  const handleEditAgreementFromProperty = (agreementId: string) => {
    try {
      localStorage.setItem('ui_sales_edit_agreement_id', agreementId);
    } catch {
      // ignore
    }
    window.location.hash = '#' + ROUTE_PATHS.SALES;
    if (onClose) onClose();
  };

  const handleDeleteAgreementFromProperty = async (agreementId: string) => {
    const ok = await toast.confirm({
      title: 'تأكيد الحذف',
      message: 'هل أنت متأكد من حذف هذه الاتفاقية؟',
      confirmText: 'حذف',
      cancelText: 'إلغاء',
    });
    if (!ok) return;
    const res = await deleteSalesAgreementSmart(agreementId);
    if (res.success) {
      toast.success(res.message || 'تم الحذف');
      reload();
    } else {
      toast.error(res.message || 'فشل الحذف');
    }
  };

  return (
    <div className="space-y-6">
      {/* Print Template */}
      <div className="hidden print:block">
        <PrintLetterhead className="mb-6" />
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold">نموذج بيانات عقار</h1>
          <div className="text-sm text-slate-600">
            التاريخ: {new Date().toISOString().slice(0, 10)}
          </div>
        </div>

        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-right text-sm">
            <tbody className="divide-y divide-gray-200">
              <tr>
                <td className="p-3 bg-gray-50 font-bold w-48">الكود الداخلي</td>
                <td className="p-3">{p.الكود_الداخلي || '—'}</td>
              </tr>
              <tr>
                <td className="p-3 bg-gray-50 font-bold">العنوان</td>
                <td className="p-3">{p.العنوان || '—'}</td>
              </tr>
              <tr>
                <td className="p-3 bg-gray-50 font-bold">النوع / الحالة</td>
                <td className="p-3">
                  {p.النوع || '—'} • {p.حالة_العقار || '—'}
                </td>
              </tr>
              <tr>
                <td className="p-3 bg-gray-50 font-bold">المساحة</td>
                <td className="p-3">{typeof p.المساحة === 'number' ? `${p.المساحة} م²` : '—'}</td>
              </tr>
              <tr>
                <td className="p-3 bg-gray-50 font-bold">المالك</td>
                <td className="p-3">
                  {owner?.الاسم || 'غير معروف'} {owner?.رقم_الهاتف ? `• ${owner.رقم_الهاتف}` : ''}
                </td>
              </tr>
              {currentContract ? (
                <tr>
                  <td className="p-3 bg-gray-50 font-bold">العقد الحالي</td>
                  <td className="p-3">
                    #{formatContractNumberShort(currentContract.رقم_العقد)} •{' '}
                    {currentContract.تاريخ_البداية} → {currentContract.تاريخ_النهاية}
                  </td>
                </tr>
              ) : null}
              {currentTenant ? (
                <tr>
                  <td className="p-3 bg-gray-50 font-bold">المستأجر الحالي</td>
                  <td className="p-3">
                    {currentTenant.الاسم || '—'}{' '}
                    {currentTenant.رقم_الهاتف ? `• ${currentTenant.رقم_الهاتف}` : ''}
                  </td>
                </tr>
              ) : null}
              {currentGuarantor ? (
                <tr>
                  <td className="p-3 bg-gray-50 font-bold">الكفيل</td>
                  <td className="p-3">
                    {currentGuarantor.الاسم || '—'}{' '}
                    {currentGuarantor.رقم_الهاتف ? `• ${currentGuarantor.رقم_الهاتف}` : ''}
                  </td>
                </tr>
              ) : null}
              {p.رقم_اشتراك_الكهرباء ? (
                <tr>
                  <td className="p-3 bg-gray-50 font-bold">كهرباء</td>
                  <td className="p-3">{p.رقم_اشتراك_الكهرباء}</td>
                </tr>
              ) : null}
              {p.رقم_اشتراك_المياه ? (
                <tr>
                  <td className="p-3 bg-gray-50 font-bold">مياه</td>
                  <td className="p-3">{p.رقم_اشتراك_المياه}</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-6 print:hidden">
        {/* Header */}
        <div className="app-card p-6">
          <div
            className={`absolute top-0 right-0 w-2 h-full ${p.IsRented ? 'bg-red-500' : 'bg-green-500'}`}
          ></div>
          <div className="flex gap-4 items-start">
            <div className="p-3 bg-slate-100 dark:bg-slate-700 rounded-xl text-slate-500">
              <Home size={28} />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                {p.الكود_الداخلي}
                <span
                  className={`text-xs px-2 py-1 rounded-full ${p.IsRented ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}
                >
                  {p.حالة_العقار}
                </span>
              </h1>
              <p className="text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1 text-sm">
                <MapPin size={14} /> {p.العنوان}
              </p>
              <div className="text-xs text-slate-400 mt-2">
                {p.النوع} • {p.الطابق} • {p.المساحة} م²
              </div>

              {/* Manual Status Change */}
              <div className="mt-4 max-w-xs">
                <DynamicSelect
                  label="تغيير حالة العقار"
                  category="prop_status"
                  value={p.حالة_العقار}
                  onChange={handleChangeStatus}
                />
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleQuickReminderForProperty()}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold"
                >
                  <ListTodo size={14} /> تذكير
                </button>

                <RBACGuard requiredPermission="PRINT_EXECUTE">
                  <button
                    type="button"
                    onClick={handlePrint}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold"
                  >
                    <Printer size={14} /> طباعة / PDF
                  </button>
                </RBACGuard>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 p-1 bg-gray-100 dark:bg-slate-900 rounded-xl w-fit">
          <button
            onClick={() => setActiveTab('info')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition ${activeTab === 'info' ? 'bg-white dark:bg-slate-700 shadow text-indigo-600' : 'text-gray-500'}`}
          >
            المعلومات والتفاصيل
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition ${activeTab === 'activity' ? 'bg-white dark:bg-slate-700 shadow text-indigo-600' : 'text-gray-500'}`}
          >
            سجل التطورات والملاحظات
          </button>
        </div>

        {activeTab === 'info' ? (
          <div className="space-y-6 animate-fade-in">
            {/* Attachments */}
            <AttachmentManager referenceType="Property" referenceId={id} />

            {/* Inspection */}
            <div className="app-card p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <ClipboardCheck size={18} className="text-indigo-600" /> الكشف (آخر كشف + آخر
                    صور)
                  </h3>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {latestInspection
                      ? `تاريخ: ${latestInspection.inspectionDate}`
                      : 'لا يوجد كشف بعد'}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    openPanel('INSPECTION_FORM', latestInspection?.id, {
                      propertyId: p.رقم_العقار,
                      onSuccess: reload,
                    })
                  }
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition"
                >
                  {latestInspection ? 'فتح/تعديل' : 'إضافة كشف'}
                </button>
              </div>

              {latestInspection ? (
                <div className="mt-4 space-y-3">
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span
                      className={`px-2 py-1 rounded-full border ${latestInspection.isReady ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/10 dark:text-green-300 dark:border-green-800' : 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/10 dark:text-yellow-300 dark:border-yellow-800'}`}
                    >
                      {latestInspection.isReady ? 'جاهز' : 'بحاجة متابعة'}
                    </span>
                    {inspectionInspector ? (
                      <span className="px-2 py-1 rounded-full bg-slate-50 text-slate-700 border border-slate-200 dark:bg-slate-900/20 dark:text-slate-300 dark:border-slate-700">
                        الكاشف: {inspectionInspector.الاسم}
                      </span>
                    ) : null}
                    {inspectionClient ? (
                      <span className="px-2 py-1 rounded-full bg-slate-50 text-slate-700 border border-slate-200 dark:bg-slate-900/20 dark:text-slate-300 dark:border-slate-700">
                        العميل: {inspectionClient.الاسم}
                      </span>
                    ) : null}
                  </div>

                  {latestInspection.notes ? (
                    <div className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                      {latestInspection.notes}
                    </div>
                  ) : null}

                  <AttachmentManager referenceType="Inspection" referenceId={latestInspection.id} />

                  {/* Previous inspections */}
                  {inspectionsForProperty.length > 1 ? (
                    <div className="mt-4">
                      <div className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                        الكشوفات السابقة ({inspectionsForProperty.length - 1})
                      </div>
                      <div className="space-y-2">
                        {inspectionsForProperty.slice(1).map((ins) => (
                          <div
                            key={ins.id}
                            className="p-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/30 flex items-center justify-between gap-3"
                          >
                            <div className="min-w-0">
                              <div className="text-sm font-bold text-slate-800 dark:text-white whitespace-normal break-words">
                                {ins.inspectionDate}
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                {ins.isReady ? 'جاهز' : 'بحاجة متابعة'}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 flex-shrink-0">
                              <button
                                type="button"
                                onClick={() =>
                                  openPanel('INSPECTION_FORM', ins.id, {
                                    propertyId: p.رقم_العقار,
                                    onSuccess: reload,
                                  })
                                }
                                className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition"
                              >
                                فتح
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteInspectionFromProperty(ins.id)}
                                className="px-3 py-2 rounded-lg bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition"
                              >
                                حذف
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="mt-4 text-sm text-slate-500 dark:text-slate-400">
                  اضغط "إضافة كشف" لتسجيل كشف جديد ثم ارفع صور العقار.
                </div>
              )}
            </div>

            <DynamicFieldsDisplay formId="properties" values={p.حقول_ديناميكية} />

            {/* Owner Info */}
            <div
              className="bg-indigo-50 dark:bg-indigo-900/10 p-4 rounded-xl border border-indigo-100 dark:border-indigo-800 flex justify-between items-center cursor-pointer hover:bg-indigo-100 dark:hover:bg-indigo-900/20 transition"
              onClick={() => owner && openPanel('PERSON_DETAILS', owner.رقم_الشخص)}
            >
              <div className="flex items-center gap-3">
                <div className="bg-indigo-200 dark:bg-indigo-800 p-2 rounded-full text-indigo-700 dark:text-indigo-200">
                  <User size={16} />
                </div>
                <div>
                  <p className="text-xs text-indigo-600 dark:text-indigo-400 font-bold">المالك</p>
                  <p className="text-sm font-bold text-slate-800 dark:text-white">
                    {owner?.الاسم || 'غير معروف'}
                  </p>
                </div>
              </div>
              <ArrowRight size={16} className="text-indigo-400" />
            </div>

            {/* Previous Owners (Ownership History) */}
            {ownershipHistory.length > 0 && (
              <div className="app-card p-4">
                <h4 className="font-bold text-sm mb-4 flex items-center gap-2 text-slate-700 dark:text-slate-300">
                  <History size={16} className="text-emerald-600" /> سجل الملاك السابقين
                </h4>
                <div className="space-y-2">
                  {ownershipHistory
                    .slice()
                    .sort((a: سجل_الملكية_tbl, b: سجل_الملكية_tbl) =>
                      String(b.تاريخ_نقل_الملكية || '').localeCompare(
                        String(a.تاريخ_نقل_الملكية || '')
                      )
                    )
                    .slice(0, 20)
                    .map((r: سجل_الملكية_tbl) => (
                      <div
                        key={r.id}
                        className="p-3 bg-gray-50 dark:bg-slate-900/50 rounded-lg border border-gray-100 dark:border-slate-700"
                      >
                        <div className="flex justify-between items-center">
                          <div className="text-xs text-slate-500">
                            {r.تاريخ_نقل_الملكية}{' '}
                            {r.رقم_المعاملة ? `• معاملة: ${r.رقم_المعاملة}` : ''}
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => openPanel('PERSON_DETAILS', r.رقم_المالك_القديم)}
                              className="text-xs font-bold text-indigo-600 hover:underline"
                            >
                              المالك القديم
                            </button>
                            <button
                              onClick={() => openPanel('PERSON_DETAILS', r.رقم_المالك_الجديد)}
                              className="text-xs font-bold text-indigo-600 hover:underline"
                            >
                              المالك الجديد
                            </button>
                          </div>
                        </div>
                        <div className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                          {typeof r.السعر_النهائي === 'number'
                            ? `السعر النهائي: ${r.السعر_النهائي.toLocaleString()} د.أ`
                            : ''}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Current Tenant (from active contract) */}
            {currentContract && (
              <div className="bg-purple-50 dark:bg-purple-900/10 p-4 rounded-xl border border-purple-100 dark:border-purple-800">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="bg-purple-200 dark:bg-purple-800 p-2 rounded-full text-purple-700 dark:text-purple-200">
                      <User size={16} />
                    </div>
                    <div>
                      <p className="text-xs text-purple-600 dark:text-purple-400 font-bold">
                        المستأجر الحالي
                      </p>
                      <p className="text-sm font-bold text-slate-800 dark:text-white">
                        {currentTenant?.الاسم || 'غير معروف'}
                      </p>
                      {(currentTenant?.رقم_الهاتف || currentContract?.تاريخ_النهاية) && (
                        <div className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5 flex flex-wrap gap-x-3 gap-y-1">
                          {currentTenant?.رقم_الهاتف ? (
                            <span>هاتف: {currentTenant.رقم_الهاتف}</span>
                          ) : null}
                          {currentContract?.تاريخ_النهاية ? (
                            <span>نهاية العقد: {currentContract.تاريخ_النهاية}</span>
                          ) : null}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {currentTenant ? (
                      <button
                        type="button"
                        onClick={() => openPanel('PERSON_DETAILS', currentTenant.رقم_الشخص)}
                        className="px-3 py-1.5 rounded-lg border border-purple-200 dark:border-purple-800 text-xs font-bold text-purple-700 dark:text-purple-200 hover:bg-purple-100 dark:hover:bg-purple-900/20"
                      >
                        فتح المستأجر
                      </button>
                    ) : null}
                    {currentGuarantor ? (
                      <button
                        type="button"
                        onClick={() => openPanel('PERSON_DETAILS', currentGuarantor.رقم_الشخص)}
                        className="px-3 py-1.5 rounded-lg border border-purple-200 dark:border-purple-800 text-xs font-bold text-purple-700 dark:text-purple-200 hover:bg-purple-100 dark:hover:bg-purple-900/20"
                      >
                        فتح الكفيل
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => openPanel('CONTRACT_DETAILS', currentContract.رقم_العقد)}
                      className="px-3 py-1.5 rounded-lg border border-purple-200 dark:border-purple-800 text-xs font-bold text-purple-700 dark:text-purple-200 hover:bg-purple-100 dark:hover:bg-purple-900/20"
                    >
                      فتح العقد #{formatContractNumberShort(currentContract.رقم_العقد)}
                    </button>
                  </div>
                </div>

                {currentGuarantor ? (
                  <div className="mt-3 pt-3 border-t border-purple-100 dark:border-purple-800/60 text-[11px] text-slate-700 dark:text-slate-200">
                    <span className="font-bold text-purple-700 dark:text-purple-200">الكفيل:</span>{' '}
                    <span className="font-bold">{currentGuarantor.الاسم || 'غير معروف'}</span>
                    {currentGuarantor.رقم_الهاتف ? (
                      <span className="text-slate-600 dark:text-slate-300 dir-ltr">
                        {' '}
                        • {currentGuarantor.رقم_الهاتف}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>
            )}

            {/* Utilities */}
            <div className="grid grid-cols-2 gap-4">
              {p.رقم_اشتراك_الكهرباء && (
                <div className="bg-yellow-50 dark:bg-yellow-900/10 p-3 rounded-xl border border-yellow-200 dark:border-yellow-800">
                  <div className="flex items-center gap-2 mb-1 text-yellow-700 dark:text-yellow-400 text-xs font-bold">
                    <Zap size={14} /> كهرباء
                  </div>
                  <p className="text-sm font-mono text-slate-700 dark:text-slate-300">
                    {p.رقم_اشتراك_الكهرباء}
                  </p>
                </div>
              )}
              {p.رقم_اشتراك_المياه && (
                <div className="bg-cyan-50 dark:bg-cyan-900/10 p-3 rounded-xl border border-cyan-200 dark:border-cyan-800">
                  <div className="flex items-center gap-2 mb-1 text-cyan-700 dark:text-cyan-400 text-xs font-bold">
                    <Droplets size={14} /> مياه
                  </div>
                  <p className="text-sm font-mono text-slate-700 dark:text-slate-300">
                    {p.رقم_اشتراك_المياه}
                  </p>
                </div>
              )}
            </div>

            {/* Contract History */}
            <div className="app-card p-4">
              <h4 className="font-bold text-sm mb-4 flex items-center gap-2 text-slate-700 dark:text-slate-300">
                <FileText size={16} className="text-gray-500" /> تاريخ العقود
              </h4>
              <div className="space-y-2">
                {allContractsForProperty.length === 0 ? (
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    لا توجد عقود لهذا العقار
                  </div>
                ) : (
                  allContractsForProperty.map((c: العقود_tbl) => {
                    const isActive = isTenancyRelevant(c);
                    const isCurrent =
                      currentContract && String(currentContract.رقم_العقد) === String(c.رقم_العقد);
                    const tenantNameFast = isDesktopFast
                      ? contractsMeta.byContractId.get(String(c.رقم_العقد))?.tenantName
                      : undefined;
                    const guarantorNameFast = isDesktopFast
                      ? contractsMeta.byContractId.get(String(c.رقم_العقد))?.guarantorName
                      : undefined;
                    const tenant =
                      !isDesktopFast && c.رقم_المستاجر
                        ? (DbService.getPeople().find(
                            (x) => String(x.رقم_الشخص) === String(c.رقم_المستاجر)
                          ) ?? null)
                        : null;
                    const guarantor =
                      !isDesktopFast && c.رقم_الكفيل
                        ? (DbService.getPeople().find(
                            (x) => String(x.رقم_الشخص) === String(c.رقم_الكفيل)
                          ) ?? null)
                        : null;
                    const rowClass = isActive
                      ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-500/30'
                      : 'bg-gray-50 dark:bg-slate-900 border-gray-100 dark:border-slate-700';
                    const labelClass = isActive
                      ? 'text-indigo-700 dark:text-indigo-200'
                      : 'text-gray-500 dark:text-slate-400';

                    return (
                      <div
                        key={String(c.رقم_العقد)}
                        onClick={() => openPanel('CONTRACT_DETAILS', c.رقم_العقد)}
                        className={`p-3 border rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-800 transition ${rowClass}`}
                      >
                        <div className="flex justify-between items-start gap-3">
                          <div className="min-w-0">
                            <div className="text-xs mb-1 flex flex-wrap items-center gap-2">
                              <span className={`font-bold ${labelClass}`}>
                                {isActive ? (isCurrent ? 'عقد حالي' : 'عقد نشط') : 'منتهي'}
                              </span>
                              <span className="text-[10px] bg-white/70 dark:bg-slate-800 border px-2 py-0.5 rounded">
                                {String(c.حالة_العقد || '')}
                              </span>
                              {c.تاريخ_البداية || c.تاريخ_النهاية ? (
                                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                                  {String(c.تاريخ_البداية || '')}
                                  {c.تاريخ_النهاية ? ` → ${c.تاريخ_النهاية}` : ''}
                                </span>
                              ) : null}
                            </div>
                            <div className="text-sm font-bold text-slate-700 dark:text-slate-200">
                              عقد #{formatContractNumberShort(c.رقم_العقد)}
                            </div>
                            <div className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 flex flex-wrap gap-x-3 gap-y-1">
                              <span>
                                المستأجر:{' '}
                                <span className="font-semibold">
                                  {isDesktopFast ? tenantNameFast || '—' : tenant?.الاسم || '—'}
                                </span>
                              </span>
                              <span>
                                الكفيل:{' '}
                                <span className="font-semibold">
                                  {isDesktopFast
                                    ? guarantorNameFast || '—'
                                    : guarantor?.الاسم || '—'}
                                </span>
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-2 flex-shrink-0">
                            {!isDesktopFast && tenant ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openPanel('PERSON_DETAILS', tenant.رقم_الشخص);
                                }}
                                className="text-xs font-bold text-indigo-600 hover:underline"
                              >
                                فتح المستأجر
                              </button>
                            ) : null}
                            {!isDesktopFast && guarantor ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openPanel('PERSON_DETAILS', guarantor.رقم_الشخص);
                                }}
                                className="text-xs font-bold text-indigo-600 hover:underline"
                              >
                                فتح الكفيل
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Sales Listing Summary */}
            {openSalesListing ? (
              <div className="app-card p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-bold text-sm flex items-center gap-2 text-slate-700 dark:text-slate-300">
                    <Briefcase size={16} className="text-indigo-600" /> عرض البيع
                  </h4>
                  <button
                    onClick={() => openPanel('SALES_LISTING_DETAILS', openSalesListing.id)}
                    className="text-xs font-bold text-indigo-600 hover:underline"
                  >
                    فتح التفاصيل
                  </button>
                </div>
                <div className="text-sm text-slate-700 dark:text-slate-200 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-500">الحالة</span>
                    <b>{openSalesListing.الحالة}</b>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">السعر المطلوب</span>
                    <b className="text-emerald-600">
                      {Number(openSalesListing.السعر_المطلوب || 0).toLocaleString()} د.أ
                    </b>
                  </div>
                  {typeof openSalesListing.أقل_سعر_مقبول !== 'undefined' ? (
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>أقل سعر مقبول</span>
                      <b>{Number(openSalesListing.أقل_سعر_مقبول || 0).toLocaleString()} د.أ</b>
                    </div>
                  ) : null}
                  {openSalesListing.تاريخ_العرض ? (
                    <div className="text-xs text-slate-500">
                      تاريخ العرض: <b>{openSalesListing.تاريخ_العرض}</b>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            {/* Sale Agreement Summary */}
            {latestSaleAgreement?.a && (
              <div className="app-card p-4">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-bold text-sm flex items-center gap-2 text-slate-700 dark:text-slate-300">
                    <FileText size={16} className="text-emerald-600" /> ملخص اتفاقية البيع
                  </h4>
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        handleEditAgreementFromProperty(String(latestSaleAgreement.a.id))
                      }
                      className="inline-flex items-center gap-1 text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-indigo-700"
                      title="تعديل الاتفاقية"
                    >
                      <Edit2 size={14} /> تعديل
                    </button>
                    <button
                      onClick={() =>
                        handleDeleteAgreementFromProperty(String(latestSaleAgreement.a.id))
                      }
                      className="inline-flex items-center gap-1 text-xs font-bold text-red-600 hover:text-red-700"
                      title="حذف الاتفاقية"
                    >
                      <Trash2 size={14} /> حذف
                    </button>
                  </div>
                </div>
                <div className="text-sm text-slate-700 dark:text-slate-200 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-500">السعر النهائي</span>
                    <b className="text-emerald-600">
                      {Number(latestSaleAgreement.a.السعر_النهائي || 0).toLocaleString()} د.أ
                    </b>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">إجمالي المصاريف</span>
                    <b>{Number(latestSaleAgreement.a.إجمالي_المصاريف || 0).toLocaleString()} د.أ</b>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">إجمالي العمولات</span>
                    <b>{Number(latestSaleAgreement.a.إجمالي_العمولات || 0).toLocaleString()} د.أ</b>
                  </div>

                  <div className="text-xs text-slate-500 bg-gray-50 dark:bg-slate-900/40 p-3 rounded-lg border border-gray-100 dark:border-slate-700">
                    <div>
                      عمولة البائع:{' '}
                      <b>{Number(latestSaleAgreement.a.عمولة_البائع || 0).toLocaleString()}</b> •
                      عمولة المشتري:{' '}
                      <b>{Number(latestSaleAgreement.a.عمولة_المشتري || 0).toLocaleString()}</b> •
                      وسيط خارجي:{' '}
                      <b>{Number(latestSaleAgreement.a.عمولة_وسيط_خارجي || 0).toLocaleString()}</b>
                    </div>
                    {latestSaleAgreement.a.مصاريف_البيع && (
                      <div className="mt-1">
                        رسوم التنازل:{' '}
                        <b>
                          {Number(
                            latestSaleAgreement.a.مصاريف_البيع.رسوم_التنازل || 0
                          ).toLocaleString()}
                        </b>{' '}
                        • ضريبة الأبنية:{' '}
                        <b>
                          {Number(
                            latestSaleAgreement.a.مصاريف_البيع.ضريبة_الابنية || 0
                          ).toLocaleString()}
                        </b>
                        <br />
                        نقل كهرباء:{' '}
                        <b>
                          {Number(
                            latestSaleAgreement.a.مصاريف_البيع.نقل_اشتراك_الكهرباء || 0
                          ).toLocaleString()}
                        </b>{' '}
                        • نقل مياه:{' '}
                        <b>
                          {Number(
                            latestSaleAgreement.a.مصاريف_البيع.نقل_اشتراك_المياه || 0
                          ).toLocaleString()}
                        </b>{' '}
                        • تأمينات:{' '}
                        <b>
                          {Number(
                            latestSaleAgreement.a.مصاريف_البيع.قيمة_التأمينات || 0
                          ).toLocaleString()}
                        </b>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between text-xs text-slate-500">
                    <span>تاريخ الاتفاقية: {latestSaleAgreement.a.تاريخ_الاتفاقية || '-'}</span>
                    <span>تاريخ النقل: {latestSaleAgreement.a.transferDate || '-'}</span>
                  </div>
                  {latestSaleAgreement.a.transactionId && (
                    <div className="text-xs text-slate-500">
                      رقم معاملة دائرة الأراضي: <b>{latestSaleAgreement.a.transactionId}</b>
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    {latestSaleAgreement.sellerId && (
                      <button
                        onClick={() => openPanel('PERSON_DETAILS', latestSaleAgreement.sellerId)}
                        className="text-xs font-bold text-indigo-600 hover:underline"
                      >
                        ملف البائع
                      </button>
                    )}
                    {latestSaleAgreement.a.رقم_المشتري && (
                      <button
                        onClick={() =>
                          openPanel('PERSON_DETAILS', latestSaleAgreement.a.رقم_المشتري)
                        }
                        className="text-xs font-bold text-indigo-600 hover:underline"
                      >
                        ملف المشتري
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-slide-up h-full">
            <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-gray-200 dark:border-slate-700 overflow-y-auto max-h-[500px] custom-scrollbar">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                <History className="text-orange-500" size={20} /> سجل التطورات
              </h3>
              <ActivityTimeline referenceId={id} type="Property" />
            </div>
            <div>
              <NotesSection referenceId={id} type="Property" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
