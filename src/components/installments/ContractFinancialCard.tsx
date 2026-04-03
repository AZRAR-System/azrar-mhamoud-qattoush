import { useMemo, useState, type MouseEvent } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Check,
  ChevronDown,
  FileText,
  Home,
  Lock,
  MessageSquare,
  Printer,
} from 'lucide-react';
import { DbService } from '@/services/mockDb';
import type { DynamicFormField, RoleType, الأشخاص_tbl, العقارات_tbl, العقود_tbl, الكمبيالات_tbl } from '@/types';
import { formatContractNumberShort } from '@/utils/contractNumber';
import { can } from '@/utils/permissions';
import {
  compareDateOnlySafe,
  daysBetweenDateOnlySafe,
  isBeforeTodayDateOnly,
  todayDateOnlyISO,
} from '@/utils/dateOnly';
import { useToast } from '@/context/ToastContext';
import { useAppDialogs } from '@/hooks/useAppDialogs';
import { Card } from '@/components/ui/Card';
import { AppModal } from '@/components/ui/AppModal';
import { Button } from '@/components/ui/Button';
import { DS } from '@/constants/designSystem';
import { formatDynamicValue } from '@/components/dynamic/dynamicValue';
import { TenantRatingStrip } from '@/components/installments/TenantRatingStrip';
import { INSTALLMENT_STATUS } from '@/components/installments/installmentsConstants';
import {
  getPaidAndRemaining,
  isRecord,
} from '@/components/installments/installmentsUtils';
import {
  buildFullPrintHtmlDocument,
  DEFAULT_PRINT_MARGINS_MM,
  escapeHtml,
} from '@/components/printing/printPreviewTypes';
import {
  InvoicePrintPreview,
  type InvoiceTemplateData,
} from '@/components/printing/templates/InvoiceTemplate';
import { getSettings } from '@/services/db/settings';
import { printHtmlUnifiedWithBrowserFallback } from '@/services/printing/unifiedPrint';

function formatPropertyLabelForInvoice(p: العقارات_tbl | undefined): string {
  if (!p) return '—';
  const parts = [
    p.الكود_الداخلي,
    p.العنوان || p.المنطقة || p.المدينة,
  ].filter((x) => String(x || '').trim());
  return parts.length ? parts.join(' — ') : '—';
}

export interface ContractCardProps {
  contract: العقود_tbl;
  tenant: الأشخاص_tbl | undefined;
  property: العقارات_tbl | undefined;
  installments: الكمبيالات_tbl[];
  isAdmin: boolean;
  userId: string;
  userRole: RoleType;
  showDynamicColumns: boolean;
  dynamicFields: DynamicFormField[];
  onPay: (id: string) => void;
  onSelectInstallment: (inst: الكمبيالات_tbl) => void;
  onFullPayment: (inst: الكمبيالات_tbl) => void;
  onPartialPayment: (inst: الكمبيالات_tbl) => void;
  onReversePayment: (inst: الكمبيالات_tbl) => void;
  onOpenMessageModal?: (context: {
    installment: الكمبيالات_tbl;
    contract: العقود_tbl;
    tenant: الأشخاص_tbl;
    property: العقارات_tbl;
    category: 'reminder' | 'due' | 'late' | 'warning' | 'legal';
    overdueInstallmentsCount?: number;
    overdueAmountTotal?: number;
    overdueInstallmentsDetails?: string;
  }) => void;
  openPanel: (panelId: string, payload?: unknown) => void;
}

