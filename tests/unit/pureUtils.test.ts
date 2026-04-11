import { 
  getTenancyStatusScore, 
  isTenancyRelevant, 
  isBetterTenancyContract, 
  pickBestTenancyContract 
} from '@/utils/tenancy';
import { 
  getPersonSeedFromPerson, 
  getPersonColorClasses 
} from '@/utils/personColor';
import { 
  openExternalUrl 
} from '@/utils/externalLink';
import {
  toDateOnlyISO,
  todayDateOnlyISO,
  parseDateOnly,
  daysBetweenDateOnlySafe,
  compareDateOnlySafe
} from '@/utils/dateOnly';

describe('Pure Utility Logic Sweep', () => {

  describe('Tenancy Utils', () => {
    it('getTenancyStatusScore: should rank statuses correctly', () => {
      expect(getTenancyStatusScore('نشط')).toBe(3);
      expect(getTenancyStatusScore('Active')).toBe(3);
      expect(getTenancyStatusScore('قريب الانتهاء')).toBe(2);
      expect(getTenancyStatusScore('مجدد')).toBe(1);
      expect(getTenancyStatusScore('منتهي')).toBe(0);
    });

    it('isTenancyRelevant: should filter out archived and inactive contracts', () => {
      expect(isTenancyRelevant({ حالة_العقد: 'نشط', isArchived: false })).toBe(true);
      expect(isTenancyRelevant({ حالة_العقد: 'نشط', isArchived: true })).toBe(false);
      expect(isTenancyRelevant({ حالة_العقد: 'منتهي', isArchived: false })).toBe(false);
    });

    it('isBetterTenancyContract: should compare contracts by status and date', () => {
      const c1 = { رقم_العقد: '1', حالة_العقد: 'نشط', تاريخ_البداية: '2024-01-01' } as any;
      const c2 = { رقم_العقد: '2', حالة_العقد: 'مجدد', تاريخ_البداية: '2024-01-01' } as any;
      expect(isBetterTenancyContract(c1, c2)).toBe(true);
      
      const c3 = { رقم_العقد: '3', حالة_العقد: 'نشط', تاريخ_البداية: '2024-02-01' } as any;
      expect(isBetterTenancyContract(c3, c1)).toBe(true);
    });

    it('pickBestTenancyContract: should return the highest ranked contract', () => {
      const list = [
        { رقم_العقد: '1', حالة_العقد: 'مجدد', تاريخ_البداية: '2024-01-01' },
        { رقم_العقد: '2', حالة_العقد: 'نشط', تاريخ_البداية: '2024-01-01' }
      ] as any[];
      expect(pickBestTenancyContract(list)?.رقم_العقد).toBe('2');
    });
  });

  describe('PersonColor Utils', () => {
    it('getPersonSeedFromPerson: should extract seed from person object', () => {
      const p = { رقم_الشخص: 'P1', الاسم: 'Test' };
      expect(getPersonSeedFromPerson(p)).toBe('P1');
    });

    it('getPersonColorClasses: should return color classes bundle', () => {
      const classes = getPersonColorClasses('P1');
      expect(classes.stripe).toBeDefined();
      expect(classes.dot).toBeDefined();
    });
  });

  describe('DateOnly Utils', () => {
    it('toDateOnlyISO: should handle various inputs', () => {
      expect(toDateOnlyISO(new Date('2024-05-20'))).toBe('2024-05-20');
      expect(toDateOnlyISO('2024-05-20T10:00:00Z')).toBe('2024-05-20');
      expect(toDateOnlyISO(null)).toBeNull();
    });

    it('todayDateOnlyISO: should return current date in ISO', () => {
      const today = todayDateOnlyISO();
      expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('daysBetweenDateOnlySafe: should calculate distance', () => {
      expect(daysBetweenDateOnlySafe('2024-05-01', '2024-05-10')).toBe(9);
    });

    it('compareDateOnlySafe: should return negative/zero/positive', () => {
      expect(compareDateOnlySafe('2024-05-01', '2024-05-10')).toBeLessThan(0);
      expect(compareDateOnlySafe('2024-05-10', '2024-05-10')).toBe(0);
    });
  });

  describe('ExternalLink Utils (Sanity)', () => {
    it('openExternalUrl: should return null/window for invalid/mocked urls', () => {
      // Since window.location is mocked in setup.js, this simple check exercises the logic branches
      expect(openExternalUrl('')).toBeNull();
      expect(openExternalUrl('invalid-url')).toBeNull();
    });
  });

});
