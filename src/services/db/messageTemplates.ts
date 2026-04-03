/**
 * قوالب رسائل قابلة للتعديل في KV (`db_message_templates`) مع احتياطي من القوالب المدمجة.
 */

import { storage } from '@/services/storage';
import { KEYS } from '@/services/db/keys';
import type { NotificationTemplate } from '@/services/notificationTemplates';
import { getBuiltinNotificationTemplates } from '@/services/notificationTemplates';

type CustomRow = {
  id: string;
  name: string;
  category: NotificationTemplate['category'];
  body: string;
};

type MessageTemplatesStore = {
  overrides: Record<string, string>;
  customs: CustomRow[];
};

function emptyStore(): MessageTemplatesStore {
  return { overrides: {}, customs: [] };
}

function normalizeStore(raw: unknown): MessageTemplatesStore {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return emptyStore();
  const o = raw as Record<string, unknown>;
  const overrides =
    o.overrides && typeof o.overrides === 'object' && !Array.isArray(o.overrides)
      ? (o.overrides as Record<string, string>)
      : {};
  const customsRaw = o.customs;
  const customs: CustomRow[] = Array.isArray(customsRaw)
    ? customsRaw.filter((x): x is CustomRow => {
        if (!x || typeof x !== 'object') return false;
        const r = x as Record<string, unknown>;
        return (
          typeof r.id === 'string' &&
          typeof r.name === 'string' &&
          typeof r.category === 'string' &&
          typeof r.body === 'string'
        );
      })
    : [];
  return { overrides, customs };
}

function loadStore(): MessageTemplatesStore {
  try {
    const raw = localStorage.getItem(KEYS.MESSAGE_TEMPLATES);
    if (!raw || raw.trim() === '') return emptyStore();
    return normalizeStore(JSON.parse(raw));
  } catch {
    return emptyStore();
  }
}

function persist(store: MessageTemplatesStore): void {
  try {
    const serialized = JSON.stringify(store);
    localStorage.setItem(KEYS.MESSAGE_TEMPLATES, serialized);
    void storage.setItem(KEYS.MESSAGE_TEMPLATES, serialized);
    window.dispatchEvent(new CustomEvent('azrar:message-templates-changed'));
  } catch {
    // ignore
  }
}

function builtinById(id: string): NotificationTemplate | undefined {
  return getBuiltinNotificationTemplates().find((t) => t.id === id);
}

export type MessageTemplateListEntry = {
  id: string;
  name: string;
  category: NotificationTemplate['category'];
  body: string;
  isCustom: boolean;
};

/** نص القالب الفعلي للإرسال (مخصص أو مدمج) */
export function getTemplate(type: string): string {
  const store = loadStore();
  const custom = store.customs.find((c) => c.id === type);
  if (custom) return custom.body;
  if (Object.prototype.hasOwnProperty.call(store.overrides, type)) {
    return store.overrides[type] ?? '';
  }
  return builtinById(type)?.body ?? '';
}

export function saveTemplate(type: string, body: string): void {
  const store = loadStore();
  if (builtinById(type)) {
    store.overrides[type] = body;
    persist(store);
    return;
  }
  const idx = store.customs.findIndex((c) => c.id === type);
  if (idx >= 0) {
    store.customs[idx] = { ...store.customs[idx], body };
    persist(store);
  }
}

export function resetTemplate(type: string): void {
  const store = loadStore();
  if (builtinById(type)) {
    delete store.overrides[type];
    persist(store);
    return;
  }
  store.customs = store.customs.filter((c) => c.id !== type);
  persist(store);
}

export function getAllTemplates(): MessageTemplateListEntry[] {
  const store = loadStore();
  const builtins = getBuiltinNotificationTemplates();
  const builtRows: MessageTemplateListEntry[] = builtins.map((t) => ({
    id: t.id,
    name: t.name,
    category: t.category,
    body: getTemplate(t.id),
    isCustom: false,
  }));
  const customRows: MessageTemplateListEntry[] = store.customs.map((c) => ({
    id: c.id,
    name: c.name,
    category: c.category,
    body: c.body,
    isCustom: true,
  }));
  return [...builtRows, ...customRows];
}

export function addCustomTemplate(entry: {
  name: string;
  category: NotificationTemplate['category'];
  body: string;
}): CustomRow {
  const store = loadStore();
  const id = `custom_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
  const row: CustomRow = {
    id,
    name: entry.name.trim() || 'قالب مخصص',
    category: entry.category,
    body: entry.body,
  };
  store.customs.push(row);
  persist(store);
  return row;
}
