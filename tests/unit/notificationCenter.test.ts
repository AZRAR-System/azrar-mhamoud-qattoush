import { notificationCenter } from '@/services/notificationCenter';

describe('Notification Center Service', () => {
  beforeEach(() => {
    notificationCenter.clear();
  });

  it('add: should add a notification to the list', () => {
    notificationCenter.add({
      id: 'N1',
      title: 'Test',
      message: 'Hello',
      type: 'info',
      category: 'general'
    });

    const items = notificationCenter.getItems();
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('Test');
  });

  it('markAsRead: should remove notif from active list (or mark read)', () => {
    notificationCenter.add({ id: 'N1', title: 'Test', message: 'H', type: 'info', category: 'general' });
    notificationCenter.markRead('N1');
    
    const item = notificationCenter.getItems().find(n => n.id === 'N1');
    expect(item?.read).toBe(true);
  });

  it('clear: should empty the center', () => {
    notificationCenter.add({ id: 'N1', title: 'T', message: 'H', type: 'info' });
    notificationCenter.clear();
    expect(notificationCenter.getItems()).toHaveLength(0);
  });
});
