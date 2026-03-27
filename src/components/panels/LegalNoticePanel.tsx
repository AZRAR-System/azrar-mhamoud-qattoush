import React, { useState, useEffect } from 'react';
import { DbService } from '@/services/mockDb';
import { LegalNoticeTemplate } from '@/types';
import { Printer, MessageCircle, ChevronDown, PenTool } from 'lucide-react';
import { useToast } from '@/context/ToastContext';
import { PrintLetterhead } from '@/components/print/PrintLetterhead';
import { openWhatsAppForPhones } from '@/utils/whatsapp';
import { getDefaultWhatsAppCountryCodeSync } from '@/services/geoSettings';
import { getOfficialBrandSignature } from '@/utils/brandSignature';
import { RBACGuard } from '@/components/shared/RBACGuard';
import { printCurrentViewUnified } from '@/services/printing/unifiedPrint';

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;

export const LegalNoticePanel: React.FC<{ id: string }> = ({ id }) => {
  // id here represents the Contract ID (Context)
  const [templates, setTemplates] = useState<LegalNoticeTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [generatedText, setGeneratedText] = useState('');
  const toast = useToast();

  useEffect(() => {
    setTemplates(DbService.getLegalTemplates());
  }, []);

  const handleTemplateChange = (tmplId: string) => {
    setSelectedTemplateId(tmplId);
    if (tmplId) {
      const result = DbService.generateLegalNotice(tmplId, id);
      if (result) setGeneratedText(result.text);
    } else {
      setGeneratedText('');
    }
  };

  const handlePrint = () => {
    void printCurrentViewUnified({ documentType: 'legal_notice', entityId: id });
    saveHistory('Print');
  };

  const handleWhatsApp = () => {
    // In a real app, this would get the tenant phone
    const contract = DbService.getContractDetails(id);
    const phones = [contract?.tenant?.رقم_الهاتف, contract?.tenant?.رقم_هاتف_اضافي].filter(
      isNonEmptyString
    );
    if (phones.length) {
      void openWhatsAppForPhones(generatedText, phones, {
        defaultCountryCode: getDefaultWhatsAppCountryCodeSync(),
        delayMs: 10_000,
      });
      saveHistory('WhatsApp');
    } else {
      toast.warning('رقم هاتف المستأجر غير متوفر');
    }
  };

  const saveHistory = (method: 'WhatsApp' | 'Email' | 'Print') => {
    const contract = DbService.getContractDetails(id);
    if (contract) {
      const tmpl = templates.find((t) => t.id === selectedTemplateId);
      DbService.saveLegalNoticeHistory({
        contractId: id,
        tenantId: contract.tenant?.رقم_الشخص || '',
        templateTitle: tmpl?.title || 'Custom',
        contentSnapshot: generatedText,
        sentMethod: method,
        createdBy: 'Admin',
      });
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header (No Print) */}
      <div className="app-card p-6 mb-4 print:hidden">
        <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-4">
          <PenTool className="text-indigo-600" /> مولد الإخطارات القانونية
        </h2>

        <div>
          <label
            htmlFor="legal-notice-template"
            className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2"
          >
            اختر نوع الإخطار
          </label>
          <div className="relative">
            <select
              id="legal-notice-template"
              className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-xl p-3 appearance-none outline-none focus:ring-2 focus:ring-indigo-500"
              value={selectedTemplateId}
              onChange={(e) => handleTemplateChange(e.target.value)}
            >
              <option value="">-- اختر القالب --</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title} ({t.category})
                </option>
              ))}
            </select>
            <ChevronDown
              className="absolute left-3 top-3.5 text-gray-500 pointer-events-none"
              size={16}
            />
          </div>
        </div>
      </div>

      {/* Preview Area (Printable) */}
      <div className="flex-1 bg-white border border-gray-200 rounded-xl p-8 overflow-y-auto shadow-inner relative text-black print:shadow-none print:border-none print:w-full">
        {/* Printable Header */}
        <PrintLetterhead className="hidden print:block mb-6" />

        {/* Editor */}
        <textarea
          className="w-full h-full resize-none outline-none text-lg leading-relaxed bg-transparent"
          value={generatedText}
          onChange={(e) => setGeneratedText(e.target.value)}
          placeholder="سيظهر نص الإخطار هنا..."
        ></textarea>

        {/* Printable Footer */}
        <div className="hidden print:block mt-12 pt-8 border-t border-gray-300">
          <div className="flex justify-between items-end">
            <div className="text-center">
              <p className="font-bold mb-8">توقيع المسؤول</p>
              <p>_________________</p>
            </div>
            <div className="text-center">
              <div className="w-24 h-24 border border-black flex items-center justify-center bg-gray-100">
                <span className="text-xs">QR Code</span>
              </div>
            </div>
          </div>
          <p className="text-center text-xs mt-4">
            تم إنشاء هذا المستند إلكترونياً عبر نظام خبرني للخدمات العقارية
          </p>
          <p className="text-center text-xs mt-2 whitespace-pre-line">
            {getOfficialBrandSignature()}
          </p>
        </div>
      </div>

      {/* Actions Footer (No Print) */}
      <div className="mt-4 grid grid-cols-2 gap-4 print:hidden">
        <button
          onClick={handleWhatsApp}
          disabled={!generatedText}
          className="flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white py-3 rounded-xl font-bold transition disabled:opacity-50"
        >
          <MessageCircle size={20} /> إرسال واتساب
        </button>
        <RBACGuard requiredPermission="PRINT_EXECUTE">
          <button
            onClick={handlePrint}
            disabled={!generatedText}
            className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-900 text-white py-3 rounded-xl font-bold transition disabled:opacity-50"
          >
            <Printer size={20} /> طباعة / PDF
          </button>
        </RBACGuard>
      </div>
    </div>
  );
};
