import { Card } from '@/components/ui/Card';
import { CurrencySuffix } from '@/components/ui/CurrencySuffix';
import type { ContractsPageModel } from '@/hooks/useContracts';

type Props = { page: ContractsPageModel };

export function ContractsAdvancedFiltersCard({ page }: Props) {
  const { t, showAdvanced, advFilters, setAdvFilters } = page;

  if (!showAdvanced) return null;

  return (
    <Card className="p-4 mb-6 grid grid-cols-1 md:grid-cols-4 gap-4 animate-slide-up bg-indigo-50/50 dark:bg-slate-800/50 border-indigo-100 dark:border-slate-700">
      <div>
        <label className="text-xs font-bold block mb-1">{t('تاريخ البداية (من - إلى)')}</label>
        <div className="flex gap-2">
          <input
            type="date"
            className="p-2 rounded border w-full text-xs"
            value={advFilters.startDateFrom}
            onChange={(e) => setAdvFilters({ ...advFilters, startDateFrom: e.target.value })}
            aria-label={t('تاريخ البداية من')}
            title={t('تاريخ البداية من')}
          />
          <input
            type="date"
            className="p-2 rounded border w-full text-xs"
            value={advFilters.startDateTo}
            onChange={(e) => setAdvFilters({ ...advFilters, startDateTo: e.target.value })}
            aria-label={t('تاريخ البداية إلى')}
            title={t('تاريخ البداية إلى')}
          />
        </div>
      </div>
      <div>
        <label className="text-xs font-bold block mb-1">{t('تاريخ النهاية (من - إلى)')}</label>
        <div className="flex gap-2">
          <input
            type="date"
            className="p-2 rounded border w-full text-xs"
            value={advFilters.endDateFrom}
            onChange={(e) => setAdvFilters({ ...advFilters, endDateFrom: e.target.value })}
            aria-label={t('تاريخ النهاية من')}
            title={t('تاريخ النهاية من')}
          />
          <input
            type="date"
            className="p-2 rounded border w-full text-xs"
            value={advFilters.endDateTo}
            onChange={(e) => setAdvFilters({ ...advFilters, endDateTo: e.target.value })}
            aria-label={t('تاريخ النهاية إلى')}
            title={t('تاريخ النهاية إلى')}
          />
        </div>
      </div>
      <div>
        <label className="text-xs font-bold block mb-1">{t('القيمة (من - إلى)')}</label>
        <div className="flex gap-2">
          <div className="relative w-full">
            <input
              type="number"
              dir="ltr"
              placeholder="min"
              className="p-2 pr-10 rounded border w-full text-xs"
              value={advFilters.minValue}
              onChange={(e) => setAdvFilters({ ...advFilters, minValue: e.target.value })}
              aria-label={t('القيمة من')}
              title={t('القيمة من')}
            />
            <span className="absolute right-2 top-2 text-[10px] font-bold text-slate-400 select-none">
              <CurrencySuffix />
            </span>
          </div>
          <div className="relative w-full">
            <input
              type="number"
              dir="ltr"
              placeholder="max"
              className="p-2 pr-10 rounded border w-full text-xs"
              value={advFilters.maxValue}
              onChange={(e) => setAdvFilters({ ...advFilters, maxValue: e.target.value })}
              aria-label={t('القيمة إلى')}
              title={t('القيمة إلى')}
            />
            <span className="absolute right-2 top-2 text-[10px] font-bold text-slate-400 select-none">
              <CurrencySuffix />
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}
