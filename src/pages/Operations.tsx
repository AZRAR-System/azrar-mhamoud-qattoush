import React, { useState, useEffect, useRef } from "react";
import { DbService } from "@/services/mockDb";
import { الكمبيالات_tbl, العقود_tbl, الأشخاص_tbl, العقارات_tbl } from "@/types";
import { formatContractNumberShort } from "@/utils/contractNumber";
import {
  Check,
  AlertTriangle,
  Wallet,
  ChevronDown,
  Home,
  FileText,
  Search,
  Lock,
  RefreshCcw,
  Calendar,
  MessageSquare,
  ArrowRight,
  Clock,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Info
} from "lucide-react";
import { useSmartModal } from "@/context/ModalContext";
import { useToast } from "@/context/ToastContext";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { DS } from "@/constants/designSystem";
import { useAuth } from "@/context/AuthContext";
import { notificationService } from "@/services/notificationService";
import { useDbSignal } from '@/hooks/useDbSignal';
import { storage } from '@/services/storage';
import { installmentsContractsPagedSmart } from '@/services/domainQueries';

// --- Step-by-Step Payment Flow ---
interface PaymentStepProps {
  step: number;
  totalSteps: number;
  status: 'pending' | 'current' | 'completed';
  title: string;
  description: string;
  icon: React.ReactNode;
  children?: React.ReactNode;
}

