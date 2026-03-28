import React from 'react';
import { PeopleImportInput } from '@/components/people/PeopleImportInput';
import { PeopleSmartFilterBar } from '@/components/people/PeopleSmartFilterBar';
import { PeopleAdvancedFiltersCard } from '@/components/people/PeopleAdvancedFiltersCard';
import { PeopleEmptyStates } from '@/components/people/PeopleEmptyStates';
import { PeopleCardsGrid } from '@/components/people/PeopleCardsGrid';
import type { PeoplePageModel } from '@/hooks/usePeople';

type Props = { page: PeoplePageModel };

export function PeoplePageView({ page }: Props) {
  const { listVisible } = page;

  return (
    <div className="space-y-6">
      <PeopleImportInput page={page} />
      <PeopleSmartFilterBar page={page} />
      <PeopleAdvancedFiltersCard page={page} />

      {!listVisible ? <PeopleEmptyStates page={page} /> : null}
      {listVisible ? <PeopleCardsGrid page={page} /> : null}
    </div>
  );
}
