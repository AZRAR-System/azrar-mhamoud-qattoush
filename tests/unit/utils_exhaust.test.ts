import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import { safeString, safeNumber } from '@/utils/safe';
import { hasMessage, getErrorMessage } from '@/utils/errors';
import { buildCompanyLetterheadSheet } from '@/utils/companySheet';
import { formatContractNumberShort } from '@/utils/contractNumber';
import { 
  guardPersonExists, 
  guardPropertyExists, 
  guardContractExists, 
  guardHasData,
  guardHasPeople,
  guardHasProperties,
  guardHasContracts
} from '@/utils/dataGuards';
import { resolveDesktopMessage, resolveDesktopError } from '@/utils/desktopMessages';
import { DbService } from '@/services/mockDb';

describe('Utility Exhaustive Coverage', () => {
  describe('safe.ts', () => {
    test('safeString handles various inputs', () => {
      expect(safeString('hello')).toBe('hello');
      expect(safeString(null)).toBe('');
      expect(safeString(undefined)).toBe('');
      expect(safeString(123)).toBe('123');
      expect(safeString({ a: 1 })).toBe('[object Object]');
    });

    test('safeNumber handles various inputs', () => {
      expect(safeNumber(123)).toBe(123);
      expect(safeNumber('456')).toBe(456);
      expect(safeNumber('abc', 999)).toBe(999);
      expect(safeNumber(null, 1)).toBe(0); // Number(null) is 0
      expect(safeNumber(undefined, 777)).toBe(777);
      expect(safeNumber(NaN, 5)).toBe(5);
      expect(safeNumber(Infinity, 5)).toBe(5);
    });
  });

  describe('errors.ts', () => {
    test('hasMessage identifies objects with message property', () => {
      expect(hasMessage({ message: 'err' })).toBe(true);
      expect(hasMessage({ msg: 'err' })).toBe(false);
      expect(hasMessage(null)).toBe(false);
      expect(hasMessage('error')).toBe(false);
      expect(hasMessage({ message: 123 })).toBe(false);
    });

    test('getErrorMessage extracts message from various formats', () => {
      expect(getErrorMessage(new Error('native error'))).toBe('native error');
      expect(getErrorMessage('string error')).toBe('string error');
      expect(getErrorMessage({ message: 'obj error' })).toBe('obj error');
      expect(getErrorMessage(null)).toBeUndefined();
      expect(getErrorMessage(123)).toBeUndefined();
    });
  });

  describe('companySheet.ts', () => {
    test('buildCompanyLetterheadSheet handles settings correctly', () => {
      const settings = {
        companyName: 'AZRAR',
        companyPhone: '123',
        letterheadEnabled: true,
      };
      const result = buildCompanyLetterheadSheet(settings);
      expect(result).not.toBeNull();
      expect(result?.name).toBe('الترويسة');
      expect(result?.rows).toContainEqual(['اسم الشركة', 'AZRAR']);
      expect(result?.rows).toContainEqual(['الهاتف', '123']);
      
      // Defaults
      const emptyResult = buildCompanyLetterheadSheet({});
      expect(emptyResult?.rows).toContainEqual(['اسم الشركة', '']);
      
      // Disabled
      expect(buildCompanyLetterheadSheet({ letterheadEnabled: false })).toBeNull();
      expect(buildCompanyLetterheadSheet(null)).not.toBeNull();
    });
  });

  describe('contractNumber.ts', () => {
    test('formatContractNumberShort handles various formats', () => {
      // Empty
      expect(formatContractNumberShort('')).toBe('');
      expect(formatContractNumberShort(null)).toBe('');
      
      // New format (cot_###)
      expect(formatContractNumberShort('cot_5')).toBe('cot_005');
      expect(formatContractNumberShort('cot_001')).toBe('cot_001');
      expect(formatContractNumberShort('cot_0')).toBe('cot_0'); // invalid number, returns raw
      
      // Legacy format (CNT-YYYYMMDD-###)
      expect(formatContractNumberShort('CNT-20230510-001')).toBe('230510-001');
      expect(formatContractNumberShort('CNT-19991231-999')).toBe('991231-999');
      
      // Unknown format
      expect(formatContractNumberShort('ABC-123')).toBe('ABC-123');
    });
  });

  describe('dataGuards.ts', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      // @ts-ignore
      delete window.desktopDb;
    });

    test('guardPersonExists', () => {
      expect(guardPersonExists('').isValid).toBe(false);
      
      const spy = jest.spyOn(DbService, 'getPeople').mockReturnValue([{ رقم_الشخص: 'P1' }] as any);
      expect(guardPersonExists('P1').isValid).toBe(true);
      expect(guardPersonExists('P2').isValid).toBe(false);
      spy.mockRestore();

      // Desktop bypass
      // @ts-ignore
      window.desktopDb = {};
      expect(guardPersonExists('anything').isValid).toBe(true);
    });

    test('guardPropertyExists', () => {
      expect(guardPropertyExists('').isValid).toBe(false);
      const spy = jest.spyOn(DbService, 'getProperties').mockReturnValue([{ رقم_العقار: 'PR1' }] as any);
      expect(guardPropertyExists('PR1').isValid).toBe(true);
      expect(guardPropertyExists('PR2').isValid).toBe(false);
      spy.mockRestore();
    });

    test('guardContractExists', () => {
      expect(guardContractExists('').isValid).toBe(false);
      const spy = jest.spyOn(DbService, 'getContracts').mockReturnValue([{ رقم_العقد: 'C1' }] as any);
      expect(guardContractExists('C1').isValid).toBe(true);
      spy.mockRestore();
    });

    test('guardHasData', () => {
      const spyP = jest.spyOn(DbService, 'getPeople').mockReturnValue([{}] as any);
      const spyPr = jest.spyOn(DbService, 'getProperties').mockReturnValue([{}] as any);
      const spyC = jest.spyOn(DbService, 'getContracts').mockReturnValue([{}] as any);
      
      expect(guardHasData().isValid).toBe(true);

      spyC.mockReturnValue([]);
      const res = guardHasData();
      expect(res.isValid).toBe(false);
      expect(res.missingData).toContain('contracts');
      
      spyP.mockRestore();
      spyPr.mockRestore();
      spyC.mockRestore();
    });

    test('specific guards (HasPeople, HasProperties, HasContracts)', () => {
      const spyP = jest.spyOn(DbService, 'getPeople').mockReturnValue([]);
      expect(guardHasPeople().isValid).toBe(false);
      spyP.mockRestore();

      const spyPr = jest.spyOn(DbService, 'getProperties').mockReturnValue([]);
      expect(guardHasProperties().isValid).toBe(false);
      spyPr.mockRestore();

      const spyC = jest.spyOn(DbService, 'getContracts').mockReturnValue([]);
      expect(guardHasContracts().isValid).toBe(false);
      spyC.mockRestore();
    });
  });

  describe('desktopMessages.ts', () => {
    test('resolveDesktopMessage extracts correctly', () => {
      expect(resolveDesktopMessage({ message: 'Success' }, 'skip')).toBe('Success');
      expect(resolveDesktopMessage({ error: 'Fail' }, 'skip')).toBe('Fail');
      expect(resolveDesktopMessage({ Message: 'Cap' }, 'skip')).toBe('Cap');
      expect(resolveDesktopMessage(null, 'fallback')).toBe('fallback');
      expect(resolveDesktopMessage({}, 'fallback')).toBe('fallback');
    });

    test('resolveDesktopError extracts correctly', () => {
      expect(resolveDesktopError(new Error('native'))).toBe('native');
      expect(resolveDesktopError('simple string')).toBe('simple string');
      expect(resolveDesktopError({ message: 'obj msg' })).toBe('obj msg');
      expect(resolveDesktopError({ error: 'obj err' })).toBe('obj err');
      expect(resolveDesktopError(null, 'fallback')).toBe('fallback');
    });
  });
});
