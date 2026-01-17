
import React, { useMemo, useState, useEffect } from 'react';
import { DbService } from '@/services/mockDb';
import { FileText, Calendar, User, Home, DollarSign, CheckCircle, Clock, AlertTriangle, Shield, History, Link, Ban, Printer, ListTodo } from 'lucide-react';
import { useSmartModal } from '@/context/ModalContext';
import { useToast } from '@/context/ToastContext';
import { useAppDialogs } from '@/hooks/useAppDialogs';
import { useDbSignal } from '@/hooks/useDbSignal';
import { Button } from '@/components/ui/Button';
import { RBACGuard } from '@/components/shared/RBACGuard';
import { AttachmentManager } from '@/components/AttachmentManager';
import { ActivityTimeline } from '@/components/ActivityTimeline';
import { NotesSection } from '@/components/shared/NotesSection';
import { DynamicFieldsDisplay } from '@/components/dynamic/DynamicFieldsDisplay';
import { PrintLetterhead } from '@/components/print/PrintLetterhead';
import { fillContractMaskedDocxTemplate } from '@/utils/docxTemplate';
import { formatContractNumberShort } from '@/utils/contractNumber';
import { formatCurrencyJOD } from '@/utils/format';
import { getRentalTier } from '@/utils/employeeCommission';
import { normalizeDigitsToLatin } from '@/utils/numberInput';
import { storage } from '@/services/storage';
import { contractDetailsSmart, domainGetSmart } from '@/services/domainQueries';
import type { ContractDetailsResult, FollowUpTask, العمولات_tbl, الكمبيالات_tbl } from '@/types';

const EMPTY_INSTALLMENTS: الكمبيالات_tbl[] = [];

