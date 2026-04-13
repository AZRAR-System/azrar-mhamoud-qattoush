import React, { useRef, useEffect } from 'react';
import { useTabs } from '@/context/TabsContext';
import { X, Pin, Plus } from 'lucide-react';
import { ROUTE_ICONS } from '@/routes/registry';

export const TabBar: React.FC = () => {
    const { tabs, activeTabId, closeTab, switchTab, pinTab, reorderTabs } = useTabs();
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to active tab
    useEffect(() => {
        if (scrollRef.current) {
            const activeEl = scrollRef.current.querySelector(`[data-id="${activeTabId}"]`);
            if (activeEl) {
                activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            }
        }
    }, [activeTabId]);

    const handleDragStart = (e: React.DragEvent, index: number) => {
        e.dataTransfer.setData('tabIndex', index.toString());
    };

    const handleDrop = (e: React.DragEvent, toIndex: number) => {
        const fromIndex = parseInt(e.dataTransfer.getData('tabIndex'), 10);
        if (fromIndex !== toIndex) {
            reorderTabs(fromIndex, toIndex);
        }
    };

    const handleWheel = (e: React.WheelEvent) => {
        if (scrollRef.current) {
            scrollRef.current.scrollLeft += e.deltaY;
        }
    };

    return (
        <div className="mx-4 lg:mx-8 mt-2 flex items-center bg-slate-900/40 backdrop-blur-md border border-white/5 rounded-2xl px-3 h-14 select-none shadow-2xl shadow-black/20">
            <div 
                ref={scrollRef}
                onWheel={handleWheel}
                className="flex-1 flex items-center overflow-x-auto no-scrollbar gap-2 h-full py-2 flex-nowrap min-w-0"
            >
                {tabs.map((tab, idx) => {
                    const isActive = tab.id === activeTabId;
                    const Icon = ROUTE_ICONS[tab.path];
                    
                    return (
                        <div
                            key={tab.id}
                            data-id={tab.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, idx)}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => handleDrop(e, idx)}
                            onClick={() => switchTab(tab.id)}
                            className={`
                                group relative flex items-center gap-2.5 px-3 h-10 min-w-[110px] max-w-[180px] rounded-xl transition-all duration-300 cursor-pointer flex-shrink-0
                                ${isActive 
                                    ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-lg shadow-indigo-600/20' 
                                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-100'}
                            `}
                        >
                            <div className={`p-1 rounded-lg ${isActive ? 'bg-white/20' : 'bg-slate-800/40'}`}>
                                {Icon ? <Icon size={14} strokeWidth={2.5} /> : <span className="text-xs">{tab.icon}</span>}
                            </div>
                            
                            <span className={`text-[13px] font-bold truncate flex-1 ${isActive ? 'text-white' : ''}`}>
                                {tab.title}
                            </span>
                            
                            {tab.isModified && (
                                <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-slate-900 animate-pulse" />
                            )}

                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={(e) => { e.stopPropagation(); pinTab(tab.id); }}
                                    className={`p-1 rounded-lg transition-colors ${isActive ? 'hover:bg-white/20' : 'hover:bg-slate-700'} ${tab.isPinned ? (isActive ? 'text-white' : 'text-indigo-400') : 'text-slate-500'}`}
                                >
                                    <Pin size={12} className={tab.isPinned ? 'fill-current' : ''} />
                                </button>
                                
                                {(!tab.isPinned && tab.id !== 'home') && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
                                        className={`p-1 rounded-lg transition-colors ${isActive ? 'hover:bg-white/20' : 'hover:bg-red-500/20 hover:text-red-400'}`}
                                    >
                                        <X size={12} />
                                    </button>
                                )}
                            </div>

                            {tab.isPinned && !tab.id.includes('home') && (
                                <div className="absolute -top-1 -left-1">
                                    <Pin size={10} className="text-indigo-400 fill-current" />
                                </div>
                            )}
                        </div>
                    );
                })}

                <button 
                    className="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-white/5 text-slate-400 hover:text-white hover:bg-indigo-600/20 hover:border-indigo-500/30 border border-transparent rounded-xl transition-all"
                    onClick={() => {
                        window.dispatchEvent(new CustomEvent('azrar:open-page-selector'));
                    }}
                    title="فتح صفحة جديدة (Ctrl+T)"
                >
                    <Plus size={20} />
                </button>
            </div>
        </div>
    );
};
