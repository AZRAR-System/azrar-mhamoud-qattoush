import React from 'react';
import {
  Plus,
  Users,
  ShieldAlert,
  Download,
  SlidersHorizontal,
  Filter,
} from 'lucide-react';
import { SmartFilterBar } from '@/components/shared/SmartFilterBar';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { RBACGuard } from '@/components/shared/RBACGuard';
import { SegmentedTabs } from '@/components/shared/SegmentedTabs';
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
  } = page;

  return (
    <SmartFilterBar
      title={t('إدارة الأشخاص')}
      subtitle={t('سجل العملاء، الملاك، والمستأجرين')}
      searchValue={searchTerm}
      onSearchChange={setSearchTerm}
      searchPlaceholder={t('بحث: الاسم، الهاتف، الرقم الوطني...')}
      onClearFilters={clearFilters}
      onRefresh={() => void loadData()}
      extraActions={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <SegmentedTabs
            tabs={[
              { id: 'all', label: t('الكل'), icon: Users },
              ...availableRoles.map((role) => ({ id: role.label, label: tr(role.label) })),
              { id: 'blacklisted', label: t('القائمة السوداء'), icon: ShieldAlert },
            ]}
            activeId={activeRoleTab}
            onChange={(id) => setActiveRoleTab(id)}
          />

          <Select
            value={sortMode}
            onChange={(e) =>
              setSortMode(
                e.target.value as 'name-asc' | 'name-desc' | 'updated-desc' | 'updated-asc'
              )
            }
            options={[
              { value: 'name-asc', label: t('الاسم: تصاعدي') },
              { value: 'name-desc', label: t('الاسم: تنازلي') },
              { value: 'updated-desc', label: t('الأحدث') },
              { value: 'updated-asc', label: t('الأقدم') },
            ]}
          />

          <Button
            variant={showAdvanced ? 'outline' : 'secondary'}
            onClick={() => setShowAdvanced(!showAdvanced)}
            leftIcon={<SlidersHorizontal size={18} />}
          >
            {showAdvanced ? t('إخفاء') : t('تصفية')}
          </Button>

          {activeRoleTab === 'مالك' && (
            <Button
              variant={showOnlyIdleOwners ? 'danger' : 'secondary'}
              size="sm"
              onClick={() => setShowOnlyIdleOwners(!showOnlyIdleOwners)}
              leftIcon={<Filter size={14} />}
            >
              {t('ملاك عقاراتهم شاغرة')}
            </Button>
          )}

          <Button variant="secondary" size="sm" onClick={() => setShowDynamicColumns((v) => !v)}>
            {showDynamicColumns ? t('إخفاء الحقول الإضافية') : t('إظهار الحقول الإضافية')}
          </Button>

          <Button
            variant="secondary"
            onClick={handleDownloadTemplate}
            leftIcon={<Download size={18} />}
          >
            {t('قالب Excel')}
          </Button>

          <RBACGuard requiredPermission="ADD_PERSON">
            <Button
              variant="secondary"
              onClick={handlePickImportFile}
              leftIcon={<Download size={18} />}
            >
              {t('استيراد')}
            </Button>
          </RBACGuard>

          <Button variant="secondary" onClick={handleExport} leftIcon={<Download size={18} />}>
            {t('تصدير')}
          </Button>

          <RBACGuard requiredPermission="ADD_PERSON">
            <Button onClick={() => handleOpenForm()} leftIcon={<Plus size={18} />}>
              {t('ملف جديد')}
            </Button>
            <Button
              variant="secondary"
              onClick={handleOpenCompanyForm}
              leftIcon={<Plus size={18} />}
            >
              {t('منشأة جديدة')}
            </Button>
          </RBACGuard>
        </div>
      }
    />
  );
}
