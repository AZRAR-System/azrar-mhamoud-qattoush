import React from 'react';
import { CreditCard, FileText } from 'lucide-react';
import { AlertModalShell } from '@/components/alerts/AlertModalShell';
import type { tbl_Alerts } from '@/types';
import type { RecordPaymentPayload } from '@/services/alerts/alertActionTypes';

export interface RecordPaymentModalProps {
  open: boolean;
  onClose: () => void;
  alert: tbl_Alerts;
  /** بيانات منظّمة من Policy عند الفتح عبر `executeAction` */
  payload?: RecordPaymentPayload;
  /** ملخص الكمبيالة من لوحة التفاصيل */
  installmentBody?: React.ReactNode;
  onOpenFullDetails: () => void;
}

export const RecordPaymentModal: React.FC<RecordPaymentModalProps> = ({
  open,
  onClose,
  alert,
  payload,
  installmentBody,
  onOpenFullDetails,
}) => (
  <AlertModalShell
    open={open}
    onClose={onClose}
    icon={<CreditCard size={22} />}
    title="السداد والكمبيالة"
    subtitle={alert.نوع_التنبيه}
    sourcesBar={
      <span className="inline-flex rounded-full bg-rose-100 px-2.5 py-0.5 text-[10px] font-black text-rose-800 dark:bg-rose-900/40 dark:text-rose-200">
        Record / Installment
      </span>
    }
    sectionContext={
      <>
        {payload ? (
          <dl className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50/80 dark:bg-slate-800/50 p-3 text-xs font-bold text-slate-700 dark:text-slate-200">
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">الكمبيالة</dt>
              <dd dir="ltr">{payload.installmentId}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">العقد</dt>
              <dd dir="ltr">{payload.contractId}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">الشخص</dt>
              <dd dir="ltr">{payload.personId}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">المبلغ</dt>
              <dd>{payload.amount.toLocaleString()} د.أ</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">غرامة التأخير</dt>
              <dd>{payload.lateFee.toLocaleString()} د.أ</dd>
            </div>
          </dl>
        ) : null}
        {installmentBody}
        {!payload && !installmentBody ? (
          <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
            لا توجد كمبيالة مباشرة مرتبطة بهذا التنبيه — استخدم التفاصيل الكاملة للانتقال إلى لوحة السداد أو العقد.
          </p>
        ) : null}
      </>
    }
    footerNote="يفتح منزلق العقد أو لوحة السداد حسب سياسة التنبيه."
    footerButtons={
      <>
        <button
          type="button"
          onClick={() => {
            onOpenFullDetails();
            onClose();
          }}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-black text-white shadow-md hover:bg-indigo-700"
        >
          <FileText size={16} /> التفاصيل الكاملة
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl border border-slate-200 dark:border-slate-600 px-4 py-2.5 text-xs font-black text-slate-600 dark:text-slate-300"
        >
          إغلاق
        </button>
      </>
    }
  />
);
