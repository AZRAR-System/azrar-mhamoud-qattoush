const repeat = (s: string, times: number) => Array.from({ length: Math.max(0, times) }, () => s).join('');

export const getPrintingQaSampleData = () => {
  const today = new Date().toISOString().slice(0, 10);

  const longArabicName = 'محمد عبد الرحمن مصطفى علي الكيالي أبو زيد النابلسي';
  const longCompany = 'شركة خبرني للخدمات العقارية والاستشارات القانونية وإدارة الأملاك (فرع الشمال)';
  const longText =
    'هذا نص اختبار لجودة الطباعة باللغة العربية. يجب أن يكون اتجاه النص RTL صحيحًا، وأن لا يتم قص أي محتوى، وأن يتم احترام الهوامش وحجم الصفحة.\n' +
    repeat('سطر إضافي للتأكد من التكسير الصحيح للنص داخل الصفحة.\n', 30);

  return {
    tenant_name: `${longArabicName} (المستأجر)`,
    owner_name: `${longCompany} (المالك)`,
    contract_amount: 1234,
    start_date: today,

    // Extra fields (safe if template ignores them)
    qa_long_text: longText,
    qa_long_id: `QA-${Date.now()}`,
  } as Record<string, unknown>;
};
