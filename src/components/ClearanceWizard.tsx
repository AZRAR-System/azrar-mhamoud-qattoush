import { useState, useEffect } from 'react';
import { DbService } from '@/services/mockDb';
import {
  InspectionItem,
  DamageRecord,
  ClearanceRecord,
  العقود_tbl,
  LegalNoticeTemplate,
} from '@/types';
import { formatContractNumberShort } from '@/utils/contractNumber';
import { formatCurrencyJOD } from '@/utils/format';
import { AttachmentManager } from '@/components/AttachmentManager';
import { Input } from '@/components/ui/Input';
import { MoneyInput } from '@/components/ui/MoneyInput';
import {
  CheckCircle,
  XCircle,
  FileCheck,
  Zap,
  Droplets,
  Trash2,
  Plus,
  Camera,
  ArrowRight,
  ArrowLeft,
  ShieldAlert,
} from 'lucide-react';
import { useToast } from '@/context/ToastContext';

interface ClearanceWizardProps {
  contract: العقود_tbl;
  onClose: () => void;
  onComplete: () => void;
}

const STEPS = ['فحص العقار', 'الخدمات والفواتير', 'الأضرار', 'التسوية المالية', 'القرار النهائي'];

const INSPECTION_DEFAULTS: InspectionItem[] = [
  { id: '1', name: 'الأبواب والمقابض', status: 'Good' },
  { id: '2', name: 'النوافذ والزجاج', status: 'Good' },
  { id: '3', name: 'الجدران والدهان', status: 'Good' },
  { id: '4', name: 'الأرضيات', status: 'Good' },
  { id: '5', name: 'تمديدات الكهرباء والإنارة', status: 'Good' },
  { id: '6', name: 'تمديدات المياه والحنفيات', status: 'Good' },
  { id: '7', name: 'المطبخ (خزائن/مجلى)', status: 'Good' },
  { id: '8', name: 'الحمامات', status: 'Good' },
];

