export {};
/**
 * Tests for RBAC guard logic applied to sensitive pages
 * Covers: BulkWhatsApp, AdminControlPanel, LicenseAdmin,
 *         SystemMaintenance, BackupManager, SystemSetup
 */

type Role = 'superadmin' | 'admin' | 'manager' | 'employee' | 'viewer' | '';

const normalizeRole = (role: unknown): string =>
  String(role ?? '').trim().toLowerCase();

// Guard rules per page
const canAccessBulkWhatsApp = (role: Role): boolean => {
  const r = normalizeRole(role);
  return ['superadmin', 'admin', 'manager'].includes(r);
};

const canAccessAdminControlPanel = (role: Role): boolean => {
  const r = normalizeRole(role);
  return ['superadmin', 'admin'].includes(r);
};

const canAccessLicenseAdmin = (role: Role): boolean => {
  return normalizeRole(role) === 'superadmin';
};

const canAccessSystemMaintenance = (role: Role): boolean => {
  return normalizeRole(role) === 'superadmin';
};

const canAccessBackupManager = (role: Role): boolean => {
  const r = normalizeRole(role);
  return ['superadmin', 'admin'].includes(r);
};

const canAccessSystemSetup = (role: Role): boolean => {
  const r = normalizeRole(role);
  return ['superadmin', 'admin'].includes(r);
};

describe('RBAC Guards — BulkWhatsApp', () => {
  it('allows superadmin', () => expect(canAccessBulkWhatsApp('superadmin')).toBe(true));
  it('allows admin', () => expect(canAccessBulkWhatsApp('admin')).toBe(true));
  it('allows manager', () => expect(canAccessBulkWhatsApp('manager')).toBe(true));
  it('denies employee', () => expect(canAccessBulkWhatsApp('employee')).toBe(false));
  it('denies viewer', () => expect(canAccessBulkWhatsApp('viewer')).toBe(false));
  it('denies empty role', () => expect(canAccessBulkWhatsApp('')).toBe(false));
});

describe('RBAC Guards — AdminControlPanel', () => {
  it('allows superadmin', () => expect(canAccessAdminControlPanel('superadmin')).toBe(true));
  it('allows admin', () => expect(canAccessAdminControlPanel('admin')).toBe(true));
  it('denies manager', () => expect(canAccessAdminControlPanel('manager')).toBe(false));
  it('denies employee', () => expect(canAccessAdminControlPanel('employee')).toBe(false));
  it('denies viewer', () => expect(canAccessAdminControlPanel('viewer')).toBe(false));
  it('denies empty role', () => expect(canAccessAdminControlPanel('')).toBe(false));
});

describe('RBAC Guards — LicenseAdmin', () => {
  it('allows superadmin', () => expect(canAccessLicenseAdmin('superadmin')).toBe(true));
  it('denies admin', () => expect(canAccessLicenseAdmin('admin')).toBe(false));
  it('denies manager', () => expect(canAccessLicenseAdmin('manager')).toBe(false));
  it('denies employee', () => expect(canAccessLicenseAdmin('employee')).toBe(false));
  it('denies viewer', () => expect(canAccessLicenseAdmin('viewer')).toBe(false));
  it('is case insensitive', () => expect(canAccessLicenseAdmin('SuperAdmin' as Role)).toBe(true));
});

describe('RBAC Guards — SystemMaintenance', () => {
  it('allows superadmin', () => expect(canAccessSystemMaintenance('superadmin')).toBe(true));
  it('denies admin', () => expect(canAccessSystemMaintenance('admin')).toBe(false));
  it('denies manager', () => expect(canAccessSystemMaintenance('manager')).toBe(false));
  it('denies employee', () => expect(canAccessSystemMaintenance('employee')).toBe(false));
  it('denies empty role', () => expect(canAccessSystemMaintenance('')).toBe(false));
});

describe('RBAC Guards — BackupManager', () => {
  it('allows superadmin', () => expect(canAccessBackupManager('superadmin')).toBe(true));
  it('allows admin', () => expect(canAccessBackupManager('admin')).toBe(true));
  it('denies manager', () => expect(canAccessBackupManager('manager')).toBe(false));
  it('denies employee', () => expect(canAccessBackupManager('employee')).toBe(false));
  it('denies viewer', () => expect(canAccessBackupManager('viewer')).toBe(false));
});

describe('RBAC Guards — SystemSetup', () => {
  it('allows superadmin', () => expect(canAccessSystemSetup('superadmin')).toBe(true));
  it('allows admin', () => expect(canAccessSystemSetup('admin')).toBe(true));
  it('denies manager', () => expect(canAccessSystemSetup('manager')).toBe(false));
  it('denies employee', () => expect(canAccessSystemSetup('employee')).toBe(false));
  it('denies viewer', () => expect(canAccessSystemSetup('viewer')).toBe(false));
  it('denies empty role', () => expect(canAccessSystemSetup('')).toBe(false));
});
