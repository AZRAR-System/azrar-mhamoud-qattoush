import { DbService } from '@/services/mockDb';

import type {
  ContractDetailsResult,
  ContractPickerItem,
  DomainEntity as DomainEntityType,
  DomainEntityMap,
  InstallmentsContractsItem,
  PeoplePickerItem,
  PersonDetailsResult,
  PropertyPickerItem,
  PropertyPickerSearchPayload,
} from '@/types/domain.types';
import type { الأشخاص_tbl, العقارات_tbl, العقود_tbl, الكمبيالات_tbl } from '@/types/types';

export type DomainEntity = DomainEntityType;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

const hasUnknownProp = <K extends string>(obj: Record<string, unknown>, key: K): obj is Record<string, unknown> & Record<K, unknown> =>
  Object.prototype.hasOwnProperty.call(obj, key);

const asArray = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

const asString = (v: unknown): string => String(v ?? '').trim();

const asNumber = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

type DashboardSummary = {
  totalPeople: number;
  totalProperties: number;
  occupiedProperties: number;
  totalContracts: number;
  activeContracts: number;
  dueNext7Payments: number;
  paymentsToday: number;
  revenueToday: number;
  contractsExpiring30: number;
  maintenanceOpen: number;
  propertyTypeCounts: Array<{ name: string; value: number }>;
  contractStatusCounts: Array<{ name: string; value: number }>;
};

type DashboardPerformance = {
  currentMonthCollections: number;
  previousMonthCollections: number;
  paidCountThisMonth: number;
  dueUnpaidThisMonth: number;
};

type DashboardHighlights = {
  dueInstallmentsToday: Array<{ contractId: string; tenantName: string; dueDate: string; remaining: number }>;
  expiringContracts: Array<{ contractId: string; propertyId: string; propertyCode: string; tenantId: string; tenantName: string; endDate: string }>;
  incompleteProperties: Array<{ propertyId: string; propertyCode: string; missingWater: boolean; missingElectric: boolean; missingArea: boolean }>;
};

type PaymentNotificationTarget = {
  key: string;
  tenantId?: string;
  tenantName: string;
  phone?: string;
  extraPhone?: string;
  contractId: string;
  propertyId?: string;
  propertyCode?: string;
  paymentPlanRaw?: string;
  paymentFrequency?: number;
  items: Array<{
    installmentId: string;
    contractId: string;
    dueDate: string;
    amountRemaining: number;
    daysUntilDue: number;
    bucket: 'overdue' | 'today' | 'upcoming';
  }>;
};

const isDesktop = () => typeof window !== 'undefined' && !!window.desktopDb;

export async function domainSearchGlobalSmart(query: string): Promise<{ people: الأشخاص_tbl[]; properties: العقارات_tbl[]; contracts: العقود_tbl[] }> {
  const q = String(query || '').trim();
  if (!q) return { people: [], properties: [], contracts: [] };

  if (isDesktop() && window.desktopDb?.domainSearchGlobal) {
    try {
      const res: unknown = await window.desktopDb.domainSearchGlobal(q);
      if (isRecord(res) && hasUnknownProp(res, 'ok') && res.ok === true) {
        return {
          people: isRecord(res) && hasUnknownProp(res, 'people') ? asArray<الأشخاص_tbl>(res.people) : [],
          properties: isRecord(res) && hasUnknownProp(res, 'properties') ? asArray<العقارات_tbl>(res.properties) : [],
          contracts: isRecord(res) && hasUnknownProp(res, 'contracts') ? asArray<العقود_tbl>(res.contracts) : [],
        };
      }
    } catch {
      // fall back
    }
  }

  // Desktop safety: do not fall back to in-memory scans.
  if (isDesktop()) return { people: [], properties: [], contracts: [] };

  return DbService.searchGlobal(q);
}

