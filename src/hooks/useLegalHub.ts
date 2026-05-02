import { useEffect, useRef, useState, useCallback, type FormEvent } from 'react';
import { DbService } from '@/services/mockDb';
import { openWhatsAppForPhones } from '@/utils/whatsapp';
import { getDefaultWhatsAppCountryCodeSync } from '@/services/geoSettings';
import { applyOfficialBrandSignature } from '@/utils/brandSignature';
import {
  ContractDetailsResult,
  LegalNoticeRecord,
  LegalNoticeTemplate,
  الأشخاص_tbl,
  العقارات_tbl,
  العقود_tbl,
  الكمبيالات_tbl,
} from '@/types';
import { useToast } from '@/context/ToastContext';
import { safeCopyToClipboard } from '@/utils/clipboard';
import { printTextUnified } from '@/services/printing/unifiedPrint';
import { useSmartModal } from '@/context/ModalContext';
import { domainGetSmart, installmentsContractsPagedSmart } from '@/services/domainQueries';
import { useDbSignal } from '@/hooks/useDbSignal';
import { getInstallmentPaidAndRemaining } from '@/utils/installments';
import { toDateOnly, parseDateOnly, daysBetweenDateOnly } from '@/utils/dateOnly';
import { formatContractNumberShort } from '@/utils/contractNumber';

type DesktopContractBundle = {
  contract: العقود_tbl | null;
  tenant: الأشخاص_tbl | null;
  property: العقارات_tbl | null;
  owner: الأشخاص_tbl | null;
  installments: الكمبيالات_tbl[];
};

