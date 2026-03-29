import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';

type SqlSettings = Record<string, unknown>;
type SqlProvisionPayload = Record<string, unknown>;
type SqlBackupAutomationSettingsPayload = Record<string, unknown>;
type RemoteUpdateEventPayload = {
  key: string;
  value?: string;
  isDeleted?: boolean;
  updatedAt?: string;
};

export type DbChannel =
  | 'db:get'
  | 'db:set'
  | 'db:delete'
  | 'db:keys'
  | 'db:resetAll'
  | 'db:export'
  | 'db:import'
  | 'db:getPath'
  | 'db:getBackupDir'
  | 'db:chooseBackupDir'
  | 'db:chooseDirectory'
  | 'db:getLocalBackupAutomationSettings'
  | 'db:saveLocalBackupAutomationSettings'
  | 'db:runLocalBackupNow'
  | 'db:getLocalBackupStats'
  | 'db:deleteLocalBackupFile'
  | 'db:restoreLocalBackupFile'
  | 'db:getLocalBackupLog'
  | 'db:clearLocalBackupLog'
  | 'db:getBackupEncryptionSettings'
  | 'db:saveBackupEncryptionSettings'
  | 'domain:status'
  | 'domain:migrate'
  | 'domain:searchGlobal'
  | 'domain:search'
  | 'domain:get'
  | 'domain:counts'
  | 'domain:dashboard:summary'
  | 'domain:dashboard:performance'
  | 'domain:dashboard:highlights'
  | 'domain:notifications:paymentTargets'
  | 'domain:person:details'
  | 'domain:person:tenancyContracts'
  | 'domain:property:contracts'
  | 'domain:contract:details'
  | 'domain:ownership:history'
  | 'domain:property:inspections'
  | 'domain:sales:person'
  | 'domain:sales:property'
  | 'domain:people:delete'
  | 'domain:blacklist:remove'
  | 'domain:property:update'
  | 'domain:inspection:delete'
  | 'domain:followups:add'
  | 'domain:sales:agreement:delete'
  | 'domain:picker:properties'
  | 'domain:picker:contracts'
  | 'domain:picker:people'
  | 'domain:installments:contracts'
  | 'reports:run'
  | 'sql:getSettings'
  | 'sql:saveSettings'
  | 'sql:test'
  | 'sql:connect'
  | 'sql:disconnect'
  | 'sql:status'
  | 'sql:provision'
  | 'sql:exportBackup'
  | 'sql:importBackup'
  | 'sql:restoreBackup'
  | 'sql:syncNow'
  | 'sql:getSyncLog'
  | 'sql:clearSyncLog'
  | 'sql:getCoverage'
  | 'sql:getBackupAutomationSettings'
  | 'sql:saveBackupAutomationSettings'
  | 'sql:listServerBackups'
  | 'sql:createServerBackup'
  | 'sql:restoreServerBackup'
  | 'sql:mergePublishAdmin';

export type PrintSettingsChannel =
  | 'print:settings:get'
  | 'print:settings:save'
  | 'print:settings:getPath';

export type PrintPreviewChannel =
  | 'print:preview:open'
  | 'print:preview:getState'
  | 'print:preview:listPrinters'
  | 'print:preview:print'
  | 'print:preview:exportPdf'
  | 'print:preview:exportDocx'
  | 'print:preview:reload';

export type AuthChannel = 'auth:session:set';
export type PrintDispatchChannel = 'print:dispatch';