export async function domainSearchSmart<E extends DomainEntity>(entity: E, query: string, limit = 50): Promise<Array<DomainEntityMap[E]>> {
  const q = String(query || '').trim();
  const cap = Math.max(1, Math.min(200, Math.trunc(Number(limit) || 50)));

  if (isDesktop() && window.desktopDb?.domainSearch) {
    try {
      const res: unknown = await window.desktopDb.domainSearch({ entity, query: q, limit: cap });
      if (isRecord(res) && hasUnknownProp(res, 'ok') && res.ok === true && hasUnknownProp(res, 'items')) {
        return asArray<DomainEntityMap[E]>(res.items);
      }
    } catch {
      // fall back
    }
  }

  // Desktop safety: do not fall back to in-memory scans.
  if (isDesktop()) return [];

  // Desktop-only specialized pickers can return richer payloads; keep this helper generic.

  // Non-desktop fallback (legacy in-memory)
  if (entity === 'people') {
    const lower = q.toLowerCase();
    return DbService.getPeople()
      .filter((p) => !q || p.الاسم.toLowerCase().includes(lower) || String(p.رقم_الهاتف || '').includes(lower) || String(p.الرقم_الوطني || '').includes(lower))
      .slice(0, cap) as Array<DomainEntityMap[E]>;
  }
  if (entity === 'properties') {
    const lower = q.toLowerCase();
    return DbService.getProperties()
      .filter((p) => !q || p.الكود_الداخلي.toLowerCase().includes(lower) || String(p.العنوان || '').toLowerCase().includes(lower))
      .slice(0, cap) as Array<DomainEntityMap[E]>;
  }
  const lower = q.toLowerCase();
  return DbService.getContracts()
    .filter((c) => !q || String(c.رقم_العقد || '').toLowerCase().includes(lower) || String(c.حالة_العقد || '').toLowerCase().includes(lower))
    .slice(0, cap) as Array<DomainEntityMap[E]>;
}

export async function propertyPickerSearchSmart(payload: PropertyPickerSearchPayload): Promise<PropertyPickerItem[]> {
  if (isDesktop() && window.desktopDb?.domainPropertyPickerSearch) {
    try {
      const res: unknown = await window.desktopDb.domainPropertyPickerSearch(payload);
      if (isRecord(res) && hasUnknownProp(res, 'ok') && res.ok === true && hasUnknownProp(res, 'items')) {
        return asArray<PropertyPickerItem>(res.items);
      }
    } catch {
      // fall back
    }
  }

  // Fallback: minimal, no joins.
  const props = await domainSearchSmart('properties', payload.query, payload.limit ?? 200);
  return props.map((p) => ({ property: p }));
}

export async function propertyPickerSearchPagedSmart(payload: PropertyPickerSearchPayload): Promise<{ items: PropertyPickerItem[]; total: number }> {
  if (isDesktop() && window.desktopDb?.domainPropertyPickerSearch) {
    try {
      const res: unknown = await window.desktopDb.domainPropertyPickerSearch(payload);
      if (isRecord(res) && hasUnknownProp(res, 'ok') && res.ok === true) {
        return {
          items: hasUnknownProp(res, 'items') ? asArray<PropertyPickerItem>(res.items) : [],
          total: hasUnknownProp(res, 'total') ? asNumber(res.total) : 0,
        };
      }
    } catch {
      // fall back
    }
  }

  const items = await propertyPickerSearchSmart(payload);
  return { items, total: items.length };
}

export async function contractPickerSearchSmart(payload: { query: string; createdMonth?: string; limit?: number }): Promise<
  Array<Omit<ContractPickerItem, 'remainingAmount'>>
> {
  if (isDesktop() && window.desktopDb?.domainContractPickerSearch) {
    try {
      const res: unknown = await window.desktopDb.domainContractPickerSearch(payload);
      if (isRecord(res) && hasUnknownProp(res, 'ok') && res.ok === true && hasUnknownProp(res, 'items')) {
        return asArray<Omit<ContractPickerItem, 'remainingAmount'>>(res.items);
      }
    } catch {
      // fall back
    }
  }

  const contracts = await domainSearchSmart('contracts', payload.query, payload.limit ?? 200);
  return contracts.map((c) => ({ contract: c }));
}

