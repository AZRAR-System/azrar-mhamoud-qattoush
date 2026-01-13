import type { SystemSettings } from '@/types/types';

export type XlsxExtraSheet = {
  name: string;
  rows: any[][];
};

export function buildCompanyLetterheadSheet(settings?: Partial<SystemSettings> | null): XlsxExtraSheet | null {
  const s = settings || {};
  if (s.letterheadEnabled === false) return null;

  const rows: any[][] = [];
  rows.push(['الترويسة / هوية الشركة']);
  rows.push([]);

  rows.push(['اسم الشركة', s.companyName || '']);
  rows.push(['الشعار', s.companySlogan || '']);
  rows.push(['العنوان', s.companyAddress || '']);
  rows.push(['الهاتف', s.companyPhone || '']);
  rows.push(['البريد الإلكتروني', s.companyEmail || '']);
  rows.push(['الموقع', s.companyWebsite || '']);
  rows.push(['الرقم الضريبي', s.taxNumber || '']);
  rows.push(['السجل التجاري', s.commercialRegister || '']);
  rows.push(['هوية الشركة', s.companyIdentityText || '']);

  return { name: 'الترويسة', rows };
}
