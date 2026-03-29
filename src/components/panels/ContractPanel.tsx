import { useMemo, useState, useEffect, useCallback } from 'react';
import { DbService } from '@/services/mockDb';
import {
  FileText,
  Calendar,
  User,
  Home,
  DollarSign,
  MessageCircle,
  CheckCircle,
  Clock,
  AlertTriangle,
  Shield,
  History,
  Link,
  Ban,
  Printer,
  ListTodo,
  RefreshCcw,
  Edit2,
  Trash2,
  Loader2,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useSmartModal } from '@/context/ModalContext';
import { useToast } from '@/context/ToastContext';
import { useAppDialogs } from '@/hooks/useAppDialogs';
import { useDbSignal } from '@/hooks/useDbSignal';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { RBACGuard } from '@/components/shared/RBACGuard';
import { printCurrentViewUnified } from '@/services/printing/unifiedPrint';
import { AttachmentManager } from '@/components/AttachmentManager';
import { ActivityTimeline } from '@/components/ActivityTimeline';
import { NotesSection } from '@/components/shared/NotesSection';
import { DynamicFieldsDisplay } from '@/components/dynamic/DynamicFieldsDisplay';
import { formatContractNumberShort } from '@/utils/contractNumber';
import { formatCurrencyJOD } from '@/utils/format';
import { safeString } from '@/utils/safe';
import { storage } from '@/services/storage';
import { contractDetailsSmart, domainGetSmart } from '@/services/domainQueries';
import { listAttachmentsSmart } from '@/services/refsDataSmart';
import type {
  ContractDetailsResult,
  FollowUpTask,
  الأشخاص_tbl,
  العقارات_tbl,
  العقود_tbl,
  العمولات_tbl,
  الكمبيالات_tbl,
} from '@/types';
import {
  ContractPrintPreview,
  type ContractTemplateData,
} from '@/components/printing/templates/ContractTemplate';

const EMPTY_INSTALLMENTS: الكمبيالات_tbl[] = [];

function formatPropertyForContractPrint(p: العقارات_tbl | undefined): string {
  if (!p) return '—';
  const parts = [p.الكود_الداخلي, p.العنوان || p.المنطقة || p.المدينة].filter((x) =>
    String(x || '').trim()
  );
  return parts.length ? parts.join(' — ') : '—';
}

function buildContractTemplateDataFromDetails(
  c: العقود_tbl,
  tenant: الأشخاص_tbl | undefined,
  property: العقارات_tbl | undefined,
  owner: الأشخاص_tbl | null | undefined,
  contractId: string
): ContractTemplateData {
  const lessorName = String(owner?.الاسم || '').trim() || '—';
  const tenantName = String(tenant?.الاسم || '').trim() || '—';
  const propertyDetails = formatPropertyForContractPrint(property);
  const durationText =
    String(c.نص_مدة_العقد || '').trim() ||
    `${safeString(c.تاريخ_البداية)} — ${safeString(c.تاريخ_النهاية)} (${c.مدة_العقد_بالاشهر} شهراً)`;
  const terms =
    [c.نص_كيفية_أداء_البدل && `كيفية أداء البدل:\n${c.نص_كيفية_أداء_البدل}`]
      .filter(Boolean)
      .join('\n\n') || '—';
  return {
    lessorName,
    tenantName,
    propertyDetails,
    durationText,
    rentAmount: c.القيمة_السنوية,
    terms,
    contractTitle: `عقد إيجار #${formatContractNumberShort(contractId)}`,
  };
}