export const ClearanceWizard: React.FC<ClearanceWizardProps> = ({
  contract,
  onClose: _onClose,
  onComplete,
}) => {
  const [step, setStep] = useState(0);
  const toast = useToast();

  const [clearanceDate] = useState(() => new Date().toISOString().split('T')[0]);

  // --- DATA STATES ---

  // 1. Inspection
  const [inspectionItems, setInspectionItems] = useState<InspectionItem[]>(INSPECTION_DEFAULTS);

  // 2. Utilities
  const [electricity, setElectricity] = useState({ paid: true, amountDue: 0, reading: '' });
  const [water, setWater] = useState({ paid: true, amountDue: 0, reading: '' });

  // 3. Damages
  const [damages, setDamages] = useState<DamageRecord[]>([]);
  const [newDamage, setNewDamage] = useState({ description: '', cost: 0, type: 'تكسير' });

  // 4. Financials
  const [rentArrears, setRentArrears] = useState(0);
  const [cleaningFee, setCleaningFee] = useState(0);
  const [securityDeposit, setSecurityDeposit] = useState(0);

  // 5. Final
  const [finalStatus, setFinalStatus] = useState<'شاغر' | 'تحت الصيانة'>('شاغر');
  const [finalNotes, setFinalNotes] = useState('');
  const [addToBlacklist, setAddToBlacklist] = useState(false);

  // Legal notice (optional)
  const [legalTemplates, setLegalTemplates] = useState<LegalNoticeTemplate[]>([]);
  const [selectedLegalTemplateId, setSelectedLegalTemplateId] = useState<string>('');
  const [legalNoticeText, setLegalNoticeText] = useState('');
  const [saveLegalNotice, setSaveLegalNotice] = useState(false);
  const [legalNoticeMethod, setLegalNoticeMethod] = useState<'WhatsApp' | 'Email' | 'Print'>(
    'Print'
  );

  // Initial Data Load
  useEffect(() => {
    // Calculate Rent Arrears
    const details = DbService.getContractDetails(contract.رقم_العقد);
    const installments = details?.installments ?? [];
    const arrears = installments
      .filter(
        (i) =>
          i.نوع_الكمبيالة !== 'تأمين' &&
          i.حالة_الكمبيالة !== 'مدفوع' &&
          i.حالة_الكمبيالة !== 'ملغي' &&
          new Date(i.تاريخ_استحقاق) < new Date()
      )
      .reduce((sum, i) => sum + i.القيمة, 0);

    const deposit = installments.find((i) => i.نوع_الكمبيالة === 'تأمين')?.القيمة || 0;

    setRentArrears(arrears);
    setSecurityDeposit(deposit);

    const templates = DbService.getLegalTemplates();
    setLegalTemplates(templates);

    const preferredByTitle = templates.find((t) =>
      /فسخ|إنهاء|مخالصة/.test(String(t.title || ''))
    )?.id;
    const preferredEviction = templates.find((t) => t.id === 'eviction_notice')?.id;
    const preferred = preferredByTitle || preferredEviction || templates[0]?.id || '';
    setSelectedLegalTemplateId(preferred);
    if (preferred) {
      const generated = DbService.generateLegalNotice(preferred, contract.رقم_العقد, {
        date: clearanceDate,
      });
      setLegalNoticeText(typeof generated === 'string' ? generated : (generated as any)?.text || '');
    }
  }, [contract, clearanceDate]);

  useEffect(() => {
    if (!selectedLegalTemplateId) {
      setLegalNoticeText('');
      return;
    }
    const generated = DbService.generateLegalNotice(selectedLegalTemplateId, contract.رقم_العقد, {
      date: clearanceDate,
    });
    setLegalNoticeText(typeof generated === 'string' ? generated : (generated as any)?.text || '');
  }, [selectedLegalTemplateId, contract.رقم_العقد, clearanceDate]);

  // --- CALCULATIONS ---
  const damagesTotal = damages.reduce((sum, d) => sum + d.cost, 0);
  const totalDebt =
    rentArrears + cleaningFee + damagesTotal + electricity.amountDue + water.amountDue;

  let depositAction: 'Return' | 'Execute' | 'ExecutePartial' = 'Return';
  if (totalDebt > 0) {
    if (totalDebt > securityDeposit)
      depositAction = 'Execute'; // Full + debt remains
    else depositAction = 'ExecutePartial'; // Part of paper covers debt (conceptually)
  }

  // Auto suggest blacklist if debts are high or eviction
  useEffect(() => {
    if (depositAction === 'Execute' || damagesTotal > 500) {
      setAddToBlacklist(true);
    }
  }, [depositAction, damagesTotal]);

  // --- HANDLERS ---

  const toggleInspection = (id: string, status: 'Good' | 'Bad') => {
    setInspectionItems((prev) => prev.map((item) => (item.id === id ? { ...item, status } : item)));
    // Auto-suggest maintenance if bad
    if (status === 'Bad') setFinalStatus('تحت الصيانة');
  };

  const updateInspectionNote = (id: string, note: string) => {
    setInspectionItems((prev) => prev.map((item) => (item.id === id ? { ...item, note } : item)));
  };

  const addDamage = () => {
    if (!newDamage.description || !newDamage.cost) return;
    setDamages([...damages, { ...newDamage, id: Math.random().toString() }]);
    setNewDamage({ description: '', cost: 0, type: 'تكسير' });
  };

  const removeDamage = (id: string) => {
    setDamages(damages.filter((d) => d.id !== id));
  };

  const handleSubmit = async () => {
    const ok = await toast.confirm({
      title: 'تأكيد',
      message: 'هل أنت متأكد من اعتماد المخالصة وفسخ العقد؟ لا يمكن التراجع.',
      confirmText: 'اعتماد',
      cancelText: 'إلغاء',
      isDangerous: true,
    });
    if (ok) {
      const record: ClearanceRecord = {
        id: '', // Set by DB
        contractId: contract.رقم_العقد,
        propertyId: contract.رقم_العقار,
        tenantId: contract.رقم_المستاجر,
        date: clearanceDate,
        inspectionItems,
        electricity,
        water,
        damages,
        rentArrears,
        cleaningFee,
        totalDebts: totalDebt,
        securityDepositValue: securityDeposit,
        depositAction,
        finalPropertyStatus: finalStatus,
        notes: finalNotes,
        createdBy: 'Admin',
      };

      const res = DbService.terminateContract(
        contract.رقم_العقد,
        `مخالصة نهائية: ${finalNotes}`,
        record.date,
        record
      );

      if (res.success) {
        if (addToBlacklist) {
          DbService.addToBlacklist({
            personId: contract.رقم_المستاجر,
            reason: `إضافة تلقائية عند المخالصة: ${finalNotes || 'ذمم مالية أو أضرار'}`,
            severity: 'High',
          });
          toast.warning('تم إضافة المستأجر للقائمة السوداء');
        }

        if (saveLegalNotice && selectedLegalTemplateId && legalNoticeText.trim()) {
          const tmpl = legalTemplates.find((t) => t.id === selectedLegalTemplateId);
          DbService.saveLegalNoticeHistory({
            contractId: contract.رقم_العقد,
            tenantId: contract.رقم_المستاجر,
            templateTitle: tmpl?.title || 'إشعار قانوني',
            contentSnapshot: legalNoticeText,
            sentMethod: legalNoticeMethod,
            createdBy: 'Admin',
          });
        }
        toast.success('تمت المخالصة وفسخ العقد بنجاح');
        onComplete();
      } else {
        toast.error(res.message);
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-slate-900 overflow-hidden">
      {/* Wizard Header */}
      <div className="bg-white dark:bg-slate-800 p-6 border-b border-gray-200 dark:border-slate-700 shadow-sm flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <FileCheck className="text-indigo-600" /> مخالصة إنهاء عقد
          </h2>
          <p className="text-sm text-slate-500">
            عقد #{formatContractNumberShort(contract.رقم_العقد)}
          </p>
        </div>

        {/* Stepper */}
        <div className="flex gap-2">
          {STEPS.map((label, idx) => (
            <div key={idx} className={`flex flex-col items-center w-20`}>
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all
                            ${
                              idx === step
                                ? 'bg-indigo-600 text-white ring-4 ring-indigo-100'
                                : idx < step
                                  ? 'bg-green-500 text-white'
                                  : 'bg-gray-200 text-gray-500'
                            }
                        `}
              >
                {idx < step ? <CheckCircle size={16} /> : idx + 1}
              </div>
              <span
                className={`text-[10px] mt-1 font-bold ${idx === step ? 'text-indigo-600' : 'text-gray-400'}`}
              >
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-8 max-w-4xl mx-auto w-full">
        {/* STEP 1: INSPECTION */}
        {step === 0 && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl text-indigo-800 dark:text-indigo-300 text-sm border border-indigo-100">
              قم بفحص عناصر العقار وتوثيق حالتها. العناصر التالفة ستضاف لتقرير الصيانة.
            </div>
            <div className="grid grid-cols-1 gap-4">
              {inspectionItems.map((item) => (
                <div
                  key={item.id}
                  className="app-card p-4 rounded-xl flex flex-col md:flex-row md:items-center gap-4 hover:shadow-md transition"
                >
                  <div className="flex-1">
                    <h4 className="font-bold text-slate-700 dark:text-white">{item.name}</h4>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => toggleInspection(item.id, 'Good')}
                      className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition ${item.status === 'Good' ? 'bg-green-100 text-green-700 border-green-200 ring-2 ring-green-500/20' : 'bg-gray-100 text-gray-500'}`}
                    >
                      <CheckCircle size={16} /> سليم
                    </button>
                    <button
                      onClick={() => toggleInspection(item.id, 'Bad')}
                      className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition ${item.status === 'Bad' ? 'bg-red-100 text-red-700 border-red-200 ring-2 ring-red-500/20' : 'bg-gray-100 text-gray-500'}`}
                    >
                      <XCircle size={16} /> تالف
                    </button>
                  </div>
                  <div className="flex-1 md:max-w-xs">
                    <input
                      placeholder="ملاحظات..."
                      className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500"
                      value={item.note || ''}
                      onChange={(e) => updateInspectionNote(item.id, e.target.value)}
                    />
                  </div>
                  <button className="p-2 text-slate-400 hover:text-indigo-600 bg-gray-50 dark:bg-slate-900 rounded-lg">
                    <Camera size={18} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 2: UTILITIES */}
        {step === 1 && (
          <div className="space-y-6 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Electricity */}
              <div className="app-card p-6 border-yellow-200 dark:border-yellow-900/50 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-2 h-full bg-yellow-400"></div>
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                  <Zap className="text-yellow-500" /> الكهرباء
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">
                      آخر قراءة عداد
                    </label>
                    <Input
                      type="number"
                      className="w-full border p-2 rounded-lg"
                      value={electricity.reading}
                      onChange={(e) => setElectricity({ ...electricity, reading: e.target.value })}
                    />
                  </div>
                  <label className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-900 rounded-lg cursor-pointer">
                    <input
                      type="checkbox"
                      className="w-5 h-5 text-green-600"
                      checked={electricity.paid}
                      onChange={(e) =>
                        setElectricity({
                          ...electricity,
                          paid: e.target.checked,
                          amountDue: e.target.checked ? 0 : electricity.amountDue,
                        })
                      }
                    />
                    <span className="font-bold">الفواتير مدفوعة بالكامل (براءة ذمة)</span>
                  </label>
                  {!electricity.paid && (
                    <div className="animate-slide-up">
                      <label className="block text-xs font-bold text-red-500 mb-1">
                        المبلغ المطلوب سداده
                      </label>
                      <MoneyInput
                        className="w-full border border-red-300 p-2 rounded-lg bg-red-50"
                        value={electricity.amountDue}
                        onValueChange={(v) => setElectricity({ ...electricity, amountDue: v ?? 0 })}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Water */}
              <div className="app-card p-6 border-cyan-200 dark:border-cyan-900/50 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-2 h-full bg-cyan-400"></div>
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                  <Droplets className="text-cyan-500" /> المياه
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">
                      آخر قراءة عداد
                    </label>
                    <Input
                      type="number"
                      className="w-full border p-2 rounded-lg"
                      value={water.reading}
                      onChange={(e) => setWater({ ...water, reading: e.target.value })}
                    />
                  </div>
                  <label className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-900 rounded-lg cursor-pointer">
                    <input
                      type="checkbox"
                      className="w-5 h-5 text-green-600"
                      checked={water.paid}
                      onChange={(e) =>
                        setWater({
                          ...water,
                          paid: e.target.checked,
                          amountDue: e.target.checked ? 0 : water.amountDue,
                        })
                      }
                    />
                    <span className="font-bold">الفواتير مدفوعة بالكامل (براءة ذمة)</span>
                  </label>
                  {!water.paid && (
                    <div className="animate-slide-up">
                      <label className="block text-xs font-bold text-red-500 mb-1">
                        المبلغ المطلوب سداده
                      </label>
                      <MoneyInput
                        className="w-full border border-red-300 p-2 rounded-lg bg-red-50"
                        value={water.amountDue}
                        onValueChange={(v) => setWater({ ...water, amountDue: v ?? 0 })}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: DAMAGES */}
        {step === 2 && (
          <div className="space-y-6 animate-fade-in">
            {/* Add Form */}
            <div className="app-card p-4 rounded-xl flex flex-col md:flex-row gap-4 items-end">
              <div className="flex-1 w-full">
                <label className="block text-xs font-bold text-slate-500 mb-1">وصف الضرر</label>
                <input
                  className="w-full border p-2 rounded-lg text-sm"
                  placeholder="مثال: كسر في زجاج المطبخ"
                  value={newDamage.description}
                  onChange={(e) => setNewDamage({ ...newDamage, description: e.target.value })}
                />
              </div>
              <div className="w-32">
                <label className="block text-xs font-bold text-slate-500 mb-1">التكلفة (د.أ)</label>
                <MoneyInput
                  className="w-full border p-2 rounded-lg text-sm"
                  value={newDamage.cost || undefined}
                  onValueChange={(v) => setNewDamage({ ...newDamage, cost: v ?? 0 })}
                />
              </div>
              <button
                onClick={addDamage}
                className="bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-700 transition"
              >
                <Plus size={20} />
              </button>
            </div>

            {/* List */}
            <div className="app-card rounded-xl overflow-hidden">
              <table className="w-full text-right text-sm">
                <thead className="bg-gray-50 dark:bg-slate-900 text-slate-500">
                  <tr>
                    <th className="p-3">الوصف</th>
                    <th className="p-3">التكلفة</th>
                    <th className="p-3">حذف</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                  {damages.map((d) => (
                    <tr key={d.id}>
                      <td className="p-3">{d.description}</td>
                      <td className="p-3 font-bold text-red-600">{formatCurrencyJOD(d.cost)}</td>
                      <td className="p-3">
                        <button
                          onClick={() => removeDamage(d.id)}
                          className="text-red-500 hover:bg-red-50 p-1 rounded"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {damages.length === 0 && (
                    <tr>
                      <td colSpan={3} className="p-6 text-center text-slate-400">
                        لا يوجد أضرار مسجلة
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot className="bg-gray-50 dark:bg-slate-900 font-bold">
                  <tr>
                    <td className="p-3">المجموع</td>
                    <td className="p-3 text-red-600">{formatCurrencyJOD(damagesTotal)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* STEP 4: FINANCIALS */}
        {step === 3 && (
          <div className="space-y-6 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Summary Table */}
              <div className="app-card overflow-hidden">
                <div className="p-4 bg-gray-50 dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700 font-bold">
                  ملخص الذمم المالية
                </div>
                <div className="p-4 space-y-3">
                  <div className="flex justify-between border-b border-dashed pb-2">
                    <span>إيجارات متأخرة</span>
                    <span className="font-bold">{formatCurrencyJOD(rentArrears)}</span>
                  </div>
                  <div className="flex justify-between border-b border-dashed pb-2">
                    <span>ذمم فواتير (كهرباء/مياه)</span>
                    <span className="font-bold">
                      {formatCurrencyJOD(electricity.amountDue + water.amountDue)}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-dashed pb-2">
                    <span>تعويضات أضرار</span>
                    <span className="font-bold">{formatCurrencyJOD(damagesTotal)}</span>
                  </div>
                  <div className="flex justify-between items-center pb-2">
                    <span>رسوم تنظيف / أخرى</span>
                    <MoneyInput
                      showCurrency={false}
                      className="w-24 border p-1 rounded text-center"
                      value={cleaningFee}
                      onValueChange={(v) => setCleaningFee(v ?? 0)}
                    />
                  </div>
                  <div className="flex justify-between bg-red-50 p-3 rounded-lg text-red-800 font-bold text-lg">
                    <span>المجموع الكلي للذمم</span>
                    <span>{formatCurrencyJOD(totalDebt)}</span>
                  </div>
                </div>
              </div>

              {/* Deposit Logic */}
              <div className="bg-purple-50 dark:bg-purple-900/10 rounded-2xl border border-purple-200 dark:border-purple-800 p-6 flex flex-col justify-center">
                <div className="flex justify-between items-center mb-6">
                  <span className="text-purple-800 dark:text-purple-300 font-bold">
                    قيمة ورقة الضمان المحفوظة
                  </span>
                  <span className="text-2xl font-black text-purple-700 dark:text-white">
                    {formatCurrencyJOD(securityDeposit)}
                  </span>
                </div>

                <div
                  className={`p-4 rounded-xl border-2 text-center ${
                    depositAction === 'Return'
                      ? 'bg-green-100 border-green-300 text-green-800'
                      : depositAction === 'Execute'
                        ? 'bg-red-100 border-red-300 text-red-800'
                        : 'bg-orange-100 border-orange-300 text-orange-800'
                  }`}
                >
                  <p className="text-xs font-bold uppercase mb-1">الإجراء الموصى به</p>
                  <h3 className="text-xl font-black mb-2">
                    {depositAction === 'Return'
                      ? 'إرجاع الورقة للمستأجر'
                      : depositAction === 'Execute'
                        ? 'تنفيذ الورقة بالكامل'
                        : 'تنفيذ جزئي / تسوية'}
                  </h3>
                  <p className="text-xs opacity-80">
                    {depositAction === 'Return'
                      ? 'لا توجد ذمم مالية عالقة.'
                      : depositAction === 'Execute'
                        ? `الذمم (${formatCurrencyJOD(totalDebt)}) تتجاوز أو تساوي قيمة الضمان.`
                        : `الذمم (${formatCurrencyJOD(totalDebt)}) أقل من قيمة الضمان. يتم التنفيذ بالمقدار المطلوب.`}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 5: FINAL DECISION */}
        {step === 4 && (
          <div className="space-y-6 animate-fade-in text-center max-w-lg mx-auto">
            <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={40} />
            </div>
            <h3 className="text-2xl font-bold text-slate-800 dark:text-white">
              جاهز لإتمام المخالصة
            </h3>
            <p className="text-slate-500">مراجعة نهائية للإجراءات التي سيقوم بها النظام</p>

            <div className="bg-gray-50 dark:bg-slate-800 text-right p-6 rounded-xl space-y-4 border border-gray-200 dark:border-slate-700 text-sm">
              <div className="flex items-center gap-3">
                <CheckCircle size={16} className="text-green-500" />
                <span>
                  تحويل حالة العقد إلى: <b>مفسوخ / منتهي</b>
                </span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle size={16} className="text-green-500" />
                <span>
                  تحويل حالة العقار إلى:
                  <select
                    className="mr-2 border rounded p-1"
                    value={finalStatus}
                    onChange={(e) => {
                      const next = e.target.value;
                      if (next === 'شاغر' || next === 'تحت الصيانة') {
                        setFinalStatus(next);
                      }
                    }}
                  >
                    <option value="شاغر">شاغر (جاهز للتأجير)</option>
                    <option value="تحت الصيانة">تحت الصيانة (بحاجة لإصلاح)</option>
                  </select>
                </span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle size={16} className="text-green-500" />
                <span>تسجيل الذمم المالية والمدفوعات في السجلات</span>
              </div>
            </div>

            {/* Blacklist Option */}
            <label className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900 rounded-xl cursor-pointer text-right">
              <input
                type="checkbox"
                className="mt-1 w-5 h-5 text-red-600"
                checked={addToBlacklist}
                onChange={(e) => setAddToBlacklist(e.target.checked)}
              />
              <div>
                <span className="font-bold text-red-700 dark:text-red-400 flex items-center gap-2">
                  <ShieldAlert size={16} /> إدراج المستأجر في القائمة السوداء
                </span>
                <p className="text-xs text-red-600/70 mt-1">
                  سيتم إضافة المستأجر للقائمة السوداء بسبب وجود ذمم مالية أو أضرار.
                </p>
              </div>
            </label>

            {/* Optional Legal Notice */}
            <div className="bg-gray-50 dark:bg-slate-800 text-right p-4 rounded-xl space-y-3 border border-gray-200 dark:border-slate-700">
              <div className="flex items-center justify-between gap-3">
                <div className="font-bold text-slate-700 dark:text-slate-200">
                  مسودة إشعار قانوني (اختياري)
                </div>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4"
                    checked={saveLegalNotice}
                    onChange={(e) => setSaveLegalNotice(e.target.checked)}
                  />
                  <span>حفظ في سجل الإخطارات عند الاعتماد</span>
                </label>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                    نوع الإخطار
                  </label>
                  <select
                    className="w-full bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm"
                    value={selectedLegalTemplateId}
                    onChange={(e) => setSelectedLegalTemplateId(e.target.value)}
                  >
                    <option value="">-- بدون --</option>
                    {legalTemplates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title} ({t.category})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                    طريقة الإرسال (للتوثيق فقط)
                  </label>
                  <select
                    className="w-full bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm"
                    value={legalNoticeMethod}
                    onChange={(e) => {
                      const next = e.target.value;
                      if (next === 'Print' || next === 'WhatsApp' || next === 'Email') {
                        setLegalNoticeMethod(next);
                      }
                    }}
                    disabled={!saveLegalNotice}
                  >
                    <option value="Print">طباعة</option>
                    <option value="WhatsApp">واتساب</option>
                    <option value="Email">إيميل</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                    نص الإخطار
                  </label>
                  <textarea
                    className="w-full border border-gray-300 dark:border-slate-600 rounded-lg p-3 text-sm h-40 bg-white dark:bg-slate-900"
                    value={legalNoticeText}
                    onChange={(e) => setLegalNoticeText(e.target.value)}
                    placeholder="سيتم توليد نص الإخطار هنا..."
                    disabled={!selectedLegalTemplateId}
                  />
                </div>
              </div>
            </div>

            <textarea
              className="w-full border p-3 rounded-xl text-sm h-24"
              placeholder="ملاحظات نهائية على ملف المخالصة..."
              value={finalNotes}
              onChange={(e) => setFinalNotes(e.target.value)}
            ></textarea>

            <div className="text-right">
              <AttachmentManager referenceType="Clearance" referenceId={contract.رقم_العقد} />
            </div>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex justify-between">
        <button
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="px-6 py-2.5 rounded-xl border border-gray-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 font-bold hover:bg-gray-50 disabled:opacity-50 flex items-center gap-2"
        >
          <ArrowRight size={16} /> السابق
        </button>

        {step < 4 ? (
          <button
            onClick={() => setStep((s) => Math.min(4, s + 1))}
            className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 flex items-center gap-2"
          >
            التالي <ArrowLeft size={16} />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            className="px-8 py-2.5 rounded-xl bg-green-600 text-white font-bold hover:bg-green-700 shadow-lg shadow-green-500/20 flex items-center gap-2"
          >
            <CheckCircle size={18} /> اعتماد المخالصة
          </button>
        )}
      </div>
    </div>
  );
};
