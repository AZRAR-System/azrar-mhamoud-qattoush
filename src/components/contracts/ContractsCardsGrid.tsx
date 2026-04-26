import { Button } from '@/components/ui/Button';
import { ContractCard } from '@/components/contracts/ContractCard';
import { SkeletonCardGrid } from '@/components/shared/SkeletonCard';
import type { ContractsPageModel } from '@/hooks/useContracts';

type Props = { page: ContractsPageModel };

export function ContractsFastPaginationFooter({ page }: Props) {
  const { t, isDesktopFast, fastTotal, fastPage, setFastPage, fastPageCount, fastLoading } = page;

  if (!isDesktopFast) return null;

  return (
    <div className="flex items-center justify-between gap-3 mt-4 text-sm">
      <div className="text-slate-500">
        {t('النتائج:')} {fastTotal.toLocaleString('ar-JO')} {' • '} {t('الصفحة')} {fastPage} /{' '}
        {fastPageCount}
      </div>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          disabled={fastPage <= 1 || fastLoading}
          onClick={() => setFastPage((p) => Math.max(1, Math.min(fastPageCount, p - 1)))}
        >
          {t('السابق')}
        </Button>
        <Button
          variant="secondary"
          disabled={fastLoading || fastPage >= fastPageCount}
          onClick={() => setFastPage((p) => Math.min(fastPageCount, p + 1))}
        >
          {t('التالي')}
        </Button>
      </div>
    </div>
  );
}

export function ContractsCardsGrid({ page }: Props) {
  const {
    isDesktopFast,
    loading,
    fastRows,
    uiRows,
    peopleMap,
    propsById,
    propsCodeMap,
    remainingByContractId,
    handleOpenDetails,
    handleOpenClearance,
    handleArchive,
    handleEdit,
    handleDelete,
    deletingContractId,
  } = page;

  if (loading) {
    return <SkeletonCardGrid count={6} variant="listing" />;
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {isDesktopFast
        ? fastRows.map((item) => {
            const c = item.contract;
            return (
              <ContractCard
                key={String(c.رقم_العقد)}
                contract={c}
                propCode={String(item.propertyCode || c.رقم_العقار || '')}
                tenantName={String(item.tenantName || c.رقم_المستاجر || '')}
                ownerName={String(item.ownerName || '')}
                remainingAmount={Number(item.remainingAmount || 0) || 0}
                onOpenDetails={handleOpenDetails}
                onOpenClearance={handleOpenClearance}
                onArchive={handleArchive}
                onEdit={handleEdit}
                onDelete={handleDelete}
                isDeleting={deletingContractId === String(c.رقم_العقد)}
              />
            );
          })
        : uiRows.map((c) => {
            const prop = propsById.get(String(c.رقم_العقار));
            const ownerName = prop?.رقم_المالك
              ? peopleMap.get(String(prop.رقم_المالك)) || String(prop.رقم_المالك)
              : '';
            const remainingAmount = remainingByContractId.get(String(c.رقم_العقد)) || 0;
            return (
              <ContractCard
                key={c.رقم_العقد}
                contract={c}
                propCode={propsCodeMap.get(String(c.رقم_العقار)) || c.رقم_العقار}
                tenantName={peopleMap.get(String(c.رقم_المستاجر)) || c.رقم_المستاجر}
                ownerName={ownerName}
                remainingAmount={remainingAmount}
                onOpenDetails={handleOpenDetails}
                onOpenClearance={handleOpenClearance}
                onArchive={handleArchive}
                onEdit={handleEdit}
                onDelete={handleDelete}
                isDeleting={deletingContractId === String(c.رقم_العقد)}
              />
            );
          })}
    </div>
  );
}
