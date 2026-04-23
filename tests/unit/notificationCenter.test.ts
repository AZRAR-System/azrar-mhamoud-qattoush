import { notificationCenter, NOTIFICATION_CENTER_STORAGE_KEY } from '@/services/notificationCenter';

describe('Notification Center - State Management Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    notificationCenter.clear();
    jest.clearAllMocks();
  });

  test('add - adds a new notification and persists it', () => {
    const item = notificationCenter.add({
      type: 'info',
      title: 'Test Title',
      message: 'Test Message',
      category: 'system',
      urgent: true
    });

    expect(item.id).toBeDefined();
    expect(item.read).toBe(false);
    expect(notificationCenter.getItems()).toHaveLength(1);
    expect(notificationCenter.getItems()[0].title).toBe('Test Title');
  });

  test('add - prevents duplicate IDs', () => {
    notificationCenter.add({ id: 'fixed-1', type: 'info', title: 'T1', message: 'M1', category: 'c' });
    notificationCenter.add({ id: 'fixed-1', type: 'info', title: 'T1-dup', message: 'M1', category: 'c' });

    const items = notificationCenter.getItems();
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('T1');
  });

  test('getUnreadCount - returns correct count', () => {
    notificationCenter.add({ type: 'info', title: 'T1', message: 'M1', category: 'c', read: false });
    notificationCenter.add({ type: 'info', title: 'T2', message: 'M2', category: 'c', read: true });
    expect(notificationCenter.getUnreadCount()).toBe(1);
  });

  test('getUrgentUnreadCount - identifies urgent notifications', () => {
    notificationCenter.add({ type: 'warning', title: 'U1', message: 'M1', category: 'c', urgent: true });
    notificationCenter.add({ type: 'info', title: 'N1', message: 'M1', category: 'c', urgent: false });
    expect(notificationCenter.getUrgentUnreadCount()).toBe(1);
    expect(notificationCenter.hasUnreadUrgent()).toBe(true);
  });

  test('markRead - updates specific notification status', () => {
    const item = notificationCenter.add({ type: 'info', title: 'T1', message: 'M1', category: 'c' });
    notificationCenter.markRead(item.id);
    expect(notificationCenter.getUnreadCount()).toBe(0);
    expect(notificationCenter.getItems()[0].read).toBe(true);
  });

  test('markAllRead - clears all unread indicators', () => {
    notificationCenter.add({ type: 'info', title: 'T1', message: 'M1', category: 'c' });
    notificationCenter.add({ type: 'info', title: 'T2', message: 'M2', category: 'c' });
    notificationCenter.markAllRead();
    expect(notificationCenter.getUnreadCount()).toBe(0);
  });

  test('getByCategory - filters items correctly', () => {
    notificationCenter.add({ type: 'info', title: 'C1', message: 'M1', category: 'contracts' });
    notificationCenter.add({ type: 'info', title: 'F1', message: 'M1', category: 'Financial' });
    
    expect(notificationCenter.getByCategory('contracts')).toHaveLength(1);
    expect(notificationCenter.getByCategory('Financial')).toHaveLength(1);
  });

  test('subscribe - notifies listeners on changes', () => {
    const listener = jest.fn();
    const unsubscribe = notificationCenter.subscribe(listener);
    
    notificationCenter.add({ type: 'info', title: 'T', message: 'M', category: 'c' });
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    notificationCenter.add({ type: 'info', title: 'T2', message: 'M', category: 'c' });
    expect(listener).toHaveBeenCalledTimes(1); // Not called after unsubscribe
  });

  test('enforces MAX_ITEMS limit', () => {
    for (let i = 0; i < 60; i++) {
      notificationCenter.add({ type: 'info', title: `T${i}`, message: 'M', category: 'c' });
    }
    expect(notificationCenter.getItems()).toHaveLength(50);
  });

  test('handles corrupted localStorage data', () => {
    localStorage.setItem(NOTIFICATION_CENTER_STORAGE_KEY, 'invalid-json');
    expect(notificationCenter.getItems()).toHaveLength(0);
    
    localStorage.setItem(NOTIFICATION_CENTER_STORAGE_KEY, JSON.stringify({ not: 'an array' }));
    expect(notificationCenter.getItems()).toHaveLength(0);
  });
});
