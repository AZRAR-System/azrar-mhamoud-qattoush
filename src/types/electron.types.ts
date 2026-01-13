export interface DesktopDbBridge {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<boolean>;
  delete(key: string): Promise<boolean>;
  keys(): Promise<string[]>;
  resetAll(): Promise<{ deleted: number } | unknown>;
  export(): Promise<{ success: boolean; message: string; path?: string; latestPath?: string; archivePath?: string }>;
  import(): Promise<{ success: boolean; message: string; path?: string }>;
  getPath(): Promise<string>;
  getBackupDir?: () => Promise<string>;
  chooseBackupDir?: () => Promise<{ success: boolean; message?: string; backupDir?: string } | unknown>;

  // Domain schema + SQL-backed reports (Desktop only)
  domainStatus?: () => Promise<{ ok: boolean; schemaVersion?: number; migrated?: boolean; migratedAt?: string; message?: string } | unknown>;
  domainMigrate?: () => Promise<{ ok: boolean; message?: string; migrated?: boolean; counts?: Record<string, number> } | unknown>;
  runReport?: (id: string) => Promise<{ ok: boolean; result?: unknown; message?: string } | unknown>;

  // Domain queries (Desktop only)
  domainSearchGlobal?: (query: string) => Promise<{ ok: boolean; people?: any[]; properties?: any[]; contracts?: any[]; message?: string } | unknown>;
  domainSearch?: (payload: { entity: 'people' | 'properties' | 'contracts'; query: string; limit?: number }) => Promise<{ ok: boolean; items?: any[]; message?: string } | unknown>;
  domainGet?: (payload: { entity: 'people' | 'properties' | 'contracts'; id: string }) => Promise<{ ok: boolean; data?: any; message?: string } | unknown>;

  domainCounts?: () => Promise<{ ok: boolean; counts?: { people: number; properties: number; contracts: number }; message?: string } | unknown>;

  domainDashboardSummary?: (payload: { todayYMD: string; weekYMD: string }) =>
    Promise<{
      ok: boolean;
      data?: {
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
      message?: string;
    } | unknown>;

  domainDashboardPerformance?: (payload: { monthKey: string; prevMonthKey: string }) =>
    Promise<{
      ok: boolean;
      data?: {
        currentMonthCollections: number;
        previousMonthCollections: number;
        paidCountThisMonth: number;
        dueUnpaidThisMonth: number;
      };
      message?: string;
    } | unknown>;

  domainDashboardHighlights?: (payload: { todayYMD: string }) =>
    Promise<{
      ok: boolean;
      data?: {
        dueInstallmentsToday: Array<{ contractId: string; tenantName: string; dueDate: string; remaining: number }>;
        expiringContracts: Array<{ contractId: string; propertyId: string; propertyCode: string; tenantId: string; tenantName: string; endDate: string }>;
        incompleteProperties: Array<{ propertyId: string; propertyCode: string; missingWater: boolean; missingElectric: boolean; missingArea: boolean }>;
      };
      message?: string;
    } | unknown>;

  domainPaymentNotificationTargets?: (payload: { daysAhead: number; todayYMD?: string }) =>
    Promise<{
      ok: boolean;
      items?: Array<{
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
      }>;
      message?: string;
    } | unknown>;

  domainPersonDetails?: (payload: { personId: string }) =>
    Promise<{
      ok: boolean;
      data?: {
        person: any;
        roles: string[];
        ownedProperties: any[];
        contracts: any[];
        blacklistRecord?: any;
        stats: {
          totalInstallments: number;
          lateInstallments: number;
          commitmentRatio: number;
        };
      };
      message?: string;
    } | unknown>;

  domainPersonTenancyContracts?: (payload: { personId: string }) =>
    Promise<{
      ok: boolean;
      items?: Array<{ contract: any; propertyCode?: string; propertyAddress?: string; tenantName?: string }>;
      message?: string;
    } | unknown>;

  domainPropertyContracts?: (payload: { propertyId: string; limit?: number }) =>
    Promise<{
      ok: boolean;
      items?: Array<{ contract: any; tenantName?: string; guarantorName?: string }>;
      message?: string;
    } | unknown>;

  // Picker search (Desktop only)
  domainPropertyPickerSearch?: (payload: {
    query: string;
    status?: string;
    type?: string;
    forceVacant?: boolean;
    occupancy?: 'all' | 'rented' | 'vacant';
    sale?: 'for-sale' | 'not-for-sale' | '';
    offset?: number;
    limit?: number;
  }) =>
    Promise<{
      ok: boolean;
      items?: Array<{ property: any; ownerName?: string; ownerPhone?: string; ownerNationalId?: string; active?: any }>;
      total?: number;
      message?: string;
    } | unknown>;
  domainContractPickerSearch?: (payload: { query: string; tab?: string; offset?: number; limit?: number }) =>
    Promise<{
      ok: boolean;
      items?: Array<{
        contract: any;
        propertyCode?: string;
        ownerName?: string;
        tenantName?: string;
        ownerNationalId?: string;
        tenantNationalId?: string;
        remainingAmount?: number;
      }>;
      total?: number;
      message?: string;
    } | unknown>;

  domainPeoplePickerSearch?: (payload: {
    query: string;
    role?: string;
    onlyIdleOwners?: boolean;
    address?: string;
    nationalId?: string;
    classification?: string;
    minRating?: number;
    offset?: number;
    limit?: number;
  }) =>
    Promise<{
      ok: boolean;
      items?: Array<{
        person: any;
        roles?: string[];
        isBlacklisted?: boolean;
        link?: {
          contractId: string;
          status?: string;
          propertyCode?: string;
          tenantName?: string;
          guarantorName?: string;
          source?: 'tenant' | 'guarantor' | 'owner' | '';
        } | null;
      }>;
      total?: number;
      message?: string;
    } | unknown>;

  domainInstallmentsContractsSearch?: (payload: { query?: string; filter?: 'all' | 'debt' | 'paid' | 'due' | string; offset?: number; limit?: number }) =>
    Promise<{
      ok: boolean;
      items?: Array<{
        contract: any;
        tenant?: any;
        property?: any;
        installments?: any[];
        hasDebt?: boolean;
        hasDueSoon?: boolean;
        isFullyPaid?: boolean;
      }>;
      total?: number;
      message?: string;
    } | unknown>;

  // SQL Server Sync (Desktop only)
  sqlGetSettings?: () => Promise<{
    enabled: boolean;
    server: string;
    port?: number;
    database: string;
    authMode: 'sql' | 'windows';
    user?: string;
    encrypt?: boolean;
    trustServerCertificate?: boolean;
    hasPassword: boolean;
  } | unknown>;
  sqlSaveSettings?: (settings: {
    enabled: boolean;
    server: string;
    port?: number;
    database: string;
    authMode: 'sql' | 'windows';
    user?: string;
    password?: string;
    encrypt?: boolean;
    trustServerCertificate?: boolean;
  }) => Promise<{ success: boolean; message?: string } | unknown>;
  sqlTestConnection?: (settings: {
    server: string;
    port?: number;
    database: string;
    authMode: 'sql' | 'windows';
    user?: string;
    password?: string;
    encrypt?: boolean;
    trustServerCertificate?: boolean;
  }) => Promise<{ ok: boolean; message: string } | unknown>;
  sqlConnect?: () => Promise<{ ok: boolean; message: string } | unknown>;
  sqlDisconnect?: () => Promise<{ success: boolean; message?: string } | unknown>;
  sqlStatus?: () => Promise<{ configured: boolean; enabled: boolean; connected: boolean; lastError?: string; lastSyncAt?: string } | unknown>;
  sqlProvision?: (payload: {
    server: string;
    port?: number;
    database?: string;
    encrypt?: boolean;
    trustServerCertificate?: boolean;
    adminUser: string;
    adminPassword: string;
    managerUser: string;
    managerPassword: string;
    employeeUser: string;
    employeePassword: string;
  }) => Promise<{ ok: boolean; message: string } | unknown>;

  sqlExportBackup?: () => Promise<{ ok: boolean; message: string; filePath?: string; rowCount?: number } | unknown>;

  sqlImportBackup?: () => Promise<{ ok: boolean; message: string; filePath?: string; rowCount?: number; applied?: number } | unknown>;
  sqlRestoreBackup?: () => Promise<{ ok: boolean; message: string; filePath?: string; rowCount?: number; applied?: number } | unknown>;
  sqlSyncNow?: () => Promise<{ ok: boolean; message: string } | unknown>;

  sqlGetSyncLog?: () => Promise<{ ok: boolean; items: Array<{ id: string; ts: string; direction: 'push' | 'pull' | 'system'; action: string; key?: string; status: 'ok' | 'error'; message?: string }> } | unknown>;
  sqlClearSyncLog?: () => Promise<{ ok: boolean } | unknown>;

  onRemoteUpdate?: (handler: (evt: { key: string; value?: string; isDeleted?: boolean; updatedAt?: string }) => void) => () => void;

  onSqlSyncEvent?: (handler: (evt: { id: string; ts: string; direction: 'push' | 'pull' | 'system'; action: string; key?: string; status: 'ok' | 'error'; message?: string }) => void) => () => void;

  // Attachments (Desktop only)
  saveAttachmentFile?: (payload: {
    referenceType: string;
    entityFolder: string;
    originalFileName: string;
    bytes: ArrayBuffer;
  }) => Promise<{ success: boolean; relativePath?: string; filePath?: string; storedFileName?: string; message?: string }>;
  readAttachmentFile?: (relativePath: string) => Promise<{ success: boolean; dataUri?: string; message?: string }>;
  deleteAttachmentFile?: (relativePath: string) => Promise<{ success: boolean; message?: string }>;

  // Word templates (Desktop only)
  readTemplateFile?: (payload: { templateName: string }) => Promise<{ success: boolean; dataUri?: string; fileName?: string; message?: string }>;
  listTemplates?: () => Promise<{ success: boolean; items?: string[]; message?: string }>;
  importTemplate?: () => Promise<{ success: boolean; fileName?: string; message?: string }>;
}

export interface DesktopUpdaterBridge {
  getVersion(): Promise<string>;
  getStatus(): Promise<{ isPackaged: boolean; feedUrl?: string | null; lastEvent?: unknown } | unknown>;
  setFeedUrl(url: string): Promise<{ success: boolean; message?: string; feedUrl?: string } | unknown>;
  check(): Promise<{ success: boolean; message?: string; updateAvailable?: boolean; info?: unknown } | unknown>;
  download(): Promise<{ success: boolean; message?: string } | unknown>;
  install(): Promise<{ success: boolean; message?: string } | unknown>;
  installFromFile(): Promise<{ success: boolean; message?: string } | unknown>;
  getPendingRestore?(): Promise<{ pending: boolean; createdAt?: string; fromVersion?: string; dbBackupPath?: string; attachmentsBackupPath?: string; reason?: string } | unknown>;
  clearPendingRestore?(): Promise<{ success: boolean; message?: string } | unknown>;
  restorePending?(): Promise<{ success: boolean; message?: string } | unknown>;
  onEvent?(handler: (evt: unknown) => void): () => void;
}

declare global {
  interface Window {
    desktopDb?: DesktopDbBridge;
    desktopUpdater?: DesktopUpdaterBridge;
  }
}

export {};
