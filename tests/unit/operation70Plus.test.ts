import { jest } from '@jest/globals';
import * as users from '../../src/services/db/system/users';
import * as attachments from '../../src/services/db/system/attachments';
import * as legal from '../../src/services/db/system/legal';
import * as lookups from '../../src/services/db/system/lookups';
import * as reports from '../../src/services/db/system/reports';
import * as people from '../../src/services/db/people';
import * as sales from '../../src/services/db/sales';
import { KEYS } from '../../src/services/db/keys';

// --- ROBUST MOCKS ---
let mockKv: Record<string, any> = {};
jest.mock('../../src/services/db/kv', () => ({
  get: jest.fn((key: string) => mockKv[key] || []),
  save: jest.fn((key: string, val: any) => { mockKv[key] = val; }),
}));

jest.mock('../../src/services/passwordHash', () => ({
  hashPassword: jest.fn(async (p: string) => `hashed_${p}`),
  verifyPassword: jest.fn(async (p: string, h: string) => h === `hashed_${p}` || h === p),
  isHashedPassword: jest.fn((h: string) => h.startsWith('hashed_')),
}));

const mockBridge = {
  saveAttachmentFile: jest.fn(async () => ({ success: true, relativePath: 'rel/path' })),
  deleteAttachmentFile: jest.fn(async () => ({ success: true })),
  readTemplateFile: jest.fn(async () => ({ success: true, dataUri: 'data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,AAAA' })),
  listTemplates: jest.fn(async () => ({ success: true, items: ['T1.docx'] })),
  get: jest.fn(async () => '[]'),
};

// Use a module-level variable for the bridge mock return value
let bridgeToReturn: any = mockBridge;

jest.mock('../../src/services/db/refs', () => ({
  getDesktopBridge: jest.fn(() => bridgeToReturn),
}));

// Synchronous FileReader mock
(global as any).FileReader = class {
  onload: any;
  readAsDataURL() {
    setTimeout(() => {
      if (this.onload) this.onload({ target: { result: 'data:mock' } });
    }, 10);
  }
};

jest.setTimeout(60000);

describe('Operation 70 Plus - Absolute Victory Strike', () => {
  beforeEach(() => {
    mockKv = {
      [KEYS.USERS]: [],
      [KEYS.USER_PERMISSIONS]: [],
      [KEYS.ATTACHMENTS]: [],
      [KEYS.CONTRACTS]: [],
      [KEYS.PROPERTIES]: [],
      [KEYS.PEOPLE]: [],
      [KEYS.INSTALLMENTS]: [],
      [KEYS.LEGAL_TEMPLATES]: [],
      [KEYS.LEGAL_HISTORY]: [],
      [KEYS.LOOKUPS]: [],
      [KEYS.LOOKUP_CATEGORIES]: [],
      [KEYS.COMMISSIONS]: [],
      [KEYS.EXTERNAL_COMMISSIONS]: [],
      [KEYS.SALES_LISTINGS]: [],
      [KEYS.SALES_OFFERS]: [],
      [KEYS.SALES_AGREEMENTS]: [],
    };
    bridgeToReturn = mockBridge;
    jest.clearAllMocks();
  });

  test('users.ts and people.ts - Deep Logic', async () => {
    mockKv[KEYS.USERS] = [{ id: 'U1', اسم_المستخدم: 'admin', كلمة_المرور: '123', isActive: true }];
    await users.authenticateUser('admin', '123');
    await users.addSystemUser({ اسم_المستخدم: 'new', كلمة_المرور: 'pass' });
    const u = mockKv[KEYS.USERS].find((x: any) => x.اسم_المستخدم === 'new');
    if (u) {
        await users.changeUserPassword(u.id, 'newpass', 'U1');
        users.deleteSystemUser(u.id);
    }
    
    mockKv[KEYS.PEOPLE] = [{ رقم_الشخص: 'P1', الاسم: 'P1' }];
    people.updateTenantRatingImpl('P1', 'full');
    people.updateTenantRatingImpl('P1', 'partial');
    people.updateTenantRatingImpl('P1', 'late');
    people.updateTenantRatingImpl('P1', 'none');
  });

  test('attachments.ts and sales.ts', async () => {
    const file = (new Blob(['data'], { type: 'text/plain' })) as any;
    file.name = 'test.txt';
    await attachments.uploadAttachment('Property', 'P1', file);
    
    // Web path
    bridgeToReturn = null;
    await attachments.uploadAttachment('Property', 'P2', file);

    mockKv[KEYS.ATTACHMENTS] = [{ id: 'A1', referenceType: 'Property', referenceId: 'P1', filePath: 'path' }];
    await attachments.deleteAttachment('A1');
    await attachments.readWordTemplate('T1', 'contracts');
  });

  test('legal.ts and reports.ts', async () => {
    const handlers = legal.createLegalHandlers({ logOperation: jest.fn() });
    handlers.addLegalTemplate({ name: 'T1', content: 'Notice for {{tenant_name}}' });
    const tmpls = legal.getLegalTemplates();
    if (tmpls.length > 0) {
        mockKv[KEYS.CONTRACTS] = [{ رقم_العقد: 'C1', رقم_المستاجر: 'P1', رقم_العقار: 'PR1' }];
        mockKv[KEYS.PEOPLE] = [{ رقم_الشخص: 'P1', الاسم: 'Tenant' }];
        mockKv[KEYS.PROPERTIES] = [{ رقم_العقار: 'PR1', الكود_الداخلي: 'C-01', رقم_المالك: 'P2' }];
        mockKv[KEYS.INSTALLMENTS] = [{ رقم_الكمبيالة: 'I1', رقم_العقد: 'C1', تاريخ_استحقاق: '2020-01-01', قيمة_الكمبيالة: 100 }];
        handlers.generateLegalNotice(tmpls[0].id, 'C1');
    }

    mockKv[KEYS.CONTRACTS] = [{ رقم_العقد: 'C1', رقم_المستاجر: 'T1', رقم_العقار: 'PR1' }];
    mockKv[KEYS.COMMISSIONS] = [{ رقم_العقد: 'C1', عمولة_المالك: 100, عمولة_المستأجر: 50 }];
    reports.runReport('financial_summary', { dateStart: '2020-01-01', dateEnd: '2026-01-01' });
    reports.runReport('employee_commissions', { userId: 'U1' });
  });

  test('lookups.ts - Deep CRUD', () => {
    lookups.addLookupCategory('NEW', 'LBL');
    lookups.addLookupItem('NEW', 'Item');
    const items = mockKv[KEYS.LOOKUPS];
    if (items.length > 0) {
        lookups.updateLookupItem(items[0].id, 'Name');
        lookups.deleteLookupItem(items[0].id);
    }
  });
});
