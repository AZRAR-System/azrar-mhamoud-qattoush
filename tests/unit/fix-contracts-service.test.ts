/**
 * Tests for src/services/db/contracts.ts
 * Focuses on: contract ID generation, getContractDetails
 */

jest.mock('../../src/services/db/kv', () => ({
  get: jest.fn(() => []),
  save: jest.fn(),
}));

jest.mock('../../src/services/localDbStorage', () => ({
  dbOk: (data?: unknown) => ({ success: true, data }),
  dbFail: (message: string) => ({ success: false, message }),
}));

jest.mock('../../src/services/db/keys', () => ({
  KEYS: {
    CONTRACTS: 'db_contracts',
    PROPERTIES: 'db_properties',
    PEOPLE: 'db_people',
    INSTALLMENTS: 'db_installments',
    COMMISSIONS: 'db_commissions',
    CLEARANCE_RECORDS: 'db_clearance_records',
  },
}));

jest.mock('../../src/services/db/installmentConstants', () => ({
  INSTALLMENT_STATUS: { PENDING: 'معلق', PAID: 'مدفوع', CANCELLED: 'ملغي' },
}));

jest.mock('../../src/services/db/installments', () => ({
  generateContractInstallmentsInternal: jest.fn(() => ({ success: true, data: [] })),
}));

import { get } from '../../src/services/db/kv';
import { getContracts, getContractDetails, createContractWrites } from '../../src/services/db/contracts';

const mockGet = get as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockGet.mockReturnValue([]);
});

describe('getContracts', () => {
  it('returns empty array when no contracts', () => {
    expect(getContracts()).toEqual([]);
  });

  it('returns contracts from storage', () => {
    const contracts = [{ رقم_العقد: 'cot_001' }];
    mockGet.mockReturnValue(contracts);
    expect(getContracts()).toEqual(contracts);
  });
});

describe('getContractDetails', () => {
  it('returns null when contract not found', () => {
    mockGet.mockReturnValue([]);
    expect(getContractDetails('cot_999')).toBeNull();
  });

  it('returns contract details when found', () => {
    const contract = { رقم_العقد: 'cot_001', رقم_العقار: 'PROP-1', رقم_المستاجر: 'P-1' };
    mockGet.mockImplementation((key) => {
      if (key === 'db_contracts') return [contract];
      if (key === 'db_properties') return [{ رقم_العقار: 'PROP-1' }];
      if (key === 'db_people') return [{ رقم_الشخص: 'P-1' }];
      return [];
    });

    const result = getContractDetails('cot_001');
    expect(result).not.toBeNull();
    expect(result?.contract.رقم_العقد).toBe('cot_001');
  });

  it('sorts installments by ترتيب_الكمبيالة', () => {
    const contract = { رقم_العقد: 'cot_001', رقم_العقار: 'PROP-1', رقم_المستاجر: 'P-1' };
    const installments = [
      { رقم_العقد: 'cot_001', ترتيب_الكمبيالة: 3 },
      { رقم_العقد: 'cot_001', ترتيب_الكمبيالة: 1 },
      { رقم_العقد: 'cot_001', ترتيب_الكمبيالة: 2 },
    ];
    mockGet.mockImplementation((key) => {
      if (key === 'db_contracts') return [contract];
      if (key === 'db_installments') return installments;
      return [];
    });
    
    const result = getContractDetails('cot_001');
    expect(result?.installments[0].ترتيب_الكمبيالة).toBe(1);
    expect(result?.installments[2].ترتيب_الكمبيالة).toBe(3);
  });
});

describe('contract ID generation (makeNextCotContractId)', () => {
  const mockDeps = {
    logOperation: jest.fn(),
    handleSmartEngine: jest.fn(),
    formatDateOnly: jest.fn((d: Date) => d.toISOString().slice(0, 10)),
    addDaysIso: jest.fn(),
    addMonthsDateOnly: jest.fn(),
  };

  it('generates cot_001 when no contracts exist', () => {
    mockGet.mockReturnValue([]);
    const writes = createContractWrites(mockDeps);
    const result = (writes as any).createContract({ تاريخ_البداية: '2026-01-01', تاريخ_النهاية: '2027-01-01' }, 0, 0);
    expect(result.success).toBe(true);
    expect(result.data?.رقم_العقد).toBe('cot_001');
  });

  it('generates sequential IDs', () => {
    mockGet.mockImplementation((key) => {
      if (key === 'db_contracts') return [{ رقم_العقد: 'cot_005' }];
      if (key === 'db_commissions') return [];
      if (key === 'db_installments') return [];
      if (key === 'db_properties') return [];
      return [];
    });
    const writes = createContractWrites(mockDeps);
    const result = (writes as any).createContract({ تاريخ_البداية: '2026-01-01', تاريخ_النهاية: '2027-01-01' }, 0, 0);
    expect(result.success).toBe(true);
    expect(result.data?.رقم_العقد).toBe('cot_006');
  });
});
