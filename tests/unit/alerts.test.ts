import { jest } from '@jest/globals';
import { createAlert, markAlertsReadByPrefix, clearOldAlerts } from '@/services/db/alertsCore';
import { get, save } from '@/services/db/kv';
import { KEYS } from '@/services/db/keys';

describe('Alerts Core Logic - Corrected', () => {
  beforeEach(() => {
    localStorage.clear();
    save(KEYS.ALERTS, []);
  });

  it('createAlert: should deduplicate alerts with the same stableId', () => {
    // Correct signature: type, message, category, onNotify, ctx
    createAlert('Financial', 'Late payment for C1', 'LatePay', undefined, { stableId: 'ST-1' });
    createAlert('Financial', 'Late payment for C1', 'LatePay', undefined, { stableId: 'ST-1' });
    
    const alerts = get<any[]>(KEYS.ALERTS);
    expect(alerts).toHaveLength(1);
  });

  it('markAlertsReadByPrefix: should update bulk read status', () => {
    save(KEYS.ALERTS, [
      { id: 'REM-101', تم_القراءة: false },
      { id: 'REM-102', تم_القراءة: false },
      { id: 'SYS-001', تم_القراءة: false }
    ]);

    markAlertsReadByPrefix('REM-');
    
    const alerts = get<any[]>(KEYS.ALERTS);
    expect(alerts.find(a => a.id === 'REM-101')?.تم_القراءة).toBe(true);
    expect(alerts.find(a => a.id === 'SYS-001')?.تم_القراءة).toBe(false);
  });
});
