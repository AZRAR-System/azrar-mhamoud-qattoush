import { MergeVariablesCatalog } from '@/components/shared/MergeVariablesCatalog';
/**
 * © 2025 - Developed by Mahmoud Qattoush
 * AZRAR Real Estate Management System - All Rights Reserved
 *
 * صفحة إدارة الأقساط (Installments Management Page)
 * - عرض وإدارة جميع الأقساط المستحقة
 * - تسجيل الدفعات (كاملة/جزئية)
 * - إرسال التذكيرات والإشعارات
 * - التكامل الكامل مع DbService فقط (لا اعتماد عكسي)
 *
 * 📊 مصدر البيانات:
 * - DbService.getInstallments() - جلب جميع الأقساط
 * - DbService.getContracts() - للحصول على بيانات العقود
 * - DbService.getPeople() - للحصول على أسماء المستأجرين
 * - DbService.getProperties() - للحصول على أكواد العقارات
 *
 * 🎯 متى يظهر EmptyState:
 * - عند عدم وجود أقساط في النظام (installments.length === 0)
 * - عند عدم وجود نتائج بحث (filteredList.length === 0 && searchTerm)
 * - عند عدم وجود نتائج فلترة (filteredList.length === 0 && activeTab)
 *
 * ⚠️ DataGuard:
 * - يُستخدم للتحقق من وجود عقود قبل عرض الأقساط
 * - يظهر رسالة تنبيه إذا لم تكن هناك عقود في النظام
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DbService } from "@/services/mockDb";
import { DynamicFormField, RoleType, الأشخاص_tbl, العقارات_tbl, العقود_tbl, الكمبيالات_tbl } from "@/types";
import { formatContractNumberShort } from "@/utils/contractNumber";
import { can } from "@/utils/permissions";  // ✅ استخدام نظام الصلاحيات
import { isTenancyRelevant } from "@/utils/tenancy";
import {
  Check,
  AlertTriangle,
  AlertCircle,
  ChevronDown,
  Home,
  FileText,
  Lock,
  Clock,
  Calendar,
  MessageSquare,
  Star,
  TrendingUp,
  TrendingDown
} from "lucide-react";
import { useSmartModal } from "@/context/ModalContext";
import { useToast } from "@/context/ToastContext";
import { useAuth } from "@/context/AuthContext";
import { useAppDialogs } from "@/hooks/useAppDialogs";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { AppModal } from "@/components/ui/AppModal";
import { DS } from "@/constants/designSystem";
import { ROUTE_PATHS } from '@/routes/paths';
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { MessageComposer } from "@/components/MessageComposer";
import { DataGuard } from "@/components/shared/DataGuard";
import { EmptyState } from "@/components/shared/EmptyState";
import { SmartFilterBar } from '@/components/shared/SmartFilterBar';
import { SegmentedTabs } from '@/components/shared/SegmentedTabs';
import { compareDateOnlySafe, daysBetweenDateOnlySafe, isBeforeTodayDateOnly, parseDateOnly, todayDateOnlyISO, toDateOnlyISO } from '@/utils/dateOnly';
import { DynamicFieldsSection } from '@/components/dynamic/DynamicFieldsSection';
import { formatDynamicValue } from '@/components/dynamic/dynamicValue';
import { useDbSignal } from '@/hooks/useDbSignal';
import { formatNumber } from '@/utils/format';
import { normalizeDigitsToLatin, parseNumberOrUndefined } from '@/utils/numberInput';
import { domainCountsSmart, domainGetSmart, installmentsContractsPagedSmart } from '@/services/domainQueries';
import { Select } from '@/components/ui/Select';

import './Installments.css';

const PAGE_SIZE = 8;

// ═══════════════════════════════════════════════════════════════════════════════
// ثوابت حالات الكمبيالات - Installment Status Constants
// ═══════════════════════════════════════════════════════════════════════════════
const INSTALLMENT_STATUS = {
  PAID: 'مدفوع',
  PARTIAL: 'دفعة جزئية',
  UNPAID: 'غير مدفوع',
  CANCELLED: 'ملغي'
} as const;

const parseDateOnlyLocal = (iso: string | undefined | null): Date | null => {
  const normalized = toDateOnlyISO(iso);
  if (!normalized) return null;
  return parseDateOnly(normalized);
};

const todayDateOnlyLocal = () => {
  const d = parseDateOnly(todayDateOnlyISO());
  if (!d) throw new Error('Invalid todayDateOnlyISO()');
  return d;
};

const isRecord = (v: unknown): v is Record<string, unknown> => {
  return !!v && typeof v === 'object' && !Array.isArray(v);
};

const normalizeRole = (role: unknown): RoleType => {
  if (role === 'SuperAdmin' || role === 'Admin' || role === 'Employee') return role;
  return 'Employee';
};

const getPaidAndRemaining = (inst: الكمبيالات_tbl) => {
  const total = Math.max(0, Number(inst.القيمة ?? 0) || 0);
  const status = String(inst.حالة_الكمبيالة ?? '').trim();

  // 1) Explicitly PAID => remaining 0
  if (status === INSTALLMENT_STATUS.PAID) {
    return { paid: total, remaining: 0 };
  }

  // 2) Prefer stored remaining (reflects partial payments + UI operations)
  const storedRemaining = inst.القيمة_المتبقية;
  if (typeof storedRemaining === 'number' && Number.isFinite(storedRemaining)) {
    const remaining = Math.max(0, Math.min(total, storedRemaining));
    const paid = Math.max(0, Math.min(total, total - remaining));
    return { paid, remaining };
  }

  // 3) Fallback to payment history
  const paidFromHistory = inst.سجل_الدفعات?.reduce((sum, p) => sum + (p.المبلغ > 0 ? p.المبلغ : 0), 0) ?? 0;
  const paid = Math.max(0, Math.min(total, paidFromHistory));
  const remaining = Math.max(0, total - paid);
  return { paid, remaining };
};

const getLastPositivePaymentAmount = (inst: الكمبيالات_tbl): number | null => {
  if (!inst.سجل_الدفعات || inst.سجل_الدفعات.length === 0) return null;
  for (let i = inst.سجل_الدفعات.length - 1; i >= 0; i--) {
    const amount = inst.سجل_الدفعات[i].المبلغ;
    if (amount > 0) return amount;
  }
  return null;
};
// --- Tenant Rating Strip Component ---
interface TenantRatingStripProps {
  tenant: الأشخاص_tbl | undefined;
}

const TenantRatingStrip: React.FC<TenantRatingStripProps> = ({ tenant }) => {
  if (!tenant) return null;

  type BehaviorRating = { type?: unknown; points?: unknown };
  type TenantWithBehaviorRating = الأشخاص_tbl & { تصنيف_السلوك?: unknown };

  const rawRating = (tenant as TenantWithBehaviorRating).تصنيف_السلوك;
  const parsed: BehaviorRating | null = isRecord(rawRating) ? (rawRating as BehaviorRating) : null;
  const type = typeof parsed?.type === 'string' ? parsed.type : 'جديد';
  const pointsNum = typeof parsed?.points === 'number' ? parsed.points : 100;
  const points = Math.max(0, Math.min(100, Math.round(pointsNum)));
  const rating = { type, points };
  
  const getRatingColor = (type: string) => {
    const colors: Record<string, string> = {
      'ممتاز': 'from-green-500 to-emerald-600',
      'جيد': 'from-indigo-500 to-cyan-600',
      'متوسط': 'from-orange-500 to-amber-600',
      'ضعيف': 'from-red-500 to-pink-600',
      'سيء': 'from-red-700 to-red-900',
      'جديد': 'from-slate-500 to-slate-700'
    };
    return colors[type] || colors['جديد'];
  };

  const getRatingIcon = (type: string) => {
    return type === 'ممتاز' || type === 'جيد' ? 
      <TrendingUp size={14} /> : 
      type === 'جديد' ? null :
      <TrendingDown size={14} />;
  };

  return (
    <div className="mt-2 p-3 rounded-lg bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 border border-slate-200 dark:border-slate-700">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Star size={16} className="text-yellow-500" />
          <span className="text-xs font-bold text-slate-600 dark:text-slate-300">تصنيف السلوك:</span>
        </div>
        
        {/* Rating Bar */}
        <div className="flex-1 mx-3 flex items-center gap-2">
          <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full bg-gradient-to-r ${getRatingColor(rating.type)} transition-all duration-300 rounded-full flex items-center justify-end px-1 azrar-w-${rating.points}`}
            />
          </div>
          <span className="text-xs font-bold text-slate-500 min-w-[30px]">{rating.points}%</span>
        </div>

        {/* Rating Badge */}
        <div className={`flex items-center gap-1 px-3 py-1 rounded-full bg-white dark:bg-slate-800 border-2 ${
          rating.type === 'ممتاز' ? 'border-green-400 text-green-600' :
          rating.type === 'جيد' ? 'border-indigo-400 text-indigo-600' :
          rating.type === 'متوسط' ? 'border-orange-400 text-orange-600' :
          rating.type === 'ضعيف' ? 'border-red-400 text-red-600' :
          rating.type === 'سيء' ? 'border-red-600 text-red-700' :
          'border-slate-400 text-slate-600'
        }`}>
          {getRatingIcon(rating.type)}
          <span className="text-xs font-bold">{rating.type}</span>
        </div>

        {/* Status Text */}
        <div className="text-xs text-slate-500 dark:text-slate-400 ml-4 whitespace-nowrap">
          {rating.type === 'ممتاز' && '✅ دفع منتظم'}
          {rating.type === 'جيد' && '✅ موثوق'}
          {rating.type === 'متوسط' && '⚠️ متوسط'}
          {rating.type === 'ضعيف' && '❌ متخلف'}
          {rating.type === 'سيء' && '🚫 خطير'}
          {rating.type === 'جديد' && 'جديد'}
        </div>
      </div>
    </div>
  );
};

// --- Payment Modal Component ---
interface PaymentModalProps {
  installment: الكمبيالات_tbl;
  tenant: الأشخاص_tbl | undefined;
  onClose: () => void;
  onSuccess: () => void;
  userId: string;
  userRole: string;
}

const PaymentModal: React.FC<PaymentModalProps> = ({ installment, tenant, onClose, onSuccess, userId, userRole }) => {
  const [paidAmount, setPaidAmount] = useState<number | ''>('');
  const [notes, setNotes] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  type InstallmentWithDynamicFields = الكمبيالات_tbl & { حقول_ديناميكية?: unknown };
  const initialDyn = (installment as InstallmentWithDynamicFields).حقول_ديناميكية;
  const [dynamicValues, setDynamicValues] = useState<Record<string, unknown>>(isRecord(initialDyn) ? initialDyn : {});
  const toast = useToast();

  useEffect(() => {
    const nextDyn = (installment as InstallmentWithDynamicFields).حقول_ديناميكية;
    setDynamicValues(isRecord(nextDyn) ? nextDyn : {});
  }, [installment]);

  const baseAmount = Math.max(0, Number(installment.القيمة_المتبقية || installment.القيمة) || 0);
  const paidAmountNumber = Math.max(0, Number(paidAmount || 0) || 0);
  const remainingAfterPayment = Math.max(0, baseAmount - paidAmountNumber);
  const isPartial = paidAmountNumber < baseAmount && paidAmountNumber > 0;

  const handlePay = () => {
    if (paidAmountNumber <= 0) {
      toast.error('يجب إدخال مبلغ أكبر من صفر');
      return;
    }

    // Persist dynamic fields (optional) on the installment itself
    try {
      if (typeof DbService.updateInstallmentDynamicFields === 'function') {
        const resDyn = DbService.updateInstallmentDynamicFields(installment.رقم_الكمبيالة, userId, userRole as RoleType, dynamicValues);
        if (!resDyn.success) {
          toast.error(resDyn.message || 'فشل حفظ الحقول الإضافية');
          return;
        }
      }
    } catch {
      // ignore - keep payment flow
    }

    // Mark as paid (fully or partial) - pass userId and role
    const resPay = DbService.markInstallmentPaid(installment.رقم_الكمبيالة, userId, userRole as RoleType, {
      paidAmount: paidAmountNumber,
      paymentDate: paymentDate,
      notes: notes || 'تم الدفع عبر Modal',
      isPartial: isPartial
    });

    if (!resPay.success) {
      toast.error(resPay.message || 'فشل تسجيل السداد');
      return;
    }

    // Show notifications
    if (isPartial) {
      toast.warning(`دفعة جزئية: ${formatNumber(paidAmountNumber)} د.أ - الباقي: ${formatNumber(remainingAfterPayment)} د.أ`);
    } else {
      toast.success(`تم سداد الدفعة كاملة بنجاح للمستأجر: ${tenant?.الاسم || 'مستأجر'}`);
    }

    // Add note to activity
    if (notes) {
      toast.info(`ملاحظة: ${notes}`);
    }

    onSuccess();
    onClose();
  };

  return (
    <AppModal open title="سداد دفعة" onClose={onClose} size="md">
        <div className="space-y-4">

          {/* Tenant Info */}
          <div className="bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-lg">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              المستأجر: {tenant?.الاسم}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              المبلغ الأصلي: {formatNumber(Number(installment.القيمة || 0))} د.أ
            </p>
          </div>

          {/* Amount Input */}
          <div>
            <label className="block text-sm font-bold mb-2">المبلغ المدفوع (د.أ)</label>
            <div className="flex items-center gap-2">
              <Input
                type="text"
                inputMode="decimal"
                dir="ltr"
                value={paidAmount}
                onChange={(e) => {
                  const raw = normalizeDigitsToLatin(e.target.value);
                  const n = parseNumberOrUndefined(raw);
                  setPaidAmount(n === undefined ? '' : Math.max(0, n));
                }}
                className="flex-1"
              />
              <button
                type="button"
                onClick={() => setPaidAmount(baseAmount)}
                className="px-3 py-2 rounded-lg bg-slate-200/70 hover:bg-slate-200 text-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-white text-sm font-bold"
                title="تعبئة كامل المبلغ"
              >
                كامل
              </button>
            </div>
            {isPartial && (
              <p className="text-xs text-orange-600 mt-1">
                ⚠️ دفعة جزئية - الباقي: {formatNumber(remainingAfterPayment)} د.أ
              </p>
            )}
          </div>

          {/* Payment Date */}
          <div>
            <label className="text-sm font-bold mb-2 flex items-center gap-2">
              <Calendar size={16} /> تاريخ الدفع
            </label>
            <Input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
            />
          </div>

          {/* Notes */}
          <div>
            <label className="text-sm font-bold mb-2 flex items-center gap-2">
              <MessageSquare size={16} /> ملاحظات (اختياري)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="أضف ملاحظات حول الدفعة..."
              className="w-full h-20 p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-slate-900 dark:text-white"
            />
          </div>

          <DynamicFieldsSection formId="installments" values={dynamicValues} onChange={setDynamicValues} />

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4">
            <Button
              variant="ghost"
              className="flex-1"
              onClick={onClose}
            >
              إلغاء
            </Button>
            <Button
              variant="primary"
              className="flex-1 bg-green-600 hover:bg-green-700"
              onClick={handlePay}
            >
              تأكيد السداد
            </Button>
          </div>
        </div>
    </AppModal>
  );
};

// --- Sub-Component: Contract Financial Card ---
interface ContractCardProps {
  contract: العقود_tbl;
  tenant: الأشخاص_tbl | undefined;
  property: العقارات_tbl | undefined;
  installments: الكمبيالات_tbl[];
  isAdmin: boolean; // من Props
  userId: string; // ✅ NEW: Preserved from context
  userRole: RoleType; // ✅ NEW: Preserved from context
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

const ContractFinancialCard: React.FC<ContractCardProps> = ({ contract, tenant, property, installments, userId, userRole, showDynamicColumns, dynamicFields, onFullPayment, onPartialPayment, onReversePayment, onOpenMessageModal, openPanel }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const toast = useToast();
  const dialogs = useAppDialogs();

  // Stats Calculation
  const visibleInstallments = installments.filter(i => !i.isArchived);
  const rentInstallments = visibleInstallments.filter(i => i.نوع_الكمبيالة !== 'تأمين');
  const totalAmount = rentInstallments.reduce((sum, i) => sum + i.القيمة, 0);
  const paidAmount = rentInstallments.reduce((sum, i) => sum + getPaidAndRemaining(i).paid, 0);
  const remainingAmount = rentInstallments.reduce((sum, i) => sum + getPaidAndRemaining(i).remaining, 0);
  const progress = totalAmount > 0 ? (paidAmount / totalAmount) * 100 : 0;
  const progressPct = Math.round(Math.max(0, Math.min(100, progress)));
  
  // Late Check
  const lateCount = visibleInstallments.filter(i => {
    if (i.حالة_الكمبيالة === INSTALLMENT_STATUS.PAID || i.حالة_الكمبيالة === INSTALLMENT_STATUS.CANCELLED) return false;
    if (i.نوع_الكمبيالة === 'تأمين') return false;
    return getPaidAndRemaining(i).remaining > 0 && isBeforeTodayDateOnly(i.تاريخ_استحقاق);
  }).length;
  
  // Security Deposit
  const security = visibleInstallments.find(i => i.نوع_الكمبيالة === 'تأمين');

  // Contract-level financial summary (requested: per contract only)
  const overdueAmount = rentInstallments
    .filter(i => i.حالة_الكمبيالة !== INSTALLMENT_STATUS.PAID && getPaidAndRemaining(i).remaining > 0 && isBeforeTodayDateOnly(i.تاريخ_استحقاق))
    .reduce((sum, i) => sum + getPaidAndRemaining(i).remaining, 0);

  const overdueList = rentInstallments
    .filter(i => i.حالة_الكمبيالة !== INSTALLMENT_STATUS.PAID && getPaidAndRemaining(i).remaining > 0 && isBeforeTodayDateOnly(i.تاريخ_استحقاق))
    .map((inst) => ({ inst, remaining: getPaidAndRemaining(inst).remaining }))
    .sort((a, b) => compareDateOnlySafe(a.inst.تاريخ_استحقاق, b.inst.تاريخ_استحقاق));

  const overdueInstallmentsCount = overdueList.length;
  const overdueAmountTotal = overdueList.reduce((sum, x) => sum + (Number(x.remaining) || 0), 0);
  const overdueInstallmentsDetails = overdueList.length
    ? overdueList
        .map((x, idx) => {
          const daysLate = Math.max(0, daysBetweenDateOnlySafe(x.inst.تاريخ_استحقاق, todayDateOnlyISO()) ?? 0);
          return `رقم الدفعة: ${idx + 1} | تاريخ الاستحقاق: ${x.inst.تاريخ_استحقاق} | قيمة الدفعة: ${(Number(x.remaining) || 0).toLocaleString()} د.أ | عدد أيام التأخير: ${daysLate} يوم`;
        })
        .join('\n')
    : '';

  return (
    <Card className={`transition-all duration-300 ${isExpanded ? 'ring-2 ring-indigo-500/20 border-indigo-500/50' : 'hover:shadow-md'}`}>
      
      {/* Card Header (Summary) */}
      <div className="p-5 cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4">
          
          {/* Left: Info */}
          <div className="flex items-start gap-4">
             <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold text-white shrink-0 ${lateCount > 0 ? 'bg-red-500' : remainingAmount === 0 ? 'bg-green-500' : 'bg-indigo-600'}`}>
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
                   <span className="flex items-center gap-1"><Home size={14}/> {property?.الكود_الداخلي}</span>
                   <span className="text-gray-300">|</span>
                   <span className="flex items-center gap-1 font-mono"><FileText size={14}/> #{formatContractNumberShort(contract.رقم_العقد)}</span>
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
                <span className="text-[10px] text-slate-400 font-bold">المتبقي: <span className="text-slate-600 dark:text-slate-200">{remainingAmount.toLocaleString()} د.أ</span></span>
             </div>
          </div>

          {/* Right: Expand Trigger */}
          <div className="flex items-center justify-between lg:justify-end gap-4 min-w-[120px]">
             <div className={`p-2 rounded-full transition-transform duration-300 ${isExpanded ? 'rotate-180 bg-gray-100 dark:bg-slate-700' : ''}`}>
                <ChevronDown size={20} className="text-slate-400" />
             </div>
          </div>
        </div>
      </div>

      {/* Expanded Details (Installments List) */}
      {isExpanded && (
        <div className="border-t border-gray-100 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-900/50 p-4 animate-slide-up">

           {/* Contract Financial Summary */}
           <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
             <div className="app-card text-left p-2 px-4 rounded-xl">
               <p className="text-[10px] text-slate-400 font-bold uppercase">إجمالي الإيجار</p>
               <p className="font-black text-base text-slate-800 dark:text-white">{totalAmount.toLocaleString()} د.أ</p>
             </div>
             <div className="text-left bg-emerald-50 dark:bg-emerald-900/20 p-2 px-4 rounded-xl border border-emerald-100 dark:border-emerald-800 shadow-sm">
               <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase">تم تحصيله</p>
               <p className="font-black text-base text-emerald-700 dark:text-emerald-300">{paidAmount.toLocaleString()} د.أ</p>
             </div>
             <div className="text-left bg-orange-50 dark:bg-orange-900/20 p-2 px-4 rounded-xl border border-orange-100 dark:border-orange-800 shadow-sm">
               <p className="text-[10px] text-orange-600 dark:text-orange-400 font-bold uppercase">المتبقي</p>
               <p className="font-black text-base text-orange-700 dark:text-orange-300">{remainingAmount.toLocaleString()} د.أ</p>
             </div>
             <div className="text-left bg-red-50 dark:bg-red-900/20 p-2 px-4 rounded-xl border border-red-100 dark:border-red-800 shadow-sm">
               <p className="text-[10px] text-red-600 dark:text-red-400 font-bold uppercase">متأخر</p>
               <p className="font-black text-base text-red-700 dark:text-red-300">{overdueAmount.toLocaleString()} د.أ</p>
             </div>
           </div>
           
           {/* Security Deposit Badge */}
           {security && (
             <div className="mb-4 flex items-center justify-between bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg border border-purple-100 dark:border-purple-800">
                <div className="flex items-center gap-2 text-purple-700 dark:text-purple-300 font-bold text-sm">
                   <Lock size={16} />
                   ورقة تأمين (ضمان) محفوظة
                </div>
                <div className="font-mono font-bold text-purple-800 dark:text-purple-200">{security.القيمة.toLocaleString()} د.أ</div>
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
                   {showDynamicColumns && dynamicFields.length > 0
                    ? dynamicFields.map((f) => (
                      <th key={f.id} className="p-3">{f.label}</th>
                    ))
                    : null}
                      <th className="p-3">السداد الكامل</th>
                      <th className="p-3">الدفعة الجزئية</th>
                      <th className="p-3">رسائل</th>
                      <th className="p-3">آخرى</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                       {visibleInstallments.filter(i => i.نوع_الكمبيالة !== 'تأمين').map((inst, idx) => {
                      const isLate = inst.حالة_الكمبيالة !== INSTALLMENT_STATUS.PAID && getPaidAndRemaining(inst).remaining > 0 && isBeforeTodayDateOnly(inst.تاريخ_استحقاق);
                      const daysUntilDue = daysBetweenDateOnlySafe(todayDateOnlyISO(), inst.تاريخ_استحقاق) ?? 0;
                      const isDueSoon = daysUntilDue <= 3 && daysUntilDue > 0 && inst.حالة_الكمبيالة !== INSTALLMENT_STATUS.PAID;
                      type InstallmentExtras = الكمبيالات_tbl & { غرامة_تأخير?: unknown; تصنيف_غرامة_تأخير?: unknown; حقول_ديناميكية?: unknown };
                      const lateFeeRaw = (inst as InstallmentExtras).غرامة_تأخير;
                      const lateFee = typeof lateFeeRaw === 'number' && Number.isFinite(lateFeeRaw) ? lateFeeRaw : undefined;
                      const lateFeeClassRaw = (inst as InstallmentExtras).تصنيف_غرامة_تأخير;
                      const lateFeeClass = typeof lateFeeClassRaw === 'string' ? lateFeeClassRaw : undefined;
                      
                      // Row background color based on status
                      let rowBgColor = '';
                      if (isLate) rowBgColor = 'bg-red-50/30 dark:bg-red-900/10 border-l-4 border-red-500';
                      else if (isDueSoon) rowBgColor = 'bg-orange-50/30 dark:bg-orange-900/10 border-l-4 border-orange-500';
                      else if (inst.حالة_الكمبيالة === INSTALLMENT_STATUS.PAID) rowBgColor = 'bg-green-50/20 dark:bg-green-900/10 border-l-4 border-green-500';
                      
                      return (
                         <tr key={inst.رقم_الكمبيالة} className={`${DS.components.table.row} ${rowBgColor}`}>
                            <td className="p-3 font-mono text-slate-400">{idx + 1}</td>
                            <td className={`p-3 font-medium ${isLate ? 'text-red-600 font-bold' : isDueSoon ? 'text-orange-600 font-bold' : ''}`}>
                               {inst.تاريخ_استحقاق}
                            </td>
                            <td className="p-3 font-bold">{inst.القيمة.toLocaleString()} د.أ</td>
                            <td className={`p-3 font-bold ${(inst.القيمة_المتبقية ?? 0) > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                               {(inst.حالة_الكمبيالة === INSTALLMENT_STATUS.PAID
                                 ? 0
                                 : (inst.القيمة_المتبقية ?? inst.القيمة)
                                ).toLocaleString()} د.أ
                            </td>
                            <td className="p-3 text-slate-500">
                               {inst.تاريخ_الدفع ? inst.تاريخ_الدفع : '-'}
                            </td>
                            <td className="p-3">
                               <div className="flex flex-col gap-1">
                                  {inst.حالة_الكمبيالة === INSTALLMENT_STATUS.PAID ? (
                                     <span className="text-green-600 flex items-center gap-1 font-bold text-xs"><Check size={14}/> مدفوع</span>
                                  ) : inst.حالة_الكمبيالة === INSTALLMENT_STATUS.PARTIAL ? (
                                     <span className="text-indigo-600 flex items-center gap-1 font-bold text-xs"><AlertCircle size={14}/> جزئي</span>
                                  ) : (
                                     <span className={`flex items-center gap-1 font-bold text-xs px-2 py-1 rounded ${isLate ? 'bg-red-100 text-red-600' : isDueSoon ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-600'}`}>
                                        {isLate && <AlertTriangle size={12}/>}
                                        {isLate ? 'متأخر' : isDueSoon ? 'مستحق قريباً' : 'في الموعد'}
                                     </span>
                                  )}
                               </div>
                            </td>

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
                               {inst.حالة_الكمبيالة !== INSTALLMENT_STATUS.PAID && inst.حالة_الكمبيالة !== INSTALLMENT_STATUS.CANCELLED && (
                                  <Button 
                                     size="sm"
                                     variant="primary"
                                     className="bg-green-600 hover:bg-green-700 text-white font-bold shadow-lg py-2 h-10 text-sm px-4 rounded-lg transition-all duration-200 w-full"
                                     onClick={(e) => { e.stopPropagation(); onFullPayment(inst); }}
                                  >
                                     ✓ سداد كامل
                                  </Button>
                               )}
                            </td>
                            <td className="p-3">
                               {inst.حالة_الكمبيالة !== INSTALLMENT_STATUS.PAID && inst.حالة_الكمبيالة !== INSTALLMENT_STATUS.CANCELLED && (
                                  <Button 
                                     size="sm"
                                     variant="secondary"
                                     className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-md py-2 h-9 text-sm px-4 rounded-lg transition-all duration-200 w-full"
                                     onClick={(e) => { e.stopPropagation(); onPartialPayment(inst); }}
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
                               {(inst.حالة_الكمبيالة === INSTALLMENT_STATUS.PAID || inst.حالة_الكمبيالة === INSTALLMENT_STATUS.PARTIAL) && 
                                can(userRole, 'INSTALLMENT_REVERSE') && (
                                  <Button 
                                     size="sm"
                                     variant="secondary"
                                     className="bg-red-600 hover:bg-red-700 shadow-md py-1 h-8 text-xs px-2 text-white font-medium rounded-lg transition-all duration-200 w-full"
                                     onClick={(e) => { e.stopPropagation(); onReversePayment(inst); }}
                                  >
                                     عكس السداد
                                  </Button>
                               )}

                               {/* Late fee calculator (persist only on confirm) */}
                               {inst.حالة_الكمبيالة !== INSTALLMENT_STATUS.CANCELLED && inst.نوع_الكمبيالة !== 'تأمين' && (
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
                                       if (classification === null || classification === undefined) return;

                                       const amountStr = await dialogs.prompt({
                                         title: 'قيمة الغرامة',
                                         message: 'أدخل قيمة الغرامة (بالدينار):',
                                         inputType: 'number',
                                         defaultValue: typeof lateFee === 'number' ? String(lateFee) : '0',
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

                                       const res = DbService.setInstallmentLateFee(inst.رقم_الكمبيالة, userId, userRole, {
                                         amount,
                                         classification: classification || undefined,
                                       });
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
                                       محفوظة: <span className="font-bold">{lateFee.toLocaleString()} د.أ</span>{lateFeeClass ? ` — ${lateFeeClass}` : ''}
                                     </div>
                                   )}
                                 </div>
                               )}
                            </td>
                         </tr>
                      )
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
      )}
    </Card>
  );
};

// --- Main Page Component ---

export const Installments: React.FC = () => {
  // Auth Hook for role checking
  const { user } = useAuth();
  const isAdmin = user?.الدور === 'SuperAdmin' || user?.الدور === 'Admin';
  const userId = user?.id || 'system';
  const userRole = normalizeRole(user?.الدور);

  const toast = useToast();

  const [contracts, setContracts] = useState<العقود_tbl[]>([]);
  const [people, setPeople] = useState<الأشخاص_tbl[]>([]);
  const [properties, setProperties] = useState<العقارات_tbl[]>([]);
  const [installments, setInstallments] = useState<الكمبيالات_tbl[]>([]);

  const isDesktop = typeof window !== 'undefined' && !!window.desktopDb;
  const isDesktopFast = isDesktop && !!window.desktopDb?.domainInstallmentsContractsSearch;

  type DesktopContract = العقود_tbl & { id?: string };
  type DesktopInstallmentsRow = {
    contract: DesktopContract;
    tenant?: الأشخاص_tbl;
    property?: العقارات_tbl;
    installments?: الكمبيالات_tbl[];
    hasDebt?: boolean;
    hasDueSoon?: boolean;
    isFullyPaid?: boolean;
  };

  const [desktopRows, setDesktopRows] = useState<DesktopInstallmentsRow[]>([]);
  const [desktopTotal, setDesktopTotal] = useState(0);
  const [desktopPage, setDesktopPage] = useState(0);
  const [desktopLoading, setDesktopLoading] = useState(false);
  const [desktopCounts, setDesktopCounts] = useState<{ people: number; properties: number; contracts: number } | null>(null);
  const [desktopError, setDesktopError] = useState('');
  const warnedDesktopErrorRef = useRef<string>('');

  const [showDynamicColumns, setShowDynamicColumns] = useState(false);
  const [dynamicFields, setDynamicFields] = useState<DynamicFormField[]>([]);
  
  const [filter, setFilter] = useState<"all" | "debt" | "paid" | "due">("all");
  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState<'tenant-asc' | 'tenant-desc' | 'due-asc' | 'due-desc'>('due-asc');
  const [selectedInstallment, setSelectedInstallment] = useState<الكمبيالات_tbl | null>(null);
  
  // Confirmation Dialog State
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    type: 'warning' as 'warning' | 'danger' | 'success' | 'info',
    title: '',
    message: '',
    confirmText: '',
    cancelText: '',
    action: null as (() => void) | null,
    reverseReason: '', // سبب عكس السداد
    showReasonField: false, // إظهار حقل السبب
  });

  const confirmDialogRef = useRef(confirmDialog);
  useEffect(() => {
    confirmDialogRef.current = confirmDialog;
  }, [confirmDialog]);

  // Message Composer Modal State
  const [messageModalOpen, setMessageModalOpen] = useState(false);
  const [messageContext, setMessageContext] = useState<{
    installment: الكمبيالات_tbl;
    contract: العقود_tbl;
    tenant: الأشخاص_tbl;
    property: العقارات_tbl;
    category: 'reminder' | 'due' | 'late' | 'warning' | 'legal';
    overdueInstallmentsCount?: number;
    overdueAmountTotal?: number;
    overdueInstallmentsDetails?: string;
  } | null>(null);
  
  const { openPanel } = useSmartModal();

  const dbSignal = useDbSignal();

  // Support deep links: #/installments?filter=due|debt|paid|all&q=...
  useEffect(() => {
    const applyFromHash = () => {
      try {
        const raw = String(window.location.hash || '').startsWith('#')
          ? String(window.location.hash || '').slice(1)
          : String(window.location.hash || '');
        const qIndex = raw.indexOf('?');
        const searchPart = qIndex >= 0 ? raw.slice(qIndex + 1) : '';
        const params = new URLSearchParams(searchPart);

        const nextFilter = String(params.get('filter') || '').trim();
        if (nextFilter === 'all' || nextFilter === 'debt' || nextFilter === 'paid' || nextFilter === 'due') {
          setFilter(nextFilter);
        }

        const q = params.get('q');
        const s = params.get('search');
        if (q !== null) setSearch(String(q));
        else if (s !== null) setSearch(String(s));
      } catch {
        // ignore
      }
    };

    applyFromHash();
    window.addEventListener('hashchange', applyFromHash);
    return () => window.removeEventListener('hashchange', applyFromHash);
  }, []);

  const legacyLoadData = useCallback(() => {
    setContracts(DbService.getContracts());
    setPeople(DbService.getPeople());
    setProperties(DbService.getProperties());
    // Sort installments by date for easier processing inside cards
    const allInst = DbService.getInstallments().sort((a, b) => compareDateOnlySafe(a.تاريخ_استحقاق, b.تاريخ_استحقاق));
    setInstallments(allInst);

    try {
      const f = DbService.getFormFields?.('installments') || [];
      setDynamicFields(Array.isArray(f) ? f : []);
    } catch {
      setDynamicFields([]);
    }
  }, []);

  const loadDesktopData = useCallback(async () => {
    setDesktopLoading(true);
    setDesktopError('');
    try {
      const counts = await domainCountsSmart();
      setDesktopCounts(counts);

      // Keep dynamic fields in renderer (not huge).
      try {
        const f = DbService.getFormFields?.('installments') || [];
        setDynamicFields(Array.isArray(f) ? f : []);
      } catch {
        setDynamicFields([]);
      }

      const res = await installmentsContractsPagedSmart({
        query: String(search || ''),
        filter,
        sort: sortMode,
        offset: desktopPage * PAGE_SIZE,
        limit: PAGE_SIZE,
      });

      if (res?.error) {
        const msg = String(res.error || '').trim();
        setDesktopError(msg);
        if (msg && warnedDesktopErrorRef.current !== msg) {
          warnedDesktopErrorRef.current = msg;
          toast.error(msg);
        }
      }

      setDesktopRows(Array.isArray(res?.items) ? (res.items as DesktopInstallmentsRow[]) : []);
      setDesktopTotal(Number(res?.total || 0) || 0);

      // Clear legacy lists to avoid heavy computations/renders.
      setContracts([]);
      setPeople([]);
      setProperties([]);
      setInstallments([]);
    } finally {
      setDesktopLoading(false);
    }
  }, [desktopPage, filter, search, sortMode, toast]);

  const loadData = useCallback(() => {
    if (isDesktopFast) {
      void loadDesktopData();
      return;
    }
    // Desktop safety: do not fall back to legacy in-memory scans.
    if (isDesktop) {
      setDesktopRows([]);
      setDesktopTotal(0);
      setDesktopCounts(null);
      setContracts([]);
      setPeople([]);
      setProperties([]);
      setInstallments([]);
      try {
        const f = DbService.getFormFields?.('installments') || [];
        setDynamicFields(Array.isArray(f) ? f : []);
      } catch {
        setDynamicFields([]);
      }
      return;
    }
    legacyLoadData();
  }, [isDesktop, isDesktopFast, legacyLoadData, loadDesktopData]);

  useEffect(() => {
    loadData();
  }, [loadData, dbSignal]);

  useEffect(() => {
    const onChanged: EventListener = () => {
      loadData();
    };
    window.addEventListener('azrar:installments-changed', onChanged);
    return () => window.removeEventListener('azrar:installments-changed', onChanged);
  }, [loadData]);

  const desktopPageCount = useMemo(() => {
    if (!isDesktopFast) return 1;
    const total = Number(desktopTotal || 0) || 0;
    if (total > 0) return Math.max(1, Math.ceil(total / PAGE_SIZE));

    // Fallback: if total isn't provided, infer whether there's a next page.
    const hasMaybeNext = Array.isArray(desktopRows) && desktopRows.length === PAGE_SIZE;
    return Math.max(1, hasMaybeNext ? desktopPage + 2 : desktopPage + 1);
  }, [desktopPage, desktopRows, desktopTotal, isDesktopFast]);

  useEffect(() => {
    if (!isDesktopFast) return;
    const maxPage = Math.max(0, desktopPageCount - 1);
    if (desktopPage > maxPage) setDesktopPage(maxPage);
  }, [desktopPage, desktopPageCount, isDesktopFast]);

  useEffect(() => {
    if (!isDesktopFast) return;
    // Reset to first page on filter/search changes.
    if (desktopPage !== 0) setDesktopPage(0);
    else void loadDesktopData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, search, sortMode, isDesktopFast]);

  useEffect(() => {
    if (!isDesktopFast) return;
    void loadDesktopData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desktopPage, isDesktopFast]);

  const resolveTenantNameForInstallment = async (installment: الكمبيالات_tbl): Promise<string> => {
    const fallback = 'المستأجر';
    const contractId = String(installment?.رقم_العقد || '').trim();
    if (!contractId) return fallback;

    if (isDesktopFast) {
      try {
        const row = desktopRows.find((r) => String(r?.contract?.رقم_العقد || '') === contractId);
        const fastName = String(row?.tenant?.الاسم || '').trim();
        if (fastName) return fastName;
      } catch {
        // ignore
      }

      try {
        const c = await domainGetSmart('contracts', contractId);
        const tenantId = isRecord(c) ? String(c['رقم_المستاجر'] ?? '').trim() : '';
        if (!tenantId) return fallback;
        const p = await domainGetSmart('people', tenantId);
        const name = isRecord(p) ? String(p['الاسم'] ?? '').trim() : '';
        return name || fallback;
      } catch {
        return fallback;
      }
    }

    // Legacy (web): current behavior
    const allContracts = DbService.getContracts();
    const contract = allContracts.find((c) => c.رقم_العقد === installment.رقم_العقد);
    if (!contract) return fallback;
    const allPeople = DbService.getPeople();
    const tenant = allPeople.find((p) => p.رقم_الشخص === contract.رقم_المستاجر);
    return String(tenant?.الاسم || '').trim() || fallback;
  };

  // Handle Full Payment - Direct without modal
  const handleFullPayment = async (installment: الكمبيالات_tbl) => {
    const tenantNameForDialog = await resolveTenantNameForInstallment(installment);
    
    // Calculate amount to pay (use remaining if partial, else full)
    const amountToPay = installment.القيمة_المتبقية || installment.القيمة;
    
    // Show confirmation dialog
    setConfirmDialog({
      isOpen: true,
      type: 'warning',
      title: 'تأكيد السداد الكامل',
      message: `المستأجر: ${tenantNameForDialog}\nالمبلغ: ${amountToPay.toLocaleString()} د.أ`,
      confirmText: 'موافق',
      cancelText: 'إلغاء الأمر',
      reverseReason: '',
      showReasonField: false,
      action: () => {
        // Mark as paid (full payment) - pass userId and role
        DbService.markInstallmentPaid(installment.رقم_الكمبيالة, userId, userRole, {
          paidAmount: amountToPay,
          paymentDate: new Date().toISOString().split('T')[0],
          notes: 'سداد كامل مباشر',
          isPartial: false
        });

        // Show success toast message
  toast.success(`تم سداد الدفعة بنجاح للمستأجر: ${tenantNameForDialog}`);

        // تحديث state مباشرة من قاعدة البيانات (بدون تأخير)
        loadData();
      }
    });
  };

  // Handle Partial Payment - Open modal to input amount
  const handlePartialPayment = (installment: الكمبيالات_tbl) => {
    setSelectedInstallment(installment);
  };

  // Handle Reverse Payment - Undo payment if clicked by mistake
  const handleReversePayment = async (installment: الكمبيالات_tbl) => {
    // ✅ استخدام نظام الصلاحيات - INSTALLMENT_REVERSE
    if (!can(userRole, 'INSTALLMENT_REVERSE')) {
      toast.error(`غير مصرح لك بعكس السداد. فقط ذوي الصلاحية المناسبة يمكنهم إجراء هذا الإجراء.`);
      return;
    }

    const tenantNameForDialog = await resolveTenantNameForInstallment(installment);
    
    const lastPaidAmount = getLastPositivePaymentAmount(installment);
    const amountToReverse = lastPaidAmount ?? installment.القيمة;

    // Show confirmation dialog with reason field
    setConfirmDialog({
      isOpen: true,
      type: 'danger',
      title: 'تأكيد عكس السداد',
      message: `المستأجر: ${tenantNameForDialog}\nسيتم عكس آخر عملية دفع بقيمة: ${amountToReverse.toLocaleString()} د.أ`,
      confirmText: 'نعم، ألغ السداد',
      cancelText: 'إلغاء الأمر',
      reverseReason: '',
      showReasonField: true,
      action: () => {
        const reason = confirmDialogRef.current.reverseReason;
        // Validate reason is provided
        if (!reason.trim()) {
          toast.error('يجب تحديد سبب عكس السداد');
          return;
        }

        // Reverse the payment with reason
        DbService.reversePayment(
          installment.رقم_الكمبيالة,
          userId,
          userRole,
          reason
        );

        // Show info toast message
        toast.info(`تم إلغاء سداد الدفعة بنجاح - السبب: ${reason}`);

        // Reload data immediately (no setTimeout)
        loadData();
      }
    });
  };

  const handlePay = (id: string) => {
    if (isDesktopFast) {
      for (const row of desktopRows) {
        const list = Array.isArray(row?.installments) ? row.installments : [];
        const inst = list.find((i) => String(i?.رقم_الكمبيالة || '') === id);
        if (inst) {
          setSelectedInstallment(inst);
          return;
        }
      }
      return;
    }

    const inst = installments.find((i) => i.رقم_الكمبيالة === id);
    if (inst) setSelectedInstallment(inst);
  };

  // Group Data Structure
  const groupedData = useMemo(() => {
      if (isDesktopFast) return [];
      const today = todayDateOnlyLocal();
      const isCollectibleDebtInstallment = (i: الكمبيالات_tbl) => {
        if (i.نوع_الكمبيالة === 'تأمين') return false;
        const status = String(i.حالة_الكمبيالة ?? '').trim();
        if (status === INSTALLMENT_STATUS.CANCELLED) return false;
        const { remaining } = getPaidAndRemaining(i);
        if (remaining <= 0) return false;
        const due = parseDateOnlyLocal(i.تاريخ_استحقاق);
        if (!due) return false;
        // عليهم ذمم = يستحق الدفع الآن (اليوم أو متأخر)
        return due.getTime() <= today.getTime();
      };

      const isRealInstallment = (i: الكمبيالات_tbl) => {
        if (i.نوع_الكمبيالة === 'تأمين') return false;
        const status = String(i.حالة_الكمبيالة ?? '').trim();
        return status !== INSTALLMENT_STATUS.CANCELLED;
      };

      const isDueSoonInstallment = (i: الكمبيالات_tbl) => {
        if (!isRealInstallment(i)) return false;
        const { remaining } = getPaidAndRemaining(i);
        if (remaining <= 0) return false;
        const daysUntilDue = daysBetweenDateOnlySafe(todayDateOnlyISO(), i.تاريخ_استحقاق);
        if (typeof daysUntilDue !== 'number') return false;
        // "مستحق قريباً" = خلال 7 أيام (قبل الاستحقاق فقط)
        return daysUntilDue > 0 && daysUntilDue <= 7;
      };

      // Map installments to contracts
      const map = new Map<string, الكمبيالات_tbl[]>();
      installments.forEach(i => {
        if (i.isArchived) return;
        const existing = map.get(i.رقم_العقد);
        if (existing) {
          existing.push(i);
        } else {
          map.set(i.رقم_العقد, [i]);
        }
      });

      // Join contracts with people/props
      return contracts
        .filter(c => isTenancyRelevant(c))
        .map(c => {
          const cInstalls = map.get(c.رقم_العقد) || [];
          const tenant = people.find(p => p.رقم_الشخص === c.رقم_المستاجر);
          const prop = properties.find(p => p.رقم_العقار === c.رقم_العقار);
          
          // Calculations for filtering
            const relevant = cInstalls.filter(isRealInstallment);
            const hasDebt = relevant.some(isCollectibleDebtInstallment);
            const hasDueSoon = relevant.some(isDueSoonInstallment);
            const hasAnyRelevant = relevant.length > 0;
            const isFullyPaid = hasAnyRelevant && relevant.every(i => getPaidAndRemaining(i).remaining <= 0);

          return { contract: c, tenant, property: prop, installments: cInstalls, hasDebt, hasDueSoon, isFullyPaid };
      });
  }, [isDesktopFast, contracts, people, properties, installments]);

  // Filtering Logic
  const filteredList = useMemo(() => {
      if (isDesktopFast) return [];
      let data = groupedData;

      // 1. Status Filter
      if (filter === 'debt') data = data.filter(d => d.hasDebt);
      if (filter === 'due') data = data.filter(d => d.hasDueSoon);
      if (filter === 'paid') data = data.filter(d => d.isFullyPaid);

      // 2. Search Text
      if (search.trim()) {
          const lower = search.toLowerCase();
          data = data.filter(d => 
              (d.tenant?.الاسم.toLowerCase().includes(lower)) ||
              (d.property?.الكود_الداخلي.toLowerCase().includes(lower)) ||
              (d.contract.رقم_العقد.toLowerCase().includes(lower))
          );
      }

      const getNextDueISO = (installs: الكمبيالات_tbl[]) => {
        let best: Date | null = null;
        for (const i of installs) {
          if (i.نوع_الكمبيالة === 'تأمين') continue;
          const status = String(i.حالة_الكمبيالة ?? '').trim();
          if (status === INSTALLMENT_STATUS.CANCELLED) continue;
          const { remaining } = getPaidAndRemaining(i);
          if (remaining <= 0) continue;
          const due = parseDateOnlyLocal(i.تاريخ_استحقاق);
          if (!due) continue;
          // Keep the earliest due date (including overdue/ today)
          if (!best || due.getTime() < best.getTime()) best = due;
        }
        // If no remaining installments, return null.
        return best ? best.toISOString() : null;
      };

      data = [...data].sort((a, b) => {
        if (sortMode === 'due-asc' || sortMode === 'due-desc') {
          const aDue = getNextDueISO(Array.isArray(a.installments) ? a.installments : []);
          const bDue = getNextDueISO(Array.isArray(b.installments) ? b.installments : []);
          const aHas = !!aDue;
          const bHas = !!bDue;
          if (aHas !== bHas) return aHas ? -1 : 1; // nulls last
          if (aHas && bHas && aDue !== bDue) return sortMode === 'due-asc' ? aDue.localeCompare(bDue) : bDue.localeCompare(aDue);
        }

        const aName = String(a.tenant?.الاسم ?? '').trim();
        const bName = String(b.tenant?.الاسم ?? '').trim();
        if (sortMode === 'tenant-desc') {
          if (aName !== bName) return bName.localeCompare(aName, 'ar');
        } else {
          if (aName !== bName) return aName.localeCompare(bName, 'ar');
        }

        const aId = String(a.contract?.رقم_العقد ?? '').trim();
        const bId = String(b.contract?.رقم_العقد ?? '').trim();
        return aId.localeCompare(bId, 'ar');
      });

      return data;
  }, [isDesktopFast, groupedData, filter, search, sortMode]);

  // Calculate Global Totals
  // (Removed) Global financial summary: user requested summary per-contract only.

  return (
    <DataGuard
      check={() => {
        // Desktop fast mode can operate even if domainCounts is unavailable.
        // Avoid hard-blocking the page based on counts while loading/failing.
        const desktopCountsKnown = isDesktopFast && desktopCounts !== null;
        const desktopHasAny = isDesktopFast && (desktopTotal > 0 || desktopRows.length > 0);

        const hasContracts = isDesktopFast
          ? (desktopLoading ? true : desktopHasAny ? true : desktopCountsKnown ? (Number(desktopCounts?.contracts || 0) > 0) : true)
          : contracts.length > 0;

        const missingData: string[] = [];
        if (!hasContracts && (!isDesktopFast || desktopCountsKnown)) missingData.push('contracts');

        return {
          isValid: hasContracts,
          message: isDesktopFast && !desktopCountsKnown
            ? 'جاري التحقق من البيانات...'
            : 'لا توجد عقود في النظام. يتم إنشاء الأقساط تلقائياً عند إضافة عقود.',
          missingData,
        };
      }}
      emptyMessage="لا يمكن عرض الأقساط بدون عقود"
      actionLabel="إنشاء عقد"
      actionLink="#/contracts"
    >
      <div className="animate-fade-in pb-10">

        <SmartFilterBar
          title="المالية والتحصيل"
          subtitle="إدارة الدفعات حسب العقود، السداد، ومتابعة المتأخرات"
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="بحث: اسم المستأجر، رقم العقد، كود العقار..."
          onRefresh={loadData}
          extraActions={
            <div className="flex flex-wrap items-center justify-end gap-2">
              <SegmentedTabs
                tabs={[
                  { id: 'all', label: 'الكل' },
                  { id: 'due', label: 'مستحق قريباً', icon: Clock },
                  { id: 'debt', label: 'عليهم ذمم', icon: AlertTriangle },
                  { id: 'paid', label: 'مسدد بالكامل', icon: Check },
                ]}
                activeId={filter}
                onChange={(id) => setFilter(id)}
              />

              <Select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as 'tenant-asc' | 'tenant-desc' | 'due-asc' | 'due-desc')}
                options={[
                  { value: 'tenant-asc', label: 'المستأجر: تصاعدي' },
                  { value: 'tenant-desc', label: 'المستأجر: تنازلي' },
                  { value: 'due-asc', label: 'الاستحقاق: الأقرب' },
                  { value: 'due-desc', label: 'الاستحقاق: الأبعد' },
                ]}
              />

              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowDynamicColumns((v) => !v)}
              >
                {showDynamicColumns ? 'إخفاء الحقول الإضافية' : 'إظهار الحقول الإضافية'}
              </Button>
            </div>
          }
        />

      {/* -------------------------------- */}
      {/*           Contracts List         */}
      {/* -------------------------------- */}
      <div className="space-y-4">
         {isDesktopFast && desktopError && (
           <div className="app-card p-4 border border-rose-200/80 dark:border-rose-900/40 bg-rose-50/70 dark:bg-rose-950/20">
             <div className="text-sm font-bold text-rose-800 dark:text-rose-200">تعذر تحميل البيانات من نسخة Desktop</div>
             <div className="text-xs text-rose-700/90 dark:text-rose-200/80 mt-1 whitespace-pre-wrap">{desktopError}</div>
           </div>
         )}
         {isDesktopFast ? (
           (!desktopLoading && filter === 'all' && !search.trim() && desktopTotal === 0) ? (
             <EmptyState
               type="installments"
               message="لا توجد أقساط حالياً. سيتم إنشاء الأقساط تلقائياً عند إضافة عقود جديدة."
               actionLabel="عرض العقود"
               onAction={() => (window.location.hash = '#' + ROUTE_PATHS.CONTRACTS)}
             />
           ) : (!desktopLoading && desktopTotal === 0) ? (
             <EmptyState
               type={search.trim() ? "search" : "filter"}
               title={search.trim() ? "لا توجد نتائج بحث" : "لا توجد نتائج"}
               message={search.trim() ? `لم يتم العثور على عقود تطابق "${search}"` : `لا توجد عقود تطابق الفلاتر المحددة`}
               actionLabel={search.trim() ? "مسح البحث" : "مسح الفلاتر"}
               onAction={() => {
                 setSearch('');
                 setFilter('all');
               }}
             />
           ) : (
             <>
               <div className="flex items-center justify-between">
                 <div className="text-sm text-slate-500 dark:text-slate-400">
                   {desktopLoading ? '...' : desktopTotal.toLocaleString()} عقد
                 </div>
                 <div className="flex items-center gap-2">
                   <Button size="sm" variant="secondary" disabled={desktopLoading || desktopPage <= 0} onClick={() => setDesktopPage((p) => Math.max(0, p - 1))}>
                     السابق
                   </Button>
                   <div className="text-sm text-slate-600 dark:text-slate-300">
                     {desktopPage + 1} / {desktopPageCount}
                   </div>
                   <Button
                     size="sm"
                     variant="secondary"
                     disabled={desktopLoading || desktopPage + 1 >= desktopPageCount}
                     onClick={() => setDesktopPage((p) => Math.min(Math.max(0, desktopPageCount - 1), p + 1))}
                   >
                     التالي
                   </Button>
                 </div>
               </div>

               {desktopRows.map((item) => (
                 <ContractFinancialCard
                   key={item?.contract?.رقم_العقد || item?.contract?.id || Math.random().toString(16).slice(2)}
                   contract={item.contract}
                   tenant={item.tenant}
                   property={item.property}
                   installments={Array.isArray(item.installments) ? item.installments : []}
                   isAdmin={isAdmin}
                   userId={userId}
                   userRole={userRole}
                   showDynamicColumns={showDynamicColumns}
                   dynamicFields={dynamicFields}
                   onPay={handlePay}
                   onSelectInstallment={setSelectedInstallment}
                   onFullPayment={handleFullPayment}
                   onPartialPayment={handlePartialPayment}
                   onReversePayment={handleReversePayment}
                   onOpenMessageModal={(context) => {
                     setMessageContext(context);
                     setMessageModalOpen(true);
                   }}
                   openPanel={openPanel}
                 />
               ))}
             </>
           )
         ) : installments.length === 0 ? (
             // حالة: لا توجد أقساط في النظام
             <EmptyState
                 type="installments"
                 message="لا توجد أقساط حالياً. سيتم إنشاء الأقساط تلقائياً عند إضافة عقود جديدة."
                 actionLabel="عرض العقود"
                 onAction={() => window.location.hash = '#' + ROUTE_PATHS.CONTRACTS}
             />
         ) : filteredList.length === 0 ? (
             // حالة: لا توجد نتائج بحث أو فلترة
             <EmptyState
                 type={search.trim() ? "search" : "filter"}
                 title={search.trim() ? "لا توجد نتائج بحث" : "لا توجد نتائج"}
                 message={search.trim()
                     ? `لم يتم العثور على عقود تطابق "${search}"`
                     : `لا توجد عقود تطابق الفلاتر المحددة`
                 }
                 actionLabel={search.trim() ? "مسح البحث" : "مسح الفلاتر"}
                 onAction={() => {
                     setSearch('');
                     setFilter('all');
                 }}
             />
         ) : (
             // حالة: عرض البيانات
             filteredList.map((item) => (
                 <ContractFinancialCard
                    key={item.contract.رقم_العقد}
                    contract={item.contract}
                    tenant={item.tenant}
                    property={item.property}
                    installments={item.installments}
                    isAdmin={isAdmin}
                    userId={userId}
                    userRole={userRole}
                    showDynamicColumns={showDynamicColumns}
                    dynamicFields={dynamicFields}
                    onPay={handlePay}
                    onSelectInstallment={setSelectedInstallment}
                    onFullPayment={handleFullPayment}
                    onPartialPayment={handlePartialPayment}
                    onReversePayment={handleReversePayment}
                    onOpenMessageModal={(context) => {
                      setMessageContext(context);
                      setMessageModalOpen(true);
                    }}
                    openPanel={openPanel}
                 />
             ))
         )}
      </div>

      {/* Payment Modal */}
      {selectedInstallment && (
        <PaymentModal
          installment={selectedInstallment}
          tenant={
            isDesktopFast
              ? desktopRows.find((r) => String(r?.contract?.رقم_العقد || r?.contract?.id || '') === String(selectedInstallment.رقم_العقد || ''))?.tenant
              : people.find((p) => p.رقم_الشخص === contracts.find((c) => c.رقم_العقد === selectedInstallment.رقم_العقد)?.رقم_المستاجر)
          }
          onClose={() => setSelectedInstallment(null)}
          onSuccess={() => {
            loadData();
            setSelectedInstallment(null);
          }}
          userId={userId}
          userRole={userRole}
        />
      )}

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        type={confirmDialog.type}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        cancelText={confirmDialog.cancelText}
        onConfirm={() => {
          setConfirmDialog({ ...confirmDialog, isOpen: false, action: null, reverseReason: '' });
          confirmDialog.action?.();
        }}
        onCancel={() => {
          setConfirmDialog({ ...confirmDialog, isOpen: false, action: null, reverseReason: '' });
        }}
      >
        {confirmDialog.showReasonField && (
          <div className="space-y-2">
            <label className="block text-sm font-bold text-slate-800 dark:text-slate-200">
              سبب عكس السداد (إلزامي)
            </label>
            <textarea
              value={confirmDialog.reverseReason}
              onChange={(e) => setConfirmDialog({ ...confirmDialog, reverseReason: e.target.value })}
              placeholder="أدخل السبب: خطأ في الدفع، دفعة مكررة، الخ..."
              className="w-full h-24 p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400">
              ملاحظة: لن يكتمل عكس السداد بدون كتابة السبب.
            </p>
          </div>
        )}
      </ConfirmDialog>

      {/* Message Composer Modal */}
      {messageModalOpen && messageContext && (
        <AppModal
          open
          title="كاتب الرسائل"
          onClose={() => {
            setMessageModalOpen(false);
            setMessageContext(null);
          }}
          size="2xl"
        >
              <div className="mb-4">
                <MergeVariablesCatalog title="متغيرات الدمج (العقد / العقار / المستأجر / الكمبيالة)" maxHeightClassName="max-h-48" />
              </div>

              <MessageComposer
                category={messageContext.category}
                tenantName={messageContext.tenant.الاسم}
                tenantPhones={[messageContext.tenant.رقم_الهاتف, messageContext.tenant.رقم_هاتف_اضافي].filter(Boolean)}
                propertyCode={messageContext.property?.الكود_الداخلي}
                amount={messageContext.installment.القيمة}
                dueDate={messageContext.installment.تاريخ_استحقاق}
                daysLate={Math.max(
                  0,
                  Math.ceil(
                    (new Date().getTime() -
                      new Date(messageContext.installment.تاريخ_استحقاق).getTime()) /
                      (1000 * 60 * 60 * 24)
                  )
                )}
                contractNumber={messageContext.contract.رقم_العقد}
                remainingAmount={
                  messageContext.installment.القيمة_المتبقية ||
                  messageContext.installment.القيمة
                }
                overdueInstallmentsCount={messageContext.overdueInstallmentsCount}
                overdueAmountTotal={messageContext.overdueAmountTotal}
                overdueInstallmentsDetails={messageContext.overdueInstallmentsDetails}
                onClose={() => {
                  setMessageModalOpen(false);
                  setMessageContext(null);
                }}
                onSent={(message) => {
                  // يمكن إضافة تسجيل أو إرسال فعلي هنا
                  console.warn('Message sent:', message);
                }}
              />
        </AppModal>
      )}
      </div>
    </DataGuard>
  );
};