contextBridge.exposeInMainWorld('desktopDb', {
  // App helpers
  getDeviceId: () => ipcRenderer.invoke('app:getDeviceId'),
  quitApp: () => ipcRenderer.invoke('app:quit'),
  pickLicenseFile: () => ipcRenderer.invoke('app:pickLicenseFile'),
  getLicensePublicKey: () => ipcRenderer.invoke('app:getLicensePublicKey'),

  get: (key: string) => ipcRenderer.invoke('db:get', key),
  set: (key: string, value: string) => ipcRenderer.invoke('db:set', key, value),
  delete: (key: string) => ipcRenderer.invoke('db:delete', key),
  keys: () => ipcRenderer.invoke('db:keys'),
  resetAll: () => ipcRenderer.invoke('db:resetAll'),
  export: () => ipcRenderer.invoke('db:export'),
  import: () => ipcRenderer.invoke('db:import'),
  getPath: () => ipcRenderer.invoke('db:getPath'),
  getBackupDir: () => ipcRenderer.invoke('db:getBackupDir'),
  chooseBackupDir: () => ipcRenderer.invoke('db:chooseBackupDir'),
  chooseDirectory: () => ipcRenderer.invoke('db:chooseDirectory'),
  getLocalBackupAutomationSettings: () => ipcRenderer.invoke('db:getLocalBackupAutomationSettings'),
  saveLocalBackupAutomationSettings: (payload: Record<string, unknown>) =>
    ipcRenderer.invoke('db:saveLocalBackupAutomationSettings', payload),
  runLocalBackupNow: () => ipcRenderer.invoke('db:runLocalBackupNow'),
  getLocalBackupStats: () => ipcRenderer.invoke('db:getLocalBackupStats'),
  deleteLocalBackupFile: (filePath: string) =>
    ipcRenderer.invoke('db:deleteLocalBackupFile', filePath),
  restoreLocalBackupFile: (filePath: string) =>
    ipcRenderer.invoke('db:restoreLocalBackupFile', filePath),
  getLocalBackupLog: (payload: Record<string, unknown>) =>
    ipcRenderer.invoke('db:getLocalBackupLog', payload),
  clearLocalBackupLog: () => ipcRenderer.invoke('db:clearLocalBackupLog'),
  getBackupEncryptionSettings: () => ipcRenderer.invoke('db:getBackupEncryptionSettings'),
  saveBackupEncryptionSettings: (payload: Record<string, unknown>) =>
    ipcRenderer.invoke('db:saveBackupEncryptionSettings', payload),

  // Domain schema + SQL reports (Desktop)
  domainStatus: () => ipcRenderer.invoke('domain:status'),
  domainMigrate: () => ipcRenderer.invoke('domain:migrate'),
  runReport: (id: string) => ipcRenderer.invoke('reports:run', { id }),

  // Domain queries (Desktop)
  domainSearchGlobal: (query: string) => ipcRenderer.invoke('domain:searchGlobal', { query }),
  domainSearch: (payload: {
    entity: 'people' | 'properties' | 'contracts';
    query: string;
    limit?: number;
  }) => ipcRenderer.invoke('domain:search', payload),
  domainGet: (payload: { entity: 'people' | 'properties' | 'contracts'; id: string }) =>
    ipcRenderer.invoke('domain:get', payload),

  domainCounts: () => ipcRenderer.invoke('domain:counts'),

  domainDashboardSummary: (payload: { todayYMD: string; weekYMD: string }) =>
    ipcRenderer.invoke('domain:dashboard:summary', payload),
  domainDashboardPerformance: (payload: { monthKey: string; prevMonthKey: string }) =>
    ipcRenderer.invoke('domain:dashboard:performance', payload),
  domainDashboardHighlights: (payload: { todayYMD: string }) =>
    ipcRenderer.invoke('domain:dashboard:highlights', payload),

  domainPaymentNotificationTargets: (payload: { daysAhead: number; todayYMD?: string }) =>
    ipcRenderer.invoke('domain:notifications:paymentTargets', payload),

  domainPersonDetails: (payload: { personId: string }) =>
    ipcRenderer.invoke('domain:person:details', payload),
  domainPersonTenancyContracts: (payload: { personId: string }) =>
    ipcRenderer.invoke('domain:person:tenancyContracts', payload),

  domainPropertyContracts: (payload: { propertyId: string; limit?: number }) =>
    ipcRenderer.invoke('domain:property:contracts', payload),

  domainContractDetails: (payload: { contractId: string }) =>
    ipcRenderer.invoke('domain:contract:details', payload),

  // Domain helpers for details panels (Desktop fast mode)
  domainOwnershipHistory: (payload: { propertyId?: string; personId?: string }) =>
    ipcRenderer.invoke('domain:ownership:history', payload),
  domainPropertyInspections: (payload: { propertyId: string }) =>
    ipcRenderer.invoke('domain:property:inspections', payload),
  domainSalesForPerson: (payload: { personId: string }) =>
    ipcRenderer.invoke('domain:sales:person', payload),
  domainSalesForProperty: (payload: { propertyId: string }) =>
    ipcRenderer.invoke('domain:sales:property', payload),

  // Domain mutations (Desktop fast mode)
  domainPeopleDelete: (payload: { personId: string }) =>
    ipcRenderer.invoke('domain:people:delete', payload),
  domainBlacklistRemove: (payload: { id: string }) =>
    ipcRenderer.invoke('domain:blacklist:remove', payload),
  domainPropertyUpdate: (payload: { propertyId: string; patch: Record<string, unknown> }) =>
    ipcRenderer.invoke('domain:property:update', payload),
  domainInspectionDelete: (payload: { id: string }) =>
    ipcRenderer.invoke('domain:inspection:delete', payload),
  domainFollowUpAdd: (payload: { task: Record<string, unknown> }) =>
    ipcRenderer.invoke('domain:followups:add', payload),
  domainSalesAgreementDelete: (payload: { id: string }) =>
    ipcRenderer.invoke('domain:sales:agreement:delete', payload),

  domainPropertyPickerSearch: (payload: {
    query: string;
    status?: string;
    type?: string;
    furnishing?: string;
    forceVacant?: boolean;
    occupancy?: 'all' | 'rented' | 'vacant';
    sale?: 'for-sale' | 'not-for-sale' | '';
    rent?: 'for-rent' | 'not-for-rent' | '';
    minArea?: string;
    maxArea?: string;
    floor?: string;
    minPrice?: string;
    maxPrice?: string;
    contractLink?: '' | 'linked' | 'unlinked' | 'all';
    sort?: string;
    offset?: number;
    limit?: number;
  }) => ipcRenderer.invoke('domain:picker:properties', payload),
  domainContractPickerSearch: (payload: {
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
  }) => ipcRenderer.invoke('domain:picker:contracts', payload),
  domainPeoplePickerSearch: (payload: {
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
  }) => ipcRenderer.invoke('domain:picker:people', payload),

  domainInstallmentsContractsSearch: (payload: {
    query?: string;
    filter?: string;
    sort?: string;
    offset?: number;
    limit?: number;
  }) => ipcRenderer.invoke('domain:installments:contracts', payload),

  // SQL Server Sync (Desktop only)
  sqlGetSettings: () => ipcRenderer.invoke('sql:getSettings'),
  sqlSaveSettings: (settings: SqlSettings) => ipcRenderer.invoke('sql:saveSettings', settings),
  sqlTestConnection: (settings: SqlSettings) => ipcRenderer.invoke('sql:test', settings),
  sqlConnect: () => ipcRenderer.invoke('sql:connect'),
  sqlDisconnect: () => ipcRenderer.invoke('sql:disconnect'),
  sqlStatus: () => ipcRenderer.invoke('sql:status'),
  sqlProvision: (payload: SqlProvisionPayload) => ipcRenderer.invoke('sql:provision', payload),
  sqlExportBackup: () => ipcRenderer.invoke('sql:exportBackup'),
  sqlImportBackup: () => ipcRenderer.invoke('sql:importBackup'),
  sqlRestoreBackup: () => ipcRenderer.invoke('sql:restoreBackup'),
  sqlSyncNow: () => ipcRenderer.invoke('sql:syncNow'),
  sqlGetSyncLog: () => ipcRenderer.invoke('sql:getSyncLog'),
  sqlClearSyncLog: () => ipcRenderer.invoke('sql:clearSyncLog'),
  sqlGetCoverage: () => ipcRenderer.invoke('sql:getCoverage'),
  sqlPullFullNow: () => ipcRenderer.invoke('sql:pullFullNow'),
  sqlMergePublishAdmin: (payload?: { keys?: string[]; prefer?: 'local' | 'remote' }) =>
    ipcRenderer.invoke('sql:mergePublishAdmin', payload),

  sqlGetBackupAutomationSettings: () => ipcRenderer.invoke('sql:getBackupAutomationSettings'),
  sqlSaveBackupAutomationSettings: (payload: SqlBackupAutomationSettingsPayload) =>
    ipcRenderer.invoke('sql:saveBackupAutomationSettings', payload),
  sqlListServerBackups: (payload?: { limit?: number }) =>
    ipcRenderer.invoke('sql:listServerBackups', payload),
  sqlCreateServerBackup: (payload?: { note?: string }) =>
    ipcRenderer.invoke('sql:createServerBackup', payload),
  sqlRestoreServerBackup: (payload: { id: string; mode: 'merge' | 'replace' }) =>
    ipcRenderer.invoke('sql:restoreServerBackup', payload),

  onRemoteUpdate: (handler: (evt: RemoteUpdateEventPayload) => void) => {
    const listener = (_e: IpcRendererEvent, payload: unknown) =>
      handler(payload as RemoteUpdateEventPayload);
    ipcRenderer.on('db:remoteUpdate', listener);
    return () => ipcRenderer.removeListener('db:remoteUpdate', listener);
  },

  onSqlSyncEvent: (handler: (evt: unknown) => void) => {
    const listener = (_e: IpcRendererEvent, payload: unknown) => handler(payload);
    ipcRenderer.on('sql:syncEvent', listener);
    return () => ipcRenderer.removeListener('sql:syncEvent', listener);
  },

  // Attachments (filesystem)
  saveAttachmentFile: (payload: {
    referenceType: string;
    entityFolder: string;
    originalFileName: string;
    bytes: ArrayBuffer;
  }) => ipcRenderer.invoke('attachments:save', payload),
  readAttachmentFile: (relativePath: string) =>
    ipcRenderer.invoke('attachments:read', relativePath),
  deleteAttachmentFile: (relativePath: string) =>
    ipcRenderer.invoke('attachments:delete', relativePath),
  openAttachmentFile: (relativePath: string) =>
    ipcRenderer.invoke('attachments:open', relativePath),
  pullAttachmentsNow: () => ipcRenderer.invoke('attachments:pullNow'),

  // Word templates
  readTemplateFile: (payload: { templateName: string; templateType?: string }) =>
    ipcRenderer.invoke('templates:read', payload),
  listTemplates: (payload?: { templateType?: string }) =>
    ipcRenderer.invoke('templates:list', payload),
  importTemplate: (payload?: { templateType?: string }) =>
    ipcRenderer.invoke('templates:import', payload),
  deleteTemplate: (payload: { templateName: string; templateType?: string }) =>
    ipcRenderer.invoke('templates:delete', payload),
});

