import {
  الأشخاص_tbl,
  العقارات_tbl,
  العقود_tbl,
  الكمبيالات_tbl,
  شخص_دور_tbl,
  العمولات_tbl,
  المستخدمين_tbl,
  مستخدم_صلاحية_tbl,
  tbl_Alerts,
  عروض_البيع_tbl,
  عروض_الشراء_tbl,
  اتفاقيات_البيع_tbl,
  تذاكر_الصيانة_tbl,
  سجل_الملكية_tbl,
} from '../types';
import { isBeforeTodayDateOnly, toDateOnlyISO } from '@/utils/dateOnly';
import { getInstallmentPaidAndRemaining } from '@/utils/installments';
import { isTenancyRelevant } from '@/utils/tenancy';

const getRaw = <T>(key: string): T[] => {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

function getOrCreateArray<K, V>(map: Map<K, V[]>, key: K): V[] {
  const existing = map.get(key);
  if (existing) return existing;
  const created: V[] = [];
  map.set(key, created);
  return created;
}

const KEYS = {
  PEOPLE: 'db_people',
  PROPERTIES: 'db_properties',
  CONTRACTS: 'db_contracts',
  INSTALLMENTS: 'db_installments',
  ROLES: 'db_roles',
  COMMISSIONS: 'db_commissions',
  USERS: 'db_users',
  USER_PERMISSIONS: 'db_user_permissions',
  ALERTS: 'db_alerts',
  SALES_LISTINGS: 'db_sales_listings',
  SALES_OFFERS: 'db_sales_offers',
  SALES_AGREEMENTS: 'db_sales_agreements',
  OWNERSHIP_HISTORY: 'db_ownership_history',
  MAINTENANCE: 'db_maintenance_tickets',
  LOGS: 'db_operations',
  LOOKUPS: 'db_lookups',
  LOOKUP_CATEGORIES: 'db_lookup_categories',
  BLACKLIST: 'db_blacklist',
  DYNAMIC_TABLES: 'db_dynamic_tables',
  DYNAMIC_RECORDS: 'db_dynamic_records',
  DYNAMIC_FORM_FIELDS: 'db_dynamic_form_fields',
  ATTACHMENTS: 'db_attachments',
  ACTIVITIES: 'db_activities',
  NOTES: 'db_notes',
  LEGAL_TEMPLATES: 'db_legal_templates',
  LEGAL_HISTORY: 'db_legal_history',
  EXTERNAL_COMMISSIONS: 'db_external_commissions',
  MARQUEE: 'db_marquee',
  DASHBOARD_CONFIG: 'db_dashboard_config',
  CLEARANCE_RECORDS: 'db_clearance_records',
};

export interface DashboardStats {
  activeContracts: number;
  expiredContracts: number;
  expiringSoonContracts: number;
  occupiedProps: number;
  vacantProps: number;
  totalCollected: number;
  totalDue: number;
  openAlerts: number;
  topDebtors: { name: string; amount: number }[];
  monthlyAttachments: number;
  maintenanceOpen: number;
  maintenanceHighPriority: number;
  salesActiveListings: number;
  salesPendingOffers: number;
  salesTotalRevenue: number;
  totalTenants: number;
}

interface Cache {
  isInitialized: boolean;
  lastUpdated: number;
  arrays: Record<string, unknown[]>; // Use unknown instead of any

  people: Map<string, الأشخاص_tbl>;
  properties: Map<string, العقارات_tbl>;
  contracts: Map<string, العقود_tbl>;
  installments: Map<string, الكمبيالات_tbl>;
  users: Map<string, المستخدمين_tbl>;
  alerts: Map<string, tbl_Alerts>;
  salesListings: Map<string, عروض_البيع_tbl>;
  maintenance: Map<string, تذاكر_الصيانة_tbl>;

  ownershipHistoryByPropertyId: Map<string, سجل_الملكية_tbl[]>;
  ownershipHistoryByPersonId: Map<string, سجل_الملكية_tbl[]>;

  rolesByPersonId: Map<string, شخص_دور_tbl[]>;
  propertiesByOwnerId: Map<string, العقارات_tbl[]>;
  contractsByTenantId: Map<string, العقود_tbl[]>;
  contractsByPropertyId: Map<string, العقود_tbl[]>;
  installmentsByContractId: Map<string, الكمبيالات_tbl[]>;
  commissionsByContractId: Map<string, العمولات_tbl[]>;
  usersByLinkedPersonId: Map<string, المستخدمين_tbl[]>;
  permissionsByUserId: Map<string, مستخدم_صلاحية_tbl[]>;

  contractsByStatus: Map<string, العقود_tbl[]>;
  propertiesByStatus: Map<string, العقارات_tbl[]>;
  installmentsByStatus: Map<string, الكمبيالات_tbl[]>;
  installmentsByDate: Map<string, الكمبيالات_tbl[]>;
  alertsByCategory: Map<string, tbl_Alerts[]>;

  ix_PropType: Map<string, العقارات_tbl[]>;
  ix_PropAttr: Map<string, العقارات_tbl[]>;

  ix_NationalId: Set<string>;
  ix_PhoneNumber: Set<string>;
  ix_PropertyInternalCode: Set<string>;
  ix_Username: Set<string>;

  dashboardStats: DashboardStats;
}

export const DbCache: Cache = {
  isInitialized: false,
  lastUpdated: 0,
  arrays: {},

  people: new Map(),
  properties: new Map(),
  contracts: new Map(),
  installments: new Map(),
  users: new Map(),
  alerts: new Map(),
  salesListings: new Map(),
  maintenance: new Map(),

  ownershipHistoryByPropertyId: new Map(),
  ownershipHistoryByPersonId: new Map(),

  rolesByPersonId: new Map(),
  propertiesByOwnerId: new Map(),
  contractsByTenantId: new Map(),
  contractsByPropertyId: new Map(),
  installmentsByContractId: new Map(),
  commissionsByContractId: new Map(),
  usersByLinkedPersonId: new Map(),
  permissionsByUserId: new Map(),

  contractsByStatus: new Map(),
  propertiesByStatus: new Map(),
  installmentsByStatus: new Map(),
  installmentsByDate: new Map(),
  alertsByCategory: new Map(),

  ix_PropType: new Map(),
  ix_PropAttr: new Map(),

  ix_NationalId: new Set(),
  ix_PhoneNumber: new Set(),
  ix_PropertyInternalCode: new Set(),
  ix_Username: new Set(),

  dashboardStats: {
    activeContracts: 0,
    expiredContracts: 0,
    expiringSoonContracts: 0,
    occupiedProps: 0,
    vacantProps: 0,
    totalCollected: 0,
    totalDue: 0,
    openAlerts: 0,
    topDebtors: [],
    monthlyAttachments: 0,
    maintenanceOpen: 0,
    maintenanceHighPriority: 0,
    salesActiveListings: 0,
    salesPendingOffers: 0,
    salesTotalRevenue: 0,
    totalTenants: 0,
  },
};

export function buildCache() {
  (Object.values(DbCache) as unknown[]).forEach((store) => {
    if (store instanceof Map) store.clear();
    if (store instanceof Set) store.clear();
  });
  DbCache.arrays = {};

  DbCache.dashboardStats = {
    activeContracts: 0,
    expiredContracts: 0,
    expiringSoonContracts: 0,
    occupiedProps: 0,
    vacantProps: 0,
    totalCollected: 0,
    totalDue: 0,
    openAlerts: 0,
    topDebtors: [],
    monthlyAttachments: 0,
    maintenanceOpen: 0,
    maintenanceHighPriority: 0,
    salesActiveListings: 0,
    salesPendingOffers: 0,
    salesTotalRevenue: 0,
    totalTenants: 0,
  };

  const load = <T>(key: string): T[] => {
    const data = getRaw<T>(key);
    DbCache.arrays[key] = data;
    return data;
  };

  const people = load<الأشخاص_tbl>(KEYS.PEOPLE);
  people.forEach((p) => {
    DbCache.people.set(p.رقم_الشخص, p);
    if (p.الرقم_الوطني) DbCache.ix_NationalId.add(p.الرقم_الوطني);
    if (p.رقم_الهاتف) DbCache.ix_PhoneNumber.add(p.رقم_الهاتف);
  });
  const properties = load<العقارات_tbl>(KEYS.PROPERTIES);
  properties.forEach((p) => {
    DbCache.properties.set(p.رقم_العقار, p);
    if (p.الكود_الداخلي) DbCache.ix_PropertyInternalCode.add(p.الكود_الداخلي);

    getOrCreateArray(DbCache.propertiesByOwnerId, p.رقم_المالك).push(p);

    getOrCreateArray(DbCache.propertiesByStatus, p.حالة_العقار).push(p);

    if (p.IsRented || p.حالة_العقار === 'مؤجر') DbCache.dashboardStats.occupiedProps++;
    else DbCache.dashboardStats.vacantProps++;

    if (p.النوع) {
      getOrCreateArray(DbCache.ix_PropType, p.النوع).push(p);
    }
    if (p.الصفة) {
      getOrCreateArray(DbCache.ix_PropAttr, p.الصفة).push(p);
    }
  });

  const contracts = load<العقود_tbl>(KEYS.CONTRACTS);
  const activeTenantIds = new Set<string>();

  contracts.forEach((c) => {
    DbCache.contracts.set(c.رقم_العقد, c);

    getOrCreateArray(DbCache.contractsByTenantId, c.رقم_المستاجر).push(c);

    getOrCreateArray(DbCache.contractsByPropertyId, c.رقم_العقار).push(c);

    getOrCreateArray(DbCache.contractsByStatus, c.حالة_العقد).push(c);

    if (!c.isArchived) {
      if (isTenancyRelevant(c)) {
        DbCache.dashboardStats.activeContracts++;
        if (c.رقم_المستاجر) activeTenantIds.add(c.رقم_المستاجر);
      }
      if (c.حالة_العقد === 'منتهي') DbCache.dashboardStats.expiredContracts++;
      if (c.حالة_العقد === 'قريب الانتهاء') DbCache.dashboardStats.expiringSoonContracts++;
    }
  });

  DbCache.dashboardStats.totalTenants = activeTenantIds.size;

  const installments = load<الكمبيالات_tbl>(KEYS.INSTALLMENTS);
  const debtMap = new Map<string, number>();

  installments.forEach((i) => {
    DbCache.installments.set(i.رقم_الكمبيالة, i);

    getOrCreateArray(DbCache.installmentsByContractId, i.رقم_العقد).push(i);

    getOrCreateArray(DbCache.installmentsByStatus, i.حالة_الكمبيالة).push(i);

    const dueKey = toDateOnlyISO(i.تاريخ_استحقاق) || i.تاريخ_استحقاق;
    getOrCreateArray(DbCache.installmentsByDate, dueKey).push(i);

    // Security deposit is a guarantee, not part of due/collected rent aggregates.
    const installmentType = (i as unknown as { نوع_الكمبيالة?: unknown }).نوع_الكمبيالة;
    if (String(installmentType ?? '').trim() === 'تأمين') return;

    const { remaining } = getInstallmentPaidAndRemaining(i);
    const total = Number(i.القيمة) || 0;

    if (remaining <= 0 || i.حالة_الكمبيالة === 'مدفوع') {
      DbCache.dashboardStats.totalCollected += total;
    } else {
      DbCache.dashboardStats.totalDue += remaining;
      if (isBeforeTodayDateOnly(i.تاريخ_استحقاق)) {
        const currentDebt = debtMap.get(i.رقم_العقد) || 0;
        debtMap.set(i.رقم_العقد, currentDebt + remaining);
      }
    }
  });

  // Ownership history indexes
  const ownership = load<سجل_الملكية_tbl>(KEYS.OWNERSHIP_HISTORY);
  ownership.forEach((r) => {
    getOrCreateArray(DbCache.ownershipHistoryByPropertyId, r.رقم_العقار).push(r);

    const p1 = r.رقم_المالك_القديم;
    const p2 = r.رقم_المالك_الجديد;
    if (p1) {
      getOrCreateArray(DbCache.ownershipHistoryByPersonId, p1).push(r);
    }
    if (p2 && p2 !== p1) {
      getOrCreateArray(DbCache.ownershipHistoryByPersonId, p2).push(r);
    }
  });

  const topDebtorsList: { name: string; amount: number }[] = [];
  debtMap.forEach((amount, contractId) => {
    const contract = DbCache.contracts.get(contractId);
    if (contract) {
      const tenant = DbCache.people.get(contract.رقم_المستاجر);
      const name = tenant ? tenant.الاسم : `Unknown (${contractId})`;
      topDebtorsList.push({ name, amount });
    }
  });
  DbCache.dashboardStats.topDebtors = topDebtorsList
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  const users = load<المستخدمين_tbl>(KEYS.USERS);
  users.forEach((u) => {
    DbCache.users.set(u.id, u);
    if (u.اسم_المستخدم) DbCache.ix_Username.add(u.اسم_المستخدم);

    if (u.linkedPersonId) {
      getOrCreateArray(DbCache.usersByLinkedPersonId, u.linkedPersonId).push(u);
    }
  });

  const roles = load<شخص_دور_tbl>(KEYS.ROLES);
  roles.forEach((r) => {
    getOrCreateArray(DbCache.rolesByPersonId, r.رقم_الشخص).push(r);
  });

  const commissions = load<العمولات_tbl>(KEYS.COMMISSIONS);
  commissions.forEach((c) => {
    getOrCreateArray(DbCache.commissionsByContractId, c.رقم_العقد).push(c);
  });

  const permissions = load<مستخدم_صلاحية_tbl>(KEYS.USER_PERMISSIONS);
  permissions.forEach((up) => {
    getOrCreateArray(DbCache.permissionsByUserId, up.userId).push(up);
  });

  const alerts = load<tbl_Alerts>(KEYS.ALERTS);
  alerts.forEach((a) => {
    DbCache.alerts.set(a.id, a);
    getOrCreateArray(DbCache.alertsByCategory, a.category).push(a);

    if (!a.تم_القراءة) DbCache.dashboardStats.openAlerts++;
  });

  const listings = load<عروض_البيع_tbl>(KEYS.SALES_LISTINGS);
  listings.forEach((l) => {
    DbCache.salesListings.set(l.id, l);
    if (l.الحالة === 'Active') DbCache.dashboardStats.salesActiveListings++;
  });

  const offers = load<عروض_الشراء_tbl>(KEYS.SALES_OFFERS);
  offers.forEach((o) => {
    if (o.الحالة === 'Pending') DbCache.dashboardStats.salesPendingOffers++;
  });

  const agreements = load<اتفاقيات_البيع_tbl>(KEYS.SALES_AGREEMENTS);
  agreements.forEach((a) => {
    if (a.isCompleted) DbCache.dashboardStats.salesTotalRevenue += Number(a.السعر_النهائي) || 0;
  });

  const maintenance = load<تذاكر_الصيانة_tbl>(KEYS.MAINTENANCE);
  maintenance.forEach((t) => {
    DbCache.maintenance.set(t.رقم_التذكرة, t);
    if (t.الحالة !== 'مغلق') {
      DbCache.dashboardStats.maintenanceOpen++;
      if (t.الأولوية === 'عالية') DbCache.dashboardStats.maintenanceHighPriority++;
    }
  });

  load(KEYS.LOGS);
  load(KEYS.LOOKUPS);
  load(KEYS.LOOKUP_CATEGORIES);
  load(KEYS.BLACKLIST);
  load(KEYS.DYNAMIC_TABLES);
  load(KEYS.DYNAMIC_RECORDS);
  load(KEYS.DYNAMIC_FORM_FIELDS);
  load(KEYS.ATTACHMENTS);
  load(KEYS.ACTIVITIES);
  load(KEYS.NOTES);
  load(KEYS.LEGAL_TEMPLATES);
  load(KEYS.LEGAL_HISTORY);
  load(KEYS.EXTERNAL_COMMISSIONS);
  load(KEYS.MARQUEE);
  load(KEYS.DASHBOARD_CONFIG);
  load(KEYS.CLEARANCE_RECORDS);

  DbCache.isInitialized = true;
  DbCache.lastUpdated = Date.now();
}

buildCache();
