import React, { useEffect, useMemo, useState } from 'react';
import { User } from 'lucide-react';
import { AlertModalShell } from '@/components/alerts/AlertModalShell';
import type { tbl_Alerts, العقود_tbl } from '@/types';
import type { PersonProfilePayload } from '@/services/alerts/alertActionTypes';
import { DbService } from '@/services/mockDb';

export interface PersonProfileModalProps {
  open: boolean;
  onClose: () => void;
  alert: tbl_Alerts;
  payload?: PersonProfilePayload;
  onOpenPerson: (personId: string) => void;
  /** فتح وجهة التنبيه الكاملة (من GenericAlertPanel / executeAction) */
  onNavigateFull?: () => void;
}

export const PersonProfileModal: React.FC<PersonProfileModalProps> = ({
  open,
  onClose,
  alert,
  payload,
  onOpenPerson,
  onNavigateFull,
}) => {
  const [decision, setDecision] = useState<'pending' | 'accepted' | 'rejected'>('pending');

  useEffect(() => {
    if (open) setDecision('pending');
  }, [open, payload?.personId, payload?.openAction]);

  const pid = String(payload?.personId || alert.مرجع_المعرف || '').trim();
  const canOpenLegacy =
    !payload && alert.مرجع_الجدول === 'الأشخاص_tbl' && pid && pid !== 'batch';

  const contract = useMemo(() => {
    const cid = payload?.contractId?.trim();
    if (!cid) return null;
    const list = (DbService.getContracts?.() || []) as العقود_tbl[];
    return list.find((c) => String(c?.رقم_العقد) === cid) ?? null;
  }, [payload?.contractId]);

  if (payload?.openAction === 'view') {
    return null;
  }

  const isDecision = payload?.openAction === 'decision';

  return (
    <AlertModalShell
      open={open}
      onClose={onClose}
      icon={<User size={22} />}
      title={isDecision ? 'قرار بخصوص الملف' : 'ملف الشخص'}
      subtitle={
        isDecision
          ? `المعرّف: ${pid} — قرار داخلي دون الانتقال إلى لوحة الشخص.`
          : canOpenLegacy
            ? `المعرّف: ${pid}`
            : 'تنبيه غير مرتبط بشخص مفرد.'
      }
      sourcesBar={
        <span className="inline-flex rounded-full bg-purple-100 px-2.5 py-0.5 text-[10px] font-black text-purple-800 dark:bg-purple-900/40 dark:text-purple-200">
          Person
        </span>
      }
      sectionContext={
        <div className="space-y-4">
          {payload?.contractId && contract ? (
            <dl className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50/80 dark:bg-slate-800/50 p-3 text-xs font-bold text-slate-700 dark:text-slate-200">
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">العقد</dt>
                <dd dir="ltr">{contract.رقم_العقد}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">العقار</dt>
                <dd dir="ltr">{contract.رقم_العقار}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">نهاية العقد</dt>
                <dd dir="ltr">{contract.تاريخ_النهاية}</dd>
              </div>
            </dl>
          ) : null}
          <p className="text-sm font-bold text-slate-600 dark:text-slate-300 leading-relaxed">{alert.الوصف}</p>
          {isDecision && decision !== 'pending' ? (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-xs font-black text-emerald-900 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-100">
              {decision === 'accepted' ? 'تم تسجيل القبول محلياً لهذا التنبيه.' : 'تم تسجيل الرفض محلياً لهذا التنبيه.'}
            </p>
          ) : null}
        </div>
      }
      footerButtons={
        <>
          {isDecision && decision === 'pending' ? (
            <>
              <button
                type="button"
                onClick={() => setDecision('accepted')}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white shadow-md hover:bg-emerald-700"
              >
                قبول
              </button>
              <button
                type="button"
                onClick={() => setDecision('rejected')}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-black text-white shadow-md hover:bg-rose-700"
              >
                رفض
              </button>
            </>
          ) : null}
          {!isDecision && canOpenLegacy ? (
            <button
              type="button"
              onClick={() => {
                onOpenPerson(pid);
                onClose();
              }}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 text-xs font-black text-white shadow-md hover:bg-purple-700"
            >
              <User size={16} /> فتح الملف
            </button>
          ) : null}
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
