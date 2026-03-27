import React from 'react';
import { ContractsImportInput } from '@/components/contracts/ContractsImportInput';
import { ContractsSmartFilterBar } from '@/components/contracts/ContractsSmartFilterBar';
import { ContractsAdvancedFiltersCard } from '@/components/contracts/ContractsAdvancedFiltersCard';
import { ContractsEmptyStates } from '@/components/contracts/ContractsEmptyStates';
import { ContractsWebListToolbar } from '@/components/contracts/ContractsWebListToolbar';
import {
  ContractsCardsGrid,
  ContractsFastPaginationFooter,
} from '@/components/contracts/ContractsCardsGrid';
import type { ContractsPageModel } from '@/hooks/useContracts';

type Props = { page: ContractsPageModel };

export function ContractsPageView({ page }: Props) {
  const { showEmptyNoContracts, showEmptyNoResults, isDesktopFast } = page;

  const listVisible = !showEmptyNoContracts && !showEmptyNoResults;

  return (
    <div className="animate-fade-in space-y-6">
      <ContractsImportInput page={page} />
      <ContractsSmartFilterBar page={page} />
      <ContractsAdvancedFiltersCard page={page} />

      {!listVisible ? <ContractsEmptyStates page={page} /> : null}

      {listVisible ? (
        <>
          <ContractsWebListToolbar page={page} />
          <ContractsCardsGrid page={page} />
        </>
      ) : null}

      {isDesktopFast ? <ContractsFastPaginationFooter page={page} /> : null}
    </div>
  );
}