export async function contractPickerSearchPagedSmart(payload: {
  query: string;
  tab?: string;
  createdMonth?: string;
  offset?: number;
  limit?: number;
}): Promise<{
  items: ContractPickerItem[];
  total: number;
  error?: string;
}> {
  if (isDesktop() && window.desktopDb?.domainContractPickerSearch) {
    try {
      const res: unknown = await window.desktopDb.domainContractPickerSearch(payload);
      if (isRecord(res) && hasUnknownProp(res, 'ok') && res.ok === true) {
        return {
          items: hasUnknownProp(res, 'items') ? asArray<ContractPickerItem>(res.items) : [],
          total: hasUnknownProp(res, 'total') ? asNumber(res.total) : 0,
        };
      }

      // Desktop safety: do not fall back to in-memory scans; surface the error.
      if (isDesktop()) {
        return {
          items: [],
          total: 0,
          error: isRecord(res) && hasUnknownProp(res, 'message') ? asString(res.message) || 'فشل تحميل العقود (Desktop SQL)' : 'فشل تحميل العقود (Desktop SQL)',
        };
      }
    } catch (e: unknown) {
      // Desktop safety: do not fall back to in-memory scans; surface the error.
      if (isDesktop()) {
        return {
          items: [],
          total: 0,
          error:
            isRecord(e) && hasUnknownProp(e, 'message')
              ? asString(e.message) || 'فشل تحميل العقود (Desktop SQL)'
              : 'فشل تحميل العقود (Desktop SQL)',
        };
      }
    }
  }

  const items = await contractPickerSearchSmart(payload);
  return { items, total: items.length };
}

export async function domainCountsSmart(): Promise<{ people: number; properties: number; contracts: number } | null> {
  if (isDesktop() && window.desktopDb?.domainCounts) {
    try {
      const res: unknown = await window.desktopDb.domainCounts();
      if (isRecord(res) && hasUnknownProp(res, 'ok') && res.ok === true && hasUnknownProp(res, 'counts') && isRecord(res.counts)) {
        return {
          people: hasUnknownProp(res.counts, 'people') ? asNumber(res.counts.people) : 0,
          properties: hasUnknownProp(res.counts, 'properties') ? asNumber(res.counts.properties) : 0,
          contracts: hasUnknownProp(res.counts, 'contracts') ? asNumber(res.counts.contracts) : 0,
        };
      }

      // Desktop: attempt one-time migrate/repair and retry.
      if (isDesktop() && window.desktopDb?.domainMigrate) {
        try {
          await window.desktopDb.domainMigrate();
          const again: unknown = await window.desktopDb.domainCounts();
          if (isRecord(again) && hasUnknownProp(again, 'ok') && again.ok === true && hasUnknownProp(again, 'counts') && isRecord(again.counts)) {
            return {
              people: hasUnknownProp(again.counts, 'people') ? asNumber(again.counts.people) : 0,
              properties: hasUnknownProp(again.counts, 'properties') ? asNumber(again.counts.properties) : 0,
              contracts: hasUnknownProp(again.counts, 'contracts') ? asNumber(again.counts.contracts) : 0,
            };
          }
        } catch {
          // ignore
        }
      }
    } catch {
      // fall back
    }
  }
  return null;
}

export async function dashboardSummarySmart(payload: {
  todayYMD: string;
  weekYMD: string;
}): Promise<DashboardSummary | null> {
  if (isDesktop() && window.desktopDb?.domainDashboardSummary) {
    try {
      const res: unknown = await window.desktopDb.domainDashboardSummary(payload);
      if (isRecord(res) && hasUnknownProp(res, 'ok') && res.ok === true && hasUnknownProp(res, 'data')) {
        return res.data as DashboardSummary;
      }
    } catch {
      // fall back
    }
  }
  return null;
}

export async function dashboardPerformanceSmart(payload: {
  monthKey: string;
  prevMonthKey: string;
}): Promise<DashboardPerformance | null> {
  if (isDesktop() && window.desktopDb?.domainDashboardPerformance) {
    try {
      const res: unknown = await window.desktopDb.domainDashboardPerformance(payload);
      if (isRecord(res) && hasUnknownProp(res, 'ok') && res.ok === true && hasUnknownProp(res, 'data')) {
        return res.data as DashboardPerformance;
      }
    } catch {
      // fall back
    }
  }
  return null;
}