export const useLegalHub = (isVisible: boolean) => {
  const isDesktopFast = typeof window !== 'undefined' && !!window.desktopDb?.domainGet;

  const [history, setHistory] = useState<LegalNoticeRecord[]>([]);
  const [contracts, setContracts] = useState<العقود_tbl[]>([]);
  const [templates, setTemplates] = useState<LegalNoticeTemplate[]>([]);
  const [historySearch, setHistorySearch] = useState('');
  const [historyPage, setHistoryPage] = useState(1);

  // Generator State
  const [selectedContractId, setSelectedContractId] = useState('');
  const [selectedContractTenantId, setSelectedContractTenantId] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [generatedText, setGeneratedText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const generationSeqRef = useRef(0);

  // Send approval
  const [pendingSend, setPendingSend] = useState<null | {
    method: 'WhatsApp' | 'Email' | 'Print';
    contractId: string;
    templateId: string;
    templateTitle: string;
    textSnapshot: string;
  }>(null);

  // History edit modal
  const [editingHistory, setEditingHistory] = useState<LegalNoticeRecord | null>(null);
  const [editNote, setEditNote] = useState('');
  const [editReply, setEditReply] = useState('');

  // New Template Modal State
  const [isAddTemplateOpen, setIsAddTemplateOpen] = useState(false);
  const [newTemplateForm, setNewTemplateForm] = useState<
    Pick<LegalNoticeTemplate, 'title' | 'category' | 'content'>
  >({
    title: '',
    category: 'General',
    content: '',
  });

  // Variables modal
  const [isVariablesOpen, setIsVariablesOpen] = useState(false);

  const toast = useToast();
  const { openPanel } = useSmartModal();
  const dbSignal = useDbSignal();

  const refreshData = useCallback(() => {
    setHistory(DbService.getLegalNoticeHistory().reverse());
    // على Desktop: ContractPicker يحمّل العقود عبر contractPickerSearchSmart
    // هذه الحالة تستخدم فقط في مسار !isDesktopFast (DbService)
    setContracts(isDesktopFast ? [] : DbService.getContracts());
    setTemplates(DbService.getLegalTemplates());
  }, [isDesktopFast]);

  useEffect(() => {
    if (isVisible) refreshData();
  }, [isVisible, refreshData, dbSignal]);

  const getDesktopContractBundle = useCallback(async (contractId: string) => {
    const cid = String(contractId || '').trim();
    if (!cid) return null;

    let installments: الكمبيالات_tbl[] = [];
    let contract: العقود_tbl | null = null;
    let tenant: الأشخاص_tbl | null = null;
    let property: العقارات_tbl | null = null;

    try {
      const res = await installmentsContractsPagedSmart({
        query: cid,
        filter: 'all',
        offset: 0,
        limit: 1,
      });
      const first = res.items[0] || null;
      if (first?.contract) contract = first.contract;
      if (first?.tenant) tenant = first.tenant;
      if (first?.property) property = first.property;
      installments = Array.isArray(first?.installments) ? first.installments : [];
    } catch {
      // ignore
    }

    if (!contract) contract = await domainGetSmart('contracts', cid);
    if (!tenant && contract?.رقم_المستاجر)
      tenant = await domainGetSmart('people', String(contract.رقم_المستاجر));
    if (!property && contract?.رقم_العقار)
      property = await domainGetSmart('properties', String(contract.رقم_العقار));

    const ownerId = property?.رقم_المالك ? String(property.رقم_المالك) : '';
    const owner = ownerId ? await domainGetSmart('people', ownerId) : null;

    return { contract, tenant, property, owner, installments } satisfies DesktopContractBundle;
  }, []);

  const handleGenerate = useCallback(() => {
    if (!selectedTemplateId || !selectedContractId) {
      setGeneratedText('');
      return;
    }

    if (isDesktopFast) {
      const seq = ++generationSeqRef.current;
      void (async () => {
        setIsGenerating(true);
        try {
        const tmpl = templates.find((t) => t.id === selectedTemplateId);
        if (!tmpl) return;

        const bundle = await getDesktopContractBundle(selectedContractId);
        if (seq !== generationSeqRef.current) return;
        if (!bundle?.contract) {
          setGeneratedText('');
          return;
        }

        const contract = bundle.contract;
        const tenant = bundle.tenant;
        const property = bundle.property;
        const owner = bundle.owner;
        const installments = Array.isArray(bundle.installments) ? bundle.installments : [];

        const today = toDateOnly(new Date());

        const installmentsWithRemaining = installments
          .map((inst) => {
            const dueAlt = (inst as unknown as Record<string, unknown>)['dueDate'];
            const dueRaw = String(inst?.تاريخ_استحقاق ?? dueAlt ?? '');
            const due = parseDateOnly(dueRaw);
            const remaining = getInstallmentPaidAndRemaining(inst).remaining;
            return { inst, due, remaining };
          })
          .filter((x) => (x.remaining || 0) > 0);

        const overdue = installmentsWithRemaining
          .filter((x) => x.due && daysBetweenDateOnly(x.due, today) > 0)
          .sort((a, b) => (a.due?.getTime() || 0) - (b.due?.getTime() || 0));

        const totalRemaining = Math.round(
          installmentsWithRemaining.reduce((sum, x) => sum + (x.remaining || 0), 0)
        );
        const overdueCount = overdue.length;
        const overdueTotal = Math.round(overdue.reduce((sum, x) => sum + (x.remaining || 0), 0));
        const overdueOldestDueDate = overdue[0]?.inst?.تاريخ_استحقاق
          ? String(overdue[0].inst.تاريخ_استحقاق)
          : '';
        const overdueMaxDaysLate = overdue.length
          ? Math.max(
              0,
              ...overdue
                .map((x) => (x.due ? daysBetweenDateOnly(x.due, today) : 0))
                .filter((n) => Number.isFinite(n))
            )
          : 0;

        const replacements: Record<string, string> = {
          contract_id: String(contract.رقم_العقد || ''),
          contract_start_date: String(contract.تاريخ_البداية || ''),
          contract_end_date: String(contract.تاريخ_النهاية || ''),
          tenant_name: String(tenant?.الاسم || ''),
          tenant_phone: String(tenant?.رقم_الهاتف || ''),
          property_code: String(property?.الكود_الداخلي || contract.رقم_العقار || ''),
          property_address: String(property?.العنوان || ''),

          اسم_المستأجر: String(tenant?.الاسم || ''),
          رقم_الهاتف: String(tenant?.رقم_الهاتف || ''),
          اسم_المالك: String(owner?.الاسم || ''),
          عنوان_العقار: String(property?.العنوان || ''),
          الكود_الداخلي: String(property?.الكود_الداخلي || contract.رقم_العقار || ''),
          تاريخ_نهاية_العقد: String(contract.تاريخ_النهاية || ''),

          total_remaining_amount: String(totalRemaining || 0),
          overdue_installments_count: String(overdueCount || 0),
          overdue_amount_total: String(overdueTotal || 0),
          overdue_oldest_due_date: String(overdueOldestDueDate || ''),
          overdue_max_days_late: String(overdueMaxDaysLate || 0),

          دفعات_اجمالي_المتبقي: String(totalRemaining || 0),
          دفعات_عدد_الاقساط_المتأخرة: String(overdueCount || 0),
          دفعات_مجموع_المتأخر: String(overdueTotal || 0),
          دفعات_اقدم_تاريخ_استحقاق_متأخر: String(overdueOldestDueDate || ''),
          دفعات_اقصى_عدد_ايام_تأخر: String(overdueMaxDaysLate || 0),
        };

        for (const [k, v] of Object.entries(contract as unknown as Record<string, unknown>)) {
          const value = v === null || v === undefined ? '' : String(v);
          replacements[`العقد_${String(k)}`] = value;
          replacements[`contract_${String(k)}`] = value;
        }
        if (property) {
          for (const [k, v] of Object.entries(property as unknown as Record<string, unknown>)) {
            const value = v === null || v === undefined ? '' : String(v);
            replacements[`العقار_${String(k)}`] = value;
            replacements[`property_${String(k)}`] = value;
          }
        }
        if (tenant) {
          for (const [k, v] of Object.entries(tenant as unknown as Record<string, unknown>)) {
            const value = v === null || v === undefined ? '' : String(v);
            replacements[`المستأجر_${String(k)}`] = value;
            replacements[`tenant_${String(k)}`] = value;
          }
        }

        let text = String(tmpl.content || '');
        for (const [key, value] of Object.entries(replacements)) {
          text = text.split(`{{${key}}}`).join(value);
        }
        const now = new Date();
        const date = now.toISOString().slice(0, 10);
        const time = now.toTimeString().slice(0, 5);
        text = text.split('[التاريخ]').join(date);
        text = text.split('[الوقت]').join(time);

        if (seq === generationSeqRef.current) setGeneratedText(text);
        } finally {
          setIsGenerating(false);
        }
      })();
      return;
    }

    const result = DbService.generateLegalNotice(selectedTemplateId, selectedContractId);
    if (result) setGeneratedText(typeof result === 'string' ? result : (result as { text?: string }).text || '');
  }, [isDesktopFast, selectedContractId, selectedTemplateId, templates, getDesktopContractBundle]);

  useEffect(() => {
    handleGenerate();
  }, [handleGenerate]);

  useEffect(() => {
    if (!selectedContractId) {
      setSelectedContractTenantId('');
      return;
    }
    if (isDesktopFast) {
      let cancelled = false;
      void (async () => {
        const c = await domainGetSmart('contracts', selectedContractId);
        if (cancelled) return;
        setSelectedContractTenantId(String(c?.رقم_المستاجر || ''));
      })();
      return () => {
        cancelled = true;
      };
    }

    const c = contracts.find((x) => x.رقم_العقد === selectedContractId);
    setSelectedContractTenantId(String(c?.رقم_المستاجر || ''));
  }, [isDesktopFast, selectedContractId, contracts]);

  const approveAndSaveToHistory = useCallback(async (payload: {
    method: 'WhatsApp' | 'Email' | 'Print';
    contractId: string;
    templateId: string;
    templateTitle: string;
    textSnapshot: string;
  }) => {
    const contract = isDesktopFast
      ? await domainGetSmart('contracts', payload.contractId)
      : contracts.find((c) => c.رقم_العقد === payload.contractId) || null;

    try {
      const details: DesktopContractBundle | ContractDetailsResult | null = isDesktopFast
        ? await getDesktopContractBundle(payload.contractId)
        : DbService.getContractDetails(payload.contractId);
      const tenantName = String(details?.tenant?.الاسم || '');
      const phone = String(details?.tenant?.رقم_الهاتف || '');
      DbService.addNotificationSendLog({
        category: 'legal_notice',
        tenantId: contract?.رقم_المستاجر,
        tenantName: tenantName || 'مستأجر',
        phone: phone || undefined,
        contractId: payload.contractId,
        propertyId: contract?.رقم_العقار,
        propertyCode: String(details?.property?.الكود_الداخلي || contract?.رقم_العقار || ''),
        sentAt: new Date().toISOString(),
        message: payload.textSnapshot,
        note: `LegalHub • ${payload.method} • ${payload.templateTitle || 'مخصص'}`,
      });
    } catch {
      // ignore
    }

    DbService.saveLegalNoticeHistory({
      contractId: payload.contractId,
      tenantId: contract?.رقم_المستاجر || 'unknown',
      templateTitle: payload.templateTitle || 'مخصص',
      contentSnapshot: payload.textSnapshot,
      sentMethod: payload.method,
      createdBy: 'Admin',
    });

    toast.success('تم اعتماد الإرسال وحفظه في السجل');
    setPendingSend(null);
    refreshData();
  }, [isDesktopFast, contracts, getDesktopContractBundle, refreshData, toast]);

  const handleApproveSend = useCallback(async () => {
    if (!pendingSend) return;
    const ok = await toast.confirm({
      title: 'اعتماد الإرسال',
      message: `هل تريد اعتماد إرسال الإخطار (${pendingSend.method}) وتسجيله في السجل؟`,
      confirmText: 'اعتماد',
      cancelText: 'إلغاء',
      isDangerous: false,
    });
    if (!ok) return;
    await approveAndSaveToHistory(pendingSend);
  }, [pendingSend, toast, approveAndSaveToHistory]);

  const handleCopy = useCallback(async () => {
    try {
      const text =
        generatedText.trim().length > 0
          ? applyOfficialBrandSignature(generatedText)
          : generatedText;
      const res = await safeCopyToClipboard(text);
      if (!res.ok) throw new Error(res.error || 'copy_failed');
      toast.success('تم نسخ النص');
    } catch {
      toast.error('تعذر نسخ النص');
    }
  }, [generatedText, toast]);

  const handlePrint = useCallback(() => {
    const text =
      generatedText.trim().length > 0 ? applyOfficialBrandSignature(generatedText) : generatedText;
    if (!text.trim()) return;
    void printTextUnified({
      documentType: 'legalhub_notice',
      entityId: selectedContractId || undefined,
      title: 'إخطار قانوني',
      text,
    });
  }, [generatedText, selectedContractId]);

  const handleWhatsApp = useCallback(() => {
    if (!selectedContractId || !generatedText) return;
    const text =
      generatedText.trim().length > 0 ? applyOfficialBrandSignature(generatedText) : generatedText;

    if (isDesktopFast) {
      void (async () => {
        const details = await getDesktopContractBundle(selectedContractId);
        const phones = [details?.tenant?.رقم_الهاتف, details?.tenant?.رقم_هاتف_اضافي].filter(
          Boolean
        ) as string[];
        if (phones.length === 0) {
          toast.warning('رقم هاتف المستأجر غير متوفر');
          return;
        }
        void openWhatsAppForPhones(text, phones, {
          defaultCountryCode: getDefaultWhatsAppCountryCodeSync(),
          delayMs: 10_000,
        });

        const tmpl = templates.find((t) => t.id === selectedTemplateId);
        setPendingSend({
          method: 'WhatsApp',
          contractId: selectedContractId,
          templateId: selectedTemplateId,
          templateTitle: tmpl?.title || 'مخصص',
          textSnapshot: text,
        });
        toast.info('بعد الإرسال اضغط "اعتماد الإرسال" لتسجيله');
      })();
      return;
    }

    const details = DbService.getContractDetails(selectedContractId);
    const phones = [details?.tenant?.رقم_الهاتف, details?.tenant?.رقم_هاتف_اضافي].filter(
      Boolean
    ) as string[];
    if (phones.length === 0) {
      toast.warning('رقم هاتف المستأجر غير متوفر');
      return;
    }
    void openWhatsAppForPhones(text, phones, {
      defaultCountryCode: getDefaultWhatsAppCountryCodeSync(),
      delayMs: 10_000,
    });

    const tmpl = templates.find((t) => t.id === selectedTemplateId);
    setPendingSend({
      method: 'WhatsApp',
      contractId: selectedContractId,
      templateId: selectedTemplateId,
      templateTitle: tmpl?.title || 'مخصص',
      textSnapshot: text,
    });
    toast.info('بعد الإرسال اضغط "اعتماد الإرسال" لتسجيله');
  }, [isDesktopFast, selectedContractId, generatedText, templates, selectedTemplateId, getDesktopContractBundle, toast]);

  const handlePreparePrint = useCallback(() => {
    if (!generatedText || !selectedContractId) return;
    const text =
      generatedText.trim().length > 0 ? applyOfficialBrandSignature(generatedText) : generatedText;
    handlePrint();
    const tmpl = templates.find((t) => t.id === selectedTemplateId);
    setPendingSend({
      method: 'Print',
      contractId: selectedContractId,
      templateId: selectedTemplateId,
      templateTitle: tmpl?.title || 'مخصص',
      textSnapshot: text,
    });
    toast.info('بعد الطباعة اضغط "اعتماد الإرسال" لتسجيله');
  }, [generatedText, selectedContractId, handlePrint, templates, selectedTemplateId, toast]);

  const openEditHistory = useCallback((rec: LegalNoticeRecord) => {
    setEditingHistory(rec);
    setEditNote(String(rec.note || ''));
    setEditReply(String(rec.reply || ''));
  }, []);

  const handleSaveHistoryEdit = useCallback(async () => {
    if (!editingHistory) return;
    DbService.updateLegalNoticeHistory(editingHistory.id, {
      note: editNote,
      reply: editReply,
    });
    toast.success('تم تحديث السجل');
    setEditingHistory(null);
    refreshData();
  }, [editingHistory, editNote, editReply, refreshData, toast]);

  const handleDeleteHistory = useCallback(async (id: string) => {
    const ok = await toast.confirm({
      title: 'حذف سجل',
      message: 'هل تريد حذف هذا السجل نهائياً؟ سيتم أيضاً حذف مرفقات الرد المرتبطة به.',
      confirmText: 'حذف',
      cancelText: 'إلغاء',
      isDangerous: true,
    });
    if (!ok) return;

    const res = DbService.deleteLegalNoticeHistory(id);
    if (!res.success) {
      toast.error(res.message || 'فشل الحذف');
      return;
    }
    toast.success('تم حذف السجل');
    refreshData();
  }, [refreshData, toast]);

  const handleAddTemplate = useCallback((e: FormEvent) => {
    e.preventDefault();
    if (!newTemplateForm.title || !newTemplateForm.content) {
      toast.warning('العنوان والنص مطلوبان');
      return;
    }

    const res = DbService.addLegalTemplate(newTemplateForm);
    if (res.success) {
      toast.success('تم إضافة النموذج بنجاح');
      setIsAddTemplateOpen(false);
      setNewTemplateForm({ title: '', category: 'General', content: '' });
      refreshData();
    }
  }, [newTemplateForm, refreshData, toast]);

  const handleDeleteTemplate = useCallback(async (id: string) => {
    const ok = await toast.confirm({
      title: 'حذف نموذج',
      message: 'هل أنت متأكد من حذف هذا النموذج؟',
      confirmText: 'حذف',
      cancelText: 'إلغاء',
      isDangerous: true,
    });
    if (!ok) return;

    DbService.deleteLegalTemplate(id);
    refreshData();
    if (selectedTemplateId === id) {
      setSelectedTemplateId('');
      setGeneratedText('');
    }
    toast.success('تم حذف النموذج');
  }, [refreshData, selectedTemplateId, toast]);

  const isCustom = useCallback((id: string) => id.startsWith('TMPL-'), []);

  const safeContractId = useCallback((value: unknown) => formatContractNumberShort(String(value || '')), []);

  const filteredHistory = history.filter((h) => {
    const q = historySearch.trim().toLowerCase();
    if (!q) return true;
    const hay =
      `${h.templateTitle || ''} ${h.contractId || ''} ${h.sentMethod || ''}`.toLowerCase();
    return hay.includes(q);
  });

  const historyPageSize = 12;
  const historyPageCount = Math.max(1, Math.ceil(filteredHistory.length / historyPageSize));

  useEffect(() => {
    setHistoryPage(1);
  }, [historySearch]);

  useEffect(() => {
    setHistoryPage((p) => Math.min(Math.max(1, p), historyPageCount));
  }, [historyPageCount]);

  const visibleHistory = filteredHistory.slice(
    (historyPage - 1) * historyPageSize,
    historyPage * historyPageSize
  );

  return {
    history,
    templates,
    historySearch,
    setHistorySearch,
    historyPage,
    setHistoryPage,
    selectedContractId,
    setSelectedContractId,
    selectedContractTenantId,
    selectedTemplateId,
    setSelectedTemplateId,
    generatedText,
    setGeneratedText,
    isGenerating,
    pendingSend,
    editingHistory,
    setEditingHistory,
    editNote,
    setEditNote,
    editReply,
    setEditReply,
    isAddTemplateOpen,
    setIsAddTemplateOpen,
    newTemplateForm,
    setNewTemplateForm,
    isVariablesOpen,
    setIsVariablesOpen,
    visibleHistory,
    historyPageCount,
    filteredHistory,
    handleApproveSend,
    handleCopy,
    handleWhatsApp,
    handlePreparePrint,
    handleSaveHistoryEdit,
    handleDeleteHistory,
    handleAddTemplate,
    handleDeleteTemplate,
    openEditHistory,
    isCustom,
    safeContractId,
    openPanel,
  };
};
