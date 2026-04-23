import { 
  getTenancyStatusScore, 
  isTenancyRelevant, 
  isBetterTenancyContract, 
  pickBestTenancyContract 
} from '../../src/utils/tenancy';

describe('Tenancy Logic - Comprehensive Suite', () => {
  
  // 1. Status Scoring
  test('getTenancyStatusScore - returns highest for active variants', () => {
    expect(getTenancyStatusScore('نشط')).toBe(3);
    expect(getTenancyStatusScore('ساري')).toBe(3);
    expect(getTenancyStatusScore('Active')).toBe(3);
  });

  // 2. Status Scoring - Near Expiry
  test('getTenancyStatusScore - returns medium for near expiry', () => {
    expect(getTenancyStatusScore('قريب الانتهاء')).toBe(2);
  });

  // 3. Relevance Check
  test('isTenancyRelevant - returns false for archived contracts', () => {
    const c = { حالة_العقد: 'نشط', isArchived: true };
    expect(isTenancyRelevant(c)).toBe(false);
  });

  // 4. Relevance Check - Success
  test('isTenancyRelevant - returns true for active non-archived', () => {
    const c = { حالة_العقد: 'نشط', isArchived: false };
    expect(isTenancyRelevant(c)).toBe(true);
  });

  // 5. Comparison Logic - Score Priority
  test('isBetterTenancyContract - prefers higher score over dates', () => {
    const better = { رقم_العقد: 'C1', حالة_العقد: 'نشط', تاريخ_البداية: '2020-01-01' };
    const worse = { رقم_العقد: 'C2', حالة_العقد: 'مجدد', تاريخ_البداية: '2025-01-01' };
    expect(isBetterTenancyContract(better as any, worse as any)).toBe(true);
  });

  // 6. Comparison Logic - Date Priority
  test('isBetterTenancyContract - prefers later start date if scores are equal', () => {
    const better = { رقم_العقد: 'C1', حالة_العقد: 'نشط', تاريخ_البداية: '2026-01-01' };
    const worse = { رقم_العقد: 'C2', حالة_العقد: 'نشط', تاريخ_البداية: '2025-01-01' };
    expect(isBetterTenancyContract(better as any, worse as any)).toBe(true);
  });

  // 7. Pick Best - Selection from Array
  test('pickBestTenancyContract - selects the single best from list', () => {
    const contracts = [
      { رقم_العقد: 'C1', حالة_العقد: 'منتهي', isArchived: false },
      { رقم_العقد: 'C2', حالة_العقد: 'مجدد', isArchived: false },
      { رقم_العقد: 'C3', حالة_العقد: 'نشط', isArchived: false },
      { رقم_العقد: 'C4', حالة_العقد: 'نشط', isArchived: true }
    ];
    const best = pickBestTenancyContract(contracts as any);
    expect(best?.رقم_العقد).toBe('C3');
  });

  // 8. Pick Best - Empty/Invalid Input
  test('pickBestTenancyContract - returns undefined for empty or irrelevant list', () => {
    const contracts = [
      { رقم_العقد: 'C1', حالة_العقد: 'منتهي', isArchived: false },
      { رقم_العقد: 'C4', حالة_العقد: 'نشط', isArchived: true }
    ];
    expect(pickBestTenancyContract(contracts as any)).toBeUndefined();
    expect(pickBestTenancyContract([])).toBeUndefined();
  });
});
