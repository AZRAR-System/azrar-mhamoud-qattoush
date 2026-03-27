import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { DbService } from '@/services/mockDb';
import { MarqueeMessage } from '@/types';
import { Megaphone, X, AlertTriangle, CheckCircle, Info, Plus, Settings2 } from 'lucide-react';
import { useSmartModal } from '@/context/ModalContext';
import { useAppDialogs } from '@/hooks/useAppDialogs';
import { Button } from '@/components/ui/Button';
import type { PanelType } from '@/context/ModalContext';

export const MarqueeWidget: React.FC<{ isCustomizing?: boolean; onRemove?: () => void }> = ({
  isCustomizing,
  onRemove,
}) => {
  const [messages, setMessages] = useState<MarqueeMessage[]>([]);
  const [repeatFactor, setRepeatFactor] = useState<number>(1);
  const [marqueeShiftPx, setMarqueeShiftPx] = useState<number>(0);
  const { openPanel } = useSmartModal();
  const dialogs = useAppDialogs();
  const lastMessagesSignatureRef = useRef<string>('');
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

    const local = DbService.addMarqueeAd({
      content,
      durationHours,
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

  const marqueeDurationSec = React.useMemo(() => {
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
      if (!isPanelType(action.panel)) return;
      openPanel(action.panel, action.id, action.options);
    }
  };

  return (
    <div className="app-card dark:bg-slate-800 relative mb-6 flex items-center h-12 rounded-2xl overflow-hidden">
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
      `}</style>

      {/* Fixed Icon Area */}
      <div className="px-3 h-full flex items-center gap-2 z-20 shrink-0 border-l border-gray-100 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-900/20">
        <Megaphone size={18} className="text-indigo-600 dark:text-indigo-300" />

        <Button
          variant="secondary"
          onClick={() => openPanel('MARQUEE_ADS')}
          title="تخصيص الإعلانات"
          aria-label="تخصيص الإعلانات"
        >
          <Settings2 size={16} />
        </Button>

        <Button
          variant="secondary"
          onClick={handleAddAd}
          title="إضافة إعلان"
          aria-label="إضافة إعلان"
        >
          <Plus size={16} />
        </Button>
      </div>

      {/* Moving Content Area */}
      <div
        ref={marqueeViewportRef}
        dir="ltr"
        className="flex-1 overflow-hidden relative h-full flex items-center justify-start px-2 mask-image-gradient"
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
                className="text-sm font-bold flex items-center gap-2 px-4 py-1 rounded-xl border"
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
            className="px-4 py-1 rounded-xl bg-gray-50 dark:bg-slate-900/30 border border-gray-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm font-bold"
          >
            لا توجد تنبيهات/مهام عاجلة حالياً — يمكنك إضافة إعلان من زر +
          </div>
        ) : (
          <div ref={marqueeTrackRef} className="marquee-track animate-marquee-continuous">
            <div className="marquee-group" ref={marqueeFirstGroupRef}>
              {repeatedMessages.map((msg, idx) => (
                <button
                  type="button"
                  key={`${idx}-${String(msg.id)}`}
                  onClick={() => handleClick(msg)}
                  className={`text-sm font-bold flex items-center gap-2 px-4 py-1 rounded-xl border ${msg.priority === 'High' ? 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-900/30 text-red-700 dark:text-red-200' : 'bg-gray-50 dark:bg-slate-900/30 border-gray-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'} ${msg.action ? 'cursor-pointer hover:opacity-90' : 'cursor-default'}`}
                  title={msg.action ? 'اضغط لفتح التفاصيل' : undefined}
                >
                  {getIcon(msg.type)}
                  <span dir="rtl">{msg.content}</span>
                </button>
              ))}
            </div>

            {/* Second copy to make the loop seamless (not focusable to avoid duplicate keyboard navigation) */}
            <div className="marquee-group" ref={marqueeSecondGroupRef} aria-hidden="true">
              {repeatedMessages.map((msg, idx) => (
                <button
                  type="button"
                  key={`dup-${idx}-${String(msg.id)}`}
                  tabIndex={-1}
                  aria-hidden="true"
                  onClick={() => handleClick(msg)}
                  className={`text-sm font-bold flex items-center gap-2 px-4 py-1 rounded-xl border ${msg.priority === 'High' ? 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-900/30 text-red-700 dark:text-red-200' : 'bg-gray-50 dark:bg-slate-900/30 border-gray-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'} ${msg.action ? 'cursor-pointer hover:opacity-90' : 'cursor-default'}`}
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
