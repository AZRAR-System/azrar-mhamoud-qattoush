import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import type { PeoplePageModel } from '@/hooks/usePeople';

type Props = { page: PeoplePageModel };

export function PeopleAdvancedFiltersCard({ page }: Props) {
  const { t, showAdvanced, advFilters, setAdvFilters } = page;

  if (!showAdvanced) return null;

  return (
    <Card className="p-4 mb-6 grid grid-cols-1 md:grid-cols-4 gap-4 animate-slide-up bg-indigo-50/50 dark:bg-slate-900/40 border-indigo-100/80 dark:border-slate-800">
      <Input
        placeholder={t('العنوان (يحتوي على)')}
        value={advFilters.address}
        onChange={(e) => setAdvFilters({ ...advFilters, address: e.target.value })}
      />
      <Input
        placeholder={t('الرقم الوطني')}
        value={advFilters.nationalId}
        onChange={(e) => setAdvFilters({ ...advFilters, nationalId: e.target.value })}
      />
      <Select
        value={advFilters.classification}
        onChange={(e) => setAdvFilters({ ...advFilters, classification: e.target.value })}
        options={[
          { value: 'All', label: t('كل التصنيفات') },
          { value: 'VIP', label: 'VIP' },
          { value: 'Standard', label: 'Standard' },
        ]}
      />
      <Select
        value={String(advFilters.minRating)}
        onChange={(e) => setAdvFilters({ ...advFilters, minRating: Number(e.target.value) })}
        options={[
          { value: '0', label: t('كل التقييمات') },
          { value: '3', label: t('3 نجوم فأكثر') },
          { value: '4', label: t('4 نجوم فأكثر') },
          { value: '5', label: t('5 نجوم فقط') },
        ]}
      />
    </Card>
  );
}
