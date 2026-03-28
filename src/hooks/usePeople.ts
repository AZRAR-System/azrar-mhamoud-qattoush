import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { DbService } from '@/services/mockDb';
import { الأشخاص_tbl, SystemLookup, العقارات_tbl, العقود_tbl, DynamicFormField } from '@/types';
import type { PeoplePickerItem } from '@/types/domain.types';
import { useSmartModal } from '@/context/ModalContext';
import { useToast } from '@/context/ToastContext';
import { useAppDialogs } from '@/hooks/useAppDialogs';
import { useDbSignal } from '@/hooks/useDbSignal';
import { useClampPage } from '@/hooks/useClampPage';
import { useResetPageToZero } from '@/hooks/useResetPageToZero';
import { SearchEngine, FilterRule } from '@/services/searchEngine';
import { isTenancyRelevant } from '@/utils/tenancy';
import { exportToXlsx, readSpreadsheet } from '@/utils/xlsx';
import { buildCompanyLetterheadSheet } from '@/utils/companySheet';
import { domainCountsSmart, peoplePickerSearchPagedSmart } from '@/services/domainQueries';
import { PEOPLE_FAST_PAGE_SIZE, PEOPLE_PAGE_SIZE } from '@/components/people/peopleConstants';
import type { DesktopDbPeopleBridge } from '@/components/people/peopleTypes';

