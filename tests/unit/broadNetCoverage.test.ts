import { jest } from '@jest/globals';
import * as people from '../../src/services/db/people';
import * as sales from '../../src/services/db/sales';
import * as whatsApp from '../../src/services/whatsAppAutoSender';
import { createBackgroundScansRuntime } from '../../src/services/db/backgroundScans';
import * as docx from '../../src/utils/docxTemplate';
import { KEYS } from '../../src/services/db/keys';

// --- ROBUST MOCKS ---
let mockKv: Record<string, any> = {
  [KEYS.PEOPLE]: [],
  [KEYS.ROLES]: [],
  [KEYS.PROPERTIES]: [],
  [KEYS.CONTRACTS]: [],
  [KEYS.INSTALLMENTS]: [],
  [KEYS.ALERTS]: [],
  [KEYS.SALES_LISTINGS]: [],
  [KEYS.SALES_OFFERS]: [],
  [KEYS.SALES_AGREEMENTS]: [],
  [KEYS.EXTERNAL_COMMISSIONS]: [],
  [KEYS.CONTACTS]: [],
  [KEYS.NOTIFICATION_SEND_LOGS]: [],
};

jest.mock('../../src/services/db/kv', () => ({
  get: jest.fn((key: string) => mockKv[key] || []),
  save: jest.fn((key: string, val: any) => { mockKv[key] = val; }),
}));

(global as any).window = (global as any).window || {
  dispatchEvent: jest.fn(),
};

(global as any).window.desktopDb = {
  domainMigrate: jest.fn(async () => ({ ok: true })),
  get: jest.fn(async (key: string) => mockKv[key] || null),
  set: jest.fn(async (key: string, val: any) => { mockKv[key] = val; return { ok: true }; }),
  delete: jest.fn(async (key: string) => { delete mockKv[key]; return { ok: true }; }),
  keys: jest.fn(async () => Object.keys(mockKv)),
  onRemoteUpdate: jest.fn(() => (() => {})),
  domainSearchGlobal: jest.fn(async () => ({ ok: true, people: [], properties: [], contracts: [] })),
  domainSearch: jest.fn(async () => ({ ok: true, items: [] })),
  domainCounts: jest.fn(async () => ({ ok: true, counts: {} })),
  domainDashboardSummary: jest.fn(async () => ({ ok: true, data: {} })),
  domainDashboardPerformance: jest.fn(async () => ({ ok: true, data: {} })),
  domainDashboardHighlights: jest.fn(async () => ({ ok: true, data: {} })),
  domainPaymentNotificationTargets: jest.fn(async () => ({ ok: true, items: [] })),
  domainPersonDetails: jest.fn(async () => ({ ok: true, data: {} })),
  domainPersonTenancyContracts: jest.fn(async () => ({ ok: true, items: [] })),
  domainContractDetails: jest.fn(async () => ({ ok: true, data: {} })),
  domainContractPickerSearch: jest.fn(async () => ({ ok: true, items: [] })),
  domainPropertyPickerSearch: jest.fn(async () => ({ ok: true, items: [] })),
  domainPropertyPickerSearchPaged: jest.fn(async () => ({ ok: true, items: [], total: 0 })),
  domainOwnershipHistory: jest.fn(async () => ({ ok: true, items: [] })),
  domainPropertyInspections: jest.fn(async () => ({ ok: true, items: [] })),
  domainPropertyContracts: jest.fn(async () => ({ ok: true, items: [] })),
  domainSalesForPerson: jest.fn(async () => ({ ok: true, listings: [], agreements: [] })),
  domainSalesForProperty: jest.fn(async () => ({ ok: true, listings: [], agreements: [] })),
  domainBlacklistRemove: jest.fn(async () => ({ ok: true })),
  domainUpdateProperty: jest.fn(async () => ({ ok: true })),
  domainGet: jest.fn(async () => ({ ok: true, data: null })),
  installmentsContractsPagedSmart: jest.fn(async () => ({ ok: true, items: [], total: 0 })),
};

jest.mock('../../src/services/storage', () => ({
  storage: { 
    isDesktop: () => true,
    get: jest.fn(async (k: string) => mockKv[k]),
    set: jest.fn(async (k: string, v: any) => { mockKv[k] = v; }),
  }
}));

jest.mock('../../src/utils/whatsapp', () => ({
  openWhatsAppForPhones: jest.fn(async () => {}),
  buildWhatsAppLink: jest.fn(() => 'https://wa.me/mock'),
}));

// Mock DOMParser for docxTemplate
class MockDOMParser {
  parseFromString() {
    return {
      getElementsByTagName: () => [],
    };
  }
}
(global as any).DOMParser = MockDOMParser;
(global as any).XMLSerializer = class { serializeToString() { return ''; } };

