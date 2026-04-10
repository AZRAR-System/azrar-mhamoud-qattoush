import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { SystemSettings } from '@/types';
import { AppModal } from '@/components/ui/AppModal';
import { PrintLetterhead } from '@/components/print/PrintLetterhead';
import { useToast } from '@/context/ToastContext';
import { exportDocxUnified, printHtmlUnified } from '@/services/printing/unifiedPrint';
import type { DesktopPrintDispatchResult } from '@/types/electron.types';
import {
  buildFullPrintHtmlDocument,
  escapeHtml,
  type PrintPreviewDocxContext,
} from './printPreviewTypes';
import { usePrintPreviewState } from './hooks/usePrintPreviewState';
import { PrintPreviewToolbar } from './PrintPreviewToolbar';

function todayYmdLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export type PrintPreviewModalProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  /** Company profile etc.; used for main-process HTML and kept on the modal API as agreed. */
  settings: SystemSettings;
  /** Trusted HTML fragment for the document body (same content shown under PrintLetterhead in preview). */
  bodyHtml: string;
  documentType: string;
  entityId?: string;
  defaultFileName?: string;
  docxContext?: PrintPreviewDocxContext;
};

const dispatchErr = (res: Extract<DesktopPrintDispatchResult, { ok: false }>) =>
  res.message || 'تعذر إكمال العملية';