export function usePeople() {
  const { t } = useTranslation();
  const pageSize = PEOPLE_PAGE_SIZE;
  const [people, setPeople] = useState<الأشخاص_tbl[]>([]);
  const [properties, setProperties] = useState<العقارات_tbl[]>([]);
  const [contracts, setContracts] = useState<العقود_tbl[]>([]);

  const desktopDb =
    typeof window !== 'undefined'
      ? (window as unknown as { desktopDb?: DesktopDbPeopleBridge }).desktopDb
      : undefined;
  const isDesktop = typeof window !== 'undefined' && !!desktopDb;
  const isDesktopFast =
    isDesktop && typeof desktopDb?.domainPeoplePickerSearch === 'function';
  const desktopUnsupported = isDesktop && !isDesktopFast;
  const [desktopRows, setDesktopRows] = useState<PeoplePickerItem[]>([]);
  const [desktopTotal, setDesktopTotal] = useState(0);
  const [desktopPage, setDesktopPage] = useState(0);
  const [desktopLoading, setDesktopLoading] = useState(false);
  /** Web: أول تحميل للقوائم من DbService (يُعرض عليه Skeleton) */
  const [listLoading, setListLoading] = useState(true);
  const [deletingPersonId, setDeletingPersonId] = useState<string | null>(null);
  const [desktopCounts, setDesktopCounts] = useState<{
    people: number;
    properties: number;
    contracts: number;
  } | null>(null);

  const warnedUnsupportedRef = useRef(false);

  const [showDynamicColumns, setShowDynamicColumns] = useState(false);
  const [dynamicFields, setDynamicFields] = useState<DynamicFormField[]>([]);

  // Search State
  const [searchTerm, setSearchTerm] = useState('');
  const [activeRoleTab, setActiveRoleTab] = useState<string>('all');
  const [showOnlyIdleOwners, setShowOnlyIdleOwners] = useState(false);
  const [sortMode, setSortMode] = useState<
    'name-asc' | 'name-desc' | 'updated-desc' | 'updated-asc'
  >('name-asc');

  const [uiPage, setUiPage] = useState(0);

  // Advanced Search
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [advFilters, setAdvFilters] = useState({
    address: '',
    nationalId: '',
    classification: 'All',
    minRating: 0,
  });

  const [availableRoles, setAvailableRoles] = useState<SystemLookup[]>([]);

  const { openPanel } = useSmartModal();
  const toast = useToast();
  const dialogs = useAppDialogs();
  const importRef = useRef<HTMLInputElement | null>(null);

  const isArabicText = (text: string) => /[\u0600-\u06FF]/.test(text);
  const tr = (text: string) => (isArabicText(text) ? t(text) : text);

  const hasMessage = (value: unknown): value is { message: string } => {
    if (typeof value !== 'object' || value === null) return false;
    return typeof (value as Record<string, unknown>).message === 'string';
  };

  const getErrorMessage = (error: unknown): string | undefined => {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    if (hasMessage(error)) return error.message;
    return undefined;
  };

  const todayYMD = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const dbSignal = useDbSignal();

  const queryRef = useRef({
    searchTerm,
    activeRoleTab,
    showOnlyIdleOwners,
    sortMode,
    showAdvanced,
    advFilters,
    desktopPage,
  });

  queryRef.current = {
    searchTerm,
    activeRoleTab,
    showOnlyIdleOwners,
    sortMode,
    showAdvanced,
    advFilters,
    desktopPage,
  };

  const loadData = useCallback(async () => {
    const {
      searchTerm: qSearchTerm,
      activeRoleTab: qActiveRoleTab,
      showOnlyIdleOwners: qShowOnlyIdleOwners,
      sortMode: qSortMode,
      showAdvanced: qShowAdvanced,
      advFilters: qAdvFilters,
      desktopPage: qDesktopPage,
    } = queryRef.current;

    if (isDesktopFast) {
      setDesktopLoading(true);
      try {
        const counts = await domainCountsSmart();
        setDesktopCounts(counts);

        setAvailableRoles(DbService.getLookupsByCategory('person_roles') || []);
        try {
          const f = DbService.getFormFields?.('people') || [];
          setDynamicFields(Array.isArray(f) ? f : []);
        } catch {
          setDynamicFields([]);
        }

        const res = await peoplePickerSearchPagedSmart({
          query: String(qSearchTerm || ''),
          role: String(qActiveRoleTab || ''),
          onlyIdleOwners: qActiveRoleTab === 'مالك' ? qShowOnlyIdleOwners : false,
          sort: qSortMode,
          address: qShowAdvanced ? String(qAdvFilters.address || '') : '',
          nationalId: qShowAdvanced ? String(qAdvFilters.nationalId || '') : '',
          classification: qShowAdvanced ? String(qAdvFilters.classification || '') : 'All',
          minRating: qShowAdvanced ? Number(qAdvFilters.minRating || 0) : 0,
          offset: qDesktopPage * PEOPLE_FAST_PAGE_SIZE,
          limit: PEOPLE_FAST_PAGE_SIZE,
        });

        setDesktopRows(Array.isArray(res.items) ? res.items : []);
        setDesktopTotal(Number(res.total || 0) || 0);

        // Keep legacy state empty to avoid heavy render work on Desktop.
        setPeople([]);
        setProperties([]);
        setContracts([]);
      } finally {
        setDesktopLoading(false);
        setListLoading(false);
      }
      return;
    }

    // Desktop focus: never load huge arrays in renderer.
    if (desktopUnsupported) {
      if (!warnedUnsupportedRef.current) {
        warnedUnsupportedRef.current = true;
        toast.warning(t('صفحة الأشخاص تحتاج وضع السرعة/SQL في نسخة الديسكتوب'));
      }
      setDesktopCounts(null);
      setDesktopRows([]);
      setDesktopTotal(0);
      setPeople([]);
      setProperties([]);
      setContracts([]);
      setAvailableRoles(DbService.getLookupsByCategory('person_roles') || []);
      try {
        const f = DbService.getFormFields?.('people') || [];
        setDynamicFields(Array.isArray(f) ? f : []);
      } catch {
        setDynamicFields([]);
      }
      setListLoading(false);
      return;
    }

    setPeople(DbService.getPeople());
    setProperties(DbService.getProperties());
    setContracts(DbService.getContracts());
    setAvailableRoles(DbService.getLookupsByCategory('person_roles') || []);
    try {
      const f = DbService.getFormFields?.('people') || [];
      setDynamicFields(Array.isArray(f) ? f : []);
    } catch {
      setDynamicFields([]);
    }
    setListLoading(false);
  }, [isDesktopFast, desktopUnsupported, t, toast]);

  useEffect(() => {
    void loadData();
  }, [dbSignal, loadData]);

  const getRoles = (id: string) => DbService.getPersonRoles(id);

  const peopleById = useMemo(() => {
    const m = new Map<string, الأشخاص_tbl>();
    for (const p of people) m.set(p.رقم_الشخص, p);
    return m;
  }, [people]);

  const rolePalette = [
    {
      badge:
        'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-300 dark:border-indigo-800',
      avatar: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
    },
    {
      badge:
        'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800',
      avatar: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    },
    {
      badge:
        'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800',
      avatar: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    },
    {
      badge:
        'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-800',
      avatar: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
    },
    {
      badge:
        'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-300 dark:border-rose-800',
      avatar: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
    },
    {
      badge:
        'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-900/20 dark:text-cyan-300 dark:border-cyan-800',
      avatar: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
    },
    {
      badge:
        'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800',
      avatar: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    },
  ] as const;

  const hashRole = (s: string) => {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h;
  };

  const getRoleClasses = (role: string) => {
    // Keep explicit, recognizable colors for common business roles
    if (role === 'مالك') return rolePalette[1];
    if (role === 'مستأجر') return rolePalette[0];
    if (role === 'كفيل') return rolePalette[2];
    if (role === 'مشتري') return rolePalette[3];

    const idx = hashRole(String(role || '')) % rolePalette.length;
    return rolePalette[idx];
  };

  const getPrimaryRole = (roles: string[]) => {
    const priority = ['مالك', 'مستأجر', 'كفيل', 'مشتري'];
    for (const r of priority) if (roles.includes(r)) return r;
    return roles[0] || '';
  };

  const isActiveContract = (c: العقود_tbl) => isTenancyRelevant(c);

  const handleOpenForm = (id?: string) => {
    openPanel('PERSON_FORM', id || 'new', {
      onSuccess: () => setTimeout(() => void loadData(), 500),
    });
  };

  const handleOpenCompanyForm = () => {
    openPanel('PERSON_FORM', 'new', {
      initialType: 'منشأة',
      onSuccess: () => setTimeout(() => void loadData(), 500),
    });
  };

  const handleDelete = async (id: string) => {
    const ok = await toast.confirm({
      title: t('حذف'),
      message: t('هل أنت متأكد من حذف هذا الملف؟'),
      confirmText: t('حذف'),
      cancelText: t('إلغاء'),
      isDangerous: true,
    });
    if (!ok) return;

    const sid = String(id);
    setDeletingPersonId(sid);
    window.setTimeout(() => {
      const res = DbService.deletePerson(sid);
      setDeletingPersonId(null);
      if (res.success) {
        toast.success(res.message);
        void loadData();
      } else {
        toast.error(res.message);
      }
    }, 1000);
  };

  const handleBlacklist = (id: string) => {
    openPanel('BLACKLIST_FORM', id, {
      onSuccess: () => void loadData(),
    });
  };

  const handleQuickReminderForPerson = async (person: الأشخاص_tbl) => {
    const personId = String(person?.رقم_الشخص || '').trim();
    if (!personId) return;

    const personName = String(person?.الاسم || '').trim();
    const defaultTitle = t('متابعة: {{name}}', { name: personName || personId });
    const title = await dialogs.prompt({
      title: t('تذكير / متابعة'),
      message: t('ما هي المتابعة المطلوبة؟'),
      inputType: 'text',
      defaultValue: defaultTitle,
      required: true,
    });
    if (!title) return;

    const dueDate = await dialogs.prompt({
      title: t('تاريخ التذكير'),
      message: t('اختر تاريخ التذكير'),
      inputType: 'date',
      defaultValue: todayYMD,
      required: true,
    });
    if (!dueDate) return;

    const note = await dialogs.prompt({
      title: t('ملاحظة (اختياري)'),
      inputType: 'textarea',
      defaultValue: '',
      placeholder: t('اكتب ملاحظة مختصرة تساعدك عند المتابعة...'),
    });
    if (note === null) return;

    try {
      DbService.addFollowUp({
        task: title,
        clientName: String(person?.الاسم || '').trim() || undefined,
        phone: String(person?.رقم_الهاتف || '').trim() || undefined,
        type: 'Task',
        dueDate,
        priority: 'Medium',
        personId,
        note: String(note || '').trim() || undefined,
      });
    } catch (e: unknown) {
      toast.error(getErrorMessage(e) || t('فشل حفظ التذكير'));
      return;
    }

    dialogs.toast.success(t('تم حفظ التذكير'));
    openPanel('CALENDAR_EVENTS', dueDate, { title: t('مهام اليوم') });
  };

  const handleExport = async () => {
    if (isDesktopFast) {
      if (desktopTotal === 0) return toast.warning(t('لا توجد بيانات للتصدير'));

      const companySheet = buildCompanyLetterheadSheet(DbService.getSettings?.());

      const all: PeoplePickerItem[] = [];
      let offset = 0;
      const limit = 500;
      while (true) {
        const res = await peoplePickerSearchPagedSmart({
          query: String(searchTerm || ''),
          role: String(activeRoleTab || ''),
          onlyIdleOwners: activeRoleTab === 'مالك' ? showOnlyIdleOwners : false,
          sort: sortMode,
          address: showAdvanced ? String(advFilters.address || '') : '',
          nationalId: showAdvanced ? String(advFilters.nationalId || '') : '',
          classification: showAdvanced ? String(advFilters.classification || '') : 'All',
          minRating: showAdvanced ? Number(advFilters.minRating || 0) : 0,
          offset,
          limit,
        });
        const items = Array.isArray(res.items) ? res.items : [];
        if (!items.length) break;
        all.push(...items);
        offset += items.length;
        if (items.length < limit) break;
      }

      const rows = all.map((it) => {
        const p = it.person;
        const roles = Array.isArray(it?.roles) ? it.roles : [];
        return {
          ID: p.رقم_الشخص,
          Name: p.الاسم,
          Phone: p.رقم_الهاتف,
          ExtraPhone: p.رقم_هاتف_اضافي || '',
          NationalID: p.الرقم_الوطني || '',
          Address: p.العنوان || '',
          Role: roles.join(' | '),
        };
      });

      await exportToXlsx(
        'People',
        [
          { key: 'ID', header: 'ID' },
          { key: 'Name', header: 'Name' },
          { key: 'Phone', header: 'Phone' },
          { key: 'ExtraPhone', header: 'ExtraPhone' },
          { key: 'NationalID', header: 'NationalID' },
          { key: 'Address', header: 'Address' },
          { key: 'Role', header: 'Role' },
        ],
        rows,
        `people_export_${new Date().toISOString().slice(0, 10)}.xlsx`,
        {
          extraSheets: companySheet ? [companySheet] : [],
        }
      );

      DbService.logEvent('User', 'Export', 'People', `Exported ${rows.length} records`);
      toast.success(t('تم تصدير البيانات بنجاح'));
      return;
    }

    if (filtered.length === 0) return toast.warning(t('لا توجد بيانات للتصدير'));

    const companySheet = buildCompanyLetterheadSheet(DbService.getSettings?.());

    const rows = filtered.map((p) => ({
      ID: p.رقم_الشخص,
      Name: p.الاسم,
      Phone: p.رقم_الهاتف,
      ExtraPhone: p.رقم_هاتف_اضافي || '',
      NationalID: p.الرقم_الوطني || '',
      Address: p.العنوان || '',
      Role: getRoles(p.رقم_الشخص).join(' | '),
    }));

    await exportToXlsx(
      'People',
      [
        { key: 'ID', header: 'ID' },
        { key: 'Name', header: 'Name' },
        { key: 'Phone', header: 'Phone' },
        { key: 'ExtraPhone', header: 'ExtraPhone' },
        { key: 'NationalID', header: 'NationalID' },
        { key: 'Address', header: 'Address' },
        { key: 'Role', header: 'Role' },
      ],
      rows,
      `people_export_${new Date().toISOString().slice(0, 10)}.xlsx`,
      {
        extraSheets: companySheet ? [companySheet] : [],
      }
    );

    // Log Export
    DbService.logEvent('User', 'Export', 'People', `Exported ${filtered.length} records`);
    toast.success(t('تم تصدير البيانات بنجاح'));
  };

  const handleDownloadTemplate = async () => {
    const companySheet = buildCompanyLetterheadSheet(DbService.getSettings?.());
    await exportToXlsx(
      'People',
      [
        { key: 'Name', header: 'Name' },
        { key: 'Phone', header: 'Phone' },
        { key: 'ExtraPhone', header: 'ExtraPhone' },
        { key: 'NationalID', header: 'NationalID' },
        { key: 'Address', header: 'Address' },
        { key: 'Role', header: 'Role' },
      ],
      [
        {
          Name: t('مثال: أحمد محمد'),
          Phone: '0790000000',
          ExtraPhone: '',
          NationalID: '0123456789',
          Address: t('عمان - ...'),
          // Keep role values in Arabic to avoid importing unknown role labels.
          Role: 'مالك | مستأجر',
        },
      ],
      `people_template.xlsx`,
      {
        extraSheets: companySheet ? [companySheet] : [],
      }
    );
    toast.success(t('تم تنزيل قالب الأشخاص'));
  };

  const handlePickImportFile = () => {
    importRef.current?.click();
  };

  const normalize = (v: unknown) => String(v ?? '').trim();

  const handleImportFile = async (file: File) => {
    const ok = await toast.confirm({
      title: t('استيراد الأشخاص'),
      message: t(
        'سيتم استيراد البيانات وإضافة السجلات الجديدة وتحديث الموجود حسب (الرقم الوطني ثم الهاتف). هل تريد المتابعة؟'
      ),
      confirmText: t('متابعة'),
      cancelText: t('إلغاء'),
    });
    if (!ok) return;

    let rows: Array<Record<string, unknown>> = [];
    try {
      rows = await readSpreadsheet(file);
    } catch (e: unknown) {
      toast.error(getErrorMessage(e) || t('فشل قراءة ملف الاستيراد'));
      return;
    }
    if (!rows.length) {
      toast.warning(t('الملف فارغ'));
      return;
    }

    const pick = (row: Record<string, unknown>, keys: string[]) => {
      for (const k of keys) {
        const v = row[k];
        if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
      }
      return '';
    };

    const existing = DbService.getPeople();
    const byNationalId = new Map<string, الأشخاص_tbl>();
    const byPhone = new Map<string, الأشخاص_tbl>();
    for (const p of existing) {
      const nid = normalize(p.الرقم_الوطني);
      if (nid) byNationalId.set(nid, p);
      const ph = normalize(p.رقم_الهاتف);
      if (ph) byPhone.set(ph, p);
      const ex = normalize(p.رقم_هاتف_اضافي);
      if (ex) byPhone.set(ex, p);
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const row of rows) {
      const name = pick(row, ['Name', 'الاسم']);
      const phone = pick(row, ['Phone', 'رقم_الهاتف', 'الهاتف']);
      const extraPhone = pick(row, [
        'ExtraPhone',
        'رقم_هاتف_اضافي',
        'الهاتف_الاضافي',
        'رقم_هاتف_آخر',
      ]);
      const nationalId = pick(row, ['NationalID', 'الرقم_الوطني']);
      const address = pick(row, ['Address', 'العنوان']);
      const roleRaw = pick(row, ['Role', 'الدور', 'الأدوار']);

      if (!name || !phone) {
        skipped++;
        continue;
      }

      const roles = roleRaw
        ? roleRaw
            .split(/\||,|\/|؛|\n/)
            .map((r) => r.trim())
            .filter(Boolean)
        : [];

      const match = (nationalId && byNationalId.get(nationalId)) || byPhone.get(phone);
      if (match) {
        DbService.updatePerson(match.رقم_الشخص, {
          الاسم: name,
          رقم_الهاتف: phone,
          رقم_هاتف_اضافي: extraPhone || match.رقم_هاتف_اضافي,
          الرقم_الوطني: nationalId || match.الرقم_الوطني,
          العنوان: address || match.العنوان,
        });
        if (roles.length) DbService.updatePersonRoles(match.رقم_الشخص, roles);
        updated++;
      } else {
        const res = DbService.addPerson(
          {
            الاسم: name,
            رقم_الهاتف: phone,
            رقم_هاتف_اضافي: extraPhone || undefined,
            الرقم_الوطني: nationalId || undefined,
            العنوان: address || undefined,
            تقييم: 0,
            تصنيف: 'عادي',
          },
          roles.length ? roles : ['مالك']
        );
        if (res.success) created++;
        else skipped++;
      }
    }

    void loadData();
    toast.success(
      t('تم الاستيراد: إضافة {{created}} • تحديث {{updated}} • تخطي {{skipped}}', {
        created,
        updated,
        skipped,
      })
    );
  };

  const filtered = useMemo(() => {
    // 1. Base Filter (Role & Idle)
    let result = people.filter((p) => {
      if (activeRoleTab === 'blacklisted') {
        return DbService.getPersonBlacklistStatus(p.رقم_الشخص);
      }

      const roles = getRoles(p.رقم_الشخص);
      const matchesRole = activeRoleTab === 'all' || roles.includes(activeRoleTab);
      if (!matchesRole) return false;

      if (activeRoleTab === 'مالك' && showOnlyIdleOwners) {
        const ownerProps = properties.filter((prop) => prop.رقم_المالك === p.رقم_الشخص);
        return !ownerProps.some((prop) => prop.حالة_العقار === 'مؤجر');
      }
      return true;
    });

    // 2. Quick Search
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (p) =>
          (p.الاسم || '').toLowerCase().includes(term) ||
          (p.الرقم_الوطني || '').includes(term) ||
          (p.رقم_الهاتف || '').includes(term) ||
          String(p.رقم_هاتف_اضافي || '').includes(term)
      );
    }

    // 3. Advanced Search (Using Engine)
    if (showAdvanced) {
      const rules: FilterRule[] = [];
      if (advFilters.address)
        rules.push({ field: 'العنوان', operator: 'contains', value: advFilters.address });
      if (advFilters.nationalId)
        rules.push({ field: 'الرقم_الوطني', operator: 'contains', value: advFilters.nationalId });
      if (advFilters.classification !== 'All')
        rules.push({ field: 'تصنيف', operator: 'equals', value: advFilters.classification });
      if (advFilters.minRating > 0)
        rules.push({ field: 'تقييم', operator: 'gte', value: advFilters.minRating });

      result = SearchEngine.applyFilters(result, rules);
    }

    // 4. Sorting
    const sorted = [...result];
    const nameKey = (p: الأشخاص_tbl) => String(p.الاسم || '').trim();
    const idKey = (p: الأشخاص_tbl) => String(p.رقم_الشخص || '').trim();
    const updatedKey = (p: الأشخاص_tbl) => {
      const anyP = p as unknown as Record<string, unknown>;
      return String(anyP['updatedAt'] ?? anyP['تاريخ_التعديل'] ?? '').trim();
    };
    if (sortMode === 'updated-asc') {
      sorted.sort(
        (a, b) => updatedKey(a).localeCompare(updatedKey(b)) || idKey(a).localeCompare(idKey(b))
      );
    } else if (sortMode === 'updated-desc') {
      sorted.sort(
        (a, b) => updatedKey(b).localeCompare(updatedKey(a)) || idKey(b).localeCompare(idKey(a))
      );
    } else if (sortMode === 'name-desc') {
      sorted.sort(
        (a, b) => nameKey(b).localeCompare(nameKey(a)) || idKey(b).localeCompare(idKey(a))
      );
    } else {
      // name-asc
      sorted.sort(
        (a, b) => nameKey(a).localeCompare(nameKey(b)) || idKey(a).localeCompare(idKey(b))
      );
    }

    return sorted;
  }, [
    people,
    searchTerm,
    activeRoleTab,
    showOnlyIdleOwners,
    properties,
    showAdvanced,
    advFilters,
    sortMode,
  ]);

  const desktopPageCount = useMemo(() => {
    if (!isDesktopFast) return 1;
    const total = Number(desktopTotal || 0) || 0;
    if (total > 0) return Math.max(1, Math.ceil(total / PEOPLE_FAST_PAGE_SIZE));

    // Fallback when total isn't available: infer if next page exists.
    const hasMaybeNext =
      Array.isArray(desktopRows) && desktopRows.length === PEOPLE_FAST_PAGE_SIZE;
    return Math.max(1, hasMaybeNext ? desktopPage + 2 : desktopPage + 1);
  }, [desktopPage, desktopRows, desktopTotal, isDesktopFast]);

  const uiPageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const uiRows = useMemo(() => {
    const start = uiPage * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, uiPage, pageSize]);

  useEffect(() => {
    if (!isDesktopFast) return;
    // Reset to first page when filters/search change.
    // IMPORTANT: do NOT depend on `desktopPage` here, otherwise clicking next/prev will immediately reset back to page 0.
    setDesktopPage((prev) => {
      if (prev === 0) {
        void loadData();
        return prev;
      }
      return 0;
    });
  }, [
    searchTerm,
    activeRoleTab,
    showOnlyIdleOwners,
    sortMode,
    showAdvanced,
    advFilters.address,
    advFilters.nationalId,
    advFilters.classification,
    advFilters.minRating,
    isDesktopFast,
    loadData,
  ]);

  useEffect(() => {
    if (!isDesktopFast) return;
    void loadData();
  }, [desktopPage, isDesktopFast, loadData]);

  useClampPage({
    enabled: isDesktopFast,
    page: desktopPage,
    pageCount: desktopPageCount,
    setPage: (n) => setDesktopPage(n),
  });

  useClampPage({
    enabled: !isDesktopFast,
    page: uiPage,
    pageCount: uiPageCount,
    setPage: (n) => setUiPage(n),
  });

  useResetPageToZero(!isDesktopFast, (n) => setUiPage(n), [
    searchTerm,
    activeRoleTab,
    showOnlyIdleOwners,
    sortMode,
    showAdvanced,
    advFilters.address,
    advFilters.nationalId,
    advFilters.classification,
    advFilters.minRating,
    pageSize,
  ]);

  const loading = isDesktopFast ? desktopLoading : listLoading;

  const showEmptyNoPeople = isDesktopFast
    ? (desktopCounts?.people ?? desktopTotal) === 0 &&
      !desktopLoading &&
      !searchTerm.trim() &&
      (activeRoleTab === 'all' || !activeRoleTab)
    : people.length === 0 && !listLoading;
  const showEmptyNoResults =
    !showEmptyNoPeople &&
    (isDesktopFast
      ? !desktopLoading && desktopTotal === 0
      : filtered.length === 0 && !listLoading);
  const listVisible = !showEmptyNoPeople && !showEmptyNoResults;

  return {
    t,
    tr,
    pageSize,
    people,
    properties,
    contracts,
    isDesktop,
    isDesktopFast,
    desktopUnsupported,
    desktopRows,
    desktopTotal,
    desktopPage,
    setDesktopPage,
    desktopLoading,
    loading,
    deletingPersonId,
    desktopCounts,
    uiPage,
    setUiPage,
    importRef,
    showDynamicColumns,
    setShowDynamicColumns,
    dynamicFields,
    searchTerm,
    setSearchTerm,
    activeRoleTab,
    setActiveRoleTab,
    showOnlyIdleOwners,
    setShowOnlyIdleOwners,
    sortMode,
    setSortMode,
    showAdvanced,
    setShowAdvanced,
    advFilters,
    setAdvFilters,
    availableRoles,
    loadData,
    peopleById,
    getRoles,
    getPrimaryRole,
    getRoleClasses,
    isActiveContract,
    filtered,
    desktopPageCount,
    uiPageCount,
    uiRows,
    handleOpenForm,
    handleOpenCompanyForm,
    handleDelete,
    handleBlacklist,
    handleQuickReminderForPerson,
    handleExport,
    handleDownloadTemplate,
    handlePickImportFile,
    handleImportFile,
    openPanel,
    showEmptyNoPeople,
    showEmptyNoResults,
    listVisible,
  };

}

export type PeoplePageModel = ReturnType<typeof usePeople>;
