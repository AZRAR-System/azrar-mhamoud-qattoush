import { Users } from 'lucide-react';
import { PeopleImportInput } from '@/components/people/PeopleImportInput';
import { PeopleSmartFilterBar } from '@/components/people/PeopleSmartFilterBar';
import { PeopleAdvancedFiltersCard } from '@/components/people/PeopleAdvancedFiltersCard';
import { PeopleEmptyStates } from '@/components/people/PeopleEmptyStates';
import { PeopleCardsGrid } from '@/components/people/PeopleCardsGrid';
import { SmartPageHero } from '@/components/shared/SmartPageHero';
import { PageLayout } from '@/components/shared/PageLayout';
import type { PeoplePageModel } from '@/hooks/usePeople';

type Props = { page: PeoplePageModel };

export function PeoplePageView({ page }: Props) {
  const { listVisible, t } = page;

  return (
    <PageLayout>
      <PeopleImportInput page={page} />
      
      <SmartPageHero
        variant="premium"
        icon={<Users size={32} />}
        title={t('إدارة الأشخاص')}
        description={t('سجل العملاء، الملاك، والمستأجرين في نظام أزرار')}
      />

      <div className="space-y-6">
        <PeopleSmartFilterBar page={page} />
        <PeopleAdvancedFiltersCard page={page} />

        <div className="page-transition">
          {!listVisible ? <PeopleEmptyStates page={page} /> : null}
          {listVisible ? <PeopleCardsGrid page={page} /> : null}
        </div>
      </div>
    </PageLayout>
  );
}
