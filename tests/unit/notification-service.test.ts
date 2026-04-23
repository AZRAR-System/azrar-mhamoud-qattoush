import { notificationService } from '@/services/notificationService';
import { notificationCenter } from '@/services/notificationCenter';
import { audioService } from '@/services/audioService';
import { sendDesktopNotification } from '@/services/desktopNotifications';

jest.unmock('@/services/notificationService');

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
});
