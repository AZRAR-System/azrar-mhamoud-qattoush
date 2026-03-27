/**
 * Cold start: optional dev admin seed, lookup merges, legal templates, alert cleanup, legacy migrations, cache.
 */

import {
  LookupCategory,
  SystemLookup,
  LegalNoticeTemplate,
  الأشخاص_tbl,
  شخص_دور_tbl,
  المنشآت_tbl,
} from '@/types';
import { storage } from '@/services/storage';
import { hashPassword } from '@/services/passwordHash';
import { buildCache, DbCache } from '@/services/dbCache';
import { get, save } from './kv';
import { KEYS } from './keys';
import { MOCK_LEGAL_TEMPLATES } from './mockDbConstants';
import { lookupKeyFor, normKeySimple } from './lookupKeys';
import { migrateLegacyContractNumbersOnce } from './contractNumberMigration';

const asUnknownRecord = (value: unknown): Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : Object.create(null);

export type InitDataDeps = {
  dedupeAndCleanupAlertsInternal: () => void;
};

export async function runInitData(deps: InitDataDeps): Promise<void> {
  const { dedupeAndCleanupAlertsInternal } = deps;

  try {
    localStorage.removeItem('demo_data_loaded');
  } catch {
    // ignore
  }
  try {
    await storage.removeItem('demo_data_loaded');
  } catch {
    // ignore
  }

  try {
    const env = import.meta.env;
    const isDev = !!env?.DEV;
    const seedEnabled = String(env?.VITE_SEED_DEFAULT_ADMIN || '').toLowerCase() === 'true';
    if (isDev && seedEnabled) {
      const usersFromStorage = await storage.getItem(KEYS.USERS).catch(() => null);
      const usersFromLocalStorage = localStorage.getItem(KEYS.USERS);
      const usersSerialized = usersFromStorage ?? usersFromLocalStorage;

      let shouldSeedAdmin = false;
      if (!usersSerialized) {
        shouldSeedAdmin = true;
      } else {
        try {
          const parsed = JSON.parse(usersSerialized);
          shouldSeedAdmin = !Array.isArray(parsed) || parsed.length === 0;
        } catch {
          shouldSeedAdmin = true;
        }
      }

      if (shouldSeedAdmin) {
        const username = String(env?.VITE_SEED_DEFAULT_ADMIN_USERNAME || 'admin');
        const passwordPlain = String(env?.VITE_SEED_DEFAULT_ADMIN_PASSWORD || '123456');
        const passwordStored = await hashPassword(passwordPlain);
        save(KEYS.USERS, [
          {
            id: '1',
            اسم_المستخدم: username,
            كلمة_المرور: passwordStored,
            الدور: 'SuperAdmin',
            isActive: true,
          },
        ]);
      }
    }
  } catch {
    // ignore
  }

  {
    const normKey = normKeySimple;

    const normalizeCategory = (c: LookupCategory): LookupCategory | null => {
      const name = String((c as LookupCategory)?.name || (c as LookupCategory)?.id || '').trim();
      if (!name) return null;
      const id = String((c as LookupCategory)?.id || name).trim();
      const label = String((c as LookupCategory)?.label || name).trim();
      const key = String((c as LookupCategory)?.key || name).trim();
      return {
        ...c,
        id,
        name,
        label,
        key,
      };
    };

    const normalizeLookup = (l: SystemLookup, ensureId: () => string): SystemLookup | null => {
      const category = String((l as SystemLookup)?.category || '').trim();
      const label = String((l as SystemLookup)?.label || '').trim();
      if (!category || !label) return null;
      const id = String((l as SystemLookup)?.id || ensureId()).trim();
      const key = String((l as SystemLookup)?.key || lookupKeyFor(category, label)).trim();
      return {
        ...l,
        id,
        category,
        label,
        key,
      };
    };

    const dedupeCategories = (items: LookupCategory[]) => {
      const byKey = new Map<string, LookupCategory>();
      const idxByKey = new Map<string, number>();
      const out: LookupCategory[] = [];

      for (const c of items) {
        const normalized = normalizeCategory(c);
        if (!normalized) continue;
        const key = normKey(normalized?.key || normalized?.name || normalized?.id);
        if (!key) continue;
        const prev = byKey.get(key);
        if (!prev) {
          byKey.set(key, normalized);
          idxByKey.set(key, out.length);
          out.push(normalized);
          continue;
        }

        const prevSystem = prev.isSystem === true;
        const curSystem = normalized.isSystem === true;
        if (!prevSystem && curSystem) {
          byKey.set(key, normalized);
          const idx = idxByKey.get(key);
          if (typeof idx === 'number') out[idx] = normalized;
        }
      }
      return out;
    };

    const dedupeLookups = (items: SystemLookup[]) => {
      const byKey = new Map<string, SystemLookup>();
      const idxByKey = new Map<string, number>();
      const out: SystemLookup[] = [];

      const ensureId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      for (const l of items) {
        const normalized = normalizeLookup(l, ensureId);
        if (!normalized) continue;

        const dkey = `${normKey(normalized?.category)}||${normKey(normalized?.key) || normKey(normalized?.label)}`;
        if (!dkey || dkey === '||') continue;
        const prev = byKey.get(dkey);
        if (!prev) {
          byKey.set(dkey, normalized);
          idxByKey.set(dkey, out.length);
          out.push(normalized);
          continue;
        }

        const prevSystem = prev.isSystem === true;
        const curSystem = normalized.isSystem === true;
        if (!prevSystem && curSystem) {
          byKey.set(dkey, normalized);
          const idx = idxByKey.get(dkey);
          if (typeof idx === 'number') out[idx] = normalized;
        }
      }
      return out;
    };

    const requiredCategories: LookupCategory[] = [
      { id: 'person_roles', name: 'person_roles', label: 'أدوار الأشخاص', isSystem: true },
      { id: 'company_nature', name: 'company_nature', label: 'طبيعة المنشأة', isSystem: true },
      { id: 'prop_type', name: 'prop_type', label: 'أنواع العقارات', isSystem: true },
      { id: 'prop_status', name: 'prop_status', label: 'حالات العقار', isSystem: true },
      { id: 'prop_city', name: 'prop_city', label: 'المدن', isSystem: true },
      { id: 'prop_region', name: 'prop_region', label: 'المناطق', isSystem: true },
      { id: 'prop_floor', name: 'prop_floor', label: 'الطوابق', isSystem: true },
      { id: 'prop_furnishing', name: 'prop_furnishing', label: 'صفة العقار', isSystem: true },
      {
        id: 'contract_duration_text',
        name: 'contract_duration_text',
        label: 'مدة الإيجار (كتابة)',
        isSystem: true,
      },
      {
        id: 'contract_rent_payment_text',
        name: 'contract_rent_payment_text',
        label: 'كيفية أداء البدل (كتابة)',
        isSystem: true,
      },
      {
        id: 'ext_comm_type',
        name: 'ext_comm_type',
        label: 'أنواع العمولات الخارجية',
        isSystem: true,
      },
    ];

    const ensureId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const existingCategoriesRaw = get<LookupCategory>(KEYS.LOOKUP_CATEGORIES);
    const existingCategories = dedupeCategories(existingCategoriesRaw);
    const mergedCategories = [...existingCategories];
    let categoriesChanged = false;

    if (existingCategories.length !== existingCategoriesRaw.length) categoriesChanged = true;

    for (const c of requiredCategories) {
      const idx = mergedCategories.findIndex((x) => x.id === c.id || x.name === c.name);
      if (idx === -1) {
        mergedCategories.push(c);
        categoriesChanged = true;
        continue;
      }

      const existing = mergedCategories[idx];
      const shouldUpdateLabel = existing.isSystem && c.isSystem && existing.label !== c.label;
      const shouldUpdateName = existing.isSystem && c.isSystem && existing.name !== c.name;
      if (shouldUpdateLabel || shouldUpdateName) {
        mergedCategories[idx] = {
          ...existing,
          name: shouldUpdateName ? c.name : existing.name,
          label: shouldUpdateLabel ? c.label : existing.label,
        };
        categoriesChanged = true;
      }
    }

    const mergedCategoriesFinal = dedupeCategories(mergedCategories);
    if (mergedCategoriesFinal.length !== mergedCategories.length) categoriesChanged = true;

    const categoryAliases: Record<string, string> = {
      contract_duration: 'contract_duration_text',
      contract_rent_payment_clause: 'contract_rent_payment_text',
      contract_payment_terms: 'contract_rent_payment_text',
    };

    const isAliasCategory = (c: LookupCategory) => {
      const id = String(c?.id || '').trim();
      const name = String(c?.name || id).trim();
      return Boolean(categoryAliases[id] || categoryAliases[name]);
    };

    const mergedCategoriesClean = mergedCategoriesFinal.filter((c) => !isAliasCategory(c));
    if (mergedCategoriesClean.length !== mergedCategoriesFinal.length) categoriesChanged = true;

    if (categoriesChanged || !localStorage.getItem(KEYS.LOOKUP_CATEGORIES)) {
      save(KEYS.LOOKUP_CATEGORIES, mergedCategoriesClean);
    }

    const requiredLookups: Array<Omit<SystemLookup, 'id'> & { id?: string }> = [
      { category: 'person_roles', label: 'مالك', id: '1' },
      { category: 'person_roles', label: 'مستأجر', id: '2' },
      { category: 'person_roles', label: 'كفيل', id: '3' },
      { category: 'company_nature', label: 'شركة' },
      { category: 'company_nature', label: 'مؤسسة' },
      { category: 'prop_type', label: 'شقة', id: '4' },
      { category: 'prop_type', label: 'محل تجاري', id: '5' },
      { category: 'prop_status', label: 'شاغر', id: '6' },
      { category: 'prop_status', label: 'مؤجر', id: '7' },
      { category: 'prop_city', label: 'عمان' },
      { category: 'prop_furnishing', label: 'فارغ' },
      { category: 'prop_furnishing', label: 'مفروش' },
      { category: 'prop_floor', label: 'أرضي' },
      { category: 'prop_floor', label: 'الأول' },
      { category: 'prop_floor', label: 'الثاني' },
      { category: 'prop_floor', label: 'الثالث' },
      { category: 'ext_comm_type', label: 'عمولة خدمة' },
      { category: 'ext_comm_type', label: 'رسوم خدمة' },
      { category: 'ext_comm_type', label: 'إحالة (Referral)' },
      { category: 'contract_duration_text', label: 'سنة واحدة تجدد تلقائي برضى الطرفين' },
    ];

    const existingLookupsRaw = get<SystemLookup>(KEYS.LOOKUPS);
    const existingLookups = dedupeLookups(existingLookupsRaw);
    const mergedLookups = [...existingLookups];
    let lookupsChanged = false;

    if (existingLookups.length !== existingLookupsRaw.length) lookupsChanged = true;

    for (const l of requiredLookups) {
      const requiredKey = lookupKeyFor(l.category, l.label);
      const exists = mergedLookups.some(
        (x) =>
          x.category === l.category &&
          (normKey(x.label) === normKey(l.label) ||
            (requiredKey && normKey(x.key) === normKey(requiredKey)))
      );
      if (!exists) {
        mergedLookups.push({
          id: l.id ?? ensureId(),
          category: l.category,
          label: l.label,
          key: requiredKey || undefined,
        });
        lookupsChanged = true;
      }
    }

    const mergedLookupsFinal = dedupeLookups(mergedLookups);
    if (mergedLookupsFinal.length !== mergedLookups.length) lookupsChanged = true;

    const remappedLookups = mergedLookupsFinal.map((l) => {
      const fromCat = String(l?.category || '').trim();
      const toCat = categoryAliases[fromCat] || fromCat;
      if (!fromCat || toCat === fromCat) return l;
      const nextKey = lookupKeyFor(toCat, String(l?.label || ''));
      return {
        ...l,
        category: toCat,
        key: nextKey || l.key,
      };
    });

    const remappedLookupsFinal = dedupeLookups(remappedLookups);
    if (remappedLookupsFinal.length !== mergedLookupsFinal.length) lookupsChanged = true;
    if (remappedLookupsFinal.some((x, i) => x.category !== mergedLookupsFinal[i]?.category))
      lookupsChanged = true;

    if (lookupsChanged || !localStorage.getItem(KEYS.LOOKUPS)) {
      save(KEYS.LOOKUPS, remappedLookupsFinal);
    }
  }

  try {
    const existing = get<LegalNoticeTemplate>(KEYS.LEGAL_TEMPLATES);
    if (
      !Array.isArray(existing) ||
      existing.length === 0 ||
      !localStorage.getItem(KEYS.LEGAL_TEMPLATES)
    ) {
      save(KEYS.LEGAL_TEMPLATES, MOCK_LEGAL_TEMPLATES);
    } else {
      const byId = new Set(existing.map((t) => String(t.id)));
      const merged = [...existing];
      let changed = false;
      for (const t of MOCK_LEGAL_TEMPLATES) {
        if (!byId.has(String(t.id))) {
          merged.push(t);
          changed = true;
        }
      }
      if (changed) save(KEYS.LEGAL_TEMPLATES, merged);
    }
  } catch {
    save(KEYS.LEGAL_TEMPLATES, MOCK_LEGAL_TEMPLATES);
  }

  dedupeAndCleanupAlertsInternal();

  try {
    const legacyCompaniesRaw = localStorage.getItem(KEYS.COMPANIES);
    const legacyCompanies: المنشآت_tbl[] = legacyCompaniesRaw ? JSON.parse(legacyCompaniesRaw) : [];
    if (Array.isArray(legacyCompanies) && legacyCompanies.length > 0) {
      const people = get<الأشخاص_tbl>(KEYS.PEOPLE);
      const roles = get<شخص_دور_tbl>(KEYS.ROLES);

      const peopleByNationalId = new Map<string, الأشخاص_tbl>();
      const peopleByPhone = new Map<string, الأشخاص_tbl>();
      for (const p of people) {
        const nid = String(p.الرقم_الوطني || '').trim();
        const phone = String(p.رقم_الهاتف || '').trim();
        if (nid) peopleByNationalId.set(nid, p);
        if (phone) peopleByPhone.set(phone, p);
      }

      let changed = false;
      const nextPeople = [...people];
      const nextRoles = [...roles];

      for (const c of legacyCompanies) {
        if (!c) continue;
        const cRec = asUnknownRecord(c);
        const name = String(cRec['الاسم'] || '').trim();
        const phone = String(cRec['رقم_الهاتف'] || '').trim();
        const reg = String(cRec['الرقم_الوطني_للمنشأة'] || '').trim();
        const nature = String(cRec['طبيعة_الشركة'] || '').trim();
        const companyRoles: string[] = Array.isArray(cRec['الأدوار'])
          ? (cRec['الأدوار'] as unknown[]).map(String)
          : [];

        if (!name || !phone) continue;

        const existing = (reg && peopleByNationalId.get(reg)) || peopleByPhone.get(phone);

        if (existing) {
          const idx = nextPeople.findIndex((p) => p.رقم_الشخص === existing.رقم_الشخص);
          if (idx > -1) {
            const updated: الأشخاص_tbl & { طبيعة_الشركة?: string } = {
              ...nextPeople[idx],
              الاسم: nextPeople[idx].الاسم || name,
              رقم_الهاتف: nextPeople[idx].رقم_الهاتف || phone,
              الرقم_الوطني: nextPeople[idx].الرقم_الوطني || reg || undefined,
              العنوان: nextPeople[idx].العنوان || String(cRec['العنوان'] || '').trim() || undefined,
              ملاحظات: nextPeople[idx].ملاحظات || String(cRec['ملاحظات'] || '').trim() || undefined,
              نوع_الملف: 'منشأة',
              طبيعة_الشركة:
                String(asUnknownRecord(nextPeople[idx])['طبيعة_الشركة'] || '').trim() ||
                nature ||
                undefined,
            };
            nextPeople[idx] = updated;

            const mergedRoles = companyRoles.length ? companyRoles : ['مستأجر'];
            const existingRoles = new Set(
              nextRoles.filter((r) => r.رقم_الشخص === existing.رقم_الشخص).map((r) => r.الدور)
            );
            for (const r of mergedRoles) {
              if (r && !existingRoles.has(r)) {
                nextRoles.push({ رقم_الشخص: existing.رقم_الشخص, الدور: r });
              }
            }
            changed = true;
          }
          continue;
        }

        const newId =
          String(cRec['رقم_المنشأة'] || '').trim() ||
          `P-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const primaryRole = (companyRoles[0] || 'مستأجر') as string;

        const newPerson: الأشخاص_tbl & { طبيعة_الشركة?: string } = {
          رقم_الشخص: newId,
          الاسم: name,
          رقم_الهاتف: phone,
          الرقم_الوطني: reg || undefined,
          العنوان: String(cRec['العنوان'] || '').trim() || undefined,
          ملاحظات: String(cRec['ملاحظات'] || '').trim() || undefined,
          رقم_نوع_الشخص: primaryRole,
          نوع_الملف: 'منشأة',
          طبيعة_الشركة: nature || undefined,
        };

        nextPeople.push(newPerson);
        for (const r of companyRoles.length ? companyRoles : [primaryRole]) {
          if (r) nextRoles.push({ رقم_الشخص: newId, الدور: r });
        }

        changed = true;
      }

      if (changed) {
        save(KEYS.PEOPLE, nextPeople);
        save(KEYS.ROLES, nextRoles);
        save(KEYS.COMPANIES, []);
      }
    }
  } catch (e) {
    console.warn('Legacy companies migration failed', e);
  }

  migrateLegacyContractNumbersOnce();

  if (!DbCache.isInitialized) buildCache();
}
