import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { SettingsPageModel } from '@/hooks/useSettingsPage';

type Props = { page: SettingsPageModel };

export function SettingsLoadErrorPanel({ page }: Props) {
  const { settingsLoading, activeSection, settings, loadSettings } = page;

  if (
    settingsLoading ||
    !(
      activeSection === 'general' ||
      activeSection === 'messages' ||
      activeSection === 'commissions'
    ) ||
    settings
  ) {
    return null;
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
      <div className="w-14 h-14 rounded-2xl bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-800/30 flex items-center justify-center mb-4">
        <AlertTriangle className="text-red-600" size={24} />
      </div>
      <div className="text-slate-700 dark:text-slate-200 font-bold">تعذر تحميل إعدادات النظام</div>
      <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">
        اضغط إعادة المحاولة لإعادة تحميل البيانات.
      </div>
      <div className="mt-5">
        <Button variant="secondary" onClick={loadSettings}>
          إعادة المحاولة
        </Button>
      </div>
    </div>
  );
}
