/**
 * People domain: persons, roles, blacklist, contacts book, WhatsApp link helpers.
 */

import {
  الأشخاص_tbl,
  شخص_دور_tbl,
  العقارات_tbl,
  العقود_tbl,
  الكمبيالات_tbl,
  BlacklistRecord,
  PersonDetailsResult,
  DbResult,
} from '@/types';
import { validateNewPerson } from '@/services/dataValidation';
import { storage } from '@/services/storage';
import { isBeforeTodayDateOnly } from '@/utils/dateOnly';
import { getInstallmentPaidAndRemaining } from '@/utils/installments';
import { dbFail, dbOk } from '@/services/localDbStorage';
import { buildWhatsAppLink } from '@/utils/whatsapp';
import { getDefaultWhatsAppCountryCodeSync } from '@/services/geoSettings';
import { get, save } from './kv';
import { KEYS } from './keys';

const ok = dbOk;
const fail = dbFail;

const requestDomainMigrate = (opts?: { retries?: number; delayMs?: number }) => {
  try {
    if (!storage.isDesktop()) return;
    const db = typeof window !== 'undefined' ? window.desktopDb : undefined;
    if (typeof db?.domainMigrate !== 'function') return;

    const retries = opts?.retries ?? 3;
    const delayMs = opts?.delayMs ?? 500;

    (async () => {
      for (let i = 1; i <= retries; i++) {
        try {
          console.warn(`[db/people] domainMigrate attempt ${i}/${retries}`);
          await db.domainMigrate();
          console.warn('[db/people] domainMigrate succeeded');
          return;
        } catch (err) {
          console.warn(`[db/people] domainMigrate failed attempt ${i}/${retries}`, err);
          if (i < retries) await new Promise((r) => setTimeout(r, delayMs));
          else console.error('[db/people] domainMigrate failed after all attempts', err);
        }
      }
    })();
  } catch (e) {
    console.error('[db/people] requestDomainMigrate unexpected error', e);
  }
};

export const getPeople = (): الأشخاص_tbl[] => get<الأشخاص_tbl>(KEYS.PEOPLE);

export const getPersonById = (id: string): الأشخاص_tbl | undefined =>
  get<الأشخاص_tbl>(KEYS.PEOPLE).find((p) => p.رقم_الشخص === id);

export const getPersonRoles = (id: string): string[] =>
  get<شخص_دور_tbl>(KEYS.ROLES)
    .filter((r) => r.رقم_الشخص === id)
    .map((r) => r.الدور);

export const updatePersonRoles = (id: string, roles: string[]) => {
  const all = get<شخص_دور_tbl>(KEYS.ROLES).filter((r) => r.رقم_الشخص !== id);
  roles.forEach((role) => all.push({ رقم_الشخص: id, الدور: role }));
  save(KEYS.ROLES, all);
};

export const addPerson = (
  data: Omit<الأشخاص_tbl, 'رقم_الشخص'>,
  roles: string[]
): DbResult<الأشخاص_tbl> => {
  const validation = validateNewPerson(data);
  if (!validation.isValid) {
    return fail(validation.errors.join(', '));
  }

  const id = `P-${Date.now()}`;
  const all = get<الأشخاص_tbl>(KEYS.PEOPLE);
  const newPerson: الأشخاص_tbl = { ...data, رقم_الشخص: id };
  save(KEYS.PEOPLE, [...all, newPerson]);

  const allRoles = get<شخص_دور_tbl>(KEYS.ROLES);
  roles.forEach((role) => allRoles.push({ رقم_الشخص: id, الدور: role }));
  save(KEYS.ROLES, allRoles);

  requestDomainMigrate();
  return ok(newPerson);
};

