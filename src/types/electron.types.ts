import type {
  ContractDetailsResult,
  ContractPickerItem,
  DomainEntity,
  DomainEntityMap,
  InstallmentsContractsItem,
  PeoplePickerItem,
  PersonDetailsResult,
  PropertyPickerItem,
  PropertyPickerSearchPayload,
} from '@/types/domain.types';
import type { الأشخاص_tbl, العقارات_tbl, العقود_tbl } from '@/types/types';

export interface DesktopDbBridge {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<boolean>;
  delete(key: string): Promise<boolean>;
  keys(): Promise<string[]>;
  resetAll(): Promise<{ deleted: number } | unknown>;
  export(): Promise<{
    success: boolean;
    message: string;
    path?: string;
    latestPath?: string;
    archivePath?: string;
    attachmentsLatestPath?: string;
    attachmentsArchivePath?: string;
  }>;
  import(): Promise<{
    success: boolean;
    message: string;
    path?: string;
    attachmentsRestored?: boolean;
  }>;
  getPath(): Promise<string>;
  getBackupDir?: () => Promise<string>;
  chooseBackupDir?: () => Promise<
    { success: boolean; message?: string; backupDir?: string } | unknown
  >;
  chooseDirectory?: () => Promise<{ success: boolean; path?: string; message?: string } | unknown>;
  getLocalBackupAutomationSettings?: () => Promise<
    | {
        v: 1;
        enabled?: boolean;
        timeHHmm?: string;
        retentionDays?: number;
        lastRunAt?: string;
        updatedAt?: string;
      }
    | unknown
  >;
  saveLocalBackupAutomationSettings?: (payload: {
    enabled?: boolean;
    timeHHmm?: string;
    retentionDays?: number;
  }) => Promise<
    | {
        success: boolean;
        message?: string;
        settings?: {
          v: 1;
          enabled?: boolean;
          timeHHmm?: string;
          retentionDays?: number;
          lastRunAt?: string;
          updatedAt?: string;
        };
      }
    | unknown
  >;
  runLocalBackupNow?: () => Promise<
    | {
        success: boolean;
        message?: string;
        latestPath?: string;
        archivePath?: string;
        attachmentsLatestPath?: string;
        attachmentsArchivePath?: string;
      }
    | unknown
  >;
  deleteLocalBackupFile?: (filePath: string) => Promise<{ success: boolean; message: string }>;
  restoreLocalBackupFile?: (filePath: string) => Promise<{ success: boolean; message: string }>;

  getLocalBackupStats?: () => Promise<
    | {
        ok: boolean;
        message?: string;
        backupDir?: string;
        dbArchivesCount: number;
        attachmentsArchivesCount: number;
        latestDbExists: boolean;
        latestAttachmentsExists: boolean;
        totalBytes: number;
        newestMtimeMs: number;
        files: Array<{ name: string; mtimeMs: number; size: number }>;
      }
    | unknown
  >;
  getLocalBackupLog?: (payload?: { limit?: number }) => Promise<
    | Array<{
        ts: string;
        ok: boolean;
        trigger: 'auto' | 'manual';
        message?: string;
        latestPath?: string;
        archivePath?: string;
        attachmentsLatestPath?: string;
        attachmentsArchivePath?: string;
      }>
    | unknown
  >;
  clearLocalBackupLog?: () => Promise<{ ok: boolean } | unknown>;
  getBackupEncryptionSettings?: () => Promise<
    | {
        success: boolean;
        message?: string;
        available?: boolean;
        enabled?: boolean;
        hasPassword?: boolean;
      }
    | unknown
  >;
  saveBackupEncryptionSettings?: (payload: {
    enabled?: boolean;
    password?: string;
    clearPassword?: boolean;
  }) => Promise<
    | {
        success: boolean;
        message?: string;
        available?: boolean;
        enabled?: boolean;
        hasPassword?: boolean;
      }
    | unknown
  >;

