import React, { useMemo } from 'react';
import { Shield } from 'lucide-react';
import { AlertModalShell } from '@/components/alerts/AlertModalShell';
import type { tbl_Alerts, العقارات_tbl } from '@/types';
import type { InsurancePayload } from '@/services/alerts/alertActionTypes';
import { DbService } from '@/services/mockDb';

export interface InsuranceModalProps {
  open: boolean;
  onClose: () => void;
  alert: tbl_Alerts;
  payload?: InsurancePayload;
  /** بدون حمولة: فتح عقد من مرجع التنبيه؛ مع حمولة: يُفضّل تمرير فتح العقار من الأب */
  onOpenContract?: () => void;
}

export const InsuranceModal: React.FC<InsuranceModalProps> = ({
  open,
  onClose,
  alert,
  payload,
  onOpenContract,
}) => {
  const legacyContractId =
    alert.مرجع_الجدول === 'العقود_tbl' && alert.مرجع_المعرف && alert.مرجع_المعرف !== 'batch'
      ? String(alert.مرجع_المعرف)
      : '';

  const property = useMemo(() => {
    const pid = payload?.propertyId?.trim();
    if (!pid) return null;
    const list = (DbService.getProperties?.() || []) as العقارات_tbl[];
    return list.find((p) => String(p?.رقم_العقار) === pid) ?? null;
  }, [payload?.propertyId]);

  const handleOpenTarget = () => {
    if (!onOpenContract) return;
    onOpenContract();
    onClose();
  };

  return (
    <AlertModalShell
      open={open}
      onClose={onClose}
      icon={<Shield size={22} />}
      title="التأمين والعقد"
      subtitle="بيانات العقار من قاعدة البيانات مع الحقول الممرّرة من التنبيه."
      sourcesBar={
        <span className="inline-flex rounded-full bg-cyan-100 px-2.5 py-0.5 text-[10px] font-black text-cyan-900 dark:bg-cyan-900/40 dark:text-cyan-100">
          Insurance
        </span>
      }
      sectionContext={
        <div className="space-y-4">
          {payload ? (
            <dl className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50/80 dark:bg-slate-800/50 p-3 text-xs font-bold text-slate-700 dark:text-slate-200">
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">العقار (معرّف)</dt>
                <dd dir="ltr">{payload.propertyId}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">انتهاء الوثيقة / المرجع</dt>
                <dd dir="ltr">{payload.expiryDate}</dd>
              </div>
              {payload.currentPolicyRef ? (
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">مرجع البوليصة</dt>
                  <dd dir="ltr">{payload.currentPolicyRef}</dd>
                </div>
              ) : null}
              {payload.currentProvider ? (
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">المزوّد</dt>
                  <dd dir="ltr">{payload.currentProvider}</dd>
                </div>
              ) : null}
            </dl>
          ) : null}
          {property ? (
            <dl className="grid grid-cols-1 gap-2 rounded-xl border border-cyan-100 dark:border-cyan-900/40 bg-cyan-50/50 dark:bg-cyan-950/20 p-3 text-xs font-bold text-slate-700 dark:text-slate-200">
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">الكود الداخلي</dt>
                <dd dir="ltr">{property.الكود_الداخلي}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">العنوان</dt>
                <dd className="text-end">{property.العنوان}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">الحالة</dt>
                <dd>{String(property.حالة_العقار)}</dd>
              </div>
            </dl>
          ) : payload ? (
            <p className="text-xs font-bold text-amber-700 dark:text-amber-300">
              لم يُعثر على سجل للعقار في قاعدة البيانات لهذا المعرّف.
            </p>
          ) : null}
          <p className="text-sm font-bold text-slate-600 dark:text-slate-300 leading-relaxed">{alert.الوصف}</p>
        </div>
      }
      footerButtons={
        <>
          {onOpenContract && (payload || legacyContractId) ? (
            <button
              type="button"
              onClick={handleOpenTarget}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-xs font-black text-white shadow-md hover:bg-cyan-700"
            >
              <Shield size={16} /> {payload ? 'فتح العقار' : 'فتح العقد'}
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
