import React from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, PenTool } from 'lucide-react';
import { AlertModalShell } from '@/components/alerts/AlertModalShell';
import type { tbl_Alerts } from '@/types';
import type { LegalFilePayload } from '@/services/alerts/alertActionTypes';
import { buildSettingsMessageTemplatesHref } from '@/services/messageTemplateSourceGroups';

export interface LegalFileModalProps {
  open: boolean;
  onClose: () => void;
  alert: tbl_Alerts;
  payload?: LegalFilePayload;
  onOpenGenerator: () => void;
}

export const LegalFileModal: React.FC<LegalFileModalProps> = ({
  open,
  onClose,
  alert,
  payload,
  onOpenGenerator,
}) => {
  const legalTemplatesHref = buildSettingsMessageTemplatesHref({
    sourceGroup: 'legal',
    templateId: 'wa_legal_notice',
  });

  return (
  <AlertModalShell
    open={open}
    onClose={onClose}
    icon={<PenTool size={22} />}
    title="إخطار قانوني"
    subtitle="مولّد الإخطارات القانونية مرتبط بالمعرّف الحالي للتنبيه."
    sourcesBar={
      <span className="inline-flex rounded-full bg-red-100 px-2.5 py-0.5 text-[10px] font-black text-red-800 dark:bg-red-900/40 dark:text-red-200">
        Legal
      </span>
    }
    sectionContext={
      <>
        <Link
          to={legalTemplatesHref}
          onClick={onClose}
          className="mb-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50/80 px-3 py-2.5 text-xs font-black text-indigo-800 transition-colors hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200 dark:hover:bg-indigo-900/50"
        >
          <ExternalLink size={14} />
          تعديل قوالب الإخطار القانوني / واتساب
        </Link>
        {payload ? (
          <dl className="mb-4 grid grid-cols-1 gap-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50/80 dark:bg-slate-800/50 p-3 text-xs font-bold text-slate-700 dark:text-slate-200">
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">العقد</dt>
              <dd dir="ltr">{payload.contractId}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">الشخص</dt>
              <dd dir="ltr">{payload.personId}</dd>
            </div>
            {payload.caseRef ? (
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">مرجع القضية</dt>
                <dd dir="ltr">{payload.caseRef}</dd>
              </div>
            ) : null}
          </dl>
        ) : null}
        <p className="text-sm font-bold text-slate-600 dark:text-slate-300 leading-relaxed">{alert.الوصف}</p>
      </>
    }
    sectionPreview={
      <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-600 p-4 text-center text-xs font-bold text-slate-400">
        معاينة الخط الزمني للمستندات — تُدار من مولّد الإخطارات بعد الفتح.
      </div>
    }
    footerButtons={
      <>
        <button
          type="button"
          onClick={() => {
            onOpenGenerator();
            onClose();
          }}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-xs font-black text-white shadow-md hover:bg-red-700"
        >
          <PenTool size={16} /> فتح المولّد
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
