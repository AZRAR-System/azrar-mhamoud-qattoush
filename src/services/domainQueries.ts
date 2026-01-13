import { DbService } from '@/services/mockDb';

export type DomainEntity = 'people' | 'properties' | 'contracts';

const isDesktop = () => typeof window !== 'undefined' && !!window.desktopDb;

export async function domainSearchGlobalSmart(query: string): Promise<{ people: any[]; properties: any[]; contracts: any[] }> {
  const q = String(query || '').trim();
  if (!q) return { people: [], properties: [], contracts: [] };

  if (isDesktop() && window.desktopDb?.domainSearchGlobal) {
    try {
      const res: any = await window.desktopDb.domainSearchGlobal(q);
      if (res?.ok) {
        return {
          people: Array.isArray(res.people) ? res.people : [],
          properties: Array.isArray(res.properties) ? res.properties : [],
          contracts: Array.isArray(res.contracts) ? res.contracts : [],
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

export async function domainSearchSmart(entity: DomainEntity, query: string, limit = 50): Promise<any[]> {
  const q = String(query || '').trim();
  const cap = Math.max(1, Math.min(200, Math.trunc(Number(limit) || 50)));

  if (isDesktop() && window.desktopDb?.domainSearch) {
    try {
      const res: any = await window.desktopDb.domainSearch({ entity, query: q, limit: cap });
      if (res?.ok && Array.isArray(res.items)) return res.items;
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
      .slice(0, cap);
  }
  if (entity === 'properties') {
    const lower = q.toLowerCase();
    return DbService.getProperties()
      .filter((p) => !q || p.الكود_الداخلي.toLowerCase().includes(lower) || String(p.العنوان || '').toLowerCase().includes(lower))
      .slice(0, cap);
  }
  const lower = q.toLowerCase();
  return DbService.getContracts()
    .filter((c) => !q || String(c.رقم_العقد || '').toLowerCase().includes(lower) || String(c.حالة_العقد || '').toLowerCase().includes(lower))
    .slice(0, cap);
}

export async function propertyPickerSearchSmart(payload: {
  query: string;
  status?: string;
  type?: string;
  forceVacant?: boolean;
  occupancy?: 'all' | 'rented' | 'vacant';
  sale?: 'for-sale' | 'not-for-sale' | '';
  limit?: number;
}): Promise<Array<{ property: any; ownerName?: string; active?: any }>> {
  if (isDesktop() && window.desktopDb?.domainPropertyPickerSearch) {
    try {
      const res: any = await window.desktopDb.domainPropertyPickerSearch(payload);
      if (res?.ok && Array.isArray(res.items)) return res.items;
    } catch {
      // fall back
    }
  }

  // Fallback: minimal, no joins.
  const props = await domainSearchSmart('properties', payload.query, payload.limit ?? 200);
  return props.map((p) => ({ property: p }));
}

export async function propertyPickerSearchPagedSmart(payload: {
  query: string;
  status?: string;
  type?: string;
  forceVacant?: boolean;
  occupancy?: 'all' | 'rented' | 'vacant';
  sale?: 'for-sale' | 'not-for-sale' | '';
  offset?: number;
  limit?: number;
}): Promise<{ items: Array<{ property: any; ownerName?: string; active?: any }>; total: number }> {
  if (isDesktop() && window.desktopDb?.domainPropertyPickerSearch) {
    try {
      const res: any = await window.desktopDb.domainPropertyPickerSearch(payload as any);
      if (res?.ok) {
        return {
          items: Array.isArray(res.items) ? res.items : [],
          total: Number(res.total || 0) || 0,
        };
      }
    } catch {
      // fall back
    }
  }

  const items = await propertyPickerSearchSmart(payload);
  return { items, total: items.length };
}

export async function contractPickerSearchSmart(payload: { query: string; limit?: number }): Promise<
  Array<{ contract: any; propertyCode?: string; ownerName?: string; tenantName?: string; ownerNationalId?: string; tenantNationalId?: string }>
> {
  if (isDesktop() && window.desktopDb?.domainContractPickerSearch) {
    try {
      const res: any = await window.desktopDb.domainContractPickerSearch(payload);
      if (res?.ok && Array.isArray(res.items)) return res.items;
    } catch {
      // fall back
    }
  }

  const contracts = await domainSearchSmart('contracts', payload.query, payload.limit ?? 200);
  return contracts.map((c) => ({ contract: c }));
}

export async function contractPickerSearchPagedSmart(payload: { query: string; tab?: string; offset?: number; limit?: number }): Promise<{
  items: Array<{ contract: any; propertyCode?: string; ownerName?: string; tenantName?: string; ownerNationalId?: string; tenantNationalId?: string; remainingAmount?: number }>;
  total: number;
  error?: string;
}> {
  if (isDesktop() && window.desktopDb?.domainContractPickerSearch) {
    try {
      const res: any = await window.desktopDb.domainContractPickerSearch(payload as any);
      if (res?.ok) {
        return {
          items: Array.isArray(res.items) ? res.items : [],
          total: Number(res.total || 0) || 0,
        };
      }

      // Desktop safety: do not fall back to in-memory scans; surface the error.
      if (isDesktop()) {
        return {
          items: [],
          total: 0,
          error: String(res?.message || '').trim() || 'فشل تحميل العقود (Desktop SQL)',
        };
      }
    } catch (e: any) {
      // Desktop safety: do not fall back to in-memory scans; surface the error.
      if (isDesktop()) {
        return {
          items: [],
          total: 0,
          error: String(e?.message || '').trim() || 'فشل تحميل العقود (Desktop SQL)',
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
      const res: any = await window.desktopDb.domainCounts();
      if (res?.ok && res?.counts) {
        return {
          people: Number(res.counts.people || 0) || 0,
          properties: Number(res.counts.properties || 0) || 0,
          contracts: Number(res.counts.contracts || 0) || 0,
        };
      }

      // Desktop: attempt one-time migrate/repair and retry.
      if (isDesktop() && window.desktopDb?.domainMigrate) {
        try {
          await window.desktopDb.domainMigrate();
          const again: any = await window.desktopDb.domainCounts();
          if (again?.ok && again?.counts) {
            return {
              people: Number(again.counts.people || 0) || 0,
              properties: Number(again.counts.properties || 0) || 0,
              contracts: Number(again.counts.contracts || 0) || 0,
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
}): Promise<{
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
} | null> {
  if (isDesktop() && window.desktopDb?.domainDashboardSummary) {
    try {
      const res: any = await window.desktopDb.domainDashboardSummary(payload as any);
      if (res?.ok && res?.data) return res.data;
    } catch {
      // fall back
    }
  }
  return null;
}

export async function dashboardPerformanceSmart(payload: {
  monthKey: string;
  prevMonthKey: string;
}): Promise<{
  currentMonthCollections: number;
  previousMonthCollections: number;
  paidCountThisMonth: number;
  dueUnpaidThisMonth: number;
} | null> {
  if (isDesktop() && window.desktopDb?.domainDashboardPerformance) {
    try {
      const res: any = await window.desktopDb.domainDashboardPerformance(payload as any);
      if (res?.ok && res?.data) return res.data;
    } catch {
      // fall back
    }
  }
  return null;
}

export async function dashboardHighlightsSmart(payload: {
  todayYMD: string;
}): Promise<{
  dueInstallmentsToday: Array<{ contractId: string; tenantName: string; dueDate: string; remaining: number }>;
  expiringContracts: Array<{ contractId: string; propertyId: string; propertyCode: string; tenantId: string; tenantName: string; endDate: string }>;
  incompleteProperties: Array<{ propertyId: string; propertyCode: string; missingWater: boolean; missingElectric: boolean; missingArea: boolean }>;
} | null> {
  if (isDesktop() && window.desktopDb?.domainDashboardHighlights) {
    try {
      const res: any = await window.desktopDb.domainDashboardHighlights(payload as any);
      if (res?.ok && res?.data) return res.data;
    } catch {
      // fall back
    }
  }
  return null;
}

export async function paymentNotificationTargetsSmart(payload: {
  daysAhead: number;
  todayYMD?: string;
}): Promise<
  | Array<{
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
    }>
  | null
> {
  if (isDesktop() && window.desktopDb?.domainPaymentNotificationTargets) {
    try {
      const res: any = await window.desktopDb.domainPaymentNotificationTargets(payload as any);
      if (res?.ok && Array.isArray(res.items)) return res.items;
    } catch {
      // fall back
    }
  }
  return null;
}

export async function personDetailsSmart(personId: string): Promise<any | null> {
  const id = String(personId || '').trim();
  if (!id) return null;

  if (isDesktop() && window.desktopDb?.domainPersonDetails) {
    try {
      const res: any = await window.desktopDb.domainPersonDetails({ personId: id } as any);
      if (res?.ok && res?.data) return res.data;
    } catch {
      // fall back
    }
  }

  return null;
}

export async function personTenancyContractsSmart(personId: string): Promise<
  Array<{ contract: any; propertyCode?: string; propertyAddress?: string; tenantName?: string }> | null
> {
  const id = String(personId || '').trim();
  if (!id) return null;

  if (isDesktop() && window.desktopDb?.domainPersonTenancyContracts) {
    try {
      const res: any = await window.desktopDb.domainPersonTenancyContracts({ personId: id } as any);
      if (res?.ok && Array.isArray(res.items)) return res.items;
    } catch {
      // fall back
    }
  }

  return null;
}

export async function contractDetailsSmart(contractId: string): Promise<
  | {
      contract: any;
      property?: any;
      tenant?: any;
      installments: any[];
    }
  | null
> {
  const cid = String(contractId || '').trim();
  if (!cid) return null;

  if (isDesktop() && (window as any)?.desktopDb?.domainContractDetails) {
    try {
      const res: any = await (window as any).desktopDb.domainContractDetails({ contractId: cid });
      if (res?.ok && res?.data) return res.data;
    } catch {
      // fall back
    }
  }

  // Desktop safety: do not fall back to in-memory scans.
  if (isDesktop()) return null;

  return (DbService.getContractDetails(cid) as any) || null;
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
}): Promise<{ items: Array<{ person: any; roles?: string[]; isBlacklisted?: boolean; link?: any }>; total: number }> {
  if (isDesktop() && window.desktopDb?.domainPeoplePickerSearch) {
    try {
      const res: any = await window.desktopDb.domainPeoplePickerSearch(payload as any);
      if (res?.ok) {
        return {
          items: Array.isArray(res.items) ? res.items : [],
          total: Number(res.total || 0) || 0,
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
      return !ownerProps.some((pr) => String(pr.حالة_العقار || '').trim() === 'مؤجر' || (pr as any).IsRented === true);
    }

    if (q) {
      const name = String(p.الاسم || '').toLowerCase();
      const phone = String(p.رقم_الهاتف || '');
      const nid = String((p as any).الرقم_الوطني || '');
      const ex = String((p as any).رقم_هاتف_اضافي || '');
      if (!name.includes(q) && !phone.includes(q) && !nid.includes(q) && !ex.includes(q)) return false;
    }

    if (address) {
      const a = String((p as any).العنوان || '').toLowerCase();
      if (!a.includes(address)) return false;
    }

    if (nationalId) {
      const nid2 = String((p as any).الرقم_الوطني || '');
      if (!nid2.includes(nationalId)) return false;
    }

    if (classification && classification !== 'All') {
      const cl = String((p as any).تصنيف || '');
      if (cl !== classification) return false;
    }

    if (minRating > 0) {
      const r = Number((p as any).تقييم ?? 0) || 0;
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
}): Promise<{ items: Array<{ contract: any; tenant?: any; property?: any; installments?: any[]; hasDebt?: boolean; hasDueSoon?: boolean; isFullyPaid?: boolean }>; total: number }> {
  if (isDesktop() && window.desktopDb?.domainInstallmentsContractsSearch) {
    try {
      const res: any = await window.desktopDb.domainInstallmentsContractsSearch(payload as any);
      if (res?.ok) {
        return {
          items: Array.isArray(res.items) ? res.items : [],
          total: Number(res.total || 0) || 0,
        };
      }
    } catch {
      // fall back
    }
  }
  return { items: [], total: 0 };
}

export async function domainGetSmart(entity: DomainEntity, id: string): Promise<any | null> {
  const safeId = String(id || '').trim();
  if (!safeId) return null;

  if (isDesktop() && window.desktopDb?.domainGet) {
    try {
      const res: any = await window.desktopDb.domainGet({ entity, id: safeId });
      if (res?.ok) return res.data ?? null;
    } catch {
      // fall back
    }
  }

  // Desktop safety: do not fall back to in-memory scans.
  if (isDesktop()) return null;

  // Legacy fallback
  if (entity === 'people') return DbService.getPeople().find((p) => p.رقم_الشخص === safeId) || null;
  if (entity === 'properties') return DbService.getProperties().find((p) => p.رقم_العقار === safeId) || null;
  return DbService.getContracts().find((c) => c.رقم_العقد === safeId) || null;
}

export async function propertyContractsSmart(propertyId: string, limit = 5000): Promise<Array<{ contract: any; tenantName?: string; guarantorName?: string }> | null> {
  const pid = String(propertyId || '').trim();
  if (!pid) return null;

  if (isDesktop() && window.desktopDb?.domainPropertyContracts) {
    try {
      const res: any = await window.desktopDb.domainPropertyContracts({ propertyId: pid, limit });
      if (res?.ok) return Array.isArray(res.items) ? res.items : [];
      return null;
    } catch {
      return null;
    }
  }

  return null;
}
