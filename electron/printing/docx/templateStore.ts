import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { app } from 'electron';

const MAX_TEMPLATE_BYTES = 25 * 1024 * 1024;

const isDocx = (name: string): boolean => name.toLowerCase().endsWith('.docx');

const ensureDir = async (dir: string): Promise<void> => {
  await fsp.mkdir(dir, { recursive: true });
};

export const getContractsTemplatesDir = async (): Promise<string> => {
  const dir = path.join(app.getPath('userData'), 'templates', 'contracts');
  await ensureDir(dir);
  return dir;
};

const tryListDocx = async (dir: string): Promise<string[]> => {
  try {
    const items = await fsp.readdir(dir);
    return items.filter(isDocx);
  } catch {
    return [];
  }
};

const existsFile = (p: string): boolean => {
  try {
    return fs.existsSync(p) && fs.statSync(p).isFile();
  } catch {
    return false;
  }
};

export const resolveContractTemplatePath = async (templateName?: string): Promise<{ templatePath: string; fileName: string }> => {
  const templatesDir = await getContractsTemplatesDir();

  const pickSingleIfAny = async (): Promise<string | null> => {
    const userItems = await tryListDocx(templatesDir);
    const [singleUserItem] = userItems;
    if (userItems.length === 1 && singleUserItem) return path.join(templatesDir, singleUserItem);

    const devDir = path.join(process.cwd(), 'العقود الورد');
    const devItems = await tryListDocx(devDir);
    const [singleDevItem] = devItems;
    if (devItems.length === 1 && singleDevItem) return path.join(devDir, singleDevItem);

    return null;
  };

  const safeName = String(templateName || '').trim();
  if (!safeName) {
    const picked = await pickSingleIfAny();
    if (!picked) throw new Error('لم يتم تحديد قالب Word. قم باستيراد قالب أو ضع قالب واحد فقط ليتم اختياره تلقائياً.');
    return { templatePath: picked, fileName: path.basename(picked) };
  }

  const base = path.basename(safeName);
  const fileName = isDocx(base) ? base : `${base}.docx`;

  const candidates = [
    path.join(templatesDir, fileName),
    path.join(process.cwd(), 'العقود الورد', fileName),
    path.join(app.getAppPath(), 'العقود الورد', fileName),
    path.join(path.dirname(app.getPath('exe')), 'العقود الورد', fileName),
  ];

  const found = candidates.find(existsFile);
  if (!found) throw new Error(`لم يتم العثور على قالب Word: ${fileName}`);

  const st = await fsp.stat(found);
  if (!st.isFile() || st.size <= 0) throw new Error('القالب غير صالح');
  if (st.size > MAX_TEMPLATE_BYTES) throw new Error('حجم القالب كبير جداً');

  return { templatePath: found, fileName };
};
