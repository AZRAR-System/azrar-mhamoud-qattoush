import { Home } from 'lucide-react';
import { SmartPageHero } from '@/components/shared/SmartPageHero';
import { PropertiesImportInput } from '@/components/properties/PropertiesImportInput';
import { PropertiesSmartFilterBar } from '@/components/properties/PropertiesSmartFilterBar';
import { PropertiesAdvancedFiltersCard } from '@/components/properties/PropertiesAdvancedFiltersCard';
import { PropertiesEmptyStates } from '@/components/properties/PropertiesEmptyStates';
import { PropertiesCardsGrid } from '@/components/properties/PropertiesCardsGrid';
import type { PropertiesPageModel } from '@/hooks/useProperties';

type Props = { page: PropertiesPageModel };

export function PropertiesPageView({ page }: Props) {
  const { listVisible } = page;

  return (
    <div className="space-y-6">
      <SmartPageHero
        title="إدارة العقارات"
        description="إدارة ملفات العقارات والوحدات السكنية والمرافق المرتبطة."
        icon={Home}
        iconColor="text-emerald-600 dark:text-emerald-400"
        iconBg="bg-emerald-50 dark:bg-emerald-950/40"
        stats={[
          {
            label: 'إجمالي العقارات',
            value: page.desktopCounts?.properties ?? page.properties.length,
          },
          {
            label: 'النتائج الحالية',
            value: page.filteredProperties.length,
            color: 'text-emerald-600',
          },
        ]}
      />
      <PropertiesImportInput page={page} />
      <PropertiesSmartFilterBar page={page} />
      <PropertiesAdvancedFiltersCard page={page} />

      {!listVisible ? <PropertiesEmptyStates page={page} /> : null}
      {listVisible ? <PropertiesCardsGrid page={page} /> : null}
    </div>
  );
}