export const PrintPreviewModal: React.FC<PrintPreviewModalProps> = ({
  open,
  onClose,
  title = 'معاينة الطباعة',
  settings,
  bodyHtml,
  documentType,
  entityId,
  defaultFileName,
  docxContext,
}) => {
  const toast = useToast();
  const st = usePrintPreviewState();
  const [busyPrint, setBusyPrint] = useState(false);
  const [busyPdf, setBusyPdf] = useState(false);
  const [busyWord, setBusyWord] = useState(false);

  const [notes, setNotes] = useState('');
  const [documentDate, setDocumentDate] = useState(todayYmdLocal);
  const [referenceNumber, setReferenceNumber] = useState('');

  useEffect(() => {
    if (open) setDocumentDate(todayYmdLocal());
  }, [open]);

  const docxAvailable = !!docxContext;

  const augmentedBodyHtml = useMemo(() => {
    const blocks: string[] = [];
    const meta: string[] = [];
    const ref = referenceNumber.trim();
    if (ref) {
      meta.push(
        `<div style="margin-bottom:6px;"><strong>رقم المرجع:</strong> ${escapeHtml(ref)}</div>`
      );
    }
    if (documentDate) {
      meta.push(
        `<div style="margin-bottom:6px;"><strong>تاريخ المستند:</strong> ${escapeHtml(documentDate)}</div>`
      );
    }
    const n = notes.trim();
    if (n) {
      meta.push(
        `<div style="margin-top:8px;padding-top:8px;border-top:1px solid #e5e7eb;"><strong>ملاحظات:</strong><div style="margin-top:4px;white-space:pre-wrap;">${escapeHtml(n)}</div></div>`
      );
    }
    if (meta.length) {
      blocks.push(
        `<div class="print-doc-meta" style="margin-bottom:14px;padding:12px;border:1px solid #e5e7eb;border-radius:10px;background:#fafafa;font-size:12px;line-height:1.65;color:#0f172a;text-align:right;direction:rtl;">${meta.join('')}</div>`
      );
    }
    blocks.push(bodyHtml);
    return blocks.join('');
  }, [bodyHtml, notes, documentDate, referenceNumber]);

  const fullHtml = useMemo(
    () =>
      buildFullPrintHtmlDocument(settings, augmentedBodyHtml, {
        orientation: st.orientation,
        marginsMm: st.marginsMm,
      }),
    [settings, augmentedBodyHtml, st.orientation, st.marginsMm]
  );

  const dispatchPayload = useMemo(
    () => ({
      html: fullHtml,
      orientation: st.orientation,
      marginsMm: st.marginsMm,
      pageRanges: st.pageRange.trim() || undefined,
      copies: st.copies,
      defaultFileName,
    }),
    [fullHtml, st.orientation, st.marginsMm, st.pageRange, st.copies, defaultFileName]
  );

  const handlePrint = useCallback(async () => {
    setBusyPrint(true);
    try {
      const res = await printHtmlUnified({
        documentType,
        entityId,
        html: dispatchPayload.html,
        orientation: dispatchPayload.orientation,
        marginsMm: dispatchPayload.marginsMm,
        pageRanges: dispatchPayload.pageRanges,
        copies: dispatchPayload.copies,
        defaultFileName: dispatchPayload.defaultFileName,
      });
      if (res && res.ok === false) toast.error(dispatchErr(res));
      else if (res?.ok) toast.success('جاري فتح حوار الطباعة');
      else toast.error('وضع المتصفح لا يدعم الطباعة الموحدة');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'فشلت الطباعة');
    } finally {
      setBusyPrint(false);
    }
  }, [dispatchPayload, documentType, entityId, toast]);

  const handlePdf = useCallback(async () => {
    setBusyPdf(true);
    try {
      const bridge = window.desktopPrinting?.htmlToPdf;
      if (!bridge) {
        toast.error('تصدير PDF متاح في تطبيق سطح المكتب فقط');
        return;
      }
      const res = await bridge({
        html: dispatchPayload.html,
        orientation: dispatchPayload.orientation,
        marginsMm: dispatchPayload.marginsMm,
        pageRanges: dispatchPayload.pageRanges,
        copies: dispatchPayload.copies,
        defaultFileName: dispatchPayload.defaultFileName,
      });
      if (res.ok === false) toast.error(dispatchErr(res));
      else toast.success('تم حفظ ملف PDF');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'فشل تصدير PDF');
    } finally {
      setBusyPdf(false);
    }
  }, [dispatchPayload, toast]);

  const handleWord = useCallback(async () => {
    if (!docxContext) return;
    setBusyWord(true);
    try {
      const res = await exportDocxUnified({
        documentType,
        entityId,
        templateName: docxContext.templateName,
        data: docxContext.data,
        defaultFileName: docxContext.defaultFileName ?? defaultFileName,
        headerFooter: docxContext.headerFooter,
      });
      if (res && res.ok === false) toast.error(dispatchErr(res));
      else if (res?.ok) toast.success('تم تنفيذ التصدير');
      else toast.error('وضع المتصفح لا يدعم تصدير Word');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'فشل تصدير Word');
    } finally {
      setBusyWord(false);
    }
  }, [defaultFileName, docxContext, documentType, entityId, toast]);

  return (
    <AppModal
      open={open}
      onClose={onClose}
      title={title}
      size="6xl"
      bodyClassName="p-0 flex flex-col max-h-[90vh]"
      contentClassName="max-h-[90vh] flex flex-col"
    >
      <PrintPreviewToolbar
        zoom={st.zoom}
        onZoomChange={st.setZoom}
        orientation={st.orientation}
        onOrientationChange={st.setOrientation}
        marginsMm={st.marginsMm}
        onMarginChange={st.setMarginsSide}
        onResetMargins={st.resetMargins}
        pageRange={st.pageRange}
        onPageRangeChange={st.setPageRange}
        copies={st.copies}
        onCopiesChange={st.setCopies}
        docxAvailable={docxAvailable}
        onPrint={handlePrint}
        onPdf={handlePdf}
        onWord={handleWord}
        busyPrint={busyPrint}
        busyPdf={busyPdf}
        busyWord={busyWord}
      />

      <div className="flex min-h-0 flex-1 flex-row-reverse gap-0 border-t border-slate-200 dark:border-slate-800">
        <aside
          className="w-[min(100%,280px)] shrink-0 border-l border-slate-200 bg-slate-50/90 p-3 dark:border-slate-800 dark:bg-slate-900/50"
          dir="rtl"
        >
          <div className="mb-3 text-xs font-extrabold text-slate-500">بيانات المستند</div>
          <label className="mb-3 flex flex-col gap-1">
            <span className="text-[11px] font-bold text-slate-600">رقم المرجع</span>
            <input
              type="text"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950"
              placeholder="اختياري"
              autoComplete="off"
            />
          </label>
          <label className="mb-3 flex flex-col gap-1">
            <span className="text-[11px] font-bold text-slate-600">تاريخ المستند</span>
            <input
              type="date"
              value={documentDate}
              onChange={(e) => setDocumentDate(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-bold text-slate-600">ملاحظات</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="min-h-[88px] resize-y rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm leading-relaxed dark:border-slate-700 dark:bg-slate-950"
              placeholder="اختياري"
            />
          </label>
        </aside>

        <div className="min-h-0 flex-1 overflow-auto bg-slate-200/50 p-4 dark:bg-black/40">
          <div
            className="mx-auto bg-white text-slate-900 shadow-2xl ring-1 ring-slate-200"
            style={{
              width: '210mm',
              minHeight: '297mm',
              transform: `scale(${st.zoom})`,
              transformOrigin: 'top center',
              padding: '12mm',
            }}
          >
            <PrintLetterhead className="mb-4" />
            <div
              className="prose prose-sm max-w-none text-slate-900"
              dangerouslySetInnerHTML={{ __html: augmentedBodyHtml }}
            />
          </div>
        </div>
      </div>
    </AppModal>
  );
};
