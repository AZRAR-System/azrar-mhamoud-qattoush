import { 
  addMaintenanceTicket, 
  updateMaintenanceTicket, 
  deleteMaintenanceTicket, 
  getMaintenanceTickets 
} from '../../src/services/db/system/maintenance';
import { get, save } from '../../src/services/db/kv';
import { KEYS } from '../../src/services/db/keys';

jest.mock('../../src/services/db/kv', () => ({
  get: jest.fn(),
  save: jest.fn(),
}));

jest.mock('../../src/services/dbCache', () => ({
  buildCache: jest.fn(),
}));

jest.mock('../../src/services/db/refs', () => ({
  purgeRefs: jest.fn(),
}));

describe('Maintenance Logic - Comprehensive Suite', () => {
  const logOperation = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // 1. Get Tickets
  test('getMaintenanceTickets - returns array of tickets', () => {
    (get as jest.Mock).mockReturnValue([{ رقم_التذكرة: 'M1' }]);
    expect(getMaintenanceTickets()).toHaveLength(1);
  });

  // 2. Add Ticket
  test('addMaintenanceTicket - creates new ticket and saves to storage', () => {
    (get as jest.Mock).mockReturnValue([]);
    const res = addMaintenanceTicket({ الوصف: 'Leak', رقم_العقار: 'P1' } as any);
    expect(res.success).toBe(true);
    const saved = (save as jest.Mock).mock.calls[0][1];
    expect(saved[0].رقم_التذكرة).toContain('MNT-');
  });

  // 3. Update Status (Open to In Progress)
  test('updateMaintenanceTicket - updates status and other fields', () => {
    (get as jest.Mock).mockReturnValue([{ رقم_التذكرة: 'M1', الحالة: 'مفتوح' }]);
    updateMaintenanceTicket('M1', { الحالة: 'قيد التنفيذ' });
    const saved = (save as jest.Mock).mock.calls[0][1];
    expect(saved[0].الحالة).toBe('قيد التنفيذ');
  });

  // 4. Update Status (Close - Auto Date)
  test('updateMaintenanceTicket - auto-sets closing date when status becomes مغلق', () => {
    (get as jest.Mock).mockReturnValue([{ رقم_التذكرة: 'M1', الحالة: 'مفتوح' }]);
    updateMaintenanceTicket('M1', { الحالة: 'مغلق' });
    const saved = (save as jest.Mock).mock.calls[0][1];
    expect(saved[0].تاريخ_الإغلاق).toBeDefined();
    expect(saved[0].تاريخ_الإغلاق).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  // 5. Link to Property
  test('updateMaintenanceTicket - correctly updates property association', () => {
    (get as jest.Mock).mockReturnValue([{ رقم_التذكرة: 'M1', رقم_العقار: 'P1' }]);
    updateMaintenanceTicket('M1', { رقم_العقار: 'P2' });
    const saved = (save as jest.Mock).mock.calls[0][1];
    expect(saved[0].رقم_العقار).toBe('P2');
  });

  // 6. Delete Ticket
  test('deleteMaintenanceTicket - removes ticket and purges refs', () => {
    (get as jest.Mock).mockReturnValue([{ رقم_التذكرة: 'M1' }]);
    const res = deleteMaintenanceTicket('M1', logOperation);
    expect(res.success).toBe(true);
    const saved = (save as jest.Mock).mock.calls[0][1];
    expect(saved).toHaveLength(0);
    expect(logOperation).toHaveBeenCalled();
  });

  // 7. Delete - Non-Existent
  test('deleteMaintenanceTicket - returns success if ticket already gone', () => {
    (get as jest.Mock).mockReturnValue([]);
    const res = deleteMaintenanceTicket('M1', logOperation);
    expect(res.success).toBe(true);
  });

  // 8. Cost Tracking
  test('updateMaintenanceTicket - updates cost field correctly', () => {
    (get as jest.Mock).mockReturnValue([{ رقم_التذكرة: 'M1', التكلفة: 0 }]);
    updateMaintenanceTicket('M1', { التكلفة: 150 });
    const saved = (save as jest.Mock).mock.calls[0][1];
    expect(saved[0].التكلفة).toBe(150);
  });
});
