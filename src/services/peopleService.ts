/**
 * © 2025 - Developed by Mahmoud Qattoush
 * AZRAR Real Estate Management System - All Rights Reserved
 * 
 * People Service - Domain-specific service for Person management
 */

import {
  الأشخاص_tbl, شخص_دور_tbl, العقارات_tbl, العقود_tbl,
  الكمبيالات_tbl, BlacklistRecord,
  PersonDetailsResult, DbResult
} from '@/types';
import { validateNewPerson } from './dataValidation';
import { storage } from '@/services/storage';
import { buildCache } from '@/services/dbCache';
import { isBeforeTodayDateOnly } from '@/utils/dateOnly';
import { getInstallmentPaidAndRemaining } from '@/utils/installments';

// Storage functions
const get = <T>(key: string): T[] => {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : [];
};

const save = (key: string, data: unknown) => {
  const serialized = JSON.stringify(data);
  void storage.setItem(key, serialized);
  buildCache();
};

const ok = <T = null>(data?: T, message = 'تمت العملية بنجاح'): DbResult<T> => ({ success: true, message, data });
const fail = <T = null>(message = 'حدث خطأ'): DbResult<T> => ({ success: false, message });

const KEYS = {
  PEOPLE: 'db_people',
  ROLES: 'db_roles',
  PROPERTIES: 'db_properties',
  CONTRACTS: 'db_contracts',
  INSTALLMENTS: 'db_installments',
  BLACKLIST: 'db_blacklist',
};

// Request domain migration in the Electron/main process (desktop) with retries and logging.
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
          console.warn(`[peopleService] domainMigrate attempt ${i}/${retries}`);
          await db.domainMigrate();
          console.warn('[peopleService] domainMigrate succeeded');
          return;
        } catch (err) {
          console.warn(`[peopleService] domainMigrate failed attempt ${i}/${retries}`, err);
          if (i < retries) await new Promise((r) => setTimeout(r, delayMs));
          else console.error('[peopleService] domainMigrate failed after all attempts', err);
        }
      }
    })();
  } catch (e) {
    console.error('[peopleService] requestDomainMigrate unexpected error', e);
  }
};

// People Service Functions
export const getPeople = (): الأشخاص_tbl[] => {
  return get<الأشخاص_tbl>(KEYS.PEOPLE);
};

export const getPersonRoles = (id: string): string[] => {
  return get<شخص_دور_tbl>(KEYS.ROLES).filter(r => r.رقم_الشخص === id).map(r => r.الدور);
};

export const updatePersonRoles = (id: string, roles: string[]) => {
  const all = get<شخص_دور_tbl>(KEYS.ROLES).filter(r => r.رقم_الشخص !== id);
  roles.forEach(role => all.push({ رقم_الشخص: id, الدور: role }));
  save(KEYS.ROLES, all);
};

export const addPerson = (data: Omit<الأشخاص_tbl, 'رقم_الشخص'>, roles: string[]): DbResult<الأشخاص_tbl> => {
  // ✅ التحقق من صحة البيانات قبل الإضافة
  const validation = validateNewPerson(data);
  if (!validation.isValid) {
    return fail(validation.errors.join(', '));
  }

  const id = `P-${Date.now()}`;
  const all = get<الأشخاص_tbl>(KEYS.PEOPLE);
  const newPerson: الأشخاص_tbl = { ...data, رقم_الشخص: id };
  save(KEYS.PEOPLE, [...all, newPerson]);

  const allRoles = get<شخص_دور_tbl>(KEYS.ROLES);
  roles.forEach(role => allRoles.push({ رقم_الشخص: id, الدور: role }));
  save(KEYS.ROLES, allRoles);

  // Desktop: ensure SQL-backed domain tables are refreshed
  requestDomainMigrate();

  return ok(newPerson);
};

export const updatePerson = (id: string, data: Partial<الأشخاص_tbl>): DbResult<الأشخاص_tbl> => {
  const all = get<الأشخاص_tbl>(KEYS.PEOPLE);
  const idx = all.findIndex(p => p.رقم_الشخص === id);
  if (idx > -1) {
    all[idx] = { ...all[idx], ...data };
    save(KEYS.PEOPLE, all);

    // Desktop: ensure SQL-backed domain tables are refreshed
    requestDomainMigrate();

    return ok(all[idx]);
  }
  return fail('الشخص غير موجود');
};

