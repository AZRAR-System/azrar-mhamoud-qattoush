import React from 'react';
import { Button } from '@/components/ui/Button';
import {
  PRINT_PREVIEW_ZOOMS,
  type PrintMarginsMm,
  type PrintPreviewZoom,
} from './printPreviewTypes';

export type PrintPreviewToolbarProps = {
  zoom: PrintPreviewZoom;
  onZoomChange: (z: PrintPreviewZoom) => void;
  orientation: 'portrait' | 'landscape';
  onOrientationChange: (o: 'portrait' | 'landscape') => void;
  marginsMm: PrintMarginsMm;
  onMarginChange: (side: keyof PrintMarginsMm, value: number) => void;
  onResetMargins: () => void;
  pageRange: string;
  onPageRangeChange: (s: string) => void;
  copies: number;
  onCopiesChange: (n: number) => void;
  docxAvailable: boolean;
  onPrint: () => void;
  onPdf: () => void;
  onWord: () => void;
  busyPrint?: boolean;
  busyPdf?: boolean;
  busyWord?: boolean;
};

const marginField =
  'w-14 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';

export const PrintPreviewToolbar: React.FC<PrintPreviewToolbarProps> = ({
  zoom,
  onZoomChange,
  orientation,
  onOrientationChange,
  marginsMm,
  onMarginChange,
  onResetMargins,
  pageRange,
  onPageRangeChange,
  copies,
  onCopiesChange,
  docxAvailable,
  onPrint,
  onPdf,
  onWord,
  busyPrint,
  busyPdf,
  busyWord,
}) => {
  return (
    <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-900/40">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold text-slate-500">تكبير</span>
        <div className="flex gap-1">
          {PRINT_PREVIEW_ZOOMS.map((z) => (
            <Button
              key={z}
              type="button"
              size="sm"
              variant={zoom === z ? 'primary' : 'secondary'}
              onClick={() => onZoomChange(z)}
            >
              {z === 1 ? '100%' : `${z * 100}%`}
            </Button>
          ))}
        </div>

        <span className="mr-4 text-xs font-bold text-slate-500">اتجاه</span>
        <Button
          type="button"
          size="sm"
          variant={orientation === 'portrait' ? 'primary' : 'secondary'}
          onClick={() => onOrientationChange('portrait')}
        >
          عمودي
        </Button>
        <Button
          type="button"
          size="sm"
          variant={orientation === 'landscape' ? 'primary' : 'secondary'}
          onClick={() => onOrientationChange('landscape')}
        >
          أفقي
        </Button>

        <Button type="button" size="sm" variant="ghost" onClick={onResetMargins} className="mr-auto">
          هوامش 20مم
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-bold text-slate-500">الهوامش (مم)</span>
          <div className="flex flex-wrap items-center gap-1" dir="ltr">
            <label className="flex items-center gap-1 text-[10px] text-slate-600">
              T
              <input
                type="number"
                min={0}
                max={80}
                className={marginField}
                value={marginsMm.top}
                onChange={(e) => onMarginChange('top', Number(e.target.value))}
              />
            </label>
            <label className="flex items-center gap-1 text-[10px] text-slate-600">
              R
              <input
                type="number"
                min={0}
                max={80}
                className={marginField}
                value={marginsMm.right}
                onChange={(e) => onMarginChange('right', Number(e.target.value))}
              />
            </label>
            <label className="flex items-center gap-1 text-[10px] text-slate-600">
              B
              <input
                type="number"
                min={0}
                max={80}
                className={marginField}
                value={marginsMm.bottom}
                onChange={(e) => onMarginChange('bottom', Number(e.target.value))}
              />
            </label>
            <label className="flex items-center gap-1 text-[10px] text-slate-600">
              L
              <input
                type="number"
                min={0}
                max={80}
                className={marginField}
                value={marginsMm.left}
                onChange={(e) => onMarginChange('left', Number(e.target.value))}
              />
            </label>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-bold text-slate-500">النسخ</span>
          <input
            type="number"
            min={1}
            max={99}
            className={`${marginField} w-16`}
            value={copies}
            onChange={(e) => onCopiesChange(Math.max(1, Math.min(99, Number(e.target.value) || 1)))}
          />
        </div>

        <div className="min-w-[140px] flex-1 flex flex-col gap-1">
          <span className="text-[10px] font-bold text-slate-500">نطاق الصفحات</span>
          <input
            type="text"
            dir="ltr"
            placeholder="1-3, 5"
            className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-mono dark:border-slate-700 dark:bg-slate-900"
            value={pageRange}
            onChange={(e) => onPageRangeChange(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="primary" onClick={onPrint} isLoading={busyPrint}>
            طباعة
          </Button>
          <Button type="button" variant="secondary" onClick={onPdf} isLoading={busyPdf}>
            PDF
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onWord}
            disabled={!docxAvailable}
            isLoading={busyWord}
            title={!docxAvailable ? 'يتطلب قالب' : undefined}
          >
            Word
          </Button>
        </div>
      </div>
    </div>
  );
};
