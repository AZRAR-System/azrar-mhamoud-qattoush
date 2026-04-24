import { 
  createInspectionHandlers, 
  getPropertyInspections, 
  getInspection, 
  getLatestInspectionForProperty 
} from '@/services/db/system/inspections';
import * as kv from '@/services/db/kv';
import { KEYS } from '@/services/db/keys';
import { buildCache } from '@/services/dbCache';

describe('Inspections System Service - Property Audit Suite', () => {
  const mockDeps = {
    logOperation: jest.fn(),
  };

  const handlers = createInspectionHandlers(mockDeps);

  beforeEach(() => {
    localStorage.clear();
    buildCache();
    jest.clearAllMocks();
  });

  test('createInspection - validates and persists new inspection', () => {
    const res = handlers.createInspection({
      propertyId: 'PR1',
      inspectionDate: '2025-01-10',
      inspectorId: 'Ali',
      status: 'Completed',
      notes: 'Clean'
    } as any);

    expect(res.success).toBe(true);
    expect(res.data?.id).toContain('INS-');
    
    const stored = getPropertyInspections('PR1');
    expect(stored).toHaveLength(1);
    expect(stored[0].inspectorId).toBe('Ali');
  });

  test('createInspection - fails if required fields missing', () => {
    const res1 = handlers.createInspection({ propertyId: '', inspectionDate: '2025-01-01' } as any);
    expect(res1.success).toBe(false);
    expect(res1.message).toBe('رقم العقار مطلوب');

    const res2 = handlers.createInspection({ propertyId: 'PR1', inspectionDate: '' } as any);
    expect(res2.success).toBe(false);
    expect(res2.message).toBe('تاريخ الكشف مطلوب');
  });

  test('updateInspection - modifies existing record', () => {
    const id = handlers.createInspection({ propertyId: 'PR1', inspectionDate: '2025-01-01' }).data!.id;
    const res = handlers.updateInspection(id, { notes: 'Updated notes' });
    
    expect(res.success).toBe(true);
    expect(getInspection(id)?.notes).toBe('Updated notes');
  });

  test('deleteInspection - removes record', () => {
    const id = handlers.createInspection({ propertyId: 'PR1', inspectionDate: '2025-01-01' }).data!.id;
    handlers.deleteInspection(id);
    expect(getInspection(id)).toBeNull();
  });

  test('getPropertyInspections - returns sorted list', () => {
    handlers.createInspection({ propertyId: 'PR1', inspectionDate: '2025-01-01' });
    handlers.createInspection({ propertyId: 'PR1', inspectionDate: '2025-01-05' });
    
    const all = getPropertyInspections('PR1');
    expect(all).toHaveLength(2);
    expect(all[0].inspectionDate).toBe('2025-01-05'); // Sorted desc
  });

  test('getLatestInspectionForProperty - returns most recent', () => {
    handlers.createInspection({ propertyId: 'PR1', inspectionDate: '2025-01-01' });
    handlers.createInspection({ propertyId: 'PR1', inspectionDate: '2025-01-10' });
    
    const latest = getLatestInspectionForProperty('PR1');
    expect(latest?.inspectionDate).toBe('2025-01-10');
  });
});
