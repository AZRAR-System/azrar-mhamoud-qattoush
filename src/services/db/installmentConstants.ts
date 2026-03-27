/**
 * Shared installment status literals (used by mockDb + db/installments).
 */

export const INSTALLMENT_STATUS = {
  PAID: 'مدفوع',
  PARTIAL: 'دفعة جزئية',
  UNPAID: 'غير مدفوع',
  CANCELLED: 'ملغي',
} as const;

export type InstallmentStatusType = (typeof INSTALLMENT_STATUS)[keyof typeof INSTALLMENT_STATUS];