  // App helpers (Desktop only)
  getDeviceId?: () => Promise<string>;
  quitApp?: () => Promise<{ ok: boolean; message?: string } | unknown>;
  pickLicenseFile?: () => Promise<
    | { ok: boolean; canceled?: boolean; fileName?: string; content?: string; error?: string }
    | unknown
  >;
  getLicensePublicKey?: () => Promise<
    { ok: boolean; publicKeyB64?: string; source?: string; error?: string } | unknown
  >;
  pullAttachmentsNow: () => Promise<{
    success: boolean;
    message?: string;
    downloaded?: number;
    skipped?: number;
    missingRemote?: number;
  }>;

  // Domain schema + SQL-backed reports (Desktop only)
  domainStatus?: () => Promise<
    | {
        ok: boolean;
        schemaVersion?: number;
        migrated?: boolean;
        migratedAt?: string;
        message?: string;
      }
    | unknown
  >;
  domainMigrate?: () => Promise<
    { ok: boolean; message?: string; migrated?: boolean; counts?: Record<string, number> } | unknown
  >;
  runReport?: (
    id: string
  ) => Promise<{ ok: boolean; result?: unknown; message?: string } | unknown>;

  // Domain queries (Desktop only)
  domainSearchGlobal?: (query: string) => Promise<
    | {
        ok: boolean;
        people?: الأشخاص_tbl[];
        properties?: العقارات_tbl[];
        contracts?: العقود_tbl[];
        message?: string;
      }
    | unknown
  >;
  domainSearch?: <E extends DomainEntity>(payload: {
    entity: E;
    query: string;
    limit?: number;
  }) => Promise<{ ok: boolean; items?: Array<DomainEntityMap[E]>; message?: string } | unknown>;
  domainGet?: <E extends DomainEntity>(payload: {
    entity: E;
    id: string;
  }) => Promise<{ ok: boolean; data?: DomainEntityMap[E]; message?: string } | unknown>;

  domainCounts?: () => Promise<
    | {
        ok: boolean;
        counts?: { people: number; properties: number; contracts: number };
        message?: string;
      }
    | unknown
  >;

  domainDashboardSummary?: (payload: { todayYMD: string; weekYMD: string }) => Promise<
    | {
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
      }
    | unknown
  >;

  domainDashboardPerformance?: (payload: { monthKey: string; prevMonthKey: string }) => Promise<
    | {
        ok: boolean;
        data?: {
          currentMonthCollections: number;
          previousMonthCollections: number;
          paidCountThisMonth: number;
          dueUnpaidThisMonth: number;
        };
        message?: string;
      }
    | unknown
  >;

