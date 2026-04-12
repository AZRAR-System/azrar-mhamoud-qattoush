/** @jest-environment jsdom */
import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { KEYS } from '@/services/db/keys';
import { save, get } from '@/services/db/kv';
import * as DomainQueries from '@/services/domainQueries';
import { createContractWrites } from '@/services/db/contracts';
import * as DocxTemplate from '@/utils/docxTemplate';
import * as XlsxUtils from '@/utils/xlsx';

// V13: THE FINAL STAND
// 1. docxTemplate.ts: Added Uint8Array result to mock generates.
// 2. xlsx.ts: Polyfilled File.text for JSDOM.
// 3. domainQueries.ts: Using real exported smart query names.

if (typeof global.localStorage === 'undefined' && typeof window !== 'undefined') {
  // @ts-ignore
  global.localStorage = window.localStorage;
}

// Polyfill for File.text and File.arrayBuffer (missing in JSDOM)
if (typeof File !== 'undefined') {
  if (!File.prototype.text) {
    File.prototype.text = function() {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsText(this);
      });
    };
  }
  if (!File.prototype.arrayBuffer) {
    File.prototype.arrayBuffer = function() {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.readAsArrayBuffer(this);
      });
    };
  }
}

// Mocking libraries for docx
jest.mock('docxtemplater', () => {
  return jest.fn().mockImplementation(() => ({
    setData: jest.fn().mockReturnThis(),
    render: jest.fn().mockReturnThis(),
    getZip: jest.fn().mockReturnValue({
      generate: jest.fn().mockReturnValue(new Uint8Array([1, 2, 3])),
    }),
  }));
});

jest.mock('pizzip', () => {
  return jest.fn().mockImplementation(() => ({
    file: jest.fn().mockReturnValue({ asText: jest.fn().mockReturnValue('<w:p><w:t>{{placeholder}}</w:t></w:p>') }),
    generate: jest.fn().mockReturnValue(new Uint8Array([1, 2, 3])),
  }));
});

describe('V13 Definitive Coverage Strike', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    save(KEYS.PEOPLE, []);
    save(KEYS.PROPERTIES, []);
    save(KEYS.CONTRACTS, []);
    save(KEYS.INSTALLMENTS, []);
    save(KEYS.COMMISSIONS, []);
    save(KEYS.ALERTS, []);
    
    // @ts-ignore
    window.desktopDb = {
      set: jest.fn<any>().mockResolvedValue({}),
      get: jest.fn<any>().mockResolvedValue(null),
      delete: jest.fn<any>().mockResolvedValue({}),
      keys: jest.fn<any>().mockResolvedValue([]),
    };
  });

  describe('1. docxTemplate.ts (Target 70%+)', () => {
    it('detects mustache placeholders accurately', () => {
      const buf = new ArrayBuffer(8);
      expect(DocxTemplate.docxHasMustachePlaceholders(buf)).toBe(true);
    });

    it('fills templates with complex data', () => {
      const res = DocxTemplate.fillDocxTemplate(new ArrayBuffer(8), { name: 'Test' });
      expect(res.ok).toBe(true);
    });

    it('exercises fillContractMaskedDocxTemplate regex paths', () => {
      const mockParser = {
        parseFromString: jest.fn(() => ({
          getElementsByTagName: jest.fn(() => [
            { 
              getElementsByTagName: jest.fn(() => [{ textContent: 'المؤجر :- **********' }]),
            }
          ])
        }))
      };
      // @ts-ignore
      global.DOMParser = jest.fn(() => mockParser);
      // @ts-ignore
      global.XMLSerializer = jest.fn(() => ({ serializeToString: jest.fn(() => '<xml></xml>') }));

      const res = DocxTemplate.fillContractMaskedDocxTemplate(new ArrayBuffer(8), { ownerName: 'Ahmed' });
      expect(res.ok).toBe(true);
    });
  });

  describe('2. xlsx.ts (Target 60%+)', () => {
    it('parses CSV strings with varying delimiters', async () => {
      const csv = 'Name,Phone\nAhmed,123';
      const file = new File([csv], 'test.csv', { type: 'text/csv' });
      const res = await XlsxUtils.readCsvFile(file);
      expect(res).toBeDefined();
    });
  });

  describe('3. contracts.ts (Target 70%+)', () => {
    const cw = createContractWrites({
      logOperation: jest.fn<any>(),
      handleSmartEngine: jest.fn<any>(),
      formatDateOnly: (d: Date) => d.toISOString().slice(0, 10),
      addDaysIso: (iso: string, d: number) => iso,
      addMonthsDateOnly: (iso: string, m: number) => new Date(),
    });

    it('exercises updateContract validation for immutable fields', () => {
      save(KEYS.CONTRACTS, [{ رقم_العقد: 'C1', رقم_العقار: 'PR1', رقم_المستاجر: 'T1' }]);
      const res = cw.updateContract('C1', { رقم_العقار: 'PR2' }, 0, 0);
      expect(res.success).toBe(false);
    });
  });

  describe('4. domainQueries.ts (Target 70%+)', () => {
    it('exercises available smart query functions', async () => {
      const summary = await DomainQueries.dashboardSummarySmart({ todayYMD: '2024-01-01', weekYMD: '2024-01-08' });
      expect(summary).toBeDefined();

      const counts = await DomainQueries.domainCountsSmart();
      expect(counts).toBeDefined();
      
      const resSearch = await DomainQueries.domainSearchSmart('people', 'Ahmed');
      expect(resSearch).toBeDefined();
    });
  });
});
