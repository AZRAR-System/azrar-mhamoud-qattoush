import { getOwnerReport } from '../../src/services/ownerReport';
import { getPersonById } from '../../src/services/db/people';
import { getProperties } from '../../src/services/db/properties';
import { getContracts } from '../../src/services/db/contracts';
import { getInstallments } from '../../src/services/db/installments';
import { getCommissions } from '../../src/services/db/financial';
import { INSTALLMENT_STATUS } from '../../src/services/db/installmentConstants';

jest.mock('../../src/services/db/people');
jest.mock('../../src/services/db/properties');
jest.mock('../../src/services/db/contracts');
jest.mock('../../src/services/db/installments');
jest.mock('../../src/services/db/financial');
jest.mock('../../src/services/db/settings', () => ({
  getSettings: jest.fn(() => ({ rentalCommissionOwnerPercent: 5 }))
}));

describe('Owner Report Logic - Comprehensive Suite', () => {
  const mockOwner = { رقم_الشخص: 'O1', الاسم: 'Owner Name' };
  
  beforeEach(() => {
    jest.clearAllMocks();
    (getPersonById as jest.Mock).mockReturnValue(mockOwner);
  });

  // 1. Multiple Properties Report
  test('getOwnerReport - aggregates data across multiple properties', () => {
    (getProperties as jest.Mock).mockReturnValue([
      { رقم_العقار: 'P1', رقم_المالك: 'O1' },
      { رقم_العقار: 'P2', رقم_المالك: 'O1' }
    ]);
    (getContracts as jest.Mock).mockReturnValue([
      { رقم_العقد: 'C1', رقم_العقار: 'P1', رقم_المستاجر: 'T1', حالة_العقد: 'نشط' },
      { رقم_العقد: 'C2', رقم_العقار: 'P2', رقم_المستاجر: 'T2', حالة_العقد: 'نشط' }
    ]);
    (getInstallments as jest.Mock).mockReturnValue([
      { رقم_العقد: 'C1', القيمة: 1000, حالة_الكمبيالة: INSTALLMENT_STATUS.PAID, تاريخ_استحقاق: '2025-01-01' },
      { رقم_العقد: 'C2', القيمة: 500, حالة_الكمبيالة: INSTALLMENT_STATUS.PAID, تاريخ_استحقاق: '2025-01-01' }
    ]);
    (getCommissions as jest.Mock).mockReturnValue([]);

    const report = getOwnerReport('O1');
    expect(report?.totalCollected).toBe(1500);
    expect(report?.properties).toHaveLength(2);
    expect(report?.activeContracts).toHaveLength(2);
  });

  // 2. Net Income Calculation
  test('getOwnerReport - deducts commissions from net owner amount', () => {
    (getProperties as jest.Mock).mockReturnValue([{ رقم_العقار: 'P1', رقم_المالك: 'O1' }]);
    (getContracts as jest.Mock).mockReturnValue([{ رقم_العقد: 'C1', رقم_العقار: 'P1', حالة_العقد: 'نشط' }]);
    (getInstallments as jest.Mock).mockReturnValue([
      { رقم_العقد: 'C1', القيمة: 1000, حالة_الكمبيالة: INSTALLMENT_STATUS.PAID, تاريخ_استحقاق: '2025-01-01' }
    ]);
    // Commission is 50 (5% of 1000)
    (getCommissions as jest.Mock).mockReturnValue([]);

    const report = getOwnerReport('O1');
    expect(report?.totalCommissions).toBe(50);
    expect(report?.netOwnerAmount).toBe(950);
  });

  // 3. Actual Commission Override
  test('getOwnerReport - uses actual commission record if exists instead of percent', () => {
    (getProperties as jest.Mock).mockReturnValue([{ رقم_العقار: 'P1', رقم_المالك: 'O1' }]);
    (getContracts as jest.Mock).mockReturnValue([{ رقم_العقد: 'C1', رقم_العقار: 'P1', حالة_العقد: 'نشط' }]);
    (getInstallments as jest.Mock).mockReturnValue([
      { رقم_العقد: 'C1', القيمة: 1000, حالة_الكمبيالة: INSTALLMENT_STATUS.PAID, تاريخ_استحقاق: '2025-01-01' }
    ]);
    (getCommissions as jest.Mock).mockReturnValue([{ رقم_العقد: 'C1', عمولة_المالك: 75 }]);

    const report = getOwnerReport('O1');
    expect(report?.totalCommissions).toBe(75);
    expect(report?.netOwnerAmount).toBe(925);
  });

  // 4. Occupancy Rate
  test('getOwnerReport - calculates occupancy rate correctly', () => {
    (getProperties as jest.Mock).mockReturnValue([
      { رقم_العقار: 'P1', رقم_المالك: 'O1' },
      { رقم_العقار: 'P2', رقم_المالك: 'O1' } // Vacant
    ]);
    (getContracts as jest.Mock).mockReturnValue([{ رقم_العقد: 'C1', رقم_العقار: 'P1', حالة_العقد: 'نشط' }]);
    (getInstallments as jest.Mock).mockReturnValue([]);
    (getCommissions as jest.Mock).mockReturnValue([]);

    const report = getOwnerReport('O1');
    expect(report?.occupancyRate).toBe(50);
  });

  // 5. Collection Efficiency
  test('getOwnerReport - calculates collection efficiency based on paid vs expected', () => {
    (getProperties as jest.Mock).mockReturnValue([{ رقم_العقار: 'P1', رقم_المالك: 'O1' }]);
    (getContracts as jest.Mock).mockReturnValue([{ رقم_العقد: 'C1', رقم_العقار: 'P1', حالة_العقد: 'نشط' }]);
    (getInstallments as jest.Mock).mockReturnValue([
      { رقم_العقد: 'C1', القيمة: 1000, حالة_الكمبيالة: INSTALLMENT_STATUS.PAID },
      { رقم_العقد: 'C1', القيمة: 1000, حالة_الكمبيالة: INSTALLMENT_STATUS.UNPAID }
    ]);
    (getCommissions as jest.Mock).mockReturnValue([]);

    const report = getOwnerReport('O1');
    expect(report?.collectionEfficiency).toBe(50);
    expect(report?.totalExpected).toBe(2000);
  });

  // 6. Filtering by Contract
  test('getOwnerReport - filters report by specific contract if provided', () => {
    (getProperties as jest.Mock).mockReturnValue([{ رقم_العقار: 'P1', رقم_المالك: 'O1' }]);
    (getContracts as jest.Mock).mockReturnValue([
      { رقم_العقد: 'C1', رقم_العقار: 'P1' },
      { رقم_العقد: 'C2', رقم_العقار: 'P1' }
    ]);
    (getInstallments as jest.Mock).mockReturnValue([
      { رقم_العقد: 'C1', القيمة: 1000, حالة_الكمبيالة: INSTALLMENT_STATUS.PAID },
      { رقم_العقد: 'C2', القيمة: 500, حالة_الكمبيالة: INSTALLMENT_STATUS.PAID }
    ]);

    const report = getOwnerReport('O1', 'C1');
    expect(report?.totalCollected).toBe(1000);
  });

  // 7. No Properties Case
  test('getOwnerReport - handles owner with no properties', () => {
    (getProperties as jest.Mock).mockReturnValue([]);
    (getContracts as jest.Mock).mockReturnValue([]);

    const report = getOwnerReport('O1');
    expect(report?.properties).toHaveLength(0);
    expect(report?.occupancyRate).toBe(0);
  });

  // 8. Error - Non-Existent Owner
  test('getOwnerReport - returns null if owner not found', () => {
    (getPersonById as jest.Mock).mockReturnValue(null);
    expect(getOwnerReport('X')).toBeNull();
  });
});
