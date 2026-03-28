import React from 'react';
import {
  CheckCircle,
  Clock,
  AlertTriangle,
  Ban,
  Archive,
  Download,
  SlidersHorizontal,
  Filter,
  X,
} from 'lucide-react';
import { CalendarDays } from 'lucide-react';
import { SmartFilterBar } from '@/components/shared/SmartFilterBar';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { RBACGuard } from '@/components/shared/RBACGuard';
import { SegmentedTabs } from '@/components/shared/SegmentedTabs';
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
    createdMonthApplied,
    currentMonthKey,
    setShowAdvanced,
    showAdvanced,
    handleDownloadTemplate,
    handlePickImportFile,
    handleExport,
    clearFilters,
  } = page;

  return (
    <SmartFilterBar
      title={t('إدارة العقود')}
      subtitle={t('دورة حياة كاملة للعقود: إنشاء، تجديد، مخالصات، وأرشفة.')}
      searchValue={searchTerm}
      onSearchChange={setSearchTerm}
      onClearFilters={clearFilters}
      onAddClick={handleCreate}
      addLabel={t('عقد جديد')}
      onRefresh={loadData}
      extraActions={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <SegmentedTabs
            tabs={[
              { id: 'active', label: t('سارية'), icon: CheckCircle },
              { id: 'expiring', label: t('قريبة الانتهاء'), icon: Clock },
              { id: 'expired', label: t('منتهية'), icon: AlertTriangle },
              { id: 'terminated', label: t('مفسوخة'), icon: Ban },
              { id: 'archived', label: t('الأرشيف'), icon: Archive },
            ]}
            activeId={activeStatus}
            onChange={(id) => setActiveStatus(id)}
          />

          <div className="app-card px-3 py-2 flex items-center gap-2">
            <Select
              value={sortMode}
              onChange={(e) =>
                setSortMode(
                  e.target.value as 'created-desc' | 'created-asc' | 'end-desc' | 'end-asc'
                )
              }
              options={[
                { value: 'created-desc', label: t('الأحدث (حسب الإنشاء)') },
                { value: 'created-asc', label: t('الأقدم (حسب الإنشاء)') },
                { value: 'end-desc', label: t('النهاية: تنازلي') },
                { value: 'end-asc', label: t('النهاية: تصاعدي') },
              ]}
            />
            <Filter size={16} className="text-gray-400" />
            <input
              type="text"
              dir="ltr"
              className="bg-transparent text-slate-700 dark:text-white outline-none text-sm font-bold"
              value={advFilters.createdMonth}
              inputMode="numeric"
              placeholder="YYYY-MM"
              aria-label={t('شهر إنشاء العقد (YYYY-MM)')}
              onChange={(e) => {
                const raw = e.target.value;
                const digitsAndDash = raw.replace(/[^0-9-]/g, '');

                let next = digitsAndDash;
                if (next.length > 7) next = next.slice(0, 7);

                const onlyDigits = next.replace(/-/g, '');
                const yyyy = onlyDigits.slice(0, 4);
                const mm = onlyDigits.slice(4, 6);

                next = yyyy;
                if (mm.length > 0) next += `-${mm}`;

                setAdvFilters({ ...advFilters, createdMonth: next });
              }}
              title={t('تصفية حسب شهر إنشاء العقد')}
            />
            {createdMonthApplied && (
              <button
                type="button"
                onClick={() => setAdvFilters({ ...advFilters, createdMonth: '' })}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400"
                title={t('إلغاء فلتر الشهر')}
              >
                <X size={14} />
              </button>
            )}
          </div>

          <Button
            size="sm"
            variant={advFilters.createdMonth === currentMonthKey ? 'secondary' : 'ghost'}
            leftIcon={<CalendarDays size={16} />}
            onClick={() => {
              const isThisMonth =
                String(advFilters.createdMonth || '').trim() === currentMonthKey;
              setAdvFilters({ ...advFilters, createdMonth: isThisMonth ? '' : currentMonthKey });
            }}
            title={
              advFilters.createdMonth === currentMonthKey
                ? t('إلغاء فلتر هذا الشهر')
                : t('عرض العقود المُنشأة هذا الشهر')
            }
          >
            {t('هذا الشهر')}
          </Button>

          <Button
            variant="secondary"
            onClick={() => setShowAdvanced(!showAdvanced)}
            leftIcon={<SlidersHorizontal size={18} />}
          >
            {showAdvanced ? t('إخفاء') : t('تصفية')}
          </Button>
          <Button
            variant="secondary"
            onClick={handleDownloadTemplate}
            leftIcon={<Download size={18} />}
          >
            {t('قالب Excel')}
          </Button>
          <RBACGuard requiredPermission="CREATE_CONTRACT">
            <Button
              variant="secondary"
              onClick={handlePickImportFile}
              leftIcon={<Download size={18} />}
            >
              {t('استيراد')}
            </Button>
          </RBACGuard>
          <Button variant="secondary" onClick={handleExport} leftIcon={<Download size={18} />} />
        </div>
      }
    />
  );
}
