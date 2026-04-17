import type { InstallmentsPageModel } from '@/hooks/useInstallments';
import { ROUTE_PATHS } from '@/routes/paths';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/shared/EmptyState';
import { SkeletonCardGrid } from '@/components/shared/SkeletonCard';
import { ContractFinancialCard } from '@/components/installments/ContractFinancialCard';

type Props = { page: InstallmentsPageModel };

export function InstallmentsContractsList({ page }: Props) {
  const {
    isDesktopFast,
    desktopError,
    filter,
    setFilter,
    search,
    setSearch,
    desktopTotal,
    desktopLoading,
    loading,
    desktopRows,
    desktopPage,
    setDesktopPage,
    desktopPageCount,
    installments,
    filteredList,
    isAdmin,
    userId,
    userRole,
    showDynamicColumns,
    dynamicFields,
    handlePay,
    setSelectedInstallment,
    handleFullPayment,
    handlePartialPayment,
    handleReversePayment,
    setMessageContext,
    setMessageModalOpen,
    openPanel,
    clearFilters,
  } = page;

  return (
    <section className="space-y-4" aria-busy={isDesktopFast ? desktopLoading : loading}>
      {isDesktopFast && desktopError && (
        <div className="app-card p-4 border border-rose-200/80 dark:border-rose-900/40 bg-rose-50/70 dark:bg-rose-950/20">
          <div className="text-sm font-bold text-rose-800 dark:text-rose-200">
            تعذر تحميل البيانات من نسخة Desktop
          </div>
          <div className="text-xs text-rose-700/90 dark:text-rose-200/80 mt-1 whitespace-pre-wrap">
            {desktopError}
          </div>
        </div>
      )}
      {isDesktopFast ? (
        desktopLoading ? (
          <>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-600 dark:text-slate-300">
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-indigo-600" aria-hidden />
                جاري تحميل القائمة وتطبيق الفلاتر…
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled
                  onClick={() => setDesktopPage((p) => Math.max(0, p - 1))}
                >
                  السابق
                </Button>
                <div className="text-sm text-slate-600 dark:text-slate-300">
                  {desktopPage + 1} / {desktopPageCount}
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled
                  onClick={() =>
                    setDesktopPage((p) => Math.min(Math.max(0, desktopPageCount - 1), p + 1))
                  }
                >
                  التالي
                </Button>
              </div>
            </div>
            <SkeletonCardGrid count={6} variant="listing" />
          </>
        ) : !desktopLoading && filter === 'all' && !search.trim() && desktopTotal === 0 ? (
          <EmptyState
            type="installments"
            message="لا توجد أقساط حالياً. سيتم إنشاء الأقساط تلقائياً عند إضافة عقود جديدة."
            actionLabel="عرض العقود"
            onAction={() => (window.location.hash = '#' + ROUTE_PATHS.CONTRACTS)}
          />
        ) : !desktopLoading && desktopTotal === 0 ? (
          <EmptyState
            type={search.trim() ? 'search' : 'filter'}
            title={search.trim() ? 'لا توجد نتائج بحث' : 'لا توجد نتائج'}
            message={
              search.trim()
                ? `لم يتم العثور على عقود تطابق "${search}"`
                : `لا توجد عقود تطابق الفلاتر المحددة`
            }
            actionLabel={search.trim() ? 'مسح البحث' : 'مسح جميع الفلاتر'}
            onAction={() => clearFilters()}
          />
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div className="text-sm text-slate-500 dark:text-slate-400">
                {desktopTotal.toLocaleString()} عقد
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={desktopLoading || desktopPage <= 0}
                  onClick={() => setDesktopPage((p) => Math.max(0, p - 1))}
                >
                  السابق
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
                  التالي
                </Button>
              </div>
            </div>

            {desktopRows.map((item, idx) => {
              const contractId = String(
                item?.contract?.رقم_العقد ?? item?.contract?.id ?? ''
              ).trim();
              const rowKey =
                contractId || `installments-desktop-p${desktopPage}-i${idx}`;
              return (
              <ContractFinancialCard
                key={rowKey}
                contract={item.contract}
                tenant={item.tenant}
                property={item.property}
                installments={Array.isArray(item.installments) ? item.installments : []}
                isAdmin={isAdmin}
                userId={userId}
                userRole={userRole}
                showDynamicColumns={showDynamicColumns}
                dynamicFields={dynamicFields}
                onPay={handlePay}
                onSelectInstallment={setSelectedInstallment}
                onFullPayment={handleFullPayment}
                onPartialPayment={handlePartialPayment}
                onReversePayment={handleReversePayment}
                onOpenMessageModal={(context) => {
                  setMessageContext(context);
                  setMessageModalOpen(true);
                }}
                openPanel={openPanel}
                initiallyExpanded={page.selectedContractId === contractId}
                highlightInstallmentId={page.highlightInstallmentId}
                onOpenStateChange={(isOpen) => {
                  if (!isOpen && page.selectedContractId === contractId) {
                    page.setSelectedContractId(null);
                  }
                  if (!isOpen && page.highlightInstallmentId) {
                    page.clearDeepLink();
                  }
                }}
              />
            );
            })}
          </>
        )
      ) : loading ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-600 dark:text-slate-300">
            <Loader2 className="h-4 w-4 animate-spin text-indigo-600" aria-hidden />
            جاري تحميل الأقساط…
          </div>
          <SkeletonCardGrid count={6} variant="listing" />
        </div>
      ) : installments.length === 0 ? (
        // حالة: لا توجد أقساط في النظام
        <EmptyState
          type="installments"
          message="لا توجد أقساط حالياً. سيتم إنشاء الأقساط تلقائياً عند إضافة عقود جديدة."
          actionLabel="عرض العقود"
          onAction={() => (window.location.hash = '#' + ROUTE_PATHS.CONTRACTS)}
        />
      ) : filteredList.length === 0 ? (
        // حالة: لا توجد نتائج بحث أو فلترة
        <EmptyState
          type={search.trim() ? 'search' : 'filter'}
          title={search.trim() ? 'لا توجد نتائج بحث' : 'لا توجد نتائج'}
          message={
            search.trim()
              ? `لم يتم العثور على عقود تطابق "${search}"`
              : `لا توجد عقود تطابق الفلاتر المحددة`
          }
          actionLabel={search.trim() ? 'مسح البحث' : 'مسح الفلاتر'}
          onAction={() => {
            setSearch('');
            setFilter('all');
          }}
        />
      ) : (
        // حالة: عرض البيانات
        filteredList.map((item) => (
          <ContractFinancialCard
            key={item.contract.رقم_العقد}
            contract={item.contract}
            tenant={item.tenant}
            property={item.property}
            installments={item.installments}
            isAdmin={isAdmin}
            userId={userId}
            userRole={userRole}
            showDynamicColumns={showDynamicColumns}
            dynamicFields={dynamicFields}
            onPay={handlePay}
            onSelectInstallment={setSelectedInstallment}
            onFullPayment={handleFullPayment}
            onPartialPayment={handlePartialPayment}
            onReversePayment={handleReversePayment}
            onOpenMessageModal={(context) => {
              setMessageContext(context);
              setMessageModalOpen(true);
            }}
            openPanel={openPanel}
            initiallyExpanded={page.selectedContractId === item.contract.رقم_العقد}
            highlightInstallmentId={page.highlightInstallmentId}
            onOpenStateChange={(isOpen) => {
              if (!isOpen && page.selectedContractId === item.contract.رقم_العقد) {
                page.setSelectedContractId(null);
              }
              if (!isOpen && page.highlightInstallmentId) {
                page.clearDeepLink();
              }
            }}
          />
        ))
      )}
    </section>
  );
}
