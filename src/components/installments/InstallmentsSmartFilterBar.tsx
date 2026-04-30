import {
  FC,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { createPortal } from 'react-dom';
import {
  Calendar,
  DollarSign,
  Layers,
  Clock,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { SmartFilterBar } from '@/components/shared/SmartFilterBar';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { computePortalPanelLayout } from '@/utils/portalMenuLayout';

const filterPanelClass =
  'layer-portal-dropdown rounded-2xl border border-slate-200/80 bg-white/95 p-4 shadow-2xl backdrop-blur-xl dark:border-slate-700/80 dark:bg-slate-900/95 animate-in fade-in zoom-in-95 duration-200';

interface InstallmentsSmartFilterBarProps {
  search: string;
  setSearch: (v: string) => void;
  status: string;
  setStatus: (v: string) => void;
  startDate: string;
  setStartDate: (v: string) => void;
  endDate: string;
  setEndDate: (v: string) => void;
  minAmount: number | '';
  setMinAmount: (v: number | '') => void;
  maxAmount: number | '';
  setMaxAmount: (v: number | '') => void;
  paymentMethod: string;
  setPaymentMethod: (v: string) => void;
  onRefresh: () => void;
  onExportXlsx: () => void;
  totalResults: number;
  currentPage: number;
  totalPages: number;
  onPageChange: (p: number) => void;
  isLoading?: boolean;
}

const PANEL_W = 256;
const PANEL_MIN_H = 140;

export const InstallmentsSmartFilterBar: FC<InstallmentsSmartFilterBarProps> = ({
  search,
  setSearch,
  status,
  setStatus,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  minAmount,
  setMinAmount,
  maxAmount,
  setMaxAmount,
  paymentMethod,
  setPaymentMethod,
  onRefresh,
  onExportXlsx,
  totalResults,
  currentPage,
  totalPages,
  onPageChange,
}) => {
  const [dateOpen, setDateOpen] = useState(false);
  const [amtOpen, setAmtOpen] = useState(false);
  const [dateStyle, setDateStyle] = useState<CSSProperties>({});
  const [amtStyle, setAmtStyle] = useState<CSSProperties>({});

  const dateWrapRef = useRef<HTMLDivElement>(null);
  const amtWrapRef = useRef<HTMLDivElement>(null);
  const datePanelRef = useRef<HTMLDivElement>(null);
  const amtPanelRef = useRef<HTMLDivElement>(null);

  const syncDate = useCallback(() => {
    const el = dateWrapRef.current;
    if (!el) return;
    setDateStyle(computePortalPanelLayout(el.getBoundingClientRect(), PANEL_W, PANEL_MIN_H));
  }, []);

  const syncAmt = useCallback(() => {
    const el = amtWrapRef.current;
    if (!el) return;
    setAmtStyle(computePortalPanelLayout(el.getBoundingClientRect(), PANEL_W, PANEL_MIN_H));
  }, []);

  useLayoutEffect(() => {
    if (!dateOpen) return;
    syncDate();
    let rafId: number | null = null;
    const h = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        syncDate();
      });
    };
    const scrollOpts: AddEventListenerOptions = { capture: true, passive: true };
    const resizeOpts: AddEventListenerOptions = { passive: true };
    window.addEventListener('resize', h, resizeOpts);
    window.addEventListener('scroll', h, scrollOpts);
    return () => {
      window.removeEventListener('resize', h, resizeOpts);
      window.removeEventListener('scroll', h, scrollOpts);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [dateOpen, syncDate]);

  useLayoutEffect(() => {
    if (!amtOpen) return;
    syncAmt();
    let rafId: number | null = null;
    const h = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        syncAmt();
      });
    };
    const scrollOpts: AddEventListenerOptions = { capture: true, passive: true };
    const resizeOpts: AddEventListenerOptions = { passive: true };
    window.addEventListener('resize', h, resizeOpts);
    window.addEventListener('scroll', h, scrollOpts);
    return () => {
      window.removeEventListener('resize', h, resizeOpts);
      window.removeEventListener('scroll', h, scrollOpts);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [amtOpen, syncAmt]);

  useEffect(() => {
    if (!dateOpen && !amtOpen) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (dateOpen) {
        if (dateWrapRef.current?.contains(t) || datePanelRef.current?.contains(t)) return;
        setDateOpen(false);
      }
      if (amtOpen) {
        if (amtWrapRef.current?.contains(t) || amtPanelRef.current?.contains(t)) return;
        setAmtOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [dateOpen, amtOpen]);

  useEffect(() => {
    if (!dateOpen && !amtOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setDateOpen(false);
        setAmtOpen(false);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [dateOpen, amtOpen]);

  const datePanel =
    dateOpen && typeof document !== 'undefined' ? (
      <div ref={datePanelRef} style={dateStyle} className={`${filterPanelClass} w-64`}>
        <div className="space-y-4">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full rounded-lg bg-slate-50 p-2 text-xs dark:bg-slate-900"
          />
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full rounded-lg bg-slate-50 p-2 text-xs dark:bg-slate-900"
          />
        </div>
      </div>
    ) : null;

  const amtPanel =
    amtOpen && typeof document !== 'undefined' ? (
      <div ref={amtPanelRef} style={amtStyle} className={`${filterPanelClass} w-64`}>
        <div className="flex gap-2">
          <input
            type="number"
            placeholder="من"
            value={minAmount}
            onChange={(e) => setMinAmount(e.target.value ? Number(e.target.value) : '')}
            className="w-full rounded-lg bg-slate-50 p-2 text-xs dark:bg-slate-900"
          />
          <input
            type="number"
            placeholder="إلى"
            value={maxAmount}
            onChange={(e) => setMaxAmount(e.target.value ? Number(e.target.value) : '')}
            className="w-full rounded-lg bg-slate-50 p-2 text-xs dark:bg-slate-900"
          />
        </div>
      </div>
    ) : null;

  return (
    <SmartFilterBar
      searchPlaceholder="بحث في الأقساط (المستأجر، العقار)..."
      searchValue={search}
      onSearchChange={setSearch}
      tabs={[
        { id: 'all', label: 'الكل', icon: Layers },
        { id: 'due', label: 'مستحق', icon: Clock },
        { id: 'debt', label: 'ذمم', icon: XCircle },
        { id: 'paid', label: 'مسدد', icon: CheckCircle },
      ]}
      activeTab={status}
      onTabChange={setStatus}
      onRefresh={onRefresh}
      onExport={onExportXlsx}
      totalResults={totalResults}
      currentPage={currentPage}
      totalPages={totalPages}
      onPageChange={onPageChange}
    >
      <div className="flex flex-wrap items-center gap-2">
        <div ref={dateWrapRef} className="relative">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={`h-9 gap-2 rounded-xl px-3 font-bold ${startDate || endDate ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : ''}`}
            onClick={() => {
              setAmtOpen(false);
              setDateOpen((o) => {
                const next = !o;
                if (next) queueMicrotask(() => syncDate());
                return next;
              });
            }}
          >
            <Calendar size={14} />
            <span className="text-[10px]">
              {startDate || endDate ? `${startDate || '..'} - ${endDate || '..'}` : 'التاريخ'}
            </span>
          </Button>
          {datePanel ? createPortal(datePanel, document.body) : null}
        </div>

        <div ref={amtWrapRef} className="relative">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={`h-9 gap-2 rounded-xl px-3 font-bold ${minAmount || maxAmount ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : ''}`}
            onClick={() => {
              setDateOpen(false);
              setAmtOpen((o) => {
                const next = !o;
                if (next) queueMicrotask(() => syncAmt());
                return next;
              });
            }}
          >
            <DollarSign size={14} />
            <span className="text-[10px]">
              {minAmount || maxAmount ? `${minAmount || 0} - ${maxAmount || '∞'}` : 'المبلغ'}
            </span>
          </Button>
          {amtPanel ? createPortal(amtPanel, document.body) : null}
        </div>

        <Select
          required
          value={paymentMethod}
          onChange={(e) => setPaymentMethod(e.target.value)}
          options={[
            { value: 'all', label: 'كل الطرق' },
            { value: 'Prepaid', label: 'دفع مسبق' },
            { value: 'Postpaid', label: 'دفع لاحق' },
          ]}
          className="h-9 min-w-[9.5rem] [&_button]:h-9 [&_button]:rounded-xl [&_button]:py-0 [&_button]:text-[10px] [&_button]:font-bold"
        />
      </div>
    </SmartFilterBar>
  );
};
