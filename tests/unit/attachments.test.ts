import { 
  getAttachments, 
  getAllAttachments, 
  uploadAttachment, 
  deleteAttachment,
  readWordTemplate,
  listWordTemplates
} from '@/services/db/system/attachments';
import * as kv from '@/services/db/kv';
import { KEYS } from '@/services/db/keys';
import { buildCache } from '@/services/dbCache';

describe('Attachments System Service - File Management Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    buildCache();
    // Clean bridge
    delete (window as any).desktopDb;
    jest.clearAllMocks();
  });

  const mockFile = (name: string, size: number) => {
    const f = new File([''], name);
    Object.defineProperty(f, 'size', { value: size });
    return f;
  };

  test('uploadAttachment - mock browser mode (FileReader)', async () => {
    const file = mockFile('test.pdf', 1024);
    const res = await uploadAttachment('Property', 'PR1', file);
    
    expect(res.success).toBe(true);
    expect(res.data?.fileName).toBe('test.pdf');
    
    const all = getAttachments('Property', 'PR1');
    expect(all).toHaveLength(1);
  });

  test('uploadAttachment - desktop mode (Bridge)', async () => {
    const mockBridge = {
      saveAttachmentFile: jest.fn().mockResolvedValue({
        success: true,
        relativePath: 'uploads/PR1/test.pdf'
      }),
      set: jest.fn().mockResolvedValue(true),
      get: jest.fn().mockResolvedValue(null)
    };
    (window as any).desktopDb = mockBridge;

    const file = mockFile('test.pdf', 1024);
    const res = await uploadAttachment('Property', 'PR1', file);
    
    expect(res.success).toBe(true);
    expect(res.data?.filePath).toBe('uploads/PR1/test.pdf');
  });

  test('deleteAttachment - removes record and calls bridge if filePath exists', async () => {
    const mockBridge = {
      deleteAttachmentFile: jest.fn().mockResolvedValue(true),
      set: jest.fn().mockResolvedValue(true),
      get: jest.fn().mockResolvedValue(null),
      delete: jest.fn().mockResolvedValue(true),
      keys: jest.fn().mockResolvedValue([])
    };
    (window as any).desktopDb = mockBridge;

    kv.save(KEYS.ATTACHMENTS, [{ id: 'ATT-1', filePath: 'path/to/file', referenceType: 'Property', referenceId: 'PR1' }]);
    
    await deleteAttachment('ATT-1');
    expect(mockBridge.deleteAttachmentFile).toHaveBeenCalledWith('path/to/file');
    expect(kv.get<any>(KEYS.ATTACHMENTS)).toHaveLength(0);
  });

  test('readWordTemplate - fails in browser, succeeds in desktop', async () => {
    // Browser mode
    const res1 = await readWordTemplate('contract.docx');
    expect(res1.success).toBe(false);
    expect(res1.message).toContain('سطح المكتب');

    // Desktop mode
    const mockBridge = {
      readTemplateFile: jest.fn().mockResolvedValue({
        success: true,
        dataUri: 'data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,AAAA'
      }),
      set: jest.fn().mockResolvedValue(true),
      get: jest.fn().mockResolvedValue(null),
      delete: jest.fn().mockResolvedValue(true),
      keys: jest.fn().mockResolvedValue([])
    };
    (window as any).desktopDb = mockBridge;

    const res2 = await readWordTemplate('contract.docx');
    expect(res2.success).toBe(true);
    expect(res2.data).toBeInstanceOf(ArrayBuffer);
  });

  test('listWordTemplates - calls desktop bridge', async () => {
    const mockBridge = {
      listTemplates: jest.fn().mockResolvedValue({
        success: true,
        items: ['T1.docx', 'T2.docx']
      }),
      set: jest.fn().mockResolvedValue(true),
      get: jest.fn().mockResolvedValue(null),
      delete: jest.fn().mockResolvedValue(true),
      keys: jest.fn().mockResolvedValue([])
    };
    (window as any).desktopDb = mockBridge;

    const res = await listWordTemplates('contracts');
    expect(res.success).toBe(true);
    expect(res.data).toEqual(['T1.docx', 'T2.docx']);
  });
});
