import React, { useMemo, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useSmartModal } from '@/context/ModalContext';
import { useToast } from '@/context/ToastContext';
import { useAppDialogs } from '@/hooks/useAppDialogs';
import { useDbSignal } from '@/hooks/useDbSignal';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { RBACGuard } from '@/components/shared/RBACGuard';
import { AttachmentManager } from '@/components/AttachmentManager';
import { ActivityTimeline } from '@/components/ActivityTimeline';
import { NotesSection } from '@/components/shared/NotesSection';
import { DynamicFieldsDisplay } from '@/components/dynamic/DynamicFieldsDisplay';
import { PrintLetterhead } from '@/components/print/PrintLetterhead';
import { AppModal } from '@/components/ui/AppModal';
import { docxHasMustachePlaceholders, fillContractMaskedDocxTemplate, fillDocxTemplate } from '@/utils/docxTemplate';
import { arabicNumberToWords } from '@/utils/arabicNumber';
import { formatContractNumberShort } from '@/utils/contractNumber';
import { formatCurrencyJOD } from '@/utils/format';
import { getCurrencySuffix, getMoneySettingsSync } from '@/services/moneySettings';
import { getRentalTier } from '@/utils/employeeCommission';
import { normalizeDigitsToLatin } from '@/utils/numberInput';
import { can } from '@/utils/permissions';
import { normalizeRole } from '@/utils/roles';
import { storage } from '@/services/storage';
import { contractDetailsSmart, domainGetSmart } from '@/services/domainQueries';
import { listAttachmentsSmart } from '@/services/refsDataSmart';
import { sanitizeDocxHtml } from '@/utils/sanitizeHtml';
import type {
  ContractDetailsResult,
  FollowUpTask,
  الأشخاص_tbl,
  العقارات_tbl,
  العمولات_tbl,
  الكمبيالات_tbl,
} from '@/types';

const EMPTY_INSTALLMENTS: الكمبيالات_tbl[] = [];

type MammothConverter = {
  convertToHtml: (input: { arrayBuffer: ArrayBuffer }) => Promise<{ value?: string }>;
};

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const isMammothConverter = (v: unknown): v is MammothConverter => {
  return isRecord(v) && typeof (v as MammothConverter).convertToHtml === 'function';
};

