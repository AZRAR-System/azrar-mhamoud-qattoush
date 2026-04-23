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
  getSettings: () => ({ rentalCommissionOwnerPercent: 5 })
}));

describe('Owner Report Real Logic Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('calculates net amount after commission from first installment only', () => {
    (getPersonById as jest.Mock).mockReturnValue({ رقم_الشخص: 'OWN-1', الاسم: 'Owner A' });
    (getProperties as jest.Mock).mockReturnValue([{ رقم_العقار: 'PROP-1', رقم_المالك: 'OWN-1', الكود_الداخلي: 'P1' }]);
    (getContracts as jest.Mock).mockReturnValue([{ رقم_العقد: 'COT-1', رقم_العقار: 'PROP-1', رقم_المستاجر: 'T1', حالة_العقد: 'نشط' }]);
    (getInstallments as jest.Mock).mockReturnValue([
      { رقم_الكمبيالة: 'I1', رقم_العقد: 'COT-1', القيمة: 1000, تاريخ_استحقاق: '2026-01-01', حالة_الكمبيالة: INSTALLMENT_STATUS.PAID },
      { رقم_الكمبيالة: 'I2', رقم_العقد: 'COT-1', القيمة: 1000, تاريخ_استحقاق: '2026-02-01', حالة_الكمبيالة: INSTALLMENT_STATUS.PAID }
    ]);
    (getCommissions as jest.Mock).mockReturnValue([{ رقم_العقد: 'COT-1', عمولة_المالك: 100 }]);

    const report = getOwnerReport('OWN-1');

    expect(report).not.toBeNull();
    // 1st installment: 1000 - 100 commission = 900 net
    // 2nd installment: 1000 - 0 commission = 1000 net
    // Total Collected: 2000
    // Total Commissions: 100
    // Net Owner Amount: 1900
    expect(report?.totalCollected).toBe(2000);
    expect(report?.totalCommissions).toBe(100);
    expect(report?.netOwnerAmount).toBe(1900);
    
    expect(report?.installments[1].net).toBe(900); // Sorted descending by date in report? 
    // Actually report sorts installments by date descending at the end.
    // '2026-02-01' is first in desc. So installments[0] is I2, installments[1] is I1.
    // I1 is the first chronological payment (index 0 in loop).
    const inst1 = report?.installments.find(i => i.رقم_الكمبيالة === 'I1');
    const inst2 = report?.installments.find(i => i.رقم_الكمبيالة === 'I2');
    expect(inst1?.commission).toBe(100);
    expect(inst2?.commission).toBe(0);
  });

  test('efficiency and occupancy calculations', () => {
    (getPersonById as jest.Mock).mockReturnValue({ رقم_الشخص: 'O1' });
    (getProperties as jest.Mock).mockReturnValue([
      { رقم_العقار: 'P1', رقم_المالك: 'O1' },
      { رقم_العقار: 'P2', رقم_المالك: 'O1' }
    ]);
    (getContracts as jest.Mock).mockReturnValue([
      { رقم_العقد: 'C1', رقم_العقار: 'P1', حالة_العقد: 'نشط', isArchived: false }
    ]);
    (getInstallments as jest.Mock).mockReturnValue([
      { رقم_العقد: 'C1', القيمة: 1000, حالة_الكمبيالة: INSTALLMENT_STATUS.PAID },
      { رقم_العقد: 'C1', القيمة: 1000, حالة_الكمبيالة: INSTALLMENT_STATUS.UNPAID }
    ]);
    (getCommissions as jest.Mock).mockReturnValue([]);

    const report = getOwnerReport('O1');

    expect(report?.occupancyRate).toBe(50); // 1 out of 2 properties rented
    expect(report?.collectionEfficiency).toBe(50); // 1000 collected out of 2000 expected
  });
});
