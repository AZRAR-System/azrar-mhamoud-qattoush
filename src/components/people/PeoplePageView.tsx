import { Users } from 'lucide-react';
import { PeopleImportInput } from '@/components/people/PeopleImportInput';
import { PeopleSmartFilterBar } from '@/components/people/PeopleSmartFilterBar';
import { PeopleAdvancedFiltersCard } from '@/components/people/PeopleAdvancedFiltersCard';
import { PeopleEmptyStates } from '@/components/people/PeopleEmptyStates';
import { PeopleCardsGrid } from '@/components/people/PeopleCardsGrid';
import { PageHero } from '@/components/shared/PageHero';
import type { PeoplePageModel } from '@/hooks/usePeople';

type Props = { page: PeoplePageModel };

export function PeoplePageView({ page }: Props) {
  const { listVisible, t } = page;

  return (
    <div className="space-y-6 animate-fade-in">
      <PeopleImportInput page={page} />
      <PageHero
        icon={<Users size={28} />}
        iconVariant="featured"
        title={t('إدارة الأشخاص')}
        subtitle={t('سجل العملاء، الملاك، والمستأجرين')}
      />
      <PeopleSmartFilterBar page={page} />
      <PeopleAdvancedFiltersCard page={page} />

      {!listVisible ? <PeopleEmptyStates page={page} /> : null}
      {listVisible ? <PeopleCardsGrid page={page} /> : null}
    </div>
  );
}
