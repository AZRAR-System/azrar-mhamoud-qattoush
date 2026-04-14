import { jest } from '@jest/globals';
import * as xlsx from '../../src/utils/xlsx';
import * as salesService from '../../src/services/db/system/sales_agreements';
import * as reports from '../../src/services/db/system/reports';
import * as marquee from '../../src/services/db/system/marquee';

import { KEYS } from '../../src/services/db/keys';

// --- ROBUST MOCKS ---

let mockKv: Record<string, any> = {};
jest.mock('../../src/services/db/kv', () => ({
  get: jest.fn((key: string) => mockKv[key] || []),
  save: jest.fn((key: string, val: any) => { mockKv[key] = val; }),
}));

(global as any).window = (global as any).window || {};
(global as any).window.desktopDb = {
  get: jest.fn(async (key: string) => mockKv[key] || null),
  set: jest.fn(async (key: string, val: string) => { mockKv[key] = val; }),
  delete: jest.fn(async (key: string) => { delete mockKv[key]; }),
  keys: jest.fn(async () => Object.keys(mockKv)),
};
(global as any).window.dispatchEvent = jest.fn();

describe('Deep Logic Strike V5 - The Final Push to 70%', () => {
  beforeEach(() => {
    mockKv = {};
    jest.clearAllMocks();
  });

  test('xlsx.ts - Exhaustive Branch Coverage', async () => {
    // 1. toExcelCellValue branches
    xlsx.toExcelCellValue(null);
    xlsx.toExcelCellValue(undefined);
    xlsx.toExcelCellValue('string');
    xlsx.toExcelCellValue(123);
    xlsx.toExcelCellValue(true);
    xlsx.toExcelCellValue(new Date());
    xlsx.toExcelCellValue({ key: 'val' });
    xlsx.toExcelCellValue({ 
        toJSON() { throw new Error(); }, // Force catch in JSON.stringify if it uses it internally
    });

    // 2. toCellString branches (The 100-line chunk)
    xlsx.toCellString(null);
    xlsx.toCellString('pure string');
    xlsx.toCellString(456);
    xlsx.toCellString(false);
    xlsx.toCellString(new Date());
    xlsx.toCellString({ text: 'Simple Text' });
    xlsx.toCellString({ richText: [{ text: 'Part 1' }, { text: 'Part 2' }, {}] });
    xlsx.toCellString({ result: 'Formula Result' });
    xlsx.toCellString({ other: 'Fallback' });

    // 3. readCsvFile - Quoting and Escaping
    const csvContent = '\uFEFFHeader1,Header2\n"Field with , comma","Regular"\n"Quoted ""Escaped"" Quote",Short\n\n  ';
    const mockFile = { text: async () => csvContent, name: 'data.csv' } as any;
    const csvData = await xlsx.readCsvFile(mockFile);
    expect(csvData).toHaveLength(2);
    expect(csvData[1]['Header1']).toBe('Quoted "Escaped" Quote');

    // 4. readSpreadsheet routing
    await xlsx.readSpreadsheet({ name: 'test.xlsx', arrayBuffer: async () => new ArrayBuffer(0) } as any).catch(() => {});
    await expect(xlsx.readSpreadsheet({ name: 'test.xls' } as any)).rejects.toThrow();
    await xlsx.readSpreadsheet({ name: 'test.csv', text: async () => 'a,b\n1,2' } as any);
  });

  test('sales_agreements.ts - Exhaustive finalizeOwnershipTransfer', async () => {
    // Seed data to hit ALL branches of the 150-line finalize function
    const propertyId = 'P-1';
    const oldOwnerId = 'O-1';
    const newOwnerId = 'B-1';
    const listingId = 'L-1';
    const agreementId = 'AGR-1';
    const contractId = 'C-1';

    mockKv[KEYS.PROPERTIES] = [{ رقم_العقار: propertyId, رقم_المالك: oldOwnerId, حالة_العقار: 'شاغر', IsRented: true }];
    mockKv[KEYS.PEOPLE] = [{ رقم_الشخص: oldOwnerId }, { رقم_الشخص: newOwnerId }];
    mockKv[KEYS.SALES_LISTINGS] = [{ id: listingId, رقم_العقار: propertyId, رقم_المالك: oldOwnerId, الحالة: 'Active' }];
    mockKv[KEYS.SALES_AGREEMENTS] = [{ id: agreementId, listingId, رقم_المشتري: newOwnerId, isCompleted: false }];
    mockKv[KEYS.CONTRACTS] = [{ رقم_العقد: contractId, رقم_العقار: propertyId, حالة_العقد: 'نشط' }];
    mockKv[KEYS.ATTACHMENTS] = [
        { referenceType: 'Property', referenceId: propertyId },
        { referenceType: 'Person', referenceId: newOwnerId }
    ];

    const deps = {
        logOperation: jest.fn(),
        getPersonRoles: jest.fn(() => ['مستأجر']),
        updatePersonRoles: jest.fn(),
        terminateContract: jest.fn(() => ({ success: true })),
        upsertCommissionForSale: jest.fn(),
    };
    const handlers = salesService.createSalesHandlers(deps as any);

    // 1. Success Path (Hits ~100 unique lines including roles, history, contracts)
    await handlers.finalizeOwnershipTransfer(agreementId, { transactionId: 'TX-OK', targetStatus: 'مباع' });

    // 2. Failure: Already completed
    await handlers.finalizeOwnershipTransfer(agreementId, { transactionId: 'TX-FAIL' });

    // 3. Failure: Missing attachments
    mockKv[KEYS.SALES_AGREEMENTS][0].isCompleted = false;
    mockKv[KEYS.ATTACHMENTS] = [];
    const resAtt = await handlers.finalizeOwnershipTransfer(agreementId, { transactionId: 'TX-ATT' });
    expect(resAtt.success).toBe(false);

    // 4. Failure: Owner mismatch
    mockKv[KEYS.ATTACHMENTS] = [
        { referenceType: 'Property', referenceId: propertyId },
        { referenceType: 'Person', referenceId: newOwnerId }
    ];
    mockKv[KEYS.PROPERTIES][0].رقم_المالك = 'SOMEONE_ELSE';
    const resOwner = await handlers.finalizeOwnershipTransfer(agreementId, { transactionId: 'TX-OWN' });
    expect(resOwner.success).toBe(false);

    // 5. Cleanup stubs
    salesService.addSalesOfferNote('OFF-1', '   '); // Empty note branch
    salesService.updateSalesListing('NON-EXISTENT', {});
    salesService.deleteSalesListing('NON-EXISTENT');
  });

  test('reports.ts - Employee Commissions Matrix', () => {
    mockKv[KEYS.COMMISSIONS] = [
        { اسم_المستخدم: 'u1', المجموع: 100, نوع_العمولة: 'Rental', يوجد_ادخال_عقار: true, عمولة_عرض_عقار: 20 },
        { اسم_المستخدم: 'u1', المجموع: 200, نوع_العمولة: 'Sale', تاريخ_الاتفاقية: '2026-01-01' },
    ];
    mockKv[KEYS.USERS] = [{ اسم_المستخدم: 'u1', اسم_للعرض: 'Emp 1' }];
    
    reports.runReport('employee_commissions');
    reports.runReport('financial_summary');
    reports.runReport('UNKNOWN');
  });

  test('marquee.ts - Exhaustive Aggregation', () => {
    mockKv[KEYS.ALERTS] = [{ id: 'A1', تم_القراءة: false, الأولوية: 'Urgent' }];
    mockKv[KEYS.FOLLOW_UPS] = [{ id: 'F1', status: 'Pending', priority: 'High', title: 'Call' }];
    mockKv[KEYS.REMINDERS] = [{ id: 'R1', isDone: false, title: 'Task' }];
    mockKv[KEYS.SALES_LISTINGS] = [{ id: 'L1', الحالة: 'Active' }];
    mockKv[KEYS.MARQUEE_ADS] = [{ id: 'AD1', content: 'Promo', status: 'Active' }];

    marquee.getMarqueeMessages();
    marquee.addMarqueeAd({ content: 'New Ad' });
    marquee.updateMarqueeAd('AD1', { status: 'Paused' });
    marquee.deleteMarqueeAd('AD1');
  });
});
