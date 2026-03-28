import React from 'react';
import { EmptyState } from '@/components/shared/EmptyState';
import type { PeoplePageModel } from '@/hooks/usePeople';

type Props = { page: PeoplePageModel };

export function PeopleEmptyStates({ page }: Props) {
  const {
    t,
    tr,
    searchTerm,
    setSearchTerm,
    setActiveRoleTab,
    setShowOnlyIdleOwners,
    setShowAdvanced,
    setAdvFilters,
    showEmptyNoPeople,
    showEmptyNoResults,
    activeRoleTab,
    handleOpenForm,
  } = page;

  if (showEmptyNoPeople) {
    return <EmptyState type="people" onAction={() => handleOpenForm()} />;
  }

  if (showEmptyNoResults) {
    return (
      <EmptyState
        type={searchTerm ? 'search' : 'filter'}
        title={searchTerm ? t('لا توجد نتائج بحث') : t('لا توجد نتائج')}
        message={
          searchTerm
            ? t('لم يتم العثور على أشخاص يطابقون "{{query}}"', { query: searchTerm })
            : activeRoleTab === 'blacklisted'
              ? t('لا يوجد أشخاص في القائمة السوداء')
              : t('لا يوجد أشخاص بدور "{{role}}"', { role: tr(activeRoleTab) })
        }
        actionLabel={searchTerm ? t('مسح البحث') : t('مسح الفلاتر')}
        onAction={() => {
          setSearchTerm('');
          setActiveRoleTab('all');
          setShowOnlyIdleOwners(false);
          setShowAdvanced(false);
          setAdvFilters({ address: '', nationalId: '', classification: 'All', minRating: 0 });
        }}
      />
    );
  }

  return null;
}
