import React from 'react';
import { CheckCheck, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { useAlerts } from '@/hooks/useAlerts';

export type AlertBulkActionsProps = {
  page: ReturnType<typeof useAlerts>;
};

export const AlertBulkActions: React.FC<AlertBulkActionsProps> = ({ page }) => {
  const { bulkSelectedIds, handleBulkMarkRead, clearBulkSelection } = page;
  const n = bulkSelectedIds.size;
  if (n === 0) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-[2040] flex -translate-x-1/2 flex-wrap items-center gap-3 rounded-xl border border-slate-200/90 bg-white/95 px-4 py-2.5 shadow-lg shadow-slate-900/10 backdrop-blur-md dark:border-slate-700 dark:bg-slate-900/95 dark:shadow-black/40">
      <span className="text-xs font-black text-slate-700 dark:text-slate-200">
        محدد: {n}
      </span>
      <Button
        type="button"
        variant="primary"
        size="sm"
        className="font-black text-xs"
        leftIcon={<CheckCheck size={14} />}
        onClick={() => void handleBulkMarkRead()}
      >
        تعليم كمقروء
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="font-black text-xs text-slate-500"
        leftIcon={<X size={14} />}
        onClick={clearBulkSelection}
      >
        إلغاء التحديد
      </Button>
    </div>
  );
};
