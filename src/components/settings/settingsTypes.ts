export type DesktopSuccessMessage = {
  success?: boolean;
  message?: string;
  backupDir?: string;
  archivePath?: string;
};
export type BackupEncryptionStatus = {
  success?: boolean;
  message?: string;
  available?: boolean;
  enabled?: boolean;
  hasPassword?: boolean;
};

export type AppLastError = {
  at?: string;
  message?: string;
  stack?: string;
};

export type AppErrorLogEntry = {
  id?: string;
  at?: string;
  kind?: string;
  message?: string;
  sessionId?: string;
  stack?: string;
  componentStack?: string;
  url?: string;
  hash?: string;
  userAgent?: string;
};

export type MammothConverter = {
  convertToHtml: (input: { arrayBuffer: ArrayBuffer }) => Promise<{ value?: string }>;
};

export type WordTemplateType = 'contracts' | 'installments' | 'handover';

export type LocalBackupAutomationSettings = {
  v: 1;
  enabled?: boolean;
  timeHHmm?: string;
  retentionDays?: number;
  lastRunAt?: string;
  updatedAt?: string;
};

export type LocalBackupStats = {
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
};

export type LocalBackupLogEntry = {
  ts: string;
  ok: boolean;
  trigger: 'auto' | 'manual';
  message?: string;
  latestPath?: string;
  archivePath?: string;
  attachmentsLatestPath?: string;
  attachmentsArchivePath?: string;
};

export const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null;

export const isMammothConverter = (v: unknown): v is MammothConverter => {
  return isRecord(v) && typeof (v as MammothConverter).convertToHtml === 'function';
};
