import { 
  sanitizeFolderName, 
  toDateOnlySafe, 
  buildAttachmentEntityFolder 
} from '@/services/db/attachmentPaths';
import * as kv from '@/services/db/kv';
import { KEYS } from '@/services/db/keys';

describe('Attachment Paths Utility', () => {
  describe('sanitizeFolderName', () => {
    test('cleans dangerous characters', () => {
      expect(sanitizeFolderName('my/folder?*')).toBe('my-folder-');
      expect(sanitizeFolderName('  spaces  ')).toBe('spaces');
      expect(sanitizeFolderName('')).toBe('غير_معروف');
      expect(sanitizeFolderName(null as any)).toBe('غير_معروف');
    });

    test('truncates long names', () => {
      const long = 'a'.repeat(100);
      expect(sanitizeFolderName(long, 10).length).toBe(10);
    });
    
    test('handles empty cleaned string', () => {
      expect(sanitizeFolderName('/*?')).toBe('--');
    });
  });

  describe('toDateOnlySafe', () => {
    test('converts valid dates', () => {
      expect(toDateOnlySafe('2025-01-01')).toBe('2025-01-01');
      expect(toDateOnlySafe(new Date('2025-12-31'))).toBe('2025-12-31');
    });

    test('handles invalid inputs', () => {
      expect(toDateOnlySafe(null)).toBe('');
      expect(toDateOnlySafe('not-a-date')).toBe('not-a-date');
    });
    
    test('handles complex objects', () => {
      expect(toDateOnlySafe({ toString: () => '2025-01-01' })).toBe('2025-01-01');
    });
    
    test('handles catch block (theoretically)', () => {
       // Force error by passing something that throws on String() conversion
       const badObj = { toString: () => { throw new Error('Bad'); } };
       expect(toDateOnlySafe(badObj)).toBe('');
    });
  });

  describe('buildAttachmentEntityFolder', () => {
    beforeEach(() => {
      localStorage.clear();
      jest.clearAllMocks();
    });

    test('Person type', () => {
      expect(buildAttachmentEntityFolder('Person', 'P123')).toBe('P123');
    });

    test('Property type with existing data', () => {
      kv.save(KEYS.PROPERTIES, [{ 
        رقم_العقار: 'PR1', 
        الكود_الداخلي: 'HOUSE-1',
        رقم_المالك: 'O1',
        النوع: 'Apartment',
        العنوان: 'Amman',
        حالة_العقار: 'Available',
        IsRented: false,
        المساحة: 100
      } as any]);
      expect(buildAttachmentEntityFolder('Property', 'PR1')).toBe('HOUSE-1');
    });

    test('Property type with missing data', () => {
      kv.save(KEYS.PROPERTIES, []);
      expect(buildAttachmentEntityFolder('Property', 'PR1')).toBe('PR1');
    });

    test('Contract type', () => {
      expect(buildAttachmentEntityFolder('Contract', 'C99')).toBe('C99');
    });

    test('Clearance type with contract and property', () => {
      kv.save(KEYS.CONTRACTS, [{ 
        رقم_العقد: 'CLR-1', 
        رقم_العقار: 'PR-A',
        رقم_المستاجر: 'T1',
        تاريخ_البداية: '2025-01-01',
        تاريخ_النهاية: '2026-01-01',
        مدة_العقد_بالاشهر: 12,
        القيمة_السنوية: 1200,
        تكرار_الدفع: 1,
        طريقة_الدفع: 'Cash',
        حالة_العقد: 'Active',
        isArchived: false,
        lateFeeType: 'none',
        lateFeeValue: 0,
        lateFeeGraceDays: 0
      } as any]);
      kv.save(KEYS.PROPERTIES, [{ 
        رقم_العقار: 'PR-A', 
        الكود_الداخلي: 'PROP-A',
        رقم_المالك: 'O1',
        النوع: 'Apartment',
        العنوان: 'Amman',
        حالة_العقار: 'Available',
        IsRented: false,
        المساحة: 100
      } as any]);
      expect(buildAttachmentEntityFolder('Clearance', 'CLR-1')).toBe('CLR-1__PROP-A');
    });
    
    test('Clearance type with missing contract', () => {
      kv.save(KEYS.CONTRACTS, []);
      expect(buildAttachmentEntityFolder('Clearance', 'CLR-2')).toBe('CLR-2');
    });

    test('Clearance type with empty reference', () => {
      kv.save(KEYS.CONTRACTS, []);
      expect(buildAttachmentEntityFolder('Clearance', '')).toBe('غير_معروف');
    });

    test('Other types', () => {
      expect(buildAttachmentEntityFolder('Note', 'N1')).toBe('Note - N1');
      expect(buildAttachmentEntityFolder('', 'X')).toBe('Other - X');
    });
  });
});
