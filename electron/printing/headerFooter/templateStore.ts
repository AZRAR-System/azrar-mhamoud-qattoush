import fsp from 'node:fs/promises';
import path from 'node:path';
import { app } from 'electron';

const DEFAULT_HEADER_TEMPLATE = ['{{company_name}}', '{{company_slogan}}', '{{company_identity_text}}'].join('\n');
const DEFAULT_FOOTER_TEMPLATE = 'التاريخ: {{date}}    المستخدم: {{user_name}}    صفحة: {{page_number}}';

const ensureDir = async (dir: string): Promise<void> => {
  await fsp.mkdir(dir, { recursive: true });
};

export const getHeaderFooterTemplatesDir = async (): Promise<string> => {
  const dir = path.join(app.getPath('userData'), 'printing', 'header-footer');
  await ensureDir(dir);
  return dir;
};

const safeReadText = async (filePath: string): Promise<string | null> => {
  try {
    const raw = await fsp.readFile(filePath, 'utf8');
    const s = String(raw || '').trimEnd();
    return s.length ? s : null;
  } catch {
    return null;
  }
};

const ensureDefaultFile = async (filePath: string, content: string): Promise<void> => {
  try {
    await fsp.access(filePath);
  } catch {
    await fsp.writeFile(filePath, content, 'utf8');
  }
};

export const ensureHeaderFooterDefaultTemplates = async (): Promise<{ headerPath: string; footerPath: string }> => {
  const dir = await getHeaderFooterTemplatesDir();
  const headerPath = path.join(dir, 'header.template.txt');
  const footerPath = path.join(dir, 'footer.template.txt');

  await ensureDefaultFile(headerPath, DEFAULT_HEADER_TEMPLATE);
  await ensureDefaultFile(footerPath, DEFAULT_FOOTER_TEMPLATE);

  return { headerPath, footerPath };
};

export const loadHeaderFooterTemplates = async (): Promise<{ headerTemplate?: string; footerTemplate?: string }> => {
  const { headerPath, footerPath } = await ensureHeaderFooterDefaultTemplates();

  const headerTemplate = await safeReadText(headerPath);
  const footerTemplate = await safeReadText(footerPath);

  return {
    headerTemplate: headerTemplate ?? undefined,
    footerTemplate: footerTemplate ?? undefined,
  };
};
