import { useState, useEffect, useCallback, useMemo } from 'react';
import { DbService } from '@/services/mockDb';
import { الأشخاص_tbl, العقارات_tbl, العقود_tbl, tbl_Alerts } from '@/types';
import { useSmartModal } from '@/context/ModalContext';
import { useToast } from '@/context/ToastContext';
import { openWhatsAppForPhones } from '@/utils/whatsapp';
import { getDefaultWhatsAppCountryCodeSync } from '@/services/geoSettings';
import { ROUTE_PATHS } from '@/routes/paths';
import { executeAlertOpen, getAlertPrimarySpec } from '@/services/alerts/alertActionPolicy';
import { useDbSignal } from '@/hooks/useDbSignal';
import { NotificationTemplates } from '@/services/notificationTemplates';
import { useResponsivePageSize } from '@/hooks/useResponsivePageSize';

const isExpiryKind = (value: string): value is 'pre_notice' | 'approved' | 'rejected' | 'auto' => {
  return value === 'pre_notice' || value === 'approved' || value === 'rejected' || value === 'auto';
};

export const useAlerts = (isVisible: boolean) => {
  const [alerts, setAlerts] = useState<tbl_Alerts[]>([]);
  const [selectedAlert, setSelectedAlert] = useState<tbl_Alerts | null>(null);
  const [noteText, setNoteText] = useState('');

  const pageSize = useResponsivePageSize({ base: 6, sm: 8, md: 10, lg: 12, xl: 14, '2xl': 16 });
  const [page, setPage] = useState(1);

  const [only, setOnly] = useState<'unread' | 'all'>('unread');
  const [category, setCategory] = useState<string>('');
  const [q, setQ] = useState<string>('');
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);

  const [expiryKind, setExpiryKind] = useState<'pre_notice' | 'approved' | 'rejected' | 'auto'>(
    'pre_notice'
  );

  const { openPanel } = useSmartModal();
  const toast = useToast();
  const dbSignal = useDbSignal();

  const loadAlerts = useCallback(() => {
    const all = DbService.getAlerts() || [];

    try {
      const cats = Array.from(
        new Set(all.map((a) => String(a.category || '').trim()).filter(Boolean))
      ).sort((a, b) => a.localeCompare(b));
      setAvailableCategories(cats);
    } catch {
      setAvailableCategories([]);
    }

    let next = all;

    if (only === 'unread') {
      next = next.filter((a) => !a.تم_القراءة);
    }

    if (category) {
      next = next.filter((a) => String(a.category || '').trim() === category);
    }

    const needle = q.trim().toLowerCase();
    if (needle) {
      next = next.filter((a) => {
        const parts = [a.نوع_التنبيه, a.الوصف, a.tenantName, a.propertyCode, a.phone].map((x) =>
          String(x ?? '').toLowerCase()
        );
        return parts.some((p) => p.includes(needle));
      });
    }

    setAlerts(next);
  }, [only, category, q]);

  useEffect(() => {
    if (isVisible) loadAlerts();
  }, [dbSignal, loadAlerts, isVisible]);

  useEffect(() => {
    setPage(1);
  }, [only, category, q, pageSize]);

  const pageCount = useMemo(() => Math.max(1, Math.ceil((alerts.length || 0) / pageSize)), [
    alerts.length,
    pageSize,
  ]);

  useEffect(() => {
    setPage((p) => Math.min(Math.max(1, p), pageCount));
  }, [pageCount]);

  const pagedAlerts = useMemo(() => {
    return alerts.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize);
  }, [alerts, page, pageSize]);

  // Support deep links: #/alerts?only=unread|all&category=...&q=...
  useEffect(() => {
    const applyFromHash = () => {
      try {
        const raw = String(window.location.hash || '').startsWith('#')
          ? String(window.location.hash || '').slice(1)
          : String(window.location.hash || '');
        const qIndex = raw.indexOf('?');
        const pathOnly = qIndex >= 0 ? raw.slice(0, qIndex) : raw;
        /** خارج صفحة التنبيهات: لا نطبّق معاملات URL على الحالة ونمسح البحث حتى لا يبقى نص الفلتر */
        if (pathOnly !== ROUTE_PATHS.ALERTS) {
          setQ('');
          setCategory('');
          return;
        }

        const search = qIndex >= 0 ? raw.slice(qIndex + 1) : '';
        const params = new URLSearchParams(search);

        const onlyParam = String(params.get('only') || '').trim();
        if (onlyParam === 'all' || onlyParam === 'unread') {
          setOnly(onlyParam);
        }

        const cat = String(params.get('category') || '').trim();
        setCategory(cat);

        if (params.has('q')) {
          setQ(String(params.get('q') || ''));
        }
      } catch {
        // ignore
      }
    };

    applyFromHash();
    let lastHashAlerts = window.location.hash;
    const onHashChangeAlerts = () => {
      const current = window.location.hash;
      if (current === lastHashAlerts) return;
      lastHashAlerts = current;
      applyFromHash();
    };
    window.addEventListener('hashchange', onHashChangeAlerts);
    return () => window.removeEventListener('hashchange', onHashChangeAlerts);
  }, []);

  useEffect(() => {
    setExpiryKind('pre_notice');
  }, [selectedAlert?.id]);

  const handleMarkAllRead = useCallback(async () => {
    const ok = await toast.confirm({
      title: 'تأكيد',
      message: 'هل تريد فعلاً تعليم كل التنبيهات كمقروءة؟ ستختفي من القائمة.',
      confirmText: 'نعم',
      cancelText: 'إلغاء',
      isDangerous: false,
    });
    if (!ok) return;
    DbService.markAllAlertsAsRead();
    loadAlerts();
  }, [toast, loadAlerts]);

  const handleDismiss = useCallback(
    (alert: tbl_Alerts) => {
      if (alert.category === 'Financial' && alert.details && alert.details.length > 0) {
        const childIds = alert.details.map((d) => d.id);
        DbService.markMultipleAlertsAsRead(childIds);
      } else {
        DbService.markAlertAsRead(alert.id);
      }

      loadAlerts();
      if (selectedAlert?.id === alert.id) setSelectedAlert(null);
    },
    [loadAlerts, selectedAlert?.id]
  );

  /** من المودال: إغلاق المودال ثم فتح الوجهة (سياسة موحّدة في `alertActionPolicy`) */
  const handleNavigate = useCallback(
    (alert: tbl_Alerts) => {
      setSelectedAlert(null);
      executeAlertOpen(alert, openPanel);
    },
    [openPanel]
  );

  /**
   * من بطاقة القائمة: إمّا مودال الإجراءات الغني أو فتح الوجهة مباشرة (أقل نقرات) حسب نوع التنبيه.
   */
  const handleAlertCardPrimary = useCallback(
    (alert: tbl_Alerts) => {
      const spec = getAlertPrimarySpec(alert);
      if (spec.mode === 'modal') {
        setSelectedAlert(alert);
      } else {
        executeAlertOpen(alert, openPanel);
      }
    },
    [openPanel]
  );

  const resolveAlertPhones = useCallback((alert: tbl_Alerts): string[] => {
    const phones: Array<string | null | undefined> = [alert.phone];

    if (alert.مرجع_الجدول === 'الأشخاص_tbl' && alert.مرجع_المعرف) {
      const people = (DbService.getPeople?.() || []) as الأشخاص_tbl[];
      const person = people.find((p) => String(p?.رقم_الشخص) === String(alert.مرجع_المعرف));
      phones.push(person?.رقم_الهاتف, person?.رقم_هاتف_اضافي);
    }

    if (alert.مرجع_الجدول === 'العقود_tbl' && alert.مرجع_المعرف) {
      const contracts = (DbService.getContracts?.() || []) as العقود_tbl[];
      const contract = contracts.find((c) => String(c?.رقم_العقد) === String(alert.مرجع_المعرف));
      if (contract?.رقم_المستاجر) {
        const people = (DbService.getPeople?.() || []) as الأشخاص_tbl[];
        const tenant = people.find((p) => String(p?.رقم_الشخص) === String(contract.رقم_المستاجر));
        phones.push(tenant?.رقم_الهاتف, tenant?.رقم_هاتف_اضافي);
      }
    }

    const uniq = new Set<string>();
    for (const p of phones) {
      const v = String(p ?? '').trim();
      if (v) uniq.add(v);
    }
    return Array.from(uniq);
  }, []);

  const resolveOwnerPhonesForContract = useCallback((contractId: string): string[] => {
    const contracts = (DbService.getContracts?.() || []) as العقود_tbl[];
    const contract = contracts.find((c) => String(c?.رقم_العقد) === String(contractId));
    const property = contract?.رقم_العقار
      ? ((DbService.getProperties?.() || []) as العقارات_tbl[]).find(
          (p) => String(p?.رقم_العقار) === String(contract.رقم_العقار)
        )
      : null;
    const owner = property?.رقم_المالك
      ? ((DbService.getPeople?.() || []) as الأشخاص_tbl[]).find(
          (p) => String(p?.رقم_الشخص) === String(property.رقم_المالك)
        )
      : null;

    const phones: Array<string | null | undefined> = [owner?.رقم_الهاتف, owner?.رقم_هاتف_اضافي];
    const uniq = new Set<string>();
    for (const p of phones) {
      const v = String(p ?? '').trim();
      if (v) uniq.add(v);
    }
    return Array.from(uniq);
  }, []);

  const getFixedExpiryTemplateId = useCallback(
    (target: 'tenant' | 'owner') => {
      const map = {
        pre_notice: {
          tenant: 'contract_expiry_pre_notice_tenant_fixed',
          owner: 'contract_expiry_pre_notice_owner_fixed',
        },
        approved: {
          tenant: 'contract_renewal_approved_tenant_fixed',
          owner: 'contract_renewal_approved_owner_fixed',
        },
        rejected: {
          tenant: 'contract_renewal_rejected_tenant_fixed',
          owner: 'contract_renewal_rejected_owner_fixed',
        },
        auto: {
          tenant: 'contract_renewal_auto_tenant_fixed',
          owner: 'contract_renewal_auto_owner_fixed',
        },
      } as const;
      return map[expiryKind][target];
    },
    [expiryKind]
  );

  const sendFixedExpiryWhatsApp = useCallback(
    (target: 'tenant' | 'owner') => {
      if (!selectedAlert) return;
      if (selectedAlert.مرجع_الجدول !== 'العقود_tbl') return;
      if (!selectedAlert.مرجع_المعرف || selectedAlert.مرجع_المعرف === 'batch') return;

      const contractId = String(selectedAlert.مرجع_المعرف);
      const tmplId = getFixedExpiryTemplateId(target);
      const generated = DbService.generateLegalNotice(tmplId, contractId, {
        date: new Date().toLocaleDateString('en-GB'),
        time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      });

      const message = String(
        typeof generated === 'string' ? generated : (generated as { text: string })?.text || ''
      ).trim();
      if (!message) return;

      const phones =
        target === 'tenant'
          ? resolveAlertPhones(selectedAlert)
          : resolveOwnerPhonesForContract(contractId);
      if (phones.length === 0) return;

      void openWhatsAppForPhones(message, phones, {
        defaultCountryCode: getDefaultWhatsAppCountryCodeSync(),
        delayMs: 10_000,
      });
    },
    [selectedAlert, getFixedExpiryTemplateId, resolveAlertPhones, resolveOwnerPhonesForContract]
  );

  const sendDataQualityPropertyWhatsApp = useCallback(async () => {
    if (!selectedAlert) return;
    if (selectedAlert.category !== 'DataQuality') return;
    if (selectedAlert.مرجع_الجدول !== 'العقارات_tbl') return;
    if (!selectedAlert.details || selectedAlert.details.length === 0) return;

    const tmpl = NotificationTemplates.getById('data_quality_missing_property_utils_fixed');
    if (!tmpl || !tmpl.enabled) {
      toast.warning('قالب إشعار نقص بيانات العقار غير متاح');
      return;
    }

    type OwnerGroup = {
      ownerName: string;
      phones: string[];
      lines: string[];
    };

    const groups = new Map<string, OwnerGroup>();

    for (const d of selectedAlert.details) {
      const propertyId = String(d?.id ?? '');
      if (!propertyId) continue;

      const property = ((DbService.getProperties?.() || []) as العقارات_tbl[]).find(
        (p) => String(p?.رقم_العقار) === propertyId
      );
      const ownerId = property?.رقم_المالك;
      const owner = ownerId
        ? ((DbService.getPeople?.() || []) as الأشخاص_tbl[]).find(
            (p) => String(p?.رقم_الشخص) === String(ownerId)
          )
        : null;

      const propLabel = String(
        d?.name || property?.الكود_الداخلي || property?.رقم_العقار || propertyId
      );
      const missingFields = Array.isArray(d?.missingFields)
        ? d.missingFields.map((x) => String(x ?? '').trim()).filter(Boolean)
        : [];

      const getMissingFieldLabel = (field: string) => {
        if (field === 'رقم_اشتراك_الكهرباء') return 'رقم اشتراك الكهرباء';
        if (field === 'رقم_اشتراك_المياه') return 'رقم اشتراك المياه';
        return field;
      };

      const missingText = missingFields.length
        ? missingFields.map(getMissingFieldLabel).join('، ')
        : 'بيانات ناقصة';
      const line = `• ${propLabel} (ناقص: ${missingText})`;

      if (!owner || !ownerId) continue;

      const phones = [owner?.رقم_الهاتف, owner?.رقم_هاتف_اضافي]
        .filter(Boolean)
        .map((x) => String(x).trim())
        .filter(Boolean);

      if (phones.length === 0) continue;

      const existing = groups.get(String(ownerId));
      if (!existing) {
        groups.set(String(ownerId), {
          ownerName: String(owner?.الاسم || 'المالك'),
          phones,
          lines: [line],
        });
      } else {
        existing.lines.push(line);
        const merged = new Set([...(existing.phones || []), ...phones]);
        existing.phones = Array.from(merged);
      }
    }

    const list = Array.from(groups.values());
    for (const g of list) {
      const message = NotificationTemplates.fill(tmpl, {
        اسم_المالك: g.ownerName,
        قائمة_العقارات: g.lines.join('\n'),
      });
      await openWhatsAppForPhones(message, g.phones, {
        defaultCountryCode: getDefaultWhatsAppCountryCodeSync(),
        delayMs: 10_000,
      });
      await new Promise((r) => setTimeout(r, 250));
    }
  }, [selectedAlert, toast]);

  const sendWhatsApp = useCallback(() => {
    if (!selectedAlert) return;

    if (selectedAlert.category === 'DataQuality' && selectedAlert.مرجع_الجدول === 'العقارات_tbl') {
      void sendDataQualityPropertyWhatsApp();
      return;
    }

    if (
      selectedAlert.category === 'Expiry' &&
      selectedAlert.مرجع_الجدول === 'العقود_tbl' &&
      selectedAlert.مرجع_المعرف &&
      selectedAlert.مرجع_المعرف !== 'batch'
    ) {
      sendFixedExpiryWhatsApp('tenant');
      return;
    }

    const phones = resolveAlertPhones(selectedAlert);
    if (phones.length === 0) return;

    let message = '';
    if (selectedAlert.count && selectedAlert.count > 1 && selectedAlert.category === 'Financial') {
      message = `مرحباً ${selectedAlert.tenantName}،\nنود تذكيركم قبل الاستحقاق بوجود ${selectedAlert.count} دفعات قريبة الاستحقاق للعقار (${selectedAlert.propertyCode}).\n${selectedAlert.الوصف}.\nيرجى السداد قبل موعد الاستحقاق.`;
    } else if (selectedAlert.category === 'Financial') {
      message = `مرحباً ${selectedAlert.tenantName}،\nنود تذكيركم قبل الاستحقاق بوجود دفعة قريبة الاستحقاق للعقار (${selectedAlert.propertyCode}).\n${selectedAlert.الوصف}.\nيرجى السداد قبل موعد الاستحقاق.`;
    } else if (selectedAlert.category === 'Expiry') {
      message = `مرحباً ${selectedAlert.tenantName}،\nعقد الإيجار الخاص بالعقار (${selectedAlert.propertyCode}) قارب على الانتهاء.\nيرجى مراجعة المكتب للتجديد.`;
    } else if (selectedAlert.category === 'Risk') {
      message = `مرحباً ${selectedAlert.tenantName}،\nيرجى مراجعة المكتب للأهمية بخصوص تسوية الذمم المالية العالقة.`;
    } else {
      message = `مرحباً ${selectedAlert.tenantName}،\nإشعار بخصوص العقار (${selectedAlert.propertyCode}):\n${selectedAlert.الوصف}`;
    }

    void openWhatsAppForPhones(message, phones, {
      defaultCountryCode: getDefaultWhatsAppCountryCodeSync(),
      delayMs: 10_000,
    });
  }, [selectedAlert, resolveAlertPhones, sendDataQualityPropertyWhatsApp, sendFixedExpiryWhatsApp]);

  const openLegalNotice = useCallback(() => {
    if (selectedAlert?.مرجع_المعرف && selectedAlert.مرجع_المعرف !== 'batch') {
      openPanel('LEGAL_NOTICE_GENERATOR', selectedAlert.مرجع_المعرف);
    }
  }, [selectedAlert, openPanel]);

  const saveNote = useCallback(() => {
    if (!selectedAlert || !noteText.trim()) return;
    if (selectedAlert.مرجع_المعرف !== 'batch') {
      DbService.addEntityNote(selectedAlert.مرجع_الجدول, selectedAlert.مرجع_المعرف, noteText);
      setNoteText('');
      toast.success('تم حفظ الملاحظة بنجاح');
    } else {
      toast.warning('يرجى الانتقال للسجل المحدد لإضافة ملاحظة، هذا تنبيه مجمّع.');
    }
  }, [selectedAlert, noteText, toast]);

  const handleUpdateAndScan = useCallback(() => {
    DbService.runDailyScheduler();
    loadAlerts();
    toast.success('تم تحديث التنبيهات وإجراء المسح الشامل');
  }, [loadAlerts, toast]);

  return {
    alerts,
    pagedAlerts,
    availableCategories,
    selectedAlert,
    setSelectedAlert,
    noteText,
    setNoteText,
    only,
    setOnly,
    category,
    setCategory,
    q,
    setQ,
    page,
    setPage,
    pageCount,
    expiryKind,
    setExpiryKind,
    handleMarkAllRead,
    handleDismiss,
    handleNavigate,
    handleAlertCardPrimary,
    getAlertPrimarySpec,
    sendWhatsApp,
    sendFixedExpiryWhatsApp,
    openLegalNotice,
    saveNote,
    handleUpdateAndScan,
    isExpiryKind,
  };
};
