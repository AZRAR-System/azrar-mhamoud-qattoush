import { useCallback, useEffect, useMemo, useRef, useState, type FC, type FormEvent } from 'react';
import { DbService } from '@/services/mockDb';
import {
  ReportResult,
  العمولات_tbl,
  العقود_tbl,
  العقارات_tbl,
  العمولات_الخارجية_tbl,
  الأشخاص_tbl,
  المستخدمين_tbl,
} from '@/types';
import { runReportSmart } from '@/services/reporting';
import {
  HandCoins,
  Briefcase,
  Filter,
  ArrowUp,
  Plus,
  Globe,
  Tags,
  Trash2,
  Search,
  Pencil,
  CornerDownRight,
  Download,
  FileSpreadsheet,
  Users,
  Inbox,
} from 'lucide-react';
import { useToast } from '@/context/ToastContext';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { DynamicSelect } from '@/components/ui/DynamicSelect';
import { AppModal } from '@/components/ui/AppModal';
import { formatContractNumberShort } from '@/utils/contractNumber';
import { formatCurrencyJOD } from '@/utils/format';
import { useAppDialogs } from '@/hooks/useAppDialogs';
import { useDbSignal } from '@/hooks/useDbSignal';
import { getRentalTier } from '@/utils/employeeCommission';
import { storage } from '@/services/storage';
import { contractDetailsSmart, domainGetSmart } from '@/services/domainQueries';
import { useResponsivePageSize } from '@/hooks/useResponsivePageSize';
import { PaginationControls } from '@/components/shared/PaginationControls';
import { PageHero } from '@/components/shared/PageHero';
import { Input } from '@/components/ui/Input';
import { MoneyInput } from '@/components/ui/MoneyInput';
import { exportToXlsx, type XlsxColumn } from '@/utils/xlsx';

type Tab = 'contracts' | 'external' | 'employee';

