// Centralized route paths to prevent drift between navigation and routing.
// Keep this file dependency-light (no React imports) so it can be reused widely.

export const ROUTE_PATHS = {
  // Auth
  LOGIN: '/login',
  LOGOUT: '/logout',

  // Activation / licensing
  ACTIVATION: '/activation',

  // Main
  DASHBOARD: '/',
  SALES: '/sales',
  PEOPLE: '/people',
  COMPANIES: '/companies',
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
  OPERATIONS: '/operations',
  SYS_MAINTENANCE: '/sys-maintenance',
  DATABASE: '/database',
  BUILDER: '/builder',
  DOCS: '/docs',

  // Hidden/utility
  COMPREHENSIVE_TESTS: '/comprehensive-tests',
  RESET_DATABASE: '/reset-database',
} as const;

export type RoutePath = (typeof ROUTE_PATHS)[keyof typeof ROUTE_PATHS];