export const updatePerson = (id: string, data: Partial<الأشخاص_tbl>): DbResult<الأشخاص_tbl> => {
  const all = get<الأشخاص_tbl>(KEYS.PEOPLE);
  const idx = all.findIndex((p) => p.رقم_الشخص === id);
  if (idx > -1) {
    all[idx] = { ...all[idx], ...data };
    save(KEYS.PEOPLE, all);
    requestDomainMigrate();
    return ok(all[idx]);
  }
  return fail('الشخص غير موجود');
};

export const deletePerson = (id: string): DbResult<null> => {
  const props = get<العقارات_tbl>(KEYS.PROPERTIES).filter((p) => p.رقم_المالك === id);
  if (props.length > 0) return fail('لا يمكن حذف المالك لوجود عقارات مرتبطة به');
  const contracts = get<العقود_tbl>(KEYS.CONTRACTS).filter((c) => c.رقم_المستاجر === id);
  if (contracts.length > 0) return fail('لا يمكن حذف الشخص لوجود عقود مرتبطة به');

  const all = get<الأشخاص_tbl>(KEYS.PEOPLE).filter((p) => p.رقم_الشخص !== id);
  save(KEYS.PEOPLE, all);

  const roles = get<شخص_دور_tbl>(KEYS.ROLES).filter((r) => r.رقم_الشخص !== id);
  save(KEYS.ROLES, roles);

  requestDomainMigrate();
  return ok();
};

export const getPersonDetails = (id: string): PersonDetailsResult | null => {
  const p = get<الأشخاص_tbl>(KEYS.PEOPLE).find((x) => x.رقم_الشخص === id);
  if (!p) return null;
  const roles = get<شخص_دور_tbl>(KEYS.ROLES)
    .filter((r) => r.رقم_الشخص === id)
    .map((r) => r.الدور);
  const props = get<العقارات_tbl>(KEYS.PROPERTIES).filter((pr) => pr.رقم_المالك === id);
  const contracts = get<العقود_tbl>(KEYS.CONTRACTS).filter((c) => c.رقم_المستاجر === id);
  const blacklist = get<BlacklistRecord>(KEYS.BLACKLIST).find(
    (b) => b.personId === id && b.isActive
  );

  const installments = get<الكمبيالات_tbl>(KEYS.INSTALLMENTS).filter((i) =>
    contracts.some((c) => c.رقم_العقد === i.رقم_العقد)
  );
  const totalInst = installments.length;
  const lateInst = installments.filter((i) => {
    if (String(i.حالة_الكمبيالة ?? '').trim() === 'ملغي') return false;
    const { remaining } = getInstallmentPaidAndRemaining(i);
    return remaining > 0 && isBeforeTodayDateOnly(i.تاريخ_استحقاق);
  }).length;

  return {
    person: p,
    roles,
    ownedProperties: props,
    contracts,
    blacklistRecord: blacklist,
    stats: {
      totalInstallments: totalInst,
      lateInstallments: lateInst,
      commitmentRatio: totalInst ? Math.round(((totalInst - lateInst) / totalInst) * 100) : 100,
    },
  };
};

export const updateTenantRatingImpl = (
  tenantId: string,
  paymentType: 'full' | 'partial' | 'late'
): void => {
  const people = get<الأشخاص_tbl>(KEYS.PEOPLE);
  const idx = people.findIndex((p) => p.رقم_الشخص === tenantId);
  if (idx === -1) return;

  const person = people[idx];

  if (!person.تصنيف_السلوك) {
    person.تصنيف_السلوك = { type: 'جيد', points: 100, history: [] };
  }

  let pointsChange = 0;
  if (paymentType === 'full') {
    pointsChange = 5;
    person.تصنيف_السلوك.points = Math.min(100, person.تصنيف_السلوك.points + 5);
  } else if (paymentType === 'partial') {
    pointsChange = -10;
    person.تصنيف_السلوك.points = Math.max(0, person.تصنيف_السلوك.points - 10);
  } else if (paymentType === 'late') {
    pointsChange = -20;
    person.تصنيف_السلوك.points = Math.max(0, person.تصنيف_السلوك.points - 20);
  }

  const pts = person.تصنيف_السلوك.points;
  if (pts >= 90) person.تصنيف_السلوك.type = 'ممتاز';
  else if (pts >= 70) person.تصنيف_السلوك.type = 'جيد';
  else if (pts >= 50) person.تصنيف_السلوك.type = 'مقبول';
  else person.تصنيف_السلوك.type = 'سيء';

  person.تصنيف_السلوك.history.unshift({
    date: new Date().toISOString(),
    paymentType,
    pointsChange,
    points: person.تصنيف_السلوك.points,
  });

  save(KEYS.PEOPLE, people);
};

