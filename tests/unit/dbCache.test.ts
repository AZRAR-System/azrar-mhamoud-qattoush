import { jest } from '@jest/globals';
import { buildCache, DbCache } from '@/services/dbCache';
import { save } from '@/services/db/kv';
import { KEYS } from '@/services/db/keys';

describe('Database Cache Service - Semantic Fix', () => {
  beforeEach(() => {
    localStorage.clear();
    save('db_properties', [
      { رقم_العقار: 'PR1', IsRented: true },
      { رقم_العقار: 'PR2', IsRented: false }
    ]);
    save('db_contracts', [
      { رقم_العقد: 'C1', حالة_العقد: 'نشط' }
    ]);
    save('db_installments', [
      { رقم_الكمبيالة: 'I1', رقم_العقد: 'C1', القيمة: 1000, حالة_الكمبيالة: 'غير مدفوع' }
    ]);
  });

  it('buildCache: should correctly aggregate dashboard statistics using real field names', () => {
    buildCache();

    // Mapping based on DashboardStats interface
    expect(DbCache.dashboardStats.occupiedProps).toBe(1);
    expect(DbCache.dashboardStats.vacantProps).toBe(1);
    expect(DbCache.dashboardStats.totalDue).toBe(1000);
  });

  it('buildCache: should handle empty database gracefully', () => {
    localStorage.clear();
    buildCache();
    expect(DbCache.dashboardStats.occupiedProps).toBe(0);
  });
});
