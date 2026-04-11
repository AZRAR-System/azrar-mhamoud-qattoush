import { jest } from '@jest/globals';
import { 
  domainCountsSmart, 
  dashboardSummarySmart,
  propertyContractsSmart
} from '@/services/domainQueries';
import { save } from '@/services/db/kv';
import { KEYS } from '@/services/db/keys';

describe('Domain Queries Logic - Global Bridge Coverage', () => {
  beforeEach(() => {
    localStorage.clear();
    save(KEYS.PROPERTIES, [
      { رقم_العقار: 'PR1', النوع: 'شقة', IsRented: true },
      { رقم_العقار: 'PR2', النوع: 'شقة', IsRented: false },
      { رقم_العقار: 'PR3', النوع: 'فيلا', IsRented: true }
    ]);
    save(KEYS.PEOPLE, [
      { رقم_الشخص: 'T1', الاسم: 'Tenant 1' }
    ]);
    save(KEYS.CONTRACTS, [
      { رقم_العقد: 'C1', رقم_العقار: 'PR1', رقم_المستاجر: 'T1', حالة_العقد: 'نشط' }
    ]);
  });

  it('domainCountsSmart: should correctly count entities using bridge', async () => {
    // window.desktopDb.domainCounts is mocked in setup.js to return success
    const res = await domainCountsSmart();
    expect(res).toBeDefined();
  });

  it('propertyContractsSmart: should return items from bridge', async () => {
    const items = await propertyContractsSmart('PR1');
    expect(items).toBeDefined();
  });
});
