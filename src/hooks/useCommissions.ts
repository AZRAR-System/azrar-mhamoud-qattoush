import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { DbService } from '@/services/mockDb';
import {
  ReportResult,
  العمولات_tbl,
  العقود_tbl,
  العقارات_tbl,
  العمولات_الخارجية_tbl,
  الأشخاص_tbl,
  المستخدمين_tbl,
  اتفاقيات_البيع_tbl,
} from '@/types';
import { runReportSmart } from '@/services/reporting';
import { useToast } from '@/context/ToastContext';
import { useAuth } from '@/context/AuthContext';
import { useAppDialogs } from '@/hooks/useAppDialogs';
import { useDbSignal } from '@/hooks/useDbSignal';
import { getRentalTier } from '@/utils/employeeCommission';
import { storage } from '@/services/storage';
import { contractDetailsSmart, domainGetSmart } from '@/services/domainQueries';
import { useResponsivePageSize } from '@/hooks/useResponsivePageSize';
import { formatContractNumberShort } from '@/utils/contractNumber';
import { formatCurrencyJOD } from '@/utils/format';
import { exportToXlsx, type XlsxColumn } from '@/utils/xlsx';

export type Tab = 'contracts' | 'external' | 'employee';

export type EmployeeCommissionRow = {
  type?: string;
  date?: string;
  reference?: string;
  employee?: string;
  employeeUsername?: string;
  property?: string;
  opportunity?: string;
  officeCommission?: number;
  tier?: string;
  employeeBase?: number;
  intro?: number;
  employeeTotal?: number;
  [key: string]: string | number | boolean | null | undefined | Record<string, unknown> | unknown;
};

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const asString = (v: unknown): string => String(v ?? '');
const asTrimmedString = (v: unknown): string => asString(v).trim();
const asNumber = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** مطابقة معرفات قد تختلف بين نص/رقم في الذاكرة أو SQLite */
const idEq = (a: unknown, b: unknown) => String(a ?? '').trim() === String(b ?? '').trim();

