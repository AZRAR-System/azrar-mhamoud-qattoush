import {
  upsertAlert,
  stableAlertId,
  buildContractAlertContext,
  markAlertsReadByPrefix,
  markMultipleAlertsAsRead,
  createAlert,
  clearOldAlerts,
  syncExistingAlertsToNotificationCenter,
  markAlertAsRead,
  markAllAlertsAsRead,
} from '@/services/db/alertsCore';
import * as kv from '@/services/db/kv';
import { KEYS } from '@/services/db/keys';
import { buildCache } from '@/services/dbCache';

const makeAlert = (id: string, read = false) => ({
  id,
  تاريخ_الانشاء: new Date().toISOString().split('T')[0],
  نوع_التنبيه: 'warning',
  الوصف: 'test alert',
  category: 'Financial' as const,
  تم_القراءة: read,
  مرجع_الجدول: 'System' as const,
  مرجع_المعرف: 'batch',
});

beforeEach(() => {
  localStorage.clear();
  buildCache();
});

describe('stableAlertId', () => {
  test('same inputs produce same id', () => {
    const a = stableAlertId('2026-01-01', 'warning', 'msg', 'Financial');
    const b = stableAlertId('2026-01-01', 'warning', 'msg', 'Financial');
    expect(a).toBe(b);
  });

  test('different inputs produce different ids', () => {
    const a = stableAlertId('2026-01-01', 'warning', 'msg1', 'Financial');
    const b = stableAlertId('2026-01-01', 'warning', 'msg2', 'Financial');
    expect(a).not.toBe(b);
  });
});

describe('upsertAlert', () => {
  test('inserts new alert', () => {
    upsertAlert(makeAlert('ALR-1'));
    const all = kv.get<any>(KEYS.ALERTS);
    expect(all).toHaveLength(1);
  });

  test('updates existing alert preserving read state', () => {
    kv.save(KEYS.ALERTS, [makeAlert('ALR-1', true)]);
    buildCache();
    upsertAlert({ ...makeAlert('ALR-1'), الوصف: 'updated' });
    const all = kv.get<any>(KEYS.ALERTS);
    expect(all[0].الوصف).toBe('updated');
    expect(all[0].تم_القراءة).toBe(true);
  });

  test('deduplicates multiple entries with same id', () => {
    kv.save(KEYS.ALERTS, [makeAlert('ALR-DUP'), makeAlert('ALR-DUP'), makeAlert('ALR-OTHER')]);
    buildCache();
    upsertAlert(makeAlert('ALR-DUP'));
    const all = kv.get<any>(KEYS.ALERTS);
    const dups = all.filter((a: any) => a.id === 'ALR-DUP');
    expect(dups).toHaveLength(1);
    expect(all.find((a: any) => a.id === 'ALR-OTHER')).toBeDefined();
  });
});

