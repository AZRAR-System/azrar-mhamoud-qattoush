import { Button } from '@/components/ui/Button';
import { ContractCard } from '@/components/contracts/ContractCard';
import { SkeletonCardGrid } from '@/components/shared/SkeletonCard';
import type { ContractsPageModel } from '@/hooks/useContracts';

type Props = { page: ContractsPageModel };

export function ContractsFastPaginationFooter({ page }: Props) {
  const { t, isDesktopFast, fastTotal, fastPage, setFastPage, fastPageCount, fastLoading } = page;

  if (!isDesktopFast) return null;
  if (fastPageCount <= 1) return null;

  const currentPage = fastPage;
  const totalPages = fastPageCount;
  const isFirst = fastPage <= 1;
  const isLast = fastPage >= fastPageCount;

  return (
    <div className="flex items-center justify-between px-4 py-3 mt-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-xl bg-indigo-500/10 flex items-center justify-center">
          <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">
            {fastLoading ? '...' : fastTotal.toLocaleString('ar-JO')}
          </span>
        </div>
        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{t('نتيجة')}</span>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => setFastPage((p) => Math.max(1, p - 1))}
          disabled={isFirst || fastLoading}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-400"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ transform: 'rotate(180deg)' }}><path d="M9 18l6-6-6-6"/></svg>
          {t('السابق')}
        </button>

        <div className="flex items-center gap-1">
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let pageNum: number;
            if (totalPages <= 5) {
              pageNum = i + 1;
            } else if (currentPage <= 3) {
              pageNum = i + 1;
            } else if (currentPage >= totalPages - 2) {
              pageNum = totalPages - 4 + i;
            } else {
              pageNum = currentPage - 2 + i;
            }
            return (
              <button
                key={pageNum}
                onClick={() => setFastPage(pageNum)}
                className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                  pageNum === currentPage
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {pageNum}
              </button>
            );
          })}
        </div>

        <button
          onClick={() => setFastPage((p) => Math.min(fastPageCount, p + 1))}
          disabled={isLast || fastLoading}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-400"
        >
          {t('التالي')}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
        </button>
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