export const deletePerson = (id: string): DbResult<null> => {
  const props = get<العقارات_tbl>(KEYS.PROPERTIES).filter(p => p.رقم_المالك === id);
  if(props.length > 0) return fail('لا يمكن حذف المالك لوجود عقارات مرتبطة به');
  const contracts = get<العقود_tbl>(KEYS.CONTRACTS).filter(c => c.رقم_المستاجر === id);
  if(contracts.length > 0) return fail('لا يمكن حذف الشخص لوجود عقود مرتبطة به');

  const all = get<الأشخاص_tbl>(KEYS.PEOPLE).filter(p => p.رقم_الشخص !== id);
  save(KEYS.PEOPLE, all);
  
  const roles = get<شخص_دور_tbl>(KEYS.ROLES).filter(r => r.رقم_الشخص !== id);
  save(KEYS.ROLES, roles);
  
  // Desktop: ensure SQL-backed domain tables are refreshed
  requestDomainMigrate();
  
  return ok();
};

export const getPersonDetails = (id: string): PersonDetailsResult | null => {
  const p = get<الأشخاص_tbl>(KEYS.PEOPLE).find(x => x.رقم_الشخص === id);
  if(!p) return null;
  const roles = get<شخص_دور_tbl>(KEYS.ROLES).filter(r => r.رقم_الشخص === id).map(r => r.الدور);
  const props = get<العقارات_tbl>(KEYS.PROPERTIES).filter(pr => pr.رقم_المالك === id);
  const contracts = get<العقود_tbl>(KEYS.CONTRACTS).filter(c => c.رقم_المستاجر === id);
  const blacklist = get<BlacklistRecord>(KEYS.BLACKLIST).find(b => b.personId === id && b.isActive);
  
  const installments = get<الكمبيالات_tbl>(KEYS.INSTALLMENTS).filter(i => contracts.some(c => c.رقم_العقد === i.رقم_العقد));
  const totalInst = installments.length;
  const lateInst = installments.filter(i => {
    if (String(i.حالة_الكمبيالة ?? '').trim() === 'ملغي') return false;
    const { remaining } = getInstallmentPaidAndRemaining(i);
    return remaining > 0 && isBeforeTodayDateOnly(i.تاريخ_استحقاق);
  }).length;
  
  return { 
    person: p, roles, ownedProperties: props, contracts, blacklistRecord: blacklist,
    stats: { totalInstallments: totalInst, lateInstallments: lateInst, commitmentRatio: totalInst ? Math.round(((totalInst - lateInst)/totalInst)*100) : 100 }
  };
};

export const getPersonBlacklistStatus = (id: string): BlacklistRecord | undefined => {
  return get<BlacklistRecord>(KEYS.BLACKLIST).find(b => b.personId === id && b.isActive);
};

export const getBlacklist = (): BlacklistRecord[] => {
  return get<BlacklistRecord>(KEYS.BLACKLIST);
};

export const getBlacklistRecord = (id: string): BlacklistRecord | undefined => {
  return get<BlacklistRecord>(KEYS.BLACKLIST).find(b => b.id === id);
};

export const addToBlacklist = (record: Omit<BlacklistRecord, 'id' | 'dateAdded' | 'addedBy' | 'isActive'>) => {
  const all = get<BlacklistRecord>(KEYS.BLACKLIST);
  all.forEach(b => { if(b.personId === record.personId) b.isActive = false; });
  save(KEYS.BLACKLIST, [...all, { ...record, id: `BL-${Date.now()}`, dateAdded: new Date().toISOString(), addedBy: 'Admin', isActive: true }]);
};

export const updateBlacklistRecord = (id: string, data: Partial<BlacklistRecord>): DbResult<null> => {
  const all = get<BlacklistRecord>(KEYS.BLACKLIST);
  const idx = all.findIndex(b => b.id === id);
  if(idx > -1) {
    all[idx] = { ...all[idx], ...data };
    save(KEYS.BLACKLIST, all);
    return ok();
  }
  return fail('السجل غير موجود');
};

export const removeFromBlacklist = (id: string) => {
  const all = get<BlacklistRecord>(KEYS.BLACKLIST);
  if (id.startsWith('BL-')) {
    const idx = all.findIndex(b => b.id === id);
    if (idx > -1) {
      all[idx].isActive = false;
      save(KEYS.BLACKLIST, all);
    }
  } else {
    const idx = all.findIndex(b => b.personId === id && b.isActive);
    if(idx > -1) {
      all[idx].isActive = false;
      save(KEYS.BLACKLIST, all);
    }
  }
};

import { buildWhatsAppLink } from '@/utils/whatsapp';

export const generateWhatsAppLink = (phone: string, msg: string): string => {
  // Smart behavior: if local-format, prepend 962; if international, keep as-is.
  return buildWhatsAppLink(msg, phone, { defaultCountryCode: '962' });
};


