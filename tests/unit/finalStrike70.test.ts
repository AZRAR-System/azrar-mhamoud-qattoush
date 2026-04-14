import { jest } from '@jest/globals';
import { 
    domainSearchGlobalSmart, 
    domainSearchSmart, 
    propertyPickerSearchSmart,
    propertyPickerSearchPagedSmart,
    contractPickerSearchSmart,
    contractPickerSearchPagedSmart,
    domainCountsSmart,
    dashboardSummarySmart,
    dashboardPerformanceSmart,
    dashboardHighlightsSmart,
    paymentNotificationTargetsSmart,
    personDetailsSmart,
    personTenancyContractsSmart,
    contractDetailsSmart,
    ownershipHistorySmart,
    propertyInspectionsSmart,
    salesForPersonSmart,
    salesForPropertySmart
} from '../../src/services/domainQueries';

import { 
    generateContractInstallmentsInternal,
    getInstallmentPaidAndRemaining,
    getInstallmentPaymentSummary,
    createInstallmentPaymentHandlers,
    getInstallments
} from '../../src/services/db/installments';

import { INSTALLMENT_STATUS } from '../../src/services/db/installmentConstants';

describe('Final Strike - domainQueries.ts', () => {
    beforeAll(() => {
        (window as any).desktopDb = {
            domainSearchGlobal: jest.fn().mockResolvedValue({ 
                ok: true, 
                people: [{ رقم_الشخص: 'P1', الاسم: 'P1' }], 
                properties: [{ رقم_العقار: 'PR1', الكود_الداخلي: 'PR1' }],
                contracts: [{ رقم_العقد: 'C1', تاريخ_البداية: '2025-01-01' }]
            }),
            domainSearch: jest.fn().mockResolvedValue({ ok: true, items: [{ id: '1' }] }),
            domainPropertyPickerSearch: jest.fn().mockResolvedValue({ ok: true, items: [{ property: {} }], total: 1 }),
            domainContractPickerSearch: jest.fn().mockResolvedValue({ ok: true, items: [{ contract: {} }], total: 1 }),
            domainCounts: jest.fn().mockResolvedValue({ ok: true, counts: { people: 10, properties: 5, contracts: 3 } }),
            domainDashboardSummary: jest.fn().mockResolvedValue({ ok: true, data: { totalPeople: 10 } }),
            domainDashboardPerformance: jest.fn().mockResolvedValue({ ok: true, data: { currentMonthCollections: 1000 } }),
            domainDashboardHighlights: jest.fn().mockResolvedValue({ ok: true, data: { dueInstallmentsToday: [] } }),
            domainPaymentNotificationTargets: jest.fn().mockResolvedValue({ ok: true, items: [] }),
            domainPersonDetails: jest.fn().mockResolvedValue({ ok: true, data: { person: {} } }),
            domainPersonTenancyContracts: jest.fn().mockResolvedValue({ ok: true, items: [] }),
            domainContractDetails: jest.fn().mockResolvedValue({ ok: true, data: { contract: {} } }),
            domainOwnershipHistory: jest.fn().mockResolvedValue({ ok: true, items: [] }),
            domainPropertyInspections: jest.fn().mockResolvedValue({ ok: true, items: [] }),
            domainSalesForPerson: jest.fn().mockResolvedValue({ ok: true, listings: [], agreements: [] }),
            domainSalesForProperty: jest.fn().mockResolvedValue({ ok: true, listings: [], agreements: [] }),
            domainMigrate: jest.fn().mockResolvedValue({ ok: true })
        };
    });

    test('Desktop Logic - All Queries', async () => {
        await domainSearchGlobalSmart('test');
        await domainSearchSmart('people', 'test');
        await propertyPickerSearchSmart({ query: 'test' });
        await propertyPickerSearchPagedSmart({ query: 'test' });
        await contractPickerSearchSmart({ query: 'test' });
        await contractPickerSearchPagedSmart({ query: 'test' });
        await domainCountsSmart();
        await dashboardSummarySmart({ todayYMD: '2025-01-01', weekYMD: '2025-01-01' });
        await dashboardPerformanceSmart({ monthKey: '2025-01', prevMonthKey: '2024-12' });
        await dashboardHighlightsSmart({ todayYMD: '2025-01-01' });
        await paymentNotificationTargetsSmart({ daysAhead: 7 });
        await personDetailsSmart('P1');
        await personTenancyContractsSmart('P1');
        await contractDetailsSmart('C1');
        await ownershipHistorySmart({ personId: 'P1' });
        await propertyInspectionsSmart('PR1');
        await salesForPersonSmart('P1');
        await salesForPropertySmart('PR1');
    });

    test('Web Fallback Logic', async () => {
        const originalDb = (window as any).desktopDb;
        delete (window as any).desktopDb;
        
        await domainSearchGlobalSmart('test');
        await domainSearchSmart('people', 'test');
        await domainSearchSmart('properties', 'test');
        await domainSearchSmart('contracts' as any, 'test');
        await propertyPickerSearchSmart({ query: 'test' });
        await propertyPickerSearchPagedSmart({ query: 'test' });
        await contractPickerSearchSmart({ query: 'test' });
        await contractPickerSearchPagedSmart({ query: 'test' });
        await domainCountsSmart();
        await dashboardSummarySmart({ todayYMD: '2025-01-01', weekYMD: '2025-01-01' });
        await dashboardPerformanceSmart({ monthKey: '2025-01', prevMonthKey: '2024-12' });
        await dashboardHighlightsSmart({ todayYMD: '2025-01-01' });
        await paymentNotificationTargetsSmart({ daysAhead: 7 });
        await personDetailsSmart('P1');
        await personTenancyContractsSmart('P1');
        await contractDetailsSmart('C1');
        await ownershipHistorySmart({ personId: 'P1' });
        await propertyInspectionsSmart('PR1');
        await salesForPersonSmart('P1');
        await salesForPropertySmart('PR1');

        (window as any).desktopDb = originalDb;
    });
});

