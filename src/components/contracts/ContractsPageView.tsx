import { FileText } from 'lucide-react';
import { SmartPageHero } from '@/components/shared/SmartPageHero';
import { PageLayout } from '@/components/shared/PageLayout';
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
    <PageLayout>
      <SmartPageHero
        variant="premium"
        title="إدارة العقود"
        description="إدارة وتتبع عقود الإيجار والتحصيلات والالتزامات القانونية بنظام أزرار."
        icon={<FileText size={32} />}
        stats={[
          {
            label: 'إجمالي العقود',
            value: page.desktopCounts?.contracts ?? page.contracts.length,
          },
          {
            label: 'النتائج الحالية',
            value: page.filteredContracts.length,
            color: 'text-indigo-200',
          },
        ]}
      />
      
      <div className="space-y-6">
        <ContractsImportInput page={page} />
        <ContractsSmartFilterBar page={page} />
        <ContractsAdvancedFiltersCard page={page} />

        <div className="page-transition">
          {!listVisible ? <ContractsEmptyStates page={page} /> : null}

          {listVisible ? (
            <>
              <ContractsWebListToolbar page={page} />
              <ContractsCardsGrid page={page} />
            </>
          ) : null}

          {isDesktopFast ? <ContractsFastPaginationFooter page={page} /> : null}
        </div>
      </div>
    </PageLayout>
  );
}
