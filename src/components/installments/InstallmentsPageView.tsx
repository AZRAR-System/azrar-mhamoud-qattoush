import './Installments.css';

import React from 'react';
import { MergeVariablesCatalog } from '@/components/shared/MergeVariablesCatalog';
import { DataGuard } from '@/components/shared/DataGuard';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { MessageComposer } from '@/components/MessageComposer';
import { AppModal } from '@/components/ui/AppModal';
import { PaymentModal } from '@/components/installments/PaymentModal';
import { InstallmentsPageHeader } from '@/components/installments/InstallmentsPageHeader';
import { InstallmentsQuickStats } from '@/components/installments/InstallmentsQuickStats';
import { InstallmentsOverdueBanner } from '@/components/installments/InstallmentsOverdueBanner';
import { InstallmentsAdvancedFilters } from '@/components/installments/InstallmentsAdvancedFilters';
import { InstallmentsChartsPanel } from '@/components/installments/InstallmentsChartsPanel';
import { InstallmentsContractsList } from '@/components/installments/InstallmentsContractsList';
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
    selectedInstallment,
    setSelectedInstallment,
    people,
    loadData,
    userId,
    userRole,
    confirmDialog,
    setConfirmDialog,
    messageModalOpen,
    setMessageModalOpen,
    messageContext,
    setMessageContext,
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
      <div className="animate-fade-in pb-10">
        <div className="mb-8 p-8 rounded-[3rem] bg-white/70 dark:bg-slate-800/70 backdrop-blur-2xl border border-white/50 dark:border-slate-700/50 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl group-hover:bg-indigo-500/20 transition-all duration-1000"></div>

          <InstallmentsPageHeader page={page} />
          <InstallmentsQuickStats page={page} />
        </div>

        <InstallmentsOverdueBanner page={page} />
        <InstallmentsAdvancedFilters page={page} />
        <InstallmentsChartsPanel page={page} />
        <InstallmentsContractsList page={page} />

        {selectedInstallment && (
          <PaymentModal
            installment={selectedInstallment}
            tenant={
              isDesktopFast
                ? desktopRows.find(
                    (r) =>
                      String(r?.contract?.رقم_العقد || r?.contract?.id || '') ===
                      String(selectedInstallment.رقم_العقد || '')
                  )?.tenant
                : people.find(
                    (p) =>
                      p.رقم_الشخص ===
                      contracts.find((c) => c.رقم_العقد === selectedInstallment.رقم_العقد)
                        ?.رقم_المستاجر
                  )
            }
            onClose={() => setSelectedInstallment(null)}
            onSuccess={() => {
              loadData();
              setSelectedInstallment(null);
            }}
            userId={userId}
            userRole={userRole}
          />
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
      </div>
    </DataGuard>
  );
}
