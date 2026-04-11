import { jest } from '@jest/globals';
import { 
  addMaintenanceTicket, 
  updateMaintenanceTicket, 
  deleteMaintenanceTicket,
  getMaintenanceTickets
} from '@/services/db/system/maintenance';
import { save } from '@/services/db/kv';
import { KEYS } from '@/services/db/keys';

describe('Maintenance Service', () => {
  beforeEach(() => {
    localStorage.clear();
    save(KEYS.MAINTENANCE, []);
  });

  it('addMaintenanceTicket: should create a new ticket', () => {
    const res = addMaintenanceTicket({
      رقم_العقار: 'PR1',
      الوصف: 'AC Leak',
      الأولوية: 'عالية',
      الحالة: 'مفتوح'
    });

    expect(res.success).toBe(true);
    expect(getMaintenanceTickets()).toHaveLength(1);
    expect(getMaintenanceTickets()[0].الحالة).toBe('مفتوح');
  });

  it('updateMaintenanceTicket: should change status and details', () => {
    save(KEYS.MAINTENANCE, [{ رقم_التذكرة: 'T1', الحالة: 'مفتوح', الوصف: 'Old' }]);
    
    updateMaintenanceTicket('T1', { الحالة: 'قيد الإصلاح', الوصف: 'New' });
    const tickets = getMaintenanceTickets();
    expect(tickets[0].الحالة).toBe('قيد الإصلاح');
    expect(tickets[0].الوصف).toBe('New');
  });

  it('deleteMaintenanceTicket: should remove ticket', () => {
    save(KEYS.MAINTENANCE, [{ رقم_التذكرة: 'T1', الحالة: 'مفتوح' }]);
    
    const mockLog = jest.fn();
    deleteMaintenanceTicket('T1', mockLog);
    
    expect(getMaintenanceTickets()).toHaveLength(0);
    expect(mockLog).toHaveBeenCalled();
  });
});