export const getPersonBlacklistStatus = (id: string): BlacklistRecord | undefined =>
  get<BlacklistRecord>(KEYS.BLACKLIST).find((b) => b.personId === id && b.isActive);

export const getBlacklist = (): BlacklistRecord[] => get<BlacklistRecord>(KEYS.BLACKLIST);

export const getBlacklistRecord = (id: string): BlacklistRecord | undefined =>
  get<BlacklistRecord>(KEYS.BLACKLIST).find((b) => b.id === id);

export const addToBlacklist = (
  record: Omit<BlacklistRecord, 'id' | 'dateAdded' | 'addedBy' | 'isActive'>
) => {
  const all = get<BlacklistRecord>(KEYS.BLACKLIST);
  all.forEach((b) => {
    if (b.personId === record.personId) b.isActive = false;
  });
  save(KEYS.BLACKLIST, [
    ...all,
    {
      ...record,
      id: `BL-${Date.now()}`,
      dateAdded: new Date().toISOString(),
      addedBy: 'Admin',
      isActive: true,
    },
  ]);
};

export const updateBlacklistRecord = (
  id: string,
  data: Partial<BlacklistRecord>
): DbResult<null> => {
  const all = get<BlacklistRecord>(KEYS.BLACKLIST);
  const idx = all.findIndex((b) => b.id === id);
  if (idx > -1) {
    all[idx] = { ...all[idx], ...data };
    save(KEYS.BLACKLIST, all);
    return ok();
  }
  return fail('السجل غير موجود');
};

export const removeFromBlacklist = (id: string) => {
  const all = get<BlacklistRecord>(KEYS.BLACKLIST);
  if (id.startsWith('BL-')) {
    const idx = all.findIndex((b) => b.id === id);
    if (idx > -1) {
      all[idx].isActive = false;
      save(KEYS.BLACKLIST, all);
    }
  } else {
    const idx = all.findIndex((b) => b.personId === id && b.isActive);
    if (idx > -1) {
      all[idx].isActive = false;
      save(KEYS.BLACKLIST, all);
    }
  }
};

export const generateWhatsAppLink = (phone: string, msg: string): string =>
  buildWhatsAppLink(msg, phone, { defaultCountryCode: getDefaultWhatsAppCountryCodeSync() });

// --- Contacts book (local phonebook; optional overlap with People) ---

export type ContactBookEntry = {
  id: string;
  name: string;
  phone: string;
  extraPhone?: string;
  createdAt: string;
  updatedAt: string;
};

export type ContactsDirectoryRow = {
  id: string;
  name: string;
  phone?: string;
  extraPhone?: string;
  source?: 'person' | 'local';
  roles?: string[];
};

const normalizePhoneLoose = (raw?: string): string => {
  const value = String(raw || '').trim();
  if (!value) return '';
  return value
    .replace(/\s+/g, '')
    .replace(/(?!^)\+/g, '')
    .replace(/[^\d+]/g, '');
};

export const getContactsBook = (): ContactBookEntry[] => get<ContactBookEntry>(KEYS.CONTACTS);

const findContactBookMatchesByPhones = (phones: string[]) => {
  const normalized = phones.map((p) => normalizePhoneLoose(p)).filter(Boolean);
  if (normalized.length === 0) return [] as ContactBookEntry[];
  const all = getContactsBook();
  return all.filter((c) => {
    const p1 = normalizePhoneLoose(c?.phone);
    const p2 = normalizePhoneLoose(c?.extraPhone);
    return normalized.some((ph) => (p1 && p1 === ph) || (p2 && p2 === ph));
  });
};