describe('markAlertsReadByPrefix', () => {
  test('marks matching alerts as read', () => {
    kv.save(KEYS.ALERTS, [makeAlert('PREFIX-1'), makeAlert('PREFIX-2'), makeAlert('OTHER-1')]);
    buildCache();
    markAlertsReadByPrefix('PREFIX-');
    const all = kv.get<any>(KEYS.ALERTS);
    expect(all.find((a: any) => a.id === 'PREFIX-1').تم_القراءة).toBe(true);
    expect(all.find((a: any) => a.id === 'OTHER-1').تم_القراءة).toBe(false);
  });

  test('no save when nothing changed (all already read)', () => {
    kv.save(KEYS.ALERTS, [makeAlert('PREFIX-1', true)]);
    buildCache();
    const spy = jest.spyOn(kv, 'save');
    markAlertsReadByPrefix('PREFIX-');
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('markMultipleAlertsAsRead', () => {
  test('marks specified ids as read', () => {
    kv.save(KEYS.ALERTS, [makeAlert('A1'), makeAlert('A2'), makeAlert('A3')]);
    buildCache();
    markMultipleAlertsAsRead(['A1', 'A3']);
    const all = kv.get<any>(KEYS.ALERTS);
    expect(all.find((a: any) => a.id === 'A1').تم_القراءة).toBe(true);
    expect(all.find((a: any) => a.id === 'A2').تم_القراءة).toBe(false);
    expect(all.find((a: any) => a.id === 'A3').تم_القراءة).toBe(true);
  });

  test('no save when nothing changed', () => {
    kv.save(KEYS.ALERTS, [makeAlert('A1', true)]);
    buildCache();
    const spy = jest.spyOn(kv, 'save');
    markMultipleAlertsAsRead(['A1']);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('markAlertAsRead', () => {
  test('marks specific alert as read', () => {
    kv.save(KEYS.ALERTS, [makeAlert('X1'), makeAlert('X2')]);
    buildCache();
    markAlertAsRead('X1');
    const all = kv.get<any>(KEYS.ALERTS);
    expect(all.find((a: any) => a.id === 'X1').تم_القراءة).toBe(true);
    expect(all.find((a: any) => a.id === 'X2').تم_القراءة).toBe(false);
  });

  test('noop when id not found', () => {
    kv.save(KEYS.ALERTS, [makeAlert('X1')]);
    buildCache();
    expect(() => markAlertAsRead('NOTEXIST')).not.toThrow();
  });
});

describe('markAllAlertsAsRead', () => {
  test('marks all as read', () => {
    kv.save(KEYS.ALERTS, [makeAlert('B1'), makeAlert('B2')]);
    buildCache();
    markAllAlertsAsRead();
    const all = kv.get<any>(KEYS.ALERTS);
    expect(all.every((a: any) => a.تم_القراءة)).toBe(true);
  });
});

describe('clearOldAlerts', () => {
  test('removes alerts older than cutoff', () => {
    const old = { ...makeAlert('OLD-1'), تاريخ_الانشاء: '2020-01-01' };
    const fresh = makeAlert('FRESH-1');
    kv.save(KEYS.ALERTS, [old, fresh]);
    buildCache();
    clearOldAlerts(30);
    const all = kv.get<any>(KEYS.ALERTS);
    expect(all.find((a: any) => a.id === 'OLD-1')).toBeUndefined();
    expect(all.find((a: any) => a.id === 'FRESH-1')).toBeDefined();
  });

  test('keeps all when none are old', () => {
    kv.save(KEYS.ALERTS, [makeAlert('FRESH-1'), makeAlert('FRESH-2')]);
    buildCache();
    clearOldAlerts(30);
    expect(kv.get<any>(KEYS.ALERTS)).toHaveLength(2);
  });
});

describe('createAlert', () => {
  test('creates alert with explicit context', () => {
    createAlert('warning', 'test', 'Financial', undefined, {
      مرجع_الجدول: 'العقود_tbl',
      مرجع_المعرف: 'C-100',
    });
    const all = kv.get<any>(KEYS.ALERTS);
    expect(all).toHaveLength(1);
    expect(all[0].مرجع_المعرف).toBe('C-100');
  });

  test('deduplicates same alert same day', () => {
    createAlert('warning', 'dup msg', 'Financial');
    createAlert('warning', 'dup msg', 'Financial');
    expect(kv.get<any>(KEYS.ALERTS)).toHaveLength(1);
  });

  test('parses كمبيالة from message text', () => {
    createAlert('warning', 'كمبيالة #K-999 متأخرة', 'Financial');
    const all = kv.get<any>(KEYS.ALERTS);
    expect(all[0].مرجع_الجدول).toBe('الكمبيالات_tbl');
    expect(all[0].مرجع_المعرف).toBe('K-999');
  });

  test('parses عقد from message text', () => {
    createAlert('warning', 'عقد #C-42 قارب الانتهاء', 'Expiry');
    const all = kv.get<any>(KEYS.ALERTS);
    expect(all[0].مرجع_الجدول).toBe('العقود_tbl');
    expect(all[0].مرجع_المعرف).toBe('C-42');
  });

  test('falls back to System/batch when no ref found', () => {
    createAlert('info', 'رسالة عامة بدون مرجع', 'DataQuality');
    const all = kv.get<any>(KEYS.ALERTS);
    expect(all[0].مرجع_الجدول).toBe('System');
    expect(all[0].مرجع_المعرف).toBe('batch');
  });

  test('calls onNotify callback', () => {
    const notify = jest.fn();
    createAlert('warning', 'notify test', 'Risk', notify);
    expect(notify).toHaveBeenCalledWith('notify test', 'warning');
  });
});

describe('buildContractAlertContext', () => {
  test('returns empty for empty contractId', () => {
    const ctx = buildContractAlertContext('');
    expect(ctx).toEqual({});
  });

  test('returns ref only when contract not found', () => {
    const ctx = buildContractAlertContext('NONEXISTENT');
    expect(ctx.مرجع_الجدول).toBe('العقود_tbl');
    expect(ctx.مرجع_المعرف).toBe('NONEXISTENT');
  });
});

describe('syncExistingAlertsToNotificationCenter', () => {
  test('runs without error on empty store', () => {
    expect(() => syncExistingAlertsToNotificationCenter()).not.toThrow();
  });

  test('runs without error with unread alerts', () => {
    kv.save(KEYS.ALERTS, [makeAlert('SYNC-1')]);
    buildCache();
    expect(() => syncExistingAlertsToNotificationCenter()).not.toThrow();
  });
});
