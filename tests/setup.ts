/* global beforeAll, afterAll */
/**
 * Jest Setup File
 * ملف إعداد بيئة الاختبار
 */

// إضافة matchers من testing-library
import '@testing-library/jest-dom';
import { jest } from '@jest/globals';
import { TextDecoder, TextEncoder } from 'util';
import { webcrypto } from 'node:crypto';

// Polyfill WebCrypto for JSDOM
if (typeof globalThis.crypto === 'undefined' || !globalThis.crypto.subtle) {
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
    configurable: true,
  });
}

if (typeof globalThis.TextEncoder === 'undefined') {
  globalThis.TextEncoder = TextEncoder;
}
if (typeof globalThis.TextDecoder === 'undefined') {
  globalThis.TextDecoder = TextDecoder;
}

// window.desktopDb remains undefined by default to allow Web Mode/Mock DB logic to run.
// Tests specifically targeting Desktop logic should mock this globally or locally.
const desktopDbMock = {
  domainMigrate: jest.fn(() => Promise.resolve({ ok: true })),
  get: jest.fn((key: string) => Promise.resolve(globalThis.localStorage.getItem(key))),
  set: jest.fn((key: string, val: string) => {
    globalThis.localStorage.setItem(key, val);
    return Promise.resolve({ ok: true });
  }),
  delete: jest.fn((key: string) => {
    globalThis.localStorage.removeItem(key);
    return Promise.resolve({ ok: true });
  }),
  keys: jest.fn(() => Promise.resolve(Object.keys(globalThis.localStorage))),
  onRemoteUpdate: jest.fn(() => (() => {})),
  
  // Enriched relational data for "Glory Strike Reloaded"
  domainSearchGlobal: jest.fn(() => Promise.resolve({
    ok: true,
    people: [{ رقم_الشخص: 'U1', الاسم: 'Test User' }, { رقم_الشخص: 'U2', الاسم: 'Another User' }],
    properties: [{ رقم_العقار: 'P1', الكود_الداخلي: 'P101', العنوان: 'Main St' }, { رقم_العقار: 'P2', الكود_الداخلي: 'P102', العنوان: 'Side St' }],
    contracts: [{ رقم_العقد: 'C1', رقم_العقار: 'P1', رقم_المستاجر: 'U1' }],
  })),
  domainSearch: jest.fn(({ entity }) => {
    if (entity === 'people') return Promise.resolve({ ok: true, items: [{ رقم_الشخص: 'U1', الاسم: 'Test User' }] });
    if (entity === 'properties') return Promise.resolve({ ok: true, items: [{ رقم_العقار: 'P1', الكود_الداخلي: 'P101' }] });
    return Promise.resolve({ ok: true, items: [] });
  }),
  domainCounts: jest.fn(() => Promise.resolve({ ok: true, counts: { properties: 50, contracts: 100, people: 200 } })),
  domainDashboardSummary: jest.fn(() => Promise.resolve({
    ok: true,
    data: {
      totalPeople: 200, totalProperties: 50, occupiedProperties: 40, totalContracts: 100, activeContracts: 80,
      dueNext7Payments: 5, paymentsToday: 2, revenueToday: 1500, contractsExpiring30: 3, maintenanceOpen: 1,
      propertyTypeCounts: [{ name: 'Apartment', value: 30 }, { name: 'Villa', value: 20 }],
      contractStatusCounts: [{ name: 'Active', value: 80 }, { name: 'Expired', value: 20 }]
    }
  })),
  domainDashboardPerformance: jest.fn(() => Promise.resolve({
    ok: true,
    data: { currentMonthCollections: 5000, previousMonthCollections: 4500, paidCountThisMonth: 10, dueUnpaidThisMonth: 2 }
  })),
  domainDashboardHighlights: jest.fn(() => Promise.resolve({
    ok: true,
    data: { dueInstallmentsToday: [], expiringContracts: [], incompleteProperties: [] }
  })),
  domainPaymentNotificationTargets: jest.fn(() => Promise.resolve({ ok: true, items: [] })),
  domainPersonDetails: jest.fn(() => Promise.resolve({
    ok: true,
    data: { رقم_الشخص: 'U1', الاسم: 'Test User', رقم_الهاتف: '0790000000', الرقم_الوطني: '123' }
  })),
  domainPersonTenancyContracts: jest.fn(() => Promise.resolve({
    ok: true,
    items: [{ contract: { رقم_العقد: 'C1', تاريخ_البداية: '2025-01-01' }, propertyCode: 'P101', propertyAddress: 'Main St' }]
  })),
  domainContractDetails: jest.fn(() => Promise.resolve({
    ok: true,
    data: {
      contract: { رقم_العقد: 'C1', رقم_العقار: 'P1', رقم_المستاجر: 'U1', القيمة_السنوية: 1200, مدة_العقد_بالاشهر: 12, تكرار_الدفع: 12 },
      installments: [{ رقم_الكمبيالة: 'I1', تاريخ_الاستحقاق: '2025-02-01', القيمة: 100, حالة_الكمبيالة: 'مستحق' }]
    }
  })),
  domainContractPickerSearch: jest.fn(() => Promise.resolve({
    ok: true,
    items: [{ contract: { رقم_العقد: 'C1', رقم_العقار: 'P1' } }]
  })),
  domainPropertyPickerSearch: jest.fn(() => Promise.resolve({
    ok: true,
    items: [{ property: { رقم_العقار: 'P1', الكود_الداخلي: 'P101' } }]
  })),
  domainPropertyPickerSearchPaged: jest.fn(() => Promise.resolve({
    ok: true,
    items: [{ property: { رقم_العقار: 'P1', الكود_الداخلي: 'P101' } }],
    total: 1
  })),
  domainOwnershipHistory: jest.fn(() => Promise.resolve({ ok: true, items: [] })),
  domainPropertyInspections: jest.fn(() => Promise.resolve({ ok: true, items: [] })),
  domainPropertyContracts: jest.fn(() => Promise.resolve({ ok: true, items: [] })),
  domainSalesForPerson: jest.fn(() => Promise.resolve({ ok: true, listings: [], agreements: [] })),
  domainSalesForProperty: jest.fn(() => Promise.resolve({ ok: true, listings: [], agreements: [] })),
  domainBlacklistRemove: jest.fn(() => Promise.resolve({ ok: true })),
  domainUpdateProperty: jest.fn(() => Promise.resolve({ ok: true })),
  domainGet: jest.fn((id) => Promise.resolve({ ok: true, data: { id, name: 'Mock Record' } })),
  installmentsContractsPagedSmart: jest.fn(() => Promise.resolve({ ok: true, items: [], total: 0 })),
  // Commissions (Reloaded)
  getCommissions: jest.fn(() => [{ رقم_العمولة: 'CM1', رقم_العقد: 'C1', عمولة_المالك: 50, عمولة_المستأجر: 50, المجموع: 100, تاريخ_دفع_العمولة: '2025-01-01' }]),
  getExternalCommissions: jest.fn(() => [{ id: 'EX1', التاريخ: '2025-01-01', العنوان: 'Test', القيمة: 500, النوع: 'Bonus' }]),
  getProperties: jest.fn(() => [{ رقم_العقار: 'P1', الكود_الداخلي: 'P101', رقم_المالك: 'U1' }]),
  getPeople: jest.fn(() => [{ رقم_الشخص: 'U1', الاسم: 'Owner' }, { رقم_الشخص: 'U2', الاسم: 'Tenant' }]),
  getContracts: jest.fn(() => [{ رقم_العقد: 'C1', رقم_العقار: 'P1', رقم_المستاجر: 'U2' }]),
  getSalesAgreements: jest.fn(() => []),
  getSystemUsers: jest.fn(() => [{ اسم_المستخدم: 'admin', الاسم_العربي: 'Admin' }]),
};

