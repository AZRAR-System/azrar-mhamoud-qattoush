import './Installments.css';

import { MergeVariablesCatalog } from '@/components/shared/MergeVariablesCatalog';
import { DataGuard } from '@/components/shared/DataGuard';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { MessageComposer } from '@/components/MessageComposer';
import { AppModal } from '@/components/ui/AppModal';
import { InstallmentsSmartFilterBar } from '@/components/installments/InstallmentsSmartFilterBar';

import { InstallmentsQuickStats } from '@/components/installments/InstallmentsQuickStats';
import { InstallmentsOverdueBanner } from '@/components/installments/InstallmentsOverdueBanner';
import { InstallmentsChartsPanel } from '@/components/installments/InstallmentsChartsPanel';
import { InstallmentsContractsList } from '@/components/installments/InstallmentsContractsList';
import { PageLayout } from '@/components/shared/PageLayout';
import type { InstallmentsPageModel } from '@/hooks/useInstallments';

type Props = { page: InstallmentsPageModel };

export function InstallmentsPageView({ page }: Props) {
  const {
    isDesktopFast,
    desktopCounts,
    desktopTotal,
    desktopRows,
    desktopLoading,
    contracts,
    confirmDialog,
    setConfirmDialog,
    messageModalOpen,
    setMessageModalOpen,
    messageContext,
    setMessageContext,
    openOnlyTargetPanel,
  } = page;

  return (
    <DataGuard
      check={() => {
        const desktopCountsKnown = isDesktopFast && desktopCounts !== null;
        const desktopHasAny = isDesktopFast && (desktopTotal > 0 || desktopRows.length > 0);

        const hasContracts = isDesktopFast
          ? desktopLoading
            ? true
            : desktopHasAny
              ? true
              : desktopCountsKnown
                ? Number(desktopCounts?.contracts || 0) > 0
                : true
          : contracts.length > 0;

        const missingData: string[] = [];
        if (!hasContracts && (!isDesktopFast || desktopCountsKnown)) missingData.push('contracts');

        return {
          isValid: hasContracts,
          message:
            isDesktopFast && !desktopCountsKnown
              ? 'جاري التحقق من البيانات...'
              : 'لا توجد عقود في النظام. يتم إنشاء الأقساط تلقائياً عند إضافة عقود.',
          missingData,
        };
      }}
      emptyMessage="لا يمكن عرض الأقساط بدون عقود"
      actionLabel="إنشاء عقد"
      actionLink="#/contracts"
    >
      {openOnlyTargetPanel ? (
        <div className="min-h-[min(600px,80vh)]">
          <InstallmentsContractsList page={page} />
        </div>
      ) : (
        <PageLayout>
          <div className="space-y-6">
            <InstallmentsSmartFilterBar
              search={page.search}
              setSearch={page.setSearch}
              status={page.filter}
              setStatus={(v) => page.setFilter(v as 'all' | 'due' | 'debt' | 'paid')}
              startDate={page.filterStartDate}
              setStartDate={page.setFilterStartDate}
              endDate={page.filterEndDate}
              setEndDate={page.setFilterEndDate}
              minAmount={page.filterMinAmount}
              setMinAmount={page.setFilterMinAmount}
              maxAmount={page.filterMaxAmount}
              setMaxAmount={page.setFilterMaxAmount}
              paymentMethod={page.filterPaymentMethod}
              setPaymentMethod={page.setFilterPaymentMethod}
              onRefresh={page.loadData}
              onExportXlsx={page.handleExportExcel}
              totalResults={isDesktopFast ? desktopTotal : page.filteredList.length}
              currentPage={page.desktopPage}
              totalPages={page.desktopPageCount}
              onPageChange={page.setDesktopPage}
              isLoading={page.loading}
            />
            <InstallmentsQuickStats page={page} />
            <InstallmentsOverdueBanner page={page} />
            
            <div className="page-transition min-h-[min(600px,80vh)]">
              <InstallmentsChartsPanel page={page} />
              <InstallmentsContractsList page={page} />
            </div>
          </div>
        </PageLayout>
      )}

        <ConfirmDialog
          isOpen={confirmDialog.isOpen}
          type={confirmDialog.type}
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmText={confirmDialog.confirmText}
          cancelText={confirmDialog.cancelText}
          onConfirm={() => {
            setConfirmDialog({ ...confirmDialog, isOpen: false, action: null, reverseReason: '' });
            confirmDialog.action?.();
          }}
          onCancel={() => {
            setConfirmDialog({ ...confirmDialog, isOpen: false, action: null, reverseReason: '' });
          }}
        >
          {confirmDialog.showReasonField && (
            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-800 dark:text-slate-200">
                سبب عكس السداد (إلزامي)
              </label>
              <textarea
                value={confirmDialog.reverseReason}
                onChange={(e) =>
                  setConfirmDialog({ ...confirmDialog, reverseReason: e.target.value })
                }
                placeholder="أدخل السبب: خطأ في الدفع، دفعة مكررة، الخ..."
                className="w-full h-24 p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400">
                ملاحظة: لن يكتمل عكس السداد بدون كتابة السبب.
              </p>
            </div>
          )}
        </ConfirmDialog>

        {messageModalOpen && messageContext && (
          <AppModal
            open
            title="كاتب الرسائل"
            onClose={() => {
              setMessageModalOpen(false);
              setMessageContext(null);
            }}
            size="2xl"
          >
            <div className="mb-4">
              <MergeVariablesCatalog
                title="متغيرات الدمج (العقد / العقار / المستأجر / الكمبيالة)"
                maxHeightClassName="max-h-48"
              />
            </div>

            <MessageComposer
              category={messageContext.category}
              tenantName={messageContext.tenant.الاسم}
              tenantPhones={
                [messageContext.tenant.رقم_الهاتف, messageContext.tenant.رقم_هاتف_اضافي].filter(
                  Boolean
                ) as string[]
              }
              propertyCode={messageContext.property?.الكود_الداخلي}
              amount={messageContext.installment.القيمة}
              dueDate={messageContext.installment.تاريخ_استحقاق}
              daysLate={Math.max(
                0,
                Math.ceil(
                  (new Date().getTime() -
                    new Date(messageContext.installment.تاريخ_استحقاق).getTime()) /
                    (1000 * 60 * 60 * 24)
                )
              )}
              contractNumber={messageContext.contract.رقم_العقد}
              remainingAmount={
                messageContext.installment.القيمة_المتبقية || messageContext.installment.القيمة
              }
              overdueInstallmentsCount={messageContext.overdueInstallmentsCount}
              overdueAmountTotal={messageContext.overdueAmountTotal}
              overdueInstallmentsDetails={messageContext.overdueInstallmentsDetails}
              onClose={() => {
                setMessageModalOpen(false);
                setMessageContext(null);
              }}
              onSent={(messageText: string) => {
                console.warn('Message sent:', messageText);
              }}
            />
          </AppModal>
        )}
    </DataGuard>
  );
}
