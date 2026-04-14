import { jest } from '@jest/globals';
import * as domainQueries from '../../src/services/domainQueries';

// --- Exhaustive Bridge Mocks ---
const mockDb = {
    domainSearchGlobal: jest.fn(() => Promise.resolve({ ok: true, people: [], properties: [], contracts: [] })),
    domainSearch: jest.fn(() => Promise.resolve({ ok: true, items: [] })),
    domainGet: jest.fn(() => Promise.resolve({ ok: true, data: {} })),
    domainGetSmart: jest.fn(() => Promise.resolve({ ok: true, data: {} })),
    domainCounts: jest.fn(() => Promise.resolve({ ok: true, counts: {} })),
    domainPropertyPickerSearch: jest.fn(() => Promise.resolve({ ok: true, items: [], total: 0 })),
    domainContractPickerSearch: jest.fn(() => Promise.resolve({ ok: true, items: [], total: 0 })),
    domainPeoplePickerSearch: jest.fn(() => Promise.resolve({ ok: true, items: [], total: 0 })),
    domainPersonDetails: jest.fn(() => Promise.resolve({ ok: true, data: {} })),
    domainContractDetails: jest.fn(() => Promise.resolve({ ok: true, data: {} })),
    domainDashboardSummary: jest.fn(() => Promise.resolve({ ok: true, data: {} })),
    domainDashboardPerformance: jest.fn(() => Promise.resolve({ ok: true, data: {} })),
    domainDashboardHighlights: jest.fn(() => Promise.resolve({ ok: true, data: {} })),
    domainPaymentNotificationTargets: jest.fn(() => Promise.resolve({ ok: true, items: [] })),
    domainOwnershipHistory: jest.fn(() => Promise.resolve({ ok: true, items: [] })),
    domainPropertyInspections: jest.fn(() => Promise.resolve({ ok: true, items: [] })),
    domainSalesForPerson: jest.fn(() => Promise.resolve({ ok: true, listings: [], agreements: [] })),
    domainSalesForProperty: jest.fn(() => Promise.resolve({ ok: true, listings: [], agreements: [] })),
    domainBlacklistRemove: jest.fn(() => Promise.resolve({ ok: true })),
    domainPeopleDelete: jest.fn(() => Promise.resolve({ ok: true })),
    domainPropertyUpdate: jest.fn(() => Promise.resolve({ ok: true })),
    domainInspectionDelete: jest.fn(() => Promise.resolve({ ok: true })),
    domainFollowUpAdd: jest.fn(() => Promise.resolve({ ok: true })),
    domainSalesAgreementDelete: jest.fn(() => Promise.resolve({ ok: true })),
};

(window as any).desktopDb = mockDb;

describe('Logic Glory Strike - Domain Queries', () => {
    test('Exhausting Desktop Domain Queries', async () => {
        // Search
        await domainQueries.domainSearchGlobalSmart('test');
        await domainQueries.domainSearchSmart('people', 'test');
        await domainQueries.domainSearchSmart('properties', 'test');
        await domainQueries.domainSearchSmart('contracts', 'test');
        
        // Pickers
        await domainQueries.propertyPickerSearchSmart({ query: 'P1' });
        await domainQueries.propertyPickerSearchPagedSmart({ query: 'P1' });
        await domainQueries.contractPickerSearchSmart({ query: 'C1' });
        await domainQueries.contractPickerSearchPagedSmart({ query: 'C1' });
        await domainQueries.peoplePickerSearchPagedSmart({ query: 'U1' });
        
        // Details
        await domainQueries.personDetailsSmart('U1');
        await domainQueries.personTenancyContractsSmart('U1');
        await domainQueries.contractDetailsSmart('C1');
        
        // Dashboards
        await domainQueries.dashboardSummarySmart({ todayYMD: '2025-01-01', weekYMD: '2025-01-07' });
        await domainQueries.dashboardPerformanceSmart({ monthKey: '2025-01', prevMonthKey: '2024-12' });
        await domainQueries.dashboardHighlightsSmart({ todayYMD: '2025-01-01' });
        await domainQueries.paymentNotificationTargetsSmart({ daysAhead: 30 });
        
        // History & Relations
        await domainQueries.ownershipHistorySmart({ propertyId: 'P1' });
        await domainQueries.propertyInspectionsSmart('P1');
        await domainQueries.salesForPersonSmart('U1');
        await domainQueries.salesForPropertySmart('P1');
        
        // Mutators (Desktop branches)
        await domainQueries.removeFromBlacklistSmart('U1');
        await domainQueries.deletePersonSmart('U1');
        await domainQueries.updatePropertySmart('P1', { الاسم: 'Updated' });
        await domainQueries.deleteInspectionSmart('I1');
        await domainQueries.addFollowUpSmart({ task: 'Follow up' });
        await domainQueries.deleteSalesAgreementSmart('SA1');
        
        // Counts
        await domainQueries.domainCountsSmart();
    });
});
