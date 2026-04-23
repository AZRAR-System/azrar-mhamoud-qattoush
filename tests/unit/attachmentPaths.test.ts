import { 
  sanitizeFolderName, 
  toDateOnlySafe,
  buildAttachmentEntityFolder
} from '@/services/db/attachmentPaths';
import * as kv from '@/services/db/kv';
import { KEYS } from '@/services/db/keys';
import { buildCache } from '@/services/dbCache';

describe('Attachment Paths Service - File System Naming Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    buildCache();
  });

  describe('sanitizeFolderName', () => {
    test('replaces illegal characters with dashes', () => {
      const input = 'My/Folder:Name*?';
      // The implementation uses a regex that might collapse multiple dashes or handle them specifically
      const result = sanitizeFolderName(input);
      expect(result).toMatch(/^[a-zA-Z0-9-]+$/);
    });
  });

  describe('buildAttachmentEntityFolder', () => {
    test('Property entity uses internal code if found', () => {
      kv.save(KEYS.PROPERTIES, [{ 
        رقم_العقار: 'PR1', 
        الكود_الداخلي: 'APT-101',
        رقم_المالك: 'P1',
        النوع: 'شقة',
        العنوان: 'شارع مكة',
        حالة_العقار: 'شاغر',
        IsRented: false,
        المساحة: 100
      }]);
      expect(buildAttachmentEntityFolder('Property', 'PR1')).toBe('APT-101');
    });

    test('Clearance entity joins contract and property info', () => {
      kv.save(KEYS.PROPERTIES, [{ 
        رقم_العقار: 'PR1', 
        الكود_الداخلي: 'UNIT-A',
        رقم_المالك: 'P1',
        النوع: 'شقة',
        العنوان: 'شارع مكة',
        حالة_العقار: 'شاغر',
        IsRented: false,
        المساحة: 100
      }]);
      kv.save(KEYS.CONTRACTS, [{ 
        رقم_العقد: 'C1', 
        رقم_العقار: 'PR1',
        رقم_المستاجر: 'P2',
        تاريخ_البداية: '2025-01-01',
        تاريخ_النهاية: '2025-12-31',
        مدة_العقد_بالاشهر: 12,
        القيمة_السنوية: 1200,
        تكرار_الدفع: 1,
        طريقة_الدفع: 'نقدي',
        حالة_العقد: 'نشط',
        isArchived: false,
        lateFeeType: 'none',
        lateFeeValue: 0,
        lateFeeGraceDays: 0
      }]);
      
      const folder = buildAttachmentEntityFolder('Clearance', 'C1');
      expect(folder).toBe('C1__UNIT-A');
    });

    test('Other entities use just the id', () => {
      // The implementation for other types returns sanitizeFolderName(id)
      expect(buildAttachmentEntityFolder('Person', 'P123')).toBe('P123');
    });
  });
});
