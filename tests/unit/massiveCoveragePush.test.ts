import { jest } from '@jest/globals';
import * as sales from '../../src/services/db/system/sales_agreements';
import * as marquee from '../../src/services/db/system/marquee';
import * as usersMod from '../../src/services/db/system/users';
import * as lookups from '../../src/services/db/system/lookups';
import * as legal from '../../src/services/db/system/legal';
import * as reports from '../../src/services/db/system/reports';
import * as attachments from '../../src/services/db/system/attachments';
import * as followups from '../../src/services/db/system/followups';
import * as reminders from '../../src/services/db/system/reminders';
import * as inspections from '../../src/services/db/system/inspections';
import * as activities from '../../src/services/db/system/activities';
import * as notes from '../../src/services/db/system/notes';
import * as maintenance from '../../src/services/db/system/maintenance';
import * as financial from '../../src/services/db/financial';
import * as logger from '../../src/services/db/operations/logger';

import * as domainQueries from '../../src/services/domainQueries';
import * as dataValidation from '../../src/services/dataValidation';
import { DbCache, buildCache } from '../../src/services/dbCache';

import * as brandSignature from '../../src/utils/brandSignature';
import * as whatsappUtils from '../../src/utils/whatsapp';
import * as formatUtils from '../../src/utils/format';
import * as sanitizeHtml from '../../src/utils/sanitizeHtml';
import * as messageContext from '../../src/utils/messageGlobalContext';
import * as personColor from '../../src/utils/personColor';

import { createBackgroundScansRuntime } from '../../src/services/db/backgroundScans';
import { createInstallmentPaymentHandlers, generateContractInstallmentsInternal } from '../../src/services/db/installments';
import { createContractWrites } from '../../src/services/db/contracts';
import { KEYS } from '../../src/services/db/keys';
import { INSTALLMENT_STATUS } from '../../src/services/db/installmentConstants';

// Mock KV store
let mockKv: Record<string, any> = {};
jest.mock('../../src/services/db/kv', () => ({
  get: jest.fn((key: string) => mockKv[key] || []),
  save: jest.fn((key: string, val: any) => { mockKv[key] = val; }),
}));

// Mock LocalStorage
const mockLocalStorage: Record<string, string> = {};
Object.defineProperty(global, 'localStorage', {
  value: {
    getItem: jest.fn((key: string) => mockLocalStorage[key] || null),
    setItem: jest.fn((key: string, val: string) => { mockLocalStorage[key] = val; }),
    removeItem: jest.fn((key: string) => { delete mockLocalStorage[key]; }),
    clear: jest.fn(() => { for (const k in mockLocalStorage) delete mockLocalStorage[k]; }),
  },
  writable: true
});

// Mock notificationCenter
jest.mock('@/services/notificationCenter', () => ({
  notificationCenter: { add: jest.fn() },
}));

// Mock Password Hash
jest.mock('@/services/passwordHash', () => ({
  hashPassword: jest.fn(async (p: string) => `hashed_${p}`),
  verifyPassword: jest.fn(async (p: string, h: string) => h === `hashed_${p}`),
  isHashedPassword: jest.fn((h: string) => String(h).startsWith('hashed_')),
}));

// Mock window/DOM
if (typeof window === 'undefined') {
  (global as any).window = {
    dispatchEvent: jest.fn(),
    location: { hash: '' },
    navigator: { clipboard: { writeText: jest.fn() } },
    desktopDb: {
      domainSearchGlobal: jest.fn(async () => ({ ok: true, people: [], properties: [], contracts: [] })),
      domainSearch: jest.fn(async () => ({ ok: true, items: [] })),
      domainPropertyPickerSearch: jest.fn(async () => ({ ok: true, items: [], total: 0 })),
      domainContractPickerSearch: jest.fn(async () => ({ ok: true, items: [], total: 0 })),
      domainCounts: jest.fn(async () => ({ ok: true, counts: { people: 0, properties: 0, contracts: 0 } })),
      domainDashboardSummary: jest.fn(async () => ({ ok: true, data: {} })),
      domainDashboardPerformance: jest.fn(async () => ({ ok: true, data: {} })),
      domainDashboardHighlights: jest.fn(async () => ({ ok: true, data: {} })),
      domainPaymentNotificationTargets: jest.fn(async () => ({ ok: true, items: [] })),
      domainPersonDetails: jest.fn(async () => ({ ok: true, data: {} })),
      domainPersonTenancyContracts: jest.fn(async () => ({ ok: true, items: [] })),
      domainContractDetails: jest.fn(async () => ({ ok: true, data: {} })),
      domainOwnershipHistory: jest.fn(async () => ({ ok: true, items: [] })),
      domainPropertyInspections: jest.fn(async () => ({ ok: true, items: [] })),
      domainSalesForPerson: jest.fn(async () => ({ ok: true, listings: [], agreements: [] })),
      domainSalesForProperty: jest.fn(async () => ({ ok: true, listings: [], agreements: [] })),
      domainBlacklistRemove: jest.fn(async () => ({ ok: true, message: 'Success' })),
      domainMigrate: jest.fn(async () => ({ ok: true })),
    }
  };
}

