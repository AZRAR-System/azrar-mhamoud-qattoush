import React, { useRef, useEffect } from 'react';
import { useTabs } from '@/context/TabsContext';
import { X, Pin, Plus, LayoutGrid } from 'lucide-react';
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
    <div className="mx-4 lg:mx-6 mt-2 flex items-center bg-slate-900/50 backdrop-blur-md border border-white/5 rounded-2xl px-2 h-12 select-none shadow-xl shadow-black/30">
      <div
        ref={scrollRef}
        onWheel={handleWheel}
        className="flex-1 flex items-center overflow-x-auto no-scrollbar gap-1.5 h-full py-1.5 flex-nowrap min-w-0"
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
                group relative flex items-center gap-2 px-3 h-9 min-w-[100px] max-w-[170px] rounded-xl
                transition-all duration-200 cursor-pointer flex-shrink-0
                ${isActive
                  ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-600/30 scale-[1.02]'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'}
                ${isDragging ? 'opacity-20 scale-90' : 'opacity-100'}
              `}
            >
              {/* أيقونة التبويب */}
              <div className={`flex-shrink-0 p-1 rounded-lg ${isActive ? 'bg-white/20' : 'bg-slate-800/50'}`}>
                {Icon
                  ? <Icon size={13} strokeWidth={2.5} />
                  : <span className="text-xs">{tab.icon}</span>
                }
              </div>

              {/* عنوان التبويب */}
              <span className={`text-[12px] font-semibold truncate flex-1 ${isActive ? 'text-white' : ''}`}>
                {tab.title}
              </span>

              {/* Badge للتنبيهات */}
              {showBadge && (
                <span className="flex-shrink-0 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full px-1 shadow-md">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}

              {/* مؤشر التعديل */}
              {tab.isModified && !showBadge && (
                <span className="flex-shrink-0 w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" />
              )}

              {/* أزرار Pin وإغلاق */}
              <div className="absolute left-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => { e.stopPropagation(); pinTab(tab.id); }}
                  className={`p-0.5 rounded transition-colors ${isActive ? 'hover:bg-white/20' : 'hover:bg-slate-700'} ${tab.isPinned ? (isActive ? 'text-yellow-300' : 'text-indigo-400') : 'text-slate-500'}`}
                >
                  <Pin size={10} className={tab.isPinned ? 'fill-current' : ''} />
                </button>
                {!tab.isPinned && (
                  <button
                    onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
                    className={`p-0.5 rounded transition-colors ${isActive ? 'hover:bg-white/20' : 'hover:bg-red-500/20 hover:text-red-400'}`}
                  >
                    <X size={10} />
                  </button>
                )}
              </div>

              {/* مؤشر Pin */}
              {tab.isPinned && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-indigo-500 rounded-full flex items-center justify-center shadow-sm">
                  <Pin size={7} className="text-white fill-current" />
                </div>
              )}
            </div>
          );
        })}

        {/* زر فتح صفحة جديدة */}
        <button
          className="flex-shrink-0 w-9 h-9 flex items-center justify-center bg-white/5 text-slate-500 hover:text-white hover:bg-indigo-600/30 border border-white/5 hover:border-indigo-500/40 rounded-xl transition-all duration-200 group"
          onClick={() => window.dispatchEvent(new CustomEvent('azrar:open-page-selector'))}
          title="فتح صفحة جديدة (Ctrl+T)"
        >
          <LayoutGrid size={16} className="group-hover:scale-110 transition-transform" />
        </button>
      </div>
    </div>
  );
};
