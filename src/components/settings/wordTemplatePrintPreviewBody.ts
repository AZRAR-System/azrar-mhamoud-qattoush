import type { SystemSettings } from '@/types';
import type { WordTemplateType } from '@/components/settings/settingsTypes';
import {
  buildContractTemplateBodyHtml,
  type ContractTemplateData,
} from '@/components/printing/templates/ContractTemplate';
import {
  buildInvoiceTemplateBodyHtml,
  type InvoiceTemplateData,
} from '@/components/printing/templates/InvoiceTemplate';
import {
  buildReceiptTemplateBodyHtml,
  type ReceiptTemplateData,
} from '@/components/printing/templates/ReceiptTemplate';

const MOCK_CONTRACT: ContractTemplateData = {
  lessorName: 'مؤجر تجريبي',
  tenantName: 'مستأجر تجريبي',
  propertyDetails: 'شقة — عمان — منطقة تجريبية',
  durationText: '12 شهراً',
  rentAmount: 350,
  terms: 'يجب دفع الإيجار في موعد أقصاه اليوم الخامس من كل شهر.\nيمنع التأجير من الباطن دون موافقة خطية.',
  contractTitle: 'معاينة — عقد إيجار',
};

const MOCK_INSTALLMENT: InvoiceTemplateData = {
  contractNumber: 'CNT-2026-0001',
  tenantName: 'أحمد تجريبي',
  propertyLabel: 'عقار رقم 12 — الجبيهة',
  installmentAmount: 250,
  dueDate: '2026-04-05',
  paidAmount: 100,
  remainingAmount: 150,
  installmentLabel: 'القسط 3 / 12',
};

const MOCK_HANDOVER: ReceiptTemplateData = {
  receiptNumber: 'HO-2026-0042',
  amountReceived: 0,
  paymentMethod: '—',
  date: '2026-03-29',
  documentTitle: 'معاينة — محضر تسليم',
  officialLetterTitle: 'تأكيد استلام',
  officialLetterBody:
    'نؤكد استلام المفتاح والعقار بحالة جيدة، وأي ملاحظات تُسجّل هنا للمرجعية.',
};

/** HTML body (under letterhead) for PrintPreviewModal — mock data per Word template category. */
export function getWordTemplatePreviewBodyHtml(
  type: WordTemplateType,
  settings: SystemSettings
): string {
  if (type === 'contracts') return buildContractTemplateBodyHtml(MOCK_CONTRACT, settings);
  if (type === 'installments') return buildInvoiceTemplateBodyHtml(MOCK_INSTALLMENT, settings);
  return buildReceiptTemplateBodyHtml(MOCK_HANDOVER, settings);
}
