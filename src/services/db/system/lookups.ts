import { get, save } from '../kv';
import { KEYS } from '../keys';
import { SystemLookup, LookupCategory, DbResult } from '@/types';
import { dbFail, dbOk } from '@/services/localDbStorage';
import { logOperationInternal } from '../operations/logger';
import { lookupKeyFor, normKeySimple } from '../lookupKeys';

const ok = dbOk;
const fail = dbFail;

/**
 * Lookup management service
 */

export const getLookupsByCategory = (cat: string): SystemLookup[] => {
  const targetCat = String(cat || '').trim();
  if (!targetCat) return [];
  const all = get<SystemLookup>(KEYS.LOOKUPS);
  return all.filter((l) => String(l.category || '').trim() === targetCat);
};

export const addLookupItem = (category: string, label: string): DbResult<null> => {
  const cat = String(category || '').trim();
  const lab = String(label || '').trim();
  if (!cat || !lab) return fail('البيانات ناقصة');

  const all = get<SystemLookup>(KEYS.LOOKUPS);
  const key = lookupKeyFor(cat, lab);
  if (all.some((l) => l.category === cat && l.key === key)) return fail('العنصر موجود مسبقاً');

  save(KEYS.LOOKUPS, [
    ...all,
    {
      id: `LK-${Math.random().toString(36).slice(2, 11)}`,
      category: cat,
      label: lab,
      key,
    },
  ]);
  logOperationInternal('Admin', 'إضافة عنصر', 'Lookups', cat, `إضافة "${lab}" إلى قائمة ${cat}`);
  return ok();
};

export const deleteLookupItem = (id: string): DbResult<null> => {
  const all = get<SystemLookup>(KEYS.LOOKUPS);
  save(KEYS.LOOKUPS, all.filter((l) => l.id !== id));
  return ok();
};

export const updateLookupItem = (id: string, label: string): DbResult<null> => {
  const lab = String(label || '').trim();
  if (!lab) return fail('الاسم مطلوب');

  const all = get<SystemLookup>(KEYS.LOOKUPS);
  const idx = all.findIndex((l) => l.id === id);
  if (idx === -1) return fail('العنصر غير موجود');

  const cat = all[idx].category;
  const oldLabel = all[idx].label;
  all[idx].label = lab;
  all[idx].key = lookupKeyFor(cat, lab);
  save(KEYS.LOOKUPS, all);
  logOperationInternal('Admin', 'تعديل عنصر', 'Lookups', id, `تعديل من "${oldLabel}" إلى "${lab}"`);
  return ok();
};

export const getLookupCategories = (): LookupCategory[] => {
  const raw = get<LookupCategory>(KEYS.LOOKUP_CATEGORIES);
  const byKey = new Map<string, LookupCategory>();
  const out: LookupCategory[] = [];

  for (const c of raw) {
    const id = String(c?.id || '').trim();
    const name = String(c?.name || id).trim();
    const label = String(c?.label || name).trim();
    const key = String(c?.key || name || id).trim();
    if (!name || !label) continue;

    const normalized: LookupCategory = {
      ...c,
      id: id || name,
      name,
      label,
      key,
    };

    const dkey = normKeySimple(key) || normKeySimple(name) || normKeySimple(id);
    if (!dkey) continue;

    const prev = byKey.get(dkey);
    if (!prev) {
      byKey.set(dkey, normalized);
      out.push(normalized);
      continue;
    }

    const prevSystem = prev.isSystem === true;
    const curSystem = normalized.isSystem === true;
    if (!prevSystem && curSystem) {
      byKey.set(dkey, normalized);
      const idx = out.findIndex((x) => x === prev);
      if (idx >= 0) out[idx] = normalized;
    }
  }

  if (out.length !== raw.length) {
    save(KEYS.LOOKUP_CATEGORIES, out);
  }

  return out;
};

export const addLookupCategory = (name: string, label: string): DbResult<null> => {
  const all = get<LookupCategory>(KEYS.LOOKUP_CATEGORIES);
  if (all.some((c) => c.name === name)) return fail('المعرف البرمجي موجود مسبقاً');
  save(KEYS.LOOKUP_CATEGORIES, [
    ...all,
    { id: name, name, key: name, label, isSystem: false },
  ]);
  logOperationInternal(
    'Admin',
    'إضافة فئة',
    'LookupCategories',
    name,
    `إنشاء جدول بيانات جديد: ${label}`
  );
  return ok();
};

export const updateLookupCategory = (id: string, data: Partial<LookupCategory>): DbResult<null> => {
  const all = get<LookupCategory>(KEYS.LOOKUP_CATEGORIES);
  const idx = all.findIndex((c) => c.id === id);
  if (idx > -1) {
    const oldLabel = all[idx].label;
    all[idx] = { ...all[idx], ...data };
    save(KEYS.LOOKUP_CATEGORIES, all);
    logOperationInternal(
      'Admin',
      'تعديل فئة',
      'LookupCategories',
      id,
      `تحديث اسم الجدول من "${oldLabel}" إلى "${data.label}"`
    );
    return ok();
  }
  return fail('الجدول غير موجود');
};

export const deleteLookupCategory = (id: string): DbResult<null> => {
  const all = get<LookupCategory>(KEYS.LOOKUP_CATEGORIES).filter((c) => c.id !== id);
  save(KEYS.LOOKUP_CATEGORIES, all);
  const lookups = get<SystemLookup>(KEYS.LOOKUPS).filter((l) => l.category !== id);
  save(KEYS.LOOKUPS, lookups);
  logOperationInternal(
    'Admin',
    'حذف فئة',
    'LookupCategories',
    id,
    `حذف جدول البيانات "${id}" وكافة عناصره`
  );
  return ok();
};

export const importLookups = (category: string, items: string[]) => {
  const cat = String(category || '').trim();
  if (!cat) return;
  const all = get<SystemLookup>(KEYS.LOOKUPS);
  const seen = new Set<string>();

  const incoming = (Array.isArray(items) ? items : [])
    .map((x) => String(x || '').trim())
    .filter(Boolean)
    .filter((lab) => {
      const k = normKeySimple(lab);
      if (!k) return false;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

  const existingKeys = new Set(
    all
      .filter((x) => String(x.category || '').trim() === cat)
      .map((x) => normKeySimple(x.key) || normKeySimple(x.label))
      .filter(Boolean)
  );

  const newItems = incoming
    .map((lab) => {
      const key = lookupKeyFor(cat, lab);
      const dkey = normKeySimple(key) || normKeySimple(lab);
      if (!dkey || existingKeys.has(dkey)) return null;
      existingKeys.add(dkey);
      return {
        id: `LK-${Math.random().toString(36).slice(2, 11)}`,
        category: cat,
        label: lab,
        key,
      };
    })
    .filter((x): x is NonNullable<typeof x> => !!x);

  if (newItems.length === 0) return;
  save(KEYS.LOOKUPS, [...all, ...newItems]);
  logOperationInternal('Admin', 'استيراد', 'Lookups', category, `استيراد ${items.length} عنصر`);
};
