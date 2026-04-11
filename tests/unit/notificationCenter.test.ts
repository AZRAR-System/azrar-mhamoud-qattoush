import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { notificationCenter } from '@/services/notificationCenter';

describe('Notification Center Service', () => {
  beforeEach(() => {
    notificationCenter.clear();
  });

  it('should add a notification and retrieve it', () => {
    const item = notificationCenter.add({
      type: 'info',
      title: 'Test Title',
      message: 'Test Message',
      category: 'General',
    });

    expect(item.id).toBeDefined();
    expect(notificationCenter.getItems()).toHaveLength(1);
    expect(notificationCenter.getUnreadCount()).toBe(1);
  });

  it('should prevent duplicate notifications by ID', () => {
    const id = 'custom-id-123';
    notificationCenter.add({
      id,
      type: 'warning',
      title: 'A',
      message: 'B',
      category: 'C',
    });

    const second = notificationCenter.add({
      id,
      type: 'warning',
      title: 'A',
      message: 'B',
      category: 'C',
    });

    expect(notificationCenter.getItems()).toHaveLength(1);
    expect(second.id).toBe(id);
  });

  it('should mark notifications as read', () => {
    const item = notificationCenter.add({
      type: 'success',
      title: 'Success',
      message: 'Done',
      category: 'Tasks',
    });

    expect(notificationCenter.getUnreadCount()).toBe(1);
    notificationCenter.markRead(item.id);
    expect(notificationCenter.getUnreadCount()).toBe(0);
    expect(notificationCenter.getItems()[0].read).toBe(true);
  });

  it('should notify subscribers on change', () => {
    const listener = jest.fn();
    notificationCenter.subscribe(listener);

    notificationCenter.add({
      type: 'info',
      title: 'Sub test',
      message: 'Msg',
      category: 'D',
    });

    expect(listener).toHaveBeenCalled();
  });

  it('should respect max items limit (50)', () => {
    for (let i = 0; i < 60; i++) {
      notificationCenter.add({
        type: 'info',
        title: `Note ${i}`,
        message: '...',
        category: 'test',
      });
    }
    expect(notificationCenter.getItems()).toHaveLength(50);
  });
});
