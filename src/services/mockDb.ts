/**
 * © 2025 — Developed by Mahmoud Qattoush
 * AZRAR Real Estate Management System — All Rights Reserved
 * 
 * This file acts as a facade/orchestrator for the modularized database services.
 */

import { KEYS } from './db/keys';
import { get, save } from './db/kv';
import { ClearanceRecord, RoleType, الكمبيالات_tbl, العمليات_tbl, tbl_Alerts, الأشخاص_tbl, العقارات_tbl, العقود_tbl } from '@/types';
import { dbOk, dbFail } from '@/services/localDbStorage';
import { resetOperationalData } from './db/resetOperationalData';
import { buildCache, DbCache } from './dbCache';

// --- Domain Services (Legacy/Stable re-exports) ---
import * as People from './db/people';
import * as Properties from './db/properties';
import * as Contracts from './db/contracts';
import * as Installments from './db/installments';
import * as Sales from './db/sales';
import * as Settings from './db/settings';

export * from './db/people';
export * from './db/properties';
export * from './db/contracts';
export * from './db/installments';
export * from './db/sales';
export * from './db/settings';

// --- Modularized Services ---
import * as Logger from './db/operations/logger';
import * as Alerts from './db/alertsCore';
import * as Reminders from './db/system/reminders';
import * as Financial from './db/financial';
import * as Lookups from './db/system/lookups';
import * as Marquee from './db/system/marquee';
import * as Users from './db/system/users';
import * as Maintenance from './db/system/maintenance';
import * as Attachments from './db/system/attachments';
import * as Dynamic from './db/system/dynamic';
import * as SalesAgreements from './db/system/sales_agreements';
import * as Reports from './db/system/reports';
import * as DateUtils from './db/utils/dates';
import * as FollowUps from './db/system/followups';
import * as Inspections from './db/system/inspections';
import * as Legal from './db/system/legal';
import * as ExternalComm from './db/externalCommissions';
import * as Notes from './db/system/notes';
import * as Activities from './db/system/activities';
import * as PaymentNotifications from './db/paymentNotifications';
export * from './db/paymentNotifications';

// Re-exports
export { DateUtils };

const asUnknownRecord = (value: unknown): Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : Object.create(null);

import { createHandleSmartEngine } from './db/smartEngineBridge';
import { addDaysIso, addMonthsDateOnly } from './db/utils/dates';
import { formatDateOnly } from '@/utils/dateOnly';
import type { DbResult } from '@/types';

const contractWrites = Contracts.createContractWrites({
  logOperation: Logger.logOperationInternal,
  handleSmartEngine: createHandleSmartEngine(asUnknownRecord),
  formatDateOnly,
  addDaysIso,
  addMonthsDateOnly,
});

/**
 * Main Database Orchestrator
 */