export const ContractFinancialCard: React.FC<ContractCardProps> = ({
  contract,
  tenant,
  property,
  installments,
  isAdmin: _isAdmin,
  userId,
  userRole,
  showDynamicColumns,
  dynamicFields,
  onPay: _onPay,
  onSelectInstallment: _onSelectInstallment,
  onFullPayment,
  onPartialPayment,
  onReversePayment,
  onOpenMessageModal,
  openPanel,
}) => {
  void _isAdmin;
  void _onPay;
  void _onSelectInstallment;
  const [isExpanded, setIsExpanded] = useState(false);
  const [invoicePrintCtx, setInvoicePrintCtx] = useState<{
    inst: الكمبيالات_tbl;
    installmentIndex: number;
  } | null>(null);
  const toast = useToast();
  const dialogs = useAppDialogs();

  const isDesktop = typeof window !== 'undefined' && !!window.desktopDb;

  const invoicePrintData: InvoiceTemplateData | null = useMemo(() => {
    if (!invoicePrintCtx) return null;
    const inst = invoicePrintCtx.inst;
    const pr = getPaidAndRemaining(inst);
    return {
      contractNumber: formatContractNumberShort(contract.رقم_العقد),
      tenantName: String(tenant?.الاسم || '—'),
      propertyLabel: formatPropertyLabelForInvoice(property),
      installmentAmount: inst.القيمة,
      dueDate: inst.تاريخ_استحقاق,
      paidAmount: pr.paid,
      remainingAmount: pr.remaining,
      installmentLabel: `القسط ${invoicePrintCtx.installmentIndex + 1}`,
    };
  }, [invoicePrintCtx, contract.رقم_العقد, tenant, property]);

  // Stats Calculation
  const visibleInstallments = installments.filter((i) => !i.isArchived);
  const rentInstallments = visibleInstallments.filter((i) => i.نوع_الكمبيالة !== 'تأمين');
  const totalAmount = rentInstallments.reduce((sum, i) => sum + i.القيمة, 0);
  const paidAmount = rentInstallments.reduce((sum, i) => sum + getPaidAndRemaining(i).paid, 0);
  const remainingAmount = rentInstallments.reduce(
    (sum, i) => sum + getPaidAndRemaining(i).remaining,
    0
  );
  const progress = totalAmount > 0 ? (paidAmount / totalAmount) * 100 : 0;
  const progressPct = Math.round(Math.max(0, Math.min(100, progress)));

  // Late Check
  const lateCount = visibleInstallments.filter((i) => {
    if (
      i.حالة_الكمبيالة === INSTALLMENT_STATUS.PAID ||
      i.حالة_الكمبيالة === INSTALLMENT_STATUS.CANCELLED
    )
      return false;
    if (i.نوع_الكمبيالة === 'تأمين') return false;
    return getPaidAndRemaining(i).remaining > 0 && isBeforeTodayDateOnly(i.تاريخ_استحقاق);
  }).length;

  // Security Deposit
  const security = visibleInstallments.find((i) => i.نوع_الكمبيالة === 'تأمين');

  // Contract-level financial summary (requested: per contract only)
  const overdueAmount = rentInstallments
    .filter(
      (i) =>
        i.حالة_الكمبيالة !== INSTALLMENT_STATUS.PAID &&
        getPaidAndRemaining(i).remaining > 0 &&
        isBeforeTodayDateOnly(i.تاريخ_استحقاق)
    )
    .reduce((sum, i) => sum + getPaidAndRemaining(i).remaining, 0);

  const overdueList = rentInstallments
    .filter(
      (i) =>
        i.حالة_الكمبيالة !== INSTALLMENT_STATUS.PAID &&
        getPaidAndRemaining(i).remaining > 0 &&
        isBeforeTodayDateOnly(i.تاريخ_استحقاق)
    )
    .map((inst) => ({ inst, remaining: getPaidAndRemaining(inst).remaining }))
    .sort((a, b) => compareDateOnlySafe(a.inst.تاريخ_استحقاق, b.inst.تاريخ_استحقاق));

  const overdueInstallmentsCount = overdueList.length;
  const overdueAmountTotal = overdueList.reduce((sum, x) => sum + (Number(x.remaining) || 0), 0);
  const overdueInstallmentsDetails = overdueList.length
    ? overdueList
        .map((x, idx) => {
          const daysLate = Math.max(
            0,
            daysBetweenDateOnlySafe(x.inst.تاريخ_استحقاق, todayDateOnlyISO()) ?? 0
          );
          return `رقم الدفعة: ${idx + 1} | تاريخ الاستحقاق: ${x.inst.تاريخ_استحقاق} | قيمة الدفعة: ${(Number(x.remaining) || 0).toLocaleString()} د.أ | عدد أيام التأخير: ${daysLate} يوم`;
        })
        .join('\n')
    : '';

  const detailsModalTitle = `${tenant?.الاسم || 'مستأجر'} — عقد ${formatContractNumberShort(contract.رقم_العقد)}`;

  const handlePrintAccountStatement = async (e: MouseEvent) => {
    e.stopPropagation();
    try {
      const settings = getSettings();
      const rows = rentInstallments
        .slice()
        .sort((a, b) => compareDateOnlySafe(a.تاريخ_استحقاق, b.تاريخ_استحقاق));
      const trs = rows
        .map((inst, idx) => {
          const pr = getPaidAndRemaining(inst);
          return `<tr>
            <td>${idx + 1}</td>
            <td>${escapeHtml(String(inst.تاريخ_استحقاق || ''))}</td>
            <td>${(Number(inst.القيمة) || 0).toLocaleString()}</td>
            <td>${(Number(pr.remaining) || 0).toLocaleString()}</td>
            <td>${escapeHtml(String(inst.تاريخ_الدفع ? inst.تاريخ_الدفع : '—'))}</td>
            <td>${escapeHtml(String(inst.حالة_الكمبيالة || ''))}</td>
          </tr>`;
        })
        .join('');
      const body = `
      <h1 style="font-size:18px;margin:0 0 12px;">كشف حساب</h1>
      <div style="margin-bottom:14px;font-size:12px;line-height:1.7;">
        <div><strong>المستأجر:</strong> ${escapeHtml(String(tenant?.الاسم || '—'))}</div>
        <div><strong>العقد:</strong> ${escapeHtml(formatContractNumberShort(contract.رقم_العقد))}</div>
        <div><strong>العقار:</strong> ${escapeHtml(formatPropertyLabelForInvoice(property))}</div>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:12px;margin-bottom:14px;font-size:12px;">
        <span>إجمالي الإيجار: <strong>${totalAmount.toLocaleString()}</strong> د.أ</span>
        <span>تم تحصيله: <strong>${paidAmount.toLocaleString()}</strong> د.أ</span>
        <span>المتبقي: <strong>${remainingAmount.toLocaleString()}</strong> د.أ</span>
        <span>متأخر: <strong>${overdueAmount.toLocaleString()}</strong> د.أ</span>
      </div>
      <table>
        <thead><tr>
          <th>#</th><th>تاريخ الاستحقاق</th><th>قيمة الدفعة</th><th>المتبقي</th><th>تاريخ الدفع</th><th>الحالة</th>
        </tr></thead>
        <tbody>${trs}</tbody>
      </table>`;
      const fullHtml = buildFullPrintHtmlDocument(settings, body, {
        orientation: 'portrait',
        marginsMm: DEFAULT_PRINT_MARGINS_MM,
      });
      const res = await printHtmlUnifiedWithBrowserFallback({
        documentType: 'contract_financial_statement',
        entityId: String(contract.رقم_العقد || '').trim(),
        html: fullHtml,
        orientation: 'portrait',
        marginsMm: DEFAULT_PRINT_MARGINS_MM,
        defaultFileName: `كشف_حساب_${formatContractNumberShort(contract.رقم_العقد)}`,
      });
      if (res && res.ok === false) {
        toast.error(res.message || 'تعذرت الطباعة');
      } else if (res?.ok) {
        toast.success('جاري فتح حوار الطباعة');
      } else {
        toast.success('جاري فتح نافذة الطباعة');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'فشلت الطباعة');
    }
  };

  return (
    <>
      <Card className="transition-all duration-300 hover:shadow-md">
        {/* Card Header (Summary) */}
        <div
          className="p-5 cursor-pointer"
          role="button"
          tabIndex={0}
          aria-haspopup="dialog"
          aria-expanded={isExpanded}
          aria-label="عرض جدول الأقساط في نافذة"
          onClick={() => setIsExpanded(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setIsExpanded(true);
            }
          }}
        >
        <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4">
          {/* Left: Info */}
          <div className="flex items-start gap-4">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold text-white shrink-0 ${lateCount > 0 ? 'bg-red-500' : remainingAmount === 0 ? 'bg-green-500' : 'bg-indigo-600'}`}
            >
              {lateCount > 0 ? '!' : '%'}
            </div>
            <div>
              <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2 text-lg">
                {tenant?.الاسم || 'مستأجر غير معروف'}
                {lateCount > 0 && (
                  <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full flex items-center gap-1 border border-red-200">
                    <AlertTriangle size={10} /> {lateCount} دفعات متأخرة
                  </span>
                )}
              </h3>
              <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400 mt-1">
                <span className="flex items-center gap-1">
                  <Home size={14} /> {property?.الكود_الداخلي}
                </span>
                <span className="text-gray-300">|</span>
                <span className="flex items-center gap-1 font-mono">
                  <FileText size={14} /> #{formatContractNumberShort(contract.رقم_العقد)}
                </span>
              </div>
            </div>
          </div>

          {/* Center: Progress Bar */}
          <div className="flex-1 lg:mx-8">
            <div className="flex justify-between text-xs mb-1 font-bold">
              <span className="text-green-600">تم سداد {paidAmount.toLocaleString()}</span>
              <span className="text-slate-400">الإجمالي {totalAmount.toLocaleString()}</span>
            </div>
            <div className="w-full h-2.5 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${lateCount > 0 ? 'bg-red-500' : 'bg-green-500'} azrar-w-${progressPct}`}
              ></div>
            </div>
            <div className="text-right mt-1">
              <span className="text-[10px] text-slate-400 font-bold">
                المتبقي:{' '}
                <span className="text-slate-600 dark:text-slate-200">
                  {remainingAmount.toLocaleString()} د.أ
                </span>
              </span>
            </div>
          </div>

          {/* Right: open details modal */}
          <div className="flex min-w-[120px] items-center justify-between gap-4 lg:justify-end">
            <div className="flex flex-col items-center gap-1">
              <div className="rounded-full bg-indigo-50 p-2 dark:bg-indigo-900/40">
                <ChevronDown size={20} className="text-indigo-600 dark:text-indigo-300" aria-hidden />
              </div>
              <span className="hidden text-[10px] font-bold text-indigo-600/90 dark:text-indigo-300/90 sm:block">
                التفاصيل
              </span>
            </div>
          </div>
        </div>
      </div>
      </Card>

      <AppModal
        open={isExpanded}
        onClose={() => setIsExpanded(false)}
        title={detailsModalTitle}
        size="6xl"
        bodyClassName="p-4 sm:p-5 max-h-[min(85vh,900px)] overflow-y-auto custom-scrollbar"
      >
        <div className="rounded-xl bg-gray-50/50 dark:bg-slate-900/50">
          {/* Contract Financial Summary */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
            <div className="app-card text-left p-2 px-4 rounded-xl">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                إجمالي الإيجار
              </p>
              <p className="font-black text-lg text-slate-800 dark:text-white">
                {totalAmount.toLocaleString()} <span className="text-[10px]">د.أ</span>
              </p>
            </div>
            <div className="text-left bg-emerald-50 dark:bg-emerald-900/20 p-2 px-4 rounded-xl border border-emerald-100 dark:border-emerald-800 shadow-sm">
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-widest">
                تم تحصيله
              </p>
              <p className="font-black text-lg text-emerald-700 dark:text-emerald-300">
                {paidAmount.toLocaleString()} <span className="text-[10px]">د.أ</span>
              </p>
            </div>
            <div className="text-left bg-orange-50 dark:bg-orange-900/20 p-2 px-4 rounded-xl border border-orange-100 dark:border-orange-800 shadow-sm">
              <p className="text-[10px] text-orange-600 dark:text-orange-400 font-bold uppercase tracking-widest">
                المتبقي
              </p>
              <p className="font-black text-lg text-orange-700 dark:text-orange-300">
                {remainingAmount.toLocaleString()} <span className="text-[10px]">د.أ</span>
              </p>
            </div>
            <div className="text-left bg-red-50 dark:bg-red-900/20 p-2 px-4 rounded-xl border border-red-100 dark:border-red-800 shadow-sm">
              <p className="text-[10px] text-red-600 dark:text-red-400 font-bold uppercase tracking-widest">
                متأخر
              </p>
              <p className="font-black text-lg text-red-700 dark:text-red-300">
                {overdueAmount.toLocaleString()} <span className="text-[10px]">د.أ</span>
              </p>
            </div>
            <div className="bg-white dark:bg-slate-800 p-2 px-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-center">
              <Button
                variant="ghost"
                size="sm"
                className="w-full h-full text-[10px] font-black uppercase text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 gap-2"
                onClick={(e) => void handlePrintAccountStatement(e)}
              >
                <Printer size={14} />
                كشف حساب
              </Button>
            </div>
          </div>

          {/* Security Deposit Badge */}
          {security && (
            <div className="mb-4 flex items-center justify-between bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg border border-purple-100 dark:border-purple-800">
              <div className="flex items-center gap-2 text-purple-700 dark:text-purple-300 font-bold text-sm">
                <Lock size={16} />
                ورقة تأمين (ضمان) محفوظة
              </div>
              <div className="font-mono font-bold text-purple-800 dark:text-purple-200">
                {security.القيمة.toLocaleString()} د.أ
              </div>
              <div className="text-xs px-2 py-1 bg-white dark:bg-slate-800 rounded border border-purple-200 dark:border-slate-600 text-purple-600">
                {security.حالة_الكمبيالة}
              </div>
            </div>
          )}

          <div className={DS.components.table.wrapper + ' shadow-sm'}>
            <table className="w-full text-right text-sm">
              <thead className={DS.components.table.header}>
                <tr>
                  <th className="p-3 w-8">#</th>
                  <th className="p-3">تاريخ الاستحقاق</th>
                  <th className="p-3">قيمة الدفعة</th>
                  <th className="p-3">المتبقي</th>
                  <th className="p-3">تاريخ الدفع</th>
                  <th className="p-3">الحالة</th>
                  {isDesktop ? (
                    <th className="p-3 whitespace-nowrap text-center">طباعة فاتورة</th>
                  ) : null}
                  {showDynamicColumns && dynamicFields.length > 0
                    ? dynamicFields.map((f) => (
                        <th key={f.id} className="p-3">
                          {f.label}
                        </th>
                      ))
                    : null}
                  <th className="p-3">السداد الكامل</th>
                  <th className="p-3">الدفعة الجزئية</th>
                  <th className="p-3">رسائل</th>
                  <th className="p-3">آخرى</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                {visibleInstallments
                  .filter((i) => i.نوع_الكمبيالة !== 'تأمين')
                  .map((inst, idx) => {
                    const isLate =
                      inst.حالة_الكمبيالة !== INSTALLMENT_STATUS.PAID &&
                      getPaidAndRemaining(inst).remaining > 0 &&
                      isBeforeTodayDateOnly(inst.تاريخ_استحقاق);
                    const daysUntilDue =
                      daysBetweenDateOnlySafe(todayDateOnlyISO(), inst.تاريخ_استحقاق) ?? 0;
                    const isDueSoon =
                      daysUntilDue <= 3 &&
                      daysUntilDue > 0 &&
                      inst.حالة_الكمبيالة !== INSTALLMENT_STATUS.PAID;
                    type InstallmentExtras = الكمبيالات_tbl & {
                      غرامة_تأخير?: unknown;
                      تصنيف_غرامة_تأخير?: unknown;
                      حقول_ديناميكية?: unknown;
                    };
                    const lateFeeRaw = (inst as InstallmentExtras).غرامة_تأخير;
                    const lateFee =
                      typeof lateFeeRaw === 'number' && Number.isFinite(lateFeeRaw)
                        ? lateFeeRaw
                        : undefined;
                    const lateFeeClassRaw = (inst as InstallmentExtras).تصنيف_غرامة_تأخير;
                    const lateFeeClass =
                      typeof lateFeeClassRaw === 'string' ? lateFeeClassRaw : undefined;

                    // Row background color based on status
                    let rowBgColor = '';
                    if (isLate)
                      rowBgColor = 'bg-red-50/30 dark:bg-red-900/10 border-l-4 border-red-500';
                    else if (isDueSoon)
                      rowBgColor =
                        'bg-orange-50/30 dark:bg-orange-900/10 border-l-4 border-orange-500';
                    else if (inst.حالة_الكمبيالة === INSTALLMENT_STATUS.PAID)
                      rowBgColor =
                        'bg-green-50/20 dark:bg-green-900/10 border-l-4 border-green-500';

                    return (
                      <tr
                        key={inst.رقم_الكمبيالة}
                        className={`${DS.components.table.row} ${rowBgColor}`}
                      >
                        <td className="p-3 font-mono text-slate-400">{idx + 1}</td>
                        <td
                          className={`p-3 font-medium ${isLate ? 'text-red-600 font-bold' : isDueSoon ? 'text-orange-600 font-bold' : ''}`}
                        >
                          {inst.تاريخ_استحقاق}
                        </td>
                        <td className="p-3 font-bold">{inst.القيمة.toLocaleString()} د.أ</td>
                        <td
                          className={`p-3 font-bold ${(inst.القيمة_المتبقية ?? 0) > 0 ? 'text-orange-600' : 'text-green-600'}`}
                        >
                          {(inst.حالة_الكمبيالة === INSTALLMENT_STATUS.PAID
                            ? 0
                            : (inst.القيمة_المتبقية ?? inst.القيمة)
                          ).toLocaleString()}{' '}
                          د.أ
                        </td>
                        <td className="p-3 text-slate-500">
                          {inst.تاريخ_الدفع ? inst.تاريخ_الدفع : '-'}
                        </td>
                        <td className="p-3">
                          <div className="flex flex-col gap-1">
                            {inst.حالة_الكمبيالة === INSTALLMENT_STATUS.PAID ? (
                              <span className="text-green-600 flex items-center gap-1 font-bold text-xs">
                                <Check size={14} /> مدفوع
                              </span>
                            ) : inst.حالة_الكمبيالة === INSTALLMENT_STATUS.PARTIAL ? (
                              <span className="text-indigo-600 flex items-center gap-1 font-bold text-xs">
                                <AlertCircle size={14} /> جزئي
                              </span>
                            ) : (
                              <span
                                className={`flex items-center gap-1 font-bold text-xs px-2 py-1 rounded ${isLate ? 'bg-red-100 text-red-600' : isDueSoon ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-600'}`}
                              >
                                {isLate && <AlertTriangle size={12} />}
                                {isLate ? 'متأخر' : isDueSoon ? 'مستحق قريباً' : 'في الموعد'}
                              </span>
                            )}
                          </div>
                        </td>

                        {isDesktop ? (
                          <td className="p-3 text-center">
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              className="inline-flex items-center gap-1 text-[11px] font-bold"
                              onClick={(e) => {
                                e.stopPropagation();
                                setInvoicePrintCtx({ inst, installmentIndex: idx });
                              }}
                              title="طباعة فاتورة"
                            >
                              <Printer size={14} />
                              فاتورة
                            </Button>
                          </td>
                        ) : null}

                        {showDynamicColumns && dynamicFields.length > 0
                          ? dynamicFields.map((f) => {
                              const raw = (inst as InstallmentExtras).حقول_ديناميكية;
                              const values = isRecord(raw) ? raw : {};
                              const text = formatDynamicValue(f.type, values?.[f.name]);
                              return (
                                <td key={f.id} className="p-3">
                                  {text || '—'}
                                </td>
                              );
                            })
                          : null}

                        <td className="p-3">
                          {inst.حالة_الكمبيالة !== INSTALLMENT_STATUS.PAID &&
                            inst.حالة_الكمبيالة !== INSTALLMENT_STATUS.CANCELLED && (
                              <Button
                                size="sm"
                                variant="primary"
                                className="bg-green-600 hover:bg-green-700 text-white font-bold shadow-lg py-2 h-10 text-sm px-4 rounded-lg transition-all duration-200 w-full"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onFullPayment(inst);
                                }}
                              >
                                ✓ سداد كامل
                              </Button>
                            )}
                        </td>
                        <td className="p-3">
                          {inst.حالة_الكمبيالة !== INSTALLMENT_STATUS.PAID &&
                            inst.حالة_الكمبيالة !== INSTALLMENT_STATUS.CANCELLED && (
                              <Button
                                size="sm"
                                variant="secondary"
                                className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-md py-2 h-9 text-sm px-4 rounded-lg transition-all duration-200 w-full"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onPartialPayment(inst);
                                }}
                              >
                                ÷ دفعة جزئية
                              </Button>
                            )}
                        </td>
                        <td className="p-3">
                          <div className="flex flex-col gap-1">
                            {/* تحديد الفئة بناءً على حالة الدفعة */}
                            {inst.حالة_الكمبيالة === INSTALLMENT_STATUS.PAID ? (
                              <Button
                                size="sm"
                                variant="secondary"
                                className="text-xs px-2 py-1 h-7"
                                disabled
                                title="الدفعة مسددة"
                              >
                                ✓ مسددة
                              </Button>
                            ) : daysUntilDue > 3 ? (
                              // تذكير قبل الاستحقاق
                              <Button
                                size="sm"
                                className="bg-indigo-500 hover:bg-indigo-600 text-white text-xs px-2 py-1 h-7 shadow-md"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!tenant || !property) return;
                                  onOpenMessageModal?.({
                                    installment: inst,
                                    contract,
                                    tenant,
                                    property,
                                    category: 'reminder',
                                    overdueInstallmentsCount,
                                    overdueAmountTotal,
                                    overdueInstallmentsDetails,
                                  });
                                }}
                                title="إرسال تذكير"
                              >
                                <MessageSquare size={12} className="ml-1" /> تذكير
                              </Button>
                            ) : daysUntilDue > 0 && daysUntilDue <= 3 ? (
                              // يوم الاستحقاق
                              <Button
                                size="sm"
                                className="bg-orange-500 hover:bg-orange-600 text-white text-xs px-2 py-1 h-7 shadow-md"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!tenant || !property) return;
                                  onOpenMessageModal?.({
                                    installment: inst,
                                    contract,
                                    tenant,
                                    property,
                                    category: 'due',
                                    overdueInstallmentsCount,
                                    overdueAmountTotal,
                                    overdueInstallmentsDetails,
                                  });
                                }}
                                title="إرسال تذكير الاستحقاق"
                              >
                                <MessageSquare size={12} className="ml-1" /> استحقاق
                              </Button>
                            ) : daysUntilDue <= 0 && daysUntilDue >= -7 ? (
                              // تأخير قليل (أقل من أسبوع)
                              <Button
                                size="sm"
                                className="bg-red-500 hover:bg-red-600 text-white text-xs px-2 py-1 h-7 shadow-md"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!tenant || !property) return;
                                  onOpenMessageModal?.({
                                    installment: inst,
                                    contract,
                                    tenant,
                                    property,
                                    category: 'late',
                                    overdueInstallmentsCount,
                                    overdueAmountTotal,
                                    overdueInstallmentsDetails,
                                  });
                                }}
                                title="إرسال تذكير التأخير"
                              >
                                <MessageSquare size={12} className="ml-1" /> متأخر
                              </Button>
                            ) : daysUntilDue < -7 && daysUntilDue >= -30 ? (
                              // إنذار (أكثر من أسبوع)
                              <Button
                                size="sm"
                                className="bg-red-700 hover:bg-red-800 text-white text-xs px-2 py-1 h-7 shadow-md"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!tenant || !property) return;
                                  onOpenMessageModal?.({
                                    installment: inst,
                                    contract,
                                    tenant,
                                    property,
                                    category: 'warning',
                                    overdueInstallmentsCount,
                                    overdueAmountTotal,
                                    overdueInstallmentsDetails,
                                  });
                                }}
                                title="إرسال إنذار"
                              >
                                <MessageSquare size={12} className="ml-1" /> إنذار
                              </Button>
                            ) : (
                              // إشعار قانوني (أكثر من شهر)
                              <Button
                                size="sm"
                                className="bg-purple-700 hover:bg-purple-800 text-white text-xs px-2 py-1 h-7 shadow-md"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!tenant || !property) return;
                                  onOpenMessageModal?.({
                                    installment: inst,
                                    contract,
                                    tenant,
                                    property,
                                    category: 'legal',
                                    overdueInstallmentsCount,
                                    overdueAmountTotal,
                                    overdueInstallmentsDetails,
                                  });
                                }}
                                title="إرسال إشعار قانوني"
                              >
                                <MessageSquare size={12} className="ml-1" /> قانوني
                              </Button>
                            )}
                          </div>
                        </td>
                        <td className="p-3">
                          {/* ✅ استخدام نظام الصلاحيات - INSTALLMENT_REVERSE */}
                          {(inst.حالة_الكمبيالة === INSTALLMENT_STATUS.PAID ||
                            inst.حالة_الكمبيالة === INSTALLMENT_STATUS.PARTIAL) &&
                            can(userRole, 'INSTALLMENT_REVERSE') && (
                              <Button
                                size="sm"
                                variant="secondary"
                                className="bg-red-600 hover:bg-red-700 shadow-md py-1 h-8 text-xs px-2 text-white font-medium rounded-lg transition-all duration-200 w-full"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onReversePayment(inst);
                                }}
                              >
                                عكس السداد
                              </Button>
                            )}

                          {/* Late fee calculator (persist only on confirm) */}
                          {inst.حالة_الكمبيالة !== INSTALLMENT_STATUS.CANCELLED &&
                            inst.نوع_الكمبيالة !== 'تأمين' && (
                              <div className="mt-2">
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  className="bg-slate-700 hover:bg-slate-800 shadow-md py-1 h-8 text-xs px-2 text-white font-medium rounded-lg transition-all duration-200 w-full"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    const daysLate = Math.max(0, -daysUntilDue);

                                    const classification = await dialogs.prompt({
                                      title: 'غرامة تأخير',
                                      message: `عدد أيام التأخير: ${daysLate}. اختر التصنيف:`,
                                      inputType: 'select',
                                      options: [
                                        { label: 'غير محدد', value: '' },
                                        { label: 'تنبيه', value: 'تنبيه' },
                                        { label: 'إنذار', value: 'إنذار' },
                                        { label: 'قانوني', value: 'قانوني' },
                                      ],
                                      defaultValue: lateFeeClass || '',
                                    });
                                    if (classification === null || classification === undefined)
                                      return;

                                    const amountStr = await dialogs.prompt({
                                      title: 'قيمة الغرامة',
                                      message: 'أدخل قيمة الغرامة (بالدينار):',
                                      inputType: 'number',
                                      defaultValue:
                                        typeof lateFee === 'number' ? String(lateFee) : '0',
                                      required: true,
                                    });
                                    if (amountStr === null || amountStr === undefined) return;
                                    const amount = Number(amountStr);
                                    if (!Number.isFinite(amount) || amount < 0) {
                                      toast.error('قيمة الغرامة غير صالحة');
                                      return;
                                    }

                                    const ok = await dialogs.confirm({
                                      title: 'اعتماد غرامة التأخير',
                                      message: `سيتم حفظ غرامة تأخير بقيمة ${amount.toLocaleString()} د.أ${classification ? ` (تصنيف: ${classification})` : ''} لهذه الدفعة. هل تريد المتابعة؟`,
                                      confirmText: 'اعتماد',
                                      cancelText: 'إلغاء',
                                      isDangerous: false,
                                    });
                                    if (!ok) return;

                                    const res = DbService.setInstallmentLateFee(
                                      inst.رقم_الكمبيالة,
                                      userId,
                                      userRole,
                                      {
                                        amount,
                                        classification: classification || undefined,
                                      }
                                    );
                                    if (!res.success) {
                                      toast.error(res.message || 'فشل حفظ الغرامة');
                                      return;
                                    }
                                    toast.success('تم حفظ غرامة التأخير');
                                    try {
                                      window.dispatchEvent(new Event('azrar:installments-changed'));
                                    } catch {
                                      // ignore
                                    }
                                  }}
                                >
                                  غرامة تأخير
                                </Button>

                                {typeof lateFee === 'number' && lateFee > 0 && (
                                  <div className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                                    محفوظة:{' '}
                                    <span className="font-bold">
                                      {lateFee.toLocaleString()} د.أ
                                    </span>
                                    {lateFeeClass ? ` — ${lateFeeClass}` : ''}
                                  </div>
                                )}
                              </div>
                            )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          <TenantRatingStrip tenant={tenant} />

          <div className="mt-4 flex justify-end gap-2">
            <Button
              variant="ghost"
              className="text-indigo-600 text-xs"
              onClick={() => openPanel('CONTRACT_DETAILS', contract.رقم_العقد)}
            >
              عرض تفاصيل العقد كاملة
            </Button>
          </div>
        </div>
      </AppModal>

      {invoicePrintCtx && invoicePrintData ? (
        <InvoicePrintPreview
          open
          onClose={() => setInvoicePrintCtx(null)}
          title="فاتورة قسط"
          settings={DbService.getSettings()}
          data={invoicePrintData}
          documentType="installment_invoice"
          entityId={String(contract.رقم_العقد)}
          defaultFileName={`فاتورة_قسط_${invoicePrintCtx.inst.رقم_الكمبيالة}`}
        />
      ) : null}
    </>
  );
};