type EmployeeCommissionRow = {
  type?: unknown;
  date?: unknown;
  reference?: unknown;
  employee?: unknown;
  employeeUsername?: unknown;
  property?: unknown;
  opportunity?: unknown;
  officeCommission?: unknown;
  tier?: unknown;
  employeeBase?: unknown;
  intro?: unknown;
  employeeTotal?: unknown;
  [key: string]: unknown;
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

export const Commissions: FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('contracts');

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
  const [properties, setProperties] = useState<العقارات_tbl[]>([]);
  const [people, setPeople] = useState<الأشخاص_tbl[]>([]);

  // Desktop-fast: resolve contract/property/people names lazily (avoid renderer loading huge arrays)
  const fastContractByIdRef = useRef<Map<string, العقود_tbl>>(new Map());
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
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [searchTerm, setSearchTerm] = useState('');
  /** بحث داخل تبويب عمولات العقود فقط (لا يؤثر على إجماليات الشهر) */
  const [contractSearchTerm, setContractSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('All');

  const toast = useToast();
  const dialogs = useAppDialogs();
  const dbSignal = useDbSignal();
  const { user } = useAuth();

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
      setProperties([]);
      setPeople([]);
      fastContractByIdRef.current = new Map();
      fastPropertyByIdRef.current = new Map();
      fastPersonByIdRef.current = new Map();
      setFastCacheVersion((v) => v + 1);
    } else {
      setContracts(DbService.getContracts());
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
    loadData();
  }, [activeTab, dbSignal, loadData]);

  useEffect(() => {
    // Keep filters intuitive across tabs
    setSearchTerm('');
    setContractSearchTerm('');
    setFilterType('All');
  }, [activeTab]);

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

    const commOwner = Number(editingContractComm.عمولة_المالك || 0);
    const commTenant = Number(editingContractComm.عمولة_المستأجر || 0);
    if (!Number.isFinite(commOwner) || !Number.isFinite(commTenant)) {
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
      عمولة_المالك: commOwner,
      عمولة_المستأجر: commTenant,
    });

    if (res.success) {
      toast.success('تم تعديل العمولة');
      setIsContractModalOpen(false);
      setEditingContractComm(null);
      loadData();
    } else {
      toast.error(res.message || 'فشل تعديل العمولة');
    }
  };

  const handleDeleteContractCommission = async (c: العمولات_tbl) => {
    const ok = await toast.confirm({
      title: 'حذف',
      message: `هل تريد حذف عمولة العقد #${formatContractNumberShort(c.رقم_العقد)}؟`,
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
    (contractId: string) => {
      const safeId = String(contractId || '').trim();
      if (!safeId) return '—';

      if (isDesktopFast) {
        // Touch fastCacheVersion to make ESLint/TS aware this value is intentionally read.
        void fastCacheVersion;
        const contract = fastContractByIdRef.current.get(safeId);
        const propId = contractPropertyId(contract);
        const prop = propId ? fastPropertyByIdRef.current.get(propId) : null;
        return propertyInternalCode(prop) || '—';
      }

      const contract = contracts.find((c) => idEq(c.رقم_العقد, contractId));
      if (!contract) return '—';
      const prop = properties.find((p) => idEq(p.رقم_العقار, contract.رقم_العقار));
      return prop ? String(prop.الكود_الداخلي || '').trim() || '—' : '—';
    },
    [isDesktopFast, fastCacheVersion, contracts, properties]
  );

  const getOwnerAndTenantNames = useCallback(
    (contractId: string) => {
      const safeId = String(contractId || '').trim();
      if (!safeId) return { ownerName: '—', tenantName: '—' };

      if (isDesktopFast) {
        void fastCacheVersion;
        const contract = fastContractByIdRef.current.get(safeId);
        const tenantId = contractTenantId(contract);
        const propId = contractPropertyId(contract);
        const prop = propId ? fastPropertyByIdRef.current.get(propId) : null;
        const ownerId = propertyOwnerId(prop);

        const tenant = tenantId ? fastPersonByIdRef.current.get(tenantId) : null;
        const owner = ownerId ? fastPersonByIdRef.current.get(ownerId) : null;

        return {
          ownerName: personDisplayName(owner) || '—',
          tenantName: personDisplayName(tenant) || '—',
        };
      }

      const contract = contracts.find((c) => idEq(c.رقم_العقد, contractId));
      if (!contract) return { ownerName: '—', tenantName: '—' };

      const tenant = people.find((p) => idEq(p.رقم_الشخص, contract.رقم_المستاجر));
      const prop = properties.find((p) => idEq(p.رقم_العقار, contract.رقم_العقار));
      const owner = prop
        ? people.find((p) => idEq(p.رقم_الشخص, prop.رقم_المالك))
        : undefined;

      return {
        ownerName: String(owner?.الاسم || '').trim() || '—',
        tenantName: String(tenant?.الاسم || '').trim() || '—',
      };
    },
    [isDesktopFast, fastCacheVersion, contracts, properties, people]
  );

  const handlePostponeCommissionCollection = async (c: العمولات_tbl) => {
    const defaultWho = (() => {
      const prev = String(c.جهة_تحصيل_مؤجل || '').trim();
      if (prev === 'مالك') return 'Owner';
      if (prev === 'مستأجر') return 'Tenant';
      if (Number(c.عمولة_المالك || 0) > 0 && Number(c.عمولة_المستأجر || 0) <= 0) return 'Owner';
      if (Number(c.عمولة_المستأجر || 0) > 0 && Number(c.عمولة_المالك || 0) <= 0) return 'Tenant';
      return 'Owner';
    })();

    const whoRaw = await dialogs.prompt({
      title: 'تأجيل التحصيل',
      message: 'من هو المطلوب تأجيل تحصيل العمولة منه؟',
      inputType: 'select',
      options: [
        { label: 'المالك', value: 'Owner' },
        { label: 'المستأجر', value: 'Tenant' },
      ],
      defaultValue: defaultWho,
      required: true,
    });
    if (whoRaw !== 'Owner' && whoRaw !== 'Tenant') return;
    const who = whoRaw;

    if (who === 'Owner' && Number(c.عمولة_المالك || 0) <= 0) {
      toast.warning('عمولة المالك = 0 (لا يوجد ما يمكن تأجيله)');
      return;
    }
    if (who === 'Tenant' && Number(c.عمولة_المستأجر || 0) <= 0) {
      toast.warning('عمولة المستأجر = 0 (لا يوجد ما يمكن تأجيله)');
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
    const paidMonth = String(c.شهر_دفع_العمولة || '');
    if (/^\d{4}-\d{2}$/.test(paidMonth)) return paidMonth;
    const contractDate = String(c.تاريخ_العقد || '');
    if (/^\d{4}-\d{2}/.test(contractDate)) return contractDate.slice(0, 7);
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
      const prop = getPropCode(c.رقم_العقد);
      const names = getOwnerAndTenantNames(c.رقم_العقد);
      const blob = [
        formatContractNumberShort(c.رقم_العقد),
        String(c.رقم_العقد || ''),
        prop,
        names.ownerName,
        names.tenantName,
        String(c.رقم_الفرصة || ''),
      ]
        .join(' ')
        .toLowerCase();
      return blob.includes(q);
    });
  }, [commissionsForSelectedMonth, contractSearchTerm, getOwnerAndTenantNames, getPropCode]);

  /** سطح المكتب السريع: تحميل العقد ثم العقار والمستأجر والمالك — حتى لو كان العقد في الكاش نُكمل ما فقد سابقاً */
  useEffect(() => {
    if (!isDesktopFast) return;
    let alive = true;

    const run = async () => {
      const ids = Array.from(
        new Set(
          commissionsForSelectedMonth.map((c) => String(c.رقم_العقد || '').trim()).filter(Boolean)
        )
      );

      const limited = ids.slice(0, 250);
      let changed = false;

      const hasContractDetails =
        typeof window !== 'undefined' &&
        typeof window.desktopDb?.domainContractDetails === 'function';

      for (const contractId of limited) {
        if (!alive) return;

        /* المسار المفضّل على الديسكتوب: تفاصيل العقد (عقد + عقار + مستأجر) كما في لوحات النظام */
        if (hasContractDetails) {
          let hydratedWithDetails = false;
          try {
            const details = await contractDetailsSmart(contractId);
            if (details?.contract) {
              hydratedWithDetails = true;
              fastContractByIdRef.current.set(contractId, details.contract);
              changed = true;

              let prop = details.property ?? null;
              const propIdFromContract = contractPropertyId(details.contract);

              if (!prop && propIdFromContract) {
                try {
                  prop = (await domainGetSmart('properties', propIdFromContract)) ?? null;
                } catch {
                  // ignore
                }
              }

              if (prop) {
                const pid = contractPropertyId(prop) || propIdFromContract;
                if (pid) fastPropertyByIdRef.current.set(pid, prop);
              }

              if (details.tenant) {
                const tid = personIdFromRow(details.tenant);
                if (tid) fastPersonByIdRef.current.set(tid, details.tenant);
              } else {
                const tid = contractTenantId(details.contract);
                if (tid && !fastPersonByIdRef.current.has(tid)) {
                  try {
                    const t = await domainGetSmart('people', tid);
                    if (t) {
                      fastPersonByIdRef.current.set(tid, t);
                      changed = true;
                    }
                  } catch {
                    // ignore
                  }
                }
              }

              const pidKey = prop ? contractPropertyId(prop) || propIdFromContract : propIdFromContract;
              const resolvedProp =
                prop || (pidKey ? fastPropertyByIdRef.current.get(pidKey) ?? null : null);
              const ownerId = propertyOwnerId(resolvedProp);
              if (ownerId && !fastPersonByIdRef.current.has(ownerId)) {
                try {
                  const owner = await domainGetSmart('people', ownerId);
                  if (owner) {
                    fastPersonByIdRef.current.set(ownerId, owner);
                    changed = true;
                  }
                } catch {
                  // ignore
                }
              }
            }
          } catch {
            // ننتقل للمسار الاحتياطي
          }
          if (hydratedWithDetails) continue;
        }

        let contract = fastContractByIdRef.current.get(contractId);
        if (!contract) {
          try {
            const fetched = await domainGetSmart('contracts', contractId);
            if (fetched) {
              fastContractByIdRef.current.set(contractId, fetched);
              contract = fetched;
              changed = true;
            }
          } catch {
            // ignore
          }
        }

        if (!contract) continue;

        const propId = contractPropertyId(contract);
        const tenantId = contractTenantId(contract);

        if (propId && !fastPropertyByIdRef.current.has(propId)) {
          try {
            const prop = await domainGetSmart('properties', propId);
            if (prop) {
              fastPropertyByIdRef.current.set(propId, prop);
              changed = true;
            }
          } catch {
            // ignore
          }
        }

        if (tenantId && !fastPersonByIdRef.current.has(tenantId)) {
          try {
            const tenant = await domainGetSmart('people', tenantId);
            if (tenant) {
              fastPersonByIdRef.current.set(tenantId, tenant);
              changed = true;
            }
          } catch {
            // ignore
          }
        }

        const propRow = propId ? fastPropertyByIdRef.current.get(propId) : null;
        const ownerId = propertyOwnerId(propRow);
        if (ownerId && !fastPersonByIdRef.current.has(ownerId)) {
          try {
            const owner = await domainGetSmart('people', ownerId);
            if (owner) {
              fastPersonByIdRef.current.set(ownerId, owner);
              changed = true;
            }
          } catch {
            // ignore
          }
        }
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
      const matchSearch = searchTerm
        ? c.العنوان.toLowerCase().includes(searchTerm.toLowerCase())
        : true;
      const matchType = filterType !== 'All' ? c.النوع === filterType : true;
      return matchMonth && matchSearch && matchType;
    });
  }, [externalCommissions, selectedMonth, searchTerm, filterType]);

  const filteredEmployeeRows = useMemo(() => {
    const rows = (employeeReport?.data || []).filter(isRecord) as EmployeeCommissionRow[];
    return rows.filter((r) => {
      const date = asString(r.date);
      const matchMonth = selectedMonth ? date.slice(0, 7) === selectedMonth : true;
      const rowUser = asTrimmedString(r.employeeUsername);
      const matchEmployee = employeeUserFilter ? rowUser === employeeUserFilter : true;
      const matchSearch = searchTerm
        ? [r.reference, r.property, r.opportunity].some((v) =>
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
  const totalOwner = commissionsForSelectedMonth.reduce((acc, curr) => acc + curr.عمولة_المالك, 0);
  const totalTenant = commissionsForSelectedMonth.reduce(
    (acc, curr) => acc + curr.عمولة_المستأجر,
    0
  );
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

    const officeTotal =
      Math.max(0, Number(editingContractComm.عمولة_المالك || 0)) +
      Math.max(0, Number(editingContractComm.عمولة_المستأجر || 0));
    const monthRentalOfficeTotal = commissionsForSelectedMonth.reduce(
      (sum, c) => sum + (Number(c.المجموع) || 0),
      0
    );
    const tier = getRentalTier(monthRentalOfficeTotal);

    const baseEarned = officeTotal * tier.rate;
    const introEnabled = !!editingContractComm.يوجد_ادخال_عقار;
    const introEarned = introEnabled ? officeTotal * 0.05 : 0;
    const finalEarned = baseEarned + introEarned;

    return {
      tierId: tier.tierId,
      rate: tier.rate,
      officeTotal,
      introEnabled,
      baseEarned,
      introEarned,
      finalEarned,
    };
  }, [editingContractComm, commissionsForSelectedMonth]);

  const escapeCsvValue = (value: unknown) => {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
    return str;
  };

  const downloadTextFile = (filename: string, text: string, mime = 'text/csv;charset=utf-8;') => {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

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

    const headerRow = columns.map((c) => escapeCsvValue(c.header || c.key)).join(',');
    const bodyRows = filteredEmployeeRows
      .map((r) => columns.map((c) => escapeCsvValue(r[c.key])).join(','))
      .join('\n');

    // Add BOM for better Arabic handling in Excel
    const csv = `\ufeff${headerRow}\n${bodyRows}`;
    const safeMonth = String(selectedMonth || '').trim() || 'all';
    downloadTextFile(`employee_commissions_${safeMonth}.csv`, csv);
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
      { key: 'k_commission', header: 'رقم العمولة' },
      { key: 'k_contract_short', header: 'رقم العقد (مختصر)' },
      { key: 'k_contract_id', header: 'رقم العقد' },
      { key: 'k_contract_date', header: 'تاريخ العملية / العقد' },
      { key: 'k_paid_month', header: 'شهر دفع العمولة' },
      { key: 'k_opportunity', header: 'رقم الفرصة' },
      { key: 'k_property_code', header: 'الكود الداخلي للعقار' },
      { key: 'k_owner', header: 'اسم المالك' },
      { key: 'k_tenant', header: 'اسم المستأجر' },
      { key: 'k_owner_comm', header: 'عمولة المالك (د.أ)' },
      { key: 'k_tenant_comm', header: 'عمولة المستأجر (د.أ)' },
      { key: 'k_total', header: 'المجموع (د.أ)' },
    ] as Array<XlsxColumn<Record<string, unknown>>>;

    const rows: Record<string, unknown>[] = commissionsForSelectedMonth.map((c) => {
      const cid = String(c.رقم_العقد || '').trim();
      const names = getOwnerAndTenantNames(cid);
      return {
        k_commission: c.رقم_العمولة,
        k_contract_short: formatContractNumberShort(c.رقم_العقد),
        k_contract_id: cid,
        k_contract_date: c.تاريخ_العقد ?? '',
        k_paid_month: c.شهر_دفع_العمولة ?? '',
        k_opportunity: c.رقم_الفرصة ?? '',
        k_property_code: getPropCode(cid),
        k_owner: names.ownerName,
        k_tenant: names.tenantName,
        k_owner_comm: Number(c.عمولة_المالك || 0),
        k_tenant_comm: Number(c.عمولة_المستأجر || 0),
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

  const inputClass =
    'w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-white rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-indigo-500 transition text-sm';

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header & Tabs — موحّد مع PageHero */}
      <PageHero
        icon={<HandCoins size={26} className="text-indigo-600 dark:text-indigo-400" />}
        iconVariant="inline"
        title="إدارة العمولات والإيرادات"
        subtitle="عمولات العقود، والدخل الخارجي، وتقرير عمولات الموظفين — كلها مرتبطة بالشهر المحاسبي الذي تختاره أعلاه."
        actions={
          <>
            <div
              className="inline-flex items-center gap-1 rounded-2xl border border-slate-200/70 bg-slate-50/80 p-1 dark:border-slate-800 dark:bg-slate-950/40"
              role="tablist"
              aria-label="أقسام صفحة العمولات"
            >
              <Button
                type="button"
                role="tab"
                id="comm-tab-contracts"
                aria-selected={activeTab === 'contracts'}
                size="sm"
                variant={activeTab === 'contracts' ? 'secondary' : 'ghost'}
                onClick={() => setActiveTab('contracts')}
              >
                عمولات العقود
              </Button>
              <Button
                type="button"
                role="tab"
                id="comm-tab-external"
                aria-selected={activeTab === 'external'}
                size="sm"
                variant={activeTab === 'external' ? 'secondary' : 'ghost'}
                onClick={() => setActiveTab('external')}
              >
                عمولات خارجية
              </Button>
              <Button
                type="button"
                role="tab"
                id="comm-tab-employee"
                aria-selected={activeTab === 'employee'}
                size="sm"
                variant={activeTab === 'employee' ? 'secondary' : 'ghost'}
                onClick={() => setActiveTab('employee')}
              >
                عمولات الموظفين
              </Button>
            </div>

            <div className="app-card flex items-center gap-2 px-3 py-2">
              <Filter size={16} className="shrink-0 text-gray-400" aria-hidden />
              <label className="sr-only" htmlFor="commissions-month-filter">
                الشهر المحاسبي
              </label>
              <input
                id="commissions-month-filter"
                type="month"
                className="bg-transparent text-sm font-bold text-slate-700 outline-none dark:text-white"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
              />
            </div>
          </>
        }
      />

      {/* View 3: Employee Commissions */}
      {activeTab === 'employee' && (
        <div
          className="animate-slide-up space-y-6"
          role="tabpanel"
          id="comm-panel-employee"
          aria-labelledby="comm-tab-employee"
        >
          {/* Filter Bar */}
          <div className="app-card p-4 flex flex-col sm:flex-row gap-4 justify-between items-center">
            <div className="flex-1 flex flex-col sm:flex-row gap-3 w-full">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="بحث (المرجع، العقار، رقم الفرصة)..."
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <Search className="absolute right-3 top-2.5 text-gray-400" size={18} />
              </div>

              <div className="min-w-[170px]">
                <select
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm cursor-pointer"
                  value={employeeUserFilter}
                  onChange={(e) => setEmployeeUserFilter(e.target.value)}
                  title="تصفية حسب الموظف"
                >
                  <option value="">كل الموظفين</option>
                  {systemUsers
                    .filter((u) => !!u?.isActive)
                    .map((u) => {
                      const username = asTrimmedString(u?.اسم_المستخدم);
                      const display = asTrimmedString(u?.اسم_للعرض || u?.اسم_المستخدم);
                      return (
                        <option key={username} value={username}>
                          {display || username}
                        </option>
                      );
                    })}
                </select>
              </div>

              <div className="min-w-[150px]">
                <select
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm cursor-pointer"
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                >
                  <option value="All">كل الأنواع</option>
                  <option value="إيجار">إيجار</option>
                  <option value="بيع">بيع</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
                المصدر: تقرير employee_commissions
              </div>
              <Button
                type="button"
                size="sm"
                variant="primary"
                onClick={() => void handleExportEmployeeXlsx()}
              >
                <FileSpreadsheet size={16} aria-hidden /> تصدير Excel
              </Button>
              <Button type="button" size="sm" variant="secondary" onClick={handleExportEmployeeCsv}>
                <Download size={16} aria-hidden /> تصدير CSV
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-800 p-6 text-white shadow-lg shadow-indigo-600/25 ring-1 ring-white/10">
              <div className="relative z-10">
                <p className="mb-1 font-bold text-indigo-100">عدد العمليات</p>
                <h3 className="text-3xl font-bold">
                  {employeeTotals.count.toLocaleString()}{' '}
                  <span className="text-lg opacity-80">عملية</span>
                </h3>
              </div>
              <HandCoins className="absolute -bottom-4 -left-4 text-white opacity-20 w-32 h-32" />
            </div>
            <div className="app-card p-6">
              <p className="text-gray-500 dark:text-gray-400 text-sm font-bold mb-1">
                إجمالي عمولة الموظفين
              </p>
              <h3 className="text-2xl font-bold text-slate-800 dark:text-white">
                {formatCurrencyJOD(employeeTotals.totalEmployee)}
              </h3>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                يشمل إدخال العقار (إن وجد)
              </div>
            </div>
            <div className="app-card p-6">
              <p className="text-gray-500 dark:text-gray-400 text-sm font-bold mb-1">
                إجمالي عمولات العمليات (للمكتب)
              </p>
              <h3 className="text-2xl font-bold text-slate-800 dark:text-white">
                {formatCurrencyJOD(employeeTotals.totalOffice)}
              </h3>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                إدخال العقار: {formatCurrencyJOD(employeeTotals.totalIntro)}
              </div>
            </div>
          </div>

          <div className="app-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="font-bold text-slate-700 dark:text-white">
                ملخص أرباح هذا الشهر ({selectedMonth})
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-400">
                المستخدم المسجل:{' '}
                <b className="text-slate-900 dark:text-white" dir="ltr">
                  {String(user?.اسم_المستخدم || '—')}
                </b>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mt-3">
              <div className="bg-gray-50 dark:bg-slate-900 rounded-xl p-3">
                <div className="text-xs text-slate-500 dark:text-slate-400 font-bold">
                  إيجار (قبل الإدخال)
                </div>
                <div className="text-lg font-bold text-slate-800 dark:text-white">
                  {formatCurrencyJOD(employeeMonthSummary.rentBase)}
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-slate-900 rounded-xl p-3">
                <div className="text-xs text-slate-500 dark:text-slate-400 font-bold">
                  بيع (قبل الإدخال)
                </div>
                <div className="text-lg font-bold text-slate-800 dark:text-white">
                  {formatCurrencyJOD(employeeMonthSummary.saleBase)}
                </div>
              </div>
              <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl p-3">
                <div className="text-xs text-orange-700 dark:text-orange-300 font-bold">
                  إدخال عقار
                </div>
                <div className="text-lg font-bold text-orange-700 dark:text-orange-300">
                  {formatCurrencyJOD(employeeMonthSummary.intro)}
                </div>
              </div>
              <div className="bg-sky-50 dark:bg-sky-900/20 rounded-xl p-3">
                <div className="text-xs text-sky-700 dark:text-sky-300 font-bold">دخل خارجي</div>
                <div className="text-lg font-bold text-sky-700 dark:text-sky-300">
                  {formatCurrencyJOD(employeeMonthSummary.external)}
                </div>
              </div>
              <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-3">
                <div className="text-xs text-emerald-700 dark:text-emerald-300 font-bold">
                  الإجمالي (شامل الدخل الخارجي)
                </div>
                <div className="text-lg font-bold text-emerald-700 dark:text-emerald-300">
                  {formatCurrencyJOD(employeeMonthSummary.totalWithExternal)}
                </div>
              </div>
            </div>
          </div>

          {/* List */}
          <div className="app-card">
            <div className="flex flex-col gap-3 border-b border-gray-100 bg-gray-50 p-4 dark:border-slate-700 dark:bg-slate-800 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-bold text-slate-700 dark:text-white">عمليات عمولة الموظفين</h3>
                <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                  الشهر {selectedMonth}
                  {filteredEmployeeRows.length > 0 ? (
                    <>
                      {' · '}
                      <span className="text-slate-700 dark:text-slate-300">
                        {filteredEmployeeRows.length} عملية
                      </span>
                    </>
                  ) : null}
                </p>
              </div>
              <PaginationControls
                page={employeePage}
                pageCount={employeePageCount}
                onPageChange={setEmployeePage}
              />
            </div>
            <div className="space-y-3 p-4">
              {filteredEmployeeRows.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-6 py-14 text-center dark:border-slate-700 dark:bg-slate-900/40">
                  <Users className="h-12 w-12 text-slate-300 dark:text-slate-600" strokeWidth={1.25} aria-hidden />
                  <p className="max-w-sm text-sm font-bold text-slate-600 dark:text-slate-300">
                    لا توجد عمليات ضمن الفلاتر الحالية
                  </p>
                  <p className="max-w-md text-xs text-slate-500 dark:text-slate-400">
                    جرّب تغيير الشهر، أو تصفية الموظف، أو توسيع نطاق البحث.
                  </p>
                </div>
              ) : (
                visibleEmployeeRows.map((r, idx) => (
                  <div key={`${String(r.reference || '')}-${idx}`} className="app-card p-4">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`font-bold ${String(r.type) === 'بيع' ? 'text-purple-600 dark:text-purple-300' : 'text-emerald-600 dark:text-emerald-300'}`}
                          >
                            {String(r.type || '')}
                          </span>
                          <span className="text-slate-500 dark:text-slate-400 text-sm">
                            | التاريخ:{' '}
                            <b className="text-slate-700 dark:text-slate-200">
                              {String(r.date || '')}
                            </b>
                          </span>
                          <span className="text-slate-500 dark:text-slate-400 text-sm">
                            | العقار:{' '}
                            <b className="text-slate-700 dark:text-slate-200">
                              {String(r.property || '—')}
                            </b>
                          </span>
                        </div>

                        <div className="text-sm text-slate-600 dark:text-slate-400">
                          المرجع:{' '}
                          <b className="text-slate-700 dark:text-slate-200" dir="ltr">
                            {String(r.reference || '—')}
                          </b>
                          <span className="text-slate-500 dark:text-slate-400">
                            {' '}
                            — الشريحة:{' '}
                            <b className="text-slate-700 dark:text-slate-200">
                              {String(r.tier || '—')}
                            </b>
                          </span>
                        </div>

                        <div className="text-sm text-slate-600 dark:text-slate-400">
                          رقم الفرصة:{' '}
                          <b className="text-slate-900 dark:text-white text-lg" dir="ltr">
                            {String(r.opportunity || '—')}
                          </b>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 justify-end">
                        <div className="px-3 py-2 rounded-xl bg-gray-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-sm">
                          عمولة العملية: {formatCurrencyJOD(Number(r.officeCommission || 0))}
                        </div>
                        <div className="px-3 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 font-bold text-sm">
                          قبل الإدخال: {formatCurrencyJOD(Number(r.employeeBase || 0))}
                        </div>
                        <div className="px-3 py-2 rounded-xl bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 font-bold text-sm">
                          إدخال عقار: {formatCurrencyJOD(Number(r.intro || 0))}
                        </div>
                        <div className="px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 font-bold text-sm">
                          الإجمالي: {formatCurrencyJOD(Number(r.employeeTotal || 0))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* View 1: Contract Commissions */}
      {activeTab === 'contracts' && (
        <div className="animate-slide-up space-y-6" role="tabpanel" id="comm-panel-contracts" aria-labelledby="comm-tab-contracts">
          {/* Financial Cards */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 p-6 text-white shadow-lg shadow-emerald-500/25 ring-1 ring-white/10">
              <div className="relative z-10">
                <p className="mb-1 flex items-center gap-2 font-bold text-emerald-100">
                  <ArrowUp size={16} aria-hidden /> إجمالي العمولات
                </p>
                <h3 className="text-3xl font-bold tracking-tight">{formatCurrencyJOD(grandTotalContracts)}</h3>
                <p className="mt-2 text-xs font-medium text-emerald-100/90">مجموع المالك + المستأجر للشهر</p>
              </div>
              <Briefcase className="absolute -bottom-4 -left-4 h-32 w-32 text-white opacity-20" aria-hidden />
            </div>
            <div className="app-card p-6">
              <p className="text-gray-500 dark:text-gray-400 text-sm font-bold mb-1">من الملاك</p>
              <h3 className="text-2xl font-bold text-slate-800 dark:text-white">
                {formatCurrencyJOD(totalOwner)}
              </h3>
              <div className="h-1 w-full bg-gray-100 dark:bg-slate-700 mt-4 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500"
                  style={{
                    width: `${grandTotalContracts > 0 ? (totalOwner / grandTotalContracts) * 100 : 0}%`,
                  }}
                ></div>
              </div>
            </div>
            <div className="app-card p-6">
              <p className="text-gray-500 dark:text-gray-400 text-sm font-bold mb-1">
                من المستأجرين
              </p>
              <h3 className="text-2xl font-bold text-slate-800 dark:text-white">
                {formatCurrencyJOD(totalTenant)}
              </h3>
              <div className="h-1 w-full bg-gray-100 dark:bg-slate-700 mt-4 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-500"
                  style={{
                    width: `${grandTotalContracts > 0 ? (totalTenant / grandTotalContracts) * 100 : 0}%`,
                  }}
                ></div>
              </div>
            </div>
          </div>

          <div className="app-card p-4">
            <div className="relative flex-1">
              <label htmlFor="contracts-comm-search" className="sr-only">
                بحث في عمولات العقود
              </label>
              <input
                id="contracts-comm-search"
                type="search"
                placeholder="بحث: رقم العقد، العقار، المالك، المستأجر، الفرصة..."
                className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pe-4 ps-10 text-sm outline-none transition focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                value={contractSearchTerm}
                onChange={(e) => setContractSearchTerm(e.target.value)}
                autoComplete="off"
              />
              <Search className="pointer-events-none absolute start-3 top-2.5 text-gray-400" size={18} aria-hidden />
            </div>
          </div>

          <div className="app-card">
            <div className="flex flex-col gap-3 border-b border-gray-100 bg-gray-50 p-4 dark:border-slate-700 dark:bg-slate-800 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-bold text-slate-700 dark:text-white">سجل عمولات العقود</h3>
                <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                  الشهر {selectedMonth}
                  {commissionsForSelectedMonth.length > 0 ? (
                    <>
                      {' · '}
                      <span className="text-slate-700 dark:text-slate-300">
                        {filteredCommissions.length} من {commissionsForSelectedMonth.length} سجل
                      </span>
                    </>
                  ) : null}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => void handleExportContractCommissionsXlsx()}
                  title="تصدير كل عمولات الشهر المختار مع العقار والمالك والمستأجر والفرصة"
                >
                  <FileSpreadsheet size={16} aria-hidden /> تصدير Excel
                </Button>
                <PaginationControls
                  page={contractsPage}
                  pageCount={contractsPageCount}
                  onPageChange={setContractsPage}
                />
              </div>
            </div>
            <div className="space-y-3 p-4">
              {commissionsForSelectedMonth.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-6 py-14 text-center dark:border-slate-700 dark:bg-slate-900/40">
                  <Briefcase className="h-12 w-12 text-slate-300 dark:text-slate-600" strokeWidth={1.25} aria-hidden />
                  <p className="max-w-sm text-sm font-bold text-slate-600 dark:text-slate-300">
                    لا توجد عمولات مسجلة لهذا الشهر
                  </p>
                  <p className="max-w-md text-xs text-slate-500 dark:text-slate-400">
                    عند اعتماد عمولة من أدوات ذكية أو من العقد ستظهر هنا ضمن الشهر المحاسبي المختار.
                  </p>
                </div>
              ) : filteredCommissions.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-6 py-12 text-center dark:border-slate-700 dark:bg-slate-900/40">
                  <Inbox className="h-10 w-10 text-slate-300 dark:text-slate-600" strokeWidth={1.25} aria-hidden />
                  <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
                    لا نتائج تطابق البحث الحالي
                  </p>
                  <Button type="button" variant="outline" size="sm" onClick={() => setContractSearchTerm('')}>
                    مسح البحث
                  </Button>
                </div>
              ) : (
                visibleContractCommissions.map((c) => (
                  <div key={c.رقم_العمولة} className="app-card p-4">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-slate-800 dark:text-white">
                            عمولة عقد
                          </span>
                          <span className="text-slate-500 dark:text-slate-400 text-sm font-mono">
                            #{formatContractNumberShort(c.رقم_العقد)}
                          </span>
                          <span className="text-slate-500 dark:text-slate-400 text-sm">
                            | عقار:{' '}
                            <b className="text-slate-700 dark:text-slate-200">
                              {getPropCode(c.رقم_العقد)}
                            </b>
                          </span>
                        </div>
                        <div className="text-sm text-slate-600 dark:text-slate-400">
                          التاريخ:{' '}
                          <b className="text-slate-700 dark:text-slate-200">{c.تاريخ_العقد}</b>
                        </div>

                        <div className="text-sm text-slate-600 dark:text-slate-400">
                          رقم الفرصة:{' '}
                          <b className="text-slate-900 dark:text-white" dir="ltr">
                            {String(c.رقم_الفرصة || '—')}
                          </b>
                        </div>

                        <div className="text-sm font-bold text-orange-500">
                          {(() => {
                            const names = getOwnerAndTenantNames(c.رقم_العقد);
                            return (
                              <span>
                                المالك: {names.ownerName} | المستأجر: {names.tenantName}
                              </span>
                            );
                          })()}
                        </div>

                        {String(c.تاريخ_تحصيل_مؤجل || '').trim() && (
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            تحصيل مؤجل إلى:{' '}
                            <b className="text-slate-700 dark:text-slate-200">
                              {String(c.تاريخ_تحصيل_مؤجل)}
                            </b>
                            {String(c.جهة_تحصيل_مؤجل || '').trim() ? (
                              <span> — ({String(c.جهة_تحصيل_مؤجل)})</span>
                            ) : null}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEditContractModal(c)}
                          className="flex items-center gap-2 rounded-xl bg-gray-100 px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-gray-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                        >
                          <Pencil size={16} aria-hidden /> تعديل
                        </button>

                        <button
                          type="button"
                          onClick={() => void handlePostponeCommissionCollection(c)}
                          className="flex items-center gap-2 rounded-xl bg-indigo-50 px-3 py-2 text-sm font-bold text-indigo-700 transition hover:bg-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-200 dark:hover:bg-indigo-900/30"
                        >
                          <CornerDownRight size={16} aria-hidden /> تأجيل التحصيل
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteContractCommission(c)}
                          className="flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-red-600 transition hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30"
                        >
                          <Trash2 size={16} aria-hidden /> حذف
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
                      <div className="bg-gray-50 dark:bg-slate-800 rounded-xl p-3">
                        <div className="text-xs text-slate-500 dark:text-slate-400 font-bold">
                          عمولة المالك
                        </div>
                        <div className="text-lg font-bold text-slate-800 dark:text-white">
                          {formatCurrencyJOD(Number(c.عمولة_المالك || 0))}
                        </div>
                      </div>
                      <div className="bg-gray-50 dark:bg-slate-800 rounded-xl p-3">
                        <div className="text-xs text-slate-500 dark:text-slate-400 font-bold">
                          عمولة المستأجر
                        </div>
                        <div className="text-lg font-bold text-slate-800 dark:text-white">
                          {formatCurrencyJOD(Number(c.عمولة_المستأجر || 0))}
                        </div>
                      </div>
                      <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-3">
                        <div className="text-xs text-emerald-700 dark:text-emerald-300 font-bold">
                          المجموع
                        </div>
                        <div className="text-lg font-bold text-emerald-700 dark:text-emerald-300">
                          {formatCurrencyJOD(Number(c.المجموع || 0))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* View 2: External Commissions */}
      {activeTab === 'external' && (
        <div
          className="animate-slide-up space-y-6"
          role="tabpanel"
          id="comm-panel-external"
          aria-labelledby="comm-tab-external"
        >
          {/* Advanced Filter Bar */}
          <div className="app-card p-4 flex flex-col md:flex-row gap-4 justify-between items-center">
            <div className="flex-1 flex gap-3 w-full">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="بحث في العنوان..."
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <Search className="absolute right-3 top-2.5 text-gray-400" size={18} />
              </div>

              <div className="min-w-[150px]">
                <select
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm cursor-pointer"
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                >
                  <option value="All">كل الأنواع</option>
                  {availableTypes.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <Button
              type="button"
              variant="primary"
              className="w-full justify-center md:w-auto"
              onClick={openAddExternalModal}
            >
              <Plus size={18} /> عمولة جديدة
            </Button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="relative flex flex-col justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-800 p-6 text-white shadow-lg shadow-indigo-600/25 ring-1 ring-white/10">
              <div className="relative z-10">
                <p className="mb-1 flex items-center gap-2 font-bold text-indigo-100">
                  <Globe size={16} aria-hidden /> مجموع العمولات الخارجية (المفلترة)
                </p>
                <h3 className="text-3xl font-bold tracking-tight">{formatCurrencyJOD(totalExternal)}</h3>
              </div>
              <Globe className="absolute -bottom-4 -left-4 h-32 w-32 text-white opacity-20" aria-hidden />
            </div>
            <div className="app-card p-6 flex flex-col justify-center">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-orange-100 dark:bg-orange-900/30 text-orange-600 rounded-xl">
                  <Tags size={24} />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 font-bold">
                    عدد العمليات (المفلترة)
                  </p>
                  <h3 className="text-2xl font-bold text-slate-800 dark:text-white">
                    {filteredExternal.length} عملية
                  </h3>
                </div>
              </div>
            </div>
          </div>

          {/* External Commissions List (Cards) */}
          <div className="app-card">
            <div className="flex flex-col gap-3 border-b border-gray-100 bg-gray-50 p-4 dark:border-slate-700 dark:bg-slate-800 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-bold text-slate-700 dark:text-white">سجل العمولات الخارجية</h3>
                <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                  {filteredExternal.length > 0 ? (
                    <span className="text-slate-700 dark:text-slate-300">
                      {filteredExternal.length} سجل ضمن الفلاتر
                    </span>
                  ) : (
                    'لا توجد نتائج ضمن الفلاتر'
                  )}
                </p>
              </div>
              <PaginationControls
                page={externalPage}
                pageCount={externalPageCount}
                onPageChange={setExternalPage}
              />
            </div>
            <div className="space-y-3 p-4">
              {filteredExternal.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-6 py-14 text-center dark:border-slate-700 dark:bg-slate-900/40">
                  <Globe className="h-12 w-12 text-slate-300 dark:text-slate-600" strokeWidth={1.25} aria-hidden />
                  <p className="max-w-sm text-sm font-bold text-slate-600 dark:text-slate-300">
                    لا توجد عمولات خارجية تطابق الشهر أو الفلاتر
                  </p>
                  <p className="max-w-md text-xs text-slate-500 dark:text-slate-400">
                    أضف عمولة خارجية جديدة أو غيّر شهر العرض أو نوع الدخل.
                  </p>
                  <Button type="button" variant="primary" size="sm" onClick={openAddExternalModal}>
                    <Plus size={16} /> إضافة عمولة
                  </Button>
                </div>
              ) : (
                visibleExternal.map((c) => (
                  <div key={c.id} className="app-card p-4">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-slate-800 dark:text-white">
                            {c.العنوان}
                          </span>
                          <span className="text-slate-500 dark:text-slate-400 text-sm">
                            | {c.النوع}
                          </span>
                        </div>
                        <div className="text-sm text-slate-600 dark:text-slate-400">
                          التاريخ: <b className="text-slate-700 dark:text-slate-200">{c.التاريخ}</b>
                        </div>
                        <div className="text-sm text-slate-600 dark:text-slate-400">
                          ملاحظات:{' '}
                          <span className="text-slate-700 dark:text-slate-200">
                            {c.ملاحظات || '-'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 justify-end">
                        <div className="px-3 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 font-bold text-sm">
                          {formatCurrencyJOD(Number(c.القيمة || 0))}
                        </div>
                        <button
                          onClick={() => openEditExternalModal(c)}
                          className="px-3 py-2 rounded-xl bg-gray-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-gray-200 dark:hover:bg-slate-700 transition text-sm font-bold flex items-center gap-2"
                        >
                          <Pencil size={16} /> تعديل
                        </button>
                        <button
                          onClick={() => handleDeleteExternal(c.id)}
                          className="px-3 py-2 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 transition text-sm font-bold flex items-center gap-2"
                        >
                          <Trash2 size={16} /> حذف
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* External Modal (Add/Edit) */}
          {isExternalModalOpen && (
            <AppModal
              open={isExternalModalOpen}
              title={
                externalModalMode === 'add' ? (
                  <>
                    <Plus size={20} /> إضافة عمولة خارجية
                  </>
                ) : (
                  <>
                    <Pencil size={20} /> تعديل عمولة خارجية
                  </>
                )
              }
              onClose={closeExternalModal}
              size="lg"
              footer={
                <div className="flex gap-3">
                  <button
                    type="submit"
                    form="external-commission-form"
                    className="flex-1 bg-indigo-600 text-white py-2.5 rounded-lg hover:bg-indigo-700 font-bold transition"
                  >
                    {externalModalMode === 'add' ? 'حفظ' : 'حفظ التعديل'}
                  </button>
                  <button
                    type="button"
                    onClick={closeExternalModal}
                    className="flex-1 bg-gray-200 dark:bg-slate-700 text-slate-800 dark:text-white py-2.5 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-600 font-bold transition"
                  >
                    إلغاء
                  </button>
                </div>
              }
            >
              <form
                id="external-commission-form"
                onSubmit={handleAddExternal}
                className="space-y-4"
              >
                <Input
                  type="date"
                  className={inputClass}
                  value={newExtComm.التاريخ || ''}
                  onChange={(e) => setNewExtComm({ ...newExtComm, التاريخ: e.target.value })}
                />
                <input
                  type="text"
                  placeholder="العنوان"
                  className={inputClass}
                  value={newExtComm.العنوان || ''}
                  onChange={(e) => setNewExtComm({ ...newExtComm, العنوان: e.target.value })}
                />
                <DynamicSelect
                  label="نوع الدخل الخارجي"
                  category="ext_comm_type"
                  value={newExtComm.النوع || ''}
                  onChange={(val) => setNewExtComm((prev) => ({ ...prev, النوع: val }))}
                  placeholder="اختر نوع الدخل..."
                  required
                />
                <MoneyInput
                  placeholder="القيمة"
                  className={inputClass}
                  value={typeof newExtComm.القيمة === 'number' ? newExtComm.القيمة : undefined}
                  onValueChange={(v) => setNewExtComm({ ...newExtComm, القيمة: v })}
                />
                <textarea
                  placeholder="ملاحظات (اختياري)"
                  className={`${inputClass} resize-none`}
                  rows={3}
                  value={newExtComm.ملاحظات || ''}
                  onChange={(e) => setNewExtComm({ ...newExtComm, ملاحظات: e.target.value })}
                />
              </form>
            </AppModal>
          )}
        </div>
      )}

      {/* Contract Commission Modal (Edit) */}
      {isContractModalOpen && editingContractComm && (
        <AppModal
          open={isContractModalOpen}
          title={
            <>
              <Pencil size={20} /> تعديل عمولة العقد
            </>
          }
          onClose={closeContractModal}
          size="lg"
          footer={
            <div className="flex gap-3">
              <button
                type="submit"
                form="contract-commission-form"
                className="flex-1 bg-indigo-600 text-white py-2.5 rounded-lg hover:bg-indigo-700 font-bold transition"
              >
                حفظ التعديل
              </button>
              <button
                type="button"
                onClick={closeContractModal}
                className="flex-1 bg-gray-200 dark:bg-slate-700 text-slate-800 dark:text-white py-2.5 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-600 font-bold transition"
              >
                إلغاء
              </button>
            </div>
          }
        >
          <form
            id="contract-commission-form"
            onSubmit={handleSaveContractEdit}
            className="space-y-4"
          >
            <div className="text-sm text-slate-600 dark:text-slate-400">
              العقد:{' '}
              <b className="font-mono text-slate-800 dark:text-white" dir="ltr">
                #{formatContractNumberShort(String(editingContractComm.رقم_العقد || ''))}
              </b>
            </div>
            <Input
              type="date"
              className={inputClass}
              value={asString(editingContractComm.تاريخ_العقد) || ''}
              onChange={(e) =>
                setEditingContractComm({ ...editingContractComm, تاريخ_العقد: e.target.value })
              }
            />

            <select
              className={inputClass}
              value={asString(editingContractComm.اسم_المستخدم) || ''}
              onChange={(e) =>
                setEditingContractComm({ ...editingContractComm, اسم_المستخدم: e.target.value })
              }
              title="الموظف المسؤول عن هذه العمولة"
            >
              <option value="">(بدون تحديد موظف)</option>
              {systemUsers
                .filter((u) => !!u?.isActive)
                .map((u) => {
                  const username = asTrimmedString(u?.اسم_المستخدم);
                  const display = asTrimmedString(u?.اسم_للعرض || u?.اسم_المستخدم);
                  return (
                    <option key={username} value={username}>
                      {display || username}
                    </option>
                  );
                })}
            </select>

            <input
              type="text"
              placeholder="رقم الفرصة (اختياري)"
              className={inputClass}
              value={asString(editingContractComm.رقم_الفرصة) || ''}
              onChange={(e) =>
                setEditingContractComm({ ...editingContractComm, رقم_الفرصة: e.target.value })
              }
            />

            <label className="flex items-center justify-between gap-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2">
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                يوجد إدخال عقار
              </span>
              <input
                type="checkbox"
                checked={!!editingContractComm.يوجد_ادخال_عقار}
                onChange={(e) =>
                  setEditingContractComm({
                    ...editingContractComm,
                    يوجد_ادخال_عقار: e.target.checked,
                  })
                }
              />
            </label>

            <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl p-3">
              <div className="text-xs text-orange-700 dark:text-orange-300 font-bold">
                عمولة إدخال عقار (5%) — محسوبة تلقائياً
              </div>
              <div className="text-lg font-bold text-orange-700 dark:text-orange-300 mt-1">
                {formatCurrencyJOD(contractEmployeeBreakdown?.introEarned || 0)}
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-300 mt-1" dir="rtl">
                المعادلة: {formatCurrencyJOD(contractEmployeeBreakdown?.officeTotal || 0)} × 5% ={' '}
                {formatCurrencyJOD(contractEmployeeBreakdown?.introEarned || 0)}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                الشريحة (حسب إجمالي الإيجار لهذا الشهر):{' '}
                {String(contractEmployeeBreakdown?.tierId || '—')} — قبل الإدخال:{' '}
                {formatCurrencyJOD(contractEmployeeBreakdown?.baseEarned || 0)} — الإجمالي:{' '}
                {formatCurrencyJOD(contractEmployeeBreakdown?.finalEarned || 0)}
              </div>
            </div>
            <MoneyInput
              placeholder="عمولة المالك"
              className={inputClass}
              value={
                typeof editingContractComm.عمولة_المالك === 'number'
                  ? editingContractComm.عمولة_المالك
                  : Number(editingContractComm.عمولة_المالك ?? 0)
              }
              onValueChange={(v) =>
                setEditingContractComm({ ...editingContractComm, عمولة_المالك: v ?? 0 })
              }
            />
            <MoneyInput
              placeholder="عمولة المستأجر"
              className={inputClass}
              value={
                typeof editingContractComm.عمولة_المستأجر === 'number'
                  ? editingContractComm.عمولة_المستأجر
                  : Number(editingContractComm.عمولة_المستأجر ?? 0)
              }
              onValueChange={(v) =>
                setEditingContractComm({ ...editingContractComm, عمولة_المستأجر: v ?? 0 })
              }
            />
          </form>
        </AppModal>
      )}
    </div>
  );
};