export async function dashboardHighlightsSmart(payload: {
  todayYMD: string;
}): Promise<DashboardHighlights | null> {
  if (isDesktop() && window.desktopDb?.domainDashboardHighlights) {
    try {
      const res: unknown = await window.desktopDb.domainDashboardHighlights(payload);
      if (isRecord(res) && hasUnknownProp(res, 'ok') && res.ok === true && hasUnknownProp(res, 'data')) {
        return res.data as DashboardHighlights;
      }
    } catch {
      // fall back
    }
  }

  // Non-desktop: no equivalent heavy aggregator; keep null.
  return null;
}

export async function paymentNotificationTargetsSmart(payload: {
  daysAhead: number;
  todayYMD?: string;
}): Promise<
  | PaymentNotificationTarget[]
  | null
> {
  if (isDesktop() && window.desktopDb?.domainPaymentNotificationTargets) {
    try {
      const res: unknown = await window.desktopDb.domainPaymentNotificationTargets(payload);
      if (isRecord(res) && hasUnknownProp(res, 'ok') && res.ok === true && hasUnknownProp(res, 'items')) {
        return asArray<PaymentNotificationTarget>(res.items);
      }
    } catch {
      // fall back
    }
  }

  if (!isDesktop()) {
    try {
      const raw: unknown = DbService.getPaymentNotificationTargets(Number(payload?.daysAhead ?? 7) || 7);
      return Array.isArray(raw) ? (raw as PaymentNotificationTarget[]) : [];
    } catch {
      return [];
    }
  }
  return null;
}

export async function personDetailsSmart(personId: string): Promise<PersonDetailsResult | null> {
  const id = String(personId || '').trim();
  if (!id) return null;

  if (isDesktop() && window.desktopDb?.domainPersonDetails) {
    try {
      const res: unknown = await window.desktopDb.domainPersonDetails({ personId: id });
      if (isRecord(res) && hasUnknownProp(res, 'ok') && res.ok === true && hasUnknownProp(res, 'data')) {
        return res.data as PersonDetailsResult;
      }
    } catch {
      // fall back
    }
  }

  if (!isDesktop()) {
    try {
      return DbService.getPersonDetails(id) || null;
    } catch {
      return null;
    }
  }

  return null;
}

export async function personTenancyContractsSmart(personId: string): Promise<
  Array<{ contract: العقود_tbl; propertyCode?: string; propertyAddress?: string; tenantName?: string }> | null
> {
  const id = String(personId || '').trim();
  if (!id) return null;

  if (isDesktop() && window.desktopDb?.domainPersonTenancyContracts) {
    try {
      const res: unknown = await window.desktopDb.domainPersonTenancyContracts({ personId: id });
      if (isRecord(res) && hasUnknownProp(res, 'ok') && res.ok === true && hasUnknownProp(res, 'items')) {
        return asArray<{ contract: العقود_tbl; propertyCode?: string; propertyAddress?: string; tenantName?: string }>(res.items);
      }
    } catch {
      // fall back
    }
  }

  // Non-desktop fallback: compute from in-memory DB.
  if (!isDesktop()) {
    try {
      const contracts = DbService.getContracts();
      const properties = DbService.getProperties();
      const people = DbService.getPeople();

      const tenant = people.find((p) => String(p?.رقم_الشخص ?? '') === id);
      const tenantName = tenant ? String(tenant.الاسم || '').trim() : undefined;

      const items = contracts
        .filter((c) => String(c?.رقم_المستاجر ?? '') === id)
        .sort((a, b) => String(b?.تاريخ_البداية ?? '').localeCompare(String(a?.تاريخ_البداية ?? '')))
        .map((c) => {
          const prop = properties.find((p) => String(p?.رقم_العقار ?? '') === String(c?.رقم_العقار ?? ''));
          return {
            contract: c,
            propertyCode: prop ? String(prop.الكود_الداخلي || '').trim() || undefined : undefined,
            propertyAddress: prop ? String(prop.العنوان || '').trim() || undefined : undefined,
            tenantName,
          };
        });

      return items;
    } catch {
      return [];
    }
  }

  return null;
}

