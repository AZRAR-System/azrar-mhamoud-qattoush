import { createIpcDeps } from './deps.js';
import { registerPrinting } from './printing.js';
import { registerApp } from './app.js';
import { registerLicense } from './license.js';
import { registerLicenseAdmin } from './licenseAdmin.js';
import { registerDb } from './db.js';
import { registerDomain } from './domain.js';
import { registerSql } from './sql.js';
import { registerAttachments } from './attachments.js';

export function registerIpcHandlers(): void {
  const deps = createIpcDeps();
  registerPrinting(deps);
  registerApp(deps);
  registerLicense(deps);
  registerLicenseAdmin(deps);
  registerDb(deps);
  registerDomain(deps);
  registerSql(deps);
  registerAttachments(deps);
}

export type { IpcDeps } from './deps.js';
