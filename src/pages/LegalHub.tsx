import React, { useEffect, useRef, useState } from 'react';
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
import {
  Scale,
  FileText,
  Send,
  Printer,
  Copy,
  Clock,
  Search,
  CheckCircle,
  Plus,
  Trash2,
  MessageCircle,
  ExternalLink,
  Pencil,
} from 'lucide-react';
import { useToast } from '@/context/ToastContext';
import { safeCopyToClipboard } from '@/utils/clipboard';
import { printTextUnified } from '@/services/printing/unifiedPrint';
import { useSmartModal } from '@/context/ModalContext';
import { formatDateYMD, formatNumber } from '@/utils/format';
import { domainGetSmart, installmentsContractsPagedSmart } from '@/services/domainQueries';
import { ContractPicker } from '@/components/shared/ContractPicker';
import { AttachmentManager } from '@/components/AttachmentManager';
import { MergeVariablesCatalog } from '@/components/shared/MergeVariablesCatalog';
import { formatContractNumberShort } from '@/utils/contractNumber';
import { DS } from '@/constants/designSystem';
import { Button } from '@/components/ui/Button';
import { AppModal } from '@/components/ui/AppModal';
import { useDbSignal } from '@/hooks/useDbSignal';
import { getInstallmentPaidAndRemaining } from '@/utils/installments';
import { toDateOnly, parseDateOnly, daysBetweenDateOnly } from '@/utils/dateOnly';
import { PaginationControls } from '@/components/shared/PaginationControls';
import { RBACGuard } from '@/components/shared/RBACGuard';

