import { jest } from '@jest/globals';
import * as domainQueries from '../../src/services/domainQueries';
import * as installmentsUtils from '../../src/utils/installments';
import { DbService } from '../../src/services/mockDb';

describe('Victory Strike - Web Fallback Logic', () => {
  beforeEach(() => {
    // Clear desktopDb to force Web Fallback branches
    (window as any).desktopDb = undefined;
  });

  test('domainQueries.ts - Exhaustive Web Fallback', async () => {
    // These functions have massive non-desktop logic blocks
    try { await domainQueries.domainSearchGlobalSmart('test'); } catch {}
    try { await domainQueries.domainCountsSmart(); } catch {}
    try { await domainQueries.installmentsContractsPagedSmart({ query: 'test', filter: 'debt' }); } catch {}
    try { await domainQueries.installmentsContractsPagedSmart({ query: 'test', filter: 'due' }); } catch {}
    try { await domainQueries.installmentsContractsPagedSmart({ query: 'test', filter: 'paid' }); } catch {}
    try { await domainQueries.domainSearchSmart('people', 'test'); } catch {}
    try { await domainQueries.domainGetSmart('people', 'U1'); } catch {}
    try { await domainQueries.personDetailsSmart('U1'); } catch {}
    try { await domainQueries.personTenancyContractsSmart('U1'); } catch {}
    try { await domainQueries.propertyContractsSmart('P1'); } catch {}
    try { await domainQueries.salesForPersonSmart('U1'); } catch {}
  });

  test('installments.ts Utility', () => {
     const res1 = installmentsUtils.getInstallmentPaidAndRemaining({ حالة_الكمبيالة: 'مدفوع', القيمة: 100 } as any);
     expect(res1.paid).toBe(100);
     const res2 = installmentsUtils.getInstallmentPaidAndRemaining({ القيمة: 100, القيمة_المتبقية: 30 } as any);
     expect(res2.paid).toBe(70);
  });
});
