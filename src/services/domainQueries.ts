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

import { INSTALLMENT_STATUS } from '@/components/installments/installmentsConstants';
import {
  getPaidAndRemaining,
  parseDateOnlyLocal,
  todayDateOnlyLocal,
} from '@/components/installments/installmentsUtils';
import { daysBetweenDateOnlySafe, todayDateOnlyISO } from '@/utils/dateOnly';
import { SearchEngine, type FilterRule } from '@/services/searchEngine';
import { normalizeDigitsLoose } from '@/utils/searchNormalize';
import { getInstallmentPaidAndRemaining } from '@/utils/installments';

export type DomainEntity = DomainEntityType;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

const hasUnknownProp = <K extends string>(
  obj: Record<string, unknown>,
  key: K
): obj is Record<string, unknown> & Record<K, unknown> =>
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
  dueInstallmentsToday: Array<{
    contractId: string;
    tenantName: string;
    dueDate: string;
    remaining: number;
  }>;
  expiringContracts: Array<{
    contractId: string;
    propertyId: string;
    propertyCode: string;
    tenantId: string;
    tenantName: string;
    endDate: string;
  }>;
  incompleteProperties: Array<{
    propertyId: string;
    propertyCode: string;
    missingWater: boolean;
    missingElectric: boolean;
    missingArea: boolean;
  }>;
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

