import { Button } from '@/components/ui/Button';
import type { ContractsPageModel } from '@/hooks/useContracts';

type Props = { page: ContractsPageModel };

export function ContractsWebListToolbar({ page }: Props) {
  const {
    t,
    isDesktopFast,
    filteredContracts,
    uiPage,
    setUiPage,
    uiPageCount,
  } = page;

  if (isDesktopFast) return null;

  return (
    <div className="flex items-center justify-between mb-3">
      <div className="text-sm text-slate-500 dark:text-slate-400">
        {filteredContracts.length.toLocaleString()} {t('نتيجة')}
      </div>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          disabled={uiPage <= 0}
          onClick={() => setUiPage((p) => Math.max(0, p - 1))}
        >
          {t('السابق')}
        </Button>
        <div className="text-sm text-slate-600 dark:text-slate-300">
          {uiPage + 1} / {uiPageCount}
        </div>
        <Button
          size="sm"
          variant="secondary"
          disabled={uiPage + 1 >= uiPageCount}
          onClick={() => setUiPage((p) => Math.min(Math.max(0, uiPageCount - 1), p + 1))}
        >
          {t('التالي')}
        </Button>
      </div>
    </div>
  );
}
