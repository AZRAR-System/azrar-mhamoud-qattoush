import React from 'react';
import {
  Home,
  Briefcase,
  Zap,
  SlidersHorizontal,
  Download,
  Upload,
} from 'lucide-react';
import { SmartFilterBar } from '@/components/shared/SmartFilterBar';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { RBACGuard } from '@/components/shared/RBACGuard';
import { SegmentedTabs } from '@/components/shared/SegmentedTabs';
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
  } = page;

  return (
    <SmartFilterBar
      title={t('إدارة العقارات')}
      subtitle={t('سجل الوحدات السكنية والتجارية المفصل')}
      searchValue={searchTerm}
      onSearchChange={setSearchTerm}
      onClearFilters={clearFilters}
      filters={filterOptions}
      activeFilters={filters}
      onFilterChange={(key, val) => setFilters((prev) => ({ ...prev, [key]: val }))}
      onAddClick={() => handleOpenForm()}
      addLabel={t('عقار جديد')}
      onRefresh={loadData}
      extraActions={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <SegmentedTabs
            tabs={[
              { id: 'all', label: t('الكل'), icon: Home },
              { id: 'rented', label: t('مؤجر'), icon: Briefcase },
              { id: 'vacant', label: t('شاغر'), icon: Zap },
            ]}
            activeId={occupancy}
            onChange={(id) => {
              setOccupancy(id);
              if (id === 'rented')
                setFilters((prev) => (prev.status ? prev : { ...prev, status: 'مؤجر' }));
              if (id === 'vacant')
                setFilters((prev) => (prev.status ? prev : { ...prev, status: 'شاغر' }));
              if (id === 'all') {
                setFilters((prev) =>
                  prev.status === 'مؤجر' || prev.status === 'شاغر'
                    ? { ...prev, status: '' }
                    : prev
                );
              }
            }}
          />

          <Select
            value={sortMode}
            onChange={(e) =>
              setSortMode(
                e.target.value as 'code-asc' | 'code-desc' | 'updated-desc' | 'updated-asc'
              )
            }
            options={[
              { value: 'code-asc', label: t('الكود: تصاعدي') },
              { value: 'code-desc', label: t('الكود: تنازلي') },
              { value: 'updated-desc', label: t('الأحدث') },
              { value: 'updated-asc', label: t('الأقدم') },
            ]}
          />

          <Button
            variant="secondary"
            onClick={() => {
              setShowAdvanced(!showAdvanced);
            }}
            leftIcon={<SlidersHorizontal size={18} />}
          >
            {showAdvanced ? t('إخفاء') : t('تصفية')}
          </Button>
          <Button variant="secondary" onClick={() => setShowDynamicColumns((v) => !v)}>
            {showDynamicColumns ? t('إخفاء الحقول الإضافية') : t('إظهار الحقول الإضافية')}
          </Button>
          <Button
            variant="secondary"
            onClick={handleDownloadTemplate}
            leftIcon={<Download size={18} />}
          >
            {t('قالب Excel')}
          </Button>
          <RBACGuard requiredPermission="ADD_PROPERTY">
            <Button
              variant="secondary"
              onClick={handlePickImportFile}
              leftIcon={<Upload size={18} />}
            >
              {t('استيراد')}
            </Button>
          </RBACGuard>
          <Button variant="secondary" onClick={handleExport} leftIcon={<Download size={18} />}>
            {t('تصدير')}
          </Button>
        </div>
      }
    />
  );
}