describe('Final Strike - installments.ts', () => {
    test('generateContractInstallmentsInternal - Exhaustive logic', () => {
        const contractBase = {
            رقم_العقد: 'C1',
            تاريخ_البداية: '2025-01-01',
            تاريخ_النهاية: '2025-12-31',
            مدة_العقد_بالاشهر: 12,
            تكرار_الدفع: 12,
            القيمة_السنوية: 12000,
            احتساب_فرق_ايام: false,
            يوجد_دفعة_اولى: false,
            قيمة_التأمين: 0,
            طريقة_الدفع: 'Prepaid'
        };

        generateContractInstallmentsInternal(contractBase as any, 'C1');
        generateContractInstallmentsInternal({ ...contractBase, تاريخ_البداية: '2025-01-15', احتساب_فرق_ايام: true } as any, 'C1');
        generateContractInstallmentsInternal({ ...contractBase, يوجد_دفعة_اولى: true, قيمة_الدفعة_الاولى: 1000, 'عدد_أشهر_الدفعة_الأولى': 2 } as any, 'C1');
        generateContractInstallmentsInternal({ ...contractBase, يوجد_دفعة_اولى: true, 'تقسيط_الدفعة_الأولى': true, 'عدد_أقساط_الدفعة_الأولى': 3, قيمة_الدفعة_الاولى: 3000 } as any, 'C1');
        generateContractInstallmentsInternal({ ...contractBase, قيمة_التأمين: 500, طريقة_الدفع: 'Postpaid' } as any, 'C1');
        generateContractInstallmentsInternal({ ...contractBase, تاريخ_البداية: 'invalid' } as any, 'C1');
        generateContractInstallmentsInternal({ ...contractBase, يوجد_دفعة_اولى: true, 'تقسيط_الدفعة_الأولى': true, 'عدد_أقساط_الدفعة_الأولى': 1, قيمة_الدفعة_الاولى: 1000 } as any, 'C1');
    });

    test('Payment Logic Helpers', () => {
        const inst = { رقم_الكمبيالة: 'I1', القيمة: 1000, حالة_الكمبيالة: INSTALLMENT_STATUS.UNPAID };
        getInstallmentPaidAndRemaining(inst as any);
        getInstallmentPaidAndRemaining({ ...inst, حالة_الكمبيالة: INSTALLMENT_STATUS.PAID } as any);
        getInstallmentPaidAndRemaining({ ...inst, القيمة_المتبقية: 500 } as any);
        getInstallmentPaidAndRemaining({ ...inst, سجل_الدفعات: [{ المبلغ: 200 }] } as any);
        getInstallmentPaymentSummary('I1');
        getInstallments();
    });
});