/** قراءة حقول من كائن قد يعيدها الديسكتوب بمفاتيح عربية أو إنجليزية */
const pickRecordField = (obj: unknown, keys: string[]): string => {
  if (!isRecord(obj)) return '';
  for (const k of keys) {
    const v = obj[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
};

const contractPropertyId = (c: unknown) =>
  pickRecordField(c, ['رقم_العقار', 'property_id', 'propertyId']);
const contractTenantId = (c: unknown) =>
  pickRecordField(c, ['رقم_المستاجر', 'tenant_id', 'tenantId']);
const propertyOwnerId = (p: unknown) =>
  pickRecordField(p, ['رقم_المالك', 'owner_id', 'ownerId']);
const propertyInternalCode = (p: unknown) =>
  pickRecordField(p, ['الكود_الداخلي', 'internal_code', 'internalCode', 'code']);
const personDisplayName = (p: unknown) =>
  pickRecordField(p, ['الاسم', 'name', 'fullName']);
const personIdFromRow = (p: unknown) =>
  pickRecordField(p, ['رقم_الشخص', 'id', 'personId']);

export const useCommissions = (isVisible: boolean) => {
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    try {
      const saved = sessionStorage.getItem('commissions_activeTab');
      if (saved === 'contracts' || saved === 'external' || saved === 'employee') return saved as Tab;
    } catch { /* ignore */ }
    return 'contracts';
  });

  const listPageSize = useResponsivePageSize({ base: 6, sm: 8, md: 10, lg: 12, xl: 14, '2xl': 18 });
  const [employeePage, setEmployeePage] = useState(1);
  const [contractsPage, setContractsPage] = useState(1);
  const [externalPage, setExternalPage] = useState(1);

  /** الديسكتوب: مسار SQL السريع عبر domainGet و/أو تفاصيل العقد الكاملة */
  const isDesktopFast =
    typeof window !== 'undefined' &&
    storage.isDesktop() &&
    (!!window.desktopDb?.domainGet || !!window.desktopDb?.domainContractDetails);

  // Contract Commissions Data
  const [commissions, setCommissions] = useState<العمولات_tbl[]>([]);
  const [contracts, setContracts] = useState<العقود_tbl[]>([]);
  const [agreements, setAgreements] = useState<اتفاقيات_البيع_tbl[]>([]);
  const [properties, setProperties] = useState<العقارات_tbl[]>([]);
  const [people, setPeople] = useState<الأشخاص_tbl[]>([]);

  // Desktop-fast: resolve contract/property/people names lazily (avoid renderer loading huge arrays)
  const fastContractByIdRef = useRef<Map<string, العقود_tbl>>(new Map());
  const fastAgreementByIdRef = useRef<Map<string, اتفاقيات_البيع_tbl>>(new Map());
  const fastPropertyByIdRef = useRef<Map<string, العقارات_tbl>>(new Map());
  const fastPersonByIdRef = useRef<Map<string, الأشخاص_tbl>>(new Map());
  const [fastCacheVersion, setFastCacheVersion] = useState(0);

  // External Commissions Data
  const [externalCommissions, setExternalCommissions] = useState<العمولات_الخارجية_tbl[]>([]);
  const [isExternalModalOpen, setIsExternalModalOpen] = useState(false);
  const [externalModalMode, setExternalModalMode] = useState<'add' | 'edit'>('add');
  const [editingExternalId, setEditingExternalId] = useState<string | null>(null);
  const [newExtComm, setNewExtComm] = useState<Partial<العمولات_الخارجية_tbl>>({
    التاريخ: new Date().toISOString().split('T')[0],
    العنوان: '',
    القيمة: 0,
    النوع: '',
    ملاحظات: '',
  });

  // Contract commission editing
  const [isContractModalOpen, setIsContractModalOpen] = useState(false);
  const [editingContractComm, setEditingContractComm] = useState<Partial<العمولات_tbl> | null>(
    null
  );

  // Employee Commissions (Report)
  const [employeeReport, setEmployeeReport] = useState<ReportResult | null>(null);

  // Users (for attributing/filtering employee commissions)
  const [systemUsers, setSystemUsers] = useState<المستخدمين_tbl[]>([]);
  const [employeeUserFilter, setEmployeeUserFilter] = useState<string>('');

  // Filters
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    try {
      const saved = sessionStorage.getItem('commissions_selectedMonth');
      if (saved && /^\d{4}-\d{2}$/.test(saved)) return saved;
    } catch { /* ignore */ }
    return new Date().toISOString().slice(0, 7);
  });
  const [searchTerm, setSearchTerm] = useState('');
  /** بحث داخل تبويب عمولات العقود فقط (لا يؤثر على إجماليات الشهر) */
  const [contractSearchTerm, setContractSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('All');

  const toast = useToast();
  const dialogs = useAppDialogs();
  const dbSignal = useDbSignal();
  const { user } = useAuth();
  const isStaleRef = useRef(false);

  // Support deep-linking from Dashboard: #/commissions?tab=employee&month=YYYY-MM&user=username
  useEffect(() => {
    const applyFromHash = () => {
      try {
        const raw = window.location.hash || '';
        const hash = raw.startsWith('#') ? raw.slice(1) : raw;
        const parts = hash.split('?');
        const query = parts.length > 1 ? parts.slice(1).join('?') : '';
        if (!query) return;

        const params = new URLSearchParams(query);
        const tab = String(params.get('tab') || '').trim();
        const month = String(params.get('month') || '').trim();
        const userQ = String(params.get('user') || '').trim();

        if (tab === 'contracts' || tab === 'external' || tab === 'employee') {
          setActiveTab(tab);
        }
        if (/^\d{4}-\d{2}$/.test(month)) {
          setSelectedMonth(month);
        }
        if (userQ) {
          setEmployeeUserFilter(userQ);
        }
      } catch {
        // ignore
      }
    };

    applyFromHash();
    window.addEventListener('hashchange', applyFromHash);
    return () => window.removeEventListener('hashchange', applyFromHash);
  }, []);

  // Sync to SessionStorage
  useEffect(() => {
    sessionStorage.setItem('commissions_activeTab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    sessionStorage.setItem('commissions_selectedMonth', selectedMonth);
  }, [selectedMonth]);

  // Default employee filter to current logged-in user
  useEffect(() => {
    if (employeeUserFilter) return;
    const username = asTrimmedString(user?.اسم_المستخدم);
    if (username) setEmployeeUserFilter(username);
  }, [user, employeeUserFilter]);

  const loadData = useCallback(() => {
    setCommissions(DbService.getCommissions());
    setExternalCommissions(DbService.getExternalCommissions());

    if (isDesktopFast) {
      // Desktop fast mode: never load huge arrays into renderer memory.
      setContracts([]);
      setAgreements([]);
      setProperties([]);
      setPeople([]);
      // Preserving the Maps (fastContractByIdRef etc.) to prevent "flicker" on tab switch.
      // They are populated by the hydration useEffect whenever IDs appear.
      setFastCacheVersion((v) => v + 1);
    } else {
      setContracts(DbService.getContracts());
      setAgreements(DbService.getSalesAgreements());
      setProperties(DbService.getProperties());
      setPeople(DbService.getPeople());
    }

    try {
      setSystemUsers(DbService.getSystemUsers());
    } catch {
      setSystemUsers([]);
    }

    (async () => {
      try {
        const report = await runReportSmart('employee_commissions');
        setEmployeeReport(report);
      } catch {
        setEmployeeReport(null);
      }
    })();
  }, [isDesktopFast]);

  useEffect(() => {
    if (isVisible) {
      if (isStaleRef.current) {
        // We were hidden and data changed; refresh now.
        isStaleRef.current = false;
        loadData();
      } else {
        // Standard load
        loadData();
      }
    }
  }, [isVisible, dbSignal, loadData, activeTab]);

  // Separate effect to handle background dbSignal when hidden
  useEffect(() => {
    if (!isVisible && dbSignal) {
      isStaleRef.current = true;
    }
  }, [dbSignal, isVisible]);

  const handleAddExternal = (e: FormEvent) => {
    e.preventDefault();
    if (!newExtComm.العنوان || !newExtComm.القيمة || !newExtComm.النوع) {
      toast.warning('يرجى تعبئة الحقول المطلوبة (العنوان، القيمة، النوع)');
      return;
    }
    if (externalModalMode === 'add') {
      const res = DbService.addExternalCommission(newExtComm);
      if (res.success) {
        toast.success('تمت إضافة العمولة');
        setIsExternalModalOpen(false);
        setNewExtComm({
          التاريخ: new Date().toISOString().split('T')[0],
          النوع: '',
          القيمة: 0,
          العنوان: '',
          ملاحظات: '',
        });
        loadData();
      } else {
        toast.error(res.message || 'فشل إضافة العمولة');
      }
      return;
    }

    if (!editingExternalId) {
      toast.error('تعذر تحديد السجل المراد تعديله');
      return;
    }

    const { id: _ignored, ...patch } = newExtComm;
    const res = DbService.updateExternalCommission(editingExternalId, patch);
    if (res.success) {
      toast.success('تم تعديل العمولة');
      setIsExternalModalOpen(false);
      setExternalModalMode('add');
      setEditingExternalId(null);
      setNewExtComm({
        التاريخ: new Date().toISOString().split('T')[0],
        النوع: '',
        القيمة: 0,
        العنوان: '',
        ملاحظات: '',
      });
      loadData();
    } else {
      toast.error(res.message || 'فشل تعديل العمولة');
    }
  };

  const handleDeleteExternal = async (id: string) => {
    const ok = await toast.confirm({
      title: 'حذف',
      message: 'هل تريد حذف هذا السجل؟',
      confirmText: 'حذف',
      cancelText: 'إلغاء',
      isDangerous: true,
    });
    if (!ok) return;

    const res = DbService.deleteExternalCommission(id);
    if (res.success === false) {
      toast.error(res.message || 'فشل الحذف');
      return;
    }
    loadData();
    toast.success('تم حذف العمولة');
  };

  const openAddExternalModal = () => {
    setExternalModalMode('add');
    setEditingExternalId(null);
    setNewExtComm({
      التاريخ: new Date().toISOString().split('T')[0],
      النوع: '',
      القيمة: 0,
      العنوان: '',
      ملاحظات: '',
    });
    setIsExternalModalOpen(true);
  };

  const openEditExternalModal = (c: العمولات_الخارجية_tbl) => {
    setExternalModalMode('edit');
    setEditingExternalId(c.id);
    setNewExtComm({
      التاريخ: c.التاريخ,
      النوع: c.النوع,
      القيمة: c.القيمة,
      العنوان: c.العنوان,
      ملاحظات: c.ملاحظات,
    });
    setIsExternalModalOpen(true);
  };

  const closeExternalModal = () => {
    setIsExternalModalOpen(false);
    setExternalModalMode('add');
    setEditingExternalId(null);
    setNewExtComm({
      التاريخ: new Date().toISOString().split('T')[0],
      النوع: '',
      القيمة: 0,
      العنوان: '',
      ملاحظات: '',
    });
  };

  const openEditContractModal = (c: العمولات_tbl) => {
    const currentUsername = asTrimmedString(user?.اسم_المستخدم);
    setEditingContractComm({
      ...c,
      اسم_المستخدم: asTrimmedString(c.اسم_المستخدم || currentUsername) || undefined,
    });
    setIsContractModalOpen(true);
  };

  const closeContractModal = () => {
    setIsContractModalOpen(false);
    setEditingContractComm(null);
  };

  const handleSaveContractEdit = (e: FormEvent) => {
    e.preventDefault();
    if (!editingContractComm?.رقم_العمولة) {
      toast.error('تعذر تحديد العمولة المراد تعديلها');
      return;
    }

    const isSale = editingContractComm.نوع_العمولة === 'Sale';
    const c1 = Number((isSale ? editingContractComm.عمولة_البائع : editingContractComm.عمولة_المالك) || 0);
    const c2 = Number((isSale ? editingContractComm.عمولة_المشتري : editingContractComm.عمولة_المستأجر) || 0);

    if (!Number.isFinite(c1) || !Number.isFinite(c2)) {
      toast.warning('يرجى إدخال أرقام صحيحة');
      return;
    }

    const res = DbService.updateCommission(editingContractComm.رقم_العمولة, {
      تاريخ_العقد: editingContractComm.تاريخ_العقد,
      شهر_دفع_العمولة: /^\d{4}-\d{2}/.test(String(editingContractComm.تاريخ_العقد || ''))
        ? String(editingContractComm.تاريخ_العقد).slice(0, 7)
        : undefined,
      رقم_الفرصة: asTrimmedString(editingContractComm.رقم_الفرصة) || undefined,
      يوجد_ادخال_عقار: !!editingContractComm.يوجد_ادخال_عقار,
      اسم_المستخدم: asTrimmedString(editingContractComm.اسم_المستخدم) || undefined,
      ...(isSale 
        ? { عمولة_البائع: c1, عمولة_المشتري: c2, المجموع: c1 + c2 + (Number(editingContractComm.عمولة_إدخال_عقار) || 0) }
        : { عمولة_المالك: c1, عمولة_المستأجر: c2, المجموع: c1 + c2 }
      )
    });

    if (res.success) {
      toast.success('تم تعديل العمولة بنجاح');
      setIsContractModalOpen(false);
      setEditingContractComm(null);
      loadData();
    } else {
      toast.error(res.message || 'فشل تعديل العمولة');
    }
  };

  const handleDeleteContractCommission = async (c: العمولات_tbl) => {
    const isSale = c.نوع_العمولة === 'Sale';
    const ref = isSale ? (c.رقم_الاتفاقية || '') : (c.رقم_العقد || '');
    const label = isSale ? 'اتفاقية البيع' : 'العقد';

    const ok = await toast.confirm({
      title: 'حذف حظر',
      message: `هل تريد حذف عمولة ${label} #${formatContractNumberShort(ref)}؟`,
      confirmText: 'حذف',
      cancelText: 'إلغاء',
      isDangerous: true,
    });
    if (!ok) return;

    const res = DbService.deleteCommission(c.رقم_العمولة);
    if (res.success) {
      toast.success('تم حذف العمولة');
      loadData();
    } else {
      toast.error(res.message || 'فشل الحذف');
    }
  };

  // --- Calculations & Helpers ---

  const getPropCode = useCallback(
    (comm: العمولات_tbl) => {
      const type = comm.نوع_العمولة || 'Rental';
      const contractId = String(comm.رقم_العقد || '').trim();
      const agreementId = String(comm.رقم_الاتفاقية || '').trim();

      if (isDesktopFast) {
        void fastCacheVersion;
        if (type === 'Rental' && contractId) {
          const contract = fastContractByIdRef.current.get(contractId.toLowerCase());
          const propId = contractPropertyId(contract);
          const prop = propId ? fastPropertyByIdRef.current.get(propId.toLowerCase()) : null;
          return propertyInternalCode(prop) || '—';
        }
        if (type === 'Sale' && agreementId) {
          const agreement = fastAgreementByIdRef.current.get(agreementId.toLowerCase());
          const propId = pickRecordField(agreement, ['رقم_العقار', 'property_id', 'propertyId']);
          const prop = propId ? fastPropertyByIdRef.current.get(propId.toLowerCase()) : null;
          return propertyInternalCode(prop) || '—';
        }
        return '—';
      }

      if (type === 'Rental') {
        const contract = contracts.find((c) => idEq(c.رقم_العقد, contractId));
        if (!contract) return '—';
        const prop = properties.find((p) => idEq(p.رقم_العقار, contract.رقم_العقار));
        return prop ? String(prop.الكود_الداخلي || '').trim() || '—' : '—';
      } else {
        const agreement = agreements.find((a) => idEq(a.id, agreementId));
        if (!agreement) return '—';
        const prop = properties.find((p) => idEq(p.رقم_العقار, agreement.رقم_العقار));
        return prop ? String(prop.الكود_الداخلي || '').trim() || '—' : '—';
      }
    },
    [isDesktopFast, fastCacheVersion, contracts, agreements, properties]
  );

  const getNames = useCallback(
    (comm: العمولات_tbl) => {
      const type = comm.نوع_العمولة || 'Rental';
      const contractId = String(comm.رقم_العقد || '').trim();
      const agreementId = String(comm.رقم_الاتفاقية || '').trim();

      if (isDesktopFast) {
        void fastCacheVersion;
        if (type === 'Rental' && contractId) {
          const contract = fastContractByIdRef.current.get(contractId.toLowerCase());
          const tenantId = contractTenantId(contract);
          const propId = contractPropertyId(contract);
          const prop = propId ? fastPropertyByIdRef.current.get(propId.toLowerCase()) : null;
          const ownerId = propertyOwnerId(prop);
          const tenant = tenantId ? fastPersonByIdRef.current.get(tenantId.toLowerCase()) : null;
          const owner = ownerId ? fastPersonByIdRef.current.get(ownerId.toLowerCase()) : null;
          return {
            p1: personDisplayName(owner) || '—',
            p2: personDisplayName(tenant) || '—',
          };
        }
        if (type === 'Sale' && agreementId) {
          const agreement = fastAgreementByIdRef.current.get(agreementId.toLowerCase());
          const buyerId = pickRecordField(agreement, ['رقم_المشتري', 'buyer_id', 'buyerId']);
          const propId = pickRecordField(agreement, ['رقم_العقار', 'property_id', 'propertyId']);
          const prop = propId ? fastPropertyByIdRef.current.get(propId.toLowerCase()) : null;
          const sellerId = propertyOwnerId(prop);
          const buyer = buyerId ? fastPersonByIdRef.current.get(buyerId.toLowerCase()) : null;
          const seller = sellerId ? fastPersonByIdRef.current.get(sellerId.toLowerCase()) : null;
          return {
            p1: personDisplayName(seller) || '—',
            p2: personDisplayName(buyer) || '—',
          };
        }
        return { p1: '—', p2: '—' };
      }

      if (type === 'Rental') {
        const contract = contracts.find((c) => idEq(c.رقم_العقد, contractId));
        if (!contract) return { p1: '—', p2: '—' };
        const tenant = people.find((p) => idEq(p.رقم_الشخص, contract.رقم_المستاجر));
        const prop = properties.find((p) => idEq(p.رقم_العقار, contract.رقم_العقار));
        const owner = prop ? people.find((p) => idEq(p.رقم_الشخص, prop.رقم_المالك)) : undefined;
        return {
          p1: String(owner?.الاسم || '').trim() || '—',
          p2: String(tenant?.الاسم || '').trim() || '—',
        };
      } else {
        const agreement = agreements.find((a) => idEq(a.id, agreementId));
        if (!agreement) return { p1: '—', p2: '—' };
        const prop = properties.find((p) => idEq(p.رقم_العقار, agreement.رقم_العقار));
        const seller = prop ? people.find((p) => idEq(p.رقم_الشخص, prop.رقم_المالك)) : undefined;
        const buyer = people.find((p) => idEq(p.رقم_الشخص, agreement.رقم_المشتري));
        return {
          p1: String(seller?.الاسم || '').trim() || '—',
          p2: String(buyer?.الاسم || '').trim() || '—',
        };
      }
    },
    [isDesktopFast, fastCacheVersion, contracts, agreements, properties, people]
  );

  const handlePostponeCommissionCollection = async (c: العمولات_tbl) => {
    const isSale = c.نوع_العمولة === 'Sale';
    const c1Label = isSale ? 'البائع' : 'المالك';
    const c2Label = isSale ? 'المشتري' : 'المستأجر';
    const c1Val = Number((isSale ? c.عمولة_البائع : c.عمولة_المالك) || 0);
    const c2Val = Number((isSale ? c.عمولة_المشتري : c.عمولة_المستأجر) || 0);

    const defaultWho = (() => {
      const prev = String(c.جهة_تحصيل_مؤجل || '').trim();
      if (prev === 'مالك') return 'Owner';
      if (prev === 'مستأجر') return 'Tenant';
      if (c1Val > 0 && c2Val <= 0) return 'Owner';
      if (c2Val > 0 && c1Val <= 0) return 'Tenant';
      return 'Owner';
    })();

    const whoRaw = (await dialogs.prompt({
      title: 'تأجيل التحصيل',
      message: `من هو المطلوب تأجيل تحصيل العمولة منه؟`,
      inputType: 'select',
      options: [
        { label: c1Label, value: 'Owner' },
        { label: c2Label, value: 'Tenant' },
      ],
      defaultValue: defaultWho,
      required: true,
    })) as string | null;
    if (whoRaw !== 'Owner' && whoRaw !== 'Tenant') return;
    const who = whoRaw;

    if (who === 'Owner' && c1Val <= 0) {
      toast.warning(`عمولة ${c1Label} = 0 (لا يوجد ما يمكن تأجيله)`);
      return;
    }
    if (who === 'Tenant' && c2Val <= 0) {
      toast.warning(`عمولة ${c2Label} = 0 (لا يوجد ما يمكن تأجيله)`);
      return;
    }

    const current = String(c.تاريخ_تحصيل_مؤجل || '').trim();
    const defaultValue = /^\d{4}-\d{2}-\d{2}$/.test(current)
      ? current
      : String(c.تاريخ_العقد || '').slice(0, 10) || new Date().toISOString().split('T')[0];

    const value = await dialogs.prompt({
      title: 'تأجيل التحصيل',
      message: 'اختر التاريخ الجديد لتحصيل العمولة',
      inputType: 'date',
      defaultValue,
      required: true,
    });
    if (!value) return;

    const res = DbService.postponeCommissionCollection?.(c.رقم_العمولة, value, who);
    if (res && res.success === false) {
      toast.error(res.message || 'تعذر تأجيل التحصيل');
      return;
    }

    toast.success('تم تأجيل التحصيل وربطه بالتذكير والتنبيهات');
    loadData();
  };

  const getCommissionMonthKey = (c: العمولات_tbl) => {
    const paidMonth = asTrimmedString(c.شهر_دفع_العمولة);
    if (/^\d{4}-\d{2}$/.test(paidMonth)) return paidMonth;
    
    // Fallback to تاريخ_العقد
    const dateStr = asTrimmedString(c.تاريخ_العقد);
    if (/^\d{4}-\d{2}/.test(dateStr)) return dateStr.slice(0, 7);
    
    // Support DD/MM/YYYY if found
    if (/\d{1,2}\/\d{1,2}\/\d{4}/.test(dateStr)) {
      const parts = dateStr.split('/');
      return `${parts[2]}-${parts[1].padStart(2, '0')}`;
    }
    return '';
  };

  /** كل عمولات الشهر المختار — أساس الإجماليات وحساب الشريحة */
  const commissionsForSelectedMonth = useMemo(
    () => commissions.filter((c) => getCommissionMonthKey(c) === selectedMonth),
    [commissions, selectedMonth]
  );

  /** قائمة العرض (شهر + بحث نصي داخل التبويب) */
  const filteredCommissions = useMemo(() => {
    const q = contractSearchTerm.trim().toLowerCase();
    if (!q) return commissionsForSelectedMonth;
    return commissionsForSelectedMonth.filter((c) => {
      const type = c.نوع_العمولة || 'Rental';
      const ref = type === 'Rental' ? (c.رقم_العقد || '') : (c.رقم_الاتفاقية || '');
      const prop = getPropCode(c);
      const names = getNames(c);
      const blob = [
        formatContractNumberShort(ref),
        String(ref),
        prop,
        names.p1,
        names.p2,
        String(c.رقم_الفرصة || ''),
        type === 'Rental' ? 'إيجار' : 'بيع',
      ]
        .join(' ')
        .toLowerCase();
      return blob.includes(q);
    });
  }, [commissionsForSelectedMonth, contractSearchTerm, getNames, getPropCode]);

  /** سطح المكتب السريع: تحميل العقد/الاتفاقية ثم العقار والأطراف */
  useEffect(() => {
    if (!isDesktopFast) return;
    let alive = true;

    const run = async () => {
      const contractIds = Array.from(
        new Set(
          commissionsForSelectedMonth
            .filter((c) => c.نوع_العمولة === 'Rental' || !c.نوع_العمولة)
            .map((c) => String(c.رقم_العقد || '').trim())
            .filter(Boolean)
        )
      );
      const agreementIds = Array.from(
        new Set(
          commissionsForSelectedMonth
            .filter((c) => c.نوع_العمولة === 'Sale')
            .map((c) => String(c.رقم_الاتفاقية || '').trim())
            .filter(Boolean)
        )
      );

      let changed = false;

      // 1. Hydrate Contracts (and related Property/Person)
      const hasContractDetails =
        typeof window !== 'undefined' &&
        typeof window.desktopDb?.domainContractDetails === 'function';

      for (const cid of contractIds.slice(0, 150)) {
        if (!alive) return;
        if (hasContractDetails) {
          try {
            const details = await contractDetailsSmart(cid);
            if (details?.contract) {
              const contractIdNormal = cid.toLowerCase();
              fastContractByIdRef.current.set(contractIdNormal, details.contract);
              const pid = contractPropertyId(details.contract);
              if (pid) {
                const propIdNormal = pid.toLowerCase();
                if (details.property) fastPropertyByIdRef.current.set(propIdNormal, details.property);
                const p = details.property || fastPropertyByIdRef.current.get(propIdNormal);
                if (p) {
                  const oid = propertyOwnerId(p);
                  if (oid) {
                    const ownerIdNormal = oid.toLowerCase();
                    if (!fastPersonByIdRef.current.has(ownerIdNormal)) {
                      const owner = await domainGetSmart('people', oid);
                      if (owner) fastPersonByIdRef.current.set(ownerIdNormal, owner);
                    }
                  }
                }
              }
              if (details.tenant) {
                const tid = personIdFromRow(details.tenant);
                if (tid) fastPersonByIdRef.current.set(tid.toLowerCase(), details.tenant);
              }
              changed = true;
            }
          } catch { /* ignore */ }
        } else {
          try {
            const c = await domainGetSmart('contracts', cid);
            if (c) {
              const contractIdNormal = cid.toLowerCase();
              fastContractByIdRef.current.set(contractIdNormal, c);
              const pid = contractPropertyId(c);
              const tid = contractTenantId(c);
              if (pid) {
                const propIdNormal = pid.toLowerCase();
                let p = fastPropertyByIdRef.current.get(propIdNormal);
                if (!p) {
                  p = await domainGetSmart('properties', pid);
                  if (p) fastPropertyByIdRef.current.set(propIdNormal, p);
                }
                if (p) {
                  const oid = propertyOwnerId(p);
                  if (oid) {
                    const ownerIdNormal = oid.toLowerCase();
                    if (!fastPersonByIdRef.current.has(ownerIdNormal)) {
                      const owner = await domainGetSmart('people', oid);
                      if (owner) fastPersonByIdRef.current.set(ownerIdNormal, owner);
                    }
                  }
                }
              }
              if (tid) {
                const tenantIdNormal = tid.toLowerCase();
                if (!fastPersonByIdRef.current.has(tenantIdNormal)) {
                  const t = await domainGetSmart('people', tid);
                  if (t) fastPersonByIdRef.current.set(tenantIdNormal, t);
                }
              }
              changed = true;
            }
          } catch { /* ignore */ }
        }
      }

      // 2. Hydrate Sales Agreements (and related Property/Person)
      for (const aid of agreementIds.slice(0, 150)) {
        if (!alive) return;
        try {
          const agreement = await domainGetSmart('agreements', aid);
          if (agreement) {
            fastAgreementByIdRef.current.set(aid, agreement);
            const pid = pickRecordField(agreement, ['رقم_العقار', 'property_id', 'propertyId']);
            const sid = pickRecordField(agreement, ['رقم_البائع', 'seller_id', 'sellerId']);
            const bid = pickRecordField(agreement, ['رقم_المشتري', 'buyer_id', 'buyerId']);

            if (pid) {
              let prop = fastPropertyByIdRef.current.get(pid);
              if (!prop) {
                prop = await domainGetSmart('properties', pid);
                if (prop) fastPropertyByIdRef.current.set(pid, prop);
              }
              if (prop) {
                const oid = propertyOwnerId(prop);
                // Try to resolve seller via property if sid is missing
                if (!sid && oid && !fastPersonByIdRef.current.has(oid)) {
                  const owner = await domainGetSmart('people', oid);
                  if (owner) fastPersonByIdRef.current.set(oid, owner);
                }
              }
            }
            if (sid && !fastPersonByIdRef.current.has(sid)) {
              const person = await domainGetSmart('people', sid);
              if (person) fastPersonByIdRef.current.set(sid, person);
            }
            if (bid && !fastPersonByIdRef.current.has(bid)) {
              const person = await domainGetSmart('people', bid);
              if (person) fastPersonByIdRef.current.set(bid, person);
            }
            changed = true;
          }
        } catch { /* ignore */ }
      }

      if (alive && changed) setFastCacheVersion((v) => v + 1);
    };

    void run();
    return () => {
      alive = false;
    };
  }, [isDesktopFast, commissionsForSelectedMonth]);

  const filteredExternal = useMemo(() => {
    return externalCommissions.filter((c) => {
      const matchMonth = String(c.التاريخ || '').startsWith(selectedMonth);
      const q = searchTerm.toLowerCase();
      const matchSearch = searchTerm
        ? [c.العنوان, c.النوع, c.ملاحظات]
            .some(v => String(v || '').toLowerCase().includes(q))
        : true;
      const matchType = filterType !== 'All' ? c.النوع === filterType : true;
      return matchMonth && matchSearch && matchType;
    });
  }, [externalCommissions, selectedMonth, searchTerm, filterType]);

  const filteredEmployeeRows = useMemo(() => {
    const rows = (employeeReport?.data || []).filter(isRecord) as EmployeeCommissionRow[];
    return rows.filter((r) => {
      const date = asString(r.date);
      // More robust date matching for employee report rows
      let rowMonth = '';
      if (/^\d{4}-\d{2}/.test(date)) rowMonth = date.slice(0, 7);
      else if (/\d{1,2}\/\d{1,2}\/\d{4}/.test(date)) {
        const p = date.split('/');
        rowMonth = `${p[2]}-${p[1].padStart(2, '0')}`;
      }

      const matchMonth = selectedMonth ? rowMonth === selectedMonth : true;
      const rowUser = asTrimmedString(r.employeeUsername);
      const matchEmployee = employeeUserFilter ? rowUser === employeeUserFilter : true;
      const matchSearch = searchTerm
        ? [r.reference, r.property, r.opportunity, r.client, r.ownerName].some((v) =>
            asString(v).toLowerCase().includes(searchTerm.toLowerCase())
          )
        : true;
      const matchType = filterType !== 'All' ? asString(r.type) === filterType : true;
      return matchMonth && matchEmployee && matchSearch && matchType;
    });
  }, [employeeReport, selectedMonth, employeeUserFilter, searchTerm, filterType]);

  const employeePageCount = useMemo(
    () => Math.max(1, Math.ceil((filteredEmployeeRows.length || 0) / listPageSize)),
    [filteredEmployeeRows.length, listPageSize]
  );
  const contractsPageCount = useMemo(
    () => Math.max(1, Math.ceil((filteredCommissions.length || 0) / listPageSize)),
    [filteredCommissions.length, listPageSize]
  );
  const externalPageCount = useMemo(
    () => Math.max(1, Math.ceil((filteredExternal.length || 0) / listPageSize)),
    [filteredExternal.length, listPageSize]
  );

  useEffect(() => {
    setEmployeePage(1);
  }, [selectedMonth, employeeUserFilter, searchTerm, filterType, listPageSize]);

  useEffect(() => {
    setContractsPage(1);
  }, [selectedMonth, contractSearchTerm, listPageSize]);

  useEffect(() => {
    setExternalPage(1);
  }, [selectedMonth, searchTerm, filterType, listPageSize]);

  useEffect(() => {
    setEmployeePage((p) => Math.min(Math.max(1, p), employeePageCount));
  }, [employeePageCount]);

  useEffect(() => {
    setContractsPage((p) => Math.min(Math.max(1, p), contractsPageCount));
  }, [contractsPageCount]);

  useEffect(() => {
    setExternalPage((p) => Math.min(Math.max(1, p), externalPageCount));
  }, [externalPageCount]);

  const visibleEmployeeRows = useMemo(() => {
    const start = (employeePage - 1) * listPageSize;
    return filteredEmployeeRows.slice(start, start + listPageSize);
  }, [filteredEmployeeRows, employeePage, listPageSize]);

  const visibleContractCommissions = useMemo(() => {
    const start = (contractsPage - 1) * listPageSize;
    return filteredCommissions.slice(start, start + listPageSize);
  }, [filteredCommissions, contractsPage, listPageSize]);

  const visibleExternal = useMemo(() => {
    const start = (externalPage - 1) * listPageSize;
    return filteredExternal.slice(start, start + listPageSize);
  }, [filteredExternal, externalPage, listPageSize]);

  // Totals (شهر كامل — بغض النظر عن البحث في القائمة)
  const totalOwner = commissionsForSelectedMonth.reduce((acc, curr) => {
    const isSale = curr.نوع_العمولة === 'Sale';
    return acc + Number((isSale ? curr.عمولة_البائع : curr.عمولة_المالك) || 0);
  }, 0);
  const totalTenant = commissionsForSelectedMonth.reduce((acc, curr) => {
    const isSale = curr.نوع_العمولة === 'Sale';
    return acc + Number((isSale ? curr.عمولة_المشتري : curr.عمولة_المستأجر) || 0);
  }, 0);
  const grandTotalContracts = totalOwner + totalTenant;
  const totalExternal = filteredExternal.reduce((acc, curr) => acc + curr.القيمة, 0);

  const externalMonthTotal = useMemo(() => {
    const month = String(selectedMonth || '').trim();
    if (!month) return 0;
    return externalCommissions
      .filter((c) => String(c.التاريخ || '').startsWith(month))
      .reduce((sum, c) => sum + (Number(c.القيمة) || 0), 0);
  }, [externalCommissions, selectedMonth]);

  const employeeTotals = useMemo(() => {
    const totalOffice = filteredEmployeeRows.reduce(
      (sum, r) => sum + asNumber(r.officeCommission),
      0
    );
    const totalIntro = filteredEmployeeRows.reduce((sum, r) => sum + asNumber(r.intro), 0);
    const totalEmployee = filteredEmployeeRows.reduce(
      (sum, r) => sum + asNumber(r.employeeTotal),
      0
    );
    return { totalOffice, totalIntro, totalEmployee, count: filteredEmployeeRows.length };
  }, [filteredEmployeeRows]);

  const employeeMonthSummary = useMemo(() => {
    const rentBase = filteredEmployeeRows
      .filter((r) => asString(r.type) === 'إيجار')
      .reduce((sum, r) => sum + asNumber(r.employeeBase), 0);
    const saleBase = filteredEmployeeRows
      .filter((r) => asString(r.type) === 'بيع')
      .reduce((sum, r) => sum + asNumber(r.employeeBase), 0);
    const intro = filteredEmployeeRows.reduce((sum, r) => sum + asNumber(r.intro), 0);
    const total = filteredEmployeeRows.reduce((sum, r) => sum + asNumber(r.employeeTotal), 0);
    const external = externalMonthTotal;
    const totalWithExternal = total + external;
    return { rentBase, saleBase, intro, total, external, totalWithExternal };
  }, [filteredEmployeeRows, externalMonthTotal]);

  const contractEmployeeBreakdown = useMemo(() => {
    if (!editingContractComm) return null;

    const isSale = editingContractComm.نوع_العمولة === 'Sale';
    const officeTotal =
      Math.max(0, Number((isSale ? editingContractComm.عمولة_البائع : editingContractComm.عمولة_المالك) || 0)) +
      Math.max(0, Number((isSale ? editingContractComm.عمولة_المشتري : editingContractComm.عمولة_المستأجر) || 0));
    
    let rate = 0;
    let tierId = 'Sale';

    if (isSale) {
      rate = 0.40; // Flat 40% for sales
    } else {
      const monthRentalOfficeTotal = commissionsForSelectedMonth
        .filter(c => c.نوع_العمولة !== 'Sale')
        .reduce((sum, c) => sum + (Number(c.المجموع) || 0), 0);
      const tier = getRentalTier(monthRentalOfficeTotal);
      rate = tier.rate;
      tierId = tier.tierId;
    }

    const baseEarned = officeTotal * rate;
    const introEnabled = !!editingContractComm.يوجد_ادخال_عقار;
    const introEarned = introEnabled ? officeTotal * 0.05 : 0;
    const finalEarned = baseEarned + introEarned;

    return {
      tierId,
      rate,
      officeTotal,
      introEnabled,
      baseEarned,
      introEarned,
      finalEarned,
    };
  }, [editingContractComm, commissionsForSelectedMonth]);

  const handleExportEmployeeCsv = () => {
    if (!employeeReport) {
      toast.warning('تقرير عمولات الموظفين غير متاح حاليًا');
      return;
    }

    if (filteredEmployeeRows.length === 0) {
      toast.warning('لا توجد بيانات لتصديرها ضمن الفلاتر الحالية');
      return;
    }

    const columns = (employeeReport.columns || []).filter((c) =>
      [
        'type',
        'date',
        'reference',
        'employee',
        'property',
        'opportunity',
        'officeCommission',
        'tier',
        'employeeBase',
        'intro',
        'employeeTotal',
      ].includes(c.key)
    );

    const escapeCsvValue = (value: unknown) => {
      if (value === null || value === undefined) return '';
      const str = String(value);
      if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
      return str;
    };

    const headerRow = columns.map((c) => escapeCsvValue(c.header || c.key)).join(',');
    const bodyRows = filteredEmployeeRows
      .map((r) => columns.map((c) => escapeCsvValue(r[c.key])).join(','))
      .join('\n');

    // Add BOM for better Arabic handling in Excel
    const csv = `\ufeff${headerRow}\n${bodyRows}`;
    const safeMonth = String(selectedMonth || '').trim() || 'all';
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `employee_commissions_${safeMonth}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    
    toast.success('تم تصدير CSV');
  };

  /** تصدير Excel: كل الأعمدة الموجودة في بيانات التقرير (مثل اسم المستخدم) + ترويسات التقرير، وورقة ملخص للفلاتر الحالية */
  const handleExportEmployeeXlsx = async () => {
    if (!employeeReport) {
      toast.warning('تقرير عمولات الموظفين غير متاح حاليًا');
      return;
    }
    if (filteredEmployeeRows.length === 0) {
      toast.warning('لا توجد بيانات لتصديرها ضمن الفلاتر الحالية');
      return;
    }

    const colDefs = employeeReport.columns || [];
    const allKeys = new Set<string>();
    for (const r of filteredEmployeeRows) {
      if (isRecord(r)) {
        for (const k of Object.keys(r)) allKeys.add(k);
      }
    }

    const orderedKeys: string[] = [];
    for (const c of colDefs) {
      if (allKeys.has(c.key)) orderedKeys.push(c.key);
    }
    for (const k of [...allKeys].sort((a, b) => a.localeCompare(b, 'ar'))) {
      if (!orderedKeys.includes(k)) orderedKeys.push(k);
    }

    const columns = orderedKeys.map((key) => {
      const fromReport = colDefs.find((c) => c.key === key);
      return { key, header: fromReport?.header || key };
    }) as Array<XlsxColumn<Record<string, unknown>>>;

    const rows: Record<string, unknown>[] = filteredEmployeeRows.map((r) => {
      const o: Record<string, unknown> = {};
      if (isRecord(r)) {
        for (const key of orderedKeys) {
          o[key] = r[key];
        }
      }
      return o;
    });

    const safeMonth = String(selectedMonth || '').trim() || 'all';
    const filename = `employee_commissions_${safeMonth}.xlsx`;

    const summaryRows: unknown[][] = [
      ['البند', 'القيمة'],
      ['الشهر المحاسبي', selectedMonth],
      ['عدد الصفوف المصدّرة', filteredEmployeeRows.length],
      ['تصفية الموظف (اسم المستخدم)', employeeUserFilter || '— (الكل)'],
      ['إجمالي عمولة الموظفين', formatCurrencyJOD(employeeTotals.totalEmployee)],
      ['إجمالي عمولات العمليات (للمكتب)', formatCurrencyJOD(employeeTotals.totalOffice)],
      ['إجمالي إدخال العقار', formatCurrencyJOD(employeeTotals.totalIntro)],
      [],
      [
        'ملاحظة',
        'الورقة الأولى تتضمن جميع الحقول المتاحة في التقرير لكل صف (بما فيها غير الظاهرة في القائمة). البيانات تعكس الفلاتر الحالية.',
      ],
    ];

    try {
      await exportToXlsx('عمولات الموظفين', columns, rows, filename, {
        extraSheets: [{ name: 'ملخص التصدير', rows: summaryRows }],
      });
      toast.success('تم تصدير ملف Excel');
    } catch {
      toast.error('تعذر تصدير ملف Excel');
    }
  };

  /** تصدير عمولات العقود لشهر كامل: كود العقار، المالك، المستأجر، الفرصة، والمبالغ */
  const handleExportContractCommissionsXlsx = async () => {
    if (commissionsForSelectedMonth.length === 0) {
      toast.warning('لا توجد عمولات لهذا الشهر للتصدير');
      return;
    }

    const columns = [
      { key: 'k_type', header: 'النوع' },
      { key: 'k_commission', header: 'رقم العملية' },
      { key: 'k_reference_short', header: 'الرقم (مختصر)' },
      { key: 'k_reference', header: 'رقم العقد / الاتفاقية' },
      { key: 'k_date', header: 'تاريخ العملية' },
      { key: 'k_opportunity', header: 'رقم الفرصة' },
      { key: 'k_property_code', header: 'كود العقار' },
      { key: 'k_p1', header: 'المالك / البائع' },
      { key: 'k_p2', header: 'المستأجر / المشتري' },
      { key: 'k_c1', header: 'عمولة المالك/البائع' },
      { key: 'k_c2', header: 'عمولة المستأجر/المشتري' },
      { key: 'k_total', header: 'المجموع' },
    ] as Array<XlsxColumn<Record<string, unknown>>>;

    const rows: Record<string, unknown>[] = commissionsForSelectedMonth.map((c) => {
      const type = c.نوع_العمولة || 'Rental';
      const isSale = type === 'Sale';
      const ref = isSale ? (c.رقم_الاتفاقية || '') : (c.رقم_العقد || '');
      const prop = getPropCode(c);
      const names = getNames(c);

      return {
        k_type: isSale ? 'بيع' : 'إيجار',
        k_commission: c.رقم_العمولة,
        k_reference_short: formatContractNumberShort(ref),
        k_reference: ref,
        k_date: c.تاريخ_العقد ?? '',
        k_opportunity: c.رقم_الفرصة ?? '',
        k_property_code: prop,
        k_p1: names.p1,
        k_p2: names.p2,
        k_c1: Number((isSale ? c.عمولة_البائع : c.عمولة_المالك) || 0),
        k_c2: Number((isSale ? c.عمولة_المشتري : c.عمولة_المستأجر) || 0),
        k_total: Number(c.المجموع || 0),
      };
    });

    const safeMonth = String(selectedMonth || '').trim() || 'all';
    const filename = `contract_commissions_${safeMonth}.xlsx`;

    const summaryRows: unknown[][] = [
      ['البند', 'القيمة'],
      ['الشهر المحاسبي', selectedMonth],
      ['عدد السجلات', rows.length],
      ['إجمالي عمولة الملاك', formatCurrencyJOD(totalOwner)],
      ['إجمالي عمولة المستأجرين', formatCurrencyJOD(totalTenant)],
      ['الإجمالي', formatCurrencyJOD(grandTotalContracts)],
    ];

    try {
      await exportToXlsx('عمولات العقود', columns, rows, filename, {
        extraSheets: [{ name: 'ملخص', rows: summaryRows }],
      });
      toast.success('تم تصدير عمولات العقود إلى Excel');
    } catch {
      toast.error('تعذر تصدير ملف Excel');
    }
  };

  // Unique External Types for Filter (prefer system lookups so the user can manage them)
  const availableTypes = useMemo(() => {
    try {
      const fromLookups = DbService.getLookupsByCategory('ext_comm_type')
        .map((l) => String(l.label || '').trim())
        .filter(Boolean);
      if (fromLookups.length > 0) {
        return Array.from(new Set(fromLookups)).sort((a, b) => a.localeCompare(b, 'ar'));
      }
    } catch {
      // fall back
    }

    return Array.from(
      new Set(externalCommissions.map((c) => String(c.النوع || '').trim()).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b, 'ar'));
  }, [externalCommissions]);

  return {
    activeTab,
    setActiveTab,
    listPageSize,
    employeePage,
    setEmployeePage,
    contractsPage,
    setContractsPage,
    externalPage,
    setExternalPage,
    commissionsForSelectedMonth,
    filteredCommissions,
    filteredExternal,
    filteredEmployeeRows,
    visibleEmployeeRows,
    visibleContractCommissions,
    visibleExternal,
    employeePageCount,
    contractsPageCount,
    externalPageCount,
    totalOwner,
    totalTenant,
    grandTotalContracts,
    totalExternal,
    employeeTotals,
    employeeMonthSummary,
    selectedMonth,
    setSelectedMonth,
    searchTerm,
    setSearchTerm,
    contractSearchTerm,
    setContractSearchTerm,
    filterType,
    setFilterType,
    systemUsers,
    employeeUserFilter,
    setEmployeeUserFilter,
    isExternalModalOpen,
    externalModalMode,
    newExtComm,
    setNewExtComm,
    editingExternalId,
    isContractModalOpen,
    editingContractComm,
    setEditingContractComm,
    contractEmployeeBreakdown,
    handleAddExternal,
    handleDeleteExternal,
    openAddExternalModal,
    openEditExternalModal,
    closeExternalModal,
    openEditContractModal,
    closeContractModal,
    handleSaveContractEdit,
    handleDeleteContractCommission,
    handlePostponeCommissionCollection,
    handleExportEmployeeCsv,
    handleExportEmployeeXlsx,
    handleExportContractCommissionsXlsx,
    getPropCode,
    getNames,
    availableTypes,
    user,
    loadData,
  };
};
