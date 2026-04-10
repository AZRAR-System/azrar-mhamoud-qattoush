import { get, save } from '../kv';
import { KEYS } from '../keys';
import { dbOk } from '@/services/localDbStorage';

/**
 * Service to manage Word document templates and mail-merge operations.
 */

export const listWordTemplates = (type?: string) => {
  const all = get<any>(KEYS.WORD_TEMPLATES) || [];
  if (type) return all.filter((t: any) => t.type === type);
  return all;
};

export const listWordTemplatesDetailed = (type?: string) => {
  const all = listWordTemplates(type);
  const items = all.map((t: any) => ({
    id: t.id,
    name: t.name,
    createdAt: t.createdAt,
    size: t.content ? (Math.round((t.content.length * 0.75) / 1024)) + ' KB' : '0 KB',
  }));
  return dbOk({ items, details: all, dir: 'templates/' });
};

export const importWordTemplate = async (name: string, content?: string) => {
  const all = listWordTemplates();
  const id = `WT-${Date.now()}`;
  const templateName = content ? name : `${name}_template.docx`;
  const templateContent = content || 'MOCK_BASE64_CONTENT';
  const next = { id, name: templateName, content: templateContent, type: name, createdAt: new Date().toISOString() };
  save(KEYS.WORD_TEMPLATES, [...all, next]);
  return dbOk(next, 'تم استيراد القالب بنجاح');
};

export const readWordTemplate = (id: string, type?: string) => {
  const all = listWordTemplates(type);
  const data = all.find((t: any) => String(t.id) === String(id) || String(t.name) === String(id));
  return dbOk(data?.content ? new Uint8Array(Buffer.from(data.content, 'base64')) : null);
};

export const deleteWordTemplate = (id: string, type?: string) => {
  const all = get<any>(KEYS.WORD_TEMPLATES) || [];
  save(KEYS.WORD_TEMPLATES, all.filter((t: any) => (String(t.id) !== String(id) && String(t.name) !== String(id))));
  return dbOk(null, 'تم حذف القالب');
};

export const getMergePlaceholderCatalog = () => {
  return {
    contract: [
      { key: 'contract_start', label: 'بداية العقد' },
      { key: 'contract_end', label: 'نهاية العقد' },
      { key: 'contract_amount', label: 'قيمة العقد' },
      { key: 'contract_duration', label: 'مدة العقد' },
    ],
    property: [
      { key: 'property_address', label: 'عنوان العقار' },
      { key: 'property_code', label: 'كود العقار' },
      { key: 'property_type', label: 'نوع العقار' },
    ],
    tenant: [
      { key: 'tenant_name', label: 'اسم المستأجر' },
      { key: 'tenant_phone', label: 'هاتف المستأجر' },
      { key: 'tenant_id', label: 'رقم هوية المستأجر' },
    ],
    installment: [
      { key: 'installment_amount', label: 'قيمة الدفعة' },
      { key: 'installment_due_date', label: 'تاريخ الاستحقاق' },
      { key: 'owner_name', label: 'اسم المالك' },
    ],
  };
};
