import type { العقارات_tbl, العقود_tbl } from '@/types';
import { Button } from '@/components/ui/Button';
import { PropertyListingCard } from '@/components/properties/PropertyListingCard';
import { getPersonColorClasses } from '@/utils/personColor';
import type {
  DesktopPropertyPickerItem,
  PropertyExtras,
} from '@/components/properties/propertiesTypes';
import { SkeletonCardGrid } from '@/components/shared/SkeletonCard';
import type { PropertiesPageModel } from '@/hooks/useProperties';

type Props = { page: PropertiesPageModel };

function PropertiesResultsToolbar({ page }: Props) {
  const {
    t,
    isDesktopFast,
    desktopLoading,
    desktopTotal,
    desktopPage,
    setDesktopPage,
    desktopPageCount,
    filteredProperties,
    uiPage,
    setUiPage,
    uiPageCount,
  } = page;

  if (isDesktopFast) {
    return (
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm text-slate-500 dark:text-slate-400">
          {desktopLoading ? '...' : desktopTotal.toLocaleString()} {t('نتيجة')}
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            disabled={desktopLoading || desktopPage <= 0}
            onClick={() => setDesktopPage((p) => Math.max(0, p - 1))}
          >
            {t('السابق')}
          </Button>
          <div className="text-sm text-slate-600 dark:text-slate-300">
            {desktopPage + 1} / {desktopPageCount}
          </div>
          <Button
            size="sm"
            variant="secondary"
            disabled={desktopLoading || desktopPage + 1 >= desktopPageCount}
            onClick={() =>
              setDesktopPage((p) => Math.min(Math.max(0, desktopPageCount - 1), p + 1))
            }
          >
            {t('التالي')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between mb-3">
      <div className="text-sm text-slate-500 dark:text-slate-400">
        {filteredProperties.length.toLocaleString()} {t('نتيجة')}
      </div>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          disabled={uiPage <= 0}
          onClick={() => setUiPage((p) => Math.max(0, p - 1))}
        >
          {t('السابق')}
        </Button>
        <div className="text-sm text-slate-600 dark:text-slate-300">
          {uiPage + 1} / {uiPageCount}
        </div>
        <Button
          size="sm"
          variant="secondary"
          disabled={uiPage + 1 >= uiPageCount}
          onClick={() => setUiPage((p) => Math.min(Math.max(0, uiPageCount - 1), p + 1))}
        >
          {t('التالي')}
        </Button>
      </div>
    </div>
  );
}

export function PropertiesCardsGrid({ page }: Props) {
  const {
    t,
    tr,
    loading,
    isDesktopFast,
    desktopRows,
    uiRows,
    peopleMap,
    activeContractByPropertyId,
    getOwnerName,
    showDynamicColumns,
    dynamicFields,
    openPanel,
    handleOpenForm,
    handleDelete,
    quickListForSale,
    deletingPropertyId,
  } = page;

  return (
    <>
      <PropertiesResultsToolbar page={page} />
      {loading ? (
        <SkeletonCardGrid count={6} variant="listing" />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {(isDesktopFast ? desktopRows : uiRows).map(
            (rowOrProperty: DesktopPropertyPickerItem | العقارات_tbl, idx: number) => {
              const desktopItem = isDesktopFast
                ? (rowOrProperty as DesktopPropertyPickerItem)
                : null;
              const p = isDesktopFast ? desktopItem?.property : (rowOrProperty as العقارات_tbl);
              if (!p) return null;

              const activeDesktop = isDesktopFast ? desktopItem?.active : null;
              const activeLegacy = !isDesktopFast
                ? activeContractByPropertyId.get(String(p.رقم_العقار))
                : null;

              const tenant = activeLegacy?.رقم_المستاجر
                ? peopleMap.get(String(activeLegacy.رقم_المستاجر))
                : undefined;
              const guarantor = activeLegacy?.رقم_الكفيل
                ? peopleMap.get(String(activeLegacy.رقم_الكفيل))
                : undefined;
              const hasActive = Boolean(isDesktopFast ? activeDesktop : activeLegacy);

              const ownerColor = getPersonColorClasses(String(p.رقم_المالك ?? ''));

              const ownerName = isDesktopFast
                ? String(desktopItem?.ownerName || t('غير معروف'))
                : getOwnerName(p.رقم_المالك);
              const tenantName = isDesktopFast
                ? String(activeDesktop?.tenantName || (hasActive ? t('غير معروف') : ''))
                : String(tenant?.الاسم || '');
              const tenantPhone = isDesktopFast
                ? String(activeDesktop?.tenantPhone || '')
                : String(tenant?.رقم_الهاتف || '');
              const contractId = isDesktopFast
                ? String(activeDesktop?.contractId || '')
                : String(activeLegacy?.رقم_العقد || '');
              const guarantorName = isDesktopFast
                ? String(activeDesktop?.guarantorName || '')
                : String(guarantor?.الاسم || '');
              const guarantorPhone = isDesktopFast
                ? String(activeDesktop?.guarantorPhone || '')
                : String(guarantor?.رقم_الهاتف || '');

              const furnishingText = String(
                (p as العقارات_tbl & PropertyExtras)?.نوع_التاثيث ||
                  (p as unknown as { صفة_العقار?: string })?.صفة_العقار ||
                  ''
              ).trim();
              const isFurnished = /مفروش|مفروشة|مؤثث|مؤثثة/i.test(furnishingText);
              const isEmpty = /فارغ|غير\s*مفروش|غير\s*مفروشة|غير\s*مؤثث|غير\s*مؤثثة/i.test(
                furnishingText
              );

              const visualStripeClass = isFurnished
                ? 'bg-amber-500/25 dark:bg-amber-400/20'
                : isEmpty
                  ? 'bg-slate-400/25 dark:bg-slate-400/20'
                  : hasActive
                    ? 'bg-indigo-500/25 dark:bg-indigo-400/20'
                    : 'bg-slate-400/25 dark:bg-slate-400/20';

              const visualRingClass = isFurnished
                ? 'ring-2 ring-amber-500/10 border-amber-500/20'
                : isEmpty
                  ? 'ring-2 ring-slate-400/10 border-slate-400/20'
                  : hasActive
                    ? 'ring-2 ring-indigo-500/10 border-indigo-500/20'
                    : '';

              const accentIcon = isFurnished
                ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-300'
                : isEmpty
                  ? 'bg-slate-50 dark:bg-slate-900/20 text-slate-600 dark:text-slate-300'
                  : hasActive
                    ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                    : 'bg-slate-50 dark:bg-slate-900/20 text-slate-600 dark:text-slate-300';

              const showGuarantorBlock = Boolean(
                hasActive &&
                (isDesktopFast
                  ? Boolean(guarantorName)
                  : Boolean((activeLegacy as العقود_tbl | null)?.رقم_الكفيل))
              );

              return (
                <PropertyListingCard
                  key={p.رقم_العقار || idx}
                  property={p}
                  hasActive={hasActive}
                  ownerColorDotClass={ownerColor.dot}
                  ownerName={ownerName}
                  tenantName={tenantName}
                  tenantPhone={tenantPhone}
                  contractId={contractId}
                  guarantorName={guarantorName}
                  guarantorPhone={guarantorPhone}
                  showGuarantorBlock={showGuarantorBlock}
                  isFurnished={isFurnished}
                  isEmpty={isEmpty}
                  visualStripeClass={visualStripeClass}
                  visualRingClass={visualRingClass}
                  accentIcon={accentIcon}
                  showDynamicColumns={showDynamicColumns}
                  dynamicFields={dynamicFields}
                  tr={tr}
                  t={t}
                  openPanel={openPanel}
                  handleOpenForm={handleOpenForm}
                  handleDelete={handleDelete}
                  quickListForSale={quickListForSale}
                  isDeleting={deletingPropertyId === String(p.رقم_العقار)}
                />
              );
            }
          )}
        </div>
      )}
    </>
  );
}
