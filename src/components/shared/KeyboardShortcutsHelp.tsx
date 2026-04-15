import React from 'react';
import { Command, Keyboard, X } from 'lucide-react';

interface Props {
  onClose: () => void;
}

export const KeyboardShortcutsHelp: React.FC<Props> = ({ onClose }) => {
  const shortcutGroups = [
    {
      title: 'عام',
      items: [
        { keys: ['Ctrl', 'K'], label: 'بحث سريع وشامل' },
        { keys: ['Ctrl', '?'], label: 'عرض قائمة الاختصارات' },
        { keys: ['Escape'], label: 'إغلاق النافذة / اللوحة الحالية' },
      ],
    },
    {
      title: 'إدارة التبويبات',
      items: [
        { keys: ['Ctrl', 'Tab'], label: 'التبويب التالي' },
        { keys: ['Ctrl', 'Shift', 'Tab'], label: 'التبويب السابق' },
        { keys: ['Ctrl', 'W'], label: 'إغلاق التبويب الحالي' },
        { keys: ['Ctrl', 'T'], label: 'اختيار صفحة سريعة' },
      ],
    },
    {
      title: 'إجراءات سريعة',
      items: [
        { keys: ['Ctrl', 'N'], label: 'إضافة جديد (عقد، شخص، عقار)' },
      ],
    },
  ];

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950/20" dir="rtl">
      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
        <div className="max-w-xl mx-auto space-y-8">
          {shortcutGroups.map((group, idx) => (
            <div key={idx} className="space-y-4">
              <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                {group.title}
              </h3>
              
              <div className="grid gap-3">
                {group.items.map((item, itemIdx) => (
                  <div 
                    key={itemIdx} 
                    className="flex items-center justify-between p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 shadow-sm"
                  >
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                      {item.label}
                    </span>
                    
                    <div className="flex items-center gap-1">
                      {item.keys.map((key, keyIdx) => (
                        <React.Fragment key={keyIdx}>
                          <kbd className="min-w-[2.5rem] h-8 flex items-center justify-center px-2 rounded-lg bg-slate-100 dark:bg-slate-800 border-b-2 border-slate-300 dark:border-slate-700 text-xs font-black text-slate-600 dark:text-slate-400 font-mono shadow-sm">
                            {key === 'Shift' ? '⇧' : key === 'Tab' ? '⇥' : key}
                          </kbd>
                          {keyIdx < item.keys.length - 1 && (
                            <span className="text-slate-300 dark:text-slate-700 font-bold px-0.5">+</span>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer Info */}
      <div className="p-6 text-center border-t border-slate-100 dark:border-slate-800 bg-white/50 dark:bg-slate-900/40">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 text-[10px] font-black uppercase tracking-wider">
          <Command size={14} />
          <span>هذه الاختصارات تعمل على جميع شاشات النظام</span>
        </div>
      </div>
    </div>
  );
};
