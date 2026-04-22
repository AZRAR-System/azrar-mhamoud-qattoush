import { 
    Users, 
    ShieldAlert, 
    Upload, 
    FileText, 
    SlidersHorizontal, 
    LayoutGrid, 
    Building2, 
    UserPlus,
    UserCheck
} from 'lucide-react';
import { SmartFilterBar } from '@/components/shared/SmartFilterBar';
import type { PeoplePageModel } from '@/hooks/usePeople';

type Props = { page: PeoplePageModel };

export function PeopleSmartFilterBar({ page }: Props) {
  const {
    t,
    tr,
    searchTerm,
    setSearchTerm,
    loadData,
    availableRoles,
    activeRoleTab,
    setActiveRoleTab,
    sortMode,
    setSortMode,
    showAdvanced,
    setShowAdvanced,
    showOnlyIdleOwners,
    setShowOnlyIdleOwners,
    showDynamicColumns,
    setShowDynamicColumns,
    handleDownloadTemplate,
    handlePickImportFile,
    handleExport,
    handleOpenForm,
    handleOpenCompanyForm,
    clearFilters,
    isDesktopFast,
    desktopTotal,
    desktopPage,
    setDesktopPage,
    filtered,
    uiPage,
    setUiPage,
    uiPageCount,
    desktopPageCount
  } = page;

  const totalResults = isDesktopFast ? desktopTotal : filtered.length;
  const currentPage = isDesktopFast ? desktopPage : uiPage;
  const totalPages = isDesktopFast ? desktopPageCount : uiPageCount;
  const onPageChange = isDesktopFast ? setDesktopPage : setUiPage;

  return (
    <SmartFilterBar
      addButton={{
        label: t('ملف جديد'),
        onClick: () => handleOpenForm(),
        permission: 'ADD_PERSON'
      }}
      searchPlaceholder={t('بحث بالاسم، الهاتف، الرقم الوطني...')}
      searchValue={searchTerm}
      onSearchChange={setSearchTerm}
      onRefresh={() => void loadData()}
      onExport={handleExport}
      onClearFilters={clearFilters}

      // Tabs: All, Specific Roles, Blacklisted
      tabs={[
        { id: 'all', label: t('الكل'), icon: Users },
        ...availableRoles.map((role) => ({ 
            id: role.label, 
            label: tr(role.label),
            // Map simple role icons if appropriate
            icon: role.label === 'مالك' ? UserCheck : role.label === 'مستأجر' ? UserPlus : undefined
        })),
        { id: 'blacklisted', label: t('القائمة السوداء'), icon: ShieldAlert },
      ]}
      activeTab={activeRoleTab}
      onTabChange={(id) => setActiveRoleTab(id)}

      // More Actions Dropdown
      moreActions={[
        {
          label: t('منشأة جديدة'),
          icon: Building2,
          onClick: handleOpenCompanyForm,
          permission: 'ADD_PERSON'
        },
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
          permission: 'ADD_PERSON'
        }
      ]}

      // Filter Chips
      filters={[
        ...(activeRoleTab === 'مالك' ? [{
            id: 'idle-owners',
            label: t('تصفية الملاك'),
            options: [
                { value: 'all', label: t('جميع الملاك') },
                { value: 'idle', label: t('عقاراتهم شاغرة') }
            ],
            value: showOnlyIdleOwners ? 'idle' : 'all',
            onChange: (v: string) => setShowOnlyIdleOwners(v === 'idle')
        }] : [])
      ]}

      // Sort Options
      sortValue={sortMode}
      onSortChange={(v) => setSortMode(v as 'name-asc' | 'name-desc' | 'updated-desc' | 'updated-asc')}
      sortOptions={[
        { value: 'name-asc', label: t('الاسم: تصاعدي') },
        { value: 'name-desc', label: t('الاسم: تنازلي') },
        { value: 'updated-desc', label: t('الأحدث') },
        { value: 'updated-asc', label: t('الأقدم') },
      ]}

      totalResults={totalResults}
      currentPage={currentPage}
      totalPages={totalPages}
      onPageChange={onPageChange}
    />
  );
}