export async function contractDetailsSmart(contractId: string): Promise<
  ContractDetailsResult | null
> {
  const cid = String(contractId || '').trim();
  if (!cid) return null;

  if (isDesktop() && window.desktopDb?.domainContractDetails) {
    try {
      const res: unknown = await window.desktopDb.domainContractDetails({ contractId: cid });
      if (isRecord(res) && hasUnknownProp(res, 'ok') && res.ok === true && hasUnknownProp(res, 'data')) {
        return res.data as ContractDetailsResult;
      }
    } catch {
      // fall back
    }
  }

  // Desktop safety: do not fall back to in-memory scans.
  if (isDesktop()) return null;

  return DbService.getContractDetails(cid) || null;
}

export async function peoplePickerSearchPagedSmart(payload: {
  query: string;
  role?: string;
  onlyIdleOwners?: boolean;
  address?: string;
  nationalId?: string;
  classification?: string;
  minRating?: number;
  offset?: number;
  limit?: number;
}): Promise<{ items: PeoplePickerItem[]; total: number }> {
  if (isDesktop() && window.desktopDb?.domainPeoplePickerSearch) {
    try {
      const res: unknown = await window.desktopDb.domainPeoplePickerSearch(payload);
      if (isRecord(res) && hasUnknownProp(res, 'ok') && res.ok === true) {
        return {
          items: hasUnknownProp(res, 'items') ? asArray<PeoplePickerItem>(res.items) : [],
          total: hasUnknownProp(res, 'total') ? asNumber(res.total) : 0,
        };
      }
    } catch {
      // fall back
    }
  }

  // Desktop safety: do not fall back to in-memory scans.
  if (isDesktop()) return { items: [], total: 0 };

  // Legacy fallback: in-memory (non-desktop)
  const q = String(payload?.query || '').trim().toLowerCase();
  const role = String(payload?.role || '').trim();
  const onlyIdleOwners = !!payload?.onlyIdleOwners;
  const address = String(payload?.address || '').trim().toLowerCase();
  const nationalId = String(payload?.nationalId || '').trim();
  const classification = String(payload?.classification || '').trim();
  const minRating = Number(payload?.minRating ?? 0) || 0;
  const offset = Math.max(0, Math.trunc(Number(payload?.offset) || 0));
  const limit = Math.max(1, Math.min(200, Math.trunc(Number(payload?.limit) || 48)));

  const people = DbService.getPeople();
  const properties = DbService.getProperties();

  let result = people.filter((p) => {
    const id = String(p.رقم_الشخص || '');
    if (role && role !== 'all') {
      if (role === 'blacklisted') {
        try {
          if (!DbService.getPersonBlacklistStatus(id)) return false;
        } catch {
          return false;
        }
      } else {
        try {
          const roles = DbService.getPersonRoles(id) || [];
          if (!roles.includes(role)) return false;
        } catch {
          return false;
        }
      }
    }

    if (onlyIdleOwners && role === 'مالك') {
      const ownerProps = properties.filter((pr) => String(pr.رقم_المالك) === id);
      return !ownerProps.some((pr) => String(pr.حالة_العقار || '').trim() === 'مؤجر' || pr.IsRented === true);
    }

    if (q) {
      const name = String(p.الاسم || '').toLowerCase();
      const phone = String(p.رقم_الهاتف || '');
      const nid = String(p.الرقم_الوطني || '');
      const ex = String(p.رقم_هاتف_اضافي || '');
      if (!name.includes(q) && !phone.includes(q) && !nid.includes(q) && !ex.includes(q)) return false;
    }

    if (address) {
      const a = String(p.العنوان || '').toLowerCase();
      if (!a.includes(address)) return false;
    }

    if (nationalId) {
      const nid2 = String(p.الرقم_الوطني || '');
      if (!nid2.includes(nationalId)) return false;
    }

    if (classification && classification !== 'All') {
      const cl = String(p.تصنيف || '');
      if (cl !== classification) return false;
    }

    if (minRating > 0) {
      const r = Number(p.تقييم ?? 0) || 0;
      if (r < minRating) return false;
    }

    return true;
  });

  const total = result.length;
  result = result.slice(offset, offset + limit);
  const items = result.map((p) => ({ person: p }));
  return { items, total };
}