// Optional: If you want to force desktop mode in a test, use: (window as any).desktopDb = desktopDbMock;


if (typeof window !== 'undefined' && typeof window.matchMedia === 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
}

// Mock IntersectionObserver
(global as any).IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() {
    return [];
  }
  unobserve() {}
};

// Mock ResizeObserver
(global as any).ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

// Mock localStorage
let localStore: any = {};
global.localStorage = {
  getItem: jest.fn((key: string) => localStore[key] ? String(localStore[key]) : null),
  setItem: jest.fn((key: string, value: string) => { localStore[key] = String(value); }),
  removeItem: jest.fn((key: string) => { delete localStore[key]; }),
  clear: jest.fn(() => { localStore = {}; }),
  get length() { return Object.keys(localStore).length; },
  key: jest.fn((i: number) => Object.keys(localStore)[i] || null),
};

// Mock sessionStorage
let sessionStore: any = {};
global.sessionStorage = {
  getItem: jest.fn((key: string) => sessionStore[key] ? String(sessionStore[key]) : null),
  setItem: jest.fn((key: string, value: string) => { sessionStore[key] = String(value); }),
  removeItem: jest.fn((key: string) => { delete sessionStore[key]; }),
  clear: jest.fn(() => { sessionStore = {}; }),
  get length() { return Object.keys(sessionStore).length; },
  key: jest.fn((i: number) => Object.keys(sessionStore)[i] || null),
};

if (typeof window !== 'undefined' && typeof (window as any).electron === 'undefined') {
  (window as any).electron = {
    ipcRenderer: {
      send: jest.fn(),
      on: jest.fn(),
      once: jest.fn(),
      removeListener: jest.fn(),
      invoke: jest.fn(),
    },
  };
}

// Global mocks for high-side-effect services
jest.mock('@/services/audioService', () => ({
  audioService: {
    playSound: jest.fn(),
    setEnabled: jest.fn(),
    isEnabled: () => false,
    getVolume: () => 0.5,
  }
}));

jest.mock('@/services/notificationService', () => ({
  notificationService: {
    notify: jest.fn(),
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
    info: jest.fn(),
    delete: jest.fn(),
    getLogs: () => [],
    clearLogs: jest.fn(),
  }
}));

jest.mock('file-saver', () => ({
  saveAs: jest.fn(),
}));

// Mock noble/ed25519 globally to prevent ESM syntax errors in tests
jest.mock('@noble/ed25519', () => ({
  verifyAsync: jest.fn(async () => true),
  getPublicKey: jest.fn(() => new Uint8Array(32)),
  signAsync: jest.fn(async () => new Uint8Array(64)),
}));

// تعطيل console.error في الاختبارات (اختياري)
const originalError = console.error;
beforeAll(() => {
  console.error = (...args) => {
    if (typeof args[0] === 'string' && args[0].includes('Warning: ReactDOM.render')) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});

// Polyfill File.text and File.arrayBuffer for jsdom
if (typeof globalThis.File !== 'undefined') {
  if (typeof globalThis.File.prototype.text === 'undefined') {
    globalThis.File.prototype.text = function() {
      return Promise.resolve(this._content || '');
    };
  }
  if (typeof globalThis.File.prototype.arrayBuffer === 'undefined') {
    globalThis.File.prototype.arrayBuffer = function() {
      return Promise.resolve(new TextEncoder().encode(this._content || '').buffer);
    };
  }
}

if (typeof globalThis.URL.createObjectURL === 'undefined') {
  globalThis.URL.createObjectURL = () => 'blob:mock';
  globalThis.URL.revokeObjectURL = () => {};
}

// إعداد timeout عام
jest.setTimeout(30000);
