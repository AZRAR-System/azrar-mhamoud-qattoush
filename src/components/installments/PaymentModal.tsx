import { useEffect, useState } from 'react';
import { Calendar, MessageSquare } from 'lucide-react';
import { DbService } from '@/services/mockDb';
import type { RoleType, الأشخاص_tbl, الكمبيالات_tbl } from '@/types';
import { useToast } from '@/context/ToastContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { AppModal } from '@/components/ui/AppModal';
import { MoneyInput } from '@/components/ui/MoneyInput';
import { DynamicFieldsSection } from '@/components/dynamic/DynamicFieldsSection';
import { formatNumber } from '@/utils/format';
import { isRecord } from '@/components/installments/installmentsUtils';
import { notifyInstallmentsDataChanged } from '@/utils/installmentsRefresh';

export interface PaymentModalProps {
  installment: الكمبيالات_tbl;
  tenant: الأشخاص_tbl | undefined;
  onClose: () => void;
  onSuccess: () => void;
  onMessageClick?: () => void;
  userId: string;
  userRole: string;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  installment,
  tenant,
  onClose,
  onSuccess,
  onMessageClick,
  userId,
  userRole,
}) => {
  const [paidAmount, setPaidAmount] = useState<number | ''>('');
  const [notes, setNotes] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  type InstallmentWithDynamicFields = الكمبيالات_tbl & { حقول_ديناميكية?: unknown };
  const initialDyn = (installment as InstallmentWithDynamicFields).حقول_ديناميكية;
  const [dynamicValues, setDynamicValues] = useState<Record<string, unknown>>(
    isRecord(initialDyn) ? initialDyn : {}
  );
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
        const resDyn = DbService.updateInstallmentDynamicFields(
          installment.رقم_الكمبيالة,
          dynamicValues
        );
        if (!resDyn.success) {
          toast.error(resDyn.message || 'فشل حفظ الحقول الإضافية');
          return;
        }
      }
    } catch {
      // ignore - keep payment flow
    }

    // Mark as paid (fully or partial) - pass userId and role
    const resPay = DbService.markInstallmentPaid(
      installment.رقم_الكمبيالة,
      userId,
      userRole as RoleType,
      {
        paidAmount: paidAmountNumber,
        paymentDate: paymentDate,
        notes: notes || 'تم تسجيل السداد',
        isPartial: isPartial,
      }
    );

    if (!resPay.success) {
      toast.error(resPay.message || 'فشل تسجيل السداد');
      return;
    }

    // Show notifications
    if (isPartial) {
      toast.warning(
        `دفعة جزئية: ${formatNumber(paidAmountNumber)} د.أ - الباقي: ${formatNumber(remainingAfterPayment)} د.أ`
      );
    } else {
      toast.success(`تم سداد الدفعة كاملة بنجاح للمستأجر: ${tenant?.الاسم || 'مستأجر'}`);
    }

    // Add note to activity
    if (notes) {
      toast.info(`ملاحظة: ${notes}`);
    }

    notifyInstallmentsDataChanged();
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
            <MoneyInput
              dir="ltr"
              className="flex-1"
              min={0}
              value={typeof paidAmount === 'number' ? paidAmount : undefined}
              onValueChange={(v) => setPaidAmount(v === undefined ? '' : Math.max(0, v))}
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
          <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
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

        <DynamicFieldsSection
          formId="installments"
          values={dynamicValues}
          onChange={setDynamicValues}
        />

        {/* Action Buttons */}
        <div className="flex gap-2 pt-4">
          <Button variant="ghost" className="flex-1" onClick={onClose}>
            إلغاء
          </Button>
          {onMessageClick && (
            <Button
              variant="outline"
              className="flex-1 gap-2 text-indigo-600 border-indigo-200 hover:bg-indigo-50"
              onClick={onMessageClick}
            >
              <MessageSquare size={16} />
              إرسال تنبيه
            </Button>
          )}
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