export async function installmentsContractsPagedSmart(payload: {
  query?: string;
  filter?: 'all' | 'debt' | 'paid' | 'due' | string;
  offset?: number;
  limit?: number;
}): Promise<{
  items: InstallmentsContractsItem[];
  total: number;
  error?: string;
}> {
  if (isDesktop() && window.desktopDb?.domainInstallmentsContractsSearch) {
    try {
      const res: unknown = await window.desktopDb.domainInstallmentsContractsSearch(payload);
      if (isRecord(res) && hasUnknownProp(res, 'ok') && res.ok === true) {
        return {
          items: hasUnknownProp(res, 'items') ? asArray<InstallmentsContractsItem>(res.items) : [],
          total: hasUnknownProp(res, 'total') ? asNumber(res.total) : 0,
        };
      }

      // Desktop safety: do not fall back to in-memory scans; surface the error.
      if (isDesktop()) {
        return {
          items: [],
          total: 0,
          error: isRecord(res) && hasUnknownProp(res, 'message') ? asString(res.message) || 'فشل تحميل الدفعات (Desktop SQL)' : 'فشل تحميل الدفعات (Desktop SQL)',
        };
      }
    } catch {
      // fall back
    }
  }

  // Desktop safety: do not fall back to in-memory scans.
  if (isDesktop()) return { items: [], total: 0, error: 'المزامنة غير جاهزة أو الاستعلام غير متاح (Desktop)' };

  // Non-desktop fallback (web/mock): build a compact listing.
  try {
    const q = String(payload?.query || '').trim().toLowerCase();
    const filter = String(payload?.filter || 'all');
    const offset = Math.max(0, Math.trunc(Number(payload?.offset) || 0));
    const limit = Math.max(1, Math.min(200, Math.trunc(Number(payload?.limit) || 48)));

    const contracts = DbService.getContracts();
    const people = DbService.getPeople();
    const properties = DbService.getProperties();
    const installments = DbService.getInstallments();

    const now = Date.now();
    const in7 = now + 7 * 24 * 60 * 60 * 1000;
    const parseDate = (d: unknown) => {
      const s = String(d ?? '').trim();
      const t = Date.parse(s);
      return Number.isFinite(t) ? t : NaN;
    };

    const getRemaining = (inst: الكمبيالات_tbl) => Math.max(0, Number(inst?.القيمة_المتبقية ?? inst?.القيمة ?? 0) || 0);
    const isDueSoon = (inst: الكمبيالات_tbl) => {
      const rem = getRemaining(inst);
      if (rem <= 0) return false;
      const t = parseDate(inst?.تاريخ_استحقاق);
      if (!Number.isFinite(t)) return false;
      return t >= now && t <= in7;
    };
    const isDebt = (inst: الكمبيالات_tbl) => {
      const rem = getRemaining(inst);
      if (rem <= 0) return false;
      const t = parseDate(inst?.تاريخ_استحقاق);
      if (!Number.isFinite(t)) return false;
      return t < now;
    };

    let rows: InstallmentsContractsItem[] = contracts.map((c) => {
      const tenant = people.find((p) => String(p?.رقم_الشخص ?? '') === String(c?.رقم_المستاجر ?? ''));
      const property = properties.find((p) => String(p?.رقم_العقار ?? '') === String(c?.رقم_العقار ?? ''));
      const cInstalls = installments.filter((i) => String(i?.رقم_العقد ?? '') === String(c?.رقم_العقد ?? ''));

      const relevant = cInstalls;
      const hasAnyRelevant = relevant.length > 0;
      const hasDebt = relevant.some(isDebt);
      const hasDueSoon = relevant.some(isDueSoon);
      const isFullyPaid = hasAnyRelevant && relevant.every((i) => getRemaining(i) <= 0);

      return { contract: c, tenant, property, installments: cInstalls, hasDebt, hasDueSoon, isFullyPaid };
    });

    if (q) {
      rows = rows.filter((r) => {
        const byContract = String(r.contract?.رقم_العقد ?? '').toLowerCase().includes(q);
        const byTenant =
          String(r.tenant?.الاسم ?? '').toLowerCase().includes(q) || String(r.tenant?.رقم_الهاتف ?? '').includes(q);
        const byProp =
          String(r.property?.الكود_الداخلي ?? '').toLowerCase().includes(q) ||
          String(r.property?.العنوان ?? '').toLowerCase().includes(q);
        return byContract || byTenant || byProp;
      });
    }

    if (filter === 'debt') rows = rows.filter((r) => r.hasDebt);
    if (filter === 'due') rows = rows.filter((r) => r.hasDueSoon);
    if (filter === 'paid') rows = rows.filter((r) => r.isFullyPaid);

    const total = rows.length;
    const items = rows.slice(offset, offset + limit);
    return { items, total };
  } catch (e: unknown) {
    return {
      items: [],
      total: 0,
      error: isRecord(e) && hasUnknownProp(e, 'message') ? asString(e.message) || 'فشل تحميل الدفعات (Web)' : 'فشل تحميل الدفعات (Web)',
    };
  }
}

