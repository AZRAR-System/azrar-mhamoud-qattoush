import type { HeaderFooterInput, HeaderFooterResolved } from './types';

const PAGE_TOKEN = '__AZRAR_PAGE_FIELD__';

const toIsoDate = (v?: string): string => {
  const raw = String(v || '').trim();
  if (raw) return raw;
  return new Date().toISOString().slice(0, 10);
};

const normalizeLines = (s: string): string[] =>
  String(s || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

const renderTextTemplate = (template: string, vars: Record<string, string>): string => {
  return String(template || '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key: string) => {
    const k = String(key || '').trim();
    if (k === 'page_number') return PAGE_TOKEN;
    return vars[k] ?? '';
  });
};

export const buildHeaderFooter = (input?: HeaderFooterInput): HeaderFooterResolved => {
  const headerEnabled = input ? input.headerEnabled !== false : false;
  const footerEnabled = input ? input.footerEnabled !== false : false;

  const vars: Record<string, string> = {
    company_name: String(input?.companyName || ''),
    company_slogan: String(input?.companySlogan || ''),
    company_identity_text: String(input?.companyIdentityText || ''),
    user_name: String(input?.userName || ''),
    date: toIsoDate(input?.dateIso),
  };

  const defaultHeaderTemplate = ['{{company_name}}', '{{company_slogan}}', '{{company_identity_text}}'].join('\n');
  const defaultFooterTemplate = 'التاريخ: {{date}}    المستخدم: {{user_name}}    صفحة: {{page_number}}';

  const headerText = renderTextTemplate(input?.headerTemplate || defaultHeaderTemplate, vars);
  const footerText = renderTextTemplate(input?.footerTemplate || defaultFooterTemplate, vars);

  return {
    headerEnabled,
    footerEnabled,
    headerLines: normalizeLines(headerText),
    footerLine: String(footerText || '').trim(),
  };
};

export const HEADER_FOOTER_PAGE_TOKEN = PAGE_TOKEN;
