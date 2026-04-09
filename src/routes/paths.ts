// Centralized route paths to prevent drift between navigation and routing.
// Keep this file dependency-light (no React imports) so it can be reused widely.

export const ROUTE_PATHS = {
  // Auth
  LOGIN: '/login',
  LOGOUT: '/logout',

  // Activation / licensing
  ACTIVATION: '/activation',
  LICENSE_ADMIN: '/license-admin',
  LICENSE_ADMIN_LICENSES: '/license-admin/licenses',
  LICENSE_ADMIN_USERS: '/license-admin/users',
  LICENSE_ADMIN_CUSTOMERS: '/license-admin/customers',

  // Main
  DASHBOARD: '/',
  SALES: '/sales',
  PEOPLE: '/people',
  PROPERTIES: '/properties',
  CONTRACTS: '/contracts',
  INSTALLMENTS: '/installments',
  COMMISSIONS: '/commissions',
  MAINTENANCE: '/maintenance',
  ALERTS: '/alerts',
  REPORTS: '/reports',
  LEGAL: '/legal',

  SMART_TOOLS: '/smart-tools',

  // Utility pages
  CONTACTS: '/contacts',
  BULK_WHATSAPP: '/bulk-whatsapp',
  DOCUMENTS: '/documents',

  // Admin
  ADMIN_PANEL: '/admin',
  SETTINGS: '/settings',
  BACKUP: '/backup',
  OPERATIONS: '/operations',
  /** سجل التدقيق — SuperAdmin فقط */
  AUDIT_LOG: '/audit-log',
  SYS_MAINTENANCE: '/sys-maintenance',
  BUILDER: '/builder',
  DOCS: '/docs',

  // Portal
  OWNER_PORTAL: '/owner-portal',

  // Hidden/utility
  COMPREHENSIVE_TESTS: '/comprehensive-tests',
  RESET_DATABASE: '/reset-database',
} as const;

export type RoutePath = (typeof ROUTE_PATHS)[keyof typeof ROUTE_PATHS];