  domainDashboardHighlights?: (payload: { todayYMD: string }) => Promise<
    | {
        ok: boolean;
        data?: {
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
        message?: string;
      }
    | unknown
  >;

  domainPaymentNotificationTargets?: (payload: { daysAhead: number; todayYMD?: string }) => Promise<
    | {
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
      }
    | unknown
  >;

  domainPersonDetails?: (payload: { personId: string }) => Promise<
    | {
        ok: boolean;
        data?: PersonDetailsResult;
        message?: string;
      }
    | unknown
  >;

  domainPersonTenancyContracts?: (payload: { personId: string }) => Promise<
    | {
        ok: boolean;
        items?: Array<{
          contract: العقود_tbl;
          propertyCode?: string;
          propertyAddress?: string;
          tenantName?: string;
        }>;
        message?: string;
      }
    | unknown
  >;

  domainPropertyContracts?: (payload: { propertyId: string; limit?: number }) => Promise<
    | {
        ok: boolean;
        items?: Array<{ contract: العقود_tbl; tenantName?: string; guarantorName?: string }>;
        message?: string;
      }
    | unknown
  >;

  domainContractDetails?: (payload: {
    contractId: string;
  }) => Promise<{ ok: boolean; data?: ContractDetailsResult; message?: string } | unknown>;

  // Details panels helpers (Desktop fast mode)
  domainOwnershipHistory?: (payload: {
    propertyId?: string;
    personId?: string;
  }) => Promise<{ ok: boolean; items?: unknown[]; message?: string } | unknown>;
  domainPropertyInspections?: (payload: {
    propertyId: string;
  }) => Promise<{ ok: boolean; items?: unknown[]; message?: string } | unknown>;
  domainSalesForPerson?: (payload: {
    personId: string;
  }) => Promise<
    { ok: boolean; listings?: unknown[]; agreements?: unknown[]; message?: string } | unknown
  >;
  domainSalesForProperty?: (payload: {
    propertyId: string;
  }) => Promise<{ ok: boolean; items?: unknown[]; message?: string } | unknown>;

  // Mutations (Desktop fast mode)
  domainPeopleDelete?: (payload: {
    personId: string;
  }) => Promise<{ ok: boolean; message?: string } | unknown>;
  domainBlacklistRemove?: (payload: {
    id: string;
  }) => Promise<{ ok: boolean; message?: string } | unknown>;
  domainPropertyUpdate?: (payload: {
    propertyId: string;
    patch: Record<string, unknown>;
  }) => Promise<{ ok: boolean; data?: unknown; message?: string } | unknown>;
  domainInspectionDelete?: (payload: {
    id: string;
  }) => Promise<{ ok: boolean; message?: string } | unknown>;
  domainFollowUpAdd?: (payload: {
    task: Record<string, unknown>;
  }) => Promise<{ ok: boolean; id?: string; reminderId?: string; message?: string } | unknown>;
  domainSalesAgreementDelete?: (payload: {
    id: string;
  }) => Promise<{ ok: boolean; message?: string } | unknown>;

  // Picker search (Desktop only)
  domainPropertyPickerSearch?: (payload: PropertyPickerSearchPayload) => Promise<
    | {
        ok: boolean;
        items?: PropertyPickerItem[];
        total?: number;
        message?: string;
      }
    | unknown
  >;
  domainContractPickerSearch?: (payload: {
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
  }) => Promise<
    | {
        ok: boolean;
        items?: ContractPickerItem[];
        total?: number;
        message?: string;
      }
    | unknown
  >;

  domainPeoplePickerSearch?: (payload: {
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
  }) => Promise<
    | {
        ok: boolean;
        items?: PeoplePickerItem[];
        total?: number;
        message?: string;
      }
    | unknown
  >;

  domainInstallmentsContractsSearch?: (payload: {
    query?: string;
    filter?: 'all' | 'debt' | 'paid' | 'due' | string;
    sort?: string;
    offset?: number;
    limit?: number;
  }) => Promise<
    | {
        ok: boolean;
        items?: InstallmentsContractsItem[];
        total?: number;
        message?: string;
      }
    | unknown
  >;

  // SQL Server Sync (Desktop only)
  sqlGetSettings?: () => Promise<
    | {
        enabled: boolean;
        server: string;
        port?: number;
        database: string;
        authMode: 'sql' | 'windows';
        user?: string;
        encrypt?: boolean;
        trustServerCertificate?: boolean;
        hasPassword: boolean;
      }
    | unknown
  >;
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
  sqlStatus?: () => Promise<
    | {
        configured: boolean;
        enabled: boolean;
        connected: boolean;
        lastError?: string;
        lastSyncAt?: string;
      }
    | unknown
  >;
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

  sqlExportBackup?: () => Promise<
    { ok: boolean; message: string; filePath?: string; rowCount?: number } | unknown
  >;

  sqlImportBackup?: () => Promise<
    | { ok: boolean; message: string; filePath?: string; rowCount?: number; applied?: number }
    | unknown
  >;
  sqlRestoreBackup?: () => Promise<
    | { ok: boolean; message: string; filePath?: string; rowCount?: number; applied?: number }
    | unknown
  >;
  sqlSyncNow?: () => Promise<{ ok: boolean; message: string } | unknown>;

  sqlPullFullNow?: () => Promise<{ ok: boolean; message: string } | unknown>;

  sqlMergePublishAdmin?: (payload?: {
    keys?: string[];
    prefer?: 'local' | 'remote';
  }) => Promise<
    { ok: boolean; message: string; applied?: number; errors?: number; keys?: string[] } | unknown
  >;

  sqlGetSyncLog?: () => Promise<
    | {
        ok: boolean;
        items: Array<{
          id: string;
          ts: string;
          direction: 'push' | 'pull' | 'system';
          action: string;
          key?: string;
          status: 'ok' | 'error';
          message?: string;
        }>;
      }
    | unknown
  >;
  sqlClearSyncLog?: () => Promise<{ ok: boolean } | unknown>;

  sqlGetCoverage?: () => Promise<
    | {
        ok: boolean;
        remoteOk?: boolean;
        remoteMessage?: string;
        localCount?: number;
        remoteCount?: number;
        items?: Array<{
          key: string;
          localUpdatedAt?: string;
          localDeletedAt?: string;
          localBestTs?: string;
          localIsDeleted: boolean;
          localBytes: number;
          remoteUpdatedAt?: string;
          remoteIsDeleted?: boolean;
          status:
            | 'inSync'
            | 'localAhead'
            | 'remoteAhead'
            | 'missingRemote'
            | 'missingLocal'
            | 'different'
            | 'unknown';
        }>;
        message?: string;
      }
    | unknown
  >;

  // SQL Server Backups (stored on server)
  sqlGetBackupAutomationSettings?: () => Promise<
    | { ok: boolean; settings?: { enabled: boolean; retentionDays: number }; message?: string }
    | unknown
  >;
  sqlSaveBackupAutomationSettings?: (payload: {
    enabled?: boolean;
    retentionDays?: number;
  }) => Promise<
    | { ok: boolean; settings?: { enabled: boolean; retentionDays: number }; message?: string }
    | unknown
  >;
  sqlListServerBackups?: (payload?: { limit?: number }) => Promise<
    | {
        ok: boolean;
        items?: Array<{
          id: string;
          createdAt: string;
          createdBy?: string;
          rowCount?: number;
          payloadBytes?: number;
          note?: string;
        }>;
        message?: string;
      }
    | unknown
  >;
  sqlCreateServerBackup?: (payload?: { note?: string }) => Promise<
    | {
        ok: boolean;
        message: string;
        item?: {
          id: string;
          createdAt: string;
          createdBy?: string;
          rowCount?: number;
          payloadBytes?: number;
          note?: string;
        };
        deletedOld?: number;
      }
    | unknown
  >;
  sqlRestoreServerBackup?: (payload: {
    id: string;
    mode: 'merge' | 'replace';
  }) => Promise<{ ok: boolean; message: string; applied?: number; rowCount?: number } | unknown>;

  onRemoteUpdate?: (
    handler: (evt: { key: string; value?: string; isDeleted?: boolean; updatedAt?: string }) => void
  ) => () => void;

  onSqlSyncEvent?: (
    handler: (evt: {
      id: string;
      ts: string;
      direction: 'push' | 'pull' | 'system';
      action: string;
      key?: string;
      status: 'ok' | 'error';
      message?: string;
    }) => void
  ) => () => void;

  // Attachments (Desktop only)
  saveAttachmentFile?: (payload: {
    referenceType: string;
    entityFolder: string;
    originalFileName: string;
    bytes: ArrayBuffer;
  }) => Promise<{
    success: boolean;
    relativePath?: string;
    filePath?: string;
    storedFileName?: string;
    message?: string;
  }>;
  readAttachmentFile?: (
    relativePath: string
  ) => Promise<{ success: boolean; dataUri?: string; message?: string }>;
  deleteAttachmentFile?: (relativePath: string) => Promise<{ success: boolean; message?: string }>;
  openAttachmentFile?: (relativePath: string) => Promise<{ success: boolean; message?: string }>;

  // Word templates (Desktop only)
  readTemplateFile?: (payload: {
    templateName: string;
    templateType?: string;
  }) => Promise<{ success: boolean; dataUri?: string; fileName?: string; message?: string }>;
  listTemplates?: (payload?: { templateType?: string }) => Promise<{
    success: boolean;
    items?: string[];
    details?: Array<{ fileName: string; kvKey?: string; key?: string; updatedAt?: string }>;
    dir?: string;
    templateType?: string;
    message?: string;
  }>;
  importTemplate?: (payload?: { templateType?: string }) => Promise<{
    success: boolean;
    fileName?: string;
    dir?: string;
    templateType?: string;
    message?: string;
  }>;
  deleteTemplate?: (payload: {
    templateName: string;
    templateType?: string;
  }) => Promise<{ success: boolean; message?: string }>;
}

export interface DesktopUpdaterBridge {
  getVersion(): Promise<string>;
  getStatus(): Promise<
    { isPackaged: boolean; feedUrl?: string | null; lastEvent?: unknown } | unknown
  >;
  setFeedUrl(
    url: string
  ): Promise<{ success: boolean; message?: string; feedUrl?: string } | unknown>;
  check(): Promise<
    { success: boolean; message?: string; updateAvailable?: boolean; info?: unknown } | unknown
  >;
  download(): Promise<{ success: boolean; message?: string } | unknown>;
  install(): Promise<{ success: boolean; message?: string } | unknown>;
  installFromFile(): Promise<{ success: boolean; message?: string } | unknown>;
  getPendingRestore?(): Promise<
    | {
        pending: boolean;
        createdAt?: string;
        fromVersion?: string;
        dbBackupPath?: string;
        attachmentsBackupPath?: string;
        reason?: string;
      }
    | unknown
  >;
  clearPendingRestore?(): Promise<{ success: boolean; message?: string } | unknown>;
  restorePending?(): Promise<{ success: boolean; message?: string } | unknown>;
  onEvent?(handler: (evt: unknown) => void): () => void;
}

export type DesktopPrintEngineJob =
  | {
      type: 'currentView';
      mode: 'print';
    }
  | {
      type: 'text';
      mode: 'print';
      payload: {
        title?: string;
        text: string;
      };
    }
  | {
      type: 'docx';
      mode: 'docx';
      payload: {
        templateName?: string;
        data: Record<string, unknown>;
        defaultFileName?: string;
        headerFooter?: {
          headerEnabled?: boolean;
          footerEnabled?: boolean;
          headerTemplate?: string;
          footerTemplate?: string;
          companyName?: string;
          companySlogan?: string;
          companyIdentityText?: string;
          userName?: string;
          dateIso?: string;
        };
      };
    }
  | {
      type: 'generate';
      mode: 'generate';
      payload: {
        templateName?: string;
        data: Record<string, unknown>;
        outputType: 'docx' | 'pdf';
        defaultFileName?: string;
        headerFooter?: {
          headerEnabled?: boolean;
          footerEnabled?: boolean;
          headerTemplate?: string;
          footerTemplate?: string;
          companyName?: string;
          companySlogan?: string;
          companyIdentityText?: string;
          userName?: string;
          dateIso?: string;
        };
      };
    }
  | {
      type: 'report';
      mode: 'print' | 'pdf';
      payload: unknown;
    };

export type DesktopPrintEngineResult =
  | {
      ok: true;
      savedPath?: string;
      outputType?: 'docx' | 'pdf';
      tempPath?: string;
      fileName?: string;
    }
  | { ok: false; code: 'CANCELED' | 'FAILED' | 'INVALID' | string; message: string };

export interface DesktopPrintEngineBridge {
  run(job: DesktopPrintEngineJob): Promise<DesktopPrintEngineResult>;
}

export type DesktopPrintDispatchRequest =
  | {
      action: 'printCurrentView';
      documentType: string;
      entityId?: string;
      data?: Record<string, unknown>;
    }
  | {
      action: 'printText';
      documentType: string;
      entityId?: string;
      title?: string;
      text: string;
      data?: Record<string, unknown>;
    }
  | {
      action: 'generate';
      documentType: string;
      entityId?: string;
      templateName?: string;
      outputType: 'docx' | 'pdf';
      defaultFileName?: string;
      headerFooter?: {
        headerEnabled?: boolean;
        footerEnabled?: boolean;
        headerTemplate?: string;
        footerTemplate?: string;
        companyName?: string;
        companySlogan?: string;
        companyIdentityText?: string;
        userName?: string;
        dateIso?: string;
      };
      data: Record<string, unknown>;
    }
  | {
      action: 'exportDocx';
      documentType: string;
      entityId?: string;
      templateName?: string;
      defaultFileName?: string;
      headerFooter?: {
        headerEnabled?: boolean;
        footerEnabled?: boolean;
        headerTemplate?: string;
        footerTemplate?: string;
        companyName?: string;
        companySlogan?: string;
        companyIdentityText?: string;
        userName?: string;
        dateIso?: string;
      };
      data: Record<string, unknown>;
    };

export type DesktopPrintDispatchResult =
  | {
      ok: true;
      savedPath?: string;
      outputType?: 'docx' | 'pdf';
      tempPath?: string;
      fileName?: string;
    }
  | { ok: false; code: 'CANCELED' | 'FAILED' | 'INVALID' | 'FORBIDDEN' | string; message: string };

export interface DesktopPrintDispatchBridge {
  run(request: DesktopPrintDispatchRequest): Promise<DesktopPrintDispatchResult>;
}

export type DesktopPrintSettings = {
  pageSize: 'A4' | 'A5' | 'Letter' | 'Legal' | { widthMm: number; heightMm: number };
  orientation: 'portrait' | 'landscape';
  marginsMm: { top: number; right: number; bottom: number; left: number };
  fontFamily: string;
  rtl: boolean;
  headerEnabled: boolean;
  footerEnabled: boolean;
  pdfExport?: {
    sofficePath?: string;
  };
};

export type DesktopPrintSettingsGetResult =
  | { ok: true; settings: DesktopPrintSettings; filePath: string }
  | { ok: false; code: 'FAILED'; message: string };

export type DesktopPrintSettingsSaveResult =
  | { ok: true; filePath: string }
  | { ok: false; code: 'INVALID' | 'FAILED'; message: string };

export interface DesktopPrintSettingsBridge {
  get(): Promise<DesktopPrintSettingsGetResult>;
  save(settings: DesktopPrintSettings): Promise<DesktopPrintSettingsSaveResult>;
  getPath(): Promise<
    { ok: true; filePath: string } | { ok: false; code: 'FAILED'; message: string }
  >;
}

export type DesktopPrintPreviewOpenPayload = {
  templateName?: string;
  data: Record<string, unknown>;
  defaultFileName?: string;
  headerFooter?: {
    headerEnabled?: boolean;
    footerEnabled?: boolean;
    headerTemplate?: string;
    footerTemplate?: string;
    companyName?: string;
    companySlogan?: string;
    companyIdentityText?: string;
    userName?: string;
    dateIso?: string;
  };
};

export type DesktopPrintPreviewOpenResult =
  | { ok: true; sessionId: string }
  | { ok: false; code: 'CANCELED' | 'FAILED' | 'INVALID' | 'FORBIDDEN' | string; message: string };

export type DesktopPrintPreviewStateResult =
  | {
      ok: true;
      sessionId: string;
      pdfPath: string;
      pdfUrl: string;
      fileName: string;
      createdAtIso: string;
    }
  | { ok: false; code: 'FAILED' | 'INVALID' | 'FORBIDDEN' | string; message: string };

export type DesktopPrintPreviewActionResult =
  | { ok: true; savedPath?: string }
  | { ok: false; code: 'CANCELED' | 'FAILED' | 'INVALID' | 'FORBIDDEN' | string; message: string };

export type DesktopPreviewPrinterInfo = {
  name: string;
  displayName?: string;
  isDefault?: boolean;
};

export type DesktopPrintPreviewPrintersResult =
  | { ok: true; printers: DesktopPreviewPrinterInfo[] }
  | { ok: false; code: 'FAILED' | 'FORBIDDEN' | string; message: string };

export type DesktopPrintPreviewPrintOptions = {
  deviceName?: string;
  silent?: boolean;
  printBackground?: boolean;
};

export interface DesktopPrintPreviewBridge {
  open(payload: DesktopPrintPreviewOpenPayload): Promise<DesktopPrintPreviewOpenResult>;
  getState(sessionId: string): Promise<DesktopPrintPreviewStateResult>;
  listPrinters(): Promise<DesktopPrintPreviewPrintersResult>;
  print(
    sessionId: string,
    options?: DesktopPrintPreviewPrintOptions
  ): Promise<DesktopPrintPreviewActionResult>;
  exportPdf(sessionId: string): Promise<DesktopPrintPreviewActionResult>;
  exportDocx(sessionId: string): Promise<DesktopPrintPreviewActionResult>;
  reload(sessionId: string): Promise<DesktopPrintPreviewActionResult>;
}

export interface DesktopAuthBridge {
  setSessionUser(
    userId: string | null
  ): Promise<{ ok: true } | { ok: false; message?: string } | unknown>;
}

export interface DesktopLicenseBridge {
  getDeviceFingerprint: () => Promise<unknown>;
  getStatus: () => Promise<unknown>;
  hasFeature: (featureName: string) => Promise<unknown>;
  activateFromContent: (raw: string) => Promise<unknown>;
  activateOnline: (payload: { licenseKey: string; serverUrl?: string }) => Promise<unknown>;
  getServerUrl: () => Promise<unknown>;
  setServerUrl: (url: string) => Promise<unknown>;
  refreshOnlineStatus: () => Promise<unknown>;
  deactivate: () => Promise<unknown>;
}

export interface DesktopLicenseAdminBridge {
  login: (payload: { username: string; password: string }) => Promise<unknown>;
  logout: () => Promise<unknown>;
  getUser: () => Promise<unknown>;
  updateUser: (payload: { username: string; newPassword?: string }) => Promise<unknown>;
  getAdminTokenStatus: (payload: { serverUrl?: string }) => Promise<unknown>;
  setAdminToken: (payload: { token: string; serverUrl?: string }) => Promise<unknown>;
  list: (payload: { serverUrl: string; q?: string; limit?: number }) => Promise<unknown>;
  get: (payload: { serverUrl: string; licenseKey: string }) => Promise<unknown>;
  issue: (payload: Record<string, unknown>) => Promise<unknown>;
  setStatus: (payload: Record<string, unknown>) => Promise<unknown>;
  activate: (payload: {
    serverUrl: string;
    licenseKey: string;
    deviceId: string;
  }) => Promise<unknown>;
  checkStatus: (payload: {
    serverUrl: string;
    licenseKey: string;
    deviceId: string;
  }) => Promise<unknown>;
  delete: (payload: { serverUrl: string; licenseKey: string }) => Promise<unknown>;
  updateAfterSales: (payload: Record<string, unknown>) => Promise<unknown>;
  saveLicenseFile: (payload: {
    confirmPassword: string;
    content: string;
    defaultFileName?: string;
  }) => Promise<unknown>;
  unbindDevice?: (payload: Record<string, unknown>) => Promise<unknown>;
}

declare global {
  interface Window {
    desktopDb?: DesktopDbBridge;
    desktopUpdater?: DesktopUpdaterBridge;
    desktopPrintEngine?: DesktopPrintEngineBridge;
    desktopPrintDispatch?: DesktopPrintDispatchBridge;
    desktopPrintSettings?: DesktopPrintSettingsBridge;
    desktopPrintPreview?: DesktopPrintPreviewBridge;
    desktopAuth?: DesktopAuthBridge;
    desktopLicense?: DesktopLicenseBridge;
    desktopLicenseAdmin?: DesktopLicenseAdminBridge;
  }
}

export {};
