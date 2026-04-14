/**
 * مركز الإشعارات — قائمة دائمة (آخر 50) مع اشتراك للواجهة.
 */

export const NOTIFICATION_CENTER_STORAGE_KEY = 'azrar_notification_center_v1';
const MAX_ITEMS = 50;

export type NotificationCenterType = 'success' | 'error' | 'warning' | 'info' | 'delete';

export type NotificationCategory = 
  | 'contracts' 
  | 'installments' 
  | 'maintenance' 
  | 'system' 
  | 'info'
  | 'Financial'
  | 'payment'
  | 'overdue'
  | 'reminders'
  | 'scheduled_financial_report'
  | 'whatsapp_auto'
  | 'payments'
  | 'collection';

export interface NotificationCenterItem {
  id: string;
  type: NotificationCenterType;
  title: string;
  message: string;
  /** Unix ms */
  timestamp: number;
  read: boolean;
  category: NotificationCategory | string;
  /** للتنقل: معرّف كيان اختياري (عقد، كمبيالة، إلخ) */
  entityId?: string;
  /** عاجل — للتصفية ونبض الجرس */
  urgent?: boolean;
}

export type NotificationCenterAddInput = Omit<NotificationCenterItem, 'id' | 'timestamp' | 'read'> & {
  id?: string;
  timestamp?: number;
  read?: boolean;
};

const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      // ignore
    }
  });
}

function loadRaw(): unknown {
  try {
    const raw = localStorage.getItem(NOTIFICATION_CENTER_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function isItem(x: unknown): x is NotificationCenterItem {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    typeof o.title === 'string' &&
    typeof o.message === 'string' &&
    typeof o.timestamp === 'number' &&
    typeof o.read === 'boolean' &&
    typeof o.category === 'string' &&
    ['success', 'error', 'warning', 'info', 'delete'].includes(String(o.type))
  );
}

function normalizeItems(raw: unknown): NotificationCenterItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isItem).slice(0, MAX_ITEMS);
}

function persist(items: NotificationCenterItem[]) {
  try {
    localStorage.setItem(NOTIFICATION_CENTER_STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
  } catch {
    // ignore quota / private mode
  }
  notifyListeners();
}

function getItems(): NotificationCenterItem[] {
  return normalizeItems(loadRaw());
}

export const notificationCenter = {
  getItems,
  
  getByCategory(category: NotificationCategory | string): NotificationCenterItem[] {
    return getItems().filter((n) => n.category === category);
  },

  getUnreadCount(): number {
    return getItems().filter((i) => !i.read).length;
  },

  getUrgentUnreadCount(): number {
    return getItems().filter((i) => !i.read && i.urgent === true).length;
  },

  hasUnreadUrgent(): boolean {
    return getItems().some((i) => !i.read && i.urgent === true);
  },

  add(input: NotificationCenterAddInput): NotificationCenterItem {
    const now = Date.now();
    const id = input.id ?? `nc-${now}-${Math.random().toString(36).slice(2, 11)}`;
    
    // منع التكرار: اذا التنبيه موجود بالفعل نرجعه بدون اضافته مرة اخرى
    const existing = getItems();
    const exists = existing.some(i => i.id === id);
    
    if (exists) {
      const found = existing.find(i => i.id === id);
      // we already checked that it exists above so this is safe
      return found as NotificationCenterItem;
    }

    const item: NotificationCenterItem = {
      id,
      type: input.type,
      title: input.title,
      message: input.message,
      timestamp: input.timestamp ?? now,
      read: input.read ?? false,
      category: input.category,
      entityId: input.entityId,
      urgent: input.urgent,
    };

    const next = [item, ...existing].slice(0, MAX_ITEMS);
    persist(next);
    return item;
  },

  markRead(id: string): void {
    const items = getItems().map((i) => (i.id === id ? { ...i, read: true } : i));
    persist(items);
  },

  markAllRead(): void {
    const items = getItems().map((i) => ({ ...i, read: true }));
    persist(items);
  },

  clear(): void {
    persist([]);
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
