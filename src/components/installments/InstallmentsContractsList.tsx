import type { InstallmentsPageModel } from '@/hooks/useInstallments';
import { ROUTE_PATHS } from '@/routes/paths';
import { Loader2 } from 'lucide-react';
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
            <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl opacity-50">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
                <span className="text-xs font-bold text-slate-500">جاري التحميل...</span>
              </div>
              <div className="text-xs text-slate-400">{desktopPage + 1} / {desktopPageCount}</div>
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
            <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                  <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">
                    {desktopLoading ? '...' : desktopTotal.toLocaleString()}
                  </span>
                </div>
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">عقد</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setDesktopPage((p) => Math.max(0, p - 1))}
                  disabled={desktopLoading || desktopPage <= 0}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ transform: 'rotate(180deg)' }}><path d="M9 18l6-6-6-6"/></svg>
                  السابق
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, desktopPageCount) }, (_, i) => {
                    const cp = desktopPage + 1;
                    const tp = desktopPageCount;
                    let pg: number;
                    if (tp <= 5) { pg = i + 1; }
                    else if (cp <= 3) { pg = i + 1; }
                    else if (cp >= tp - 2) { pg = tp - 4 + i; }
                    else { pg = cp - 2 + i; }
                    return (
                      <button
                        key={pg}
                        onClick={() => setDesktopPage(pg - 1)}
                        className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${pg === cp ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                      >
                        {pg}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => setDesktopPage((p) => Math.min(Math.max(0, desktopPageCount - 1), p + 1))}
                  disabled={desktopLoading || desktopPage + 1 >= desktopPageCount}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600"
                >
                  التالي
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
                </button>
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
                  // لا تمسح deep link من بطاقات عقود أخرى عند التصيير الأولي (كان يسبب تنقلاً/فلترة عشوائية)
                  if (
                    !isOpen &&
                    page.highlightInstallmentId &&
                    page.selectedContractId === contractId
                  ) {
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
              if (
                !isOpen &&
                page.highlightInstallmentId &&
                page.selectedContractId === item.contract.رقم_العقد
              ) {
                page.clearDeepLink();
              }
            }}
          />
        ))
      )}
    </section>
  );
}
