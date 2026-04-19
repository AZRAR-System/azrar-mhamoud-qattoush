import { FileText } from 'lucide-react';
import { SmartPageHero } from '@/components/shared/SmartPageHero';
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
      <SmartPageHero
        title="إدارة العقود"
        description="إدارة وتتبع عقود الإيجار والتحصيلات والالتزامات القانونية."
        icon={FileText}
        iconColor="text-indigo-600 dark:text-indigo-400"
        iconBg="bg-indigo-50 dark:bg-indigo-950/40"
        stats={[
          {
            label: 'إجمالي العقود',
            value: page.desktopCounts?.contracts ?? page.contracts.length,
          },
          {
            label: 'النتائج الحالية',
            value: page.filteredContracts.length,
            color: 'text-indigo-600',
          },
        ]}
      />
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
