/**
 * قوالب رسائل قابلة للتعديل في KV (`db_message_templates`) مع احتياطي من القوالب المدمجة.
 */

import { storage } from '@/services/storage';
import { KEYS } from '@/services/db/keys';
import type { NotificationTemplate } from '@/services/notificationTemplateDefaults';
import { getBuiltinNotificationTemplates } from '@/services/notificationTemplateDefaults';

type CustomRow = {
  id: string;
  name: string;
  category: NotificationTemplate['category'];
  body: string;
};

type MessageTemplatesStore = {
  overrides: Record<string, string>;
  customs: CustomRow[];
  /** معرفات القوالب المدمجة التي عطّلها المستخدم (تعادل toggleEnabled السابق). */
  disabledBuiltins?: string[];
};

function emptyStore(): MessageTemplatesStore {
  return { overrides: {}, customs: [], disabledBuiltins: [] };
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
  const disabledRaw = o.disabledBuiltins;
  const disabledBuiltins = Array.isArray(disabledRaw)
    ? disabledRaw.filter((x): x is string => typeof x === 'string')
    : [];
  return { overrides, customs, disabledBuiltins };
}

const LEGACY_NOTIFICATION_TEMPLATES_KEY = 'notification_templates';
const LEGACY_NOTIFICATION_MIGRATION_FLAG = 'azrar_legacy_notification_templates_migrated_v1';

let legacyNotificationTemplatesMigrationCompleted = false;

function loadStoreSkipMigration(): MessageTemplatesStore {
  try {
    const raw = localStorage.getItem(KEYS.MESSAGE_TEMPLATES);
    if (!raw || raw.trim() === '') return emptyStore();
    return normalizeStore(JSON.parse(raw));
  } catch {
    return emptyStore();
  }
}

const VALID_CATEGORIES: readonly NotificationTemplate['category'][] = [
  'reminder',
  'due',
  'late',
  'warning',
  'legal',
];

function normalizeLegacyCategory(raw: unknown): NotificationTemplate['category'] {
  const s = String(raw || '').trim();
  return (VALID_CATEGORIES as readonly string[]).includes(s)
    ? (s as NotificationTemplate['category'])
    : 'reminder';
}

/**
 * ترحيل لمرة واحدة من `notification_templates` (المدير القديم) إلى `db_message_templates`.
 * يُنفَّذ عند أول قراءة للمخزن ثم يُزال المفتاح القديم.
 */
function migrateLegacyNotificationTemplatesOnce(): void {
  if (legacyNotificationTemplatesMigrationCompleted) return;
  if (typeof localStorage === 'undefined') {
    legacyNotificationTemplatesMigrationCompleted = true;
    return;
  }
  try {
    if (localStorage.getItem(LEGACY_NOTIFICATION_MIGRATION_FLAG) === '1') return;

    const legacyRaw = localStorage.getItem(LEGACY_NOTIFICATION_TEMPLATES_KEY);
    if (!legacyRaw || legacyRaw.trim() === '') {
      localStorage.setItem(LEGACY_NOTIFICATION_MIGRATION_FLAG, '1');
      return;
    }

    let legacy: unknown;
    try {
      legacy = JSON.parse(legacyRaw);
    } catch {
      localStorage.setItem(LEGACY_NOTIFICATION_MIGRATION_FLAG, '1');
      return;
    }
    if (!Array.isArray(legacy)) {
      localStorage.setItem(LEGACY_NOTIFICATION_MIGRATION_FLAG, '1');
      return;
    }

    const store = loadStoreSkipMigration();
    const disabled = new Set(store.disabledBuiltins || []);
    let changed = false;

    for (const item of legacy) {
      if (!item || typeof item !== 'object') continue;
      const r = item as Record<string, unknown>;
      const id = typeof r.id === 'string' ? r.id.trim() : '';
      if (!id) continue;
      const body = typeof r.body === 'string' ? r.body : '';
      const enabled = r.enabled !== false;
      const bi = builtinById(id);

      if (bi) {
        const defaultBody = bi.body;
        if (body.trim() !== '' && body !== defaultBody) {
          store.overrides[id] = body;
          changed = true;
        }
        if (!enabled) {
          disabled.add(id);
          changed = true;
        }
      } else {
        const name = typeof r.name === 'string' && r.name.trim() ? r.name.trim() : 'قالب (مُرحَّل)';
        const category = normalizeLegacyCategory(r.category);
        const row: CustomRow = { id, name, category, body };
        const idx = store.customs.findIndex((c) => c.id === id);
        if (idx >= 0) {
          store.customs[idx] = row;
        } else {
          store.customs.push(row);
        }
        changed = true;
      }
    }

    const nextDisabledSorted = Array.from(disabled).sort();
    const prevDisabledSorted = [...(store.disabledBuiltins || [])].sort();
    if (nextDisabledSorted.join('\0') !== prevDisabledSorted.join('\0')) {
      store.disabledBuiltins = Array.from(disabled);
      changed = true;
    }

    if (changed) {
      persist(store);
    }

    try {
      localStorage.removeItem(LEGACY_NOTIFICATION_TEMPLATES_KEY);
      void storage.removeItem(LEGACY_NOTIFICATION_TEMPLATES_KEY);
    } catch {
      // ignore
    }
    localStorage.setItem(LEGACY_NOTIFICATION_MIGRATION_FLAG, '1');
  } catch {
    try {
      localStorage.setItem(LEGACY_NOTIFICATION_MIGRATION_FLAG, '1');
    } catch {
      // ignore
    }
  } finally {
    legacyNotificationTemplatesMigrationCompleted = true;
  }
}

function loadStore(): MessageTemplatesStore {
  migrateLegacyNotificationTemplatesOnce();
  return loadStoreSkipMigration();
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

/** هل القالب المدمج مفعّل (غير معطّل في الإعدادات). القوالب المخصصة دائماً مفعّلة إن وُجدت. */
export function isTemplateEnabled(id: string): boolean {
  const store = loadStore();
  if (store.customs.some((c) => c.id === id)) return true;
  if (!builtinById(id)) return true;
  return !(store.disabledBuiltins || []).includes(id);
}

export function setBuiltinTemplateEnabled(id: string, enabled: boolean): void {
  if (!builtinById(id)) return;
  const store = loadStore();
  const next = new Set(store.disabledBuiltins || []);
  if (enabled) next.delete(id);
  else next.add(id);
  store.disabledBuiltins = Array.from(next);
  persist(store);
}

/** إعادة كل قوالب الرسائل إلى المدمجة (يُزال المفتاح القديم notification_templates منفصلاً إن وُجد). */
export function resetAllMessageTemplatesStore(): void {
  try {
    localStorage.removeItem('notification_templates');
    void storage.removeItem('notification_templates');
  } catch {
    // ignore
  }
  persist(emptyStore());
}

export function putCustomTemplate(row: CustomRow): CustomRow {
  const store = loadStore();
  const idx = store.customs.findIndex((c) => c.id === row.id);
  if (idx >= 0) store.customs[idx] = row;
  else store.customs.push(row);
  persist(store);
  return row;
}

export function deleteCustomTemplateById(id: string): boolean {
  const store = loadStore();
  const idx = store.customs.findIndex((c) => c.id === id);
  if (idx === -1) return false;
  store.customs.splice(idx, 1);
  persist(store);
  return true;
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