const removeContactsBookMatchesByPhones = (phones: string[]) => {
  const normalized = phones.map((p) => normalizePhoneLoose(p)).filter(Boolean);
  if (normalized.length === 0) return;
  const all = getContactsBook();
  const filtered = all.filter((c) => {
    const p1 = normalizePhoneLoose(c?.phone);
    const p2 = normalizePhoneLoose(c?.extraPhone);
    const isMatch = normalized.some((ph) => (p1 && p1 === ph) || (p2 && p2 === ph));
    return !isMatch;
  });
  if (filtered.length !== all.length) save(KEYS.CONTACTS, filtered);
};

/** Used by DbService.addPerson after merging local contact phones. */
export const addPersonWithAutoLinkInternal = (
  data: Omit<الأشخاص_tbl, 'رقم_الشخص'>,
  roles: string[]
): DbResult<الأشخاص_tbl> => {
  const primaryPhone = normalizePhoneLoose(data?.رقم_الهاتف);
  const extraPhone = normalizePhoneLoose(data?.رقم_هاتف_اضافي);
  const matches = findContactBookMatchesByPhones([primaryPhone, extraPhone]);
  const match = matches[0];

  const patch: Omit<الأشخاص_tbl, 'رقم_الشخص'> = { ...data };
  const contactExtra = normalizePhoneLoose(match?.extraPhone);
  if (primaryPhone && !extraPhone && contactExtra && contactExtra !== primaryPhone) {
    patch.رقم_هاتف_اضافي = contactExtra;
  }

  const res = addPerson(patch, roles);
  if (!res?.success) return res;

  if (match && primaryPhone) {
    removeContactsBookMatchesByPhones([primaryPhone, extraPhone]);
    const contactName = String(match?.name || '').trim();
    const msgName = contactName ? ` باسم (${contactName})` : '';
    return {
      ...res,
      message: `${res.message}. تنبيه: رقم الهاتف موجود مسبقاً في الاتصالات${msgName} وتم ربطه تلقائياً لتجنب التكرار.`,
    };
  }

  return res;
};

/** Used by DbService.updatePerson after merging local contact phones. */
export const updatePersonWithAutoLinkInternal = (
  id: string,
  patchRaw: Partial<الأشخاص_tbl>
): DbResult<الأشخاص_tbl> => {
  const personId = String(id || '').trim();
  if (!personId) return fail('الشخص غير موجود');

  let prev: الأشخاص_tbl | undefined;
  try {
    prev = getPeople().find((p) => String(p?.رقم_الشخص) === personId);
  } catch {
    prev = undefined;
  }

  const patch: Partial<الأشخاص_tbl> = { ...(patchRaw || {}) };
  const nextPrimary = normalizePhoneLoose(patch?.رقم_الهاتف ?? prev?.رقم_الهاتف);
  const nextExtra = normalizePhoneLoose(patch?.رقم_هاتف_اضافي ?? prev?.رقم_هاتف_اضافي);

  const matches = findContactBookMatchesByPhones([nextPrimary, nextExtra]);
  const match = matches[0];

  const contactExtra = normalizePhoneLoose(match?.extraPhone);
  if (nextPrimary && !nextExtra && contactExtra && contactExtra !== nextPrimary) {
    patch.رقم_هاتف_اضافي = contactExtra;
  }

  const res = updatePerson(personId, patch);
  if (!res?.success) return res;

  if (match && nextPrimary) {
    removeContactsBookMatchesByPhones([nextPrimary, nextExtra]);
    const contactName = String(match?.name || '').trim();
    const msgName = contactName ? ` باسم (${contactName})` : '';
    return {
      ...res,
      message: `${res.message}. تنبيه: رقم الهاتف موجود مسبقاً في الاتصالات${msgName} وتم ربطه تلقائياً لتجنب التكرار.`,
    };
  }

  return res;
};

