/**
 * © 2025 - Developed by Mahmoud Qattoush
 * AZRAR Real Estate Management System - All Rights Reserved
 *
 * صفحة إدارة الأشخاص (People Management Page)
 * - عرض وإدارة جميع الأشخاص (مالكين، مستأجرين، كفلاء)
 * - البحث والفلترة المتقدمة
 * - إدارة القائمة السوداء
 * - التكامل الكامل مع DbService فقط (لا اعتماد عكسي)
 *
 * 📊 مصدر البيانات:
 * - DbService.getPeople() - جلب جميع الأشخاص
 * - DbService.getProperties() - للتحقق من حالة العقارات
 * - DbService.getLookupsByCategory('person_roles') - الأدوار المتاحة
 *
 * 🎯 متى يظهر EmptyState:
 * - عند عدم وجود أشخاص في النظام (people.length === 0)
 * - عند عدم وجود نتائج بحث (filtered.length === 0 && searchTerm)
 * - عند عدم وجود نتائج فلترة (filtered.length === 0 && activeRoleTab !== 'all')
 *
 * ⚠️ DataGuard:
 * - غير مستخدم في هذه الصفحة (لا توجد بيانات مطلوبة مسبقاً)
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { DbService } from '@/services/mockDb';
import { openWhatsAppForPhones } from '@/utils/whatsapp';
import { الأشخاص_tbl, SystemLookup, العقارات_tbl, العقود_tbl, DynamicFormField } from '@/types';
import type { PeoplePickerItem } from '@/types/domain.types';
import {
  Plus,
  Trash2,
  Edit2,
  Phone,
  Users,
  Eye,
  Filter,
  Ban,
  ShieldAlert,
  ArrowRight,
  Download,
  SlidersHorizontal,
  ListTodo,
} from 'lucide-react';
import { useSmartModal } from '@/context/ModalContext';
import { useToast } from '@/context/ToastContext';
import { useAppDialogs } from '@/hooks/useAppDialogs';
import { useDbSignal } from '@/hooks/useDbSignal';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { RBACGuard } from '@/components/shared/RBACGuard';
import { EmptyState } from '@/components/shared/EmptyState';
import { SmartFilterBar } from '@/components/shared/SmartFilterBar';
import { SearchEngine, FilterRule } from '@/services/searchEngine';
import { formatContractNumberShort } from '@/utils/contractNumber';
import { getPersonColorClasses, getPersonSeedFromPerson } from '@/utils/personColor';
import { isTenancyRelevant } from '@/utils/tenancy';
import { formatDynamicValue, isEmptyDynamicValue } from '@/components/dynamic/dynamicValue';
import { exportToXlsx, readSpreadsheet } from '@/utils/xlsx';
import { buildCompanyLetterheadSheet } from '@/utils/companySheet';
import { domainCountsSmart, peoplePickerSearchPagedSmart } from '@/services/domainQueries';
import { SegmentedTabs } from '@/components/shared/SegmentedTabs';

export const People: React.FC = () => {
  const { t } = useTranslation();
  const pageSize = 9;
  // Desktop fast paging uses a stable SQL page size (do not tie to responsive UI sizing).
  const DESKTOP_FAST_PAGE_SIZE = 9;
  const [people, setPeople] = useState<الأشخاص_tbl[]>([]);
  const [properties, setProperties] = useState<العقارات_tbl[]>([]);
  const [contracts, setContracts] = useState<العقود_tbl[]>([]);

  const desktopDb =
    typeof window !== 'undefined'
      ? (window as unknown as { desktopDb?: unknown }).desktopDb
      : undefined;
  const isDesktop = typeof window !== 'undefined' && !!desktopDb;
  const isDesktopFast =
    isDesktop &&
    typeof (desktopDb as { domainPeoplePickerSearch?: unknown } | undefined)
      ?.domainPeoplePickerSearch === 'function';
  const desktopUnsupported = isDesktop && !isDesktopFast;
  const [desktopRows, setDesktopRows] = useState<PeoplePickerItem[]>([]);
  const [desktopTotal, setDesktopTotal] = useState(0);
  const [desktopPage, setDesktopPage] = useState(0);
  const [desktopLoading, setDesktopLoading] = useState(false);
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
          offset: qDesktopPage * DESKTOP_FAST_PAGE_SIZE,
          limit: DESKTOP_FAST_PAGE_SIZE,
        });

        setDesktopRows(Array.isArray(res.items) ? res.items : []);
        setDesktopTotal(Number(res.total || 0) || 0);

        // Keep legacy state empty to avoid heavy render work on Desktop.
        setPeople([]);
        setProperties([]);
        setContracts([]);
      } finally {
        setDesktopLoading(false);
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

    const res = DbService.deletePerson(id);
    if (res.success) {
      toast.success(res.message);
      void loadData();
    } else {
      toast.error(res.message);
    }
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
    if (total > 0) return Math.max(1, Math.ceil(total / DESKTOP_FAST_PAGE_SIZE));

    // Fallback when total isn't available: infer if next page exists.
    const hasMaybeNext =
      Array.isArray(desktopRows) && desktopRows.length === DESKTOP_FAST_PAGE_SIZE;
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

  useEffect(() => {
    if (!isDesktopFast) return;
    const maxPage = Math.max(0, desktopPageCount - 1);
    if (desktopPage > maxPage) setDesktopPage(maxPage);
  }, [desktopPage, desktopPageCount, isDesktopFast]);

  useEffect(() => {
    if (isDesktopFast) return;
    const maxPage = Math.max(0, uiPageCount - 1);
    if (uiPage > maxPage) setUiPage(maxPage);
  }, [isDesktopFast, uiPage, uiPageCount]);

  useEffect(() => {
    if (isDesktopFast) return;
    setUiPage(0);
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
    pageSize,
    isDesktopFast,
  ]);

  const renderCard = (person: الأشخاص_tbl) => {
    const roles = getRoles(person.رقم_الشخص);
    const isBlacklisted = DbService.getPersonBlacklistStatus(person.رقم_الشخص);
    const primaryRole = getPrimaryRole(roles);
    const accent = getRoleClasses(primaryRole);
    const personColor = getPersonColorClasses(getPersonSeedFromPerson(person));

    const roleVisual = (() => {
      if (isBlacklisted) {
        return { stripe: 'bg-red-500/25 dark:bg-red-400/20', dot: 'bg-red-500' };
      }
      if (primaryRole === 'مالك') {
        return { stripe: 'bg-emerald-500/20 dark:bg-emerald-400/15', dot: 'bg-emerald-500' };
      }
      if (primaryRole === 'مستأجر') {
        return { stripe: 'bg-indigo-500/20 dark:bg-indigo-400/15', dot: 'bg-indigo-500' };
      }
      if (primaryRole === 'كفيل') {
        return { stripe: 'bg-amber-500/20 dark:bg-amber-400/15', dot: 'bg-amber-500' };
      }
      return { stripe: personColor.stripe, dot: personColor.dot };
    })();

    const roleRing =
      primaryRole === 'مالك'
        ? 'ring-2 ring-emerald-500/10 border-emerald-500/20'
        : primaryRole === 'مستأجر'
          ? 'ring-2 ring-indigo-500/10 border-indigo-500/20'
          : primaryRole === 'كفيل'
            ? 'ring-2 ring-amber-500/10 border-amber-500/20'
            : '';

    // Contract linkage summary (tenant / guarantor / owner)
    const tenantContract = contracts
      .filter((c) => isActiveContract(c) && c.رقم_المستاجر === person.رقم_الشخص)
      .sort((a, b) =>
        String(b.تاريخ_البداية || '').localeCompare(String(a.تاريخ_البداية || ''))
      )[0];
    const guarantorContract = contracts
      .filter((c) => isActiveContract(c) && c.رقم_الكفيل === person.رقم_الشخص)
      .sort((a, b) =>
        String(b.تاريخ_البداية || '').localeCompare(String(a.تاريخ_البداية || ''))
      )[0];

    const ownerPropertyIds = new Set(
      properties.filter((p) => p.رقم_المالك === person.رقم_الشخص).map((p) => p.رقم_العقار)
    );
    const ownerContract = contracts
      .filter((c) => isActiveContract(c) && ownerPropertyIds.has(c.رقم_العقار))
      .sort((a, b) =>
        String(b.تاريخ_البداية || '').localeCompare(String(a.تاريخ_البداية || ''))
      )[0];

    const pick = tenantContract || guarantorContract || ownerContract;
    const linkedProperty = pick
      ? properties.find((p) => p.رقم_العقار === pick.رقم_العقار)
      : undefined;
    const tenantName = pick?.رقم_المستاجر
      ? peopleById.get(pick.رقم_المستاجر)?.الاسم || t('غير معروف')
      : '';
    const guarantorName = pick?.رقم_الكفيل
      ? peopleById.get(pick.رقم_الكفيل)?.الاسم || t('غير معروف')
      : '';

    const isLinkedToContract = Boolean(pick);
    const contractBoxClass = isLinkedToContract
      ? 'border-indigo-200 dark:border-indigo-500/30 bg-indigo-50 dark:bg-indigo-900/20'
      : 'border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/40';
    const contractTitleClass = isLinkedToContract
      ? 'text-indigo-700 dark:text-indigo-200'
      : 'text-slate-700 dark:text-slate-200';

    return (
      <Card
        key={person.رقم_الشخص}
        className={`group w-full animate-slide-up ${roleRing} ${isBlacklisted ? 'ring-2 ring-red-500/20 border-red-500/30' : ''}`}
      >
        <div
          className={`h-1 w-full ${roleVisual.stripe}`}
        ></div>
        <div className="p-5 flex flex-col h-full">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-bold shadow-inner ${isBlacklisted ? 'bg-red-100 text-red-600' : accent.avatar}`}
              >
                {(person.الاسم || 'غ').charAt(0)}
              </div>
              <div className="min-w-0">
                <div className="rounded-xl border border-slate-200/60 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/20 px-3 py-2">
                  <div className="flex items-start gap-2 min-w-0">
                    <span
                      className={`inline-block w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0 ${roleVisual.dot}`}
                    ></span>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-slate-900 dark:text-white leading-snug whitespace-normal break-words">
                        {person.الاسم || t('غير محدد')}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400">
                        {person.نوع_الملف === 'منشأة' ? (
                          <span className="px-2 py-0.5 rounded-lg border bg-gray-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-gray-200 dark:border-slate-700">
                            {t('منشأة')}
                          </span>
                        ) : null}
                        {isBlacklisted ? (
                          <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-300">
                            <ShieldAlert size={14} /> {t('قائمة سوداء')}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 font-mono dir-ltr flex flex-wrap items-center gap-2">
                    <span>{person.رقم_الهاتف || t('لا يوجد')}</span>
                    {person.رقم_هاتف_اضافي ? (
                      <>
                        <span>•</span>
                        <span>{String(person.رقم_هاتف_اضافي)}</span>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
            {person.تصنيف && <StatusBadge status={person.تصنيف} />}
          </div>

          <div className="flex flex-wrap gap-1.5 mb-3 flex-1 content-start">
            {roles.map((r) => (
              <span
                key={r}
                className={`text-[10px] px-2.5 py-1 rounded-lg border font-medium ${getRoleClasses(r).badge}`}
              >
                {tr(r)}
              </span>
            ))}
          </div>

          <div className={`mb-4 rounded-xl border p-3 ${contractBoxClass}`}>
            {pick ? (
              <div className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                <div className={`font-bold ${contractTitleClass}`}>{t('مرتبط بعقد')}</div>
                <div>
                  {t('رقم العقد:')}{' '}
                  <span className="font-mono">
                    #{formatContractNumberShort(pick.رقم_العقد)}
                  </span>
                  {linkedProperty?.الكود_الداخلي ? (
                    <>
                      {' '}
                      • {t('الكود الداخلي:')}{' '}
                      <span className="font-mono">{linkedProperty.الكود_الداخلي}</span>
                    </>
                  ) : null}
                </div>
                {ownerContract || guarantorContract ? (
                  <div>
                    {t('المستأجر:')} <span className="font-semibold">{tenantName}</span>
                    {guarantorName ? (
                      <>
                        {' '}
                        • {t('الكفيل:')} <span className="font-semibold">{guarantorName}</span>
                      </>
                    ) : null}
                  </div>
                ) : tenantContract ? (
                  <div>
                    {guarantorName ? (
                      <>
                        {t('الكفيل:')} <span className="font-semibold">{guarantorName}</span>
                      </>
                    ) : (
                      t('الكفيل: —')
                    )}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {t('غير مرتبط بعقد حالياً')}
              </div>
            )}
          </div>

          {showDynamicColumns && dynamicFields.length > 0
            ? (() => {
                const values = person.حقول_ديناميكية || {};
                const visible = dynamicFields
                  .map((f) => ({ f, v: values?.[f.name] }))
                  .filter(({ v }) => !isEmptyDynamicValue(v));

                if (!visible.length) return null;

                return (
                  <div className="mb-4 rounded-xl border border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-900 p-3">
                    <div className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-2">
                      {t('حقول إضافية')}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {visible.map(({ f, v }) => (
                        <div key={f.id} className="text-xs text-slate-600 dark:text-slate-300">
                          <span className="font-bold text-slate-500 dark:text-slate-400">
                            {f.label}:
                          </span>{' '}
                          <span className="font-semibold text-slate-800 dark:text-white">
                            {formatDynamicValue(f.type, v)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()
            : null}

          <div className="flex flex-col gap-2 pt-4 border-t border-gray-100 dark:border-slate-700 md:flex-row md:items-center">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 justify-center gap-2 whitespace-normal min-w-0 sm:min-w-[140px] rounded-xl shadow-sm"
              onClick={() => openPanel('PERSON_DETAILS', person.رقم_الشخص)}
              title={t('تفاصيل الشخص')}
              aria-label={t('تفاصيل الشخص')}
              rightIcon={<Eye size={14} className="shrink-0" />}
              leftIcon={<ArrowRight size={14} className="shrink-0 opacity-80" />}
            >
              {t('التفاصيل')}
            </Button>

            <div className="flex flex-wrap justify-end gap-1">
              <RBACGuard requiredPermission="EDIT_PERSON">
                <Button
                  size="icon"
                  variant="ghost"
                  title={t('تعديل')}
                  aria-label={t('تعديل')}
                  onClick={() => handleOpenForm(person.رقم_الشخص)}
                >
                  <Edit2 size={16} />
                </Button>
              </RBACGuard>

              <RBACGuard requiredPermission="DELETE_PERSON">
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                  title={t('حذف')}
                  aria-label={t('حذف')}
                  onClick={() => handleDelete(person.رقم_الشخص)}
                >
                  <Trash2 size={16} />
                </Button>
              </RBACGuard>

              <RBACGuard requiredRole="Admin">
                {!isBlacklisted && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-red-400 hover:text-red-600 hover:bg-red-50"
                    title={t('إضافة للقائمة السوداء')}
                    aria-label={t('إضافة للقائمة السوداء')}
                    onClick={() => handleBlacklist(person.رقم_الشخص)}
                  >
                    <Ban size={16} />
                  </Button>
                )}
              </RBACGuard>

              <Button
                size="icon"
                variant="ghost"
                className="text-green-500 hover:text-green-600 hover:bg-green-50"
                title={t('واتساب / اتصال')}
                aria-label={t('واتساب / اتصال')}
                onClick={() =>
                  void openWhatsAppForPhones('', [person.رقم_الهاتف, person.رقم_هاتف_اضافي], {
                    defaultCountryCode: '962',
                    delayMs: 10_000,
                  })
                }
              >
                <Phone size={16} />
              </Button>

              <Button
                size="sm"
                variant="ghost"
                className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                title={t('تذكير مرتبط بتاريخ وملاحظة')}
                onClick={() => void handleQuickReminderForPerson(person)}
              >
                <span className="inline-flex items-center gap-2">
                  <ListTodo size={16} /> {t('تذكير')}
                </span>
              </Button>
            </div>
          </div>
        </div>
      </Card>
    );
  };

  const renderDesktopCard = (row: PeoplePickerItem) => {
    const person = row.person;
    const roles = Array.isArray(row?.roles) ? row.roles : [];
    const isBlacklisted = !!row?.isBlacklisted;
    const primaryRole = getPrimaryRole(roles);
    const accent = getRoleClasses(primaryRole);
    const personColor = getPersonColorClasses(getPersonSeedFromPerson(person));

    const roleVisual = (() => {
      if (isBlacklisted) {
        return { stripe: 'bg-red-500/25 dark:bg-red-400/20', dot: 'bg-red-500' };
      }
      if (primaryRole === 'مالك') {
        return { stripe: 'bg-emerald-500/20 dark:bg-emerald-400/15', dot: 'bg-emerald-500' };
      }
      if (primaryRole === 'مستأجر') {
        return { stripe: 'bg-indigo-500/20 dark:bg-indigo-400/15', dot: 'bg-indigo-500' };
      }
      if (primaryRole === 'كفيل') {
        return { stripe: 'bg-amber-500/20 dark:bg-amber-400/15', dot: 'bg-amber-500' };
      }
      return { stripe: personColor.stripe, dot: personColor.dot };
    })();

    const roleRing =
      primaryRole === 'مالك'
        ? 'ring-2 ring-emerald-500/10 border-emerald-500/20'
        : primaryRole === 'مستأجر'
          ? 'ring-2 ring-indigo-500/10 border-indigo-500/20'
          : primaryRole === 'كفيل'
            ? 'ring-2 ring-amber-500/10 border-amber-500/20'
            : '';

    const link = row?.link || null;
    const isLinkedToContract = !!link?.contractId;
    const contractBoxClass = isLinkedToContract
      ? 'border-indigo-200 dark:border-indigo-500/30 bg-indigo-50 dark:bg-indigo-900/20'
      : 'border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/40';
    const contractTitleClass = isLinkedToContract
      ? 'text-indigo-700 dark:text-indigo-200'
      : 'text-slate-700 dark:text-slate-200';

    const contractNo = link?.contractId ? formatContractNumberShort(String(link.contractId)) : '';
    const propertyCode = String(link?.propertyCode || '').trim();
    const tenantName = String(link?.tenantName || '').trim();
    const guarantorName = String(link?.guarantorName || '').trim();
    const source = String(link?.source || '').trim();

    return (
      <Card
        key={person.رقم_الشخص}
        className={`group w-full animate-slide-up ${roleRing} ${isBlacklisted ? 'ring-2 ring-red-500/20 border-red-500/30' : ''}`}
      >
        <div
          className={`h-1 w-full ${roleVisual.stripe}`}
        ></div>
        <div className="p-5 flex flex-col h-full">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-bold shadow-inner ${isBlacklisted ? 'bg-red-100 text-red-600' : accent.avatar}`}
              >
                {(person.الاسم || 'غ').charAt(0)}
              </div>
              <div className="min-w-0">
                <div className="rounded-xl border border-slate-200/60 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/20 px-3 py-2">
                  <div className="flex items-start gap-2 min-w-0">
                    <span
                      className={`inline-block w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0 ${roleVisual.dot}`}
                    ></span>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-slate-900 dark:text-white leading-snug whitespace-normal break-words">
                        {person.الاسم || t('غير محدد')}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400">
                        {person.نوع_الملف === 'منشأة' ? (
                          <span className="px-2 py-0.5 rounded-lg border bg-gray-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-gray-200 dark:border-slate-700">
                            {t('منشأة')}
                          </span>
                        ) : null}
                        {isBlacklisted ? (
                          <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-300">
                            <ShieldAlert size={14} /> {t('قائمة سوداء')}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 font-mono dir-ltr flex flex-wrap items-center gap-2">
                    <span>{person.رقم_الهاتف || t('لا يوجد')}</span>
                    {person.رقم_هاتف_اضافي ? (
                      <>
                        <span>•</span>
                        <span>{String(person.رقم_هاتف_اضافي)}</span>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
            {person.تصنيف && <StatusBadge status={person.تصنيف} />}
          </div>

          <div className="flex flex-wrap gap-1.5 mb-3 flex-1 content-start">
            {roles.map((r) => (
              <span
                key={r}
                className={`text-[10px] px-2.5 py-1 rounded-lg border font-medium ${getRoleClasses(r).badge}`}
              >
                {tr(r)}
              </span>
            ))}
          </div>

          <div className={`mb-4 rounded-xl border p-3 ${contractBoxClass}`}>
            {isLinkedToContract ? (
              <div className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                <div className={`font-bold ${contractTitleClass}`}>{t('مرتبط بعقد')}</div>
                <div>
                  {t('رقم العقد:')} <span className="font-mono">#{contractNo}</span>
                  {propertyCode ? (
                    <>
                      {' '}
                      • {t('الكود الداخلي:')} <span className="font-mono">{propertyCode}</span>
                    </>
                  ) : null}
                </div>
                {source === 'owner' || source === 'guarantor' ? (
                  <div>
                    {t('المستأجر:')}{' '}
                    <span className="font-semibold">{tenantName || t('غير معروف')}</span>
                    {guarantorName ? (
                      <>
                        {' '}
                        • {t('الكفيل:')} <span className="font-semibold">{guarantorName}</span>
                      </>
                    ) : null}
                  </div>
                ) : source === 'tenant' ? (
                  <div>
                    {guarantorName ? (
                      <>
                        {t('الكفيل:')} <span className="font-semibold">{guarantorName}</span>
                      </>
                    ) : (
                      t('الكفيل: —')
                    )}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {t('غير مرتبط بعقد حالياً')}
              </div>
            )}
          </div>

          {showDynamicColumns && dynamicFields.length > 0
            ? (() => {
                const values = person.حقول_ديناميكية || {};
                const visible = dynamicFields
                  .map((f) => ({ f, v: values?.[f.name] }))
                  .filter(({ v }) => !isEmptyDynamicValue(v));
                if (!visible.length) return null;
                return (
                  <div className="mb-4 rounded-xl border border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-900 p-3">
                    <div className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-2">
                      {t('حقول إضافية')}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {visible.map(({ f, v }) => (
                        <div key={f.id} className="text-xs text-slate-600 dark:text-slate-300">
                          <span className="font-bold text-slate-500 dark:text-slate-400">
                            {f.label}:
                          </span>{' '}
                          <span className="font-semibold text-slate-800 dark:text-white">
                            {formatDynamicValue(f.type, v)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()
            : null}

          <div className="flex flex-col gap-2 pt-4 border-t border-gray-100 dark:border-slate-700 md:flex-row md:items-center">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 justify-center gap-2 whitespace-normal min-w-0 sm:min-w-[140px] rounded-xl shadow-sm"
              onClick={() => openPanel('PERSON_DETAILS', person.رقم_الشخص)}
              title={t('تفاصيل الشخص')}
              aria-label={t('تفاصيل الشخص')}
              rightIcon={<Eye size={14} className="shrink-0" />}
              leftIcon={<ArrowRight size={14} className="shrink-0 opacity-80" />}
            >
              {t('التفاصيل')}
            </Button>

            <div className="flex flex-wrap justify-end gap-1">
              <RBACGuard requiredPermission="EDIT_PERSON">
                <Button
                  size="icon"
                  variant="ghost"
                  title={t('تعديل')}
                  aria-label={t('تعديل')}
                  onClick={() => handleOpenForm(person.رقم_الشخص)}
                >
                  <Edit2 size={16} />
                </Button>
              </RBACGuard>

              <RBACGuard requiredPermission="DELETE_PERSON">
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                  title={t('حذف')}
                  aria-label={t('حذف')}
                  onClick={() => handleDelete(person.رقم_الشخص)}
                >
                  <Trash2 size={16} />
                </Button>
              </RBACGuard>

              <RBACGuard requiredRole="Admin">
                {!isBlacklisted && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-red-400 hover:text-red-600 hover:bg-red-50"
                    title={t('إضافة للقائمة السوداء')}
                    aria-label={t('إضافة للقائمة السوداء')}
                    onClick={() => handleBlacklist(person.رقم_الشخص)}
                  >
                    <Ban size={16} />
                  </Button>
                )}
              </RBACGuard>

              <Button
                size="icon"
                variant="ghost"
                className="text-green-500 hover:text-green-600 hover:bg-green-50"
                title={t('واتساب / اتصال')}
                aria-label={t('واتساب / اتصال')}
                onClick={() =>
                  void openWhatsAppForPhones('', [person.رقم_الهاتف, person.رقم_هاتف_اضافي], {
                    defaultCountryCode: '962',
                    delayMs: 10_000,
                  })
                }
              >
                <Phone size={16} />
              </Button>

              <Button
                size="sm"
                variant="ghost"
                className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                title={t('تذكير مرتبط بتاريخ وملاحظة')}
                onClick={() => void handleQuickReminderForPerson(person)}
              >
                <span className="inline-flex items-center gap-2">
                  <ListTodo size={16} /> {t('تذكير')}
                </span>
              </Button>
            </div>
          </div>
        </div>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <input
        ref={importRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        aria-label={t('استيراد ملف أشخاص (Excel/CSV)')}
        title={t('استيراد ملف أشخاص (Excel/CSV)')}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) void handleImportFile(f);
        }}
      />

      <SmartFilterBar
        title={t('إدارة الأشخاص')}
        subtitle={t('سجل العملاء، الملاك، والمستأجرين')}
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder={t('بحث: الاسم، الهاتف، الرقم الوطني...')}
        onRefresh={() => void loadData()}
        extraActions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <SegmentedTabs
              tabs={[
                { id: 'all', label: t('الكل'), icon: Users },
                ...availableRoles.map((role) => ({ id: role.label, label: tr(role.label) })),
                { id: 'blacklisted', label: t('القائمة السوداء'), icon: ShieldAlert },
              ]}
              activeId={activeRoleTab}
              onChange={(id) => setActiveRoleTab(id)}
            />

            <Select
              value={sortMode}
              onChange={(e) =>
                setSortMode(
                  e.target.value as 'name-asc' | 'name-desc' | 'updated-desc' | 'updated-asc'
                )
              }
              options={[
                { value: 'name-asc', label: t('الاسم: تصاعدي') },
                { value: 'name-desc', label: t('الاسم: تنازلي') },
                { value: 'updated-desc', label: t('الأحدث') },
                { value: 'updated-asc', label: t('الأقدم') },
              ]}
            />

            <Button
              variant={showAdvanced ? 'outline' : 'secondary'}
              onClick={() => setShowAdvanced(!showAdvanced)}
              leftIcon={<SlidersHorizontal size={18} />}
            >
              {showAdvanced ? t('إخفاء') : t('تصفية')}
            </Button>

            {activeRoleTab === 'مالك' && (
              <Button
                variant={showOnlyIdleOwners ? 'danger' : 'secondary'}
                size="sm"
                onClick={() => setShowOnlyIdleOwners(!showOnlyIdleOwners)}
                leftIcon={<Filter size={14} />}
              >
                {t('ملاك عقاراتهم شاغرة')}
              </Button>
            )}

            <Button variant="secondary" size="sm" onClick={() => setShowDynamicColumns((v) => !v)}>
              {showDynamicColumns ? t('إخفاء الحقول الإضافية') : t('إظهار الحقول الإضافية')}
            </Button>

            <Button
              variant="secondary"
              onClick={handleDownloadTemplate}
              leftIcon={<Download size={18} />}
            >
              {t('قالب Excel')}
            </Button>

            <RBACGuard requiredPermission="ADD_PERSON">
              <Button
                variant="secondary"
                onClick={handlePickImportFile}
                leftIcon={<Download size={18} />}
              >
                {t('استيراد')}
              </Button>
            </RBACGuard>

            <Button variant="secondary" onClick={handleExport} leftIcon={<Download size={18} />}>
              {t('تصدير')}
            </Button>

            <RBACGuard requiredPermission="ADD_PERSON">
              <Button onClick={() => handleOpenForm()} leftIcon={<Plus size={18} />}>
                {t('ملف جديد')}
              </Button>
              <Button
                variant="secondary"
                onClick={handleOpenCompanyForm}
                leftIcon={<Plus size={18} />}
              >
                {t('منشأة جديدة')}
              </Button>
            </RBACGuard>
          </div>
        }
      />

      {showAdvanced && (
        <Card className="p-4 mb-6 grid grid-cols-1 md:grid-cols-4 gap-4 animate-slide-up bg-indigo-50/50 dark:bg-slate-900/40 border-indigo-100/80 dark:border-slate-800">
          <Input
            placeholder={t('العنوان (يحتوي على)')}
            value={advFilters.address}
            onChange={(e) => setAdvFilters({ ...advFilters, address: e.target.value })}
          />
          <Input
            placeholder={t('الرقم الوطني')}
            value={advFilters.nationalId}
            onChange={(e) => setAdvFilters({ ...advFilters, nationalId: e.target.value })}
          />
          <Select
            value={advFilters.classification}
            onChange={(e) => setAdvFilters({ ...advFilters, classification: e.target.value })}
            options={[
              { value: 'All', label: t('كل التصنيفات') },
              { value: 'VIP', label: 'VIP' },
              { value: 'Standard', label: 'Standard' },
            ]}
          />
          <Select
            value={String(advFilters.minRating)}
            onChange={(e) => setAdvFilters({ ...advFilters, minRating: Number(e.target.value) })}
            options={[
              { value: '0', label: t('كل التقييمات') },
              { value: '3', label: t('3 نجوم فأكثر') },
              { value: '4', label: t('4 نجوم فأكثر') },
              { value: '5', label: t('5 نجوم فقط') },
            ]}
          />
        </Card>
      )}

      {/* عرض EmptyState حسب الحالة */}
      {(
        isDesktopFast
          ? (desktopCounts?.people ?? desktopTotal) === 0 &&
            !desktopLoading &&
            !searchTerm.trim() &&
            (activeRoleTab === 'all' || !activeRoleTab)
          : people.length === 0
      ) ? (
        // حالة: لا يوجد أشخاص في النظام
        <EmptyState type="people" onAction={() => handleOpenForm()} />
      ) : (isDesktopFast ? !desktopLoading && desktopTotal === 0 : filtered.length === 0) ? (
        // حالة: لا توجد نتائج بحث أو فلترة
        <EmptyState
          type={searchTerm ? 'search' : 'filter'}
          title={searchTerm ? t('لا توجد نتائج بحث') : t('لا توجد نتائج')}
          message={
            searchTerm
              ? t('لم يتم العثور على أشخاص يطابقون "{{query}}"', { query: searchTerm })
              : activeRoleTab === 'blacklisted'
                ? t('لا يوجد أشخاص في القائمة السوداء')
                : t('لا يوجد أشخاص بدور "{{role}}"', { role: tr(activeRoleTab) })
          }
          actionLabel={searchTerm ? t('مسح البحث') : t('مسح الفلاتر')}
          onAction={() => {
            setSearchTerm('');
            setActiveRoleTab('all');
            setShowOnlyIdleOwners(false);
            setShowAdvanced(false);
            setAdvFilters({ address: '', nationalId: '', classification: 'All', minRating: 0 });
          }}
        />
      ) : (
        // حالة: عرض البيانات
        <>
          {isDesktopFast ? (
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm text-slate-500 dark:text-slate-400">
                {desktopLoading ? '...' : desktopTotal.toLocaleString()} {t('نتيجة')}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={desktopLoading || desktopPage <= 0}
                  onClick={() => setDesktopPage((p) => Math.max(0, p - 1))}
                >
                  {t('السابق')}
                </Button>
                <div className="text-sm text-slate-600 dark:text-slate-300">
                  {desktopPage + 1} / {desktopPageCount}
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={desktopLoading || desktopPage + 1 >= desktopPageCount}
                  onClick={() =>
                    setDesktopPage((p) => Math.min(Math.max(0, desktopPageCount - 1), p + 1))
                  }
                >
                  {t('التالي')}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm text-slate-500 dark:text-slate-400">
                {filtered.length.toLocaleString()} {t('نتيجة')}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={uiPage <= 0}
                  onClick={() => setUiPage((p) => Math.max(0, p - 1))}
                >
                  {t('السابق')}
                </Button>
                <div className="text-sm text-slate-600 dark:text-slate-300">
                  {uiPage + 1} / {uiPageCount}
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={uiPage + 1 >= uiPageCount}
                  onClick={() => setUiPage((p) => Math.min(Math.max(0, uiPageCount - 1), p + 1))}
                >
                  {t('التالي')}
                </Button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[repeat(auto-fit,minmax(360px,1fr))]">
            {isDesktopFast
              ? desktopRows.map((r) => renderDesktopCard(r))
              : uiRows.map((person) => renderCard(person))}
          </div>
        </>
      )}
    </div>
  );
};
