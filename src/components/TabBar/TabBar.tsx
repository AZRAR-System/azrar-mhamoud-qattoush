import React, { useRef, useEffect } from 'react';
import { useTabs } from '@/context/TabsContext';
import { X, Pin, LayoutGrid } from 'lucide-react';
import { ROUTE_ICONS } from '@/routes/registry';
import { useNotificationCenter } from '@/hooks/useNotificationCenter';
import { ROUTE_PATHS } from '@/routes/paths';

export const TabBar: React.FC = () => {
  const { tabs, activeTabId, closeTab, switchTab, pinTab, reorderTabs } = useTabs();
  const { unreadCount } = useNotificationCenter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [draggingIdx, setDraggingIdx] = React.useState<number | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      const activeEl = scrollRef.current.querySelector(`[data-id="${activeTabId}"]`);
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [activeTabId]);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggingIdx(index);
    e.dataTransfer.setData('tabIndex', index.toString());
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => setDraggingIdx(null);

  const handleDrop = (e: React.DragEvent, toIndex: number) => {
    setDraggingIdx(null);
    const fromIndex = parseInt(e.dataTransfer.getData('tabIndex'), 10);
    if (!isNaN(fromIndex) && fromIndex !== toIndex) reorderTabs(fromIndex, toIndex);
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (scrollRef.current) scrollRef.current.scrollLeft += e.deltaY;
  };

  return (
    <div className="mx-4 lg:mx-6 mt-3 flex items-center bg-slate-950/40 backdrop-blur-2xl border border-white/5 rounded-2xl px-2 h-[52px] select-none shadow-2xl shadow-black/40">
      <div
        ref={scrollRef}
        onWheel={handleWheel}
        className="flex-1 flex items-center overflow-x-auto no-scrollbar gap-2 h-full py-1.5 flex-nowrap min-w-0"
      >
        {tabs.map((tab, idx) => {
          const isActive = tab.id === activeTabId;
          const isDragging = idx === draggingIdx;
          const Icon = ROUTE_ICONS[tab.path];
          const isAlertsTab = tab.path === ROUTE_PATHS.ALERTS;
          const showBadge = isAlertsTab && unreadCount > 0;

          return (
            <div
              key={tab.id}
              data-id={tab.id}
              draggable
              onDragStart={(e) => handleDragStart(e, idx)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDrop(e, idx)}
              onClick={() => switchTab(tab.id)}
              title={tab.title}
              className={`
                group relative flex items-center gap-2.5 px-3.5 h-10 min-w-[110px] max-w-[190px] rounded-xl transition-all duration-300 cursor-pointer flex-shrink-0
                ${isActive
                  ? 'bg-gradient-to-br from-indigo-600/90 via-indigo-600 to-violet-600/90 text-white shadow-lg shadow-indigo-600/20 ring-1 ring-white/20'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-100 border border-transparent hover:border-white/5'}
                ${isDragging ? 'opacity-20 scale-95 blur-[1px]' : 'opacity-100'}
                hover:pl-11
              `}
            >
              {/* Tab Icon */}
              <div className={`p-1.5 rounded-lg flex-shrink-0 transition-colors ${isActive ? 'bg-white/20 shadow-inner' : 'bg-slate-800/40 group-hover:bg-slate-700/50'}`}>
                {Icon ? (
                  <Icon size={14} strokeWidth={2.5} className={isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'} />
                ) : (
                  <span className="text-[10px] font-bold">{tab.icon || '📄'}</span>
                )}
              </div>

              {/* Tab Title */}
              <span className={`text-[13px] font-bold truncate flex-1 transition-all ${isActive ? 'text-white antialiased' : 'group-hover:text-slate-100'}`}>
                {tab.title}
              </span>

              {/* Alerts Badge */}
              {showBadge && (
                <span className="flex-shrink-0 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[9px] font-black rounded-full px-1 shadow-lg ring-2 ring-slate-900 ring-offset-0">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}

              {/* Modified Indicator */}
              {tab.isModified && !showBadge && (
                <span className="w-2 h-2 bg-amber-400 rounded-full shadow-[0_0_8px_rgba(251,191,36,0.5)] animate-pulse" />
              )}

              {/* Control Buttons (Close/Pin) - Positioned at the end (left in RTL) */}
              <div className="absolute left-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200 translate-x-1 group-hover:translate-x-0">
                <button
                  onClick={(e) => { e.stopPropagation(); pinTab(tab.id); }}
                  className={`p-1 rounded-md transition-all ${isActive ? 'hover:bg-white/20' : 'hover:bg-slate-700'} ${tab.isPinned ? (isActive ? 'text-yellow-300' : 'text-indigo-400') : 'text-slate-500 hover:text-slate-200'}`}
                  title={tab.isPinned ? 'إلغاء التثبيت' : 'تثبيت التبويب'}
                >
                  <Pin size={11} className={tab.isPinned ? 'fill-current' : ''} />
                </button>

                {!tab.isPinned && (
                  <button
                    onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
                    className={`p-1 rounded-md transition-all ${isActive ? 'hover:bg-white/20' : 'hover:bg-red-500/20 hover:text-red-400'}`}
                    title="إغلاق"
                  >
                    <X size={11} />
                  </button>
                )}
              </div>

              {/* Pin Indicator (when not hovered) */}
              {tab.isPinned && (
                <div className="absolute -top-1.5 -left-1.5 w-4 h-4 bg-indigo-600 rounded-full flex items-center justify-center shadow-lg border border-white/20 group-hover:opacity-0 transition-opacity">
                  <Pin size={8} className="text-white fill-current" />
                </div>
              )}

              {/* Active Underline */}
              {isActive && (
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/2 h-0.5 bg-white/40 rounded-full blur-[0.5px]" />
              )}
            </div>
          );
        })}

        <button
          className="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-white/5 text-slate-500 hover:text-white hover:bg-indigo-600/40 border border-white/5 hover:border-indigo-500/40 rounded-xl transition-all duration-300 group shadow-lg"
          onClick={() => window.dispatchEvent(new CustomEvent('azrar:open-page-selector'))}
          title="فتح صفحة جديدة (Ctrl+T)"
        >
          <LayoutGrid size={18} className="group-hover:scale-110 group-hover:rotate-12 transition-transform duration-300" />
        </button>
      </div>
    </div>
  );
};
