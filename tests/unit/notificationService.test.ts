import { notificationService } from '../../src/services/notificationService';
import { notificationCenter } from '@/services/notificationCenter';
import { audioService } from '@/services/audioService';
import { sendDesktopNotification } from '@/services/desktopNotifications';

jest.unmock('../../src/services/notificationService');

jest.mock('../../src/services/notificationCenter', () => ({
  notificationCenter: { add: jest.fn() }
}));
jest.mock('../../src/services/audioService', () => ({
  audioService: { playSound: jest.fn() }
}));
jest.mock('../../src/services/desktopNotifications', () => ({
  sendDesktopNotification: jest.fn()
}));
jest.mock('../../src/services/storage', () => ({
  storage: { setItem: jest.fn() }
}));

describe('Notification Service - Comprehensive Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    notificationService.setEnabled(true);
  });

  // 1. Basic Notification
  test('notify - adds notification to center and plays sound', () => {
    notificationService.notify('Test Message', 'success');
    expect(notificationCenter.add).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Test Message',
      type: 'success'
    }));
    expect(audioService.playSound).toHaveBeenCalledWith('success');
  });

  // 2. Urgent Notification
  test('notify - sends desktop notification if urgent', () => {
    notificationService.notify('Urgent!', 'error');
    expect(sendDesktopNotification).toHaveBeenCalledWith('خطأ', 'Urgent!');
  });

  // 3. Throttling
  test('notify - throttles identical notifications within 10 minutes', () => {
    notificationService.notify('Repeat', 'info');
    notificationService.notify('Repeat', 'info');
    expect(notificationCenter.add).toHaveBeenCalledTimes(1);
  });

  // 4. Specific Business Event - Contract
  test('contractCreated - sends specific success notification', () => {
    notificationService.contractCreated('C1', 'Moe');
    expect(notificationCenter.add).toHaveBeenCalledWith(expect.objectContaining({
      title: 'عقد جديد',
      category: 'contracts'
    }));
  });

  // 5. Specific Business Event - Blacklist
  test('blacklistWarning - sends error notification for blacklist', () => {
    notificationService.blacklistWarning('Bad Tenant');
    expect(notificationCenter.add).toHaveBeenCalledWith(expect.objectContaining({
      category: 'blacklist',
      type: 'error'
    }));
  });

  // 6. Logging
  test('logNotification - persists notifications to localStorage', () => {
    notificationService.notify('Log Me', 'info');
    const logs = JSON.parse(localStorage.getItem('notificationLogs') || '[]');
    expect(logs).toHaveLength(1);
    expect(logs[0].message).toBe('Log Me');
  });

  // 7. Clearing Logs
  test('clearLogs - empties notification history', () => {
    notificationService.notify('Log Me', 'info');
    notificationService.clearLogs();
    expect(notificationService.getLogs()).toHaveLength(0);
  });

  // 8. Handler Callback
  test('setHandler - calls onNotify when handler is attached', () => {
    const handler = { onNotify: jest.fn() };
    notificationService.setHandler(handler);
    notificationService.notify('Toast', 'info');
    expect(handler.onNotify).toHaveBeenCalledWith('Toast', 'info', undefined);
  });

  test('warning, info, and delete shortcuts', () => {
    const spy = jest.spyOn(notificationService, 'notify');
    notificationService.warning('warn msg');
    expect(spy).toHaveBeenCalledWith('warn msg', 'warning', expect.objectContaining({ title: 'تحذير' }));
    
    notificationService.info('info msg');
    expect(spy).toHaveBeenCalledWith('info msg', 'info', expect.objectContaining({ title: 'معلومة' }));
    
    notificationService.delete('del msg');
    expect(spy).toHaveBeenCalledWith('del msg', 'delete', expect.objectContaining({ title: 'حذف' }));
    spy.mockRestore();
  });

  test('custom notification', () => {
    const spy = jest.spyOn(notificationService, 'notify');
    notificationService.custom('custom msg', 'success', 'my-cat', 'my-title');
    expect(spy).toHaveBeenCalledWith('custom msg', 'success', expect.objectContaining({ 
      category: 'my-cat', 
      title: 'my-title' 
    }));
    spy.mockRestore();
  });

  test('business event methods', () => {
    const spy = jest.spyOn(notificationService, 'notify');
    
    notificationService.installmentPaid(500, 'Ahmed');
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('500'), 'success', expect.any(Object));

    notificationService.installmentDue(100, 'Ali', 5);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('5 أيام'), 'warning', expect.any(Object));

    notificationService.installmentDue(100, 'Ali', 0); // No notification for today/overdue via this method
    expect(spy).toHaveBeenCalledTimes(2);

    notificationService.installmentOverdue(100, 'Ali', 10); // Policy: no overdue reminders
    expect(spy).toHaveBeenCalledTimes(2);

    notificationService.contractEnding('C1', 'Zaid', 30);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('30 أيام'), 'warning', expect.objectContaining({ urgent: true }));

    notificationService.maintenanceRequired('P1', 'Plumbing');
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('P1'), 'warning', expect.any(Object));

    notificationService.commissionCalculated(50, 'Sales');
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('50'), 'success', expect.any(Object));

    notificationService.systemAlert('Low space', 'critical');
    expect(spy).toHaveBeenCalledWith('Low space', 'error', expect.objectContaining({ urgent: true }));

    spy.mockRestore();
  });

  test('map cleanup and log shifting', () => {
    // Fill the map
    for (let i = 0; i < 505; i++) {
      notificationService.notify(`Msg ${i}`, 'info', { showNotification: false, sound: false });
    }
    // We can't easily check private map size, but we verify it doesn't crash
    
    // Fill the logs
    notificationService.clearLogs();
    for (let i = 0; i < 105; i++) {
      notificationService.notify(`Log ${i}`, 'info', { showNotification: false, sound: false });
    }
    const logs = notificationService.getLogs();
    expect(logs.length).toBe(100);
    expect(logs[logs.length - 1].message).toBe('Log 104');
  });

  test('setEnabled prevents notifications', () => {
    const spy = jest.spyOn(notificationCenter, 'add');
    notificationService.setEnabled(false);
    notificationService.notify('Should not show');
    expect(spy).not.toHaveBeenCalled();
    notificationService.setEnabled(true);
    spy.mockRestore();
  });
});
