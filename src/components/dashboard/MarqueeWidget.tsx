import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FC } from 'react';
import { DbService } from '@/services/mockDb';
import { MarqueeMessage } from '@/types';
import { Megaphone, X, AlertTriangle, CheckCircle, Info, Plus, Settings2 } from 'lucide-react';
import { useSmartModal } from '@/context/ModalContext';
import { ROUTE_PATHS } from '@/routes/paths';
import { useAppDialogs } from '@/hooks/useAppDialogs';
import { Button } from '@/components/ui/Button';
import type { PanelType } from '@/context/ModalContext';

export const MarqueeWidget: FC<{
  isCustomizing?: boolean;
  onRemove?: () => void;
  /** شريط علوي بعرض كامل (بدون استدارة أعلى، مناسب لأعلى الصفحة) */
  edgeToEdge?: boolean;
}> = ({ isCustomizing, onRemove, edgeToEdge }) => {
  const [messages, setMessages] = useState<MarqueeMessage[]>([]);
  const [repeatFactor, setRepeatFactor] = useState<number>(1);
  const [marqueeShiftPx, setMarqueeShiftPx] = useState<number>(0);
  const { openPanel } = useSmartModal();
  const dialogs = useAppDialogs();
  const lastMessagesSignatureRef = useRef<string>('');
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const marqueeViewportRef = useRef<HTMLDivElement | null>(null);
  const marqueeMeasureRef = useRef<HTMLDivElement | null>(null);
  const marqueeFirstGroupRef = useRef<HTMLDivElement | null>(null);
  const marqueeSecondGroupRef = useRef<HTMLDivElement | null>(null);
  const marqueeTrackRef = useRef<HTMLDivElement | null>(null);

  const isPanelType = (value: string): value is PanelType => {
    switch (value) {
      case 'PERSON_DETAILS':
      case 'PROPERTY_DETAILS':
      case 'CONTRACT_DETAILS':
      case 'INSTALLMENT_DETAILS':
      case 'MAINTENANCE_DETAILS':
      case 'GENERIC_ALERT':
      case 'REPORT_VIEWER':
      case 'LEGAL_NOTICE_GENERATOR':
      case 'BULK_WHATSAPP':
      case 'CONFIRM_MODAL':
      case 'SALES_LISTING_DETAILS':
      case 'CLEARANCE_REPORT':
      case 'CLEARANCE_WIZARD':
      case 'PERSON_FORM':
      case 'PROPERTY_FORM':
      case 'CONTRACT_FORM':
      case 'INSPECTION_FORM':
      case 'BLACKLIST_FORM':
      case 'SMART_PROMPT':
      case 'CALENDAR_EVENTS':
      case 'PAYMENT_NOTIFICATIONS':
      case 'SECTION_VIEW':
      case 'SERVER_DRAWER':
      case 'SQL_SYNC_LOG':
      case 'MARQUEE_ADS':
        return true;
      default:
        return false;
    }
  };

  useEffect(() => {
    const load = () => {
      const next = DbService.getMarqueeMessages();
      const signature = next
        .map((m) => {
          const action = m.action ? JSON.stringify(m.action) : '';
          return `${String(m.id)}|${String(m.type)}|${String(m.priority)}|${String(m.content)}|${action}`;
        })
        .join('||');

      if (signature === lastMessagesSignatureRef.current) return;
      lastMessagesSignatureRef.current = signature;
      setMessages(next);
    };
    load();
    const interval = setInterval(load, 30000);
    const handler = () => load();
    window.addEventListener('azrar:marquee-changed', handler);
    window.addEventListener('azrar:tasks-changed', handler);
    window.addEventListener('azrar:db-changed', handler);
    window.addEventListener('focus', handler);

    const storageHandler = (e: StorageEvent) => {
      if (!e.key) return;
      if (!String(e.key).startsWith('db_')) return;
      load();
    };
    window.addEventListener('storage', storageHandler);

    return () => {
      clearInterval(interval);
      window.removeEventListener('azrar:marquee-changed', handler);
      window.removeEventListener('azrar:tasks-changed', handler);
      window.removeEventListener('azrar:db-changed', handler);
      window.removeEventListener('focus', handler);
      window.removeEventListener('storage', storageHandler);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setPrefersReducedMotion(!!mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  const handleAddAd = async () => {
    const content = await dialogs.prompt({
      title: 'إضافة إعلان للشريط',
      message: 'اكتب نص الإعلان الذي سيظهر في الشريط.',
      inputType: 'textarea',
      placeholder: 'مثال: خصم على عمولة الإدارة لمدة أسبوع...',
      required: true,
    });
    if (!content) return;

    const hoursStr = await dialogs.prompt({
      title: 'مدة الظهور (بالساعات)',
      message:
        'حدد عدد الساعات التي يبقى فيها الإعلان ظاهراً ثم يختفي تلقائياً. اكتب 0 ليبقى دائماً.',
      inputType: 'number',
      defaultValue: '0',
      placeholder: '0',
      required: true,
      validationRegex: /^\d+$/,
      validationError: 'أدخل رقم صحيح (0 أو أكثر)',
    });
    if (!hoursStr) return;

    const durationHours = Number(hoursStr);

    const validHours = Number.isFinite(durationHours) && durationHours >= 0 ? durationHours : 0;
    const expiresAt = validHours > 0 ? new Date(Date.now() + validHours * 3600 * 1000).toISOString() : undefined;

    const local = DbService.addMarqueeAd({
      content,
      expiresAt,
      type: 'info',
      priority: 'Normal',
    });
    if (!local.success) dialogs.toast.error(local.message || 'فشل إضافة الإعلان');
    else dialogs.toast.success(local.message || 'تمت إضافة الإعلان للشريط');
  };

  const displayMessages = useMemo(() => {
    // Dedupe by id
    const seen = new Set<string>();
    return messages.filter((m) => {
      const id = String(m.id || '');
      if (!id) return false;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, [messages]);

  const hasMessages = displayMessages.length > 0;

  const MAX_REPEAT = 40;

  const repeatedMessages = useMemo(() => {
    if (!hasMessages) return [];
    const clamped = Math.max(1, Math.min(MAX_REPEAT, repeatFactor));
    const out: MarqueeMessage[] = [];
    for (let i = 0; i < clamped; i++) out.push(...displayMessages);
    return out;
  }, [hasMessages, displayMessages, repeatFactor]);

  useLayoutEffect(() => {
    if (!hasMessages) {
      setRepeatFactor((prev) => (prev === 1 ? prev : 1));
      return;
    }

    const viewportEl = marqueeViewportRef.current;
    const measureEl = marqueeMeasureRef.current;
    if (!viewportEl || !measureEl) return;

    const compute = () => {
      const viewportWidth = viewportEl.clientWidth || 0;
      const baseWidth = measureEl.scrollWidth || 0;
      if (viewportWidth <= 0 || baseWidth <= 0) return;

      // Ensure one "group" is at least as wide as the viewport to avoid any blank area.
      // Extra padding (~4rem) matches the group's gap/padding so the end doesn't feel tight.
      const required = Math.ceil((viewportWidth + 64) / baseWidth);
      const next = Math.max(1, Math.min(MAX_REPEAT, required));
      setRepeatFactor((prev) => (prev === next ? prev : next));
    };

    compute();

    // Re-measure once fonts are loaded (prevents jumpy widths on first paint)
    const fontsReady = document.fonts?.ready;
    if (fontsReady) void fontsReady.then(() => compute());

    const ro = new ResizeObserver(() => compute());
    ro.observe(viewportEl);
    ro.observe(measureEl);
    return () => ro.disconnect();
  }, [hasMessages]);

  useLayoutEffect(() => {
    if (!hasMessages) {
      setMarqueeShiftPx((prev) => (prev === 0 ? prev : 0));
      return;
    }

    const first = marqueeFirstGroupRef.current;
    const second = marqueeSecondGroupRef.current;
    const viewportEl = marqueeViewportRef.current;
    if (!first || !second || !viewportEl) return;

    const compute = () => {
      // Distance from the start of group 1 to the start of group 2.
      // This includes any spacing between groups and guarantees a seamless loop.
      const shift = Math.round(second.offsetLeft || 0);
      if (shift > 0) {
        setMarqueeShiftPx((prev) => (prev === shift ? prev : shift));
        return;
      }

      const fallback = Math.round(first.scrollWidth || 0);
      setMarqueeShiftPx((prev) => (prev === fallback ? prev : fallback));
    };

    compute();

    // Re-measure once fonts are loaded (prevents initial 0/incorrect offsets)
    const fontsReady = document.fonts?.ready;
    if (fontsReady) void fontsReady.then(() => compute());

    const ro = new ResizeObserver(() => compute());
    ro.observe(viewportEl);
    ro.observe(first);
    ro.observe(second);
    return () => ro.disconnect();
  }, [hasMessages, repeatedMessages.length]);

  const marqueeDurationSec = useMemo(() => {
    if (!hasMessages) return 80;
    const itemCount = displayMessages.length;
    const totalChars = displayMessages.reduce((sum, m) => sum + String(m.content || '').length, 0);

    // Heuristic: more items/longer text => slower scroll.
    const byItems = 70 + itemCount * 3.0;
    const byChars = 70 + totalChars / 14;
    const raw = Math.max(byItems, byChars);
    const clamped = Math.min(240, Math.max(80, raw));
    return Math.round(clamped);
  }, [hasMessages, displayMessages]);

  useEffect(() => {
    const trackEl = marqueeTrackRef.current;
    if (!trackEl) return;
    trackEl.style.setProperty('--marquee-duration', `${marqueeDurationSec}s`);
    trackEl.style.setProperty('--marquee-shift', `${marqueeShiftPx}px`);
  }, [marqueeDurationSec, marqueeShiftPx]);

  const getIcon = (type: MarqueeMessage['type']) => {
    if (type === 'alert') return <AlertTriangle size={14} className="text-yellow-300" />;
    if (type === 'success') return <CheckCircle size={14} className="text-green-300" />;
    return <Info size={14} className="text-indigo-300" />;
  };

  const handleClick = (msg: MarqueeMessage) => {
    const action = msg.action;
    if (!action) return;
    if (action.kind === 'hash') {
      window.location.hash = action.hash;
      return;
    }
    if (action.kind === 'panel') {
      if (action.panel === 'PAYMENT_NOTIFICATIONS') {
        openPanel('SECTION_VIEW', ROUTE_PATHS.INSTALLMENTS, { title: 'لوحة السداد الرئيسية' });
        return;
      }
      if (!isPanelType(action.panel)) return;
      openPanel(action.panel, action.id, action.options);
    }
  };

  return (
    <div
      role="region"
      aria-label="شريط الإعلانات والتنبيهات"
      className={`relative flex items-center bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 h-10 overflow-hidden ${
        edgeToEdge
          ? 'w-full mb-0 rounded-none'
          : 'mx-4 lg:mx-8 mb-4 mt-2 rounded-xl border border-slate-200 dark:border-slate-800'
      }`}
    >
      {/* Inject Keyframes Locally to ensure it works */}
      <style>{`
        @keyframes marquee-continuous-rtl {
          0% { transform: translateX(0); }
          /* Avoid calc() multiplication (can be unsupported in some Chromium/Electron builds) */
          100% { transform: translateX(calc(0px - var(--marquee-shift, 0px))); }
        }

        .marquee-track {
          display: flex;
          align-items: center;
          height: 100%;
          width: max-content;
          flex-shrink: 0;
          white-space: nowrap;
          direction: ltr;
        }

        .marquee-group {
          display: flex;
          align-items: center;
          flex-shrink: 0;
          gap: 3rem;
          padding-inline-end: 0;
        }

        .animate-marquee-continuous {
          animation: marquee-continuous-rtl var(--marquee-duration, 40s) linear infinite;
          /* Start mid-way so it doesn't "pop in" at the beginning */
          animation-delay: calc(var(--marquee-duration, 40s) * -0.5);
          will-change: transform;
        }
        .animate-marquee-continuous:hover {
          animation-play-state: paused;
        }

        @media (prefers-reduced-motion: reduce) {
          .animate-marquee-continuous {
            animation: none !important;
            transform: none !important;
          }
        }

        .marquee-static-scroll {
          scrollbar-width: thin;
        }
      `}</style>

      {/* Fixed Icon Area */}
      <div className="px-3 h-full flex items-center gap-1.5 z-20 shrink-0 border-l border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60">
        <Megaphone size={14} className="text-indigo-500 dark:text-indigo-400 flex-shrink-0" />
        <Button
          variant="ghost"
          className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 h-7 w-7 p-0"
          onClick={() => openPanel('MARQUEE_ADS')}
          title="تخصيص الإعلانات"
        >
          <Settings2 size={13} />
        </Button>
        <Button
          variant="ghost"
          className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 h-7 w-7 p-0"
          onClick={handleAddAd}
          title="إضافة إعلان"
        >
          <Plus size={13} />
        </Button>
      </div>

      {/* Moving Content Area */}
      <div
        ref={marqueeViewportRef}
        dir="ltr"
        className="flex-1 overflow-hidden relative h-full flex items-center justify-start px-2"
      >
        {/* Hidden measurer: measures width of ONE copy of the messages */}
        {hasMessages && (
          <div
            ref={marqueeMeasureRef}
            className="marquee-group"
            style={{
              position: 'absolute',
              visibility: 'hidden',
              pointerEvents: 'none',
              top: 0,
              left: -100000,
            }}
          >
            {displayMessages.map((msg) => (
              <div
                key={`m-${String(msg.id)}`}
                className="text-[13px] font-bold flex items-center gap-2.5 px-5 py-1.5 rounded-xl border border-white/10 bg-white/5 shadow-sm"
              >
                {getIcon(msg.type)}
                <span dir="rtl">{msg.content}</span>
              </div>
            ))}
          </div>
        )}

        {!hasMessages ? (
          <div
            dir="rtl"
            className="px-5 py-1.5 rounded-xl bg-white/5 border border-white/10 text-slate-400 text-[13px] font-bold"
          >
            لا توجد تنبيهات عاجلة حالاً — أضف إعلاناً من زر +
          </div>
        ) : prefersReducedMotion ? (
          <div className="flex items-center gap-6 min-h-full py-1 pe-2" role="list">
            {displayMessages.map((msg) => (
              <button
                type="button"
                key={`static-${String(msg.id)}`}
                role="listitem"
                onClick={() => handleClick(msg)}
                className={`text-[12px] font-medium flex items-center gap-2 px-3 py-1 rounded-md border transition-colors shrink-0 ${
                    msg.priority === 'High' 
                    ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30' 
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                } ${msg.action ? 'cursor-pointer' : 'cursor-default'}`}
                title={msg.action ? 'اضغط لفتح التفاصيل' : undefined}
              >
                {getIcon(msg.type)}
                <span dir="rtl">{msg.content}</span>
              </button>
            ))}
          </div>
        ) : (
          <div ref={marqueeTrackRef} className="marquee-track animate-marquee-continuous">
            <div className="marquee-group" ref={marqueeFirstGroupRef}>
              {repeatedMessages.map((msg, idx) => (
                <button
                  type="button"
                  key={`${idx}-${String(msg.id)}`}
                  onClick={() => handleClick(msg)}
                  className={`text-[12px] font-medium flex items-center gap-2 px-3 py-1 rounded-md border transition-colors shrink-0 ${
                    msg.priority === 'High' 
                    ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30' 
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                  } ${msg.action ? 'cursor-pointer' : 'cursor-default'}`}
                  title={msg.action ? 'اضغط لفتح التفاصيل' : undefined}
                >
                  {getIcon(msg.type)}
                  <span dir="rtl">{msg.content}</span>
                </button>
              ))}
            </div>

            {/* Second copy for seamless loop */}
            <div className="marquee-group" ref={marqueeSecondGroupRef} aria-hidden="true">
              {repeatedMessages.map((msg, idx) => (
                <button
                  type="button"
                  key={`dup-${idx}-${String(msg.id)}`}
                  tabIndex={-1}
                  aria-hidden="true"
                  onClick={() => handleClick(msg)}
                  className={`text-[12px] font-medium flex items-center gap-2 px-3 py-1 rounded-md border transition-colors shrink-0 ${
                    msg.priority === 'High' 
                    ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30' 
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                  } ${msg.action ? 'cursor-pointer' : 'cursor-default'}`}
                  title={msg.action ? 'اضغط لفتح التفاصيل' : undefined}
                >
                  {getIcon(msg.type)}
                  <span dir="rtl">{msg.content}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {isCustomizing && onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="absolute top-1 left-1 bg-red-600 text-white p-1 rounded-full z-30 hover:bg-red-700 shadow-sm"
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
};
