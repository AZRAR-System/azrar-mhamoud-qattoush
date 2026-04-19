import React, { type FC, type ReactNode } from 'react';
import {
  Check,
  Wallet,
  Home,
  FileText,
  Search,
  Lock,
  Calendar,
  MessageSquare,
  ArrowRight,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Info,
  RefreshCcw,
  Loader2,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { PaginationControls } from '@/components/shared/PaginationControls';
import { SmartPageHero } from '@/components/shared/SmartPageHero';
import { formatContractNumberShort } from '@/utils/contractNumber';
import type { useOperations } from '@/hooks/useOperations';
import type { العقود_tbl, الكمبيالات_tbl } from '@/types';
import type { InstallmentsContractsItem } from '@/types/domain.types';

// --- Step-by-Step Payment Flow Component ---
interface PaymentStepProps {
  step: number;
  totalSteps: number;
  status: 'pending' | 'current' | 'completed';
  title: string;
  description: string;
  icon: ReactNode;
  children?: ReactNode;
}

const PaymentStep: FC<PaymentStepProps> = ({
  step,
  totalSteps,
  status,
  title,
  description,
  icon,
  children,
}) => {
  const getStatusColor = () => {
    if (status === 'completed') return 'border-green-500 bg-green-50 dark:bg-green-900/20';
    if (status === 'current')
      return 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 ring-2 ring-indigo-500/20';
    return 'border-gray-200 dark:border-gray-700 opacity-50';
  };

  const getIconColor = () => {
    if (status === 'completed') return 'bg-green-500 text-white';
    if (status === 'current') return 'bg-indigo-600 text-white';
    return 'bg-gray-300 text-gray-600';
  };

  return (
    <div className={`border-2 rounded-2xl p-6 transition-all duration-500 ${getStatusColor()}`}>
      <div className="flex items-start gap-5">
        <div
          className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-lg ${getIconColor()}`}
        >
          {status === 'completed' ? <Check size={24} /> : icon}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <h4 className="font-black text-lg text-slate-800 dark:text-white">{title}</h4>
            <span className="text-xs font-mono font-black text-slate-400 bg-slate-50 dark:bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-100 dark:border-slate-700">
              {step}/{totalSteps}
            </span>
          </div>
          <p className="text-sm font-bold text-slate-600 dark:text-slate-400 mb-4">{description}</p>

          {status === 'current' && children && (
            <div className="mt-6 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-indigo-100 dark:border-indigo-800 shadow-soft">
              {children}
            </div>
          )}

          {status === 'completed' && (
            <div className="text-xs text-green-600 dark:text-green-400 font-black flex items-center gap-1.5 mt-2">
              <CheckCircle2 size={16} /> تم إكمال هذه الخطوة بنجاح
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface OperationsPageViewProps {
  page: ReturnType<typeof useOperations>;
}

export const OperationsPageView: React.FC<OperationsPageViewProps> = ({ page }) => {
  const {
    isDesktopFast,
    desktopUnsupported,
    currentStep,
    setCurrentStep,
    selectedContract,
    selectedInstallment,
    setSelectedInstallment,
    paidAmount,
    setPaidAmount,
    paymentDate,
    setPaymentDate,
    paymentNotes,
    setPaymentNotes,
    search,
    setSearch,
    contractsPage,
    setContractsPage,
    pendingPage,
    setPendingPage,
    fastRows,
    fastLoading,
    contractsTotal,
    contractsPageCount,
    contractsPageSize,
    pendingInstallments,
    pendingPageCount,
    pendingPageSize,
    filteredContracts,
    loadData,
    handleSelectContract,
    handleSelectContractFast,
    handleSelectInstallment,
    handlePaymentDetailsSubmit,
    handleConfirmPayment,
    getTenant,
    getProperty,
  } = page;

  return (
    <div className="animate-fade-in pb-10 space-y-8">
      <SmartPageHero
        title="العمليات والإجراءات"
        description="سداد دفعات العقود وتوثيقها تلقائياً ضمن سجل العمليات"
        icon={Wallet}
        actions={
          <Button
            variant="secondary"
            onClick={loadData}
            className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-black px-6 py-3 rounded-2xl shadow-soft hover:shadow-md transition-all active:scale-95"
            leftIcon={<RefreshCcw size={20} />}
          >
            تحديث البيانات
          </Button>
        }
      />

      {/* Progress Indicator */}
      {currentStep !== 'select-contract' && currentStep !== 'complete' && (
        <Card className="p-6 rounded-3xl border-none shadow-soft overflow-hidden relative group">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 to-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
          <div className="flex items-center justify-between relative z-10">
            <div
              className={`flex items-center gap-3 text-sm font-black transition-colors ${
                currentStep === 'select-installment' ||
                currentStep === 'payment-details' ||
                currentStep === 'confirmation'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-slate-400'
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                  currentStep === 'select-installment' ||
                  currentStep === 'payment-details' ||
                  currentStep === 'confirmation'
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                    : 'border-slate-200 dark:border-slate-700'
                }`}
              >
                <CheckCircle2 size={16} />
              </div>
              اختيار العقد
            </div>
            <ArrowRight size={16} className="text-slate-200 dark:text-slate-700" />
            <div
              className={`flex items-center gap-3 text-sm font-black transition-colors ${
                currentStep === 'select-installment' ||
                currentStep === 'payment-details' ||
                currentStep === 'confirmation'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-slate-400'
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                  currentStep === 'select-installment' ||
                  currentStep === 'payment-details' ||
                  currentStep === 'confirmation'
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                    : 'border-slate-200 dark:border-slate-700'
                }`}
              >
                <DollarSign size={16} />
              </div>
              اختيار الدفعة
            </div>
            <ArrowRight size={16} className="text-slate-200 dark:text-slate-700" />
            <div
              className={`flex items-center gap-3 text-sm font-black transition-colors ${
                currentStep === 'payment-details' || currentStep === 'confirmation'
                  ? 'text-indigo-600 dark:text-indigo-400'
                  : 'text-slate-400'
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                  currentStep === 'payment-details' || currentStep === 'confirmation'
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                    : 'border-slate-200 dark:border-slate-700'
                }`}
              >
                <Wallet size={16} />
              </div>
              تفاصيل السداد
            </div>
            <ArrowRight size={16} className="text-slate-200 dark:text-slate-700" />
            <div
              className={`flex items-center gap-3 text-sm font-black transition-colors ${
                currentStep === 'confirmation'
                  ? 'text-indigo-600 dark:text-indigo-400'
                  : 'text-slate-400'
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                  currentStep === 'confirmation'
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                    : 'border-slate-200 dark:border-slate-700'
                }`}
              >
                <Check size={16} />
              </div>
              التأكيد
            </div>
          </div>
        </Card>
      )}

      {/* Steps Container */}
      <div className="max-w-4xl space-y-8">
        {/* ========== STEP 1: Select Contract ========== */}
        {currentStep !== 'complete' && (
          <PaymentStep
            step={1}
            totalSteps={4}
            status={
              currentStep === 'select-contract'
                ? 'current'
                : currentStep === 'select-installment' ||
                    currentStep === 'payment-details' ||
                    currentStep === 'confirmation'
                  ? 'completed'
                  : 'pending'
            }
            title="اختيار العقد"
            description="اختر العقد الذي تريد تسديد دفعاته"
            icon={<FileText size={24} />}
          >
            {currentStep === 'select-contract' && (
              <div className="space-y-6">
                <div className="relative group">
                  <Search
                    size={20}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors"
                  />
                  <Input
                    type="text"
                    placeholder="بحث: اسم المستأجر، رقم العقد، كود العقار..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pr-12 py-3.5 bg-slate-50 dark:bg-slate-950 border-slate-100 dark:border-slate-800 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all font-bold"
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 max-h-[500px] overflow-y-auto pr-2 no-scrollbar">
                  {desktopUnsupported ? (
                    <div className="app-card p-12 text-center">
                      <Lock size={48} className="mx-auto mb-4 text-amber-500 opacity-50" />
                      <p className="text-base font-black text-slate-800 dark:text-white">
                        غير مدعوم في وضع الديسكتوب الحالي
                      </p>
                      <p className="text-xs text-slate-500 mt-2 font-bold">
                        يرجى تشغيل وضع السرعة/SQL أو تحديث نسخة الديسكتوب.
                      </p>
                    </div>
                  ) : null}

                  {isDesktopFast ? (
                    fastLoading ? (
                      <div className="p-12 text-center text-slate-400 font-bold">
                        <Loader2 className="animate-spin mx-auto mb-2" size={32} />
                        جاري تحميل البيانات...
                      </div>
                    ) : fastRows.length === 0 ? (
                      <div className="p-12 text-center text-slate-400 font-bold">
                        <Search size={48} className="mx-auto mb-4 opacity-20" />
                        لا توجد عقود مطابقة
                      </div>
                    ) : (
                      fastRows
                        .slice(
                          (contractsPage - 1) * contractsPageSize,
                          contractsPage * contractsPageSize
                        )
                        .map((row: InstallmentsContractsItem) => {
                          const contract = row.contract;
                          const tenantName = String(row.tenant?.الاسم || '').trim() || '—';
                          const propertyCode = String(row.property?.الكود_الداخلي || '').trim() || '—';
                          const contractId = String(contract?.رقم_العقد || '').trim();
                          const contractInstalls = (
                            Array.isArray(row.installments) ? row.installments : []
                          ).filter(
                            (i) =>
                              String(i.رقم_العقد || '') === contractId &&
                              String(i.حالة_الكمبيالة || '') !== 'مدفوع' &&
                              String(i.نوع_الكمبيالة || '') !== 'تأمين'
                          );

                          return (
                            <button
                              key={contractId || Math.random()}
                              onClick={() => handleSelectContractFast(row)}
                              className="w-full text-right p-5 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all group relative group"
                            >
                              <div className="flex items-center justify-between mb-3">
                                <span className="font-black text-slate-800 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                  {tenantName}
                                </span>
                                <span className="text-xs font-mono font-black text-slate-400 bg-slate-50 dark:bg-slate-900 px-2 py-0.5 rounded-lg border border-slate-100 dark:border-slate-800">
                                  #{formatContractNumberShort(contractId)}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-slate-500">
                                <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900 px-2 py-1 rounded-full border border-slate-100 dark:border-slate-800">
                                  <Home size={12} className="text-emerald-500" />
                                  {propertyCode}
                                </div>
                                <div className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded-full border border-amber-100 dark:border-amber-800/50 text-amber-600">
                                  <AlertCircle size={12} />
                                  {contractInstalls.length} دفعات معلقة
                                </div>
                              </div>
                            </button>
                          );
                        })
                    )
                  ) : !desktopUnsupported && filteredContracts.length === 0 ? (
                    <div className="p-12 text-center text-slate-400 font-bold">
                      <Search size={48} className="mx-auto mb-4 opacity-20" />
                      لا توجد عقود مطابقة
                    </div>
                  ) : (
                    (desktopUnsupported ? [] : filteredContracts)
                      .slice(
                        (contractsPage - 1) * contractsPageSize,
                        contractsPage * contractsPageSize
                      )
                      .map((contract: العقود_tbl) => {
                        const tenant = getTenant(contract);
                        const property = getProperty(contract);
                        const contractInstalls = pendingInstallments.filter(
                          (i) => i.رقم_العقد === contract.رقم_العقد
                        );

                        return (
                          <button
                            key={contract.رقم_العقد}
                            onClick={() => handleSelectContract(contract)}
                            className="w-full text-right p-5 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all group relative"
                          >
                            <div className="flex items-center justify-between mb-3">
                              <span className="font-black text-slate-800 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                {tenant?.الاسم}
                              </span>
                              <span className="text-xs font-mono font-black text-slate-400 bg-slate-50 dark:bg-slate-900 px-2 py-0.5 rounded-lg border border-slate-100 dark:border-slate-800">
                                #{formatContractNumberShort(contract.رقم_العقد)}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-slate-500">
                              <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900 px-2 py-1 rounded-full border border-slate-100 dark:border-slate-800">
                                <Home size={12} className="text-emerald-500" />
                                {property?.الكود_الداخلي}
                              </div>
                              <div className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded-full border border-amber-100 dark:border-amber-800/50 text-amber-600">
                                <AlertCircle size={12} />
                                {contractInstalls.length} دفعات معلقة
                              </div>
                            </div>
                          </button>
                        );
                      })
                  )}
                </div>

                {!desktopUnsupported && contractsTotal > 0 ? (
                  <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                    <PaginationControls
                      page={contractsPage}
                      pageCount={contractsPageCount}
                      onPageChange={setContractsPage}
                    />
                  </div>
                ) : null}
              </div>
            )}
          </PaymentStep>
        )}

        {/* ========== STEP 2: Select Installment ========== */}
        {currentStep !== 'complete' && selectedContract && (
          <PaymentStep
            step={2}
            totalSteps={4}
            status={
              currentStep === 'select-installment'
                ? 'current'
                : currentStep === 'payment-details' || currentStep === 'confirmation'
                  ? 'completed'
                  : 'pending'
            }
            title="اختيار الدفعة"
            description={`اختر الدفعة المراد تسديدها من العقد #${formatContractNumberShort(selectedContract.رقم_العقد)}`}
            icon={<Wallet size={24} />}
          >
            {(currentStep === 'select-installment' ||
              currentStep === 'payment-details' ||
              currentStep === 'confirmation') && (
              <div className="space-y-4">
                {pendingInstallments.length === 0 ? (
                  <div className="text-center py-12 bg-emerald-50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-100 dark:border-emerald-800">
                    <CheckCircle2 size={48} className="mx-auto mb-4 text-emerald-500" />
                    <p className="font-black text-emerald-900 dark:text-emerald-400">
                      ✅ جميع الدفعات مسددة!
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 max-h-[400px] overflow-y-auto pr-2 no-scrollbar">
                    {pendingInstallments
                      .slice((pendingPage - 1) * pendingPageSize, pendingPage * pendingPageSize)
                      .map((inst: الكمبيالات_tbl) => {
                        const isLate = new Date(inst.تاريخ_استحقاق) < new Date();
                        return (
                          <button
                            key={inst.رقم_الكمبيالة}
                            onClick={() =>
                              currentStep === 'select-installment' && handleSelectInstallment(inst)
                            }
                            disabled={currentStep !== 'select-installment'}
                            className={`w-full text-right p-5 rounded-2xl border transition-all relative overflow-hidden ${
                              selectedInstallment?.رقم_الكمبيالة === inst.رقم_الكمبيالة
                                ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 ring-2 ring-indigo-500/10 shadow-soft'
                                : 'border-slate-100 dark:border-slate-800'
                            } ${
                              currentStep === 'select-installment'
                                ? 'hover:border-indigo-500 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer'
                                : 'opacity-75'
                            }`}
                          >
                            <div className="flex items-center justify-between relative z-10">
                              <div className="text-right">
                                <div className="text-lg font-black text-slate-800 dark:text-white mb-1">
                                  {inst.القيمة.toLocaleString()} د.أ
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-black text-slate-400 uppercase tracking-widest bg-slate-50 dark:bg-slate-900 px-2 py-0.5 rounded-lg border border-slate-100 dark:border-slate-800">
                                    استحقاق: {inst.تاريخ_استحقاق}
                                  </span>
                                  {isLate && (
                                    <StatusBadge
                                      status="متأخرة"
                                      showIcon={false}
                                      className="!rounded-lg !text-[10px] !px-2 !py-0.5 font-black uppercase tracking-widest"
                                    />
                                  )}
                                </div>
                              </div>
                              <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-900 flex items-center justify-center text-slate-300 border border-slate-100 dark:border-slate-800">
                                <DollarSign size={20} />
                              </div>
                            </div>
                            {selectedInstallment?.رقم_الكمبيالة === inst.رقم_الكمبيالة && (
                              <div className="absolute top-0 right-0 w-1 h-full bg-indigo-500" />
                            )}
                          </button>
                        );
                      })}
                  </div>
                )}

                {pendingInstallments.length > 0 ? (
                  <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                    <PaginationControls
                      page={pendingPage}
                      pageCount={pendingPageCount}
                      onPageChange={setPendingPage}
                    />
                  </div>
                ) : null}
              </div>
            )}
          </PaymentStep>
        )}

        {/* ========== STEP 3: Payment Details ========== */}
        {currentStep !== 'complete' && selectedInstallment && (
          <PaymentStep
            step={3}
            totalSteps={4}
            status={
              currentStep === 'payment-details'
                ? 'current'
                : currentStep === 'confirmation'
                  ? 'completed'
                  : 'pending'
            }
            title="تفاصيل السداد"
            description="أدخل معلومات السداد والملاحظات"
            icon={<DollarSign size={24} />}
          >
            {(currentStep === 'payment-details' || currentStep === 'confirmation') && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-black text-slate-700 dark:text-slate-300 mb-3 text-right">
                    المبلغ المدفوع
                  </label>
                  <div className="relative group">
                    <Input
                      type="number"
                      value={paidAmount}
                      onChange={(e) => setPaidAmount(Number(e.target.value))}
                      disabled={currentStep === 'confirmation'}
                      className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-950 border-slate-100 dark:border-slate-800 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all font-black text-lg text-right"
                      max={selectedInstallment.القيمة}
                      min={0}
                    />
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-400 uppercase tracking-widest text-xs">
                      د.أ
                    </span>
                  </div>
                  {paidAmount < selectedInstallment.القيمة && paidAmount > 0 && (
                    <div className="mt-3 p-3 bg-orange-50 dark:bg-orange-900/10 rounded-xl border border-orange-100 dark:border-orange-900/30 flex items-center gap-2 text-xs font-black text-orange-600 dark:text-orange-400">
                      <AlertCircle size={14} />
                      دفعة جزئية - المبلغ المتبقي ذمة:{' '}
                      {(selectedInstallment.القيمة - paidAmount).toLocaleString()} د.أ
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-black text-slate-700 dark:text-slate-300 mb-3 text-right flex items-center gap-2 justify-end">
                      تاريخ الدفع <Calendar size={16} className="text-indigo-500" />
                    </label>
                    <Input
                      type="date"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      disabled={currentStep === 'confirmation'}
                      className="w-full px-4 py-3.5 bg-slate-50 dark:bg-slate-950 border-slate-100 dark:border-slate-800 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-black text-slate-700 dark:text-slate-300 mb-3 text-right flex items-center gap-2 justify-end">
                      ملاحظات السداد <MessageSquare size={16} className="text-indigo-500" />
                    </label>
                    <textarea
                      value={paymentNotes}
                      onChange={(e) => setPaymentNotes(e.target.value)}
                      placeholder="مثال: تحويل بنكي، سداد نقدي..."
                      disabled={currentStep === 'confirmation'}
                      className="w-full h-[52px] px-4 py-3 bg-slate-50 dark:bg-slate-950 border-slate-100 dark:border-slate-800 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all font-bold text-sm resize-none no-scrollbar"
                    />
                  </div>
                </div>

                {currentStep === 'payment-details' && (
                  <div className="flex gap-4 pt-4">
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setCurrentStep('select-installment');
                        setSelectedInstallment(null);
                      }}
                      className="bg-slate-50 dark:bg-slate-800 border-none text-slate-500 font-black px-8 py-4 rounded-2xl transition-all hover:bg-slate-100 dark:hover:bg-slate-700"
                    >
                      رجوع
                    </Button>
                    <Button
                      variant="primary"
                      className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 rounded-2xl shadow-lg shadow-indigo-500/20 transition-all active:scale-[0.98]"
                      onClick={handlePaymentDetailsSubmit}
                      rightIcon={<ArrowRight size={20} />}
                    >
                      التالي: تأكيد السداد
                    </Button>
                  </div>
                )}
              </div>
            )}
          </PaymentStep>
        )}

        {/* ========== STEP 4: Confirmation ========== */}
        {currentStep !== 'complete' &&
          selectedInstallment &&
          selectedContract &&
          currentStep === 'confirmation' && (
            <PaymentStep
              step={4}
              totalSteps={4}
              status="current"
              title="تأكيد السداد"
              description="تحقق من البيانات والتأكيد النهائي قبل المعالجة"
              icon={<Check size={24} />}
            >
              <div className="space-y-8">
                {/* Summary Card */}
                <div className="bg-gradient-to-br from-indigo-600 to-blue-700 p-8 rounded-[2.5rem] text-white shadow-xl shadow-indigo-500/20 relative overflow-hidden group">
                  <div className="absolute -right-8 -bottom-8 opacity-10 group-hover:rotate-12 transition-transform duration-1000">
                    <DollarSign size={160} />
                  </div>
                  
                  <div className="relative z-10">
                    <h4 className="font-black text-xl mb-6 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center">
                        <Info size={20} />
                      </div>
                      ملخص العملية النهائية
                    </h4>
                    
                    <div className="space-y-4">
                      <div className="flex justify-between items-center py-3 border-b border-white/10">
                        <span className="text-white/60 font-bold">اسم المستأجر</span>
                        <span className="font-black text-lg">{getTenant(selectedContract)?.الاسم}</span>
                      </div>
                      <div className="flex justify-between items-center py-3 border-b border-white/10">
                        <span className="text-white/60 font-bold">رقم العقد</span>
                        <span className="font-mono font-black py-1 px-3 bg-white/10 rounded-lg">
                          #{formatContractNumberShort(selectedContract.رقم_العقد)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-3 border-b border-white/10">
                        <span className="text-white/60 font-bold">العقار</span>
                        <span className="font-black">{getProperty(selectedContract)?.الكود_الداخلي}</span>
                      </div>
                      
                      <div className="pt-6 flex justify-between items-end">
                        <div>
                          <div className="text-white/60 text-xs font-black uppercase tracking-widest mb-1">المبلغ النهائي للسداد</div>
                          <div className="text-4xl font-black">{paidAmount.toLocaleString()} <span className="text-lg">د.أ</span></div>
                        </div>
                        {paidAmount < selectedInstallment.القيمة && (
                          <div className="text-right">
                            <div className="text-white/60 text-[10px] font-black uppercase tracking-widest mb-1">المتبقي ذمة</div>
                            <div className="text-xl font-black text-orange-200">{(selectedInstallment.القيمة - paidAmount).toLocaleString()} د.أ</div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Confirmation Buttons */}
                <div className="flex gap-4">
                  <Button
                    variant="secondary"
                    className="flex-1 bg-slate-50 dark:bg-slate-800 border-none text-slate-500 font-black py-4 rounded-2xl transition-all hover:bg-slate-100 dark:hover:bg-slate-700"
                    onClick={() => setCurrentStep('payment-details')}
                  >
                    رجوع للتعديل
                  </Button>
                  <Button
                    variant="primary"
                    className="flex-[1.5] bg-emerald-600 hover:bg-emerald-700 text-white font-black py-4 rounded-2xl shadow-lg shadow-emerald-500/20 transition-all active:scale-[0.98]"
                    onClick={handleConfirmPayment}
                    leftIcon={<Check size={20} />}
                  >
                    تأكيد السداد والترحيل النهائي
                  </Button>
                </div>
              </div>
            </PaymentStep>
          )}

        {/* ========== STEP 5: Success State ========== */}
        {currentStep === 'complete' && (
          <div className="app-card p-20 text-center animate-bounce-in relative overflow-hidden bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/10 dark:to-teal-900/10 border-emerald-100 dark:border-emerald-800 shadow-xl shadow-emerald-500/5">
             <div className="absolute -top-12 -right-12 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl" />
             <div className="absolute -bottom-12 -left-12 w-40 h-40 bg-teal-500/10 rounded-full blur-3xl" />
             
             <div className="relative z-10">
                <div className="w-24 h-24 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-lg shadow-emerald-500/30 animate-float">
                  <Check size={48} />
                </div>
                <h3 className="text-3xl font-black text-emerald-900 dark:text-emerald-400 mb-4">
                  تمت العملية بنجاح!
                </h3>
                <p className="text-emerald-700/60 dark:text-emerald-500/60 text-lg font-bold max-w-md mx-auto leading-relaxed">
                  تم تسجيل مبلغ <span className="text-emerald-600 dark:text-emerald-400 font-black px-2 py-0.5 bg-white/50 dark:bg-emerald-900/40 rounded-lg">{paidAmount.toLocaleString()} د.أ</span> في حساب المستأجر وتحديث سجلات العقود والعمليات فوراً.
                </p>
                <div className="mt-10 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] flex items-center justify-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  سيتم العودة للبداية تلقائياً خلال ثوانٍ
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                </div>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};
