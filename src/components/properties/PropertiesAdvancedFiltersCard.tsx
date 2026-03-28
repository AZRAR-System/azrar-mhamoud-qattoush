import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { CurrencySuffix } from '@/components/ui/CurrencySuffix';
import type { ContractLinkFilter } from '@/components/properties/propertiesTypes';
import type { PropertiesPageModel } from '@/hooks/useProperties';

const advInputClass =
  'w-full py-3 px-4 bg-slate-50/70 dark:bg-slate-950/30 border border-slate-200/80 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/35 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-950 transition text-sm text-slate-900 dark:text-white placeholder-slate-400';
const advLabelClass = 'block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1';

type Props = { page: PropertiesPageModel };

export function PropertiesAdvancedFiltersCard({ page }: Props) {
  const { t, showAdvanced, setAdvFilters, advFilters } = page;

  if (!showAdvanced) return null;

  return (
    <Card className="p-5 mb-6 animate-slide-up bg-indigo-50/50 dark:bg-slate-900/40 border-indigo-100/80 dark:border-slate-800">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <div className="font-bold text-slate-800 dark:text-white">{t('تصفية متقدمة')}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {t('فلترة حسب المساحة والسعر والطابق')}
          </div>
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={() =>
            setAdvFilters({
              minArea: '',
              maxArea: '',
              minPrice: '',
              maxPrice: '',
              floor: '',
              contractLink: 'all',
            })
          }
        >
          {t('إعادة ضبط')}
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        <div>
          <label className={advLabelClass}>{t('المساحة (من)')}</label>
          <input
            inputMode="numeric"
            type="number"
            placeholder="0"
            className={advInputClass}
            value={advFilters.minArea}
            onChange={(e) => setAdvFilters({ ...advFilters, minArea: e.target.value })}
          />
        </div>
        <div>
          <label className={advLabelClass}>{t('المساحة (إلى)')}</label>
          <input
            inputMode="numeric"
            type="number"
            placeholder="0"
            className={advInputClass}
            value={advFilters.maxArea}
            onChange={(e) => setAdvFilters({ ...advFilters, maxArea: e.target.value })}
          />
        </div>
        <div>
          <label className={advLabelClass}>{t('السعر (من)')}</label>
          <div className="relative">
            <input
              inputMode="numeric"
              type="number"
              dir="ltr"
              placeholder="0"
              className={`${advInputClass} pr-10`}
              value={advFilters.minPrice}
              onChange={(e) => setAdvFilters({ ...advFilters, minPrice: e.target.value })}
              aria-label={t('السعر من')}
              title={t('السعر من')}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 select-none">
              <CurrencySuffix />
            </span>
          </div>
        </div>
        <div>
          <label className={advLabelClass}>{t('السعر (إلى)')}</label>
          <div className="relative">
            <input
              inputMode="numeric"
              type="number"
              dir="ltr"
              placeholder="0"
              className={`${advInputClass} pr-10`}
              value={advFilters.maxPrice}
              onChange={(e) => setAdvFilters({ ...advFilters, maxPrice: e.target.value })}
              aria-label={t('السعر إلى')}
              title={t('السعر إلى')}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 select-none">
              <CurrencySuffix />
            </span>
          </div>
        </div>
        <div>
          <label className={advLabelClass}>{t('الطابق')}</label>
          <input
            type="text"
            placeholder={t('مثال: 3')}
            className={advInputClass}
            value={advFilters.floor}
            onChange={(e) => setAdvFilters({ ...advFilters, floor: e.target.value })}
          />
        </div>

        <div>
          <label className={advLabelClass}>{t('الارتباط بالعقد')}</label>
          <select
            className={advInputClass}
            value={advFilters.contractLink}
            onChange={(e) =>
              setAdvFilters({
                ...advFilters,
                contractLink: e.target.value as ContractLinkFilter,
              })
            }
            aria-label={t('الارتباط بالعقد')}
            title={t('الارتباط بالعقد')}
          >
            <option value="all">{t('الكل')}</option>
            <option value="linked">{t('مرتبط بعقد')}</option>
            <option value="unlinked">{t('غير مرتبط بعقد')}</option>
          </select>
        </div>
      </div>
    </Card>
  );
}