export const ContractPanel: React.FC<{ id: string; onClose?: () => void }> = ({ id, onClose }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const userRole = normalizeRole(user?.الدور);
  const [data, setData] = useState<ContractDetailsResult | null>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'timeline'>('details');
  const [isGeneratingWord, setIsGeneratingWord] = useState(false);
  const [isContractWordPreviewOpen, setIsContractWordPreviewOpen] = useState(false);
  const [contractWordPreviewTitle, setContractWordPreviewTitle] = useState('');
  const [contractWordPreviewHtml, setContractWordPreviewHtml] = useState('');
  const [isContractWordPreviewBusy, setIsContractWordPreviewBusy] = useState(false);
  const [isOpeningContractWord, setIsOpeningContractWord] = useState(false);
  const [isOpeningWhatsAppPanel, setIsOpeningWhatsAppPanel] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Desktop fast mode may return partial joins; also guard against stale join ids.
  // Resolve tenant/property (and owner) directly from the contract ids when needed.
  const [resolvedTenant, setResolvedTenant] = useState<الأشخاص_tbl | null | undefined>(undefined);
  const [resolvedProperty, setResolvedProperty] = useState<العقارات_tbl | null | undefined>(undefined);
  const [resolvedOwner, setResolvedOwner] = useState<الأشخاص_tbl | null | undefined>(undefined);
  const { openPanel } = useSmartModal();
  const toast = useToast();
  const dialogs = useAppDialogs();
  const dbSignal = useDbSignal();

  const toRecord = (v: unknown): Record<string, unknown> =>
    typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {};
  const getErrorMessage = (e: unknown): string => {
    const rec = toRecord(e);
    const msg = rec['message'];
    return typeof msg === 'string' ? msg : '';
  };

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
    const picked = resolvedProperty === undefined ? raw : resolvedProperty ?? raw;
    return (picked as العقارات_tbl | null | undefined) ?? raw;
  }, [data, resolvedProperty]);

  const tenantResolved = useMemo<الأشخاص_tbl | undefined>(() => {
    const raw = data?.tenant as الأشخاص_tbl | undefined;
    const picked = resolvedTenant === undefined ? raw : resolvedTenant ?? raw;
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

  const contractCommissionMonthKey = useMemo(() => {
    if (!contractCommission) return '';
    const paidMonth = String(contractCommission.شهر_دفع_العمولة || '').trim();
    if (/^\d{4}-\d{2}$/.test(paidMonth)) return paidMonth;
    const commissionDate = String(contractCommission.تاريخ_العقد || '').trim();
    if (/^\d{4}-\d{2}/.test(commissionDate)) return commissionDate.slice(0, 7);
    return '';
  }, [contractCommission]);

  const monthRentalOfficeTotal = useMemo(() => {
    void dbSignal;
    if (!contractCommissionMonthKey) return 0;
    try {
      const all = DbService.getCommissions();
      return all.reduce((sum, r) => {
        const paidMonth = String(r?.شهر_دفع_العمولة || '').trim();
        const mk = /^\d{4}-\d{2}$/.test(paidMonth)
          ? paidMonth
          : /^\d{4}-\d{2}/.test(String(r?.تاريخ_العقد || ''))
            ? String(r.تاريخ_العقد).slice(0, 7)
            : '';
        if (mk !== contractCommissionMonthKey) return sum;
        return sum + (Number(r?.المجموع) || 0);
      }, 0);
    } catch {
      return 0;
    }
  }, [contractCommissionMonthKey, dbSignal]);

  const handleEditCommissions = async () => {
    if (desktopUnsupported) {
      toast.error('هذه الميزة تحتاج وضع السرعة/SQL في نسخة الديسكتوب');
      return;
    }

    const ownerStr = await dialogs.prompt({
      title: 'العمولة (المالك)',
      message: (() => {
        try {
          const code = String(getMoneySettingsSync().currencyCode || 'JOD').trim().toUpperCase();
          const suffix = getCurrencySuffix(code);
          return suffix ? `أدخل عمولة المالك (${suffix}):` : 'أدخل عمولة المالك:';
        } catch {
          return 'أدخل عمولة المالك:';
        }
      })(),
      inputType: 'number',
      defaultValue: String(Number(contractCommission?.عمولة_المالك ?? 0) || 0),
      required: true,
    });
    if (ownerStr === null || ownerStr === undefined) return;

    const tenantStr = await dialogs.prompt({
      title: 'العمولة (المستأجر)',
      message: (() => {
        try {
          const code = String(getMoneySettingsSync().currencyCode || 'JOD').trim().toUpperCase();
          const suffix = getCurrencySuffix(code);
          return suffix ? `أدخل عمولة المستأجر (${suffix}):` : 'أدخل عمولة المستأجر:';
        } catch {
          return 'أدخل عمولة المستأجر:';
        }
      })(),
      inputType: 'number',
      defaultValue: String(Number(contractCommission?.عمولة_المستأجر ?? 0) || 0),
      required: true,
    });
    if (tenantStr === null || tenantStr === undefined) return;

    const commOwner = Number(normalizeDigitsToLatin(String(ownerStr).trim()));
    const commTenant = Number(normalizeDigitsToLatin(String(tenantStr).trim()));
    if (
      !Number.isFinite(commOwner) ||
      commOwner < 0 ||
      !Number.isFinite(commTenant) ||
      commTenant < 0
    ) {
      toast.error('قيمة العمولة غير صالحة');
      return;
    }

    const dbExt = DbService as unknown as Partial<{
      upsertCommissionForContract: (
        contractId: string,
        payload: { commOwner: number; commTenant: number }
      ) => unknown;
    }>;

    const res = dbExt.upsertCommissionForContract?.(String(id), {
      commOwner,
      commTenant,
    });

    if (res !== undefined && toRecord(res)['success'] === false) {
      toast.error(String(toRecord(res)['message'] || '') || t('تعذر حفظ العمولة'));
      return;
    }

    toast.success(t('تم حفظ العمولة'));
    reload();
  };

  if (desktopUnsupported) {
    return (
      <div className="p-10 text-center text-slate-600 dark:text-slate-300">
        <div className="font-bold">{t('غير مدعوم في وضع الديسكتوب الحالي')}</div>
        <div className="text-sm mt-2">{t('يرجى تحديث نسخة الديسكتوب أو تفعيل وضع السرعة/SQL.')}</div>
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

  const depositInst = installments.find((i) => i.نوع_الكمبيالة === 'تأمين');

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

  const ensureCommissionRecord = () => {
    if (desktopUnsupported) return undefined;
    const existing = DbService.getCommissions().find((x) => x.رقم_العقد === id);
    if (existing) return existing;

    const dbExt = DbService as unknown as Partial<{
      upsertCommissionForContract: (
        contractId: string,
        payload: { commOwner: number; commTenant: number }
      ) => unknown;
    }>;

    const res = dbExt.upsertCommissionForContract?.(String(id), {
      commOwner: Number(dealSummary.commissionOwner || 0),
      commTenant: Number(dealSummary.commissionTenant || 0),
    });
    if (res !== undefined && toRecord(res)['success'] === false) return undefined;
    return DbService.getCommissions().find((x) => x.رقم_العقد === id);
  };

  const handleSetOpportunityNumber = async () => {
    if (desktopUnsupported) {
      toast.error(t('هذه الميزة تحتاج وضع السرعة/SQL في نسخة الديسكتوب'));
      return;
    }
    const rec = ensureCommissionRecord();
    if (!rec?.رقم_العمولة) {
      toast.error(t('تعذر إنشاء/تحديد سجل العمولة للعقد'));
      return;
    }

    const value = await dialogs.prompt({
      title: t('رقم الفرصة'),
      message: t('أدخل رقم الفرصة المرتبط بهذه العملية:'),
      inputType: 'text',
      defaultValue: String(rec.رقم_الفرصة || c?.رقم_الفرصة || ''),
      placeholder: 'Opportunity #',
      required: true,
    });
    if (!value) return;

    const normalized = normalizeDigitsToLatin(String(value).trim());
    const res = DbService.updateCommission(String(rec.رقم_العمولة), { رقم_الفرصة: normalized });
    if (res.success) {
      toast.success(t('تم حفظ رقم الفرصة'));
      reload();
    } else {
      toast.error(res.message || t('تعذر حفظ رقم الفرصة'));
    }
  };

  const handleTogglePropertyIntro = (enabled: boolean) => {
    if (desktopUnsupported) {
      toast.error(t('هذه الميزة تحتاج وضع السرعة/SQL في نسخة الديسكتوب'));
      return;
    }
    const rec = ensureCommissionRecord();
    if (!rec?.رقم_العمولة) {
      toast.error(t('تعذر إنشاء/تحديد سجل العمولة للعقد'));
      return;
    }

    const res = DbService.updateCommission(String(rec.رقم_العمولة), { يوجد_ادخال_عقار: enabled });
    if (res.success) {
      toast.success('تم تحديث عمولة إدخال العقار');
      reload();
    } else {
      toast.error(res.message || 'تعذر تحديث عمولة إدخال العقار');
    }
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

  const handleArchive = async () => {
    await toast.confirm({
      title: 'أرشفة العقد',
      message: `سيتم نقل العقد للأرشيف. هل أنت متأكد؟`,
      confirmText: 'أرشفة',
      cancelText: 'إلغاء',
      isDangerous: false,
      onConfirm: async () => {
        DbService.archiveContract(id);
        toast.success('تمت أرشفة العقد');
        reload();
      },
    });
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

  const toggleAutoRenew = async () => {
    const enabled = !(c.autoRenew === true);
    const res = DbService.setContractAutoRenew(id, enabled);
    if (res.success) {
      toast.success(enabled ? 'تم تفعيل التجديد التلقائي' : 'تم إيقاف التجديد التلقائي');
      reload();
    } else {
      toast.error(res.message || 'فشل تحديث الإعداد');
    }
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
        ? (isDesktopFast
            ? ((await domainGetSmart('people', guarantorId)) as الأشخاص_tbl | null)
            : (DbService.getPeople?.() || []).find(
                (p) => String(p?.رقم_الشخص ?? '') === guarantorId
              ) || null)
        : null;

      const atts = contractId ? await listAttachmentsSmart('Contract', contractId) : [];
      const waInstallments = (installments || [])
        .slice()
        .sort((a, b) => String(a?.تاريخ_استحقاق || '').localeCompare(String(b?.تاريخ_استحقاق || '')))
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

  const handlePrint = () => window.print();

  const handleOpenContractWordForEdit = async () => {
    try {
      setIsOpeningContractWord(true);

      if (!storage.isDesktop() || !window.desktopDb?.openAttachmentFile) {
        toast.warning('هذه الميزة متاحة في نسخة الديسكتوب فقط');
        return;
      }

      const atts = await listAttachmentsSmart('Contract', String(id || '').trim());
      const docxAtts = (atts || []).filter((a) => {
        const ext = String(a?.fileExtension || '').toLowerCase();
        const name = String(a?.fileName || '').toLowerCase();
        return ext === 'docx' || name.endsWith('.docx');
      });

      const latest = docxAtts
        .slice()
        .sort((a, b) => String(b?.uploadDate || '').localeCompare(String(a?.uploadDate || '')))[0];

      const relPath = String(latest?.filePath || '').trim();
      if (!relPath) {
        toast.warning('لا يوجد عقد Word محفوظ. قم بالضغط على "توليد عقد Word" أولاً');
        return;
      }

      const resUnknown = await window.desktopDb.openAttachmentFile(relPath);
      const res = (resUnknown && typeof resUnknown === 'object') ? (resUnknown as Record<string, unknown>) : {};
      if (res['success'] !== true) {
        toast.error(String(res['message'] || 'تعذر فتح ملف Word'));
        return;
      }
    } catch (e: unknown) {
      toast.error(getErrorMessage(e) || 'تعذر فتح ملف Word');
    } finally {
      setIsOpeningContractWord(false);
    }
  };

  const printDocxHtml = (html: string, title: string) => {
    const safeHtml = sanitizeDocxHtml(String(html || ''));
    const safeTitle = String(title || 'عقد').replace(/[<>]/g, '');
    const w = window.open('', '_blank', 'noopener,noreferrer');
    if (!w) {
      toast.error('تعذر فتح نافذة الطباعة');
      return;
    }

    w.document.open();
    w.document.write(`<!doctype html>
<html lang="ar" dir="rtl">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeTitle}</title>
    <style>
      body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; padding: 24px; direction: rtl; }
      img { max-width: 100%; height: auto; }
      table { border-collapse: collapse; width: 100%; }
      table, th, td { border: 1px solid #e5e7eb; }
      th, td { padding: 6px 8px; vertical-align: top; }
      @media print { body { padding: 0; } }
    </style>
  </head>
  <body>
    ${safeHtml}
  </body>
</html>`);
    w.document.close();

    try {
      w.focus();
      w.onafterprint = () => {
        try {
          w.close();
        } catch {
          // ignore
        }
      };
      window.setTimeout(() => {
        try {
          w.print();
        } catch {
          toast.error('تعذر الطباعة');
        }
      }, 250);
    } catch {
      toast.error('تعذر الطباعة');
    }
  };

  const buildFilledContractDocx = async (): Promise<{ bytes: ArrayBuffer; outName: string }> => {
    if (desktopUnsupported) throw new Error('هذه الميزة تحتاج وضع السرعة/SQL في نسخة الديسكتوب');

    const details: ContractDetailsResult | null = isDesktopFast
      ? await contractDetailsSmart(id)
      : DbService.getContractDetails(id) || null;
    if (!details?.contract) throw new Error('تعذر تحميل بيانات العقد');

    const settings = DbService.getSettings?.();
    let templateName = String(settings?.contractWordTemplateName || '').trim();
    const templateType: 'contracts' = 'contracts';

    if (!templateName) {
      const listRes = await DbService.listWordTemplates?.(templateType);
      const items = listRes?.success ? listRes.data || [] : [];
      if (items.length === 1) {
        templateName = items[0];
        if (settings && DbService.saveSettings) {
          DbService.saveSettings({ ...settings, contractWordTemplateName: templateName });
        }
      }
    }

    if (!templateName) throw new Error('لم يتم تحديد قالب Word. يرجى اختيار/استيراد القالب من الإعدادات > قوالب Word');

    const tpl = await DbService.readWordTemplate(templateName, templateType);
    if (!tpl.success || !tpl.data) throw new Error(tpl.message || 'تعذر تحميل قالب Word');

    const c0 = details.contract;
    const p0 = details.property;
    const t0 = details.tenant;
    const today = new Date().toISOString().slice(0, 10);

    const ownerId = String(p0?.رقم_المالك || '').trim();
    const owner = ownerId
      ? isDesktopFast
        ? await domainGetSmart('people', ownerId)
        : (DbService.getPeople?.() || []).find((x) => String(x?.رقم_الشخص) === ownerId) || null
      : null;

    const guarantorId = String((c0 as unknown as Record<string, unknown>)?.['رقم_الكفيل'] ?? '').trim();
    const guarantor = guarantorId
      ? isDesktopFast
        ? await domainGetSmart('people', guarantorId)
        : (DbService.getPeople?.() || []).find((x) => String(x?.رقم_الشخص) === guarantorId) || null
      : null;

    const installments0: الكمبيالات_tbl[] = details?.installments ?? [];
    const rentInstallments = installments0.filter((i) => {
      const t = String(i?.نوع_الكمبيالة ?? '').trim();
      const p = String(i?.نوع_الدفعة ?? '').trim();
      // Count only rent bills (كمبيالات الإيجار) and exclude other types like deposit/day-diff/down-payment.
      return t === 'إيجار' || p === 'دورية';
    });
    const rentBillsCount = rentInstallments.length;

    const rentDueDayOfMonth = (() => {
      const getDueDay = (arr: الكمبيالات_tbl[]): number | undefined => {
        const dates = (arr || [])
          .map((x) => String(x?.تاريخ_استحقاق || '').trim())
          .filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s))
          .sort((a, b) => a.localeCompare(b));
        const first = dates[0];
        if (!first) return undefined;
        const d = new Date(`${first}T00:00:00`);
        const day = Number.isFinite(d.getTime()) ? d.getDate() : NaN;
        if (!Number.isFinite(day) || day <= 0) return undefined;
        return day;
      };

      // Prefer strict rent installments, but fall back to the first periodic installment
      // excluding known non-rent types to avoid losing the due day when types vary.
      return (
        getDueDay(rentInstallments) ??
        getDueDay(
          installments0.filter((i) => {
            const t = String(i?.نوع_الكمبيالة ?? '').trim();
            const p = String(i?.نوع_الدفعة ?? '').trim();
            if (t === 'تأمين' || t === 'فرق أيام' || t === 'دفعة أولى') return false;
            if (p === 'تأمين' || p === 'فرق أيام' || p === 'دفعة أولى') return false;
            return true;
          })
        )
      );
    })();

    const mostCommonRentValue = (() => {
      const values = rentInstallments
        .map((i) => Number(i?.القيمة || 0))
        .filter((v) => Number.isFinite(v) && v > 0);
      if (values.length === 0) return undefined;
      const map = new Map<number, number>();
      for (const v of values) map.set(v, (map.get(v) || 0) + 1);
      let best = values[0];
      let bestCount = 0;
      for (const [v, c] of map.entries()) {
        if (c > bestCount) {
          best = v;
          bestCount = c;
        }
      }
      return best;
    })();

    const paymentsPerYear = Math.max(1, Number(c0.تكرار_الدفع || 12));
    const perPayment = Math.round(Math.max(0, Number(c0.القيمة_السنوية || 0)) / paymentsPerYear);
    const rentEveryText = (() => {
      switch (paymentsPerYear) {
        case 12:
          return 'شهر';
        case 6:
          return 'شهرين';
        case 4:
          return 'ثلاثة أشهر';
        case 3:
          return 'أربعة أشهر';
        case 2:
          return 'ستة أشهر';
        case 1:
          return 'سنة';
        default:
          return '...';
      }
    })();

    const rentBillEveryText = (() => {
      const day = rentDueDayOfMonth;
      if (!day) return `كل ${rentEveryText}`;
      const dayOrdinalAr = (d: number): string => {
        const map: Record<number, string> = {
          1: 'الأول',
          2: 'الثاني',
          3: 'الثالث',
          4: 'الرابع',
          5: 'الخامس',
          6: 'السادس',
          7: 'السابع',
          8: 'الثامن',
          9: 'التاسع',
          10: 'العاشر',
          11: 'الحادي عشر',
          12: 'الثاني عشر',
          13: 'الثالث عشر',
          14: 'الرابع عشر',
          15: 'الخامس عشر',
          16: 'السادس عشر',
          17: 'السابع عشر',
          18: 'الثامن عشر',
          19: 'التاسع عشر',
          20: 'العشرون',
          21: 'الحادي والعشرون',
          22: 'الثاني والعشرون',
          23: 'الثالث والعشرون',
          24: 'الرابع والعشرون',
          25: 'الخامس والعشرون',
          26: 'السادس والعشرون',
          27: 'السابع والعشرون',
          28: 'الثامن والعشرون',
          29: 'التاسع والعشرون',
          30: 'الثلاثون',
          31: 'الحادي والثلاثون',
        };
        return map[d] || arabicNumberToWords(d);
      };

      return `في اليوم ${dayOrdinalAr(day)} من كل ${rentEveryText}`;
    })();

    const depositInst0 = installments0.find((i) => String(i?.نوع_الكمبيالة) === 'تأمين');
    const depositDueDate = String(depositInst0?.تاريخ_استحقاق || '') || undefined;
    const depositValueNumber = Math.max(0, Number(depositInst0?.القيمة ?? 0) || 0);

    const tenantRec = toRecord(t0);

    const guarantorRec = toRecord(guarantor);
    const guarantorNationalId =
      guarantor?.الرقم_الوطني ||
      (typeof guarantorRec['رقم_الهوية'] === 'string' ? (guarantorRec['رقم_الهوية'] as string) : undefined);

    const tenantNationalId =
      t0?.الرقم_الوطني ||
      (typeof tenantRec['رقم_الهوية'] === 'string' ? (tenantRec['رقم_الهوية'] as string) : undefined);

    const hasGuarantor = !!String(guarantor?.الاسم || '').trim() || !!String(guarantorNationalId || '').trim();

    const tenantsBlock = (() => {
      const lines: string[] = [];
      const n1 = String(t0?.الاسم || '').trim();
      const id1 = String(tenantNationalId || '').trim();
      if (n1 || id1) lines.push(`المستأجر:- ${n1} / الرقم الوطني:- (${id1})`);
      const n2 = String(guarantor?.الاسم || '').trim();
      const id2 = String(guarantorNationalId || '').trim();
      if (n2 || id2) lines.push(`المستأجر:- ${n2} / الرقم الوطني:- (${id2})`);
      return lines.join('\n');
    })();

    const docxData = {
      ownerName: owner?.الاسم || settings?.companyName,
      ownerNationalId: owner?.الرقم_الوطني,
      tenantName: t0?.الاسم,
      tenantNationalId,

      guarantorName: guarantor?.الاسم,
      guarantorNationalId,
      hasGuarantor,
      // Alias: treat guarantor as a second tenant line (for templates that repeat المستأجر twice).
      tenantName2: guarantor?.الاسم,
      tenantNationalId2: guarantorNationalId,
      tenantsBlock,

      propertyType: p0?.النوع,
      propertyDescriptor: p0?.الصفة || p0?.نوع_التاثيث,
      internalCode: p0?.الكود_الداخلي,
      // Backward-compatible: existing templates may use {{region}} expecting either value.
      region: p0?.المنطقة || p0?.المدينة,
      // New: allow templates to choose explicitly.
      area: p0?.المنطقة,
      city: p0?.المدينة,
      plotNo: p0?.رقم_قطعة,
      plateNo: p0?.رقم_لوحة,
      apartmentNo: p0?.رقم_شقة,
      basinName: p0?.اسم_الحوض,
      boundaries: p0?.حدود_المأجور,
      startDate: c0.تاريخ_البداية,
      contractDurationText: c0.نص_مدة_العقد,
      contractRentPaymentText: c0.نص_كيفية_أداء_البدل,
      rentValueNumber: perPayment,
      rentValueWords: arabicNumberToWords(perPayment),
      installmentValueNumber: perPayment,
      electricitySubscriptionNo: p0?.رقم_اشتراك_الكهرباء,
      electricitySubscriptionName:
        String(p0?.اسم_اشتراك_الكهرباء || '').trim() || owner?.الاسم || settings?.companyName,
      waterSubscriptionNo: p0?.رقم_اشتراك_المياه,
      waterSubscriptionName:
        String(p0?.اسم_اشتراك_المياه || '').trim() || owner?.الاسم || settings?.companyName,
      rentBillsCount,
      rentBillValue: mostCommonRentValue ?? perPayment,
      rentBillEveryText,
      rentBillsStartDate: c0.تاريخ_البداية,
      depositDueDate,
      depositValueNumber,
      depositValueWords: arabicNumberToWords(depositValueNumber),
      signatureDate: today,

      // Useful globals (optional) if the template wants them.
      companyName: settings?.companyName,
      companyPhone: settings?.companyPhone,
    };

    const filled = docxHasMustachePlaceholders(tpl.data)
      ? fillDocxTemplate(tpl.data, docxData as unknown as Record<string, unknown>)
      : fillContractMaskedDocxTemplate(tpl.data, docxData);
    if (filled.ok === false) throw new Error(filled.message || t('فشل إنشاء ملف Word'));

    const propCode = String(p0?.الكود_الداخلي || '').trim();
    const outName = `عقد-${propCode || 'عقار'}-${formatContractNumberShort(String(c0.رقم_العقد))}.docx`;
    return { bytes: filled.bytes, outName };
  };

  const handleGenerateWord = async () => {
    try {
      setIsGeneratingWord(true);
      const built = await buildFilledContractDocx();
      const outName = built.outName;
      const mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      const safeBytes = new Uint8Array(built.bytes);
      const file = new File([new Blob([safeBytes], { type: mime })], outName, { type: mime });

      const saved = await DbService.uploadAttachment('Contract', id, file);
      if (!saved.success) {
        toast.error(saved.message || t('فشل حفظ عقد Word'));
        return;
      }

      toast.success(t('تم إنشاء عقد Word وحفظه ضمن مرفقات العقد'));
      reload();
    } catch (e: unknown) {
      toast.error(getErrorMessage(e) || t('حدث خطأ أثناء توليد عقد Word'));
    } finally {
      setIsGeneratingWord(false);
    }
  };

  const handlePreviewContractWord = async () => {
    setIsContractWordPreviewBusy(true);
    try {
      const built = await buildFilledContractDocx();

      const mammothMod: unknown = await import('mammoth/mammoth.browser');
      const mammothCandidate: unknown = isRecord(mammothMod) && 'default' in mammothMod ? mammothMod.default : mammothMod;
      if (!isMammothConverter(mammothCandidate)) throw new Error('تعذر تحميل محول DOCX');
      const result = await mammothCandidate.convertToHtml({ arrayBuffer: built.bytes });

      setContractWordPreviewTitle(built.outName);
      setContractWordPreviewHtml(sanitizeDocxHtml(String(result?.value || '')));
      setIsContractWordPreviewOpen(true);
    } catch (e: unknown) {
      toast.error(getErrorMessage(e) || 'تعذر معاينة عقد Word');
    } finally {
      setIsContractWordPreviewBusy(false);
    }
  };

  const handlePrintContractWord = async () => {
    try {
      if (contractWordPreviewHtml.trim()) {
        printDocxHtml(contractWordPreviewHtml, contractWordPreviewTitle || 'عقد');
        return;
      }

      setIsContractWordPreviewBusy(true);
      const built = await buildFilledContractDocx();
      const mammothMod: unknown = await import('mammoth/mammoth.browser');
      const mammothCandidate: unknown = isRecord(mammothMod) && 'default' in mammothMod ? mammothMod.default : mammothMod;
      if (!isMammothConverter(mammothCandidate)) throw new Error('تعذر تحميل محول DOCX');
      const result = await mammothCandidate.convertToHtml({ arrayBuffer: built.bytes });
      const html = sanitizeDocxHtml(String(result?.value || ''));
      setContractWordPreviewTitle(built.outName);
      setContractWordPreviewHtml(html);
      printDocxHtml(html, built.outName);
    } catch (e: unknown) {
      toast.error(getErrorMessage(e) || 'تعذر طباعة العقد');
    } finally {
      setIsContractWordPreviewBusy(false);
    }
  };

  const getStatusColor = (status: string) => {
    if (status === 'نشط' || status === 'مجدد') return 'bg-green-100 text-green-700';
    if (status === 'منتهي') return 'bg-red-100 text-red-600';
    if (status === 'قريب الانتهاء') return 'bg-orange-100 text-orange-700';
    if (status === 'مفسوخ') return 'bg-gray-200 text-gray-700';
    return 'bg-indigo-100 text-indigo-600';
  };

  return (
    <div className="space-y-6">
      {/* Print Template */}
      <div className="hidden print:block">
        <PrintLetterhead className="mb-6" />
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold">{t('نموذج عقد إيجار')}</h1>
          <div className="text-sm text-slate-600">
            {t('التاريخ:')} {new Date().toISOString().slice(0, 10)}
          </div>
        </div>

        <div className="border border-gray-200 rounded-lg overflow-hidden mb-6">
          <table className="w-full text-right text-sm">
            <tbody className="divide-y divide-gray-200">
              <tr>
                <td className="p-3 bg-gray-50 font-bold w-48">{t('رقم العقد')}</td>
                <td className="p-3">
                  <span dir="ltr" className="font-mono break-all">
                    {c.رقم_العقد}
                  </span>
                </td>
              </tr>
              <tr>
                <td className="p-3 bg-gray-50 font-bold">{t('الحالة')}</td>
                <td className="p-3">{c.حالة_العقد}</td>
              </tr>
              <tr>
                <td className="p-3 bg-gray-50 font-bold">{t('الفترة')}</td>
                <td className="p-3">
                  {c.تاريخ_البداية} → {c.تاريخ_النهاية}
                </td>
              </tr>
              <tr>
                <td className="p-3 bg-gray-50 font-bold">{t('العقار')}</td>
                <td className="p-3">{propertyResolved?.الكود_الداخلي || c.رقم_العقار}</td>
              </tr>
              <tr>
                <td className="p-3 bg-gray-50 font-bold">{t('المستأجر')}</td>
                <td className="p-3">
                  {tenantResolved?.الاسم || c.رقم_المستاجر}{' '}
                  {tenantResolved?.رقم_الهاتف ? `• ${tenantResolved.رقم_الهاتف}` : ''}
                </td>
              </tr>
              <tr>
                <td className="p-3 bg-gray-50 font-bold">{t('القيمة السنوية')}</td>
                <td className="p-3">
                  {formatCurrencyJOD(c.القيمة_السنوية)}
                </td>
              </tr>
              <tr>
                <td className="p-3 bg-gray-50 font-bold">{t('تكرار الدفع / الطريقة')}</td>
                <td className="p-3">
                  {c.تكرار_الدفع} • {String(c.طريقة_الدفع || '')}
                </td>
              </tr>
              {c.حالة_العقد === 'مفسوخ' && c.terminationReason ? (
                <tr>
                  <td className="p-3 bg-gray-50 font-bold">{t('الفسخ')}</td>
                  <td className="p-3">
                    {c.terminationDate || ''} • {t('السبب:')} {c.terminationReason}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="p-3 bg-gray-50 font-bold">{t('جدول الدفعات')}</div>
          <table className="w-full text-right text-xs">
            <thead className="bg-white">
              <tr className="border-b border-gray-200">
                <th className="p-3">#</th>
                <th className="p-3">{t('التاريخ')}</th>
                <th className="p-3">{t('القيمة')}</th>
                <th className="p-3">{t('النوع')}</th>
                <th className="p-3">{t('الحالة')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {installments.map((inst) => (
                <tr key={inst.رقم_الكمبيالة}>
                  <td className="p-3 font-mono">{inst.ترتيب_الكمبيالة}</td>
                  <td className="p-3">{inst.تاريخ_استحقاق}</td>
                  <td className="p-3">{Number(inst.القيمة || 0).toLocaleString()}</td>
                  <td className="p-3">{inst.نوع_الكمبيالة}</td>
                  <td className="p-3">{inst.حالة_الكمبيالة}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-6 print:hidden">
        {/* Header */}
        <div className="app-card p-6">
          {c.isArchived && (
            <div className="absolute top-0 right-0 bg-slate-200 text-slate-600 px-3 py-1 text-xs font-bold rounded-bl-xl">
              {t('أرشيف')}
            </div>
          )}

          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl text-indigo-600">
                <FileText size={24} />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-800 dark:text-white whitespace-normal break-words">
                  {t('عقد')}{' '}
                  <span dir="ltr" className="font-mono break-all">
                    {c.رقم_العقد}
                  </span>
                </h1>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded font-bold ${getStatusColor(c.حالة_العقد)}`}
                >
                  {c.حالة_العقد}
                </span>
              </div>
            </div>
            <div className="text-left">
              <p className="text-xs text-slate-400">{t('القيمة السنوية')}</p>
              <p className="text-lg font-bold text-green-600">
                {formatCurrencyJOD(c.القيمة_السنوية)}
              </p>
            </div>
          </div>

          <div className="flex gap-4 text-sm text-slate-500 dark:text-slate-400 bg-gray-50 dark:bg-slate-900/50 p-3 rounded-xl">
            <div className="flex items-center gap-1">
              <Calendar size={14} /> {c.تاريخ_البداية}
            </div>
            <div className="text-gray-300">|</div>
            <div className="flex items-center gap-1">
              <Calendar size={14} /> {c.تاريخ_النهاية}
            </div>
            <div className="text-gray-300">|</div>
            <div className="flex items-center gap-1">
              <Shield size={14} /> {t('تاريخ التأمين:')} {depositInst?.تاريخ_استحقاق || '-'}
            </div>
          </div>

          {/* Quick summary (tenant/property/owner) */}
          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-700">
              <div className="text-[11px] text-slate-400 mb-1 flex items-center gap-1">
                <Home size={12} /> {t('العقار')}
              </div>
              <div className="font-bold text-slate-800 dark:text-white whitespace-normal break-words">
                {String(propertyResolved?.الكود_الداخلي || '').trim() ||
                  (String(c.رقم_العقار || '').trim() ? `#${String(c.رقم_العقار).trim()}` : '—')}
              </div>
              {String(propertyResolved?.العنوان || '').trim() ? (
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 whitespace-normal break-words">
                  {String(propertyResolved?.العنوان || '').trim()}
                </div>
              ) : null}
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-700">
              <div className="text-[11px] text-slate-400 mb-1 flex items-center gap-1">
                <User size={12} /> {t('المستأجر')}
              </div>
              <div className="font-bold text-slate-800 dark:text-white whitespace-normal break-words">
                {String(tenantResolved?.الاسم || '').trim() ||
                  (String(c.رقم_المستاجر || '').trim() ? `#${String(c.رقم_المستاجر).trim()}` : '—')}
              </div>
              {String(tenantResolved?.رقم_الهاتف || '').trim() ? (
                <div dir="ltr" className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono break-all">
                  {String(tenantResolved?.رقم_الهاتف || '').trim()}
                </div>
              ) : null}
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-700">
              <div className="text-[11px] text-slate-400 mb-1 flex items-center gap-1">
                <Shield size={12} /> {t('المالك')}
              </div>
              <div className="font-bold text-slate-800 dark:text-white whitespace-normal break-words">
                {String(resolvedOwner?.الاسم || '').trim() ||
                  (String(propertyResolved?.رقم_المالك || '').trim()
                    ? `#${String(propertyResolved?.رقم_المالك || '').trim()}`
                    : '—')}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="secondary" onClick={handlePrint}>
              <span className="inline-flex items-center gap-2">
                <Printer size={16} /> {t('طباعة / PDF')}
              </span>
            </Button>

            <Button
              variant="secondary"
              onClick={() => void handleOpenWhatsAppSendPanel()}
              disabled={isOpeningWhatsAppPanel}
            >
              <span className="inline-flex items-center gap-2">
                <MessageCircle size={16} />
                {isOpeningWhatsAppPanel ? t('جارٍ التحضير...') : t('إرسال واتساب')}
              </span>
            </Button>

            <Button variant="secondary" onClick={() => void handleQuickFollowUpForContract()}>
              <span className="inline-flex items-center gap-2">
                <ListTodo size={16} /> {t('تذكير')}
              </span>
            </Button>

            <Button
              variant="secondary"
              onClick={() => void handlePreviewContractWord()}
              disabled={isContractWordPreviewBusy || isGeneratingWord}
            >
              <span className="inline-flex items-center gap-2">
                <FileText size={16} />
                {isContractWordPreviewBusy ? t('جارٍ التحضير...') : t('معاينة قبل التوليد')}
              </span>
            </Button>

            <Button
              variant="secondary"
              onClick={() => void handlePrintContractWord()}
              disabled={isContractWordPreviewBusy || isGeneratingWord}
            >
              <span className="inline-flex items-center gap-2">
                <Printer size={16} /> {t('طباعة العقد')}
              </span>
            </Button>

            <Button variant="secondary" onClick={handleGenerateWord} disabled={isGeneratingWord}>
              <span className="inline-flex items-center gap-2">
                <FileText size={16} /> {isGeneratingWord ? t('جارٍ التوليد...') : t('توليد عقد Word')}
              </span>
            </Button>

            {storage.isDesktop() && window.desktopDb?.openAttachmentFile && (
              <Button
                variant="secondary"
                onClick={() => void handleOpenContractWordForEdit()}
                disabled={isOpeningContractWord || isGeneratingWord || isContractWordPreviewBusy}
              >
                <span className="inline-flex items-center gap-2">
                  <FileText size={16} /> {isOpeningContractWord ? t('جارٍ الفتح...') : t('تعديل العقد (Word)')}
                </span>
              </Button>
            )}
            {!c.isArchived && (
              <Button variant="secondary" onClick={handleArchive}>
                {t('أرشفة')}
              </Button>
            )}
            {(c.حالة_العقد === 'نشط' ||
              c.حالة_العقد === 'قريب الانتهاء' ||
              c.حالة_العقد === 'مجدد') && (
              <Button variant="danger" onClick={handleTerminate}>
                {t('فسخ')}
              </Button>
            )}
            {!c.linkedContractId && !c.isArchived && (
              <Button variant="primary" onClick={handleRenew}>
                {t('تجديد')}
              </Button>
            )}
            <Button variant="secondary" onClick={toggleAutoRenew}>
              {c.autoRenew ? t('إيقاف التجديد التلقائي') : t('تفعيل التجديد التلقائي')}
            </Button>

            <RBACGuard requiredPermission="EDIT_CONTRACT">
              <Button variant="primary" onClick={handleEdit}>
                {t('تعديل')}
              </Button>
            </RBACGuard>

            <RBACGuard requiredPermission="DELETE_CONTRACT">
              <Button variant="danger" onClick={handleDelete}>
                {t('حذف نهائي')}
              </Button>
            </RBACGuard>
          </div>

          {isContractWordPreviewOpen && (
            <AppModal
              open={isContractWordPreviewOpen}
              title={contractWordPreviewTitle ? `معاينة: ${contractWordPreviewTitle}` : 'معاينة عقد Word'}
              onClose={() => {
                setIsContractWordPreviewOpen(false);
                setContractWordPreviewHtml('');
                setContractWordPreviewTitle('');
              }}
              size="6xl"
              footer={
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      printDocxHtml(contractWordPreviewHtml, contractWordPreviewTitle || 'عقد');
                    }}
                    className="px-4 py-2 text-slate-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition font-bold"
                  >
                    طباعة
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsContractWordPreviewOpen(false);
                      setContractWordPreviewHtml('');
                      setContractWordPreviewTitle('');
                    }}
                    className="px-4 py-2 text-slate-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition font-bold"
                  >
                    إغلاق
                  </button>
                </div>
              }
            >
              <div className="text-sm text-slate-700 dark:text-slate-200">
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950/40 p-4 max-h-[70vh] overflow-auto">
                  {isContractWordPreviewBusy ? (
                    <div className="text-slate-500">جاري التحويل...</div>
                  ) : (
                    <div
                      className="prose prose-sm max-w-none dark:prose-invert"
                      dangerouslySetInnerHTML={{ __html: contractWordPreviewHtml }}
                    />
                  )}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-3">
                  ملاحظة: المعاينة تقريبية (تحويل DOCX إلى HTML) وقد تختلف عن التنسيق النهائي داخل Word.
                </div>
              </div>
            </AppModal>
          )}

          {/* Linking Info */}
          {(c.عقد_مرتبط || c.linkedContractId) && (
            <div className="mt-3 flex gap-4 text-xs">
              {c.عقد_مرتبط && (
                <button
                  onClick={() => openPanel('CONTRACT_DETAILS', c.عقد_مرتبط)}
                  className="flex items-center gap-1 text-indigo-600 hover:underline"
                >
                  <Link size={12} /> {t('عقد سابق')}
                </button>
              )}
              {c.linkedContractId && (
                <button
                  onClick={() => openPanel('CONTRACT_DETAILS', c.linkedContractId)}
                  className="flex items-center gap-1 text-indigo-600 hover:underline"
                >
                  <Link size={12} /> {t('عقد لاحق (تجديد)')}
                </button>
              )}
            </div>
          )}

          {/* Termination Info */}
          {c.حالة_العقد === 'مفسوخ' && c.terminationReason && (
            <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 rounded-xl text-xs text-red-700">
              <div className="font-bold flex items-center gap-1 mb-1">
                <Ban size={12} /> {t('تم الفسخ بتاريخ')} {c.terminationDate}
              </div>
              <p>
                {t('السبب:')} {c.terminationReason}
              </p>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 p-1 bg-gray-100 dark:bg-slate-900 rounded-xl w-fit">
          <button
            onClick={() => setActiveTab('details')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition ${activeTab === 'details' ? 'bg-white dark:bg-slate-700 shadow text-indigo-600' : 'text-gray-500'}`}
          >
            {t('التفاصيل والمالية')}
          </button>
          <button
            onClick={() => setActiveTab('timeline')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition ${activeTab === 'timeline' ? 'bg-white dark:bg-slate-700 shadow text-indigo-600' : 'text-gray-500'}`}
          >
            {t('التطورات والملاحظات')}
          </button>
        </div>

        {activeTab === 'details' ? (
          <div className="space-y-6 animate-fade-in">
            {/* Attachments */}
            <AttachmentManager referenceType="Contract" referenceId={id} />

            <DynamicFieldsDisplay formId="contracts" values={c.حقول_ديناميكية} />

            {/* Opportunity Number */}
            <div className="app-card overflow-hidden">
              <div className="p-4 bg-gray-50 dark:bg-slate-900/30 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between gap-3">
                <div>
                  <h4 className="font-bold text-sm flex items-center gap-2">
                    <ListTodo size={16} className="text-indigo-600" /> {t('رقم الفرصة')}
                  </h4>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {t('يُستخدم للتقارير وتتبع العمليات')}
                  </div>
                </div>
                <Button variant="secondary" onClick={handleSetOpportunityNumber}>
                  {t('إدخال / تعديل')}
                </Button>
              </div>
              <div className="p-4">
                <div className="text-2xl font-black tracking-wide dir-ltr text-slate-900 dark:text-white">
                  {String(contractCommission?.رقم_الفرصة || c?.رقم_الفرصة || '').trim() || '—'}
                </div>
              </div>
            </div>

            {/* Deal Summary */}
            <div className="app-card overflow-hidden">
              <div className="p-4 bg-gray-50 dark:bg-slate-900/30 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between gap-3">
                <h4 className="font-bold text-sm flex items-center gap-2">
                  <DollarSign size={16} className="text-emerald-600" /> {t('ملخص الصفقة')}
                </h4>
                <Button variant="secondary" onClick={handleEditCommissions}>
                  {t('تعديل العمولة')}
                </Button>
              </div>
              <div className="p-4 grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-700">
                  <div className="text-xs text-slate-500">{t('إجمالي الإيجارات')}</div>
                  <div className="font-black text-slate-800 dark:text-white">
                    {formatCurrencyJOD(dealSummary.rentTotal)}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-700">
                  <div className="text-xs text-slate-500">{t('المدفوع')}</div>
                  <div className="font-black text-green-600">
                    {formatCurrencyJOD(dealSummary.rentPaid)}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-700">
                  <div className="text-xs text-slate-500">{t('المتبقي')}</div>
                  <div className="font-black text-orange-600">
                    {formatCurrencyJOD(dealSummary.rentRemaining)}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-700">
                  <div className="text-xs text-slate-500">{t('التأمين')}</div>
                  <div className="font-black text-purple-700 dark:text-purple-300">
                    {formatCurrencyJOD(dealSummary.depositValue)}
                  </div>
                </div>
              </div>
              <div className="px-4 pb-4 grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 rounded-xl bg-indigo-50/60 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30">
                  <div className="text-xs text-slate-500">{t('العمولة (المالك)')}</div>
                  <div className="font-black text-indigo-700 dark:text-indigo-300">
                    {formatCurrencyJOD(dealSummary.commissionOwner)}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-indigo-50/60 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30">
                  <div className="text-xs text-slate-500">{t('العمولة (المستأجر)')}</div>
                  <div className="font-black text-indigo-700 dark:text-indigo-300">
                    {formatCurrencyJOD(dealSummary.commissionTenant)}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 col-span-2">
                  <div className="text-xs text-slate-500">{t('صافي ربح المكتب (إجمالي العمولات)')}</div>
                  <div className="font-black text-emerald-700 dark:text-emerald-300">
                    {formatCurrencyJOD(dealSummary.netOfficeProfit)}
                  </div>
                </div>
              </div>
            </div>

            {/* Employee Commission Breakdown */}
            {(() => {
              const introEnabled = !!contractCommission?.يوجد_ادخال_عقار;

              // ✅ الشريحة تُحسب على إجمالي عمولات الإيجار للشهر (تاريخ/شهر العمولة)
              const tier = getRentalTier(monthRentalOfficeTotal);
              const tierLabel = (() => {
                if (tier.tierId === '500-999') return '500 - 999 (10%)';
                if (tier.tierId === '1000-1999') return '1000 - 1999 (15%)';
                if (tier.tierId === '2000-2999') return '2000 - 2999 (20%)';
                if (tier.tierId === '3000-3999') return '3000 - 3999 (25%)';
                return t('خارج الشرائح');
              })();

              // ✅ أساس الحساب: إجمالي عمولة العملية (المالك + المستأجر)
              const officeTotalForContract =
                Math.max(0, Number(dealSummary.commissionOwner || 0)) +
                Math.max(0, Number(dealSummary.commissionTenant || 0));
              const employeeBase = officeTotalForContract * tier.rate;
              const introEarned = introEnabled ? officeTotalForContract * 0.05 : 0;
              const employeeFinal = employeeBase + introEarned;

              return (
                <div className="app-card overflow-hidden">
                  <div className="p-4 bg-gray-50 dark:bg-slate-900/30 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between gap-3">
                    <div>
                      <h4 className="font-bold text-sm flex items-center gap-2">
                        <DollarSign size={16} className="text-emerald-600" /> {t('عمولة الموظف (تفصيل)')}
                      </h4>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {t('شريحة الإيجار تعتمد فقط على إجمالي عمولة الإيجار (بدون إدخال العقار)')}
                      </div>
                    </div>
                    <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300 select-none">
                      <input
                        type="checkbox"
                        checked={introEnabled}
                        onChange={(e) => handleTogglePropertyIntro(e.target.checked)}
                      />
                      {t('عمولة إدخال عقار (5%)')}
                    </label>
                  </div>

                  <div className="p-4 grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-700">
                      <div className="text-xs text-slate-500">{t('شهر العمولة')}</div>
                      <div className="font-black text-slate-800 dark:text-white" dir="ltr">
                        {contractCommissionMonthKey || '—'}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-indigo-50/60 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30">
                      <div className="text-xs text-slate-500">{t('الشريحة')}</div>
                      <div className="font-black text-indigo-700 dark:text-indigo-300">
                        {tierLabel}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30">
                      <div className="text-xs text-slate-500">
                        {t('عمولة العملية (المالك + المستأجر)')}
                      </div>
                      <div className="font-black text-emerald-700 dark:text-emerald-300">
                        {formatCurrencyJOD(officeTotalForContract)}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-purple-50/60 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-900/30">
                      <div className="text-xs text-slate-500">
                        {t('إدخال عقار (5% من إجمالي العمولة)')}
                      </div>
                      <div className="font-black text-purple-700 dark:text-purple-300">
                        {formatCurrencyJOD(introEarned)}
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-700 md:col-span-4">
                      <div className="text-xs text-slate-500">{t('تفاصيل الحساب')}</div>
                      <div className="mt-1 text-sm text-slate-700 dark:text-slate-200 leading-6">
                        {t('إجمالي عمولات الإيجار لهذا الشهر (للمكتب):')}{' '}
                        <b>
                          {formatCurrencyJOD(monthRentalOfficeTotal)}
                        </b>
                        <span className="text-slate-400"> — </span>
                        {t('النسبة:')} <b dir="ltr">{Math.round(tier.rate * 100)}%</b>
                        <span className="text-slate-400"> — </span>
                        {t('قبل الإدخال:')}{' '}
                        <b>
                          {formatCurrencyJOD(employeeBase)}
                        </b>
                        <span className="text-slate-400"> — </span>
                        {t('الإجمالي:')}{' '}
                        <b>
                          {formatCurrencyJOD(employeeFinal)}
                        </b>
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {t(
                          'المعادلة: قبل الإدخال = (عمولة العملية) × (نسبة الشريحة). إدخال عقار = (عمولة العملية) × 5%. الإجمالي = قبل الإدخال + إدخال عقار.'
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Relations */}
            <div className="grid grid-cols-2 gap-4">
              <div
                onClick={() => openPanel('PROPERTY_DETAILS', propertyResolved?.رقم_العقار)}
                className="app-card p-4 rounded-xl cursor-pointer hover:border-indigo-300 transition border-gray-100 dark:border-slate-700"
              >
                <p className="text-xs text-slate-400 mb-1 flex items-center gap-1">
                  <Home size={12} /> {t('العقار')}
                </p>
                <p className="font-bold text-sm text-slate-800 dark:text-white whitespace-normal break-words">
                  {propertyResolved?.الكود_الداخلي}
                </p>
              </div>
              <div
                onClick={() => openPanel('PERSON_DETAILS', tenantResolved?.رقم_الشخص)}
                className="app-card p-4 rounded-xl cursor-pointer hover:border-indigo-300 transition border-gray-100 dark:border-slate-700"
              >
                <p className="text-xs text-slate-400 mb-1 flex items-center gap-1">
                  <User size={12} /> {t('المستأجر')}
                </p>
                <p className="font-bold text-sm text-slate-800 dark:text-white whitespace-normal break-words">
                  {tenantResolved?.الاسم}
                </p>
              </div>
            </div>

            {/* Installments */}
            <div className="app-card overflow-hidden">
              <div className="p-4 bg-gray-50 dark:bg-slate-900/30 border-b border-gray-100 dark:border-slate-700">
                <h4 className="font-bold text-sm flex items-center gap-2">
                  <DollarSign size={16} className="text-green-500" /> {t('جدول الدفعات')}
                </h4>
              </div>
              <div className="max-h-64 overflow-auto">
                <table className="w-full text-right text-xs table-fixed min-w-[760px]">
                  <thead className="text-gray-400 bg-white dark:bg-slate-800 sticky top-0">
                    <tr>
                      <th className="p-3">#</th>
                      <th className="p-3">{t('التاريخ')}</th>
                      <th className="p-3">{t('القيمة')}</th>
                      <th className="p-3">{t('الحالة')}</th>
                      <th className="p-3">{t('إجراءات')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                    {installments.map((inst) => (
                      <tr
                        key={inst.رقم_الكمبيالة}
                        className={
                          inst.نوع_الكمبيالة === 'تأمين' ? 'bg-purple-50 dark:bg-purple-900/10' : ''
                        }
                      >
                        <td className="p-3 font-mono">{inst.ترتيب_الكمبيالة}</td>
                        <td className="p-3">
                          <div className="flex flex-col gap-1">
                            <div>{inst.تاريخ_استحقاق}</div>
                            {String(inst.تاريخ_التأجيل || '').trim() ? (
                              <div className="flex flex-wrap items-center gap-2">
                                <StatusBadge status="مؤجلة" className="!px-2 !py-0.5" />
                                <div className="text-[10px] font-bold text-indigo-600 dark:text-indigo-300">
                                  {t('مؤجل بتاريخ:')} {String(inst.تاريخ_التأجيل)}
                                  {String(inst.تاريخ_الاستحقاق_السابق || '').trim()
                                    ? ` (${t('كان:')} ${String(inst.تاريخ_الاستحقاق_السابق)})`
                                    : ''}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        </td>
                        <td className="p-3 font-bold">
                          {Number(inst.القيمة || 0).toLocaleString()}
                        </td>
                        <td className="p-3">
                          {inst.حالة_الكمبيالة === 'مدفوع' ? (
                            <CheckCircle size={14} className="text-green-500" />
                          ) : inst.حالة_الكمبيالة === 'متأخر' ? (
                            <AlertTriangle size={14} className="text-red-500" />
                          ) : inst.حالة_الكمبيالة === 'ملغي' ? (
                            <span className="text-gray-400 decoration-line-through">{t('ملغي')}</span>
                          ) : (
                            <Clock size={14} className="text-yellow-500" />
                          )}
                        </td>
                        <td className="p-3">
                          {inst.حالة_الكمبيالة !== 'مدفوع' &&
                            inst.حالة_الكمبيالة !== 'ملغي' &&
                            can(userRole, 'INSTALLMENT_EDIT') && (
                              <button
                                onClick={async () => {
                                  const value = await dialogs.prompt({
                                    title: t('تأجيل التحصيل'),
                                    message: t('اختر التاريخ الجديد لتحصيل الدفعة'),
                                    inputType: 'date',
                                    defaultValue: String(inst.تاريخ_استحقاق || ''),
                                    required: true,
                                  });
                                  if (!value) return;

                                  const note = await dialogs.prompt({
                                    title: t('ملاحظة (اختياري)'),
                                    message: t('سبب التأجيل أو أي ملاحظة (اختياري):'),
                                    inputType: 'text',
                                    defaultValue: '',
                                    required: false,
                                  });

                                  const dbExt = DbService as unknown as Partial<{
                                    postponeInstallmentCollection: (
                                      installmentId: string,
                                      newDueDate: string,
                                      note?: string
                                    ) => unknown;
                                  }>;

                                  const res = dbExt.postponeInstallmentCollection?.(
                                    String(inst.رقم_الكمبيالة),
                                    String(value),
                                    note ? String(note) : undefined
                                  );
                                  if (res !== undefined && toRecord(res)['success'] === false) {
                                    dialogs.toast.error(
                                      String(toRecord(res)['message'] || '') || t('تعذر تأجيل التحصيل')
                                    );
                                    return;
                                  }

                                  dialogs.toast.success(t('تم تأجيل التحصيل وربطه بالتذكير والتنبيهات'));
                                  reload();
                                }}
                                className="px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-200 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition text-[11px] font-bold"
                              >
                                {t('تأجيل')}
                              </button>
                            )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-slide-up h-full">
            <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-gray-200 dark:border-slate-700 overflow-y-auto max-h-[500px] custom-scrollbar">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                <History className="text-indigo-500" size={20} /> {t('سجل تطورات العقد')}
              </h3>
              <ActivityTimeline referenceId={id} type="Contract" />
            </div>
            <div>
              <NotesSection referenceId={id} type="Contract" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};


