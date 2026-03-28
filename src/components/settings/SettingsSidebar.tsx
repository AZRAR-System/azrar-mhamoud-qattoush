import { Shield } from 'lucide-react';
import type { SettingsPageModel } from '@/hooks/useSettingsPage';

type Props = { page: SettingsPageModel };

export function SettingsSidebar({ page }: Props) {
  const { visibleTabs, activeSection, setActiveSection } = page;

  return (
    <div className="w-64 flex-shrink-0 app-card p-2 h-fit">
      {visibleTabs.length > 0 ? (
        visibleTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSection(tab.id)}
            className={`w-full flex items-center gap-3 px-4 py-4 rounded-xl text-right transition-all mb-1 group
                  ${activeSection === tab.id ? 'bg-indigo-50 dark:bg-slate-700 text-indigo-700 dark:text-white shadow-sm ring-1 ring-indigo-100 dark:ring-slate-600' : 'text-slate-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700/50'}`}
          >
            <div
              className={`p-2 rounded-lg transition-colors ${activeSection === tab.id ? 'bg-indigo-200/50 dark:bg-slate-600 text-indigo-700 dark:text-white' : 'bg-gray-100 dark:bg-slate-900 text-slate-500'}`}
            >
              <tab.icon size={18} />
            </div>
            <div>
              <span className="block font-bold text-sm">{tab.label}</span>
              <span className="block text-[10px] opacity-70 font-normal">{tab.desc}</span>
            </div>
          </button>
        ))
      ) : (
        <div className="p-4 text-center text-slate-400 text-sm">
          <Shield size={24} className="mx-auto mb-2 opacity-50" />
          لا تملك صلاحيات للوصول للإعدادات.
        </div>
      )}
    </div>
  );
}