export async function domainGetSmart<E extends DomainEntity>(entity: E, id: string): Promise<DomainEntityMap[E] | null> {
  const safeId = String(id || '').trim();
  if (!safeId) return null;

  if (isDesktop() && window.desktopDb?.domainGet) {
    try {
      const res: unknown = await window.desktopDb.domainGet({ entity, id: safeId });
      if (isRecord(res) && hasUnknownProp(res, 'ok') && res.ok === true && hasUnknownProp(res, 'data')) {
        return (res.data ?? null) as DomainEntityMap[E] | null;
      }
    } catch {
      // fall back
    }
  }

  // Desktop safety: do not fall back to in-memory scans.
  if (isDesktop()) return null;

  // Legacy fallback
  if (entity === 'people') return (DbService.getPeople().find((p) => p.رقم_الشخص === safeId) || null) as DomainEntityMap[E] | null;
  if (entity === 'properties') return (DbService.getProperties().find((p) => p.رقم_العقار === safeId) || null) as DomainEntityMap[E] | null;
  return (DbService.getContracts().find((c) => c.رقم_العقد === safeId) || null) as DomainEntityMap[E] | null;
}

export async function propertyContractsSmart(
  propertyId: string,
  limit = 5000
): Promise<Array<{ contract: العقود_tbl; tenantName?: string; guarantorName?: string }> | null> {
  const pid = String(propertyId || '').trim();
  if (!pid) return null;

  if (isDesktop() && window.desktopDb?.domainPropertyContracts) {
    try {
      const res: unknown = await window.desktopDb.domainPropertyContracts({ propertyId: pid, limit });
      if (isRecord(res) && hasUnknownProp(res, 'ok') && res.ok === true) {
        return hasUnknownProp(res, 'items') ? asArray<{ contract: العقود_tbl; tenantName?: string; guarantorName?: string }>(res.items) : [];
      }
      return null;
    } catch {
      return null;
    }
  }

  // Desktop safety: do not fall back to in-memory scans.
  if (isDesktop()) return null;

  // Non-desktop fallback.
  try {
    const contracts = DbService.getContracts().filter((c) => String(c?.رقم_العقار ?? '') === pid);
    const people = DbService.getPeople();
    const items = contracts.slice(0, Math.max(1, Math.min(5000, Math.trunc(Number(limit) || 5000)))).map((c) => {
      const tenant = people.find((p) => String(p?.رقم_الشخص ?? '') === String(c?.رقم_المستاجر ?? ''));
      const guarantor = people.find((p) => String(p?.رقم_الشخص ?? '') === String(c?.رقم_الكفيل ?? ''));
      return {
        contract: c,
        tenantName: tenant ? String(tenant.الاسم || '').trim() || undefined : undefined,
        guarantorName: guarantor ? String(guarantor.الاسم || '').trim() || undefined : undefined,
      };
    });

    return items;
  } catch {
    return null;
  }
}