contextBridge.exposeInMainWorld('desktopPrintEngine', {
  run: (job: unknown) => ipcRenderer.invoke('print:engine:run', job),
});

contextBridge.exposeInMainWorld('desktopPrintDispatch', {
  run: (request: Record<string, unknown>) =>
    ipcRenderer.invoke('print:dispatch' as PrintDispatchChannel, request),
});

contextBridge.exposeInMainWorld('desktopPrinting', {
  printHtml: (payload: Record<string, unknown>) => ipcRenderer.invoke('printing:printHtml', payload),
  htmlToPdf: (payload: Record<string, unknown>) => ipcRenderer.invoke('printing:htmlToPdf', payload),
});

contextBridge.exposeInMainWorld('desktopPrintSettings', {
  get: () => ipcRenderer.invoke('print:settings:get' as PrintSettingsChannel),
  save: (settings: Record<string, unknown>) =>
    ipcRenderer.invoke('print:settings:save' as PrintSettingsChannel, settings),
  getPath: () => ipcRenderer.invoke('print:settings:getPath' as PrintSettingsChannel),
});

contextBridge.exposeInMainWorld('desktopPrintPreview', {
  open: (payload: Record<string, unknown>) =>
    ipcRenderer.invoke('print:preview:open' as PrintPreviewChannel, payload),
  getState: (sessionId: string) =>
    ipcRenderer.invoke('print:preview:getState' as PrintPreviewChannel, sessionId),
  listPrinters: () => ipcRenderer.invoke('print:preview:listPrinters' as PrintPreviewChannel),
  print: (sessionId: string, options?: Record<string, unknown>) =>
    ipcRenderer.invoke('print:preview:print' as PrintPreviewChannel, sessionId, options),
  exportPdf: (sessionId: string) =>
    ipcRenderer.invoke('print:preview:exportPdf' as PrintPreviewChannel, sessionId),
  exportDocx: (sessionId: string) =>
    ipcRenderer.invoke('print:preview:exportDocx' as PrintPreviewChannel, sessionId),
  reload: (sessionId: string) =>
    ipcRenderer.invoke('print:preview:reload' as PrintPreviewChannel, sessionId),
});