export const LegalHub: React.FC = () => {
  const isDesktopFast = typeof window !== 'undefined' && !!window.desktopDb?.domainGet;

  type DesktopContractBundle = {
    contract: العقود_tbl | null;
    tenant: الأشخاص_tbl | null;
    property: العقارات_tbl | null;
    owner: الأشخاص_tbl | null;
    installments: الكمبيالات_tbl[];
  };

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

  const generationSeqRef = useRef(0);

  // Send approval (must approve after sending, before logging)
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

  // Variables modal (opens only from pages that need variables)
  const [isVariablesOpen, setIsVariablesOpen] = useState(false);

  const toast = useToast();
  const { openPanel } = useSmartModal();

  const dbSignal = useDbSignal();

  const refreshDataRef = useRef<() => void>(() => {
    // no-op (assigned below)
  });
  const handleGenerateRef = useRef<() => void>(() => {
    // no-op (assigned below)
  });

  useEffect(() => {
    refreshDataRef.current();
  }, [dbSignal]);

  const refreshData = () => {
    setHistory(DbService.getLegalNoticeHistory().reverse()); // Newest first
    setContracts(isDesktopFast ? [] : DbService.getContracts());
    setTemplates(DbService.getLegalTemplates());
  };

  refreshDataRef.current = refreshData;

  const getDesktopContractBundle = async (contractId: string) => {
    const cid = String(contractId || '').trim();
    if (!cid) return null;

    // Best effort: fetch installments + contract + tenant + property in one go.
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

    // Fallback: fetch minimal entities
    if (!contract) contract = await domainGetSmart('contracts', cid);
    if (!tenant && contract?.رقم_المستاجر)
      tenant = await domainGetSmart('people', String(contract.رقم_المستاجر));
    if (!property && contract?.رقم_العقار)
      property = await domainGetSmart('properties', String(contract.رقم_العقار));

    const ownerId = property?.رقم_المالك ? String(property.رقم_المالك) : '';
    const owner = ownerId ? await domainGetSmart('people', ownerId) : null;

    return { contract, tenant, property, owner, installments } satisfies DesktopContractBundle;
  };

  const handleGenerate = () => {
    if (!selectedTemplateId || !selectedContractId) {
      setGeneratedText('');
      return;
    }

    // Desktop-fast: avoid scanning huge in-memory arrays; generate from SQL-backed entity fetch.
    if (isDesktopFast) {
      const seq = ++generationSeqRef.current;
      void (async () => {
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
      })();
      return;
    }

    // Web/legacy behavior
    const result = DbService.generateLegalNotice(selectedTemplateId, selectedContractId);
    if (result) setGeneratedText(result.text);
  };

  handleGenerateRef.current = handleGenerate;

  useEffect(() => {
    handleGenerateRef.current();
  }, [selectedTemplateId, selectedContractId]);

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

  const approveAndSaveToHistory = async (payload: {
    method: 'WhatsApp' | 'Email' | 'Print';
    contractId: string;
    templateId: string;
    templateTitle: string;
    textSnapshot: string;
  }) => {
    const contract = isDesktopFast
      ? await domainGetSmart('contracts', payload.contractId)
      : contracts.find((c) => c.رقم_العقد === payload.contractId) || null;

    // Unified audit log (shared with payment notifications panel)
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
      // ignore log failures
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
  };

  const handleApproveSend = async () => {
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
  };

  const handleCopy = async () => {
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
  };

  const handlePrint = () => {
    const text =
      generatedText.trim().length > 0 ? applyOfficialBrandSignature(generatedText) : generatedText;
    if (!text.trim()) return;
    void printTextUnified({
      documentType: 'legalhub_notice',
      entityId: selectedContractId || undefined,
      title: 'إخطار قانوني',
      text,
    });
  };

  const handleWhatsApp = () => {
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
  };

  const handlePreparePrint = () => {
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
  };

  const openEditHistory = (rec: LegalNoticeRecord) => {
    setEditingHistory(rec);
    setEditNote(String(rec.note || ''));
    setEditReply(String(rec.reply || ''));
  };

  const handleSaveHistoryEdit = async () => {
    if (!editingHistory) return;
    const res = DbService.updateLegalNoticeHistory(editingHistory.id, {
      note: editNote,
      reply: editReply,
    });
    if (!res.success) {
      toast.error(res.message || 'فشل حفظ التعديل');
      return;
    }
    toast.success('تم تحديث السجل');
    setEditingHistory(null);
    refreshData();
  };

  const handleDeleteHistory = async (id: string) => {
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
  };

  const handleAddTemplate = (e: React.FormEvent) => {
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
  };

  const handleDeleteTemplate = async (id: string) => {
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
  };

  // Helper to identify if a template is custom (not in mockData IDs usually, but mockData IDs are static strings)
  const isCustom = (id: string) => id.startsWith('TMPL-');

  const safeContractId = (value: unknown) => formatContractNumberShort(String(value || ''));

  const filteredHistory = (() => {
    const q = historySearch.trim().toLowerCase();
    if (!q) return history;
    return history.filter((h) => {
      const hay =
        `${h.templateTitle || ''} ${h.contractId || ''} ${h.sentMethod || ''}`.toLowerCase();
      return hay.includes(q);
    });
  })();

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

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className={DS.components.pageHeader}>
        <div>
          <h2 className={`${DS.components.pageTitle} flex items-center gap-2`}>
            <Scale size={22} />
            المركز القانوني والإخطارات
          </h2>
          <p className={DS.components.pageSubtitle}>
            توليد وإدارة الإنذارات والإشعارات القانونية للمستأجرين.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:h-[calc(100vh-200px)]">
        {/* LEFT PANEL: GENERATOR */}
        <div className="app-card flex flex-col">
          <div className="p-4 border-b border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50 flex justify-between items-center">
            <h3 className="font-bold text-lg text-slate-800 dark:text-white flex items-center gap-2">
              <FileText size={20} className="text-purple-500" /> إنشاء إخطار جديد
            </h3>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsVariablesOpen(true)}
                rightIcon={<Copy size={14} />}
              >
                المتغيرات
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsAddTemplateOpen(true)}
                rightIcon={<Plus size={14} />}
              >
                نموذج جديد
              </Button>
            </div>
          </div>

          <div className="p-6 flex-1 flex flex-col gap-4 overflow-y-auto">
            {/* Contract Select */}
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                1. اختر العقد
              </label>
              <ContractPicker
                value={selectedContractId}
                onChange={(contractId) => setSelectedContractId(contractId)}
                placeholder="-- اختر عقداً --"
                onOpenContract={(contractId) => openPanel('CONTRACT_DETAILS', contractId)}
              />

              {selectedContractId ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => openPanel('CONTRACT_DETAILS', selectedContractId)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700/50"
                  >
                    <ExternalLink size={14} /> فتح العقد
                  </button>
                  {(() => {
                    const tenantId = selectedContractTenantId;
                    if (!tenantId) return null;
                    return (
                      <button
                        type="button"
                        onClick={() => openPanel('PERSON_DETAILS', tenantId)}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700/50"
                      >
                        <ExternalLink size={14} /> فتح المستأجر
                      </button>
                    );
                  })()}
                </div>
              ) : null}
            </div>

            {/* Template Select */}
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                2. نوع الإخطار
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                {templates.map((t) => (
                  <div key={t.id} className="relative group">
                    <button
                      onClick={() => setSelectedTemplateId(t.id)}
                      className={`w-full text-right px-3 py-2 rounded-lg text-sm font-medium border transition flex justify-between items-center
                          ${
                            selectedTemplateId === t.id
                              ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-500 text-indigo-700 dark:text-indigo-300'
                              : 'border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400'
                          }`}
                    >
                      <span className="truncate">{t.title}</span>
                      {selectedTemplateId === t.id && (
                        <CheckCircle size={14} className="text-indigo-600 flex-shrink-0" />
                      )}
                    </button>
                    {isCustom(t.id) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTemplate(t.id);
                        }}
                        className="absolute left-2 top-1/2 -translate-y-1/2 p-1 bg-red-100 text-red-500 rounded hidden group-hover:block hover:bg-red-200"
                        title="حذف النموذج"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Editor */}
            <div className="flex-1 flex flex-col min-h-[200px]">
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                3. معاينة وتعديل النص
              </label>
              <textarea
                className="flex-1 w-full bg-yellow-50/50 dark:bg-slate-900 border border-yellow-200 dark:border-slate-600 rounded-xl p-4 text-sm leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-yellow-400/50 text-slate-800 dark:text-slate-200"
                value={generatedText}
                onChange={(e) => setGeneratedText(e.target.value)}
                placeholder="سيظهر نص الإخطار هنا بعد اختيار العقد والقالب..."
              ></textarea>
            </div>
          </div>

          <div className="p-4 border-t border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50 flex justify-between">
            <button
              onClick={handleCopy}
              disabled={!generatedText}
              className="flex items-center gap-2 px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition disabled:opacity-50"
            >
              <Copy size={18} /> نسخ
            </button>
            <div className="flex gap-2">
              <button
                onClick={handleWhatsApp}
                disabled={!generatedText || !selectedContractId}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition font-bold shadow-lg shadow-emerald-600/20 disabled:opacity-50 disabled:shadow-none"
              >
                <MessageCircle size={18} /> واتساب
              </button>
              <RBACGuard requiredPermission="PRINT_EXECUTE">
                <button
                  onClick={handlePreparePrint}
                  disabled={!generatedText}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition font-bold disabled:opacity-50"
                >
                  <Printer size={18} /> طباعة
                </button>
              </RBACGuard>
              <button
                onClick={handleApproveSend}
                disabled={!pendingSend}
                className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-bold shadow-lg shadow-indigo-600/20 disabled:opacity-50 disabled:shadow-none"
              >
                <Send size={18} /> اعتماد الإرسال
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: HISTORY */}
        <div className="app-card flex flex-col h-[500px] lg:h-auto">
          <div className="p-4 border-b border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50 flex justify-between items-center">
            <h3 className="font-bold text-lg text-slate-800 dark:text-white flex items-center gap-2">
              <Clock size={20} className="text-orange-500" /> سجل الإخطارات المرسلة
            </h3>
            <div className="flex items-center gap-2">
              <div className="relative hidden sm:block">
                <Search
                  size={14}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder="بحث..."
                  className="w-44 pr-8 pl-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-200"
                />
              </div>
              <span className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 px-2 py-0.5 rounded text-xs font-bold">
                {formatNumber(filteredHistory.length)}
              </span>
              <PaginationControls
                page={historyPage}
                pageCount={historyPageCount}
                onPageChange={setHistoryPage}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-0">
            {filteredHistory.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400">
                <p>لا يوجد سجلات سابقة</p>
              </div>
            ) : (
              <table className="w-full text-right text-sm">
                <thead className="bg-gray-50 dark:bg-slate-900/50 text-gray-500 sticky top-0">
                  <tr>
                    <th className="p-4 font-medium">نوع الإخطار</th>
                    <th className="p-4 font-medium">رقم العقد</th>
                    <th className="p-4 font-medium">تاريخ الإرسال</th>
                    <th className="p-4 font-medium">الطريقة</th>
                    <th className="p-4 font-medium">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                  {visibleHistory.map((rec) => (
                    <tr
                      key={rec.id}
                      className="hover:bg-indigo-50/50 dark:hover:bg-slate-700/30 transition"
                    >
                      <td className="p-4 font-bold text-slate-700 dark:text-slate-200">
                        {rec.templateTitle}
                      </td>
                      <td className="p-4 text-slate-500 font-mono">
                        <button
                          type="button"
                          onClick={() => openPanel('CONTRACT_DETAILS', rec.contractId)}
                          className="hover:text-indigo-600 dark:hover:text-indigo-400"
                          title="فتح تفاصيل العقد"
                        >
                          #{safeContractId(rec.contractId)}
                        </button>
                      </td>
                      <td className="p-4 text-slate-500" dir="ltr">
                        {formatDateYMD(rec.sentDate)}
                      </td>
                      <td className="p-4">
                        <span className="flex items-center gap-1 text-xs bg-gray-100 dark:bg-slate-700 px-2 py-1 rounded w-fit">
                          {rec.sentMethod === 'WhatsApp' ? (
                            <MessageCircle size={12} />
                          ) : (
                            <Printer size={12} />
                          )}
                          {rec.sentMethod}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openEditHistory(rec)}
                            className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-500 hover:text-indigo-600"
                            title="تعديل"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteHistory(rec.id)}
                            className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-500 hover:text-red-600"
                            title="حذف"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* ADD TEMPLATE MODAL */}
      {isAddTemplateOpen && (
        <AppModal
          open={isAddTemplateOpen}
          onClose={() => setIsAddTemplateOpen(false)}
          size="lg"
          title="إضافة نموذج جديد"
          footer={
            <div className="flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={() => setIsAddTemplateOpen(false)}>
                إلغاء
              </Button>
              <Button type="submit" variant="primary" form="add-template-form">
                حفظ النموذج
              </Button>
            </div>
          }
        >
          <form id="add-template-form" onSubmit={handleAddTemplate} className="space-y-4">
            <div>
              <label className="block text-sm font-bold mb-1">عنوان النموذج</label>
              <input
                required
                className="w-full border p-2.5 rounded-xl bg-gray-50 dark:bg-slate-900 dark:border-slate-600 outline-none focus:ring-2 focus:ring-purple-500"
                value={newTemplateForm.title}
                onChange={(e) => setNewTemplateForm({ ...newTemplateForm, title: e.target.value })}
                placeholder="مثال: إنذار عدلي أولي"
              />
            </div>

            <div>
              <label className="block text-sm font-bold mb-1">التصنيف</label>
              <select
                className="w-full border p-2.5 rounded-xl bg-gray-50 dark:bg-slate-900 dark:border-slate-600 outline-none"
                value={newTemplateForm.category}
                onChange={(e) => {
                  const next = String(e.target.value || '').trim();
                  if (
                    next === 'General' ||
                    next === 'Warning' ||
                    next === 'Eviction' ||
                    next === 'Renewal'
                  ) {
                    setNewTemplateForm({ ...newTemplateForm, category: next });
                  }
                }}
              >
                <option value="General">عام</option>
                <option value="Warning">إنذار / تنبيه</option>
                <option value="Eviction">إخلاء</option>
                <option value="Renewal">تجديد</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold mb-1">نص النموذج</label>
              <div className="mb-2">
                <MergeVariablesCatalog
                  title="كل المتغيرات (بالعربية)"
                  maxHeightClassName="max-h-56"
                />
              </div>
              <textarea
                required
                className="w-full h-32 border p-3 rounded-xl bg-gray-50 dark:bg-slate-900 dark:border-slate-600 outline-none focus:ring-2 focus:ring-purple-500 text-sm leading-relaxed"
                value={newTemplateForm.content}
                onChange={(e) =>
                  setNewTemplateForm({ ...newTemplateForm, content: e.target.value })
                }
                placeholder="أدخل نص النموذج هنا..."
              />
            </div>
          </form>
        </AppModal>
      )}

      {/* EDIT HISTORY MODAL */}
      {editingHistory && (
        <AppModal
          open={!!editingHistory}
          onClose={() => setEditingHistory(null)}
          size="2xl"
          title="تعديل سجل الإخطار"
          footer={
            <div className="flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={() => setEditingHistory(null)}>
                إلغاء
              </Button>
              <Button type="button" variant="primary" onClick={() => void handleSaveHistoryEdit()}>
                حفظ التعديل
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              عقد: <b className="font-mono">#{safeContractId(editingHistory.contractId)}</b> •{' '}
              {editingHistory.templateTitle}
            </div>

            <div>
              <label className="block text-sm font-bold mb-1">ملاحظة داخلية (اختياري)</label>
              <textarea
                className="w-full border p-3 rounded-xl bg-gray-50 dark:bg-slate-900 dark:border-slate-600 outline-none text-sm resize-none"
                rows={3}
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                placeholder="مثال: تم التواصل وتم الاتفاق على موعد سداد"
              />
            </div>

            <div>
              <label className="block text-sm font-bold mb-1">ملاحظة الرد (اختياري)</label>
              <textarea
                className="w-full border p-3 rounded-xl bg-gray-50 dark:bg-slate-900 dark:border-slate-600 outline-none text-sm resize-none"
                rows={3}
                value={editReply}
                onChange={(e) => setEditReply(e.target.value)}
                placeholder="مثال: رد المستأجر: سأدفع غداً"
              />
            </div>

            <div>
              <label className="block text-sm font-bold mb-2">
                صورة الرد / مرفقات الرد (اختياري)
              </label>
              <AttachmentManager referenceType={'LegalNotice'} referenceId={editingHistory.id} />
            </div>
          </div>
        </AppModal>
      )}

      {/* VARIABLES MODAL */}
      {isVariablesOpen && (
        <AppModal
          open={isVariablesOpen}
          onClose={() => setIsVariablesOpen(false)}
          size="4xl"
          title="متغيرات الدمج (بالعربية)"
        >
          <MergeVariablesCatalog
            title="كل المتغيرات المتاحة (اضغط للنسخ)"
            maxHeightClassName="max-h-[60vh]"
          />
        </AppModal>
      )}
    </div>
  );
};
