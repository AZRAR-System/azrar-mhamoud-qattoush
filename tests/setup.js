/* global beforeAll, afterAll */
/**
 * Jest Setup File
 * ملف إعداد بيئة الاختبار
 */

// إضافة matchers من testing-library
import '@testing-library/jest-dom';
import { jest } from '@jest/globals';
import { TextDecoder, TextEncoder } from 'util';

if (typeof globalThis.TextEncoder === 'undefined') {
  globalThis.TextEncoder = TextEncoder;
}
if (typeof globalThis.TextDecoder === 'undefined') {
  globalThis.TextDecoder = TextDecoder;
}

// Mock window.desktopDb (Enables storage.isDesktop() and migration logic)
if (typeof globalThis.window === 'undefined') {
  globalThis.window = {};
}
globalThis.window.desktopDb = {
  domainMigrate: jest.fn(() => Promise.resolve()),
  get: jest.fn((key) => Promise.resolve(globalThis.localStorage.getItem(key))),
  set: jest.fn((key, val) => {
    globalThis.localStorage.setItem(key, val);
    return Promise.resolve();
  }),
  delete: jest.fn((key) => {
    globalThis.localStorage.removeItem(key);
    return Promise.resolve();
  }),
  keys: jest.fn(() => Promise.resolve(Object.keys(globalThis.localStorage))),
  onRemoteUpdate: jest.fn(() => (() => {})),
  
  // Smart Query Stubs (Unlocks domainQueries.ts and reports.ts)
  domainSearch: jest.fn(() => Promise.resolve({ ok: true, items: [] })),
  domainCounts: jest.fn(() => Promise.resolve({ ok: true, data: { properties: 0, contracts: 0, people: 0 } })),
  dashboardSummary: jest.fn(() => Promise.resolve({ ok: true, data: {} })),
  domainGet: jest.fn(() => Promise.resolve({ ok: true, data: null })),
  domainPropertyContracts: jest.fn(() => Promise.resolve({ ok: true, items: [] })),
};

if (typeof globalThis.window.matchMedia === 'undefined') {
  Object.defineProperty(globalThis.window, 'matchMedia', {
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

  // Disable desktop sync mode for tests
  globalThis.window.desktopDb = undefined;

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

// Mock Electron IPC
if (typeof globalThis.window.electron === 'undefined') {
  globalThis.window.electron = {
    ipcRenderer: {
      send: jest.fn(),
      on: jest.fn(),
      once: jest.fn(),
      removeListener: jest.fn(),
      invoke: jest.fn(),
    },
  };
}

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

// إعداد timeout عام
jest.setTimeout(10000);
