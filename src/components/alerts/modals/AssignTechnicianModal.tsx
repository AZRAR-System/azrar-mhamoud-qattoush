import React, { useState } from 'react';
import { Wrench } from 'lucide-react';
import { AlertModalShell } from '@/components/alerts/AlertModalShell';
import type { tbl_Alerts } from '@/types';
import type { AssignTechnicianPayload } from '@/services/alerts/alertActionTypes';
import { listMaintenanceTechnicianCandidates } from '@/services/alerts/maintenanceTechnicianCandidates';

export interface AssignTechnicianModalProps {
  open: boolean;
  onClose: () => void;
  alert: tbl_Alerts;
  payload?: AssignTechnicianPayload;
  onOpenMaintenance: () => void;
  onNavigateFull?: () => void;
}

const priorityLabel = (p: AssignTechnicianPayload['priority']) =>
  p === 'high' ? 'عالية' : p === 'low' ? 'منخفضة' : 'متوسطة';

export const AssignTechnicianModal: React.FC<AssignTechnicianModalProps> = ({
  open,
  onClose,
  alert,
  payload,
  onOpenMaintenance,
  onNavigateFull,
}) => {
  const technicians = listMaintenanceTechnicianCandidates();
  const [selectedTechnicianId, setSelectedTechnicianId] = useState('');

  return (
    <AlertModalShell
      open={open}
      onClose={onClose}
      icon={<Wrench size={22} />}
      title="الصيانة والفني"
      subtitle="قائمة الفنيين تُستخرج من تذاكر الصيانة (حقول ديناميكية) ومن أشخاص بتصنيف فني/صيانة — لا جدول فنيين منفصل."
      sourcesBar={
        <span className="inline-flex rounded-full bg-slate-200 px-2.5 py-0.5 text-[10px] font-black text-slate-800 dark:bg-slate-700 dark:text-slate-100">
          Maintenance
        </span>
      }
      sectionContext={
        <div className="space-y-4">
          {payload ? (
            <dl className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50/80 dark:bg-slate-800/50 p-3 text-xs font-bold text-slate-700 dark:text-slate-200">
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">التذكرة</dt>
                <dd dir="ltr">{payload.maintenanceId}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">العقار</dt>
                <dd dir="ltr">{payload.propertyId}</dd>
              </div>
              {payload.unitRef ? (
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">الوحدة</dt>
                  <dd dir="ltr">{payload.unitRef}</dd>
                </div>
              ) : null}
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">الأولوية</dt>
                <dd>{priorityLabel(payload.priority)}</dd>
              </div>
              <div className="col-span-full pt-1">
                <dt className="text-slate-500 mb-1">الوصف</dt>
                <dd className="font-bold text-slate-600 dark:text-slate-300 leading-relaxed">{payload.issueDescription}</dd>
              </div>
            </dl>
          ) : null}
          <p className="text-sm font-bold text-slate-600 dark:text-slate-300 leading-relaxed">{alert.الوصف}</p>
          {technicians.length > 0 ? (
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-500">اختيار فني (محلي)</label>
              <select
                className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-bold outline-none"
                value={selectedTechnicianId}
                onChange={(e) => setSelectedTechnicianId(e.target.value)}
              >
                <option value="">— اختر فنياً —</option>
                {technicians.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
              <p className="text-[10px] font-bold text-slate-400">
                التعيين الفعلي يتم من قسم الصيانة؛ هذا الاختيار للمعاينة داخل التنبيه.
                {selectedTechnicianId ? (
                  <span className="mr-1 block pt-1 text-indigo-600 dark:text-indigo-300" dir="ltr">
                    المحدد: {selectedTechnicianId}
                  </span>
                ) : null}
              </p>
            </div>
          ) : (
            <p className="text-xs font-bold text-amber-700 dark:text-amber-300">
              لا يوجد فنيون في القائمة: أضف تصنيفاً يحتوي «فني» أو «صيانة» للأشخاص، أو اربط `رقم_الفني` في حقول
              تذكرة الصيانة.
            </p>
          )}
        </div>
      }
      footerButtons={
        <>
          <button
            type="button"
            onClick={() => {
              onOpenMaintenance();
              onClose();
            }}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-800 px-4 py-2.5 text-xs font-black text-white shadow-md hover:bg-slate-900"
          >
            <Wrench size={16} /> فتح الصيانة
          </button>
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
