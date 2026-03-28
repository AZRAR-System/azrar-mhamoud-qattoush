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
      <PropertiesImportInput page={page} />
      <PropertiesSmartFilterBar page={page} />
      <PropertiesAdvancedFiltersCard page={page} />

      {!listVisible ? <PropertiesEmptyStates page={page} /> : null}
      {listVisible ? <PropertiesCardsGrid page={page} /> : null}
    </div>
  );
}