contextBridge.exposeInMainWorld('desktopAuth', {
  setSessionUser: (userId: string | null) =>
    ipcRenderer.invoke('auth:session:set' as AuthChannel, { userId }),
});

contextBridge.exposeInMainWorld('desktopUpdater', {
  getVersion: () => ipcRenderer.invoke('updater:getVersion'),
  getStatus: () => ipcRenderer.invoke('updater:getStatus'),
  setFeedUrl: (url: string) => ipcRenderer.invoke('updater:setFeedUrl', url),
  check: () => ipcRenderer.invoke('updater:check'),
  download: () => ipcRenderer.invoke('updater:download'),
  install: () => ipcRenderer.invoke('updater:install'),
  installFromFile: () => ipcRenderer.invoke('updater:installFromFile'),
  getPendingRestore: () => ipcRenderer.invoke('updater:getPendingRestore'),
  clearPendingRestore: () => ipcRenderer.invoke('updater:clearPendingRestore'),
  restorePending: () => ipcRenderer.invoke('updater:restorePending'),
  onEvent: (handler: (evt: unknown) => void) => {
    const listener = (_e: IpcRendererEvent, payload: unknown) => handler(payload);
    ipcRenderer.on('updater:event', listener);
    return () => ipcRenderer.removeListener('updater:event', listener);
  },
});