export async function domainSearchGlobalSmart(
  query: string
): Promise<{ people: الأشخاص_tbl[]; properties: العقارات_tbl[]; contracts: العقود_tbl[] }> {
  const q = String(query || '').trim();
  if (!q) return { people: [], properties: [], contracts: [] };

  if (isDesktop() && window.desktopDb?.domainSearchGlobal) {
    try {
      const res: unknown = await window.desktopDb.domainSearchGlobal(q);
      if (isRecord(res) && hasUnknownProp(res, 'ok') && res.ok === true) {
        return {
          people:
            isRecord(res) && hasUnknownProp(res, 'people') ? asArray<الأشخاص_tbl>(res.people) : [],
          properties:
            isRecord(res) && hasUnknownProp(res, 'properties')
              ? asArray<العقارات_tbl>(res.properties)
              : [],
          contracts:
            isRecord(res) && hasUnknownProp(res, 'contracts')
              ? asArray<العقود_tbl>(res.contracts)
              : [],
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

export async function domainSearchSmart<E extends DomainEntity>(
  entity: E,
  query: string,
  limit = 50
): Promise<Array<DomainEntityMap[E]>> {
  const q = String(query || '').trim();
  const cap = Math.max(1, Math.min(200, Math.trunc(Number(limit) || 50)));

  if (isDesktop() && window.desktopDb?.domainSearch) {
    try {
      const res: unknown = await window.desktopDb.domainSearch({ entity, query: q, limit: cap });
      if (
        isRecord(res) &&
        hasUnknownProp(res, 'ok') &&
        res.ok === true &&
        hasUnknownProp(res, 'items')
      ) {
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
      .filter(
        (p) =>
          !q ||
          p.الاسم.toLowerCase().includes(lower) ||
          String(p.رقم_الهاتف || '').includes(lower) ||
          String(p.الرقم_الوطني || '').includes(lower)
      )
      .slice(0, cap) as Array<DomainEntityMap[E]>;
  }
  if (entity === 'properties') {
    const lower = q.toLowerCase();
    return DbService.getProperties()
      .filter(
        (p) =>
          !q ||
          p.الكود_الداخلي.toLowerCase().includes(lower) ||
          String(p.العنوان || '')
            .toLowerCase()
            .includes(lower)
      )
      .slice(0, cap) as Array<DomainEntityMap[E]>;
  }
  const lower = q.toLowerCase();
  return DbService.getContracts()
    .filter(
      (c) =>
        !q ||
        String(c.رقم_العقد || '')
          .toLowerCase()
          .includes(lower) ||
        String(c.حالة_العقد || '')
          .toLowerCase()
          .includes(lower)
    )
    .slice(0, cap) as Array<DomainEntityMap[E]>;
}

export async function propertyPickerSearchSmart(
  payload: PropertyPickerSearchPayload
): Promise<PropertyPickerItem[]> {
  if (isDesktop() && window.desktopDb?.domainPropertyPickerSearch) {
    try {
      const res: unknown = await window.desktopDb.domainPropertyPickerSearch(payload);
      if (
        isRecord(res) &&
        hasUnknownProp(res, 'ok') &&
        res.ok === true &&
        hasUnknownProp(res, 'items')
      ) {
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

export async function propertyPickerSearchPagedSmart(
  payload: PropertyPickerSearchPayload
): Promise<{ items: PropertyPickerItem[]; total: number }> {
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

export async function contractPickerSearchSmart(payload: {
  query: string;
  createdMonth?: string;
  startDateFrom?: string;
  startDateTo?: string;
  endDateFrom?: string;
  endDateTo?: string;
  minValue?: number | string;
  maxValue?: number | string;
  sort?: string;
  limit?: number;
}): Promise<Array<Omit<ContractPickerItem, 'remainingAmount'>>> {
  if (isDesktop() && window.desktopDb?.domainContractPickerSearch) {
    try {
      const res: unknown = await window.desktopDb.domainContractPickerSearch(payload);
      if (
        isRecord(res) &&
        hasUnknownProp(res, 'ok') &&
        res.ok === true &&
        hasUnknownProp(res, 'items')
      ) {
        return asArray<Omit<ContractPickerItem, 'remainingAmount'>>(res.items);
      }
    } catch {
      // fall back
    }
  }

  const contracts = await domainSearchSmart('contracts', payload.query, payload.limit ?? 200);
  return contracts.map((c) => ({ contract: c }));
}

/** When domain SQL is unavailable, page contracts from renderer KV (hydrated localStorage). */
function contractPickerSearchPagedMemoryFallback(payload: {
  query: string;
  tab?: string;
  createdMonth?: string;
  startDateFrom?: string;
  startDateTo?: string;
  endDateFrom?: string;
  endDateTo?: string;
  minValue?: number | string;
  maxValue?: number | string;
  sort?: string;
  offset?: number;
  limit?: number;
}): { items: ContractPickerItem[]; total: number } {
  const contracts = DbService.getContracts() || [];
  if (!contracts.length) return { items: [], total: 0 };

  const people = DbService.getPeople() || [];
  const properties = DbService.getProperties() || [];
  const installments = DbService.getInstallments() || [];

  const peopleNationalIdMap = new Map(
    people.map((p) => [String(p.رقم_الشخص), normalizeDigitsLoose(p.الرقم_الوطني)])
  );
  const peoplePhoneMap = new Map(
    people.map((p) => [String(p.رقم_الشخص), normalizeDigitsLoose(p.رقم_الهاتف)])
  );
  const peopleExtraPhoneMap = new Map(
    people.map((p) => [String(p.رقم_الشخص), normalizeDigitsLoose(p.رقم_هاتف_اضافي)])
  );
  const peopleNameMap = new Map(people.map((p) => [String(p.رقم_الشخص), String(p.الاسم || '')]));
  const propsCodeMap = new Map(
    properties.map((p) => [String(p.رقم_العقار), String(p.الكود_الداخلي || '')])
  );

  const remainingByContractId = new Map<string, number>();
  for (const inst of installments) {
    const contractId = String(inst?.رقم_العقد || '').trim();
    if (!contractId) continue;
    if (String(inst?.نوع_الكمبيالة || '').trim() === 'تأمين') continue;
    const { remaining } = getInstallmentPaidAndRemaining(inst);
    if (!remaining || remaining <= 0) continue;
    remainingByContractId.set(contractId, (remainingByContractId.get(contractId) || 0) + remaining);
  }

  const activeStatus = String(payload.tab || 'active').trim();
  const searchTerm = String(payload.query || '').trim();
  const createdMonth = String(payload.createdMonth || '').trim();
  const createdMonthApplied = /^\d{4}-\d{2}$/.test(createdMonth);
  const startDateFrom = String(payload.startDateFrom || '').trim();
  const startDateTo = String(payload.startDateTo || '').trim();
  const endDateFrom = String(payload.endDateFrom || '').trim();
  const endDateTo = String(payload.endDateTo || '').trim();
  const minValueNum = Number(payload.minValue ?? NaN);
  const maxValueNum = Number(payload.maxValue ?? NaN);
  const sortMode = String(payload.sort || 'created-desc').trim();

  let result = contracts.filter((c) => {
    if (activeStatus === 'archived') return !!c.isArchived;
    if (c.isArchived) return false;

    const status = String(c.حالة_العقد || '').trim();
    const isArchived = !!c.isArchived;

    switch (activeStatus) {
      case 'active':
        return (
          !isArchived &&
          (status === 'نشط' || status === 'Active' || status === 'قريب الانتهاء')
        );
      case 'expiring':
        return !isArchived && (status === 'قريب الانتهاء' || status === 'قريبة الانتهاء');
      case 'collection':
        return !isArchived && status === 'تحصيل';
      case 'expired':
        return !isArchived && (status === 'منتهي' || status === 'Expired');
      case 'terminated':
        return !isArchived && (status === 'مفسوخ' || status === 'Terminated');
      case 'archived':
        return isArchived || status === 'مؤرشف';
      default:
        return true;
    }
  });

  if (searchTerm.trim()) {
    const lower = searchTerm.toLowerCase();
    const needleDigits = normalizeDigitsLoose(searchTerm);
    result = result.filter((c) => {
      const tenantId = String(c.رقم_المستاجر);
      const tenantName = peopleNameMap.get(tenantId) || '';
      const tenantNationalId = peopleNationalIdMap.get(tenantId) || '';
      const tenantPhone = peoplePhoneMap.get(tenantId) || '';
      const tenantExtraPhone = peopleExtraPhoneMap.get(tenantId) || '';
      const propCode = propsCodeMap.get(String(c.رقم_العقار)) || '';
      const opp = String(c.رقم_الفرصة || '').trim();

      const matchesText =
        c.رقم_العقد.toLowerCase().includes(lower) ||
        tenantName.toLowerCase().includes(lower) ||
        propCode.toLowerCase().includes(lower) ||
        opp.toLowerCase().includes(lower);
      if (matchesText) return true;

      if (!needleDigits) return false;
      return (
        normalizeDigitsLoose(c.رقم_العقد).includes(needleDigits) ||
        normalizeDigitsLoose(opp).includes(needleDigits) ||
        tenantNationalId.includes(needleDigits) ||
        tenantPhone.includes(needleDigits) ||
        tenantExtraPhone.includes(needleDigits)
      );
    });
  }

  if (createdMonthApplied) {
    const targetYm = createdMonth;
    result = result.filter((c) => {
      const createdRaw = String(c.تاريخ_الانشاء || '').trim();
      const basis = /^\d{4}-\d{2}-\d{2}$/.test(createdRaw)
        ? createdRaw
        : String(c.تاريخ_البداية || '').trim();
      const ym = /^\d{4}-\d{2}-\d{2}$/.test(basis) ? basis.slice(0, 7) : '';
      return ym === targetYm;
    });
  }

  const rules: FilterRule[] = [];
  if (startDateFrom && startDateTo) {
    rules.push({
      field: 'تاريخ_البداية',
      operator: 'dateBetween',
      value: [startDateFrom, startDateTo],
    });
  }
  if (endDateFrom && endDateTo) {
    rules.push({
      field: 'تاريخ_النهاية',
      operator: 'dateBetween',
      value: [endDateFrom, endDateTo],
    });
  }
  if (Number.isFinite(minValueNum) && minValueNum > 0) {
    rules.push({ field: 'القيمة_السنوية', operator: 'gte', value: minValueNum });
  }
  if (Number.isFinite(maxValueNum) && maxValueNum > 0) {
    rules.push({ field: 'القيمة_السنوية', operator: 'lte', value: maxValueNum });
  }
  if (rules.length) result = SearchEngine.applyFilters(result, rules);

  const createdKey = (c: العقود_tbl) => {
    const createdRaw = String(c.تاريخ_الانشاء || '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(createdRaw)) return createdRaw;
    const start = String(c.تاريخ_البداية || '').trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(start) ? start : '';
  };
  const endKey = (c: العقود_tbl) => {
    const end = String(c.تاريخ_النهاية || '').trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(end) ? end : '';
  };

  const sorted = [...result];
  if (sortMode === 'created-asc') {
    sorted.sort(
      (a, b) =>
        createdKey(a).localeCompare(createdKey(b)) ||
        String(a.رقم_العقد || '').localeCompare(String(b.رقم_العقد || ''))
    );
  } else if (sortMode === 'end-asc') {
    sorted.sort(
      (a, b) =>
        endKey(a).localeCompare(endKey(b)) ||
        String(a.رقم_العقد || '').localeCompare(String(b.رقم_العقد || ''))
    );
  } else if (sortMode === 'end-desc') {
    sorted.sort(
      (a, b) =>
        endKey(b).localeCompare(endKey(a)) ||
        String(b.رقم_العقد || '').localeCompare(String(a.رقم_العقد || ''))
    );
  } else {
    sorted.sort(
      (a, b) =>
        createdKey(b).localeCompare(createdKey(a)) ||
        String(b.رقم_العقد || '').localeCompare(String(a.رقم_العقد || ''))
    );
  }

  const offset = Math.max(0, Math.trunc(Number(payload.offset) || 0));
  const limit = Math.max(1, Math.min(500, Math.trunc(Number(payload.limit) || 200)));
  const total = sorted.length;
  const page = sorted.slice(offset, offset + limit);

  const items: ContractPickerItem[] = page.map((c) => {
    const tenantId = String(c.رقم_المستاجر || '');
    const pid = String(c.رقم_العقار || '');
    const tenant = people.find((p) => String(p.رقم_الشخص) === tenantId);
    const prop = properties.find((p) => String(p.رقم_العقار) === pid);
    const ownerId = prop ? String(prop.رقم_المالك || '').trim() : '';
    const ownerPerson = ownerId ? people.find((p) => String(p.رقم_الشخص) === ownerId) : undefined;
    return {
      contract: c,
      propertyCode: prop ? String(prop.الكود_الداخلي || '') : '',
      ownerName: ownerPerson ? String(ownerPerson.الاسم || '') : '',
      tenantName: tenant ? String(tenant.الاسم || '') : '',
      ownerNationalId: ownerPerson ? String(ownerPerson.الرقم_الوطني || '') : '',
      tenantNationalId: tenant ? String(tenant.الرقم_الوطني || '') : '',
      remainingAmount: remainingByContractId.get(String(c.رقم_العقد || '').trim()) || 0,
    };
  });

  return { items, total };
}

export async function contractPickerSearchPagedSmart(payload: {
  query: string;
  tab?: string;
  createdMonth?: string;
  startDateFrom?: string;
  startDateTo?: string;
  endDateFrom?: string;
  endDateTo?: string;
  minValue?: number | string;
  maxValue?: number | string;
  sort?: string;
  offset?: number;
  limit?: number;
}): Promise<{
  items: ContractPickerItem[];
  total: number;
  error?: string;
}> {
  if (isDesktop() && window.desktopDb?.domainContractPickerSearch) {
    let sqlError = '';
    const trySql = async (): Promise<{ items: ContractPickerItem[]; total: number } | null> => {
      const res: unknown = await window.desktopDb!.domainContractPickerSearch!(payload);
      if (isRecord(res) && hasUnknownProp(res, 'ok') && res.ok === true) {
        return {
          items: hasUnknownProp(res, 'items') ? asArray<ContractPickerItem>(res.items) : [],
          total: hasUnknownProp(res, 'total') ? asNumber(res.total) : 0,
        };
      }
      sqlError =
        isRecord(res) && hasUnknownProp(res, 'message')
          ? asString(res.message) || 'فشل تحميل العقود (Desktop SQL)'
          : 'فشل تحميل العقود (Desktop SQL)';
      return null;
    };

    try {
      const first = await trySql();
      if (first) return first;

      if (window.desktopDb?.domainMigrate) {
        try {
          await window.desktopDb.domainMigrate();
          const second = await trySql();
          if (second) return second;
        } catch {
          // ignore
        }
      }

      const mem = contractPickerSearchPagedMemoryFallback(payload);
      if (mem.total > 0 || mem.items.length > 0) {
        return {
          ...mem,
          error: sqlError ? `${sqlError} — عرض احتياطي من البيانات المحلية.` : undefined,
        };
      }
      return { items: [], total: 0, error: sqlError || 'فشل تحميل العقود (Desktop SQL)' };
    } catch (e: unknown) {
      sqlError =
        isRecord(e) && hasUnknownProp(e, 'message')
          ? asString(e.message) || 'فشل تحميل العقود (Desktop SQL)'
          : 'فشل تحميل العقود (Desktop SQL)';
      const mem = contractPickerSearchPagedMemoryFallback(payload);
      if (mem.total > 0 || mem.items.length > 0) {
        return {
          ...mem,
          error: `${sqlError} — عرض احتياطي من البيانات المحلية.`,
        };
      }
      return { items: [], total: 0, error: sqlError };
    }
  }

  const items = await contractPickerSearchSmart(payload);
  return { items, total: items.length };
}

export async function domainCountsSmart(): Promise<{
  people: number;
  properties: number;
  contracts: number;
} | null> {
  if (isDesktop() && window.desktopDb?.domainCounts) {
    try {
      const res: unknown = await window.desktopDb.domainCounts();
      if (
        isRecord(res) &&
        hasUnknownProp(res, 'ok') &&
        res.ok === true &&
        hasUnknownProp(res, 'counts') &&
        isRecord(res.counts)
      ) {
        return {
          people: hasUnknownProp(res.counts, 'people') ? asNumber(res.counts.people) : 0,
          properties: hasUnknownProp(res.counts, 'properties')
            ? asNumber(res.counts.properties)
            : 0,
          contracts: hasUnknownProp(res.counts, 'contracts') ? asNumber(res.counts.contracts) : 0,
        };
      }

      // Desktop: attempt one-time migrate/repair and retry.
      if (isDesktop() && window.desktopDb?.domainMigrate) {
        try {
          await window.desktopDb.domainMigrate();
          const again: unknown = await window.desktopDb.domainCounts();
          if (
            isRecord(again) &&
            hasUnknownProp(again, 'ok') &&
            again.ok === true &&
            hasUnknownProp(again, 'counts') &&
            isRecord(again.counts)
          ) {
            return {
              people: hasUnknownProp(again.counts, 'people') ? asNumber(again.counts.people) : 0,
              properties: hasUnknownProp(again.counts, 'properties')
                ? asNumber(again.counts.properties)
                : 0,
              contracts: hasUnknownProp(again.counts, 'contracts')
                ? asNumber(again.counts.contracts)
                : 0,
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
      if (
        isRecord(res) &&
        hasUnknownProp(res, 'ok') &&
        res.ok === true &&
        hasUnknownProp(res, 'data')
      ) {
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
      if (
        isRecord(res) &&
        hasUnknownProp(res, 'ok') &&
        res.ok === true &&
        hasUnknownProp(res, 'data')
      ) {
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
      if (
        isRecord(res) &&
        hasUnknownProp(res, 'ok') &&
        res.ok === true &&
        hasUnknownProp(res, 'data')
      ) {
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
}): Promise<PaymentNotificationTarget[] | null> {
  if (isDesktop() && window.desktopDb?.domainPaymentNotificationTargets) {
    try {
      const res: unknown = await window.desktopDb.domainPaymentNotificationTargets(payload);
      if (
        isRecord(res) &&
        hasUnknownProp(res, 'ok') &&
        res.ok === true &&
        hasUnknownProp(res, 'items')
      ) {
        return asArray<PaymentNotificationTarget>(res.items);
      }
    } catch {
      // fall back
    }
  }

  if (!isDesktop()) {
    try {
      const raw: unknown = DbService.getPaymentNotificationTargets(
        Number(payload?.daysAhead ?? 7) || 7
      );
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
      if (
        isRecord(res) &&
        hasUnknownProp(res, 'ok') &&
        res.ok === true &&
        hasUnknownProp(res, 'data')
      ) {
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

export async function personTenancyContractsSmart(personId: string): Promise<Array<{
  contract: العقود_tbl;
  propertyCode?: string;
  propertyAddress?: string;
  tenantName?: string;
}> | null> {
  const id = String(personId || '').trim();
  if (!id) return null;

  if (isDesktop() && window.desktopDb?.domainPersonTenancyContracts) {
    try {
      const res: unknown = await window.desktopDb.domainPersonTenancyContracts({ personId: id });
      if (
        isRecord(res) &&
        hasUnknownProp(res, 'ok') &&
        res.ok === true &&
        hasUnknownProp(res, 'items')
      ) {
        return asArray<{
          contract: العقود_tbl;
          propertyCode?: string;
          propertyAddress?: string;
          tenantName?: string;
        }>(res.items);
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
        .sort((a, b) =>
          String(b?.تاريخ_البداية ?? '').localeCompare(String(a?.تاريخ_البداية ?? ''))
        )
        .map((c) => {
          const prop = properties.find(
            (p) => String(p?.رقم_العقار ?? '') === String(c?.رقم_العقار ?? '')
          );
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

export async function contractDetailsSmart(
  contractId: string
): Promise<ContractDetailsResult | null> {
  const cid = String(contractId || '').trim();
  if (!cid) return null;

  if (isDesktop() && window.desktopDb?.domainContractDetails) {
    try {
      const res: unknown = await window.desktopDb.domainContractDetails({ contractId: cid });
      if (
        isRecord(res) &&
        hasUnknownProp(res, 'ok') &&
        res.ok === true &&
        hasUnknownProp(res, 'data')
      ) {
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

type SimpleResult = { success: boolean; message: string };

const asSimpleResult = (
  res: unknown,
  successMessage: string,
  fallbackErrorMessage: string
): SimpleResult => {
  if (isRecord(res) && hasUnknownProp(res, 'ok') && res.ok === true) {
    const msg = isRecord(res) && hasUnknownProp(res, 'message') ? asString(res.message) : '';
    return { success: true, message: msg || successMessage };
  }
  const msg = isRecord(res) && hasUnknownProp(res, 'message') ? asString(res.message) : '';
  return { success: false, message: msg || fallbackErrorMessage };
};

export async function ownershipHistorySmart(payload: {
  propertyId?: string;
  personId?: string;
}): Promise<unknown[]> {
  const propertyId = asString(payload?.propertyId);
  const personId = asString(payload?.personId);

  if (isDesktop() && window.desktopDb?.domainOwnershipHistory) {
    try {
      const res: unknown = await window.desktopDb.domainOwnershipHistory({
        propertyId: propertyId || undefined,
        personId: personId || undefined,
      });
      if (
        isRecord(res) &&
        hasUnknownProp(res, 'ok') &&
        res.ok === true &&
        hasUnknownProp(res, 'items')
      ) {
        return asArray<unknown>(res.items);
      }
      // Desktop safety: do not fall back to in-memory scans.
      return [];
    } catch {
      return [];
    }
  }

  if (!isDesktop()) {
    try {
      return DbService.getOwnershipHistory(
        propertyId || undefined,
        personId || undefined
      ) as unknown[];
    } catch {
      return [];
    }
  }

  return [];
}

export async function propertyInspectionsSmart(propertyId: string): Promise<unknown[]> {
  const id = asString(propertyId);
  if (!id) return [];

  if (isDesktop() && window.desktopDb?.domainPropertyInspections) {
    try {
      const res: unknown = await window.desktopDb.domainPropertyInspections({ propertyId: id });
      if (
        isRecord(res) &&
        hasUnknownProp(res, 'ok') &&
        res.ok === true &&
        hasUnknownProp(res, 'items')
      ) {
        return asArray<unknown>(res.items);
      }
      return [];
    } catch {
      return [];
    }
  }

  if (!isDesktop()) {
    try {
      return DbService.getPropertyInspections(id) as unknown[];
    } catch {
      return [];
    }
  }

  return [];
}

export async function salesForPersonSmart(
  personId: string
): Promise<{ listings: unknown[]; agreements: unknown[] } | null> {
  const id = asString(personId);
  if (!id) return null;

  if (isDesktop() && window.desktopDb?.domainSalesForPerson) {
    try {
      const res: unknown = await window.desktopDb.domainSalesForPerson({ personId: id });
      if (isRecord(res) && hasUnknownProp(res, 'ok') && res.ok === true) {
        return {
          listings: hasUnknownProp(res, 'listings') ? asArray<unknown>(res.listings) : [],
          agreements: hasUnknownProp(res, 'agreements') ? asArray<unknown>(res.agreements) : [],
        };
      }
      return { listings: [], agreements: [] };
    } catch {
      return { listings: [], agreements: [] };
    }
  }

  if (!isDesktop()) {
    try {
      const listings = DbService.getSalesListings().filter(
        (l) => String((l as unknown as Record<string, unknown>)['رقم_المالك'] ?? '') === id
      );
      const agreements = DbService.getSalesAgreements();
      // Keep legacy consumer-side filtering/mapping in panels.
      return { listings: listings as unknown[], agreements: agreements as unknown[] };
    } catch {
      return { listings: [], agreements: [] };
    }
  }

  return { listings: [], agreements: [] };
}

export async function salesForPropertySmart(
  propertyId: string
): Promise<{ listings: unknown[]; agreements: unknown[] } | null> {
  const id = asString(propertyId);
  if (!id) return null;

  if (isDesktop() && window.desktopDb?.domainSalesForProperty) {
    try {
      const res: unknown = await window.desktopDb.domainSalesForProperty({ propertyId: id });
      if (isRecord(res) && hasUnknownProp(res, 'ok') && res.ok === true) {
        return {
          listings: hasUnknownProp(res, 'listings') ? asArray<unknown>(res.listings) : [],
          agreements: hasUnknownProp(res, 'agreements') ? asArray<unknown>(res.agreements) : [],
        };
      }
      return { listings: [], agreements: [] };
    } catch {
      return { listings: [], agreements: [] };
    }
  }

  if (!isDesktop()) {
    // Keep legacy consumer-side mapping in the panel.
    return { listings: [], agreements: [] };
  }

  return { listings: [], agreements: [] };
}

export async function removeFromBlacklistSmart(id: string): Promise<SimpleResult> {
  const pid = asString(id);
  if (!pid) return { success: false, message: 'معرف غير صالح' };

  if (isDesktop() && window.desktopDb?.domainBlacklistRemove) {
    try {
      const res: unknown = await window.desktopDb.domainBlacklistRemove({ id: pid });
      return asSimpleResult(res, 'تم رفع الحظر بنجاح', 'فشل رفع الحظر');
    } catch {
      return { success: false, message: 'فشل رفع الحظر' };
    }
  }

  try {
    DbService.removeFromBlacklist(pid);
    return { success: true, message: 'تم رفع الحظر بنجاح' };
  } catch {
    return { success: false, message: 'فشل رفع الحظر' };
  }
}

export async function deletePersonSmart(personId: string): Promise<SimpleResult> {
  const pid = asString(personId);
  if (!pid) return { success: false, message: 'معرف غير صالح' };

  if (isDesktop() && window.desktopDb?.domainPeopleDelete) {
    try {
      const res: unknown = await window.desktopDb.domainPeopleDelete({ personId: pid });
      return asSimpleResult(res, 'تم حذف الشخص', 'فشل حذف الشخص');
    } catch {
      return { success: false, message: 'فشل حذف الشخص' };
    }
  }

  try {
    const res = DbService.deletePerson(pid);
    return {
      success: Boolean((res as unknown as Record<string, unknown>)['success']),
      message: asString((res as unknown as Record<string, unknown>)['message']),
    };
  } catch {
    return { success: false, message: 'فشل حذف الشخص' };
  }
}

export async function updatePropertySmart(
  propertyId: string,
  patch: Record<string, unknown>
): Promise<SimpleResult> {
  const pid = asString(propertyId);
  if (!pid) return { success: false, message: 'معرف غير صالح' };

  if (isDesktop() && window.desktopDb?.domainPropertyUpdate) {
    try {
      const res: unknown = await window.desktopDb.domainPropertyUpdate({ propertyId: pid, patch });
      return asSimpleResult(res, 'تم تحديث العقار', 'فشل تحديث العقار');
    } catch {
      return { success: false, message: 'فشل تحديث العقار' };
    }
  }

  try {
    const res = DbService.updateProperty(pid, patch as never);
    return {
      success: Boolean((res as unknown as Record<string, unknown>)['success']),
      message:
        asString((res as unknown as Record<string, unknown>)['message']) || 'تم تحديث العقار',
    };
  } catch {
    return { success: false, message: 'فشل تحديث العقار' };
  }
}

export async function deleteInspectionSmart(id: string): Promise<SimpleResult> {
  const iid = asString(id);
  if (!iid) return { success: false, message: 'معرف غير صالح' };

  if (isDesktop() && window.desktopDb?.domainInspectionDelete) {
    try {
      const res: unknown = await window.desktopDb.domainInspectionDelete({ id: iid });
      return asSimpleResult(res, 'تم حذف الكشف', 'فشل حذف الكشف');
    } catch {
      return { success: false, message: 'فشل حذف الكشف' };
    }
  }

  try {
    const res = DbService.deleteInspection(iid);
    return {
      success: Boolean((res as unknown as Record<string, unknown>)['success']),
      message: asString((res as unknown as Record<string, unknown>)['message']),
    };
  } catch {
    return { success: false, message: 'فشل حذف الكشف' };
  }
}

export async function addFollowUpSmart(task: Record<string, unknown>): Promise<SimpleResult> {
  if (!isRecord(task)) return { success: false, message: 'بيانات غير صالحة' };

  if (isDesktop() && window.desktopDb?.domainFollowUpAdd) {
    try {
      const res: unknown = await window.desktopDb.domainFollowUpAdd({ task });
      return asSimpleResult(res, 'تم حفظ التذكير', 'فشل حفظ التذكير');
    } catch {
      return { success: false, message: 'فشل حفظ التذكير' };
    }
  }

  try {
    DbService.addFollowUp(task as never);
    return { success: true, message: 'تم حفظ التذكير' };
  } catch {
    return { success: false, message: 'فشل حفظ التذكير' };
  }
}

export async function deleteSalesAgreementSmart(id: string): Promise<SimpleResult> {
  const aid = asString(id);
  if (!aid) return { success: false, message: 'معرف غير صالح' };

  if (isDesktop() && window.desktopDb?.domainSalesAgreementDelete) {
    try {
      const res: unknown = await window.desktopDb.domainSalesAgreementDelete({ id: aid });
      return asSimpleResult(res, 'تم حذف الاتفاقية', 'فشل حذف الاتفاقية');
    } catch {
      return { success: false, message: 'فشل حذف الاتفاقية' };
    }
  }

  try {
    const res = DbService.deleteSalesAgreement(aid);
    return {
      success: Boolean((res as unknown as Record<string, unknown>)['success']),
      message: asString((res as unknown as Record<string, unknown>)['message']),
    };
  } catch {
    return { success: false, message: 'فشل حذف الاتفاقية' };
  }
}

export async function peoplePickerSearchPagedSmart(payload: {
  query: string;
  role?: string;
  onlyIdleOwners?: boolean;
  address?: string;
  nationalId?: string;
  classification?: string;
  minRating?: number;
  sort?: string;
  offset?: number;
  limit?: number;
}): Promise<{ items: PeoplePickerItem[]; total: number; error?: string }> {
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

  // Legacy fallback: in-memory (web + desktop when SQL path did not return rows)
  const q = String(payload?.query || '')
    .trim()
    .toLowerCase();
  const role = String(payload?.role || '').trim();
  const onlyIdleOwners = !!payload?.onlyIdleOwners;
  const address = String(payload?.address || '')
    .trim()
    .toLowerCase();
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
      return !ownerProps.some(
        (pr) => String(pr.حالة_العقار || '').trim() === 'مؤجر' || pr.IsRented === true
      );
    }

    if (q) {
      const name = String(p.الاسم || '').toLowerCase();
      const phone = String(p.رقم_الهاتف || '');
      const nid = String(p.الرقم_الوطني || '');
      const ex = String(p.رقم_هاتف_اضافي || '');
      if (!name.includes(q) && !phone.includes(q) && !nid.includes(q) && !ex.includes(q))
        return false;
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
  filterStartDate?: string;
  filterEndDate?: string;
  filterMinAmount?: number | '';
  filterMaxAmount?: number | '';
  filterPaymentMethod?: string;
  sort?: string;
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

      if (window.desktopDb?.domainMigrate) {
        try {
          await window.desktopDb.domainMigrate();
          const again: unknown = await window.desktopDb.domainInstallmentsContractsSearch(payload);
          if (isRecord(again) && hasUnknownProp(again, 'ok') && again.ok === true) {
            return {
              items: hasUnknownProp(again, 'items')
                ? asArray<InstallmentsContractsItem>(again.items)
                : [],
              total: hasUnknownProp(again, 'total') ? asNumber(again.total) : 0,
            };
          }
        } catch {
          // ignore
        }
      }
    } catch {
      // fall back to in-memory listing below
    }
  }

  // Non-desktop and desktop memory fallback (web/mock): build a compact listing.
  try {
    const q = String(payload?.query || '')
      .trim()
      .toLowerCase();
    const filter = String(payload?.filter || 'all');
    const filterStartDate = String(payload?.filterStartDate || '').trim();
    const filterEndDate = String(payload?.filterEndDate || '').trim();
    const filterMinAmount =
      payload?.filterMinAmount !== undefined && payload?.filterMinAmount !== ''
        ? Number(payload?.filterMinAmount)
        : NaN;
    const filterMaxAmount =
      payload?.filterMaxAmount !== undefined && payload?.filterMaxAmount !== ''
        ? Number(payload?.filterMaxAmount)
        : NaN;
    const filterPaymentMethod = String(payload?.filterPaymentMethod || 'all');
    const sort = String(payload?.sort || 'due-asc').trim();
    const offset = Math.max(0, Math.trunc(Number(payload?.offset) || 0));
    const limit = Math.max(1, Math.min(200, Math.trunc(Number(payload?.limit) || 48)));

    const contracts = DbService.getContracts();
    const people = DbService.getPeople();
    const properties = DbService.getProperties();
    const installments = DbService.getInstallments();

    const parseDate = (d: unknown) => {
      const s = String(d ?? '').trim();
      const t = Date.parse(s);
      return Number.isFinite(t) ? t : NaN;
    };

    const today = todayDateOnlyLocal();
    const isRealInstallment = (i: الكمبيالات_tbl) => {
      if (String(i?.نوع_الكمبيالة ?? '').trim() === 'تأمين') return false;
      return String(i?.حالة_الكمبيالة ?? '').trim() !== INSTALLMENT_STATUS.CANCELLED;
    };
    /** ذمم = دفعة غير مؤمنة/ملغاة، متبقٍ عليها مبلغ، وتاريخ استحقاق ≤ اليوم (لا تشمل المستقبل) */
    const isDebt = (inst: الكمبيالات_tbl) => {
      if (!isRealInstallment(inst)) return false;
      const { remaining } = getPaidAndRemaining(inst);
      if (remaining <= 0) return false;
      const due = parseDateOnlyLocal(inst?.تاريخ_استحقاق);
      if (!due) return false;
      return due.getTime() <= today.getTime();
    };
    const isDueSoon = (inst: الكمبيالات_tbl) => {
      if (!isRealInstallment(inst)) return false;
      const { remaining } = getPaidAndRemaining(inst);
      if (remaining <= 0) return false;
      const daysUntilDue = daysBetweenDateOnlySafe(todayDateOnlyISO(), inst?.تاريخ_استحقاق);
      if (typeof daysUntilDue !== 'number') return false;
      // "مستحق" = متأخر أو يستحق خلال 7 أيام (تقويم)
      return daysUntilDue <= 7;
    };

    let rows: InstallmentsContractsItem[] = contracts.map((c) => {
      const tenant = people.find(
        (p) => String(p?.رقم_الشخص ?? '') === String(c?.رقم_المستاجر ?? '')
      );
      const property = properties.find(
        (p) => String(p?.رقم_العقار ?? '') === String(c?.رقم_العقار ?? '')
      );
      const cInstalls = installments.filter(
        (i) => String(i?.رقم_العقد ?? '') === String(c?.رقم_العقد ?? '')
      );

      const relevant = cInstalls.filter(isRealInstallment);
      const hasAnyRelevant = relevant.length > 0;
      const hasDebt = relevant.some(isDebt);
      const hasDueSoon = relevant.some(isDueSoon);
      const isFullyPaid =
        hasAnyRelevant && relevant.every((i) => getPaidAndRemaining(i).remaining <= 0);

      return {
        contract: c,
        tenant,
        property,
        installments: cInstalls,
        hasDebt,
        hasDueSoon,
        isFullyPaid,
      };
    });

    if (q) {
      rows = rows.filter((r) => {
        const byContract = String(r.contract?.رقم_العقد ?? '')
          .toLowerCase()
          .includes(q);
        const byTenant =
          String(r.tenant?.الاسم ?? '')
            .toLowerCase()
            .includes(q) || String(r.tenant?.رقم_الهاتف ?? '').includes(q);
        const byProp =
          String(r.property?.الكود_الداخلي ?? '')
            .toLowerCase()
            .includes(q) ||
          String(r.property?.العنوان ?? '')
            .toLowerCase()
            .includes(q);
        return byContract || byTenant || byProp;
      });
    }

    if (filter === 'debt') rows = rows.filter((r) => r.hasDebt);
    if (filter === 'due') rows = rows.filter((r) => r.hasDueSoon);
    if (filter === 'paid') rows = rows.filter((r) => r.isFullyPaid);

    if (filterStartDate) {
      rows = rows.filter((r) =>
        r.installments.some((i) => String(i?.تاريخ_استحقاق || '') >= filterStartDate)
      );
    }
    if (filterEndDate) {
      rows = rows.filter((r) =>
        r.installments.some((i) => String(i?.تاريخ_استحقاق || '') <= filterEndDate)
      );
    }
    if (!Number.isNaN(filterMinAmount)) {
      rows = rows.filter((r) =>
        r.installments.some((i) => Number(i?.القيمة || 0) >= filterMinAmount)
      );
    }
    if (!Number.isNaN(filterMaxAmount)) {
      rows = rows.filter((r) =>
        r.installments.some((i) => Number(i?.القيمة || 0) <= filterMaxAmount)
      );
    }
    if (filterPaymentMethod !== 'all') {
      rows = rows.filter(
        (r) =>
          String(r.contract?.طريقة_الدفع || '').toLowerCase() === filterPaymentMethod.toLowerCase()
      );
    }

    const getNextDueTs = (installs: unknown[] | undefined) => {
      const list = Array.isArray(installs) ? installs : [];
      let bestUnpaid = Number.POSITIVE_INFINITY;
      let lastPaid = Number.NEGATIVE_INFINITY;
      let bestOverall = Number.POSITIVE_INFINITY;

      for (const it of list) {
        const inst = it as Partial<الكمبيالات_tbl>;
        if (String(inst?.نوع_الكمبيالة ?? '').trim() === 'تأمين') continue;
        if (String(inst?.حالة_الكمبيالة ?? '').trim() === 'ملغي') continue;

        const t = parseDate(inst?.تاريخ_استحقاق);
        if (!Number.isFinite(t)) continue;

        if (t < bestOverall) bestOverall = t;

        const remaining = Math.max(0, Number(inst?.القيمة_المتبقية ?? inst?.القيمة ?? 0) || 0);
        if (remaining > 0) {
          if (t < bestUnpaid) bestUnpaid = t;
        } else {
          if (t > lastPaid) lastPaid = t;
        }
      }

      if (Number.isFinite(bestUnpaid)) return bestUnpaid;
      if (Number.isFinite(lastPaid)) return lastPaid;
      if (Number.isFinite(bestOverall)) return bestOverall;
      return NaN;
    };

    rows.sort((a, b) => {
      if (sort === 'due-asc' || sort === 'due-desc') {
        const aTs = getNextDueTs(a.installments);
        const bTs = getNextDueTs(b.installments);
        const aHas = Number.isFinite(aTs);
        const bHas = Number.isFinite(bTs);
        if (aHas !== bHas) return aHas ? -1 : 1; // nulls last
        if (aHas && bHas && aTs !== bTs) return sort === 'due-asc' ? aTs - bTs : bTs - aTs;
      }

      if (sort === 'amount-asc' || sort === 'amount-desc') {
        const aVal = Number(a.contract?.القيمة_السنوية || 0);
        const bVal = Number(b.contract?.القيمة_السنوية || 0);
        if (aVal !== bVal) return sort === 'amount-asc' ? aVal - bVal : bVal - aVal;
      }

      const aName = String(a.tenant?.الاسم ?? '').trim();
      const bName = String(b.tenant?.الاسم ?? '').trim();
      if (sort === 'tenant-desc') {
        if (aName !== bName) return bName.localeCompare(aName, 'ar');
      } else {
        if (aName !== bName) return aName.localeCompare(bName, 'ar');
      }

      const aId = String(a.contract?.رقم_العقد ?? '').trim();
      const bId = String(b.contract?.رقم_العقد ?? '').trim();
      return aId.localeCompare(bId, 'ar');
    });

    const total = rows.length;
    const items = rows.slice(offset, offset + limit);
    return { items, total };
  } catch (e: unknown) {
    return {
      items: [],
      total: 0,
      error:
        isRecord(e) && hasUnknownProp(e, 'message')
          ? asString(e.message) || 'فشل تحميل الدفعات (Web)'
          : 'فشل تحميل الدفعات (Web)',
    };
  }
}

export async function domainGetSmart<E extends DomainEntity>(
  entity: E,
  id: string
): Promise<DomainEntityMap[E] | null> {
  const safeId = String(id || '').trim();
  if (!safeId) return null;

  if (isDesktop() && window.desktopDb?.domainGet) {
    try {
      const res: unknown = await window.desktopDb.domainGet({ entity, id: safeId });
      if (
        isRecord(res) &&
        hasUnknownProp(res, 'ok') &&
        res.ok === true &&
        hasUnknownProp(res, 'data')
      ) {
        return (res.data ?? null) as DomainEntityMap[E] | null;
      }
    } catch {
      // fall back
    }
  }

  // Desktop safety: do not fall back to in-memory scans.
  if (isDesktop()) return null;

  // Legacy fallback
  if (entity === 'people')
    return (DbService.getPeople().find((p) => p.رقم_الشخص === safeId) || null) as
      | DomainEntityMap[E]
      | null;
  if (entity === 'properties')
    return (DbService.getProperties().find((p) => p.رقم_العقار === safeId) || null) as
      | DomainEntityMap[E]
      | null;
  return (DbService.getContracts().find((c) => c.رقم_العقد === safeId) || null) as
    | DomainEntityMap[E]
    | null;
}

export async function propertyContractsSmart(
  propertyId: string,
  limit = 5000
): Promise<Array<{ contract: العقود_tbl; tenantName?: string; guarantorName?: string }> | null> {
  const pid = String(propertyId || '').trim();
  if (!pid) return null;

  if (isDesktop() && window.desktopDb?.domainPropertyContracts) {
    try {
      const res: unknown = await window.desktopDb.domainPropertyContracts({
        propertyId: pid,
        limit,
      });
      if (isRecord(res) && hasUnknownProp(res, 'ok') && res.ok === true) {
        return hasUnknownProp(res, 'items')
          ? asArray<{ contract: العقود_tbl; tenantName?: string; guarantorName?: string }>(
              res.items
            )
          : [];
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
    const items = contracts
      .slice(0, Math.max(1, Math.min(5000, Math.trunc(Number(limit) || 5000))))
      .map((c) => {
        const tenant = people.find(
          (p) => String(p?.رقم_الشخص ?? '') === String(c?.رقم_المستاجر ?? '')
        );
        const guarantor = people.find(
          (p) => String(p?.رقم_الشخص ?? '') === String(c?.رقم_الكفيل ?? '')
        );
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
