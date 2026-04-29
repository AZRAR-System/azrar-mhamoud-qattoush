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

const getAlertStyle = (alert: tbl_Alerts) => {
  if (alert.category === 'Financial')
    return 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-900/30 text-red-600 dark:text-red-400';
  if (alert.category === 'DataQuality')
    return 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-900/30 text-indigo-600 dark:text-indigo-400';
  if (alert.category === 'Risk')
    return 'bg-orange-50 dark:bg-orange-900/20 border-orange-100 dark:border-orange-900/30 text-orange-600 dark:text-orange-400';
  return 'bg-gray-50 dark:bg-slate-800 border-gray-100 dark:border-slate-700 text-slate-600 dark:text-slate-400';
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
      <div className="app-card flex min-h-[420px] flex-col items-center justify-center p-10 text-center">
        <p className="text-lg font-black text-slate-700 dark:text-slate-200">اختر تنبيهاً من القائمة</p>
        <p className="mt-2 max-w-sm text-sm font-bold text-slate-500 dark:text-slate-400">
          نمط Inbox/Triage: القائمة على اليسار، التفاصيل والإجراءات هنا. يمكنك تحديد عدة تنبيهات للإجراء
          الجماعي.
        </p>
      </div>
    );
  }

  const a = selectedAlert;

  return (
    <div
      className={`app-card overflow-hidden flex flex-col max-h-[calc(100vh-280px)] border-r-4 ${
        a.category === 'Financial'
          ? 'border-r-rose-500'
          : a.category === 'DataQuality'
            ? 'border-r-indigo-500'
            : a.category === 'Risk'
              ? 'border-r-orange-500'
              : 'border-r-slate-400'
      }`}
    >
      <div className={`shrink-0 border-b border-slate-100 dark:border-slate-800 px-5 py-4 ${getAlertStyle(a)}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white flex flex-wrap items-center gap-2">
              {a.نوع_التنبيه}
              {a.count && a.count > 1 ? (
                <span className="rounded-full bg-white/60 dark:bg-black/30 px-2 py-0.5 text-xs">مجمّع</span>
              ) : null}
            </h2>
            <p className="mt-1 text-xs font-bold text-slate-600 dark:text-slate-300">
              {new Date(a.تاريخ_الانشاء).toLocaleString('ar-JO')}
            </p>
          </div>
          <Button variant="ghost" size="sm" type="button" onClick={() => setSelectedAlert(null)}>
            إغلاق اللوحة
          </Button>
        </div>

        {secondary.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {secondary.map((act) => (
              <button
                key={act.id}
                type="button"
                className="rounded-full border border-white/40 bg-white/30 px-3 py-1 text-[10px] font-black text-slate-800 backdrop-blur hover:bg-white/50 dark:border-slate-600 dark:bg-slate-800/60 dark:text-slate-100"
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

      <div className="min-h-0 flex-1 overflow-y-auto p-5 space-y-6">
        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-bold">{a.الوصف}</p>

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
          <div className="rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-900">
            <div className="bg-gray-50 dark:bg-slate-800 p-3 text-sm font-bold text-slate-700 dark:text-slate-300 border-b border-gray-100 dark:border-slate-700 flex items-center gap-2">
              <Layers size={16} className="text-orange-500" />
              التفاصيل ({a.details.length})
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
              <table className="w-full text-right text-xs">
                <thead className="bg-gray-50 dark:bg-slate-800/50 text-gray-500">
                  <tr>
                    {a.category === 'Financial' && <th className="p-3 text-right">التاريخ</th>}
                    <th className="p-3 text-right">{a.category === 'Risk' ? 'الاسم' : 'القيمة'}</th>
                    <th className="p-3 text-right">ملاحظات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                  {a.details.map((d) => (
                    <tr key={d.id}>
                      {a.category === 'Financial' && (
                        <td className="p-3 font-medium text-red-600">{d.date}</td>
                      )}
                      <td className="p-3 font-bold">
                        {a.category === 'Risk' ? d.name : `${d.amount?.toLocaleString()} د.أ`}
                      </td>
                      <td className="p-3 text-gray-400 dark:text-slate-400">{d.note || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={sendWhatsApp}
            className="flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white py-3 rounded-xl font-bold transition shadow-lg shadow-green-500/20 text-sm"
          >
            <MessageCircle size={20} /> إرسال واتساب
          </button>

          <button
            type="button"
            onClick={() => handleNavigate(a)}
            className="flex items-center justify-center gap-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 py-3 rounded-xl font-bold transition text-sm"
          >
            <FileText size={20} /> التفاصيل الكاملة
          </button>

          {a.category !== 'DataQuality' && a.مرجع_المعرف !== 'batch' && (
            <button
              type="button"
              onClick={openLegalNotice}
              className="col-span-2 flex items-center justify-center gap-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/40 py-3 rounded-xl font-bold transition text-sm"
            >
              <PenTool size={20} /> إرسال إخطار قانوني
            </button>
          )}
        </div>

        {a.مرجع_المعرف !== 'batch' && (
          <div>
            <label className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
              <StickyNote size={16} /> إضافة ملاحظة سريعة
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                className="flex-1 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white text-sm font-bold"
                placeholder="ملاحظة للمتابعة..."
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
              />
              <button
                type="button"
                onClick={saveNote}
                className="bg-slate-800 dark:bg-slate-700 text-white p-2.5 rounded-xl hover:bg-slate-700 dark:hover:bg-slate-600 flex items-center justify-center"
              >
                <Send size={20} />
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800 pt-4">
          <button
            type="button"
            onClick={() => handleDismiss(a)}
            className="text-red-500 hover:text-red-700 text-sm font-bold flex items-center gap-1"
          >
            <CheckCircle size={16} /> تعليم كمقروء (تجاهل)
          </button>
        </div>
      </div>

    </div>
  );
};
