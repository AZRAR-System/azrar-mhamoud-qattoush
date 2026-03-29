import React, { useCallback, useMemo, useState } from 'react';
import type { SystemSettings } from '@/types';
import { AppModal } from '@/components/ui/AppModal';
import { PrintLetterhead } from '@/components/print/PrintLetterhead';
import { useToast } from '@/context/ToastContext';
import { exportDocxUnified, printHtmlUnified } from '@/services/printing/unifiedPrint';
import type { DesktopPrintDispatchResult } from '@/types/electron.types';
import { buildFullPrintHtmlDocument, type PrintPreviewDocxContext } from './printPreviewTypes';
import { usePrintPreviewState } from './hooks/usePrintPreviewState';
import { PrintPreviewToolbar } from './PrintPreviewToolbar';

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

  const docxAvailable = !!docxContext;

  const fullHtml = useMemo(
    () =>
      buildFullPrintHtmlDocument(settings, bodyHtml, {
        orientation: st.orientation,
        marginsMm: st.marginsMm,
      }),
    [settings, bodyHtml, st.orientation, st.marginsMm]
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

      <div className="min-h-0 flex-1 overflow-auto bg-slate-100/80 p-4 dark:bg-slate-950/40">
        <div
          className="mx-auto bg-white shadow-xl ring-1 ring-slate-200/80 dark:bg-slate-900 dark:ring-slate-800"
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
            className="prose prose-sm max-w-none text-slate-900 dark:prose-invert"
            dangerouslySetInnerHTML={{ __html: bodyHtml }}
          />
        </div>
      </div>
    </AppModal>
  );
};
