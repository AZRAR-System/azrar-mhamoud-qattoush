import { 
    CheckCircle, 
    Clock, 
    AlertTriangle, 
    Ban, 
    Archive, 
    Upload, 
    FileText, 
    SlidersHorizontal,
    CalendarDays
} from 'lucide-react';
import { SmartFilterBar } from '@/components/shared/SmartFilterBar';
import type { ContractsPageModel } from '@/hooks/useContracts';

type Props = { page: ContractsPageModel };

export function ContractsSmartFilterBar({ page }: Props) {
  const {
    t,
    searchTerm,
    setSearchTerm,
    handleCreate,
    loadData,
    activeStatus,
    setActiveStatus,
    sortMode,
    setSortMode,
    advFilters,
    setAdvFilters,
    currentMonthKey,
    setShowAdvanced,
    showAdvanced,
    handleDownloadTemplate,
    handlePickImportFile,
    handleExport,
    clearFilters,
    isDesktopFast,
    fastTotal,
    fastPage,
    setFastPage,
    filteredContracts,
    uiPage,
    setUiPage,
    uiPageCount,
    fastPageCount
  } = page;

  const totalResults = isDesktopFast ? fastTotal : filteredContracts.length;
  const currentPage = isDesktopFast ? Math.max(0, fastPage - 1) : uiPage;
  const totalPages = isDesktopFast ? fastPageCount : uiPageCount;
  const onPageChange = isDesktopFast ? (p: number) => setFastPage(p + 1) : setUiPage;

  return (
    <SmartFilterBar
      addButton={{
        label: t('عقد جديد'),
        onClick: handleCreate,
        permission: 'CREATE_CONTRACT'
      }}
      searchPlaceholder={t('بحث برقم العقد، المستأجر، العقار...')}
      searchValue={searchTerm}
      onSearchChange={setSearchTerm}
      onRefresh={loadData}
      onExport={handleExport}
      onClearFilters={clearFilters}

      // Tabs: lifecycle of contracts
      tabs={[
        { id: 'active', label: t('سارية'), icon: CheckCircle },
        { id: 'expiring', label: t('قريبة الانتهاء'), icon: Clock },
        { id: 'collection', label: t('تحصيل'), icon: AlertTriangle },
        { id: 'expired', label: t('منتهية'), icon: AlertTriangle },
        { id: 'terminated', label: t('مفسوخة'), icon: Ban },
        { id: 'archived', label: t('الأرشيف'), icon: Archive },
      ]}
      activeTab={activeStatus}
      onTabChange={(id) => setActiveStatus(id as 'active' | 'expiring' | 'expired' | 'terminated' | 'archived' | 'collection')}

      // More Actions Dropdown
      moreActions={[
        {
          label: showAdvanced ? t('إخفاء الفلاتر المتقدمة') : t('الفلاتر المتقدمة'),
          icon: SlidersHorizontal,
          onClick: () => setShowAdvanced(!showAdvanced)
        },
        {
          label: t('عقود هذا الشهر'),
          icon: CalendarDays,
          onClick: () => {
              const isThisMonth = advFilters.createdMonth === currentMonthKey;
              setAdvFilters({ ...advFilters, createdMonth: isThisMonth ? '' : currentMonthKey });
          }
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
          permission: 'CREATE_CONTRACT'
        }
      ]}

      // Filter Chips
      filters={[
        ...(advFilters.createdMonth ? [{
            id: 'month',
            label: t('شهر الإنشاء'),
            options: [
                { value: advFilters.createdMonth, label: advFilters.createdMonth },
                { value: '', label: t('الكل') }
            ],
            value: advFilters.createdMonth,
            onChange: (v: string) => setAdvFilters({ ...advFilters, createdMonth: v })
        }] : [])
      ]}

      // Sort Options
      sortValue={sortMode}
      onSortChange={(v) => setSortMode(v as 'created-desc' | 'created-asc' | 'end-desc' | 'end-asc')}
      sortOptions={[
        { value: 'created-desc', label: t('الأحدث (حسب الإنشاء)') },
        { value: 'created-asc', label: t('الأقدم (حسب الإنشاء)') },
        { value: 'end-desc', label: t('النهاية: تنازلي') },
        { value: 'end-asc', label: t('النهاية: تصاعدي') },
      ]}

      totalResults={totalResults}
      currentPage={currentPage}
      totalPages={totalPages}
      onPageChange={onPageChange}
    />
  );
}
