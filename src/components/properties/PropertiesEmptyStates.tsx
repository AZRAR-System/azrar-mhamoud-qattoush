import { EmptyState } from '@/components/shared/EmptyState';
import type { PropertiesPageModel } from '@/hooks/useProperties';

type Props = { page: PropertiesPageModel };

export function PropertiesEmptyStates({ page }: Props) {
  const {
    t,
    showEmptyNoProperties,
    showEmptyNoResults,
    handleOpenForm,
    searchTerm,
    setSearchTerm,
    setFilters,
    setShowAdvanced,
    setAdvFilters,
  } = page;

  if (showEmptyNoProperties) {
    return <EmptyState type="properties" onAction={() => handleOpenForm()} />;
  }

  if (showEmptyNoResults) {
    return (
      <EmptyState
        type={searchTerm ? 'search' : 'filter'}
        title={searchTerm ? t('لا توجد نتائج بحث') : t('لا توجد نتائج')}
        message={
          searchTerm
            ? t('لم يتم العثور على عقارات تطابق "{{query}}"', { query: searchTerm })
            : t('لا توجد عقارات تطابق الفلاتر المحددة')
        }
        actionLabel={searchTerm ? t('مسح البحث') : t('مسح الفلاتر')}
        onAction={() => {
          setSearchTerm('');
          setFilters({ status: '', type: '', furnishing: '', sale: '', rent: '' });
          setShowAdvanced(false);
          setAdvFilters({
            minArea: '',
            maxArea: '',
            minPrice: '',
            maxPrice: '',
            floor: '',
            contractLink: 'all',
          });
        }}
      />
    );
  }

  return null;
}
