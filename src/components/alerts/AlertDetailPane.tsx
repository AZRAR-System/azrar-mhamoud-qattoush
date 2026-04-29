import React from 'react';
import {
  MessageCircle,
  FileText,
  StickyNote,
  Send,
  PenTool,
  Layers,
  CheckCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { executeAction, resolveSecondaryActions } from '@/services/alerts/alertActionPolicy';
import {
  buildAssignTechnicianPayloadFromAlert,
  buildInsurancePayloadFromAlert,
  buildPersonProfilePayloadFromAlert,
  buildReceiptPayloadFromAlert,
  buildRenewContractPayloadFromAlert,
  buildWhatsAppPayloadFromAlert,
} from '@/services/alerts/alertActionPayloadBuild';
import { useSmartModal } from '@/context/ModalContext';
import type { useAlerts } from '@/hooks/useAlerts';
import type { tbl_Alerts, AlertDetail } from '@/types';
import { InstallmentAlertBlock } from '@/components/alerts/InstallmentAlertBlock';

export type AlertDetailPaneProps = {
  page: ReturnType<typeof useAlerts>;
};

const categoryAccent = (alert: tbl_Alerts) => {
  if (alert.category === 'Financial') return 'bg-rose-500 dark:bg-rose-400';
  if (alert.category === 'DataQuality') return 'bg-indigo-500 dark:bg-indigo-400';
  if (alert.category === 'Risk') return 'bg-amber-500 dark:bg-amber-400';
  if (alert.category === 'Expiry') return 'bg-sky-500 dark:bg-sky-400';
  return 'bg-slate-400 dark:bg-slate-500';
};

const categoryBadge = (alert: tbl_Alerts) => {
  if (alert.category === 'Financial')
    return 'border-rose-200/80 bg-rose-50/90 text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-200';
  if (alert.category === 'DataQuality')
    return 'border-indigo-200/80 bg-indigo-50/90 text-indigo-800 dark:border-indigo-900/50 dark:bg-indigo-950/40 dark:text-indigo-200';
  if (alert.category === 'Risk')
    return 'border-amber-200/80 bg-amber-50/90 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/35 dark:text-amber-100';
  if (alert.category === 'Expiry')
    return 'border-sky-200/80 bg-sky-50/90 text-sky-900 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-100';
  return 'border-slate-200/80 bg-slate-100/90 text-slate-700 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-200';
};

const getMissingFieldLabel = (field: string) => {
  if (field === 'رقم_اشتراك_الكهرباء') return 'رقم اشتراك الكهرباء';
  if (field === 'رقم_اشتراك_المياه') return 'رقم اشتراك المياه';
  return field;
};

export const AlertDetailPane: React.FC<AlertDetailPaneProps> = ({ page }) => {
  const { openPanel, openModal } = useSmartModal();
  const {
    selectedAlert,
    setSelectedAlert,
    noteText,
    setNoteText,
    expiryKind,
    setExpiryKind,
    handleDismiss,
    handleNavigate,
    sendWhatsApp,
    sendFixedExpiryWhatsApp,
    openLegalNotice,
    saveNote,
    isExpiryKind,
    setLayerModal,
  } = page;

  const secondary = selectedAlert ? resolveSecondaryActions(selectedAlert) : [];

  if (!selectedAlert) {
    return (
      <div className="app-card flex min-h-[420px] flex-col items-center justify-center p-12 text-center ring-1 ring-slate-900/[0.04] dark:ring-white/[0.06]">
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800/80 text-slate-400 dark:text-slate-500">
          <Layers size={28} strokeWidth={1.5} />
        </div>
        <p className="text-base font-bold text-slate-800 dark:text-slate-100 tracking-tight">اختر تنبيهاً من القائمة</p>
        <p className="mt-2 max-w-md text-sm font-medium text-slate-500 dark:text-slate-400 leading-relaxed">
          اعرض التفاصيل والإجراءات بعد اختيار عنصر من عمود القائمة. يمكنك تحديد عدة تنبيهات لتنفيذ إجراء
          جماعي من الشريط السفلي.
        </p>
      </div>
    );
  }

  const a = selectedAlert;

  return (
    <div className="app-card overflow-hidden flex flex-col max-h-[calc(100vh-280px)] ring-1 ring-slate-900/[0.04] dark:ring-white/[0.06] shadow-md hover:shadow-md dark:hover:shadow-md transition-shadow">
      <div className="shrink-0 border-b border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-950/80 px-5 py-5">
        <div className="flex gap-4">
          <div
            className={`w-1 shrink-0 self-stretch min-h-[4.5rem] rounded-full ${categoryAccent(a)}`}
            aria-hidden
          />
          <div className="flex min-w-0 flex-1 flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 gap-y-1.5">
                {a.category ? (
                  <span
                    className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${categoryBadge(a)}`}
                  >
                    {a.category}
                  </span>
                ) : null}
                {a.count && a.count > 1 ? (
                  <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    مجمّع
                  </span>
                ) : null}
              </div>
              <h2 className="mt-2 text-base font-bold text-slate-900 dark:text-slate-50 leading-snug tracking-tight">
                {a.نوع_التنبيه}
              </h2>
              <p className="mt-1 text-xs font-medium tabular-nums text-slate-500 dark:text-slate-400">
                {new Date(a.تاريخ_الانشاء).toLocaleString('ar-JO')}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => setSelectedAlert(null)}
              className="shrink-0 font-semibold text-slate-600 dark:text-slate-300"
            >
              إغلاق
            </Button>
          </div>
        </div>

        {secondary.length > 0 ? (
          <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 dark:border-slate-800/80 pt-4">
            <span className="w-full text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              اختصارات
            </span>
            {secondary.map((act) => (
              <button
                key={act.id}
                type="button"
                className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200/90 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:bg-slate-800"
                onClick={() => {
                  if (act.type === 'navigate') {
                    handleNavigate(a);
                    return;
                  }
                  if (act.layer === 'whatsapp') {
                    const data = buildWhatsAppPayloadFromAlert(a);
                    if (data) {
                      executeAction(act, { variant: 'whatsapp', alert: a, data }, openPanel, openModal);
                      return;
                    }
                    setLayerModal('whatsapp');
                    return;
                  }
                  if (act.layer === 'renew_contract') {
                    const data = buildRenewContractPayloadFromAlert(a);
                    if (data) {
                      executeAction(act, { variant: 'renew_contract', alert: a, data }, openPanel, openModal);
                      return;
                    }
                    setLayerModal('renew_contract');
                    return;
                  }
                  if (act.layer === 'person_profile') {
                    const data = buildPersonProfilePayloadFromAlert(a);
                    if (data) {
                      executeAction(act, { variant: 'person_profile', alert: a, data }, openPanel, openModal);
                      return;
                    }
                    setLayerModal('person_profile');
                    return;
                  }
                  if (act.layer === 'insurance') {
                    const data = buildInsurancePayloadFromAlert(a);
                    if (data) {
                      executeAction(act, { variant: 'insurance', alert: a, data }, openPanel, openModal);
                      return;
                    }
                    setLayerModal('insurance');
                    return;
                  }
                  if (act.layer === 'assign_technician') {
                    const data = buildAssignTechnicianPayloadFromAlert(a);
                    if (data) {
                      executeAction(act, { variant: 'assign_technician', alert: a, data }, openPanel, openModal);
                      return;
                    }
                    setLayerModal('assign_technician');
                    return;
                  }
                  if (act.layer === 'receipt') {
                    const data = buildReceiptPayloadFromAlert(a);
                    if (data) {
                      executeAction(act, { variant: 'receipt', alert: a, data }, openPanel, openModal);
                      return;
                    }
                    setLayerModal('receipt');
                    return;
                  }
                  setLayerModal(act.layer);
                }}
              >
                {act.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/40 dark:bg-slate-950/30 p-6 space-y-8 scroll-pb-6">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
            الوصف
          </p>
          <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed font-medium">{a.الوصف}</p>
        </div>

        <InstallmentAlertBlock alert={a} />

        {a.category === 'Expiry' && a.مرجع_الجدول === 'العقود_tbl' && a.مرجع_المعرف !== 'batch' && (
          <div className="rounded-xl border border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
            <div className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-3">
              رسائل انتهاء/تجديد العقد (سريعة)
            </div>
            <div className="grid grid-cols-1 gap-3">
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-500 whitespace-nowrap">نوع الرسالة</label>
                <select
                  className="flex-1 text-sm border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 rounded px-3 py-2 outline-none font-bold"
                  value={expiryKind}
                  onChange={(e) => {
                    const nextKind = e.target.value;
                    if (isExpiryKind(nextKind)) setExpiryKind(nextKind);
                  }}
                >
                  <option value="pre_notice">إخطار مبدئي قبل نهاية العقد</option>
                  <option value="approved">الموافقة على التجديد</option>
                  <option value="rejected">عدم التجديد</option>
                  <option value="auto">التجديد التلقائي</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => sendFixedExpiryWhatsApp('tenant')}
                  className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-xl font-bold transition text-sm"
                >
                  <MessageCircle size={18} /> للمستأجر
                </button>
                <button
                  type="button"
                  onClick={() => sendFixedExpiryWhatsApp('owner')}
                  className="flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white py-2.5 rounded-xl font-bold transition text-sm"
                >
                  <MessageCircle size={18} /> للمالك
                </button>
              </div>
            </div>
          </div>
        )}

        {a.details && a.details.length > 0 && (
          <div className="rounded-xl border border-slate-200/80 dark:border-slate-700/80 overflow-hidden bg-white dark:bg-slate-900 shadow-sm ring-1 ring-slate-900/[0.03] dark:ring-white/[0.04]">
            <div className="bg-slate-50/90 dark:bg-slate-800/80 px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-300 border-b border-slate-200/70 dark:border-slate-700 flex items-center gap-2">
              <Layers size={15} className="text-slate-400 dark:text-slate-500 shrink-0" strokeWidth={2} />
              <span>
                بنود التفاصيل <span className="tabular-nums text-slate-500">({a.details.length})</span>
              </span>
            </div>

            {a.category === 'DataQuality' ? (
              <div className="divide-y divide-gray-100 dark:divide-slate-800">
                {a.مرجع_الجدول === 'العقارات_tbl' && (
                  <div className="p-4 bg-indigo-50/40 dark:bg-indigo-900/10 border-b border-gray-100 dark:border-slate-800">
                    <div className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">
                      إرسال إخطار نقص بيانات العقارات
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                      يتم الإرسال للمالك/المالكين حسب كل عقار باستخدام قالب ثابت.
                    </div>
                    <button
                      type="button"
                      onClick={() => sendWhatsApp()}
                      className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-xl font-bold transition"
                    >
                      <MessageCircle size={18} /> إرسال واتساب للمالكين
                    </button>
                  </div>
                )}

                {a.details.map((d: AlertDetail) => {
                  const missingFields = Array.isArray(d?.missingFields)
                    ? d.missingFields.map((x) => String(x ?? '').trim()).filter(Boolean)
                    : [];
                  const missingText = missingFields.length
                    ? missingFields.map(getMissingFieldLabel).join('، ')
                    : '—';
                  return (
                    <div key={d.id} className="p-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-bold text-slate-700 dark:text-white">{d.name}</span>
                        <span className="text-xs bg-red-100 dark:bg-red-900/30 text-red-600 px-2 py-0.5 rounded">
                          نقص بيانات
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        الحقول الناقصة:{' '}
                        <span className="font-bold text-slate-600 dark:text-slate-200">{missingText}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <table className="w-full text-right text-sm">
                <thead className="bg-slate-50/80 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 text-[11px] uppercase tracking-wide">
                  <tr>
                    {a.category === 'Financial' && (
                      <th className="p-3.5 text-right font-semibold">التاريخ</th>
                    )}
                    <th className="p-3.5 text-right font-semibold">
                      {a.category === 'Risk' ? 'الاسم' : 'القيمة'}
                    </th>
                    <th className="p-3.5 text-right font-semibold">ملاحظات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-sm">
                  {a.details.map((d) => (
                    <tr
                      key={d.id}
                      className="bg-white dark:bg-slate-900/50 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {a.category === 'Financial' && (
                        <td className="p-3.5 font-medium text-rose-600 dark:text-rose-400 tabular-nums">
                          {d.date}
                        </td>
                      )}
                      <td className="p-3.5 font-semibold text-slate-800 dark:text-slate-100">
                        {a.category === 'Risk' ? d.name : `${d.amount?.toLocaleString()} د.أ`}
                      </td>
                      <td className="p-3.5 text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                        {d.note || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        <div className="rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-900/60 p-5 shadow-sm ring-1 ring-slate-900/[0.03] dark:ring-white/[0.04]">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-4">
            إجراءات رئيسية
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={sendWhatsApp}
              className="flex items-center justify-center gap-2 min-h-[2.75rem] rounded-lg bg-emerald-600 px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
            >
              <MessageCircle size={18} className="shrink-0 opacity-95" strokeWidth={2} />
              إرسال واتساب
            </button>

            <button
              type="button"
              onClick={() => handleNavigate(a)}
              className="flex items-center justify-center gap-2 min-h-[2.75rem] rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
            >
              <FileText size={18} className="shrink-0 text-slate-500 dark:text-slate-400" strokeWidth={2} />
              التفاصيل الكاملة
            </button>

            {a.category !== 'DataQuality' && a.مرجع_المعرف !== 'batch' && (
              <button
                type="button"
                onClick={openLegalNotice}
                className="col-span-2 flex items-center justify-center gap-2 min-h-[2.75rem] rounded-lg border border-red-200 bg-red-600 px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-500 dark:border-red-900/40 dark:bg-red-700 dark:hover:bg-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
              >
                <PenTool size={18} className="shrink-0 opacity-95" strokeWidth={2} />
                إرسال إخطار قانوني
              </button>
            )}
          </div>
        </div>

        {a.مرجع_المعرف !== 'batch' && (
          <div className="rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-900/60 p-4 shadow-sm ring-1 ring-slate-900/[0.03] dark:ring-white/[0.04]">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3 flex items-center gap-2">
              <StickyNote size={14} className="text-slate-400 shrink-0" strokeWidth={2} />
              ملاحظة سريعة
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                className="flex-1 rounded-lg border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-medium text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-indigo-500 dark:focus:bg-slate-900"
                placeholder="اكتب ملاحظة للمتابعة…"
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
              />
              <button
                type="button"
                onClick={saveNote}
                className="flex shrink-0 items-center justify-center rounded-lg bg-slate-800 px-3.5 text-white transition hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600"
                aria-label="حفظ الملاحظة"
              >
                <Send size={18} strokeWidth={2} />
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/80 dark:border-slate-800 pt-6">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleDismiss(a)}
            className="font-semibold text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/80"
            rightIcon={<CheckCircle size={16} strokeWidth={2} />}
          >
            تعليم كمقروء
          </Button>
        </div>
      </div>

    </div>
  );
};