contextBridge.exposeInMainWorld('desktopLicense', {
  getDeviceFingerprint: () => ipcRenderer.invoke('license:getDeviceFingerprint'),
  getStatus: () => ipcRenderer.invoke('license:getStatus'),
  hasFeature: (featureName: string) => ipcRenderer.invoke('license:hasFeature', featureName),
  activateFromContent: (raw: string) => ipcRenderer.invoke('license:activateFromContent', raw),
  activateOnline: (payload: { licenseKey: string; serverUrl?: string }) =>
    ipcRenderer.invoke('license:activateOnline', payload),
  getServerUrl: () => ipcRenderer.invoke('license:getServerUrl'),
  setServerUrl: (url: string) => ipcRenderer.invoke('license:setServerUrl', url),
  refreshOnlineStatus: () => ipcRenderer.invoke('license:refreshOnlineStatus'),
  deactivate: () => ipcRenderer.invoke('license:deactivate'),
});

contextBridge.exposeInMainWorld('desktopLicenseAdmin', {
  login: (payload: Record<string, unknown>) => ipcRenderer.invoke('licenseAdmin:login', payload),
  logout: () => ipcRenderer.invoke('licenseAdmin:logout'),
  getUser: () => ipcRenderer.invoke('licenseAdmin:getUser'),
  updateUser: (payload: Record<string, unknown>) =>
    ipcRenderer.invoke('licenseAdmin:updateUser', payload),
  getAdminTokenStatus: (payload: Record<string, unknown>) =>
    ipcRenderer.invoke('licenseAdmin:getAdminTokenStatus', payload),
  setAdminToken: (payload: Record<string, unknown>) =>
    ipcRenderer.invoke('licenseAdmin:setAdminToken', payload),
  list: (payload: Record<string, unknown>) => ipcRenderer.invoke('licenseAdmin:list', payload),
  get: (payload: Record<string, unknown>) => ipcRenderer.invoke('licenseAdmin:get', payload),
  issue: (payload: Record<string, unknown>) => ipcRenderer.invoke('licenseAdmin:issue', payload),
  setStatus: (payload: Record<string, unknown>) =>
    ipcRenderer.invoke('licenseAdmin:setStatus', payload),
  activate: (payload: Record<string, unknown>) =>
    ipcRenderer.invoke('licenseAdmin:activate', payload),
  checkStatus: (payload: Record<string, unknown>) =>
    ipcRenderer.invoke('licenseAdmin:checkStatus', payload),
  delete: (payload: Record<string, unknown>) => ipcRenderer.invoke('licenseAdmin:delete', payload),
  updateAfterSales: (payload: Record<string, unknown>) =>
    ipcRenderer.invoke('licenseAdmin:updateAfterSales', payload),
  saveLicenseFile: (payload: Record<string, unknown>) =>
    ipcRenderer.invoke('licenseAdmin:saveLicenseFile', payload),
  unbindDevice: (payload: Record<string, unknown>) =>
    ipcRenderer.invoke('licenseAdmin:unbindDevice', payload),
});

export {}; // ensure this is treated as a module