export const upsertContactBookInternal = (payload: {
  name: string;
  phone: string;
  extraPhone?: string;
}): DbResult<{ contact: ContactBookEntry; created: boolean }> => {
  const name = String(payload?.name || '').trim();
  const phone = normalizePhoneLoose(payload?.phone);
  const extraPhone = normalizePhoneLoose(payload?.extraPhone) || undefined;
  if (!name) return fail('الاسم مطلوب');
  if (!phone) return fail('رقم الهاتف مطلوب');

  const all = getContactsBook();

  const matchIndex = all.findIndex((c) => {
    const p1 = normalizePhoneLoose(c?.phone);
    const p2 = normalizePhoneLoose(c?.extraPhone);
    return (
      (p1 && p1 === phone) ||
      (p2 && p2 === phone) ||
      (!!extraPhone && ((p1 && p1 === extraPhone) || (p2 && p2 === extraPhone)))
    );
  });

  const now = new Date().toISOString();
  if (matchIndex !== -1) {
    const prev = all[matchIndex];
    const next: ContactBookEntry = {
      ...prev,
      name,
      phone,
      extraPhone: extraPhone || prev.extraPhone,
      updatedAt: now,
    };
    all[matchIndex] = next;
    save(KEYS.CONTACTS, all);
    return ok({ contact: next, created: false });
  }

  const created: ContactBookEntry = {
    id: `CNT-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    phone,
    extraPhone,
    createdAt: now,
    updatedAt: now,
  };
  save(KEYS.CONTACTS, [created, ...all]);
  return ok({ contact: created, created: true });
};

export const getContactsDirectoryInternal = (): ContactsDirectoryRow[] => {
  const out: ContactsDirectoryRow[] = [];
  const byKey = new Map<string, ContactsDirectoryRow>();

  const add = (row: ContactsDirectoryRow, prefer = false) => {
    const phoneKey = normalizePhoneLoose(row.phone);
    const key = phoneKey ? `p:${phoneKey}` : `id:${row.id}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, row);
      return;
    }

    if (prefer) {
      const merged: ContactsDirectoryRow = {
        ...existing,
        ...row,
        roles: existing.roles?.length ? existing.roles : row.roles,
        source: existing.source === 'person' ? 'person' : row.source,
      };
      byKey.set(key, merged);
    }
  };

  try {
    const people = getPeople();
    for (const p of people) {
      const name = String(p?.الاسم || '').trim() || 'غير محدد';
      const phone = String(p?.رقم_الهاتف || '').trim() || undefined;
      const extraPhone = String(p?.رقم_هاتف_اضافي || '').trim() || undefined;
      const pid = String(p?.رقم_الشخص ?? name);
      let roles: string[] = [];
      try {
        const r = getPersonRoles(pid);
        roles = Array.isArray(r) ? r : [];
      } catch {
        roles = [];
      }
      add({ id: pid, name, phone, extraPhone, source: 'person', roles }, true);
    }
  } catch {
    /* ignore */
  }

  try {
    const contacts = getContactsBook();
    for (const c of contacts) {
      add(
        {
          id: String(c?.id || c?.phone || c?.name),
          name: String(c?.name || '').trim() || 'غير محدد',
          phone: c?.phone,
          extraPhone: c?.extraPhone,
          source: 'local',
          roles: [],
        },
        false
      );
    }
  } catch {
    /* ignore */
  }

  for (const v of byKey.values()) out.push(v);
  return out.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
};

/**
 * جلب جميع الأشخاص الذين لديهم دور معين
 */
export const getPeopleByRole = (roleName: string): الأشخاص_tbl[] => {
  const people = getPeople();
  return people.filter(p => {
    const roles = getPersonRoles(p.رقم_الشخص);
    return roles.includes(roleName);
  });
};
