import { 
  getMaintenanceTickets,
  addMaintenanceTicket,
  updateMaintenanceTicket,
  deleteMaintenanceTicket
} from '@/services/db/system/maintenance';
import * as kv from '@/services/db/kv';
import { KEYS } from '@/services/db/keys';
import { buildCache } from '@/services/dbCache';

describe('Maintenance System Service - Logic Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    buildCache();
  });

  test('addMaintenanceTicket - generates ID and persists ticket', () => {
    const ticket: any = { رقم_العقار: 'PR1', الوصف: 'Leak' };
    addMaintenanceTicket(ticket);
    
    const all = getMaintenanceTickets();
    expect(all).toHaveLength(1);
    expect(all[0].رقم_التذكرة).toContain('MNT-');
    expect(all[0].الوصف).toBe('Leak');
  });

  test('updateMaintenanceTicket - updates fields and sets closure date automatically', () => {
    addMaintenanceTicket({ رقم_العقار: 'PR1', الوصف: 'Test', الحالة: 'مفتوح' } as any);
    const id = getMaintenanceTickets()[0].رقم_التذكرة;
    
    updateMaintenanceTicket(id, { الحالة: 'مغلق' });
    
    const updated = getMaintenanceTickets()[0];
    expect(updated.الحالة).toBe('مغلق');
    expect(updated.تاريخ_الإغلاق).toBeDefined(); // Should be current YYYY-MM-DD
    expect(updated.تاريخ_الإغلاق).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('deleteMaintenanceTicket - removes ticket and logs operation', () => {
    const logSpy = jest.fn();
    addMaintenanceTicket({ رقم_العقار: 'PR1', الوصف: 'To delete' } as any);
    const id = getMaintenanceTickets()[0].رقم_التذكرة;
    
    deleteMaintenanceTicket(id, logSpy);
    
    expect(getMaintenanceTickets()).toHaveLength(0);
    expect(logSpy).toHaveBeenCalledWith('Admin', 'حذف', 'Maintenance', id, expect.any(String));
  });

  test('deleteMaintenanceTicket - handles invalid ID gracefully', () => {
    const res = deleteMaintenanceTicket('invalid', jest.fn());
    expect(res.success).toBe(true);
  });
});
