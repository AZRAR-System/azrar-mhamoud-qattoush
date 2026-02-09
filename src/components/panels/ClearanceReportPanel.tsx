
import React, { useEffect, useState } from 'react';
import { DbService } from '@/services/mockDb';
import { ClearanceRecord, ContractDetailsResult } from '@/types';
import { Printer, CheckCircle, XCircle } from 'lucide-react';
import { PrintLetterhead } from '@/components/print/PrintLetterhead';
import { AttachmentManager } from '@/components/AttachmentManager';
import { RBACGuard } from '@/components/shared/RBACGuard';
import { printCurrentViewUnified } from '@/services/printing/unifiedPrint';

export const ClearanceReportPanel: React.FC<{ id: string }> = ({ id }) => {
  // ID passed here is the CONTRACT ID, we find the clearance record from it
  const [record, setRecord] = useState<ClearanceRecord | undefined>(undefined);
    const [contract, setContract] = useState<ContractDetailsResult | null>(null);

  useEffect(() => {
    const rec = DbService.getClearanceRecord(id);
    setRecord(rec);
    setContract(DbService.getContractDetails(id));
  }, [id]);

  if (!record) return <div className="p-10 text-center text-red-500">لم يتم العثور على سجل مخالصة لهذا العقد.</div>;

    const handlePrint = () => {
        void printCurrentViewUnified({ documentType: 'clearance_report', entityId: id });
    };

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-slate-900">
      
      {/* Toolbar */}
      <div className="p-4 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 flex justify-end gap-2 print:hidden">
                        <RBACGuard requiredPermission="PRINT_EXECUTE">
                                <button onClick={handlePrint} className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-indigo-700">
                                    <Printer size={18}/> طباعة التقرير
                                </button>
                        </RBACGuard>
      </div>

    {/* Report Content */}
    <div className="flex-1 overflow-auto p-8 print:p-0 print:overflow-visible">
         <div className="max-w-3xl mx-auto bg-white p-10 shadow-lg print:shadow-none print:max-w-full text-black">
             
             {/* Header */}
             <div className="border-b-2 border-black pb-6 mb-6">
                 <PrintLetterhead className="hidden print:block" />
                 <div className="flex justify-between items-start">
                     <div>
                         <h2 className="text-3xl font-black uppercase text-gray-800 mb-1">مخالصة نهائية</h2>
                     </div>
                     <div className="text-left">
                         <p className="text-sm">التاريخ: {record.date}</p>
                         <p className="text-sm">رقم العقد: {record.contractId}</p>
                     </div>
                 </div>
             </div>

             {/* Parties */}
             <div className="grid grid-cols-2 gap-8 mb-8">
                 <div className="border p-4 rounded-lg bg-gray-50">
                     <h3 className="font-bold text-gray-500 text-sm mb-2">المستأجر</h3>
                     <p className="font-bold text-lg">{contract?.tenant?.الاسم}</p>
                     <p className="text-sm">{contract?.tenant?.الرقم_الوطني}</p>
                 </div>
                 <div className="border p-4 rounded-lg bg-gray-50">
                     <h3 className="font-bold text-gray-500 text-sm mb-2">العقار</h3>
                     <p className="font-bold text-lg">{contract?.property?.الكود_الداخلي}</p>
                     <p className="text-sm">{contract?.property?.العنوان}</p>
                 </div>
             </div>

             {/* Inspection */}
             <div className="mb-8">
                 <h3 className="font-bold text-lg border-b border-gray-300 pb-2 mb-4">1. تقرير فحص العقار</h3>
                 <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                     {record.inspectionItems.map(item => (
                         <div key={item.id} className="flex justify-between py-1 border-b border-gray-100">
                             <span>{item.name}</span>
                             <span className="flex items-center gap-1 font-bold">
                                 {item.status === 'Good' ? <><CheckCircle size={14}/> سليم</> : <><XCircle size={14}/> تالف</>}
                             </span>
                         </div>
                     ))}
                 </div>
             </div>

             {/* Financials */}
             <div className="mb-8">
                 <h3 className="font-bold text-lg border-b border-gray-300 pb-2 mb-4">2. التسوية المالية</h3>
                 <table className="w-full text-right border-collapse text-sm">
                     <thead>
                         <tr className="bg-gray-100">
                             <th className="border p-2">البند</th>
                             <th className="border p-2 w-32">القيمة (د.أ)</th>
                         </tr>
                     </thead>
                     <tbody>
                         <tr><td className="border p-2">إيجارات متأخرة</td><td className="border p-2 font-bold">{record.rentArrears}</td></tr>
                         <tr><td className="border p-2">ذمم فواتير (كهرباء ومياه)</td><td className="border p-2 font-bold">{record.electricity.amountDue + record.water.amountDue}</td></tr>
                         <tr><td className="border p-2">أضرار وصيانة</td><td className="border p-2 font-bold">{record.damages.reduce((sum, d) => sum + d.cost, 0)}</td></tr>
                         <tr><td className="border p-2">رسوم تنظيف / أخرى</td><td className="border p-2 font-bold">{record.cleaningFee}</td></tr>
                         <tr className="bg-gray-200 font-black">
                             <td className="border p-2">المجموع الكلي للذمم</td>
                             <td className="border p-2">{record.totalDebts}</td>
                         </tr>
                     </tbody>
                 </table>
             </div>

             {/* Declaration */}
             <div className="border-2 border-black p-6 rounded-xl mb-12 bg-gray-50">
                 <h3 className="font-bold text-center mb-4 underline">إقرار وتصفية ذمة</h3>
                 <p className="text-sm leading-7 text-justify">
                     أقر أنا الموقع أدناه، بصفتي المستأجر للعقار المذكور أعلاه، بأنني قمت بتسليم العقار بتاريخ {record.date}، وتم إجراء المخالصة المالية والفنية حسب التفاصيل الواردة في هذا التقرير. وبناءً عليه:
                 </p>
                 <div className="my-4 font-bold text-center">
                     {record.depositAction === 'Return' ? 
                        'تم استلام ورقة الضمان (الشيك) وإبراء ذمة الطرفين.' : 
                        `أوافق على تنفيذ ورقة الضمان ${record.depositAction === 'ExecutePartial' ? 'جزئياً' : 'كلياً'} لسداد الذمم المترتبة.`
                     }
                 </div>
                 <p className="text-sm">ولا يحق لي المطالبة بأي شيء بعد توقيع هذا المستند.</p>
             </div>

             {/* Signatures */}
             <div className="flex justify-between mt-12 pt-8">
                 <div className="text-center w-1/3">
                     <p className="font-bold mb-8">توقيع المستأجر</p>
                     <div className="border-b border-black w-full"></div>
                 </div>
                 <div className="text-center w-1/3">
                     <p className="font-bold mb-8">توقيع المسؤول / المالك</p>
                     <div className="border-b border-black w-full"></div>
                 </div>
             </div>

         </div>

                 <div className="mt-6 print:hidden">
                        <AttachmentManager referenceType="Clearance" referenceId={id} />
                 </div>
      </div>
    </div>
  );
};