const PaymentStep: React.FC<PaymentStepProps> = ({ 
  step, 
  totalSteps, 
  status, 
  title, 
  description, 
  icon, 
  children 
}) => {
  const getStatusColor = () => {
    if (status === 'completed') return 'border-green-500 bg-green-50 dark:bg-green-900/20';
    if (status === 'current') return 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 ring-2 ring-indigo-500/20';
    return 'border-gray-200 dark:border-gray-700 opacity-50';
  };

  const getIconColor = () => {
    if (status === 'completed') return 'bg-green-500 text-white';
    if (status === 'current') return 'bg-indigo-600 text-white';
    return 'bg-gray-300 text-gray-600';
  };

  return (
    <div className={`border-2 rounded-lg p-4 transition-all duration-300 ${getStatusColor()}`}>
      <div className="flex items-start gap-4">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${getIconColor()}`}>
          {status === 'completed' ? <Check size={20} /> : icon}
        </div>

        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <h4 className="font-bold text-slate-800 dark:text-white">{title}</h4>
            <span className="text-xs font-mono text-slate-400">
              {step}/{totalSteps}
            </span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">{description}</p>
          
          {status === 'current' && children && (
            <div className="mt-4 bg-white dark:bg-slate-800 p-4 rounded-lg border border-indigo-200 dark:border-indigo-800">
              {children}
            </div>
          )}

          {status === 'completed' && (
            <div className="text-xs text-green-600 font-bold flex items-center gap-1">
              <CheckCircle2 size={14} /> تم إكمال هذه الخطوة
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// --- Main Operations/Procedures Page ---
export const Operations: React.FC = () => {
  const dbSignal = useDbSignal();
  const isDesktop = storage.isDesktop() && !!(window as any)?.desktopDb;
  const isDesktopFast = isDesktop && !!(window as any)?.desktopDb?.domainInstallmentsContractsSearch;
  const desktopUnsupported = isDesktop && !isDesktopFast;
  const warnedUnsupportedRef = useRef(false);
  // State Management
  const [currentStep, setCurrentStep] = useState<'select-contract' | 'select-installment' | 'payment-details' | 'confirmation' | 'complete'>('select-contract');
  const [selectedContract, setSelectedContract] = useState<العقود_tbl | null>(null);
  const [selectedInstallment, setSelectedInstallment] = useState<الكمبيالات_tbl | null>(null);
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [paymentNotes, setPaymentNotes] = useState<string>('');
  
  // Data
  const [contracts, setContracts] = useState<العقود_tbl[]>([]);
  const [people, setPeople] = useState<الأشخاص_tbl[]>([]);
  const [properties, setProperties] = useState<العقارات_tbl[]>([]);
  const [installments, setInstallments] = useState<الكمبيالات_tbl[]>([]);
  const [search, setSearch] = useState("");

  // Desktop fast mode: SQL-backed contract list (with installments) to avoid huge array loads
  const [fastRows, setFastRows] = useState<Array<{ contract: any; tenant?: any; property?: any; installments?: any[]; hasDebt?: boolean; hasDueSoon?: boolean; isFullyPaid?: boolean }>>([]);
  const [fastLoading, setFastLoading] = useState(false);
  
  const toast = useToast();
  const { user } = useAuth();
  const userId = user?.id || 'system';
  const userRole = user?.الدور || 'Employee';

  // Operations page: silent mode (no audio confirmations)
  const notifyInfo = (message: string, title?: string) => notificationService.info(message, title, { sound: false });
  const notifySuccess = (message: string, title?: string) => notificationService.success(message, title, { sound: false });
  const notifyWarning = (message: string, title?: string) => notificationService.warning(message, title, { sound: false });
  const notifyInstallmentPaid = (amount: number, tenantName: string) =>
    notificationService.installmentPaid(amount, tenantName); // This one is business-specific; keep it consistent

  // Load data
  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbSignal]);

  const loadData = () => {
    if (isDesktopFast) {
      setContracts([]);
      setPeople([]);
      setProperties([]);
      setInstallments([]);
      return;
    }

    // Desktop focus: never load huge arrays in renderer.
    if (desktopUnsupported) {
      setContracts([]);
      setPeople([]);
      setProperties([]);
      setInstallments([]);
      if (!warnedUnsupportedRef.current) {
        warnedUnsupportedRef.current = true;
        toast.warning('صفحة العمليات تحتاج وضع السرعة/SQL في نسخة الديسكتوب');
      }
      return;
    }

    setContracts(DbService.getContracts().filter(c => !c.isArchived));
    setPeople(DbService.getPeople());
    setProperties(DbService.getProperties());
    setInstallments(DbService.getInstallments());
  };

  useEffect(() => {
    if (!isDesktopFast) return;
    let alive = true;
    setFastLoading(true);

    const run = async () => {
      try {
        const res = await installmentsContractsPagedSmart({ query: String(search || '').trim(), filter: 'all', offset: 0, limit: 50 });
        if (!alive) return;
        setFastRows(Array.isArray(res.items) ? res.items : []);
      } finally {
        if (alive) setFastLoading(false);
      }
    };

    void run();
    return () => {
      alive = false;
    };
  }, [isDesktopFast, dbSignal, search]);

  // Get filtered contracts for search (legacy/web). Desktop uses fastRows.
  const filteredContracts = isDesktopFast
    ? []
    : contracts.filter(c => {
        const tenant = people.find(p => p.رقم_الشخص === c.رقم_المستاجر);
        const property = properties.find(p => p.رقم_العقار === c.رقم_العقار);
        const lower = String(search || '').toLowerCase();
        
        return (
          String(tenant?.الاسم || '').toLowerCase().includes(lower) ||
          String(property?.الكود_الداخلي || '').toLowerCase().includes(lower) ||
          String(c.رقم_العقد || '').toLowerCase().includes(lower)
        );
      });

  // Get unpaid installments for selected contract
  const pendingInstallments = selectedContract
    ? installments.filter(i => 
        i.رقم_العقد === selectedContract.رقم_العقد && 
        i.حالة_الكمبيالة !== 'مدفوع' && 
        i.نوع_الكمبيالة !== 'تأمين'
      )
    : [];

  // Handlers
  const handleSelectContract = (contract: العقود_tbl) => {
    setSelectedContract(contract);
    setPaidAmount(0);
    setPaymentNotes('');
    setSelectedInstallment(null);
    setCurrentStep('select-installment');
    notifyInfo('تم اختيار العقد - اختر الدفعة', 'خطوة 2');
  };

  const handleSelectContractFast = (row: any) => {
    const contract = (row?.contract || null) as العقود_tbl | null;
    if (!contract) return;
    setSelectedContract(contract);
    setPaidAmount(0);
    setPaymentNotes('');
    setSelectedInstallment(null);
    setInstallments((Array.isArray(row?.installments) ? row.installments : []) as any);
    setCurrentStep('select-installment');
    notifyInfo('تم اختيار العقد - اختر الدفعة', 'خطوة 2');
  };

  const handleSelectInstallment = (inst: الكمبيالات_tbl) => {
    setSelectedInstallment(inst);
    setPaidAmount(inst.القيمة);
    setCurrentStep('payment-details');
    notifyInfo('تم اختيار الدفعة - أدخل تفاصيل السداد', 'خطوة 3');
  };

  const handlePaymentDetailsSubmit = () => {
    if (!selectedInstallment) return;
    if (paidAmount <= 0) {
      toast.error('يجب إدخال مبلغ أكبر من صفر');
      return;
    }
    if (paidAmount > selectedInstallment.القيمة) {
      toast.error(`المبلغ لا يمكن أن يتجاوز ${selectedInstallment.القيمة} د.أ`);
      return;
    }
    
    setCurrentStep('confirmation');
    notifySuccess('تم التحقق من البيانات - مراجعة نهائية', 'خطوة 4');
  };

  const handleConfirmPayment = () => {
    if (!selectedInstallment || !selectedContract) return;

    const isPartial = paidAmount < selectedInstallment.القيمة;
    const remainingAmount = selectedInstallment.القيمة - paidAmount;

    // Process Payment
    DbService.markInstallmentPaid(
      selectedInstallment.رقم_الكمبيالة,
      userId,
      userRole as any,
      {
        paidAmount: paidAmount,
        paymentDate: paymentDate,
        notes: paymentNotes,
        isPartial: isPartial
      }
    );

    // Notifications
    if (isPartial) {
      notifyWarning(
        `دفعة جزئية: ${paidAmount} د.أ من ${selectedInstallment.القيمة} د.أ\nالمتبقي: ${remainingAmount} د.أ`,
        'سداد جزئي'
      );
    } else {
      notifyInstallmentPaid(paidAmount, (getTenant(selectedContract)?.الاسم as any) || 'مستأجر');
      notifySuccess(`✅ تم سداد الدفعة كاملة بمبلغ ${paidAmount} د.أ`);
    }

    // Reset and show completion
    setCurrentStep('complete');
    
    // Auto-reset after 3 seconds
    setTimeout(() => {
      resetForm();
    }, 3000);
  };

  const resetForm = () => {
    setCurrentStep('select-contract');
    setSelectedContract(null);
    setSelectedInstallment(null);
    setPaidAmount(0);
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setPaymentNotes('');
    setSearch('');
    loadData();
  };

  // Helper to get tenant/property info
  const getTenant = (contract: العقود_tbl) => {
    if (isDesktopFast) {
      const contractId = String((contract as any)?.رقم_العقد || '').trim();
      const row = fastRows.find((r: any) => String(r?.contract?.رقم_العقد || '').trim() === contractId);
      return (row as any)?.tenant;
    }
    return people.find(p => p.رقم_الشخص === contract.رقم_المستاجر);
  };
  const getProperty = (contract: العقود_tbl) => {
    if (isDesktopFast) {
      const contractId = String((contract as any)?.رقم_العقد || '').trim();
      const row = fastRows.find((r: any) => String(r?.contract?.رقم_العقد || '').trim() === contractId);
      return (row as any)?.property;
    }
    return properties.find(p => p.رقم_العقار === contract.رقم_العقار);
  };

  return (
    <div className="animate-fade-in pb-10">
      {/* Header */}
      <div className={DS.components.pageHeader}>
        <div>
          <h2 className={DS.components.pageTitle}>العمليات والإجراءات</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">سداد دفعات العقود وتوثيقها تلقائياً ضمن سجل العمليات</p>
        </div>
        <Button variant="secondary" size="icon" onClick={loadData}>
          <RefreshCcw size={18} />
        </Button>
      </div>

      {/* Progress Indicator */}
      {currentStep !== 'select-contract' && currentStep !== 'complete' && (
        <Card className="mb-6 p-4">
          <div className="flex items-center justify-between">
            <div
              className={`flex items-center gap-2 text-sm font-bold ${
                currentStep === 'select-installment' ||
                currentStep === 'payment-details' ||
                currentStep === 'confirmation'
                  ? 'text-green-600'
                  : 'text-slate-400'
              }`}
            >
              <CheckCircle2 size={16} />
              اختيار العقد
            </div>
            <ArrowRight size={16} className="text-gray-300" />
            <div
              className={`flex items-center gap-2 text-sm font-bold ${
                currentStep === 'select-installment' ||
                currentStep === 'payment-details' ||
                currentStep === 'confirmation'
                  ? 'text-green-600'
                  : 'text-slate-400'
              }`}
            >
              <DollarSign size={16} />
              اختيار الدفعة
            </div>
            <ArrowRight size={16} className="text-gray-300" />
            <div
              className={`flex items-center gap-2 text-sm font-bold ${
                currentStep === 'payment-details' || currentStep === 'confirmation'
                  ? 'text-indigo-600'
                  : 'text-slate-400'
              }`}
            >
              <Wallet size={16} />
              تفاصيل السداد
            </div>
            <ArrowRight size={16} className="text-gray-300" />
            <div
              className={`flex items-center gap-2 text-sm font-bold ${
                currentStep === 'confirmation' ? 'text-indigo-600' : 'text-slate-400'
              }`}
            >
              <Check size={16} />
              التأكيد
            </div>
          </div>
        </Card>
      )}

      {/* Steps Container */}
      <div className="max-w-4xl space-y-4">
        
        {/* ========== STEP 1: Select Contract ========== */}
        {currentStep !== 'complete' && (
          <PaymentStep
            step={1}
            totalSteps={4}
            status={currentStep === 'select-contract' ? 'current' : currentStep === 'select-installment' || currentStep === 'payment-details' || currentStep === 'confirmation' ? 'completed' : 'pending'}
            title="اختيار العقد"
            description="اختر العقد الذي تريد تسديد دفعاته"
            icon={<FileText size={20} />}
          >
            {currentStep === 'select-contract' && (
              <div className="space-y-3">
                <Input
                  type="text"
                  placeholder="بحث: اسم المستأجر، رقم العقد، كود العقار..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  icon={<Search size={18} />}
                />

                <div className="max-h-96 overflow-y-auto space-y-2">
                  {desktopUnsupported ? (
                    <div className="text-center py-6 text-gray-400">
                      <Lock size={32} className="mx-auto mb-2 opacity-20" />
                      <p className="text-sm">غير مدعوم في وضع الديسكتوب الحالي</p>
                      <p className="text-xs mt-2">يرجى تشغيل وضع السرعة/SQL أو تحديث نسخة الديسكتوب.</p>
                    </div>
                  ) : null}
                  {isDesktopFast ? (
                    fastLoading ? (
                      <div className="text-center py-6 text-gray-400">
                        <p className="text-sm">جاري التحميل...</p>
                      </div>
                    ) : fastRows.length === 0 ? (
                      <div className="text-center py-6 text-gray-400">
                        <Search size={32} className="mx-auto mb-2 opacity-20" />
                        <p className="text-sm">لا توجد عقود مطابقة</p>
                      </div>
                    ) : (
                      fastRows.map((row: any) => {
                        const contract = row?.contract as any;
                        const tenantName = String(row?.tenant?.الاسم || '').trim() || '—';
                        const propertyCode = String(row?.property?.الكود_الداخلي || '').trim() || '—';
                        const contractId = String(contract?.رقم_العقد || '').trim();
                        const contractInstalls = (Array.isArray(row?.installments) ? row.installments : []).filter(
                          (i: any) => String(i?.رقم_العقد || '') === contractId && String(i?.حالة_الكمبيالة || '') !== 'مدفوع' && String(i?.نوع_الكمبيالة || '') !== 'تأمين'
                        );

                        return (
                          <button
                            key={contractId || Math.random()}
                            onClick={() => handleSelectContractFast(row)}
                            className="w-full text-right p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-bold text-slate-800 dark:text-white">{tenantName}</span>
                              <span className="text-xs font-mono text-slate-400">#{formatContractNumberShort(contractId)}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                              <Home size={12} />
                              {propertyCode}
                              <span className="text-gray-300">|</span>
                              <AlertCircle size={12} />
                              {contractInstalls.length} دفعات معلقة
                            </div>
                          </button>
                        );
                      })
                    )
                  ) : (!desktopUnsupported && filteredContracts.length === 0) ? (
                    <div className="text-center py-6 text-gray-400">
                      <Search size={32} className="mx-auto mb-2 opacity-20" />
                      <p className="text-sm">لا توجد عقود مطابقة</p>
                    </div>
                  ) : (
                    (desktopUnsupported ? [] : filteredContracts).map(contract => {
                      const tenant = getTenant(contract);
                      const property = getProperty(contract);
                      const contractInstalls = installments.filter(i => i.رقم_العقد === contract.رقم_العقد && i.حالة_الكمبيالة !== 'مدفوع' && i.نوع_الكمبيالة !== 'تأمين');
                      
                      return (
                        <button
                          key={contract.رقم_العقد}
                          onClick={() => handleSelectContract(contract)}
                          className="w-full text-right p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-bold text-slate-800 dark:text-white">{tenant?.الاسم}</span>
                            <span className="text-xs font-mono text-slate-400">#{formatContractNumberShort(contract.رقم_العقد)}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <Home size={12} />
                            {property?.الكود_الداخلي}
                            <span className="text-gray-300">|</span>
                            <AlertCircle size={12} />
                            {contractInstalls.length} دفعات معلقة
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </PaymentStep>
        )}

        {/* ========== STEP 2: Select Installment ========== */}
        {currentStep !== 'complete' && selectedContract && (
          <PaymentStep
            step={2}
            totalSteps={4}
            status={currentStep === 'select-installment' ? 'current' : currentStep === 'payment-details' || currentStep === 'confirmation' ? 'completed' : 'pending'}
            title="اختيار الدفعة"
            description={`اختر الدفعة المراد تسديدها من العقد #${formatContractNumberShort(selectedContract.رقم_العقد)}`}
            icon={<Wallet size={20} />}
          >
            {(currentStep === 'select-installment' || currentStep === 'payment-details' || currentStep === 'confirmation') && (
              <div className="space-y-2">
                {pendingInstallments.length === 0 ? (
                  <div className="text-center py-6 text-green-600">
                    <CheckCircle2 size={32} className="mx-auto mb-2" />
                    <p className="font-bold">✅ جميع الدفعات مسددة!</p>
                  </div>
                ) : (
                  pendingInstallments.map(inst => {
                    const isLate = new Date(inst.تاريخ_استحقاق) < new Date();
                    return (
                      <button
                        key={inst.رقم_الكمبيالة}
                        onClick={() => currentStep === 'select-installment' && handleSelectInstallment(inst)}
                        disabled={currentStep !== 'select-installment'}
                        className={`w-full text-right p-3 rounded-lg border transition-all ${
                          selectedInstallment?.رقم_الكمبيالة === inst.رقم_الكمبيالة
                            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                            : 'border-gray-200 dark:border-gray-700'
                        } ${currentStep === 'select-installment' ? 'hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 cursor-pointer' : 'opacity-75'}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="text-left">
                            <span className="font-bold text-slate-800 dark:text-white">{inst.القيمة.toLocaleString()} د.أ</span>
                            {isLate && <span className="ml-2 text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded border border-red-200">متأخرة</span>}
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-slate-500">استحقاق: {inst.تاريخ_استحقاق}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">رقم: {inst.رقم_الكمبيالة.substring(0,8)}</p>
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </PaymentStep>
        )}

        {/* ========== STEP 3: Payment Details ========== */}
        {currentStep !== 'complete' && selectedInstallment && (
          <PaymentStep
            step={3}
            totalSteps={4}
            status={currentStep === 'payment-details' ? 'current' : currentStep === 'confirmation' ? 'completed' : 'pending'}
            title="تفاصيل السداد"
            description="أدخل معلومات السداد والملاحظات"
            icon={<DollarSign size={20} />}
          >
            {(currentStep === 'payment-details' || currentStep === 'confirmation') && (
              <div className="space-y-4">
                {/* Amount Input */}
                <div>
                  <label className="block text-sm font-bold mb-2">المبلغ المدفوع</label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={paidAmount}
                      onChange={(e) => setPaidAmount(Number(e.target.value))}
                      disabled={currentStep === 'confirmation'}
                      className="flex-1"
                      max={selectedInstallment.القيمة}
                      min={0}
                    />
                    <span className="font-bold text-slate-600">د.أ</span>
                  </div>
                  {paidAmount < selectedInstallment.القيمة && paidAmount > 0 && (
                    <p className="text-xs text-orange-600 mt-1 flex items-center gap-1">
                      <AlertCircle size={12} />
                      دفعة جزئية - الباقي: {(selectedInstallment.القيمة - paidAmount).toLocaleString()} د.أ
                    </p>
                  )}
                </div>

                {/* Payment Date */}
                <div>
                  <label className="text-sm font-bold mb-2 flex items-center gap-2">
                    <Calendar size={16} /> تاريخ الدفع
                  </label>
                  <Input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    disabled={currentStep === 'confirmation'}
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="text-sm font-bold mb-2 flex items-center gap-2">
                    <MessageSquare size={16} /> ملاحظات (اختياري)
                  </label>
                  <textarea
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    placeholder="مثال: دفع عن طريق تحويل بنكي..."
                    disabled={currentStep === 'confirmation'}
                    className="w-full h-20 p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-slate-900 dark:text-white disabled:opacity-75"
                  />
                </div>

                {currentStep === 'payment-details' && (
                  <div className="flex gap-2 pt-4">
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setCurrentStep('select-installment');
                        setSelectedInstallment(null);
                        // silent mode (no audio)
                      }}
                    >
                      رجوع
                    </Button>
                    <Button
                      variant="primary"
                      className="flex-1"
                      onClick={handlePaymentDetailsSubmit}
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
        {currentStep !== 'complete' && selectedInstallment && currentStep === 'confirmation' && (
          <PaymentStep
            step={4}
            totalSteps={4}
            status="current"
            title="تأكيد السداد"
            description="تحقق من البيانات والتأكيد النهائي"
            icon={<Check size={20} />}
          >
            <div className="space-y-4">
              {/* Summary Card */}
              <div className="bg-gradient-to-br from-indigo-50 to-cyan-50 dark:from-indigo-900/20 dark:to-cyan-900/20 p-4 rounded-lg border border-indigo-200 dark:border-indigo-800">
                <h4 className="font-bold text-slate-800 dark:text-white mb-3 flex items-center gap-2">
                  <Info size={16} /> ملخص الدفعة
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-400">المستأجر:</span>
                    <span className="font-bold">{getTenant(selectedContract!)?.الاسم}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-400">رقم العقد:</span>
                    <span className="font-mono font-bold">#{formatContractNumberShort(selectedContract!.رقم_العقد)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-400">العقار:</span>
                    <span className="font-bold">{getProperty(selectedContract!)?.الكود_الداخلي}</span>
                  </div>
                  <hr className="my-2 border-indigo-200 dark:border-indigo-800" />
                  <div className="flex justify-between text-lg font-bold">
                    <span>المبلغ المدفوع:</span>
                    <span className="text-green-600">{paidAmount.toLocaleString()} د.أ</span>
                  </div>
                  {paidAmount < selectedInstallment.القيمة && (
                    <div className="flex justify-between text-sm">
                      <span className="text-orange-600">المتبقي:</span>
                      <span className="font-bold text-orange-600">
                        {(selectedInstallment.القيمة - paidAmount).toLocaleString()} د.أ
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600 dark:text-slate-400">تاريخ السداد:</span>
                    <span className="font-bold">{paymentDate}</span>
                  </div>
                  {paymentNotes && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600 dark:text-slate-400">ملاحظات:</span>
                      <span className="font-bold">{paymentNotes}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Confirmation Buttons */}
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() => {
                    setCurrentStep('payment-details');
                    // silent mode (no audio)
                  }}
                >
                  رجوع للتعديل
                </Button>
                <Button
                  variant="primary"
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  onClick={handleConfirmPayment}
                >
                  ✓ تأكيد السداد النهائي
                </Button>
              </div>
            </div>
          </PaymentStep>
        )}
      </div>
    </div>
  );
};

