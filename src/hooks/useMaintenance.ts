import { useState, useEffect, useRef, useCallback, useMemo, type FormEvent } from 'react';
import { DbService } from '@/services/mockDb';
import {
  تذاكر_الصيانة_tbl,
  العقارات_tbl,
  الأشخاص_tbl,
  العقود_tbl,
  DynamicFormField,
} from '@/types';
import { useSmartModal } from '@/context/ModalContext';
import { useToast } from '@/context/ToastContext';
import { useAuth } from '@/context/AuthContext';
import { useAppDialogs } from '@/hooks/useAppDialogs';
import { useDbSignal } from '@/hooks/useDbSignal';
import { storage } from '@/services/storage';
import { domainGetSmart, propertyContractsSmart } from '@/services/domainQueries';
import { useResponsivePageSize } from '@/hooks/useResponsivePageSize';
import { pickBestTenancyContract } from '@/utils/tenancy';

export type PropertyContext = {
  prop: العقارات_tbl | null;
  owner: الأشخاص_tbl | null;
  tenant: الأشخاص_tbl | null;
  ownerName: string;
  tenantName: string | null;
};

export const useMaintenance = (isVisible: boolean) => {
  const [tickets, setTickets] = useState<تذاكر_الصيانة_tbl[]>([]);
  const [properties, setProperties] = useState<العقارات_tbl[]>([]);
  const [people, setPeople] = useState<الأشخاص_tbl[]>([]);
  const [contracts, setContracts] = useState<العقود_tbl[]>([]);
  const isDesktopFast =
    typeof window !== 'undefined' && storage.isDesktop() && !!window.desktopDb?.domainGet;
  const [showDynamicColumns, setShowDynamicColumns] = useState(false);
  const [dynamicFields, setDynamicFields] = useState<DynamicFormField[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'open' | 'closed'>('all');
  const { openPanel } = useSmartModal();
  const toast = useToast();
  const dialogs = useAppDialogs();
  const { user } = useAuth();
  const dbSignal = useDbSignal();
  const canEdit = !!user && DbService.userHasPermission(user.id, 'EDIT_MAINTENANCE');
  const canClose = !!user && DbService.userHasPermission(user.id, 'CLOSE_MAINTENANCE');
  const canDelete = !!user && DbService.userHasPermission(user.id, 'DELETE_MAINTENANCE');
  const [formData, setFormData] = useState<Partial<تذاكر_الصيانة_tbl>>({
    تاريخ_الطلب: new Date().toISOString().split('T')[0],
    الأولوية: 'متوسطة',
    الجهة_المسؤولة: 'المالك',
    الحالة: 'مفتوح',
  });
  const [dynamicValues, setDynamicValues] = useState<Record<string, unknown>>({});
  const [editingId, setEditingId] = useState<string | null>(null);

  const refreshData = useCallback(() => {
    setTickets(DbService.getMaintenanceTickets());
    if (isDesktopFast) {
      setProperties([]);
      setPeople([]);
      setContracts([]);
    } else {
      setProperties(DbService.getProperties());
      setPeople(DbService.getPeople());
      setContracts(DbService.getContracts());
    }
    try {
      const f = DbService.getFormFields?.('maintenance') || [];
      setDynamicFields(Array.isArray(f) ? f : []);
    } catch {
      setDynamicFields([]);
    }
  }, [isDesktopFast]);

  useEffect(() => {
    if (isVisible) refreshData();
  }, [dbSignal, refreshData, isVisible]);

  const fastCtxRef = useRef<Map<string, PropertyContext>>(new Map());
  const [fastCtxTick, setFastCtxTick] = useState(0);

  useEffect(() => {
    if (!isDesktopFast) return;
    fastCtxRef.current = new Map();
    setFastCtxTick((x) => x + 1);
  }, [dbSignal, isDesktopFast]);

  useEffect(() => {
    if (!isDesktopFast) return;
    let cancelled = false;
    const run = async () => {
      const ids = new Set<string>();
      for (const t of tickets || []) {
        const pid = String(t?.رقم_العقار || '').trim();
        if (pid) ids.add(pid);
      }
      const selectedPid = String(formData?.رقم_العقار || '').trim();
      if (selectedPid) ids.add(selectedPid);
      const pending = Array.from(ids).filter((pid) => !fastCtxRef.current.has(pid)).slice(0, 300);
      for (const pid of pending) {
        if (cancelled) return;
        try {
          const prop = await domainGetSmart('properties', pid);
          if (cancelled) return;
          const ownerId = prop?.رقم_المالك ? String(prop.رقم_المالك) : '';
          const owner = ownerId ? await domainGetSmart('people', ownerId) : null;
          if (cancelled) return;
          let tenant: الأشخاص_tbl | null = null;
          let tenantName: string | null = null;
          try {
            const items = (await propertyContractsSmart(pid, 200)) || [];
            const contractObjs = items.map((x) => x.contract).filter(Boolean);
            const active = pickBestTenancyContract(contractObjs);
            if (active?.رقم_المستاجر) {
              const tid = String(active.رقم_المستاجر);
              tenant = await domainGetSmart('people', tid);
              const meta = items.find((x) => String(x?.contract?.رقم_العقد) === String(active.رقم_العقد));
              tenantName = String(meta?.tenantName || tenant?.الاسم || '').trim() || null;
            }
          } catch { /* ignore */ }
          fastCtxRef.current.set(pid, {
            prop: prop ?? (pid ? ({ رقم_العقار: pid } as unknown as العقارات_tbl) : null),
            owner: owner || null,
            tenant: tenant || null,
            ownerName: String(owner?.الاسم || '').trim() || 'غير معروف',
            tenantName,
          });
          setFastCtxTick((x) => x + 1);
        } catch { /* ignore */ }
      }
    };
    run();
    return () => { cancelled = true; };
  }, [isDesktopFast, tickets, formData?.رقم_العقار, fastCtxTick]);

  const handleOpenModal = useCallback((ticket?: تذاكر_الصيانة_tbl) => {
    if (ticket) {
      setFormData(ticket);
      setDynamicValues(ticket.حقول_ديناميكية || {});
      setEditingId(ticket.رقم_التذكرة);
    } else {
      setFormData({
        تاريخ_الطلب: new Date().toISOString().split('T')[0],
        الأولوية: 'متوسطة',
        الجهة_المسؤولة: 'المالك',
        الحالة: 'مفتوح',
        رقم_العقار: '',
      } as unknown as تذاكر_الصيانة_tbl);
      setDynamicValues({});
      setEditingId(null);
    }
    setIsModalOpen(true);
  }, []);

  const handleSubmit = useCallback((e: FormEvent) => {
    e.preventDefault();
    if (!formData.رقم_العقار || !formData.الوصف) {
      toast.warning('يرجى تعبئة الحقول الإجبارية');
      return;
    }
    if (!canEdit) {
      toast.error('ليس لديك صلاحية تعديل/إضافة تذاكر الصيانة');
      return;
    }
    try {
      if (editingId) {
        DbService.updateMaintenanceTicket(editingId, {
          ...formData,
          حقول_ديناميكية: Object.keys(dynamicValues || {}).length ? dynamicValues : undefined,
        } as unknown as Partial<تذاكر_الصيانة_tbl>);
      } else {
        DbService.addMaintenanceTicket({
          ...(formData as تذاكر_الصيانة_tbl),
          حقول_ديناميكية: Object.keys(dynamicValues || {}).length ? dynamicValues : undefined,
        } as unknown as تذاكر_الصيانة_tbl);
      }
      refreshData();
      setIsModalOpen(false);
    } catch (err: unknown) {
      const msg = typeof err === 'object' && err !== null && 'message' in err
        ? String((err as Record<string, unknown>).message ?? '') : '';
      toast.error(msg || 'فشل حفظ التذكرة');
    }
  }, [formData, dynamicValues, canEdit, editingId, refreshData, toast]);

  const handleFinishTicket = useCallback(async (ticketId: string) => {
    if (!canClose) { toast.error('ليس لديك صلاحية إنهاء تذاكر الصيانة'); return; }
    const ok = await toast.confirm({ title: 'تأكيد', message: 'هل تريد إنهاء هذه التذكرة؟', confirmText: 'إنهاء', cancelText: 'إلغاء', isDangerous: false });
    if (!ok) return;
    try {
      const notes = (await dialogs.prompt({ title: 'ملاحظات الإنهاء', message: 'ملاحظات الإنهاء (اختياري):', inputType: 'textarea', placeholder: 'اكتب الملاحظات هنا...', required: false }))?.trim() || '';
      DbService.updateMaintenanceTicket(ticketId, { الحالة: 'مغلق', ملاحظات_الإنهاء: notes || undefined } as unknown as Partial<تذاكر_الصيانة_tbl>);
      refreshData();
      toast.success('تم إنهاء التذكرة');
    } catch (err: unknown) {
      const msg = typeof err === 'object' && err !== null && 'message' in err ? String((err as Record<string, unknown>).message ?? '') : '';
      toast.error(msg || 'فشل إنهاء التذكرة');
    }
  }, [canClose, dialogs, refreshData, toast]);

  const handleDeleteTicket = useCallback(async (ticketId: string) => {
    if (!canDelete) { toast.error('ليس لديك صلاحية حذف تذاكر الصيانة'); return; }
    const ok = await toast.confirm({ title: 'تحذير', message: 'هل أنت متأكد من حذف هذه التذكرة نهائياً؟', confirmText: 'حذف', cancelText: 'إلغاء', isDangerous: true });
    if (!ok) return;
    try {
      const maybeDelete = (DbService as unknown as { deleteMaintenanceTicket?: (id: string) => unknown }).deleteMaintenanceTicket;
      const res = maybeDelete?.(ticketId) as unknown as { success?: boolean; message?: string } | undefined;
      if (res?.success === false) { toast.error(res.message || 'فشل حذف التذكرة'); return; }
      refreshData();
      toast.success('تم حذف التذكرة');
    } catch (err: unknown) {
      const msg = typeof err === 'object' && err !== null && 'message' in err ? String((err as Record<string, unknown>).message ?? '') : '';
      toast.error(msg || 'فشل حذف التذكرة');
    }
  }, [canDelete, refreshData, toast]);

  const getPropName = useCallback((id: string) => {
    const pid = String(id || '').trim();
    if (isDesktopFast) {
      const ctx = fastCtxRef.current.get(pid);
      return String(ctx?.prop?.الكود_الداخلي || '').trim() || pid;
    }
    return properties.find((p) => p.رقم_العقار === id)?.الكود_الداخلي || id;
  }, [isDesktopFast, properties]);

  const getPropertyContext = useCallback((propId: string): PropertyContext | null => {
    const pid = String(propId || '').trim();
    if (!pid) return null;
    if (isDesktopFast) {
      const ctx = fastCtxRef.current.get(pid);
      if (ctx) return ctx;
      return { prop: { رقم_العقار: pid } as unknown as العقارات_tbl, owner: null, tenant: null, ownerName: '...', tenantName: null };
    }
    const prop = properties.find((p) => p.رقم_العقار === propId);
    if (!prop) return null;
    const owner = people.find((p) => p.رقم_الشخص === prop.رقم_المالك);
    const activeContract = pickBestTenancyContract(contracts.filter((c) => c.رقم_العقار === propId));
    const tenant = activeContract ? people.find((p) => p.رقم_الشخص === activeContract.رقم_المستاجر) : null;
    return { prop, owner, tenant, ownerName: owner?.الاسم || 'غير معروف', tenantName: tenant?.الاسم || null };
  }, [isDesktopFast, properties, people, contracts]);

  const filteredTickets = useMemo(() => tickets.filter((t) => {
    if (filter === 'open') return t.الحالة !== 'مغلق';
    if (filter === 'closed') return t.الحالة === 'مغلق';
    return true;
  }), [tickets, filter]);

  const pageSize = useResponsivePageSize({ base: 6, sm: 6, md: 8, lg: 9, xl: 12, '2xl': 15 });
  const [page, setPage] = useState(1);
  const pageCount = useMemo(() => Math.max(1, Math.ceil((filteredTickets.length || 0) / pageSize)), [filteredTickets.length, pageSize]);

  useEffect(() => { setPage(1); }, [filter, pageSize]);
  useEffect(() => { setPage((p) => Math.min(Math.max(1, p), pageCount)); }, [pageCount]);

  const visibleTickets = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredTickets.slice(start, start + pageSize);
  }, [filteredTickets, page, pageSize]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (id && tickets.length > 0) {
      const ticket = tickets.find((t) => t.رقم_التذكرة === id);
      if (ticket) {
        const newUrl = window.location.pathname + window.location.hash;
        window.history.replaceState({}, '', newUrl);
        handleOpenModal(ticket);
      }
    }
  }, [tickets, handleOpenModal]);

  return {
    tickets, filteredTickets, visibleTickets,
    properties, people, contracts,
    dynamicFields, showDynamicColumns, setShowDynamicColumns,
    isModalOpen, setIsModalOpen,
    filter, setFilter,
    formData, setFormData,
    dynamicValues, setDynamicValues,
    editingId,
    canEdit, canClose, canDelete,
    openPanel,
    page, setPage, pageCount,
    refreshData,
    handleOpenModal, handleSubmit,
    handleFinishTicket, handleDeleteTicket,
    getPropName, getPropertyContext,
  };
};
