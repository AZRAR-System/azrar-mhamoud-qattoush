export type ContractWordTemplateVariable = {
  key: string;
  label: string;
  example?: string;
};

export const CONTRACT_WORD_TEMPLATE_VARIABLES: ContractWordTemplateVariable[] = [
  { key: 'ownerName', label: 'اسم المؤجر', example: 'أحمد علي' },
  { key: 'ownerPhone', label: 'هاتف المؤجر', example: '0790000000' },
  { key: 'tenantName', label: 'اسم المستأجر', example: 'محمد حسن' },
  { key: 'tenantPhone', label: 'هاتف المستأجر', example: '0780000000' },
  { key: 'guarantorName', label: 'اسم الكفيل', example: 'علي يوسف' },
  { key: 'propertyCode', label: 'كود العقار', example: 'A-102' },
  { key: 'propertyAddress', label: 'عنوان العقار', example: 'عمّان - تلاع العلي' },
  { key: 'contractStartDate', label: 'تاريخ بداية العقد', example: '2026-01-01' },
  { key: 'contractEndDate', label: 'تاريخ نهاية العقد', example: '2026-12-31' },
  { key: 'contractDurationText', label: 'مدة الإيجار (نص)', example: 'سنة واحدة' },
  { key: 'contractAnnualRent', label: 'القيمة السنوية', example: '2400' },
  { key: 'contractRentPaymentText', label: 'كيفية أداء البدل (نص)', example: 'شهرياً' },
  { key: 'companyName', label: 'اسم الشركة', example: 'AZRAR' },
  { key: 'companyPhone', label: 'هاتف الشركة', example: '0799999999' },
];
