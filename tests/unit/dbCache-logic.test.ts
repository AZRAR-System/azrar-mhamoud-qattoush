import { DbCache, buildCache } from '../../src/services/dbCache';

describe('DbCache Real Logic Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    // Reset cache state manually if needed, or rely on buildCache
  });

  test('buildCache aggregates dashboard statistics correctly', () => {
    // Mock localStorage data
    localStorage.setItem('db_properties', JSON.stringify([
      { رقم_العقار: 'P1', حالة_العقار: 'مؤجر', IsRented: true },
      { رقم_العقار: 'P2', حالة_العقار: 'شاغر', IsRented: false }
    ]));
    
    localStorage.setItem('db_contracts', JSON.stringify([
      { رقم_العقد: 'C1', حالة_العقد: 'نشط', isArchived: false, تاريخ_البداية: '2020-01-01', تاريخ_النهاية: '2030-01-01' }
    ]));

    localStorage.setItem('db_installments', JSON.stringify([
      { رقم_الكمبيالة: 'I1', رقم_العقد: 'C1', القيمة: 1000, حالة_الكمبيالة: 'مدفوع' },
      { رقم_الكمبيالة: 'I2', رقم_العقد: 'C1', القيمة: 1000, حالة_الكمبيالة: 'غير مدفوع', تاريخ_استحقاق: '2026-01-01' }
    ]));

    buildCache();

    expect(DbCache.dashboardStats.activeContracts).toBe(1);
    expect(DbCache.dashboardStats.occupiedProps).toBe(1);
    expect(DbCache.dashboardStats.vacantProps).toBe(1);
    expect(DbCache.dashboardStats.totalCollected).toBe(1000);
    expect(DbCache.dashboardStats.totalDue).toBe(1000);
  });

  test('indexing by foreign keys works', () => {
    localStorage.setItem('db_properties', JSON.stringify([
      { رقم_العقار: 'P1', رقم_المالك: 'OWNER-1' },
      { رقم_العقار: 'P2', رقم_المالك: 'OWNER-1' }
    ]));

    buildCache();

    const ownerProps = DbCache.propertiesByOwnerId.get('OWNER-1');
    expect(ownerProps).toHaveLength(2);
    expect(ownerProps?.[0].رقم_العقار).toBe('P1');
  });

  test('debtor list identifies top 5 debtors correctly', () => {
    localStorage.setItem('db_people', JSON.stringify([
      { رقم_الشخص: 'T1', الاسم: 'Tenant A' },
      { رقم_الشخص: 'T2', الاسم: 'Tenant B' }
    ]));
    
    localStorage.setItem('db_contracts', JSON.stringify([
      { رقم_العقد: 'C1', رقم_المستاجر: 'T1', حالة_العقد: 'نشط' },
      { رقم_العقد: 'C2', رقم_المستاجر: 'T2', حالة_العقد: 'نشط' }
    ]));

    localStorage.setItem('db_installments', JSON.stringify([
      { رقم_الكمبيالة: 'I1', رقم_العقد: 'C1', القيمة: 5000, حالة_الكمبيالة: 'غير مدفوع', تاريخ_استحقاق: '2020-01-01' },
      { رقم_الكمبيالة: 'I2', رقم_العقد: 'C2', القيمة: 3000, حالة_الكمبيالة: 'غير مدفوع', تاريخ_استحقاق: '2020-01-01' }
    ]));

    buildCache();

    expect(DbCache.dashboardStats.topDebtors).toHaveLength(2);
    expect(DbCache.dashboardStats.topDebtors[0].name).toBe('Tenant A');
    expect(DbCache.dashboardStats.topDebtors[0].amount).toBe(5000);
  });
});
