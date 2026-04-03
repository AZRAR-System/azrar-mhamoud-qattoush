import { useMemo, useState, useEffect, useCallback } from 'react';
import { notificationCenter } from '@/services/notificationCenter';

/**
 * اشتراك React في مركز الإشعارات (قائمة + أعداد + إجراءات).
 */
export function useNotificationCenter() {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    return notificationCenter.subscribe(() => setTick((t) => t + 1));
  }, []);

  const items = useMemo(() => {
    void tick;
    return notificationCenter.getItems();
  }, [tick]);
  const unreadCount = useMemo(() => items.filter((i) => !i.read).length, [items]);
  const urgentUnreadCount = useMemo(
    () => items.filter((i) => !i.read && i.urgent === true).length,
    [items]
  );

  const markRead = useCallback((id: string) => {
    notificationCenter.markRead(id);
  }, []);

  const markAllRead = useCallback(() => {
    notificationCenter.markAllRead();
  }, []);

  const clear = useCallback(() => {
    notificationCenter.clear();
  }, []);

  return {
    items,
    unreadCount,
    urgentUnreadCount,
    hasUnreadUrgent: urgentUnreadCount > 0,
    markRead,
    markAllRead,
    clear,
    add: notificationCenter.add,
    version: tick,
  };
}
