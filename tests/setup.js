/* global beforeAll, afterAll */
/**
 * Jest Setup File
 * ملف إعداد بيئة الاختبار
 */

// إضافة matchers من testing-library
import '@testing-library/jest-dom';
import { jest } from '@jest/globals';

// Mock window.matchMedia
if (typeof globalThis.window === 'undefined') {
  globalThis.window = {};
}

if (typeof globalThis.window.matchMedia === 'undefined') {
  Object.defineProperty(globalThis.window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
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
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock;

// Mock sessionStorage
const sessionStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.sessionStorage = sessionStorageMock;

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
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render')
    ) {
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