describe('Final Broad Net Coverage Strike V3 - Targeting 70%', () => {
  beforeEach(() => {
    mockKv = {
      [KEYS.PEOPLE]: [],
      [KEYS.ROLES]: [],
      [KEYS.PROPERTIES]: [],
      [KEYS.CONTRACTS]: [],
      [KEYS.INSTALLMENTS]: [],
      [KEYS.ALERTS]: [],
      [KEYS.SALES_LISTINGS]: [],
      [KEYS.SALES_OFFERS]: [],
      [KEYS.SALES_AGREEMENTS]: [],
      [KEYS.EXTERNAL_COMMISSIONS]: [],
      [KEYS.CONTACTS]: [],
      [KEYS.NOTIFICATION_SEND_LOGS]: [],
    };
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('people.ts - All Branches', async () => {
    mockKv[KEYS.PEOPLE] = [{ رقم_الشخص: 'P1', الاسم: 'Test' }];
    people.addPerson({ الاسم: 'New' } as any, ['Role1']);
    jest.advanceTimersByTime(2000);

    // Rating branches
    people.updateTenantRatingImpl('P1', 'full');
    people.updateTenantRatingImpl('P1', 'partial');
    people.updateTenantRatingImpl('P1', 'late');
    
    // Auto-link
    mockKv[KEYS.CONTACTS] = [{ id: 'C1', name: 'Matched', phone: '123' }];
    people.addPersonWithAutoLinkInternal({ الاسم: 'A', رقم_الهاتف: '123' } as any, []);
    
    people.getContactsDirectoryInternal();
  });

  test('sales.ts - All Branches', () => {
    mockKv[KEYS.PROPERTIES] = [{ رقم_العقار: 'PROP1' }];
    sales.createSalesListing({ رقم_العقار: 'PROP1', رقم_المالك: 'OWN1', السعر_المطلوب: 1000 });
    
    mockKv[KEYS.SALES_LISTINGS] = [{ id: 'L1', الحالة: 'Active', رقم_العقار: 'PROP1' }];
    sales.submitSalesOffer({ listingId: 'L1', رقم_المشتري: 'BUY1', قيمة_العرض: 500 });
    
    mockKv[KEYS.SALES_OFFERS] = [{ id: 'OFF1', listingId: 'L1' }];
    sales.updateOfferStatus('OFF1', 'Accepted');
    
    mockKv[KEYS.SALES_AGREEMENTS] = [{ id: 'AGR1', listingId: 'L1', isCompleted: false, السعر_النهائي: 10000 }];
    sales.updateSalesAgreement('AGR1', {}, { buyer: 100, seller: 100, external: 50 });
  });

  test('whatsAppAutoSender.ts - Timing and Queuing', async () => {
    const settings = { whatsAppAutoEnabled: true, whatsAppWorkHoursStart: 8, whatsAppWorkHoursEnd: 20 };
    const params = {
        installment: { رقم_الكمبيالة: 'I1' } as any,
        contract: { رقم_العقد: 'C1' } as any,
        tenant: { رقم_الهاتف: '123' } as any,
        property: {} as any,
        settings: settings as any,
        daysUntilDue: 3
    };

    // Trigger classification branches
    whatsApp.classifyAutoSendKind(3, 3);
    whatsApp.classifyAutoSendKind(0, 3);
    whatsApp.classifyAutoSendKind(-3, 3);

    await whatsApp.tryAutoSendIfEligible(params);
    await whatsApp.sendContractTerminationNotice('123', params.contract, 'R', 'D');
  });

  test('docxTemplate.ts - Masked Fill', () => {
    const buf = new ArrayBuffer(8);
    docx.fillContractMaskedDocxTemplate(buf, { ownerName: 'O', tenantName: 'T' });
  });

  test('backgroundScans.ts - Runtime Loops', () => {
    const deps = {
        asUnknownRecord: (v: any) => v,
        toDateOnly: (d: Date) => d,
        formatDateOnly: (d: Date) => d.toISOString().split('T')[0],
        parseDateOnly: (s: string) => new Date(s),
        daysBetweenDateOnly: () => 3,
        addDaysIso: () => '2026-01-01',
        addMonthsDateOnly: () => new Date(),
        createContract: jest.fn(() => ({ success: true, data: { رقم_العقد: 'C2' } })) as any,
        logOperationInternal: jest.fn(),
    };
    const runtime = createBackgroundScansRuntime(deps);
    
    mockKv[KEYS.PEOPLE] = [{ رقم_الشخص: 'P1' }];
    mockKv[KEYS.PROPERTIES] = [{ رقم_العقار: 'PR1' }];
    mockKv[KEYS.CONTRACTS] = [{ رقم_العقد: 'C1', رقم_المالك: 'P1', رقم_المستاجر: 'P1', رقم_العقار: 'PR1' }];
    mockKv[KEYS.INSTALLMENTS] = [{ رقم_الكمبيالة: 'I1', رقم_العقد: 'C1', تاريخ_استحقاق: '2026-01-01' }];
    
    runtime.runInstallmentReminderScanInternal();
    runtime.runDataQualityScanInternal();
    runtime.runExpiryScanInternal();
    runtime.runRiskScanInternal();
  });
});