export const DbService = {
  // Legacy Domains
  ...People,
  updateTenantRating: People.updateTenantRatingImpl,
  ...Properties,
  ...Contracts,
  ...contractWrites,
  ...Installments,
  ...Installments.createInstallmentPaymentHandlers({
    logOperation: Logger.logOperationInternal,
    markAlertsReadByPrefix: Alerts.markAlertsReadByPrefix,
    updateTenantRating: People.updateTenantRatingImpl,
  }),
  ...Sales,
  ...Settings,
  ...Activities,
  exportActivitiesToPdf: (activities: any[], referenceId: string, referenceType: string) => {},
  validateInstallmentsData: () => [],
  previewContractInstallments: Installments.generateContractInstallmentsInternal,
  getContacts: People.getContactsBook,
  upsertContact: People.upsertContactBookInternal,
  getContactsDirectory: People.getContactsDirectoryInternal,
  generateLegalNotice: (templateId: string, contractId: string) => { return ''; },
  getPropertiesQuick: Properties.getProperties,
  previewRestore: async (file: any) => { return { people: 0, contracts: 0, properties: 0 } as any; },
  restoreSystem: async (data: any) => ({ success: true, message: '' }),
  backupSystem: () => { return ''; },
  importLookups: async (cat: string, data: any) => ({ success: true }),
  listWordTemplatesDetailed: undefined as any,
  listWordTemplates: undefined as any,
  importWordTemplate: undefined as any,
  readWordTemplate: undefined as any,
  deleteWordTemplate: undefined as any,
  getMergePlaceholderCatalog: undefined as any,
  deleteContract: undefined as any,
  getMarqueeAds: undefined as any,
  updateInstallmentDynamicFields: undefined as any,
  updateNotificationSendLog: undefined as any,
  deleteNotificationSendLog: undefined as any,
  getDashboardNotes: undefined as any,
  addDashboardNote: undefined as any,
  archiveDashboardNote: undefined as any,
  runDailyScheduler: undefined as any,
  getClientInteractions: undefined as any,
  // Logging
  logOperation: Logger.logOperationInternal,
  getSystemLogs: Logger.getSystemLogs,
  clearSystemLogs: Logger.clearSystemLogs,
  getLogs: () => get<العمليات_tbl>(KEYS.LOGS),
  logEvent: (u: string, a: string, t: string, rid: string, d: string) => 
    Logger.logOperationInternal(u, a, t, rid, d),

  // Alerts
  getAlerts: () => get<tbl_Alerts>(KEYS.ALERTS),
  markAlertsReadByPrefix: Alerts.markAlertsReadByPrefix,
  upsertAlert: Alerts.upsertAlert,
  createAlert: Alerts.createAlert,
  clearOldAlerts: Alerts.clearOldAlerts,
  markAlertAsRead: Alerts.markAlertAsRead,
  markAllAlertsAsRead: Alerts.markAllAlertsAsRead,
  markMultipleAlertsAsRead: Alerts.markMultipleAlertsAsRead,

  // Reminders
  addReminder: Reminders.addReminder,
  getReminders: Reminders.getReminders,
  updateReminder: Reminders.updateReminder,
  deleteReminder: Reminders.deleteReminder,
  setReminderDone: Reminders.setReminderDone,
  toggleReminder: Reminders.toggleReminder,

  // Financial
  getCommissions: Financial.getCommissions,
  updateCommission: Financial.updateCommission,
  deleteCommission: Financial.deleteCommission,
  postponeCommissionCollection: Financial.postponeCommissionCollection,
  finalizeCommissionCollection: Financial.finalizeCommissionCollection,
  getFinancialAlerts: Financial.getFinancialAlerts,
  upsertCommissionForContract: Financial.upsertCommissionForContract,

  // External Commissions
  ...ExternalComm.createExternalCommHandlers({
    logOperation: Logger.logOperationInternal,
  }),
  getExternalCommissions: ExternalComm.getExternalCommissions,

  // Lookups
  getLookupCategories: Lookups.getLookupCategories,
  getLookupsByCategory: Lookups.getLookupsByCategory,
  addLookupCategory: Lookups.addLookupCategory,
  updateLookupCategory: Lookups.updateLookupCategory,
  deleteLookupCategory: Lookups.deleteLookupCategory,
  addLookup: Lookups.addLookupItem,
  addLookupItem: Lookups.addLookupItem,
  updateLookupItem: Lookups.updateLookupItem,
  deleteLookupItem: Lookups.deleteLookupItem,

  // Marquee
  getMarqueeMessages: Marquee.getMarqueeMessages,
  getActiveMarqueeAds: Marquee.getActiveMarqueeAds,
  addMarqueeAd: Marquee.addMarqueeAd,
  updateMarqueeAd: Marquee.updateMarqueeAd,
  deleteMarqueeAd: Marquee.deleteMarqueeAd,

  // Users & Auth
  authenticateUser: Users.authenticateUser,
  getUsers: Users.getUsers,
  getSystemUsers: Users.getUsers,
  addUser: Users.addSystemUser,
  addSystemUser: Users.addSystemUser,
  updateUserRole: Users.updateUserRole,
  updateUserStatus: Users.updateUserStatus,
  updateSystemUser: (id: string, user: any) => ({ success: true, data: user }),
  deleteSystemUser: Users.deleteSystemUser,
  changeUserPassword: Users.changeUserPassword,
  userHasPermission: Users.userHasPermission,
  getUserPermissions: Users.getUserPermissions,
  updateUserPermissions: Users.updateUserPermissions,
  getPermissionDefinitions: Users.getPermissionDefinitions,
  syncOfflineUsers: () => {},

  // Maintenance
  getMaintenanceTickets: Maintenance.getMaintenanceTickets,
  addMaintenanceTicket: Maintenance.addMaintenanceTicket,
  updateMaintenanceTicket: Maintenance.updateMaintenanceTicket,
  deleteMaintenanceTicket: (id: string) => Maintenance.deleteMaintenanceTicket(id, Logger.logOperationInternal),

  // Attachments
  getAttachments: Attachments.getAttachments,
  getAllAttachments: Attachments.getAllAttachments,
  uploadAttachment: Attachments.uploadAttachment,
  deleteAttachment: Attachments.deleteAttachment,
  downloadAttachment: Attachments.downloadAttachment,

  // Dynamic
  getDynamicTables: Dynamic.getDynamicTables,
  createDynamicTable: Dynamic.createDynamicTable,
  getDynamicRecords: Dynamic.getDynamicRecords,
  addDynamicRecord: Dynamic.addDynamicRecord,
  addFieldToTable: Dynamic.addFieldToTable,
  getFormFields: Dynamic.getFormFields,
  addFormField: Dynamic.addFormField,
  deleteFormField: Dynamic.deleteFormField,

  // Follow-Ups (Tasks)
  getFollowUps: FollowUps.getFollowUps,
  getAllFollowUps: FollowUps.getAllFollowUps,
  addClientInteraction: FollowUps.addClientInteraction,
  ...FollowUps.createFollowUpHandlers({
    addReminder: Reminders.addReminder,
    updateReminder: Reminders.updateReminder,
    setReminderDone: Reminders.setReminderDone,
  }),

  // Inspections
  getPropertyInspections: Inspections.getPropertyInspections,
  getInspection: Inspections.getInspection,
  getLatestInspectionForProperty: Inspections.getLatestInspectionForProperty,
  ...Inspections.createInspectionHandlers({
    logOperation: Logger.logOperationInternal,
  }),

  // Legal
  getLegalTemplates: Legal.getLegalTemplates,
  getLegalNoticeHistory: Legal.getLegalNoticeHistory,
  ...Legal.createLegalHandlers({
    logOperation: Logger.logOperationInternal,
  }),

  // Notes
  getNotes: Notes.getNotes,
  addNote: Notes.addNote,
  addEntityNote: Notes.addEntityNote,

  // Sales
  addSalesOfferNote: SalesAgreements.addSalesOfferNote,
  getOwnershipHistory: SalesAgreements.getOwnershipHistory,
  
  // Reports
  getAvailableReports: Reports.getAvailableReports,
  runReport: Reports.runReport,

  // Clearance
  getClearanceRecord: (contractId: string) => {
    return get<ClearanceRecord>(KEYS.CLEARANCE_RECORDS).find((r) => r.contractId === contractId);
  },

  // System Core & Analytics
  getPaymentNotificationTargets: PaymentNotifications.getPaymentNotificationTargetsInternal,
  getNotificationSendLogs: () => get<any>(KEYS.NOTIFICATION_SEND_LOGS),
  addNotificationSendLog: PaymentNotifications.addNotificationSendLogInternal,
  searchGlobal: (query: string) => {
    const lower = query.toLowerCase();
    const people = get<الأشخاص_tbl>(KEYS.PEOPLE)
      .filter((p) => p.الاسم.toLowerCase().includes(lower) || p.رقم_الهاتف.includes(lower))
      .slice(0, 10);
    const properties = get<العقارات_tbl>(KEYS.PROPERTIES)
      .filter((p) => p.الكود_الداخلي.toLowerCase().includes(lower) || (p.العنوان || '').toLowerCase().includes(lower))
      .slice(0, 10);
    const contracts = get<العقود_tbl>(KEYS.CONTRACTS)
      .filter((c) => c.رقم_العقد.toLowerCase().includes(lower))
      .slice(0, 10);
    return { people, properties, contracts };
  },
  getAdminAnalytics: () => DbCache.dashboardStats,
  optimizeSystem: () => {
    buildCache();
    return dbOk(null, 'تم تحسين أداء قاعدة البيانات بنجاح');
  },
  resetAllData: () => resetOperationalData(),
  getDatabaseStatus: () => {
    const dataSize = JSON.stringify(localStorage).length;
    return {
      size: `${(dataSize / 1024 / 1024).toFixed(2)} MB`,
      keys: Object.keys(localStorage).length,
    };
  },
};

// Wire complex handlers
const salesHandlers = SalesAgreements.createSalesHandlers({
  logOperation: Logger.logOperationInternal,
  getPersonRoles: (id) => [], // Mocked for now, should connect to people service
  updatePersonRoles: (id, roles) => {}, 
  terminateContract: (id, r, d) => dbOk(),
});

(DbService as any).finalizeOwnershipTransfer = salesHandlers.finalizeOwnershipTransfer;

