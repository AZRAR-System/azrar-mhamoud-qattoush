import { getOwnerReport, buildOwnerReportHtml, exportOwnerReportPdf } from '@/services/ownerReport';
import * as peopleDb from '@/services/db/people';
import * as propertiesDb from '@/services/db/properties';
import * as contractsDb from '@/services/db/contracts';
import * as installmentsDb from '@/services/db/installments';
import * as financialDb from '@/services/db/financial';
import * as settingsDb from '@/services/db/settings';

jest.mock('@/services/db/people');
jest.mock('@/services/db/properties');
jest.mock('@/services/db/contracts');
jest.mock('@/services/db/installments');
jest.mock('@/services/db/financial');
jest.mock('@/services/db/settings');

describe('Owner Report Service', () => {
  const mockOwner = { رقم_الشخص: 'O1', الاسم: 'Owner One', الدور: 'Owner' };
  const mockTenant = { رقم_الشخص: 'T1', الاسم: 'Tenant One', الدور: 'Tenant' };
  const mockProperty = { رقم_العقار: 'PR1', رقم_المالك: 'O1', الكود_الداخلي: 'HOUSE-1' };
  const mockContract = { 
    رقم_العقد: 'C1', 
    رقم_العقار: 'PR1', 
    رقم_المستاجر: 'T1', 
    حالة_العقد: 'نشط',
    isArchived: false 
  };
  const mockInstallment = { 
    رقم_العقد: 'C1', 
    القيمة: 1000, 
    حالة_الكمبيالة: 'مدفوع',
    تاريخ_استحقاق: '2025-01-01'
  };
  const mockCommission = { 
    رقم_العمولة: 'COM1', 
    رقم_العقد: 'C1', 
    عمولة_المالك: 150, 
    المجموع: 300,
    اسم_المستخدم: 'admin'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (settingsDb.getSettings as jest.Mock).mockReturnValue({});
    (peopleDb.getPersonById as jest.Mock).mockImplementation((id) => {
      if (id === 'O1') return mockOwner;
      if (id === 'T1') return mockTenant;
      return null;
    });
    (propertiesDb.getProperties as jest.Mock).mockReturnValue([mockProperty]);
    (contractsDb.getContracts as jest.Mock).mockReturnValue([mockContract]);
    (installmentsDb.getInstallments as jest.Mock).mockReturnValue([{ ...mockInstallment }]);
    (financialDb.getCommissions as jest.Mock).mockReturnValue([]);
    (window as any).desktopPrinting = {
      savePdfToPath: jest.fn().mockResolvedValue({ ok: true, savedPath: 'path/to/report.pdf' })
    };
  });

  test('returns null for non-existent owner', () => {
    expect(getOwnerReport('O999')).toBeNull();
  });

  test('generates basic report for owner', () => {
    const report = getOwnerReport('O1');
    expect(report).not.toBeNull();
    expect(report?.owner.الاسم).toBe('Owner One');
    expect(report?.properties).toHaveLength(1);
    expect(report?.activeContracts).toHaveLength(1);
    expect(report?.activeContracts[0].tenantName).toBe('Tenant One');
  });

  test('filters by contractId', () => {
    const report = getOwnerReport('O1', 'C1');
    expect(report?.activeContracts).toHaveLength(1);
    
    const report2 = getOwnerReport('O1', 'C999');
    expect(report2?.activeContracts).toHaveLength(0);
  });

  test('handles missing tenant or property data', () => {
    (peopleDb.getPersonById as jest.Mock).mockImplementation((id) => (id === 'O1' ? mockOwner : null));
    (propertiesDb.getProperties as jest.Mock).mockReturnValue([]);
    
    const report = getOwnerReport('O1');
    expect(report?.activeContracts[0]?.tenantName).toBeUndefined(); // filter might remove it
  });

  test('calculates collections and commissions', () => {
    (installmentsDb.getInstallments as jest.Mock).mockReturnValue([
      { ...mockInstallment, حالة_الكمبيالة: 'مدفوع', القيمة: 1000 },
      { ...mockInstallment, حالة_الكمبيالة: 'غير مدفوع', القيمة: 500, تاريخ_استحقاق: '2025-02-01' }
    ]);
    
    const report = getOwnerReport('O1');
    expect(report?.totalCollected).toBe(1000);
    expect(report?.pendingAmount).toBe(500);
  });

  test('uses actual commission record if available', () => {
    (financialDb.getCommissions as jest.Mock).mockReturnValue([mockCommission]);
    const report = getOwnerReport('O1');
    expect(report?.installments[0].commission).toBe(150);
  });

  test('buildOwnerReportHtml returns a string with data', () => {
    const report = getOwnerReport('O1')!;
    const html = buildOwnerReportHtml(report);
    expect(html).toContain('Owner One');
    expect(html).toContain('AZRAR System');
  });

  test('exportOwnerReportPdf calls desktop bridge', async () => {
    const path = await exportOwnerReportPdf('O1');
    expect(path).toBe('path/to/report.pdf');
    expect((window as any).desktopPrinting.savePdfToPath).toHaveBeenCalled();
  });

  test('exportOwnerReportPdf handles failures', async () => {
    (window as any).desktopPrinting.savePdfToPath.mockResolvedValue({ ok: false });
    const path = await exportOwnerReportPdf('O1');
    expect(path).toBeNull();
    
    (window as any).desktopPrinting.savePdfToPath.mockRejectedValue(new Error('PDF error'));
    const path2 = await exportOwnerReportPdf('O1');
    expect(path2).toBeNull();
    
    (peopleDb.getPersonById as jest.Mock).mockReturnValue(null);
    const path3 = await exportOwnerReportPdf('O999');
    expect(path3).toBeNull();
  });
});