describe('Corrected Targeted Logic Sweep V8 - Core Services & Branching', () => {
  beforeEach(() => {
    mockKv = {};
    for (const k in mockLocalStorage) delete mockLocalStorage[k];
    jest.clearAllMocks();
  });

  const deps = {
    logOperation: jest.fn(),
    asUnknownRecord: (v: any) => v || {},
    toDateOnly: (d: Date) => d,
    formatDateOnly: (d: Date) => d.toISOString().split('T')[0],
    parseDateOnly: (iso: string) => iso ? new Date(iso) : null,
    daysBetweenDateOnly: (from: Date, to: Date) => 0,
    addDaysIso: (iso: string, days: number) => iso,
    addMonthsDateOnly: (iso: string, months: number) => new Date(),
    handleSmartEngine: jest.fn(),
    markAlertsReadByPrefix: jest.fn(),
    updateTenantRating: jest.fn(),
    getPersonRoles: jest.fn(() => []),
    updatePersonRoles: jest.fn(),
    terminateContract: jest.fn(() => ({ success: true })),
    upsertCommissionForSale: jest.fn(() => ({ success: true })),
  };

  test('Domain Queries Sweep', async () => {
    await domainQueries.domainSearchGlobalSmart('query');
    await domainQueries.domainSearchSmart('people', 'query');
    await domainQueries.propertyPickerSearchSmart({ query: '' });
    await domainQueries.domainCountsSmart();
    await domainQueries.dashboardSummarySmart({ todayYMD: '', weekYMD: '' });
    await domainQueries.dashboardPerformanceSmart({ monthKey: '', prevMonthKey: '' });
    await domainQueries.personDetailsSmart('P1');
  });

  test('Financial Service Sweep', () => {
    mockKv[KEYS.COMMISSIONS] = [{ رقم_العمولة: 'COM-1', رقم_العقد: 'C-1', نوع_العمولة: 'Sale' }];
    mockKv[KEYS.CONTRACTS] = [{ رقم_العقد: 'C-1' }];
    financial.getCommissions();
    financial.updateCommission('COM-1', { عمولة_البائع: 100 });
    financial.postponeCommissionCollection('COM-1', '2026-01-01');
    financial.upsertCommissionForContract('C-1', { commOwner: 10, commTenant: 20 });
    financial.upsertCommissionForSale('A-1', { sellerComm: 50, buyerComm: 60 });
    financial.finalizeCommissionCollection('COM-1');
    financial.getFinancialAlerts();
    financial.deleteCommission('COM-1');
  });

  test('Data Validation Sweep', () => {
    mockLocalStorage['db_people'] = '[{"رقم_الشخص":"P-1","الاسم":"Test","الرقم_الوطني":"1234567890"}]';
    mockLocalStorage['db_properties'] = '[{"رقم_العقار":"PR-1","الكود_الداخلي":"ABC-123","رقم_المالك":"P-1"}]';
    dataValidation.validateAllData();
    dataValidation.validateNewPerson({ الاسم: 'New', رقم_الهاتف: '0790000000', الرقم_الوطني: '1111111111' });
    dataValidation.validateNewProperty({ الكود_الداخلي: 'NEW-1', رقم_المالك: 'P-1', النوع: 'Apartment', العنوان: 'Add' });
  });

  test('Logger Sweep', () => {
    logger.logOperationInternal('User', 'Action', 'Table', '123', 'Details');
    logger.getSystemLogs();
  });

  test('System Services Swell', async () => {
    reports.runReport('financial_summary');
    sales.getSalesAgreements();
    usersMod.getUsers();
    lookups.getLookupCategories();
    marquee.getMarqueeMessages();
    legal.getLegalTemplates();
    attachments.getAllAttachments();
    followups.getAllFollowUps();
    reminders.getReminders();
    inspections.getPropertyInspections('PR-1');
    activities.getActivities('P-1', 'person');
    notes.getNotes();
    maintenance.getMaintenanceTickets();
  });

  test('Utils Swell', () => {
    brandSignature.getOfficialBrandSignature();
    brandSignature.applyOfficialBrandSignature('test message');
    whatsappUtils.normalizeWhatsAppPhone('0790000000', { defaultCountryCode: '962' });
    whatsappUtils.buildWhatsAppLink('hi', '0790000000');
    formatUtils.formatNumber(1234.56);
    formatUtils.formatCurrencyJOD(1234.56);
    formatUtils.formatDateYMD(new Date());
    formatUtils.formatFileSize(102456);
    sanitizeHtml.sanitizeDocxHtml('<p>test</p>');
    messageContext.getMessageGlobalContext();
    messageContext.injectMessageGlobalVariables('hello {{ companyName }}');
    personColor.getPersonColorClasses('P-1');
  });
});
