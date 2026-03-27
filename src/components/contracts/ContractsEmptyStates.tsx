import React from 'react';
import { EmptyState } from '@/components/shared/EmptyState';
import type { ContractsPageModel } from '@/hooks/useContracts';

type Props = { page: ContractsPageModel };

export function ContractsEmptyStates({ page }: Props) {
  const {
    t,
    showEmptyNoContracts,
    showEmptyNoResults,
    handleCreate,
    searchTerm,
    setSearchTerm,
    setActiveStatus,
    setShowAdvanced,
    setAdvFilters,
  } = page;

  if (showEmptyNoContracts) {
    return <EmptyState type="contracts" onAction={handleCreate} />;
  }

  if (showEmptyNoResults) {
    return (
      <EmptyState
        type={searchTerm ? 'search' : 'filter'}
        title={t(searchTerm ? 'لا توجد نتائج بحث' : 'لا توجد نتائج')}
        message={
          searchTerm
            ? t('لا توجد نتائج مطابقة لـ "{{query}}"', { query: searchTerm })
            : t('لا توجد بيانات تطابق الفلاتر المحددة. حاول تغيير معايير الفلترة.')
        }
        actionLabel={t(searchTerm ? 'مسح البحث' : 'مسح الفلاتر')}
        onAction={() => {
          setSearchTerm('');
          setActiveStatus('active');
          setShowAdvanced(false);
          setAdvFilters({
            startDateFrom: '',
            startDateTo: '',
            endDateFrom: '',
            endDateTo: '',
            minValue: '',
            maxValue: '',
            createdMonth: '',
          });
        }}
      />
    );
  }

  return null;
}
