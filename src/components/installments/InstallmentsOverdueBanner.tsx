import type { InstallmentsPageModel } from '@/hooks/useInstallments';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/Button';

type Props = { page: InstallmentsPageModel };

export function InstallmentsOverdueBanner({ page }: Props) {
  const { isDesktopFast, financialStats, setFilter } = page;

  return (
    <>
      {!isDesktopFast && financialStats && financialStats.overdueCount > 0 && (
        <div className="app-card p-4 md:p-5 bg-rose-50/90 dark:bg-rose-950/30 border-rose-200/80 dark:border-rose-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-rose-600 rounded-xl text-white">
              <AlertTriangle size={20} />
            </div>
            <div>
              <h4 className="text-sm font-black text-rose-800 dark:text-rose-300">
                تنبيه تحصيل: يوجد {financialStats.overdueCount} دفعات متأخرة
              </h4>
              <p className="text-xs text-rose-600 dark:text-rose-400">
                إجمالي المبالغ المتأخرة المستحقة حالياً:{' '}
                {financialStats.totalOverdue.toLocaleString()} د.أ
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="secondary"
            className="bg-rose-600 hover:bg-rose-700 text-white border-none rounded-xl text-xs"
            onClick={() => setFilter('debt')}
          >
            عرض المتأخرات فقط
          </Button>
        </div>
      )}
    </>
  );
}
