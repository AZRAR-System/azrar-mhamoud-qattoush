import { 
    Home, 
    Briefcase, 
    Zap, 
    SlidersHorizontal, 
    Upload, 
    FileText, 
    LayoutGrid 
} from 'lucide-react';
import { SmartFilterBar } from '@/components/shared/SmartFilterBar';
import type { PropertiesPageModel } from '@/hooks/useProperties';

type Props = { page: PropertiesPageModel };

export function PropertiesSmartFilterBar({ page }: Props) {
  const {
    t,
    searchTerm,
    setSearchTerm,
    filterOptions,
    filters,
    setFilters,
    handleOpenForm,
    loadData,
    occupancy,
    setOccupancy,
    sortMode,
    setSortMode,
    setShowAdvanced,
    showAdvanced,
    setShowDynamicColumns,
    showDynamicColumns,
    handleDownloadTemplate,
    handlePickImportFile,
    handleExport,
    clearFilters,
    isDesktopFast,
    desktopTotal,
    desktopPage,
    setDesktopPage,
    filteredProperties,
    uiPage,
    setUiPage,
    uiPageCount,
    desktopPageCount
  } = page;

  // Metadata mapping for Row 3
  const totalResults = isDesktopFast ? desktopTotal : filteredProperties.length;
  const currentPage = isDesktopFast ? desktopPage : uiPage;
  const totalPages = isDesktopFast ? desktopPageCount : uiPageCount;
  const onPageChange = isDesktopFast ? setDesktopPage : setUiPage;

  return (
    <SmartFilterBar
      addButton={{
        label: t('عقار جديد'),
        onClick: () => handleOpenForm(),
        permission: 'ADD_PROPERTY'
      }}
      searchPlaceholder={t('بحث بالاسم، الرقم، الكود...')}
      searchValue={searchTerm}
      onSearchChange={setSearchTerm}
      onRefresh={loadData}
      onExport={handleExport}
      onClearFilters={clearFilters}
      
      // Tabs: All, Rented, Vacant
      tabs={[
        { id: 'all', label: t('الكل'), icon: Home },
        { id: 'rented', label: t('مؤجر'), icon: Briefcase },
        { id: 'vacant', label: t('شاغر'), icon: Zap },
      ]}
      activeTab={occupancy}
      onTabChange={(id) => {
        setOccupancy(id as 'all' | 'rented' | 'vacant');
        if (id === 'rented') setFilters(prev => ({ ...prev, status: 'مؤجر' }));
        else if (id === 'vacant') setFilters(prev => ({ ...prev, status: 'شاغر' }));
        else if (id === 'all') setFilters(prev => (prev.status === 'مؤجر' || prev.status === 'شاغر' ? { ...prev, status: '' } : prev));
      }}

      // More Actions Dropdown
      moreActions={[
        {
          label: showAdvanced ? t('إخفاء الفلاتر المتقدمة') : t('الفلاتر المتقدمة'),
          icon: SlidersHorizontal,
          onClick: () => setShowAdvanced(!showAdvanced)
        },
        {
          label: showDynamicColumns ? t('إخفاء الحقول الإضافية') : t('إظهار الحقول الإضافية'),
          icon: LayoutGrid,
          onClick: () => setShowDynamicColumns(v => !v)
        },
        {
          label: t('قالب Excel'),
          icon: FileText,
          onClick: handleDownloadTemplate
        },
        {
          label: t('استيراد'),
          icon: Upload,
          onClick: handlePickImportFile,
          permission: 'ADD_PROPERTY'
        }
      ]}

      // Filter Chips
      filters={filterOptions.map(opt => ({
        id: opt.key,
        label: opt.label,
        options: opt.options,
        value: filters[opt.key as keyof typeof filters],
        onChange: (val: string) => setFilters(prev => ({ ...prev, [opt.key]: val }))
      }))}

      // Sort Options
      sortValue={sortMode}
      onSortChange={(v) => setSortMode(v as 'code-asc' | 'code-desc' | 'updated-desc' | 'updated-asc')}
      sortOptions={[
        { value: 'code-asc', label: t('الكود: تصاعدي') },
        { value: 'code-desc', label: t('الكود: تنازلي') },
        { value: 'updated-desc', label: t('الأحدث') },
        { value: 'updated-asc', label: t('الأقدم') },
      ]}

      // Row 3 Data
      totalResults={totalResults}
      currentPage={currentPage}
      totalPages={totalPages}
      onPageChange={onPageChange}
    />
  );
}
