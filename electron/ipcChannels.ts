export type IpcInvokeChannel =
  // Auth session (Desktop)
  | 'auth:session:set'

  // KV store
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

  // Domain + reports
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
  | 'domain:risk:multiGuarantors'
  | 'domain:person:details'
  | 'domain:person:tenancyContracts'
  | 'domain:property:contracts'
  | 'domain:contract:details'
  | 'domain:statement'
  | 'domain:dataChecks'
  | 'domain:financeSummary'
  | 'domain:commissions:getForContract'
  | 'domain:commissions:upsert'
  | 'domain:ownership:history'
  | 'domain:property:inspections'
  | 'domain:sales:person'
  | 'domain:sales:property'
  | 'domain:people:delete'
  | 'domain:people:merge'
  | 'domain:blacklist:remove'
  | 'domain:property:update'
  | 'domain:inspection:delete'
  | 'domain:followups:add'
  | 'domain:sales:agreement:delete'
  | 'domain:picker:properties'
  | 'domain:picker:contracts'
  | 'domain:picker:people'
  | 'domain:installments:contracts'
  | 'domain:metrics:snapshot'
  | 'domain:payments:quick'
  | 'reports:run'

  // SQL sync/settings
  | 'sql:getSettings'
  | 'sql:readLocalBootstrapCredentials'
  | 'sql:saveSettings'
  | 'sql:test'
  | 'sql:connect'
  | 'sql:disconnect'
  | 'sql:setPaused'
  | 'sql:status'
  | 'sql:clearPaused'
  | 'sql:provision'
  | 'sql:exportBackup'
  | 'sql:importBackup'
  | 'sql:restoreBackup'
  | 'sql:syncNow'
  | 'sql:getSyncLog'
  | 'sql:clearSyncLog'
  | 'sql:getCoverage'
  | 'sql:pullFullNow'
  | 'sql:purgeLegacyKeys'
  | 'sql:getBackupAutomationSettings'
  | 'sql:saveBackupAutomationSettings'
  | 'sql:listServerBackups'
  | 'sql:createServerBackup'
  | 'sql:restoreServerBackup'
  | 'sql:mergePublishAdmin'

  // Licensing
  | 'license:status'
  | 'license:setServerUrl'
  | 'license:activateOnline'
  | 'license:activateOffline'
  | 'license:applyAdminCode'
  | 'license:chooseOfflineCodeFile'
  | 'license:exportOfflineCodeFile'
  | 'license:refreshOnline'

  // Files
  | 'attachments:save'
  | 'attachments:read'
  | 'attachments:delete'
  | 'templates:read'
  | 'templates:list'
  | 'templates:import'

  // Printing (PDF)
  | 'print:exportPdf'

  // Printing settings
  | 'print:settings:get'
  | 'print:settings:save'
  | 'print:settings:getPath'

  // Enterprise Printing (Engine)
  | 'print:engine:run'

  // Enterprise Printing (Unified Dispatch)
  | 'print:dispatch'

  // Enterprise Printing (Preview)
  | 'print:preview:open'
  | 'print:preview:getState'
  | 'print:preview:listPrinters'
  | 'print:preview:print'
  | 'print:preview:exportPdf'
  | 'print:preview:exportDocx'
  | 'print:preview:reload'

  // Printing (UI)
  | 'print:center:openWindow'

  // Updater
  | 'updater:getVersion'
  | 'updater:getStatus'
  | 'updater:setFeedUrl'
  | 'updater:check'
  | 'updater:download'
  | 'updater:install'
  | 'updater:installFromFile'
  | 'updater:getPendingRestore'
  | 'updater:clearPendingRestore'
  | 'updater:restorePending';

export type IpcEventChannel = 'db:remoteUpdate' | 'sql:syncEvent' | 'updater:event';
