import React, { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, MessageCircle, CalendarClock } from 'lucide-react';
import { AlertModalShell } from '@/components/alerts/AlertModalShell';
import type { tbl_Alerts, الكمبيالات_tbl } from '@/types';
import type { RenewContractPayload } from '@/services/alerts/alertActionTypes';
import { DbService } from '@/services/mockDb';
import { getInstallmentPaidAndRemaining } from '@/services/db/installments';
import type { ExpiryKind } from '@/services/alerts/renewExpiryWhatsAppSend';
import { sendRenewExpiryWhatsApp } from '@/services/alerts/renewExpiryWhatsAppSend';
import { buildSettingsMessageTemplatesHref } from '@/services/messageTemplateSourceGroups';

export interface RenewContractModalProps {
  open: boolean;
  onClose: () => void;
  alert: tbl_Alerts;
  payload?: RenewContractPayload;
  /** عند الفتح من Inbox دون حمولة — يُدار من الأب */
  expiryKind?: ExpiryKind;
  onExpiryKindChange?: (v: ExpiryKind) => void;
  onSendTenant?: () => void;
  onSendOwner?: () => void;
}

const isExpiryKind = (v: string): v is ExpiryKind =>
  v === 'pre_notice' || v === 'approved' || v === 'rejected' || v === 'auto';

export const RenewContractModal: React.FC<RenewContractModalProps> = ({
  open,
  onClose,
  alert,
  payload,
  expiryKind: expiryKindProp,
  onExpiryKindChange,
  onSendTenant,
  onSendOwner,
}) => {
  const [innerKind, setInnerKind] = useState<ExpiryKind>('pre_notice');
  const kind = expiryKindProp ?? innerKind;

  useEffect(() => {
    if (!open) return;
    if (expiryKindProp === undefined) setInnerKind('pre_notice');
  }, [open, payload?.contractId, expiryKindProp]);

  const setKind = (v: ExpiryKind) => {
    if (onExpiryKindChange) onExpiryKindChange(v);
    else setInnerKind(v);
  };

  const contractInstallments = useMemo(() => {
    const cid = payload?.contractId;
    if (!cid) return [] as الكمبيالات_tbl[];
    return (DbService.getInstallments?.() || [])
      .filter((i: الكمبيالات_tbl) => String(i.رقم_العقد) === cid)
      .slice()
      .sort((a, b) => String(a.تاريخ_استحقاق || '').localeCompare(String(b.تاريخ_استحقاق || '')));
  }, [payload?.contractId]);

  const handleTenant = () => {
    if (onSendTenant) {
      onSendTenant();
      return;
    }
    if (payload) {
      void sendRenewExpiryWhatsApp({
        alert,
        contractId: payload.contractId,
        target: 'tenant',
        expiryKind: kind,
      });
    }
  };

  const handleOwner = () => {
    if (onSendOwner) {
      onSendOwner();
      return;
    }
    if (payload) {
      void sendRenewExpiryWhatsApp({
        alert,
        contractId: payload.contractId,
        target: 'owner',
        expiryKind: kind,
      });
    }
  };

  return (
    <AlertModalShell
      open={open}
      onClose={onClose}
      icon={<CalendarClock size={22} />}
      title="رسائل انتهاء وتجديد العقد"
      subtitle="قوالب ثابتة للمستأجر والمالك — يُفضّل مراجعة النص قبل الإرسال."
      sourcesBar={
        <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-black text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
          Expiry / Renew
        </span>
      }
      sectionContext={
        <div className="space-y-4">
          <Link
            to={buildSettingsMessageTemplatesHref({
              sourceGroup: 'renewal',
              templateId: 'wa_renewal_offer',
            })}
            onClick={onClose}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50/80 px-3 py-2.5 text-xs font-black text-indigo-800 transition-colors hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200 dark:hover:bg-indigo-900/50"
          >
            <ExternalLink size={14} />
            تعديل قوالب التجديد وواتساب التنبيهات
          </Link>
          {payload ? (
            <>
              <dl className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50/80 dark:bg-slate-800/50 p-3 text-xs font-bold text-slate-700 dark:text-slate-200">
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">العقد</dt>
                  <dd dir="ltr">{payload.contractId}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">العقار</dt>
                  <dd dir="ltr">{payload.propertyId}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">المستأجر</dt>
                  <dd dir="ltr">{payload.personId}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">البدل الحالي (دورة)</dt>
                  <dd>{payload.currentRent.toLocaleString()} د.أ</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">انتهاء العقد</dt>
                  <dd dir="ltr">{payload.expiryDate}</dd>
                </div>
              </dl>
              {contractInstallments.length > 0 ? (
                <div>
                  <div className="text-xs font-black text-slate-500 mb-2">تقدّم الأقساط الحالية</div>
                  <div className="max-h-44 space-y-2 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-600 p-2">
                    {contractInstallments.map((inst) => {
                      const { paid, remaining } = getInstallmentPaidAndRemaining(inst);
                      const total = Math.max(0, inst.القيمة);
                      const pct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
                      return (
                        <div key={inst.رقم_الكمبيالة} className="flex items-center gap-2 text-[11px] font-bold">
                          <span className="w-24 shrink-0 text-slate-500 truncate" title={inst.تاريخ_استحقاق}>
                            {inst.تاريخ_استحقاق}
                          </span>
                          <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                            <div
                              className="h-full rounded-full bg-emerald-500 transition-[width]"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="w-20 shrink-0 text-end tabular-nums text-slate-600 dark:text-slate-300">
                            {paid.toLocaleString()}/{total.toLocaleString()}
                            {remaining > 0 ? (
                              <span className="text-rose-600 dark:text-rose-400"> ({remaining})</span>
                            ) : null}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </>
          ) : null}
          <p className="text-sm font-bold text-slate-600 dark:text-slate-300 leading-relaxed">{alert.الوصف}</p>
        </div>
      }
      sectionInput={
        <div className="space-y-2">
          <label className="text-xs font-black text-slate-500">نوع الرسالة</label>
          <select
            className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-bold outline-none"
            value={kind}
            onChange={(e) => {
              const v = e.target.value;
              if (isExpiryKind(v)) setKind(v);
            }}
          >
            <option value="pre_notice">إخطار مبدئي قبل نهاية العقد</option>
            <option value="approved">الموافقة على التجديد</option>
            <option value="rejected">عدم التجديد</option>
            <option value="auto">التجديد التلقائي</option>
          </select>
        </div>
      }
      footerNote="زر «التفاصيل الكاملة» من لوحة التفاصيل يفتح منزلق العقد دون مغادرة مركز التنبيهات."
      footerButtons={
        <>
          <button
            type="button"
            onClick={handleTenant}
            className="inline-flex flex-1 min-w-[120px] items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white shadow-md hover:bg-emerald-700"
          >
            <MessageCircle size={16} /> للمستأجر
          </button>
          <button
            type="button"
            onClick={handleOwner}
            className="inline-flex flex-1 min-w-[120px] items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-xs font-black text-white shadow-md hover:bg-teal-700"
          >
            <MessageCircle size={16} /> للمالك
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
};
