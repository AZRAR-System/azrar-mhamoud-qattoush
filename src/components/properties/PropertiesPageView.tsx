import { Home } from 'lucide-react';
import { SmartPageHero } from '@/components/shared/SmartPageHero';
import { PageLayout } from '@/components/shared/PageLayout';
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
    <PageLayout>
      <SmartPageHero
        variant="premium"
        title="إدارة العقارات"
        description="إدارة ملفات العقارات والوحدات السكنية والمرافق المرتبطة بنظام أزرار."
        icon={<Home size={32} />}
        stats={[
          {
            label: 'إجمالي العقارات',
            value: page.desktopCounts?.properties ?? page.properties.length,
          },
          {
            label: 'النتائج الحالية',
            value: page.filteredProperties.length,
            color: 'text-indigo-200',
          },
        ]}
      />
      
      <div className="space-y-6">
        <PropertiesImportInput page={page} />
        <PropertiesSmartFilterBar page={page} />
        <PropertiesAdvancedFiltersCard page={page} />

        <div className="page-transition">
          {!listVisible ? <PropertiesEmptyStates page={page} /> : null}
          {listVisible ? <PropertiesCardsGrid page={page} /> : null}
        </div>
      </div>
    </PageLayout>
  );
}
