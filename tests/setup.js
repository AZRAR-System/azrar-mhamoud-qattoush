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
  get: jest.fn((key) => Promise.resolve(globalThis.localStorage.getItem(key))),
  set: jest.fn((key, val) => {
    globalThis.localStorage.setItem(key, val);
    return Promise.resolve({ ok: true });
  }),
  delete: jest.fn((key) => {
    globalThis.localStorage.removeItem(key);
    return Promise.resolve({ ok: true });
  }),
  keys: jest.fn(() => Promise.resolve(Object.keys(globalThis.localStorage))),
  onRemoteUpdate: jest.fn(() => (() => {})),
  
  // Smart Query Stubs (Unlocks domainQueries.ts and reports.ts)
  domainSearchGlobal: jest.fn(() => Promise.resolve({ ok: true, people: [], properties: [], contracts: [] })),
  domainSearch: jest.fn(() => Promise.resolve({ ok: true, items: [] })),
  domainCounts: jest.fn(() => Promise.resolve({ ok: true, counts: { properties: 0, contracts: 0, people: 0 } })),
  domainDashboardSummary: jest.fn(() => Promise.resolve({ ok: true, data: {} })),
  domainDashboardPerformance: jest.fn(() => Promise.resolve({ ok: true, data: {} })),
  domainDashboardHighlights: jest.fn(() => Promise.resolve({ ok: true, data: {} })),
  domainPaymentNotificationTargets: jest.fn(() => Promise.resolve({ ok: true, items: [] })),
  domainPersonDetails: jest.fn(() => Promise.resolve({ ok: true, data: {} })),
  domainPersonTenancyContracts: jest.fn(() => Promise.resolve({ ok: true, items: [] })),
  domainContractDetails: jest.fn(() => Promise.resolve({ ok: true, data: {} })),
  domainContractPickerSearch: jest.fn(() => Promise.resolve({ ok: true, items: [] })),
  domainPropertyPickerSearch: jest.fn(() => Promise.resolve({ ok: true, items: [] })),
  domainPropertyPickerSearchPaged: jest.fn(() => Promise.resolve({ ok: true, items: [], total: 0 })),
  domainOwnershipHistory: jest.fn(() => Promise.resolve({ ok: true, items: [] })),
  domainPropertyInspections: jest.fn(() => Promise.resolve({ ok: true, items: [] })),
  domainPropertyContracts: jest.fn(() => Promise.resolve({ ok: true, items: [] })),
  domainSalesForPerson: jest.fn(() => Promise.resolve({ ok: true, listings: [], agreements: [] })),
  domainSalesForProperty: jest.fn(() => Promise.resolve({ ok: true, listings: [], agreements: [] })),
  domainBlacklistRemove: jest.fn(() => Promise.resolve({ ok: true })),
  domainUpdateProperty: jest.fn(() => Promise.resolve({ ok: true })),
  domainGet: jest.fn(() => Promise.resolve({ ok: true, data: null })),
  installmentsContractsPagedSmart: jest.fn(() => Promise.resolve({ ok: true, items: [], total: 0 })),
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
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() {
    return [];
  }
  unobserve() {}
};

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

// Mock localStorage
let localStore = {};
global.localStorage = {
  getItem: jest.fn((key) => localStore[key] ? String(localStore[key]) : null),
  setItem: jest.fn((key, value) => { localStore[key] = String(value); }),
  removeItem: jest.fn((key) => { delete localStore[key]; }),
  clear: jest.fn(() => { localStore = {}; }),
  get length() { return Object.keys(localStore).length; },
  key: jest.fn((i) => Object.keys(localStore)[i] || null),
};

// Mock sessionStorage
let sessionStore = {};
global.sessionStorage = {
  getItem: jest.fn((key) => sessionStore[key] ? String(sessionStore[key]) : null),
  setItem: jest.fn((key, value) => { sessionStore[key] = String(value); }),
  removeItem: jest.fn((key) => { delete sessionStore[key]; }),
  clear: jest.fn(() => { sessionStore = {}; }),
  get length() { return Object.keys(sessionStore).length; },
  key: jest.fn((i) => Object.keys(sessionStore)[i] || null),
};

if (typeof window !== 'undefined' && typeof window.electron === 'undefined') {
  window.electron = {
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