export const ContractPanel: React.FC<{ id: string; onClose?: () => void }> = ({ id, onClose }) => {
  const t = useCallback((s: string) => s, []);
  useAuth();
  const [data, setData] = useState<ContractDetailsResult | null>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'timeline'>('details');
  const [isOpeningWhatsAppPanel, setIsOpeningWhatsAppPanel] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [contractPrintOpen, setContractPrintOpen] = useState(false);

  // Desktop fast mode may return partial joins; also guard against stale join ids.
  // Resolve tenant/property (and owner) directly from the contract ids when needed.
  const [resolvedTenant, setResolvedTenant] = useState<الأشخاص_tbl | null | undefined>(undefined);
  const [resolvedProperty, setResolvedProperty] = useState<العقارات_tbl | null | undefined>(
    undefined
  );
  const [resolvedOwner, setResolvedOwner] = useState<الأشخاص_tbl | null | undefined>(undefined);
  const { openPanel } = useSmartModal();
  const toast = useToast();
  const dialogs = useAppDialogs();
  const dbSignal = useDbSignal();

  const wnd = window as unknown as { desktopDb?: { domainContractDetails?: unknown } };
  const isDesktop = storage.isDesktop() && !!wnd.desktopDb;
  const isDesktopFast = isDesktop && !!wnd.desktopDb?.domainContractDetails;
  const desktopUnsupported = isDesktop && !isDesktopFast;

  const todayYMD = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  useEffect(() => {
    let alive = true;
    void (async () => {
      void dbSignal;
      if (desktopUnsupported) {
        if (!alive) return;
        setLoadError(t('هذه الشاشة تحتاج وضع السرعة/SQL في نسخة الديسكتوب'));
        setData(null);
        return;
      }

      if (isDesktopFast) {
        try {
          const d = await contractDetailsSmart(id);
          if (!alive) return;
          setData(d);
          setLoadError(d ? null : t('تعذر تحميل بيانات العقد في وضع السرعة'));
        } catch {
          if (!alive) return;
          setData(null);
          setLoadError(t('تعذر تحميل بيانات العقد في وضع السرعة'));
        }
        return;
      }

      const d = DbService.getContractDetails(id);
      if (!alive) return;
      if (d) {
        setData(d);
        setLoadError(null);
      }
    })();

    return () => {
      alive = false;
    };
  }, [id, dbSignal, isDesktopFast, desktopUnsupported, t]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      if (!data) {
        if (!alive) return;
        setResolvedTenant(undefined);
        setResolvedProperty(undefined);
        setResolvedOwner(undefined);
        return;
      }

      const c0 = data.contract as unknown as Record<string, unknown>;
      const property0 = data.property as unknown as Record<string, unknown> | undefined;
      const tenant0 = data.tenant as unknown as Record<string, unknown> | undefined;

      const contractTenantId = String(c0?.['رقم_المستاجر'] ?? '').trim();
      const contractPropertyId = String(c0?.['رقم_العقار'] ?? '').trim();
      const loadedTenantId = String(tenant0?.['رقم_الشخص'] ?? '').trim();
      const loadedPropertyId = String(property0?.['رقم_العقار'] ?? '').trim();

      // Resolve tenant
      try {
        const needsTenantResolve =
          !!contractTenantId && (!loadedTenantId || loadedTenantId !== contractTenantId);
        if (needsTenantResolve) {
          const t = isDesktopFast
            ? ((await domainGetSmart('people', contractTenantId)) as الأشخاص_tbl | null)
            : (DbService.getPeople?.() || []).find(
                (p) => String(p?.رقم_الشخص ?? '') === contractTenantId
              ) || null;
          if (!alive) return;
          setResolvedTenant(t);
        } else {
          if (!alive) return;
          setResolvedTenant(undefined);
        }
      } catch {
        if (!alive) return;
        setResolvedTenant(undefined);
      }

      // Resolve property
      try {
        const needsPropertyResolve =
          !!contractPropertyId && (!loadedPropertyId || loadedPropertyId !== contractPropertyId);
        if (needsPropertyResolve) {
          const pr = isDesktopFast
            ? ((await domainGetSmart('properties', contractPropertyId)) as العقارات_tbl | null)
            : (DbService.getProperties?.() || []).find(
                (p) => String(p?.رقم_العقار ?? '') === contractPropertyId
              ) || null;
          if (!alive) return;
          setResolvedProperty(pr);
        } else {
          if (!alive) return;
          setResolvedProperty(undefined);
        }
      } catch {
        if (!alive) return;
        setResolvedProperty(undefined);
      }
    })();

    return () => {
      alive = false;
    };
  }, [data, isDesktopFast]);

  // IMPORTANT: Hooks must run on every render in the same order.
  // Keep derived memoized values above any conditional early returns.
  const installments = data?.installments ?? EMPTY_INSTALLMENTS;

  const propertyResolved = useMemo<العقارات_tbl | undefined>(() => {
    const raw = data?.property as العقارات_tbl | undefined;
    const picked = resolvedProperty === undefined ? raw : (resolvedProperty ?? raw);
    return (picked as العقارات_tbl | null | undefined) ?? raw;
  }, [data, resolvedProperty]);

  const tenantResolved = useMemo<الأشخاص_tbl | undefined>(() => {
    const raw = data?.tenant as الأشخاص_tbl | undefined;
    const picked = resolvedTenant === undefined ? raw : (resolvedTenant ?? raw);
    return (picked as الأشخاص_tbl | null | undefined) ?? raw;
  }, [data, resolvedTenant]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      if (!data) {
        if (!alive) return;
        setResolvedOwner(undefined);
        return;
      }

      const ownerId = String(
        (propertyResolved as unknown as Record<string, unknown>)?.['رقم_المالك'] ?? ''
      ).trim();
      if (!ownerId) {
        if (!alive) return;
        setResolvedOwner(undefined);
        return;
      }

      try {
        const owner = isDesktopFast
          ? ((await domainGetSmart('people', ownerId)) as الأشخاص_tbl | null)
          : (DbService.getPeople?.() || []).find((p) => String(p?.رقم_الشخص ?? '') === ownerId) ||
            null;
        if (!alive) return;
        setResolvedOwner(owner);
      } catch {
        if (!alive) return;
        setResolvedOwner(undefined);
      }
    })();

    return () => {
      alive = false;
    };
  }, [data, isDesktopFast, propertyResolved]);

  const contractCommission = useMemo<العمولات_tbl | undefined>(() => {
    void dbSignal;
    try {
      return DbService.getCommissions().find((x) => x.رقم_العقد === id);
    } catch {
      return undefined;
    }
  }, [id, dbSignal]);

  const dealSummary = useMemo(() => {
    void id;
    const list = installments;
    const relevant = list.filter((i) => i.نوع_الكمبيالة !== 'تأمين');
    const deposit = list.find((i) => i.نوع_الكمبيالة === 'تأمين');

    const calcPaidRemaining = (inst: الكمبيالات_tbl) => {
      const total = Math.max(0, Number(inst?.القيمة ?? 0) || 0);
      const status = String(inst?.حالة_الكمبيالة ?? '').trim();
      if (status === 'مدفوع') return { paid: total, remaining: 0 };

      const storedRemaining = inst?.القيمة_المتبقية;
      if (typeof storedRemaining === 'number' && Number.isFinite(storedRemaining)) {
        const remaining = Math.max(0, Math.min(total, storedRemaining));
        const paid = Math.max(0, Math.min(total, total - remaining));
        return { paid, remaining };
      }

      const paidFromHistory =
        inst?.سجل_الدفعات?.reduce((sum, p) => sum + (p?.المبلغ > 0 ? p.المبلغ : 0), 0) ?? 0;
      const paid = Math.max(0, Math.min(total, paidFromHistory));
      const remaining = Math.max(0, total - paid);
      return { paid, remaining };
    };

    const totals = relevant.reduce(
      (acc, inst) => {
        const { paid, remaining } = calcPaidRemaining(inst);
        acc.total += Math.max(0, Number(inst?.القيمة ?? 0) || 0);
        acc.paid += paid;
        acc.remaining += remaining;
        return acc;
      },
      { total: 0, paid: 0, remaining: 0 }
    );

    const commOwner = Number(contractCommission?.عمولة_المالك ?? 0) || 0;
    const commTenant = Number(contractCommission?.عمولة_المستأجر ?? 0) || 0;
    const commTotal =
      Number(contractCommission?.المجموع ?? commOwner + commTenant) || commOwner + commTenant;

    return {
      rentTotal: totals.total,
      rentPaid: totals.paid,
      rentRemaining: totals.remaining,
      depositValue: Math.max(0, Number(deposit?.القيمة ?? 0) || 0),
      commissionOwner: commOwner,
      commissionTenant: commTenant,
      commissionTotal: commTotal,
      netOfficeProfit: commTotal,
    };
  }, [id, installments, contractCommission]);

  const contractPrintData: ContractTemplateData | null = useMemo(() => {
    if (!data) return null;
    const c = data.contract;
    return buildContractTemplateDataFromDetails(
      c,
      tenantResolved ?? data.tenant,
      propertyResolved ?? data.property,
      resolvedOwner,
      String(c?.رقم_العقد || id)
    );
  }, [data, tenantResolved, propertyResolved, resolvedOwner, id]);

  if (desktopUnsupported) {
    return (
      <div className="p-10 text-center text-slate-600 dark:text-slate-300">
        <div className="font-bold">{t('غير مدعوم في وضع الديسكتوب الحالي')}</div>
        <div className="text-sm mt-2">
          {t('يرجى تحديث نسخة الديسكتوب أو تفعيل وضع السرعة/SQL.')}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-10 text-center text-slate-600 dark:text-slate-300">
        {loadError ? (
          <div>
            <div className="font-bold">{t('تعذر تحميل البيانات')}</div>
            <div className="text-sm mt-2">{loadError}</div>
          </div>
        ) : (
          t('جاري التحميل...')
        )}
      </div>
    );
  }

  const { contract: c, property, tenant } = data;

  const reload = () => {
    if (desktopUnsupported) return;
    if (isDesktopFast) {
      void (async () => {
        const d = await contractDetailsSmart(id);
        if (d) setData(d);
      })();
      return;
    }
    const d = DbService.getContractDetails(id);
    if (d) setData(d);
  };

  const handleQuickFollowUpForContract = async () => {
    const contractId = String(c?.رقم_العقد ?? id).trim();
    if (!contractId) return;

    const tenantPersonId = tenantResolved?.رقم_الشخص ? String(tenantResolved.رقم_الشخص) : undefined;
    const contractNo = formatContractNumberShort(contractId);
    const defaultTitle = `متابعة عقد ${contractNo}`;

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

    const followUp: Omit<FollowUpTask, 'id' | 'status'> = {
      task: title,
      clientName: String(tenantResolved?.الاسم || '').trim() || undefined,
      phone: String(tenantResolved?.رقم_الهاتف || '').trim() || undefined,
      type: 'Task',
      dueDate,
      priority: 'Medium',
      contractId,
      personId: tenantPersonId,
      propertyId: String(propertyResolved?.رقم_العقار || '').trim() || undefined,
      note: String(note || '').trim() || undefined,
    };

    DbService.addFollowUp(followUp);

    dialogs.toast.success('تم حفظ التذكير');
    openPanel('CALENDAR_EVENTS', dueDate, { title: 'مهام اليوم' });
  };

  const handleTerminate = async () => {
    const ok = await toast.confirm({
      title: 'مخالصة / إنهاء عقد',
      message: 'سيتم فتح معالج المخالصة لحساب الذمم وتحديد حالة العقار وإتمام الفسخ عند الاعتماد.',
      confirmText: 'متابعة',
      cancelText: 'إلغاء',
      isDangerous: false,
    });
    if (!ok) return;

    openPanel('CLEARANCE_WIZARD', id, {
      title: 'مخالصة إنهاء عقد',
      onDone: () => reload(),
    });
  };

  const handleRenew = async () => {
    await toast.confirm({
      title: 'تجديد العقد',
      message: 'سيتم إنشاء عقد جديد يبدأ بعد نهاية العقد الحالي مباشرة بنفس المدة والقيمة.',
      confirmText: 'تجديد',
      cancelText: 'إلغاء',
      isDangerous: false,
      onConfirm: async () => {
        const res = DbService.renewContract(id);
        if (res.success && res.data) {
          toast.success('تم إنشاء عقد التجديد');
          reload();
        } else {
          toast.error(res.message || 'فشل تجديد العقد');
        }
      },
    });
  };

  const handleDelete = async () => {
    await toast.confirm({
      title: 'حذف نهائي',
      message: 'سيتم حذف العقد نهائياً مع الكمبيالات والعمولات المرتبطة. لا يمكن التراجع.',
      confirmText: 'حذف',
      cancelText: 'إلغاء',
      isDangerous: true,
      onConfirm: async () => {
        const res = DbService.deleteContract(id);
        if (res.success) {
          toast.success('تم حذف العقد نهائياً');
          if (onClose) onClose();
          else window.history.back();
        } else {
          toast.error(res.message || 'فشل حذف العقد');
        }
      },
    });
  };

  const handleEdit = () => {
    openPanel('CONTRACT_FORM', id, {
      onSuccess: () => reload(),
    });
  };

  const handleOpenWhatsAppSendPanel = async () => {
    if (!data?.contract) return;

    try {
      setIsOpeningWhatsAppPanel(true);

      const contractId = String(data.contract.رقم_العقد || id).trim();
      const guarantorId = String(data.contract.رقم_الكفيل || '').trim();

      const resolvedProperty2 = (propertyResolved ?? property ?? null) as العقارات_tbl | null;
      const resolvedTenant2 = (tenantResolved ?? tenant ?? null) as الأشخاص_tbl | null;
      const resolvedOwner2 = (resolvedOwner ?? null) as الأشخاص_tbl | null;

      const guarantorResolved = guarantorId
        ? isDesktopFast
          ? ((await domainGetSmart('people', guarantorId)) as الأشخاص_tbl | null)
          : (DbService.getPeople?.() || []).find(
              (p) => String(p?.رقم_الشخص ?? '') === guarantorId
            ) || null
        : null;

      const atts = contractId ? await listAttachmentsSmart('Contract', contractId) : [];
      const waInstallments = (installments || [])
        .slice()
        .sort((a, b) =>
          String(a?.تاريخ_استحقاق || '').localeCompare(String(b?.تاريخ_استحقاق || ''))
        )
        .map((x, idx) => ({
          rank: Number(x?.ترتيب_الكمبيالة || x?.رقم_القسط || idx + 1) || idx + 1,
          type: String(x?.نوع_الدفعة || x?.نوع_الكمبيالة || 'دفعة'),
          date: String(x?.تاريخ_استحقاق || ''),
          amount: Number(x?.القيمة || 0) || 0,
        }))
        .filter((x) => !!x.date);

      openPanel('CONTRACT_WHATSAPP_SEND', contractId || id, {
        contract: data.contract,
        property: resolvedProperty2,
        tenant: resolvedTenant2,
        owner: resolvedOwner2,
        guarantor: guarantorResolved,
        commissionOwner: Number(contractCommission?.عمولة_المالك ?? 0) || 0,
        commissionTenant: Number(contractCommission?.عمولة_المستأجر ?? 0) || 0,
        installments: waInstallments,
        attachments: (atts || []).map((a) => ({ fileName: a.fileName })),
      });
    } catch {
      toast.warning('تعذر فتح شاشة إرسال واتساب');
    } finally {
      setIsOpeningWhatsAppPanel(false);
    }
  };

  const handlePrint = () => {
    void printCurrentViewUnified({ documentType: 'contract', entityId: id });
  };

  return (
    <>
    <div className="space-y-8 pb-10">
      {/* Header Card */}
      <div className="app-card relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/10 to-purple-600/10 opacity-50 group-hover:opacity-100 transition-opacity duration-700" />
        <div className="absolute top-0 right-0 left-0 h-1.5 bg-gradient-to-l from-indigo-500 to-purple-500 shadow-[0_0_15px_rgba(99,102,241,0.3)]" />

        <div className="relative p-8 flex flex-col md:flex-row justify-between gap-8">
          <div className="flex flex-col md:flex-row gap-6 items-center md:items-start">
            <div className="w-20 h-20 rounded-[2rem] bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-xl border-4 border-white dark:border-slate-800 transition-transform group-hover:scale-110 duration-500">
              <FileText size={40} />
            </div>
            <div className="flex-1 text-center md:text-right">
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mb-2">
                <h1 className="text-2xl font-black text-slate-800 dark:text-white leading-tight tracking-tight">
                  {t('عقد إيجار')} #{formatContractNumberShort(id)}
                </h1>
                <StatusBadge
                  status={safeString(c.حالة_العقد)}
                  className="!text-[10px] !px-3 !py-1 !font-black !rounded-xl"
                />
                {c.autoRenew && (
                  <span className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[9px] font-black rounded-lg border border-emerald-100 dark:border-emerald-800/50 flex items-center gap-1.5 uppercase tracking-tight">
                    <RefreshCcw size={10} className="animate-spin-slow" />
                    {t('تجديد تلقائي')}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap justify-center md:justify-start items-center gap-6 text-xs font-bold text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-2">
                  <Calendar size={14} className="text-indigo-400" />
                  {safeString(c.تاريخ_البداية)} — {safeString(c.تاريخ_النهاية)}
                </span>
                {c.رقم_الفرصة && (
                  <span className="flex items-center gap-2">
                    <Link size={14} className="text-indigo-400" />
                    {t('فرصة:')}{' '}
                    <span className="font-mono text-indigo-600 dark:text-indigo-400">
                      #{c.رقم_الفرصة}
                    </span>
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap md:flex-col gap-2 min-w-[200px]">
            <div className="flex-1 grid grid-cols-2 gap-2">
              <RBACGuard requiredPermission="EDIT_CONTRACT">
                <button
                  onClick={handleEdit}
                  className="flex items-center justify-center gap-2 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl transition-all text-[11px] font-black shadow-sm hover:bg-indigo-50 dark:hover:bg-indigo-900/20 active:scale-95"
                >
                  <Edit2 size={14} /> {t('تعديل')}
                </button>
              </RBACGuard>
              <RBACGuard requiredPermission="DELETE_CONTRACT">
                <button
                  onClick={handleDelete}
                  className="flex items-center justify-center gap-2 py-2.5 bg-white dark:bg-slate-800 border border-rose-100 dark:border-rose-900/30 text-rose-600 dark:text-rose-400 rounded-xl transition-all text-[11px] font-black shadow-sm hover:bg-rose-50 dark:hover:bg-rose-900/20 active:scale-95"
                >
                  <Trash2 size={14} /> {t('حذف')}
                </button>
              </RBACGuard>
            </div>
            <div className="flex-1 grid grid-cols-1 gap-2">
              <RBACGuard requiredPermission="PRINT_EXECUTE">
                {isDesktop && contractPrintData ? (
                  <button
                    type="button"
                    onClick={() => setContractPrintOpen(true)}
                    className="flex items-center justify-center gap-2 w-full py-2.5 bg-indigo-700 text-white rounded-xl transition-all text-[11px] font-black shadow-lg shadow-indigo-500/20 hover:bg-indigo-800 active:scale-95"
                  >
                    <Printer size={14} /> {t('طباعة العقد')}
                  </button>
                ) : null}
                <button
                  onClick={handlePrint}
                  className="flex items-center justify-center gap-2 w-full py-2.5 bg-slate-900 text-white rounded-xl transition-all text-[11px] font-black shadow-lg shadow-black/20 hover:bg-black active:scale-95"
                >
                  <Printer size={14} /> {t('طباعة')}
                </button>
              </RBACGuard>
              <button
                onClick={handleOpenWhatsAppSendPanel}
                disabled={isOpeningWhatsAppPanel}
                className="flex items-center justify-center gap-2 w-full py-2.5 bg-emerald-600 text-white rounded-xl transition-all text-[11px] font-black shadow-lg shadow-emerald-500/20 hover:bg-emerald-700 active:scale-95 disabled:opacity-50"
              >
                {isOpeningWhatsAppPanel ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <MessageCircle size={14} />
                )}
                {t('إرسال واتساب')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions Bar */}
      <div className="flex flex-wrap gap-3">
        <RBACGuard requiredPermission="CREATE_CONTRACT">
          <button
            onClick={handleRenew}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 rounded-2xl text-[11px] font-black border border-indigo-100 dark:border-indigo-800/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-all active:scale-95"
          >
            <RefreshCcw size={14} /> {t('تجديد العقد')}
          </button>
        </RBACGuard>
        <RBACGuard requiredPermission="EDIT_CONTRACT">
          <button
            onClick={handleTerminate}
            className="flex items-center gap-2 px-5 py-2.5 bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300 rounded-2xl text-[11px] font-black border border-rose-100 dark:border-rose-800/50 hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-all active:scale-95"
          >
            <Ban size={14} /> {t('فسخ / مخالصة')}
          </button>
        </RBACGuard>
        <button
          onClick={handleQuickFollowUpForContract}
          className="flex items-center gap-2 px-5 py-2.5 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 rounded-2xl text-[11px] font-black border border-amber-100 dark:border-amber-800/50 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-all active:scale-95"
        >
          <Clock size={14} /> {t('تذكير بمتابعة')}
        </button>
      </div>

      {/* Financial Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="app-card p-6 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/50 shadow-xl shadow-slate-200/10 dark:shadow-black/20 group hover:scale-[1.02] transition-transform">
          <div className="flex items-center gap-4 mb-3">
            <div className="p-2.5 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl text-indigo-600 dark:text-indigo-400 group-hover:rotate-12 transition-transform">
              <DollarSign size={20} />
            </div>
            <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              {t('إجمالي الإيجار')}
            </div>
          </div>
          <div className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">
            {formatCurrencyJOD(dealSummary.rentTotal)}
          </div>
        </div>

        <div className="app-card p-6 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/50 shadow-xl shadow-slate-200/10 dark:shadow-black/20 group hover:scale-[1.02] transition-transform">
          <div className="flex items-center gap-4 mb-3">
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
              <CheckCircle size={20} />
            </div>
            <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              {t('المدفوع')}
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-600 tracking-tight">
            {formatCurrencyJOD(dealSummary.rentPaid)}
          </div>
        </div>

        <div className="app-card p-6 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/50 shadow-xl shadow-slate-200/10 dark:shadow-black/20 group hover:scale-[1.02] transition-transform">
          <div className="flex items-center gap-4 mb-3">
            <div className="p-2.5 bg-rose-50 dark:bg-rose-900/30 rounded-xl text-rose-600 dark:text-rose-400 group-hover:-rotate-12 transition-transform">
              <AlertTriangle size={20} />
            </div>
            <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              {t('المتبقي')}
            </div>
          </div>
          <div className="text-2xl font-black text-rose-600 tracking-tight">
            {formatCurrencyJOD(dealSummary.rentRemaining)}
          </div>
        </div>

        <div className="app-card p-6 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/50 shadow-xl shadow-slate-200/10 dark:shadow-black/20 group hover:scale-[1.02] transition-transform">
          <div className="flex items-center gap-4 mb-3">
            <div className="p-2.5 bg-amber-50 dark:bg-amber-900/30 rounded-xl text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform">
              <Shield size={20} />
            </div>
            <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              {t('التأمين')}
            </div>
          </div>
          <div className="text-2xl font-black text-amber-600 tracking-tight">
            {formatCurrencyJOD(dealSummary.depositValue)}
          </div>
        </div>
      </div>

      {/* Main Content Tabs */}
      <div className="app-card overflow-hidden border border-slate-200/60 dark:border-slate-800/50 shadow-xl shadow-slate-200/10 dark:shadow-black/20">
        <div className="flex border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 p-2">
          <button
            onClick={() => setActiveTab('details')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-black transition-all ${activeTab === 'details' ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-100 dark:border-slate-800' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
          >
            <ListTodo size={18} /> {t('التفاصيل والكمبيالات')}
          </button>
          <button
            onClick={() => setActiveTab('timeline')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-black transition-all ${activeTab === 'timeline' ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-100 dark:border-slate-800' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
          >
            <History size={18} /> {t('سجل النشاطات')}
          </button>
        </div>

        <div className="p-8">
          {activeTab === 'details' ? (
            <div className="space-y-10">
              {/* Entity Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Tenant Card */}
                <div
                  onClick={() =>
                    tenantResolved && openPanel('PERSON_DETAILS', String(tenantResolved.رقم_الشخص))
                  }
                  className="p-6 bg-slate-50/50 dark:bg-slate-800/30 rounded-[2rem] border border-slate-100 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-800 transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-900 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-sm group-hover:scale-110 transition-transform">
                      <User size={24} />
                    </div>
                    <div>
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                        {t('المستأجر')}
                      </div>
                      <div className="text-base font-black text-slate-800 dark:text-white truncate max-w-[180px]">
                        {tenantResolved?.الاسم || t('غير معروف')}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Property Card */}
                <div
                  onClick={() =>
                    propertyResolved &&
                    openPanel('PROPERTY_DETAILS', String(propertyResolved.رقم_العقار))
                  }
                  className="p-6 bg-slate-50/50 dark:bg-slate-800/30 rounded-[2rem] border border-slate-100 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-800 transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-900 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-sm group-hover:scale-110 transition-transform">
                      <Home size={24} />
                    </div>
                    <div>
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                        {t('العقار')}
                      </div>
                      <div className="text-base font-black text-slate-800 dark:text-white truncate max-w-[180px]">
                        {propertyResolved?.العنوان || t('غير معروف')}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Owner Card */}
                <div
                  onClick={() =>
                    resolvedOwner && openPanel('PERSON_DETAILS', String(resolvedOwner.رقم_الشخص))
                  }
                  className="p-6 bg-slate-50/50 dark:bg-slate-800/30 rounded-[2rem] border border-slate-100 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-800 transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-900 flex items-center justify-center text-amber-600 dark:text-amber-400 shadow-sm group-hover:scale-110 transition-transform">
                      <Shield size={24} />
                    </div>
                    <div>
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                        {t('المالك')}
                      </div>
                      <div className="text-base font-black text-slate-800 dark:text-white truncate max-w-[180px]">
                        {resolvedOwner?.الاسم || t('غير معروف')}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Installments Table */}
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl text-indigo-600 dark:text-indigo-400">
                      <Calendar size={20} />
                    </div>
                    <h4 className="text-lg font-black text-slate-800 dark:text-white leading-tight">
                      {t('جدول الكمبيالات والدفعات')}
                    </h4>
                  </div>
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    {t('إجمالي الأقساط:')} {installments.length}
                  </div>
                </div>

                <div className="app-table-wrapper">
                  <div className="max-h-[600px] overflow-auto no-scrollbar">
                    <table className="app-table">
                      <thead className="app-table-thead">
                        <tr>
                          <th className="app-table-th w-16 text-center">#</th>
                          <th className="app-table-th">{t('النوع')}</th>
                          <th className="app-table-th">{t('تاريخ الاستحقاق')}</th>
                          <th className="app-table-th text-center">{t('القيمة')}</th>
                          <th className="app-table-th text-center">{t('الحالة')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100/50 dark:divide-slate-800/50">
                        {installments.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="app-table-empty">
                              {t('لا توجد كمبيالات لهذا العقد.')}
                            </td>
                          </tr>
                        ) : (
                          installments.map((inst, idx) => (
                            <tr
                              key={inst.رقم_الكمبيالة || idx}
                              className="app-table-row app-table-row-striped group"
                            >
                              <td className="app-table-td text-center font-black text-slate-400 group-hover:text-indigo-500 transition-colors">
                                {inst.ترتيب_الكمبيالة || idx + 1}
                              </td>
                              <td className="app-table-td">
                                <span
                                  className={`px-3 py-1 rounded-xl text-[10px] font-black border transition-colors ${
                                    inst.نوع_الكمبيالة === 'إيجار'
                                      ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 border-indigo-100 dark:border-indigo-800/50'
                                      : inst.نوع_الكمبيالة === 'تأمين'
                                        ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 border-amber-100 dark:border-amber-800/50'
                                        : 'bg-slate-50 dark:bg-slate-800 text-slate-500 border-slate-100 dark:border-slate-700'
                                  }`}
                                >
                                  {inst.نوع_الكمبيالة}
                                </span>
                              </td>
                              <td className="app-table-td font-mono text-xs font-bold text-slate-500">
                                {inst.تاريخ_استحقاق}
                              </td>
                              <td className="app-table-td text-center">
                                <span className="text-sm font-black text-slate-800 dark:text-white bg-slate-50 dark:bg-slate-900/50 px-3 py-1.5 rounded-xl border border-slate-100 dark:border-slate-800 group-hover:border-indigo-200 transition-colors">
                                  {formatCurrencyJOD(Number(inst.القيمة || 0))}
                                </span>
                              </td>
                              <td className="app-table-td">
                                <div className="flex justify-center">
                                  <StatusBadge
                                    status={safeString(inst.حالة_الكمبيالة)}
                                    className="!text-[10px] !px-3 !py-1 !font-black !rounded-xl"
                                  />
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <ActivityTimeline type="Contract" referenceId={id} />
          )}
        </div>
      </div>

      <AttachmentManager referenceType="Contract" referenceId={id} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <NotesSection type="Contract" referenceId={id} />
        <DynamicFieldsDisplay formId="contracts" values={c.حقول_ديناميكية} />
      </div>
    </div>

    {isDesktop && contractPrintOpen && contractPrintData ? (
      <ContractPrintPreview
        open
        onClose={() => setContractPrintOpen(false)}
        title="طباعة العقد"
        settings={DbService.getSettings()}
        data={contractPrintData}
        documentType="contract_template"
        entityId={String(id)}
        defaultFileName={`عقد_${formatContractNumberShort(id)}`}
      />
    ) : null}
    </>
  );
};
