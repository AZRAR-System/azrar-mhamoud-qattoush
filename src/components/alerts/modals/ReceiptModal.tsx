import React from 'react';
import { Receipt } from 'lucide-react';
import { AlertModalShell } from '@/components/alerts/AlertModalShell';
import type { tbl_Alerts, AlertDetail } from '@/types';
import type { ReceiptPayload } from '@/services/alerts/alertActionTypes';

export interface ReceiptModalProps {
  open: boolean;
  onClose: () => void;
  alert: tbl_Alerts;
  payload?: ReceiptPayload;
  onNavigateFull?: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  open,
  onClose,
  alert,
  payload,
  onNavigateFull,
}) => {
  const rows = (alert.details || []) as AlertDetail[];

  return (
    <AlertModalShell
      open={open}
      onClose={onClose}
      icon={<Receipt size={22} />}
      title="ملخص مالي / إيصال"
      subtitle={
        payload
          ? 'تاريخ الدفع من سجل الدفعات الفعلي (أو تاريخ_الدفع عند غياب السجل) — وليس من تاريخ إنشاء التنبيه.'
          : 'عرض مختصر لبنود التنبيه — الطباعة من التقارير المالية عند الحاجة.'
      }
      sourcesBar={
        <span className="inline-flex rounded-full bg-indigo-100 px-2.5 py-0.5 text-[10px] font-black text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200">
          Receipt
        </span>
      }
      sectionContext={
        payload ? (
          <dl className="mb-4 grid grid-cols-1 gap-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50/80 dark:bg-slate-800/50 p-3 text-xs font-bold text-slate-700 dark:text-slate-200">
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">الكمبيالة</dt>
              <dd dir="ltr">{payload.installmentId}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">العقد</dt>
              <dd dir="ltr">{payload.contractId}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">المستأجر</dt>
              <dd dir="ltr">{payload.personId}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">المبلغ</dt>
              <dd>{payload.amount.toLocaleString()} د.أ</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">تاريخ الدفع</dt>
              <dd dir="ltr">{payload.paidAt}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">طريقة / وصف</dt>
              <dd className="text-end">{payload.paymentMethod}</dd>
            </div>
          </dl>
        ) : null
      }
      sectionPreview={
        rows.length === 0 ? (
          <p className="text-sm font-bold text-slate-500">لا توجد بنود تفصيلية.</p>
        ) : (
          <ul className="space-y-2 text-xs font-bold text-slate-700 dark:text-slate-200">
            {rows.slice(0, 12).map((d) => (
              <li
                key={d.id}
                className="flex justify-between gap-2 rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/50 px-3 py-2"
              >
                <span className="truncate">{d.name || d.id}</span>
                <span className="shrink-0 text-rose-600 dark:text-rose-400">
                  {typeof d.amount === 'number' ? `${d.amount.toLocaleString()} د.أ` : ''}
                </span>
              </li>
            ))}
          </ul>
        )
      }
      footerButtons={
        <>
          {onNavigateFull ? (
            <button
              type="button"
              onClick={() => {
                onNavigateFull();
                onClose();
              }}
              className="rounded-xl border border-slate-200 dark:border-slate-600 px-4 py-2.5 text-xs font-black text-slate-600 dark:text-slate-300"
            >
              التفاصيل الكاملة
            </button>
          ) : null}
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
};