export const ContractPanel: React.FC<{ id: string; onClose?: () => void }> = ({ id, onClose }) => {
  const [data, setData] = useState<ContractDetailsResult | null>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'timeline'>('details');
    const [isGeneratingWord, setIsGeneratingWord] = useState(false);
    const [isImportingTemplate, setIsImportingTemplate] = useState(false);
        const [loadError, setLoadError] = useState<string | null>(null);
    const { openPanel } = useSmartModal();
    const toast = useToast();
        const dialogs = useAppDialogs();
    const dbSignal = useDbSignal();

        const toRecord = (v: unknown): Record<string, unknown> => (typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {});
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
                setLoadError('هذه الشاشة تحتاج وضع السرعة/SQL في نسخة الديسكتوب');
                setData(null);
                return;
            }

            if (isDesktopFast) {
                try {
                    const d = await contractDetailsSmart(id);
                    if (!alive) return;
                    setData(d);
                    setLoadError(d ? null : 'تعذر تحميل بيانات العقد في وضع السرعة');
                } catch {
                    if (!alive) return;
                    setData(null);
                    setLoadError('تعذر تحميل بيانات العقد في وضع السرعة');
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
    }, [id, dbSignal, isDesktopFast, desktopUnsupported]);

  // IMPORTANT: Hooks must run on every render in the same order.
  // Keep derived memoized values above any conditional early returns.
        const installments = data?.installments ?? EMPTY_INSTALLMENTS;

        const contractCommission = useMemo<العمولات_tbl | undefined>(() => {
        void dbSignal;
        if (isDesktop) return undefined;
                return DbService.getCommissions().find((x) => x.رقم_العقد === id);
    }, [id, dbSignal, isDesktop]);

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

          const paidFromHistory = inst?.سجل_الدفعات?.reduce((sum, p) => sum + (p?.المبلغ > 0 ? p.المبلغ : 0), 0) ?? 0;
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
    const commTotal = Number(contractCommission?.المجموع ?? (commOwner + commTenant)) || (commOwner + commTenant);

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
        if (isDesktop) return 0;
        const all = DbService.getCommissions();
        return all.reduce((sum, r) => {
            const paidMonth = String(r?.شهر_دفع_العمولة || '').trim();
            const mk = /^\d{4}-\d{2}$/.test(paidMonth)
                ? paidMonth
                : (/^\d{4}-\d{2}/.test(String(r?.تاريخ_العقد || '')) ? String(r.تاريخ_العقد).slice(0, 7) : '');
            if (mk !== contractCommissionMonthKey) return sum;
            return sum + (Number(r?.المجموع) || 0);
        }, 0);
    }, [contractCommissionMonthKey, dbSignal, isDesktop]);

  if (desktopUnsupported) {
      return (
          <div className="p-10 text-center text-slate-600 dark:text-slate-300">
              <div className="font-bold">غير مدعوم في وضع الديسكتوب الحالي</div>
              <div className="text-sm mt-2">يرجى تحديث نسخة الديسكتوب أو تفعيل وضع السرعة/SQL.</div>
          </div>
      );
  }

  if (!data) {
      return (
          <div className="p-10 text-center text-slate-600 dark:text-slate-300">
              {loadError ? (
                  <div>
                      <div className="font-bold">تعذر تحميل البيانات</div>
                      <div className="text-sm mt-2">{loadError}</div>
                  </div>
              ) : (
                  'جاري التحميل...'
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
            upsertCommissionForContract: (contractId: string, payload: { commOwner: number; commTenant: number }) => unknown;
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
            toast.error('هذه الميزة تحتاج وضع السرعة/SQL في نسخة الديسكتوب');
            return;
        }
        const rec = ensureCommissionRecord();
        if (!rec?.رقم_العمولة) {
            toast.error('تعذر إنشاء/تحديد سجل العمولة للعقد');
            return;
        }

        const value = await dialogs.prompt({
            title: 'رقم الفرصة',
            message: 'أدخل رقم الفرصة المرتبط بهذه العملية:',
            inputType: 'text',
            defaultValue: String(rec.رقم_الفرصة || ''),
            placeholder: 'Opportunity #',
            required: true,
        });
        if (!value) return;

        const normalized = normalizeDigitsToLatin(String(value).trim());
        const res = DbService.updateCommission(String(rec.رقم_العمولة), { رقم_الفرصة: normalized });
        if (res.success) {
            toast.success('تم حفظ رقم الفرصة');
            reload();
        } else {
            toast.error(res.message || 'تعذر حفظ رقم الفرصة');
        }
    };

    const handleTogglePropertyIntro = (enabled: boolean) => {
        if (desktopUnsupported) {
            toast.error('هذه الميزة تحتاج وضع السرعة/SQL في نسخة الديسكتوب');
            return;
        }
        const rec = ensureCommissionRecord();
        if (!rec?.رقم_العمولة) {
            toast.error('تعذر إنشاء/تحديد سجل العمولة للعقد');
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

        const tenantPersonId = tenant?.رقم_الشخص ? String(tenant.رقم_الشخص) : undefined;
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
            clientName: String(tenant?.الاسم || '').trim() || undefined,
            phone: String(tenant?.رقم_الهاتف || '').trim() || undefined,
            type: 'Task',
            dueDate,
            priority: 'Medium',
            contractId,
            personId: tenantPersonId,
            propertyId: String(property?.رقم_العقار || '').trim() || undefined,
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

    const handlePrint = () => window.print();

    const handleImportWordTemplate = async () => {
        if (!DbService.importWordTemplate) {
            toast.error('ميزة استيراد القالب متاحة في نسخة سطح المكتب فقط');
            return;
        }

        try {
            setIsImportingTemplate(true);
            const res = await DbService.importWordTemplate();
            if (!res.success || !res.data) {
                toast.error(res.message || 'تم الإلغاء');
                return;
            }
            const current = DbService.getSettings?.();
            if (current && DbService.saveSettings) {
                DbService.saveSettings({ ...current, contractWordTemplateName: res.data });
            }
            toast.success('تم استيراد قالب Word بنجاح');
        } catch (e: unknown) {
            toast.error(getErrorMessage(e) || 'فشل استيراد القالب');
        } finally {
            setIsImportingTemplate(false);
        }
    };

    const handleGenerateWord = async () => {
        try {
            setIsGeneratingWord(true);
            if (desktopUnsupported) {
                toast.error('هذه الميزة تحتاج وضع السرعة/SQL في نسخة الديسكتوب');
                return;
            }

            const details: ContractDetailsResult | null = isDesktopFast ? await contractDetailsSmart(id) : (DbService.getContractDetails(id) || null);
            if (!details?.contract) {
                toast.error('تعذر تحميل بيانات العقد');
                return;
            }

            const settings = DbService.getSettings?.();
            let templateName = String(settings?.contractWordTemplateName || '').trim();

            if (!templateName) {
                const listRes = await DbService.listWordTemplates?.();
                const items = listRes?.success ? (listRes.data || []) : [];
                if (items.length === 1) {
                    templateName = items[0];
                    if (settings && DbService.saveSettings) {
                        DbService.saveSettings({ ...settings, contractWordTemplateName: templateName });
                    }
                }
            }

            if (!templateName) {
                toast.error('لم يتم تحديد قالب Word. اضغط "استيراد قالب Word" أولاً');
                return;
            }

            const tpl = await DbService.readWordTemplate(templateName);
            if (!tpl.success || !tpl.data) {
                toast.error(tpl.message || 'تعذر تحميل قالب Word');
                return;
            }

            const c0 = details.contract;
            const p0 = details.property;
            const t0 = details.tenant;
            const today = new Date().toISOString().slice(0, 10);

            const ownerId = String(p0?.رقم_المالك || '').trim();
            const owner = ownerId
                ? (isDesktopFast ? await domainGetSmart('people', ownerId) : (DbService.getPeople?.() || []).find((x) => String(x?.رقم_الشخص) === ownerId) || null)
                : null;

            const installments0: الكمبيالات_tbl[] = details?.installments ?? [];
            const rentInstallments = installments0.filter((i) => String(i?.نوع_الكمبيالة) !== 'تأمين' && String(i?.نوع_الكمبيالة) !== 'فرق أيام');
            const rentBillsCount = rentInstallments.length;

            const mostCommonRentValue = (() => {
                const values = rentInstallments
                    .map(i => Number(i?.القيمة || 0))
                    .filter(v => Number.isFinite(v) && v > 0);
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
                    case 12: return 'شهر';
                    case 6: return 'شهرين';
                    case 4: return 'ثلاثة أشهر';
                    case 3: return 'أربعة أشهر';
                    case 2: return 'ستة أشهر';
                    case 1: return 'سنة';
                    default: return '...';
                }
            })();

            const depositInst0 = installments0.find((i) => String(i?.نوع_الكمبيالة) === 'تأمين');
            const depositDueDate = String(depositInst0?.تاريخ_استحقاق || '') || undefined;

            const tenantRec = toRecord(t0);

            const filled = fillContractMaskedDocxTemplate(tpl.data, {
                ownerName: owner?.الاسم || settings?.companyName,
                ownerNationalId: owner?.الرقم_الوطني,
                tenantName: t0?.الاسم,
                tenantNationalId: t0?.الرقم_الوطني || (typeof tenantRec['رقم_الهوية'] === 'string' ? tenantRec['رقم_الهوية'] : undefined),
                propertyType: p0?.النوع,
                propertyDescriptor: p0?.الصفة || p0?.نوع_التاثيث,
                region: p0?.المنطقة || p0?.المدينة,
                plotNo: p0?.رقم_قطعة,
                plateNo: p0?.رقم_لوحة,
                apartmentNo: p0?.رقم_شقة,
                basinName: p0?.اسم_الحوض,
                boundaries: p0?.حدود_المأجور,
                startDate: c0.تاريخ_البداية,
                rentValueNumber: perPayment,
                installmentValueNumber: perPayment,
                electricitySubscriptionNo: p0?.رقم_اشتراك_الكهرباء,
                electricitySubscriptionName: owner?.الاسم || settings?.companyName,
                waterSubscriptionNo: p0?.رقم_اشتراك_المياه,
                waterSubscriptionName: owner?.الاسم || settings?.companyName,
                rentBillsCount,
                rentBillValue: mostCommonRentValue ?? perPayment,
                rentBillEveryText: rentEveryText,
                rentBillsStartDate: c0.تاريخ_البداية,
                depositDueDate,
                signatureDate: today,
            });
            if (filled.ok === false) {
                toast.error(filled.message || 'فشل إنشاء ملف Word');
                return;
            }

            const propCode = String(p0?.الكود_الداخلي || '').trim();
            const outName = `عقد-${propCode || 'عقار'}-${formatContractNumberShort(String(c0.رقم_العقد))}.docx`;
            const mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
            const safeBytes = new Uint8Array(filled.bytes);
            const file = new File([new Blob([safeBytes], { type: mime })], outName, { type: mime });

            const saved = await DbService.uploadAttachment('Contract', id, file);
            if (!saved.success) {
                toast.error(saved.message || 'فشل حفظ عقد Word');
                return;
            }

            toast.success('تم إنشاء عقد Word وحفظه ضمن مرفقات العقد');
            reload();
        } catch (e: unknown) {
            toast.error(getErrorMessage(e) || 'حدث خطأ أثناء توليد عقد Word');
        } finally {
            setIsGeneratingWord(false);
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
                    <h1 className="text-xl font-bold">نموذج عقد إيجار</h1>
                    <div className="text-sm text-slate-600">التاريخ: {new Date().toISOString().slice(0, 10)}</div>
                </div>

                <div className="border border-gray-200 rounded-lg overflow-hidden mb-6">
                    <table className="w-full text-right text-sm">
                        <tbody className="divide-y divide-gray-200">
                            <tr>
                                <td className="p-3 bg-gray-50 font-bold w-48">رقم العقد</td>
                                <td className="p-3"><span dir="ltr" className="font-mono">{c.رقم_العقد}</span></td>
                            </tr>
                            <tr>
                                <td className="p-3 bg-gray-50 font-bold">الحالة</td>
                                <td className="p-3">{c.حالة_العقد}</td>
                            </tr>
                            <tr>
                                <td className="p-3 bg-gray-50 font-bold">الفترة</td>
                                <td className="p-3">{c.تاريخ_البداية} → {c.تاريخ_النهاية}</td>
                            </tr>
                            <tr>
                                <td className="p-3 bg-gray-50 font-bold">العقار</td>
                                <td className="p-3">{property?.الكود_الداخلي || c.رقم_العقار}</td>
                            </tr>
                            <tr>
                                <td className="p-3 bg-gray-50 font-bold">المستأجر</td>
                                <td className="p-3">{tenant?.الاسم || c.رقم_المستاجر} {tenant?.رقم_الهاتف ? `• ${tenant.رقم_الهاتف}` : ''}</td>
                            </tr>
                            <tr>
                                <td className="p-3 bg-gray-50 font-bold">القيمة السنوية</td>
                                <td className="p-3">{formatCurrencyJOD(c.القيمة_السنوية, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
                            </tr>
                            <tr>
                                <td className="p-3 bg-gray-50 font-bold">تكرار الدفع / الطريقة</td>
                                <td className="p-3">{c.تكرار_الدفع} • {String(c.طريقة_الدفع || '')}</td>
                            </tr>
                            {c.حالة_العقد === 'مفسوخ' && c.terminationReason ? (
                                <tr>
                                    <td className="p-3 bg-gray-50 font-bold">الفسخ</td>
                                    <td className="p-3">{c.terminationDate || ''} • السبب: {c.terminationReason}</td>
                                </tr>
                            ) : null}
                        </tbody>
                    </table>
                </div>

                <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="p-3 bg-gray-50 font-bold">جدول الدفعات</div>
                    <table className="w-full text-right text-xs">
                        <thead className="bg-white">
                            <tr className="border-b border-gray-200">
                                <th className="p-3">#</th>
                                <th className="p-3">التاريخ</th>
                                <th className="p-3">القيمة</th>
                                <th className="p-3">النوع</th>
                                <th className="p-3">الحالة</th>
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
         {c.isArchived && <div className="absolute top-0 right-0 bg-slate-200 text-slate-600 px-3 py-1 text-xs font-bold rounded-bl-xl">أرشيف</div>}
         
         <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-3">
               <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl text-indigo-600">
                  <FileText size={24} />
               </div>
               <div>
                        <h1 className="text-xl font-bold text-slate-800 dark:text-white">عقد <span dir="ltr" className="font-mono">{c.رقم_العقد}</span></h1>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${getStatusColor(c.حالة_العقد)}`}>{c.حالة_العقد}</span>
               </div>
            </div>
            <div className="text-left">
               <p className="text-xs text-slate-400">القيمة السنوية</p>
                    <p className="text-lg font-bold text-green-600">{formatCurrencyJOD(c.القيمة_السنوية, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
            </div>
         </div>
         
         <div className="flex gap-4 text-sm text-slate-500 dark:text-slate-400 bg-gray-50 dark:bg-slate-900/50 p-3 rounded-xl">
            <div className="flex items-center gap-1"><Calendar size={14}/> {c.تاريخ_البداية}</div>
            <div className="text-gray-300">|</div>
            <div className="flex items-center gap-1"><Calendar size={14}/> {c.تاريخ_النهاية}</div>
                <div className="text-gray-300">|</div>
                <div className="flex items-center gap-1"><Shield size={14}/> تاريخ التأمين: {depositInst?.تاريخ_استحقاق || '-'}</div>
         </div>

                 {/* Actions */}
                 <div className="mt-4 flex flex-wrap gap-2">
                     <Button variant="secondary" onClick={handlePrint}>
                        <span className="inline-flex items-center gap-2"><Printer size={16} /> طباعة / PDF</span>
                     </Button>

                            <Button variant="secondary" onClick={() => void handleQuickFollowUpForContract()}>
                                <span className="inline-flex items-center gap-2"><ListTodo size={16} /> تذكير</span>
                     </Button>

                            <Button variant="secondary" onClick={handleGenerateWord} disabled={isGeneratingWord}>
                                <span className="inline-flex items-center gap-2"><FileText size={16} /> {isGeneratingWord ? 'جارٍ التوليد...' : 'توليد عقد Word'}</span>
                            </Button>
                            <Button variant="secondary" onClick={handleImportWordTemplate} disabled={isImportingTemplate}>
                                <span className="inline-flex items-center gap-2"><FileText size={16} /> {isImportingTemplate ? 'جارٍ الاستيراد...' : 'استيراد قالب Word'}</span>
                            </Button>
                     {!c.isArchived && (
                         <Button variant="secondary" onClick={handleArchive}>أرشفة</Button>
                     )}
                     {(c.حالة_العقد === 'نشط' || c.حالة_العقد === 'قريب الانتهاء' || c.حالة_العقد === 'مجدد') && (
                         <Button variant="danger" onClick={handleTerminate}>فسخ</Button>
                     )}
                     {!c.linkedContractId && !c.isArchived && (
                         <Button variant="primary" onClick={handleRenew}>تجديد</Button>
                     )}
                     <Button variant="secondary" onClick={toggleAutoRenew}>
                         {c.autoRenew ? 'إيقاف التجديد التلقائي' : 'تفعيل التجديد التلقائي'}
                     </Button>

                     <RBACGuard requiredPermission="EDIT_CONTRACT">
                         <Button variant="primary" onClick={handleEdit}>تعديل</Button>
                     </RBACGuard>

                     <RBACGuard requiredPermission="DELETE_CONTRACT">
                         <Button variant="danger" onClick={handleDelete}>حذف نهائي</Button>
                     </RBACGuard>
                 </div>

         {/* Linking Info */}
         {(c.عقد_مرتبط || c.linkedContractId) && (
             <div className="mt-3 flex gap-4 text-xs">
                 {c.عقد_مرتبط && (
                     <button onClick={() => openPanel('CONTRACT_DETAILS', c.عقد_مرتبط)} className="flex items-center gap-1 text-indigo-600 hover:underline">
                         <Link size={12} /> عقد سابق
                     </button>
                 )}
                 {c.linkedContractId && (
                     <button onClick={() => openPanel('CONTRACT_DETAILS', c.linkedContractId)} className="flex items-center gap-1 text-indigo-600 hover:underline">
                         <Link size={12} /> عقد لاحق (تجديد)
                     </button>
                 )}
             </div>
         )}

         {/* Termination Info */}
         {c.حالة_العقد === 'مفسوخ' && c.terminationReason && (
             <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 rounded-xl text-xs text-red-700">
                 <div className="font-bold flex items-center gap-1 mb-1"><Ban size={12}/> تم الفسخ بتاريخ {c.terminationDate}</div>
                 <p>السبب: {c.terminationReason}</p>
             </div>
         )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-gray-100 dark:bg-slate-900 rounded-xl w-fit">
         <button onClick={() => setActiveTab('details')} className={`px-4 py-2 rounded-lg text-sm font-bold transition ${activeTab === 'details' ? 'bg-white dark:bg-slate-700 shadow text-indigo-600' : 'text-gray-500'}`}>
            التفاصيل والمالية
         </button>
         <button onClick={() => setActiveTab('timeline')} className={`px-4 py-2 rounded-lg text-sm font-bold transition ${activeTab === 'timeline' ? 'bg-white dark:bg-slate-700 shadow text-indigo-600' : 'text-gray-500'}`}>
            التطورات والملاحظات
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
                        <h4 className="font-bold text-sm flex items-center gap-2"><ListTodo size={16} className="text-indigo-600"/> رقم الفرصة</h4>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">يُستخدم للتقارير وتتبع العمليات</div>
                    </div>
                    <Button variant="secondary" onClick={handleSetOpportunityNumber}>إدخال / تعديل</Button>
                </div>
                <div className="p-4">
                    <div className="text-2xl font-black tracking-wide dir-ltr text-slate-900 dark:text-white">
                        {String(contractCommission?.رقم_الفرصة || '').trim() || '—'}
                    </div>
                </div>
            </div>

            {/* Deal Summary */}
            <div className="app-card overflow-hidden">
                <div className="p-4 bg-gray-50 dark:bg-slate-900/30 border-b border-gray-100 dark:border-slate-700">
                    <h4 className="font-bold text-sm flex items-center gap-2"><DollarSign size={16} className="text-emerald-600"/> ملخص الصفقة</h4>
                </div>
                <div className="p-4 grid grid-cols-2 gap-3 text-sm">
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-700">
                        <div className="text-xs text-slate-500">إجمالي الإيجارات</div>
                        <div className="font-black text-slate-800 dark:text-white">{formatCurrencyJOD(dealSummary.rentTotal, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-700">
                        <div className="text-xs text-slate-500">المدفوع</div>
                        <div className="font-black text-green-600">{formatCurrencyJOD(dealSummary.rentPaid, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-700">
                        <div className="text-xs text-slate-500">المتبقي</div>
                        <div className="font-black text-orange-600">{formatCurrencyJOD(dealSummary.rentRemaining, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-700">
                        <div className="text-xs text-slate-500">التأمين</div>
                        <div className="font-black text-purple-700 dark:text-purple-300">{formatCurrencyJOD(dealSummary.depositValue, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
                    </div>
                </div>
                <div className="px-4 pb-4 grid grid-cols-2 gap-3 text-sm">
                    <div className="p-3 rounded-xl bg-indigo-50/60 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30">
                        <div className="text-xs text-slate-500">العمولة (المالك)</div>
                        <div className="font-black text-indigo-700 dark:text-indigo-300">{formatCurrencyJOD(dealSummary.commissionOwner, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
                    </div>
                    <div className="p-3 rounded-xl bg-indigo-50/60 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30">
                        <div className="text-xs text-slate-500">العمولة (المستأجر)</div>
                        <div className="font-black text-indigo-700 dark:text-indigo-300">{formatCurrencyJOD(dealSummary.commissionTenant, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
                    </div>
                    <div className="p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 col-span-2">
                        <div className="text-xs text-slate-500">صافي ربح المكتب (إجمالي العمولات)</div>
                        <div className="font-black text-emerald-700 dark:text-emerald-300">{formatCurrencyJOD(dealSummary.netOfficeProfit, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
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
                    return 'خارج الشرائح';
                })();

                // ✅ أساس الحساب: إجمالي عمولة العملية (المالك + المستأجر)
                const officeTotalForContract = Math.max(0, Number(dealSummary.commissionOwner || 0)) + Math.max(0, Number(dealSummary.commissionTenant || 0));
                const employeeBase = officeTotalForContract * tier.rate;
                const introEarned = introEnabled ? (officeTotalForContract * 0.05) : 0;
                const employeeFinal = employeeBase + introEarned;

                return (
                    <div className="app-card overflow-hidden">
                        <div className="p-4 bg-gray-50 dark:bg-slate-900/30 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between gap-3">
                            <div>
                                <h4 className="font-bold text-sm flex items-center gap-2"><DollarSign size={16} className="text-emerald-600"/> عمولة الموظف (تفصيل)</h4>
                                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">شريحة الإيجار تعتمد فقط على إجمالي عمولة الإيجار (بدون إدخال العقار)</div>
                            </div>
                            <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300 select-none">
                                <input
                                    type="checkbox"
                                    checked={introEnabled}
                                    onChange={(e) => handleTogglePropertyIntro(e.target.checked)}
                                />
                                عمولة إدخال عقار (5%)
                            </label>
                        </div>

                        <div className="p-4 grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
                            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-700">
                                <div className="text-xs text-slate-500">شهر العمولة</div>
                                <div className="font-black text-slate-800 dark:text-white" dir="ltr">{contractCommissionMonthKey || '—'}</div>
                            </div>
                            <div className="p-3 rounded-xl bg-indigo-50/60 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30">
                                <div className="text-xs text-slate-500">الشريحة</div>
                                <div className="font-black text-indigo-700 dark:text-indigo-300">{tierLabel}</div>
                            </div>
                            <div className="p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30">
                                <div className="text-xs text-slate-500">عمولة العملية (المالك + المستأجر)</div>
                                <div className="font-black text-emerald-700 dark:text-emerald-300">{formatCurrencyJOD(officeTotalForContract, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
                            </div>
                            <div className="p-3 rounded-xl bg-purple-50/60 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-900/30">
                                <div className="text-xs text-slate-500">إدخال عقار (5% من إجمالي العمولة)</div>
                                <div className="font-black text-purple-700 dark:text-purple-300">{formatCurrencyJOD(introEarned, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
                            </div>

                            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-700 md:col-span-4">
                                <div className="text-xs text-slate-500">تفاصيل الحساب</div>
                                <div className="mt-1 text-sm text-slate-700 dark:text-slate-200 leading-6">
                                    إجمالي عمولات الإيجار لهذا الشهر (للمكتب): <b>{formatCurrencyJOD(monthRentalOfficeTotal, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</b>
                                    <span className="text-slate-400"> — </span>
                                    النسبة: <b dir="ltr">{Math.round(tier.rate * 100)}%</b>
                                    <span className="text-slate-400"> — </span>
                                    قبل الإدخال: <b>{formatCurrencyJOD(employeeBase, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</b>
                                    <span className="text-slate-400"> — </span>
                                    الإجمالي: <b>{formatCurrencyJOD(employeeFinal, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</b>
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                    المعادلة: قبل الإدخال = (عمولة العملية) × (نسبة الشريحة). إدخال عقار = (عمولة العملية) × 5%. الإجمالي = قبل الإدخال + إدخال عقار.
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* Relations */}
            <div className="grid grid-cols-2 gap-4">
                <div onClick={() => openPanel('PROPERTY_DETAILS', property?.رقم_العقار)}
                    className="app-card p-4 rounded-xl cursor-pointer hover:border-indigo-300 transition border-gray-100 dark:border-slate-700">
                    <p className="text-xs text-slate-400 mb-1 flex items-center gap-1"><Home size={12}/> العقار</p>
                    <p className="font-bold text-sm text-slate-800 dark:text-white whitespace-normal break-words">{property?.الكود_الداخلي}</p>
                </div>
                <div onClick={() => openPanel('PERSON_DETAILS', tenant?.رقم_الشخص)}
                    className="app-card p-4 rounded-xl cursor-pointer hover:border-indigo-300 transition border-gray-100 dark:border-slate-700">
                    <p className="text-xs text-slate-400 mb-1 flex items-center gap-1"><User size={12}/> المستأجر</p>
                    <p className="font-bold text-sm text-slate-800 dark:text-white whitespace-normal break-words">{tenant?.الاسم}</p>
                </div>
            </div>

            {/* Installments */}
            <div className="app-card overflow-hidden">
                <div className="p-4 bg-gray-50 dark:bg-slate-900/30 border-b border-gray-100 dark:border-slate-700">
                    <h4 className="font-bold text-sm flex items-center gap-2"><DollarSign size={16} className="text-green-500"/> جدول الدفعات</h4>
                </div>
                <div className="max-h-64 overflow-y-auto">
                    <table className="w-full text-right text-xs">
                    <thead className="text-gray-400 bg-white dark:bg-slate-800 sticky top-0">
                        <tr>
                            <th className="p-3">#</th>
                            <th className="p-3">التاريخ</th>
                            <th className="p-3">القيمة</th>
                            <th className="p-3">الحالة</th>
                            <th className="p-3">إجراءات</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                        {installments.map((inst) => (
                            <tr key={inst.رقم_الكمبيالة} className={inst.نوع_الكمبيالة === 'تأمين' ? 'bg-purple-50 dark:bg-purple-900/10' : ''}>
                                <td className="p-3 font-mono">{inst.ترتيب_الكمبيالة}</td>
                                <td className="p-3">{inst.تاريخ_استحقاق}</td>
                                <td className="p-3 font-bold">{inst.القيمة}</td>
                                <td className="p-3">
                                {inst.حالة_الكمبيالة === 'مدفوع' ? <CheckCircle size={14} className="text-green-500"/> :
                                    inst.حالة_الكمبيالة === 'متأخر' ? <AlertTriangle size={14} className="text-red-500"/> :
                                    inst.حالة_الكمبيالة === 'ملغي' ? <span className="text-gray-400 decoration-line-through">ملغي</span> :
                                    <Clock size={14} className="text-yellow-500"/>}
                                </td>
                                <td className="p-3">
                                    {inst.حالة_الكمبيالة !== 'مدفوع' && inst.حالة_الكمبيالة !== 'ملغي' && (
                                        <button
                                            onClick={async () => {
                                                const value = await dialogs.prompt({
                                                    title: 'تأجيل التحصيل',
                                                    message: 'اختر التاريخ الجديد لتحصيل الدفعة',
                                                    inputType: 'date',
                                                    defaultValue: String(inst.تاريخ_استحقاق || ''),
                                                    required: true,
                                                });
                                                if (!value) return;

                                                const dbExt = DbService as unknown as Partial<{
                                                    postponeInstallmentCollection: (installmentId: string, newDueDate: string) => unknown;
                                                }>;

                                                const res = dbExt.postponeInstallmentCollection?.(String(inst.رقم_الكمبيالة), value);
                                                if (res !== undefined && toRecord(res)['success'] === false) {
                                                    dialogs.toast.error(String(toRecord(res)['message'] || '') || 'تعذر تأجيل التحصيل');
                                                    return;
                                                }

                                                dialogs.toast.success('تم تأجيل التحصيل وربطه بالتذكير والتنبيهات');
                                                reload();
                                            }}
                                            className="px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-200 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition text-[11px] font-bold"
                                        >
                                            تأجيل
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
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><History className="text-indigo-500" size={20}/> سجل تطورات العقد</h3>
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
