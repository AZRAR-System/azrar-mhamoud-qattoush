import { useCallback, useState } from 'react';
import {
  DEFAULT_PRINT_MARGINS_MM,
  type PrintMarginsMm,
  type PrintPreviewZoom,
} from '../printPreviewTypes';

export function usePrintPreviewState() {
  const [zoom, setZoom] = useState<PrintPreviewZoom>(1);
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [marginsMm, setMarginsMm] = useState<PrintMarginsMm>(() => ({ ...DEFAULT_PRINT_MARGINS_MM }));
  const [pageRange, setPageRange] = useState('');
  const [copies, setCopies] = useState(1);

  const setMarginsSide = useCallback((side: keyof PrintMarginsMm, raw: number) => {
    const value = Number.isFinite(raw) ? Math.max(0, Math.min(80, raw)) : 0;
    setMarginsMm((prev) => ({ ...prev, [side]: value }));
  }, []);

  const resetMargins = useCallback(() => {
    setMarginsMm({ ...DEFAULT_PRINT_MARGINS_MM });
  }, []);

  return {
    zoom,
    setZoom,
    orientation,
    setOrientation,
    marginsMm,
    setMarginsMm,
    setMarginsSide,
    resetMargins,
    pageRange,
    setPageRange,
    copies,
    setCopies,
  };
}
