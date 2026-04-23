import { createContractWrites } from '../../src/services/db/contracts';
import { get, save } from '../../src/services/db/kv';
import { KEYS } from '../../src/services/db/keys';
import { generateContractInstallmentsInternal } from '../../src/services/db/installments';

jest.mock('../../src/services/db/kv', () => ({
  get: jest.fn(),
  save: jest.fn(),
}));

jest.mock('../../src/services/db/installments', () => ({
  generateContractInstallmentsInternal: jest.fn(),
}));

jest.mock('../../src/services/localDbStorage', () => ({
  dbOk: (data?: any) => ({ success: true, data }),
  dbFail: (msg: string) => ({ success: false, message: msg }),
}));

describe('Contracts Logic - Strengthened Suite', () => {
  const mockDeps = {
    logOperation: jest.fn(),
    handleSmartEngine: jest.fn(),
    formatDateOnly: jest.fn(d => d.toISOString().split('T')[0]),
    addDaysIso: jest.fn((iso, days) => {
      const d = new Date(iso);
      d.setDate(d.getDate() + days);
      return d.toISOString().split('T')[0];
    }),
    addMonthsDateOnly: jest.fn((iso, months) => {
      const d = new Date(iso);
      d.setMonth(d.getMonth() + months);
      return d;
    }),
  };

  const { 
    createContract, 
    updateContract, 
    deleteContract, 
    terminateContract, 
    renewContract, 
    autoArchiveContracts 
  } = createContractWrites(mockDeps as any);

  beforeEach(() => {
    jest.clearAllMocks();
    (generateContractInstallmentsInternal as jest.Mock).mockReturnValue({ success: true, data: [] });
  });

  // 1. Create New Contract
  test('createContract - saves with correct defaults and updates property status', () => {
    (get as jest.Mock).mockImplementation((key) => {
      if (key === KEYS.CONTRACTS) return [];
      if (key === KEYS.COMMISSIONS) return [];
      if (key === KEYS.PROPERTIES) return [{ رقم_العقار: 'P1', IsRented: false }];
      return [];
    });

    const res = createContract({ 
      رقم_العقار: 'P1', 
      رقم_المستاجر: 'T1', 
      القيمة_السنوية: 12000,
      تاريخ_البداية: '2026-01-01',
      تاريخ_النهاية: '2026-12-31'
    }, 50, 50);

    expect(res.success).toBe(true);
    expect(res.data?.رقم_العقد).toBe('cot_001');
    expect(res.data?.حالة_العقد).toBe('نشط');
    
    // Check property status update
    const savedProps = (save as jest.Mock).mock.calls.find(c => c[0] === KEYS.PROPERTIES)[1];
    expect(savedProps[0].IsRented).toBe(true);
    expect(savedProps[0].حالة_العقار).toBe('مؤجر');
  });

  // 2. Update Contract
  test('updateContract - updates basic fields', () => {
    const existing = { رقم_العقد: 'cot_001', رقم_العقار: 'P1', رقم_المستاجر: 'T1', القيمة_السنوية: 10000 };
    (get as jest.Mock).mockImplementation((key) => {
      if (key === KEYS.CONTRACTS) return [existing];
      if (key === KEYS.COMMISSIONS) return [{ رقم_العقد: 'cot_001', عمولة_المالك: 50 }];
      return [];
    });

    const res = updateContract('cot_001', { القيمة_السنوية: 15000 }, 75, 75);
    expect(res.success).toBe(true);
    
    const saved = (save as jest.Mock).mock.calls.find(c => c[0] === KEYS.CONTRACTS)[1];
    expect(saved[0].القيمة_السنوية).toBe(15000);
  });

  // 3. Prevent Property Change
  test('updateContract - prevents changing propertyId', () => {
    const existing = { رقم_العقد: 'cot_001', رقم_العقار: 'P1', رقم_المستاجر: 'T1' };
    (get as jest.Mock).mockReturnValue([existing]);

    const res = updateContract('cot_001', { رقم_العقار: 'P2' }, 0, 0);
    expect(res.success).toBe(false);
    expect(res.message).toContain('لا يمكن تغيير العقار');
  });

  // 4. Prevent Tenant Change
  test('updateContract - prevents changing tenantId', () => {
    const existing = { رقم_العقد: 'cot_001', رقم_العقار: 'P1', رقم_المستاجر: 'T1' };
    (get as jest.Mock).mockReturnValue([existing]);

    const res = updateContract('cot_001', { رقم_المستاجر: 'T2' }, 0, 0);
    expect(res.success).toBe(false);
    expect(res.message).toContain('لا يمكن تغيير المستأجر');
  });

  // 5. Termination Logic
  test('terminateContract - sets status to مفسوخ and cancels future installments', () => {
    const contract = { رقم_العقد: 'cot_001', رقم_العقار: 'P1', حالة_العقد: 'نشط' };
    const installments = [
      { رقم_العقد: 'cot_001', حالة_الكمبيالة: 'مدفوع' },
      { رقم_العقد: 'cot_001', حالة_الكمبيالة: 'غير مدفوع' }
    ];
    (get as jest.Mock).mockImplementation((key) => {
      if (key === KEYS.CONTRACTS) return [contract];
      if (key === KEYS.INSTALLMENTS) return installments;
      if (key === KEYS.PROPERTIES) return [{ رقم_العقار: 'P1' }];
      return [];
    });

    terminateContract('cot_001', 'Test Reason', '2026-06-01');

    const savedContracts = (save as jest.Mock).mock.calls.find(c => c[0] === KEYS.CONTRACTS)[1];
    expect(savedContracts[0].حالة_العقد).toBe('مفسوخ');

    const savedInst = (save as jest.Mock).mock.calls.find(c => c[0] === KEYS.INSTALLMENTS)[1];
    expect(savedInst[0].حالة_الكمبيالة).toBe('مدفوع'); // Remains paid
    expect(savedInst[1].حالة_الكمبيالة).toBe('ملغي'); // Future cancelled
  });

  // 6. Renewal Logic - Basic
  test('renewContract - creates linked contract and marks old as ended', () => {
    const oldContract = { 
      رقم_العقد: 'cot_001', 
      رقم_العقار: 'P1', 
      رقم_المستاجر: 'T1',
      تاريخ_النهاية: '2026-12-31'
    };
    (get as jest.Mock).mockImplementation((key) => {
      if (key === KEYS.CONTRACTS) return [oldContract];
      if (key === KEYS.COMMISSIONS) return [];
      if (key === KEYS.PROPERTIES) return [{ رقم_العقار: 'P1' }];
      if (key === KEYS.INSTALLMENTS) return [];
      return [];
    });

    const res = renewContract('cot_001');
    expect(res.success).toBe(true);
    
    const savedContracts = (save as jest.Mock).mock.calls.find(c => c[0] === KEYS.CONTRACTS)[1];
    const old = savedContracts.find((c: any) => c.رقم_العقد === 'cot_001');
    expect(old.حالة_العقد).toBe('منتهي');
    expect(old.linkedContractId).toBe('cot_002');
  });

  // 7. Renewal with Debt Transfer
  test('renewContract - transfers negative balance (debt) as a new installment', () => {
    const oldContract = { رقم_العقد: 'cot_001', تاريخ_النهاية: '2025-12-31' };
    const installments = [
      { رقم_العقد: 'cot_001', القيمة: 500, سجل_الدفعات: [{ المبلغ: 300 }] } // Debt of 200
    ];
    (get as jest.Mock).mockImplementation((key) => {
      if (key === KEYS.CONTRACTS) return [oldContract];
      if (key === KEYS.INSTALLMENTS) return installments;
      if (key === KEYS.COMMISSIONS) return [];
      if (key === KEYS.PROPERTIES) return [{ رقم_العقار: 'P1' }];
      return [];
    });

    renewContract('cot_001', { transferBalance: true });

    const savedInstCalls = (save as jest.Mock).mock.calls.filter(c => c[0] === KEYS.INSTALLMENTS);
    const lastSavedInst = savedInstCalls[savedInstCalls.length - 1][1];
    const debtInst = lastSavedInst.find((i: any) => i.رقم_الكمبيالة === 'DEBT-cot_002');
    expect(debtInst.القيمة).toBe(200);
  });

  // 8. Auto-Archive Logic - Paid & Ended
  test('autoArchiveContracts - archives paid ended contracts', () => {
    const contract = { رقم_العقد: 'cot_001', حالة_العقد: 'منتهي', isArchived: false };
    const installments = [{ رقم_العقد: 'cot_001', القيمة: 100, حالة_الكمبيالة: 'مدفوع' }];
    (get as jest.Mock).mockImplementation((key) => {
      if (key === KEYS.CONTRACTS) return [contract];
      if (key === KEYS.INSTALLMENTS) return installments;
      return [];
    });

    autoArchiveContracts();
    const saved = (save as jest.Mock).mock.calls.find(c => c[0] === KEYS.CONTRACTS)[1];
    expect(saved[0].حالة_العقد).toBe('مؤرشف');
    expect(saved[0].isArchived).toBe(true);
  });

  // 9. Auto-Archive Logic - Unpaid to Collection
  test('autoArchiveContracts - marks unpaid ended contracts as تحصيل', () => {
    const contract = { رقم_العقد: 'cot_001', حالة_العقد: 'منتهي' };
    const installments = [{ رقم_العقد: 'cot_001', القيمة: 100, حالة_الكمبيالة: 'غير مدفوع' }];
    (get as jest.Mock).mockImplementation((key) => {
      if (key === KEYS.CONTRACTS) return [contract];
      if (key === KEYS.INSTALLMENTS) return installments;
      return [];
    });

    autoArchiveContracts();
    const saved = (save as jest.Mock).mock.calls.find(c => c[0] === KEYS.CONTRACTS)[1];
    expect(saved[0].حالة_العقد).toBe('تحصيل');
  });

  // 10. Delete Contract
  test('deleteContract - removes contract and associated data', () => {
    (get as jest.Mock).mockImplementation((key) => {
      if (key === KEYS.CONTRACTS) return [{ رقم_العقد: 'cot_001' }];
      if (key === KEYS.INSTALLMENTS) return [{ رقم_العقد: 'cot_001' }];
      if (key === KEYS.COMMISSIONS) return [{ رقم_العقد: 'cot_001' }];
      return [];
    });

    deleteContract('cot_001');
    expect(save).toHaveBeenCalledWith(KEYS.CONTRACTS, []);
    expect(save).toHaveBeenCalledWith(KEYS.INSTALLMENTS, []);
  });

  // 11. Create ID generation
  test('createContract - generates cot_002 after cot_001', () => {
    (get as jest.Mock).mockReturnValue([{ رقم_العقد: 'cot_001' }]);
    const res = createContract({ رقم_العقار: 'P1' }, 0, 0);
    expect(res.data?.رقم_العقد).toBe('cot_002');
  });

  // 12. Update - Block if Paid Installments exist when regenerating
  test('updateContract - blocks regeneration if payments exist', () => {
    const existing = { رقم_العقد: 'cot_001' };
    (get as jest.Mock).mockImplementation((key) => {
      if (key === KEYS.CONTRACTS) return [existing];
      if (key === KEYS.INSTALLMENTS) return [{ رقم_العقد: 'cot_001', حالة_الكمبيالة: 'مدفوع' }];
      return [];
    });

    const res = updateContract('cot_001', {}, 0, 0, undefined, { regenerateInstallments: true });
    expect(res.success).toBe(false);
    expect(res.message).toContain('محصلة بالفعل');
  });

  // 13. Termination - Property returns to vacant
  test('terminateContract - property status becomes شاغر', () => {
    const contract = { رقم_العقد: 'cot_001', رقم_العقار: 'P1' };
    (get as jest.Mock).mockImplementation((key) => {
      if (key === KEYS.CONTRACTS) return [contract];
      if (key === KEYS.INSTALLMENTS) return [];
      if (key === KEYS.PROPERTIES) return [{ رقم_العقار: 'P1', IsRented: true }];
      return [];
    });

    terminateContract('cot_001', 'Reason', '2026-01-01');
    const savedProps = (save as jest.Mock).mock.calls.find(c => c[0] === KEYS.PROPERTIES)[1];
    expect(savedProps[0].IsRented).toBe(false);
    expect(savedProps[0].حالة_العقار).toBe('شاغر');
  });

  // 14. Renewal - Block if already renewed
  test('renewContract - blocks if already has linkedContractId', () => {
    (get as jest.Mock).mockReturnValue([{ رقم_العقد: 'cot_001', linkedContractId: 'cot_002' }]);
    const res = renewContract('cot_001');
    expect(res.success).toBe(false);
    expect(res.message).toContain('لديه تجديد بالفعل');
  });

  // 15. Auto-Archive - Status Change to قريب الانتهاء
  test('autoArchiveContracts - updates status to قريب الانتهاء if < 30 days left', () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 15); // 15 days from now
    const isoFuture = futureDate.toISOString().split('T')[0];

    const contract = { 
      رقم_العقد: 'cot_001', 
      حالة_العقد: 'نشط', 
      تاريخ_النهاية: isoFuture
    };
    (get as jest.Mock).mockImplementation((key) => {
      if (key === KEYS.CONTRACTS) return [contract];
      if (key === KEYS.INSTALLMENTS) return [];
      return [];
    });

    autoArchiveContracts();
    const saved = (save as jest.Mock).mock.calls.find(c => c[0] === KEYS.CONTRACTS)[1];
    expect(saved[0].حالة_العقد).toBe('قريب الانتهاء');
  });
});
