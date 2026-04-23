import { 
  listWordTemplates, 
  listWordTemplatesDetailed, 
  importWordTemplate,
  readWordTemplate,
  deleteWordTemplate,
  getMergePlaceholderCatalog
} from '@/services/db/system/wordTemplates';
import { buildCache } from '@/services/dbCache';

describe('Word Templates Service - Document Generation Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    buildCache();
  });

  test('importWordTemplate and listWordTemplates', async () => {
    await importWordTemplate('LegalNotice', 'BASE64_CONTENT');
    const all = listWordTemplates();
    expect(all).toHaveLength(1);
    expect(all[0].name).toContain('LegalNotice');
  });

  test('listWordTemplatesDetailed - returns formatted data', async () => {
    await importWordTemplate('Contract', 'B');
    const res = listWordTemplatesDetailed();
    expect(res.success).toBe(true);
    expect(res.data?.items).toHaveLength(1);
    expect(res.data?.items[0].name).toContain('Contract');
  });

  test('readWordTemplate - decodes base64 content', async () => {
    // 'SGVsbG8=' is 'Hello' in base64
    const content = 'SGVsbG8=';
    const tmpl = await importWordTemplate('Test', content);
    const res = readWordTemplate(tmpl.data!.id);
    
    expect(res.success).toBe(true);
    expect(res.data).toBeInstanceOf(Uint8Array);
    expect(new TextDecoder().decode(res.data!)).toBe('Hello');
  });

  test('deleteWordTemplate - removes template', async () => {
    const tmpl = await importWordTemplate('DeleteMe');
    deleteWordTemplate(tmpl.data!.id);
    expect(listWordTemplates()).toHaveLength(0);
  });

  test('getMergePlaceholderCatalog - returns grouped placeholders', () => {
    const catalog = getMergePlaceholderCatalog();
    expect(catalog.contract).toBeDefined();
    expect(catalog.property).toBeDefined();
    expect(catalog.tenant).toBeDefined();
  });
});
