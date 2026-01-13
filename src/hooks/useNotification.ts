/**
 * © 2025 — Developed by Mahmoud Qattoush
 * AZRAR Real Estate Management System — All Rights Reserved
 * 
 * Custom Hook for using Notification Service
 */

import { useCallback } from 'react';
import { notificationService } from '@/services/notificationService';

export const useNotification = () => {
  const success = useCallback((message: string, title?: string) => {
    notificationService.success(message, title);
  }, []);

  const error = useCallback((message: string, title?: string) => {
    notificationService.error(message, title);
  }, []);

  const warning = useCallback((message: string, title?: string) => {
    notificationService.warning(message, title);
  }, []);

  const info = useCallback((message: string, title?: string) => {
    notificationService.info(message, title);
  }, []);

  const delete_ = useCallback((message: string, title?: string) => {
    notificationService.delete(message, title);
  }, []);

  // Business notifications
  const contractCreated = useCallback((contractId: string, tenantName: string) => {
    notificationService.contractCreated(contractId, tenantName);
  }, []);

  const installmentPaid = useCallback((amount: number, tenantName: string) => {
    notificationService.installmentPaid(amount, tenantName);
  }, []);

  const installmentDue = useCallback((amount: number, tenantName: string, daysUntilDue: number) => {
    notificationService.installmentDue(amount, tenantName, daysUntilDue);
  }, []);

  const installmentOverdue = useCallback((amount: number, tenantName: string, daysOverdue: number) => {
    notificationService.installmentOverdue(amount, tenantName, daysOverdue);
  }, []);

  const contractEnding = useCallback((contractId: string, tenantName: string, daysRemaining: number) => {
    notificationService.contractEnding(contractId, tenantName, daysRemaining);
  }, []);

  const maintenanceRequired = useCallback((propertyCode: string, issueType: string) => {
    notificationService.maintenanceRequired(propertyCode, issueType);
  }, []);

  const blacklistWarning = useCallback((tenantName: string) => {
    notificationService.blacklistWarning(tenantName);
  }, []);

  const commissionCalculated = useCallback((amount: number, type: string) => {
    notificationService.commissionCalculated(amount, type);
  }, []);

  const systemAlert = useCallback((message: string, severity: 'critical' | 'warning' | 'info' = 'warning') => {
    notificationService.systemAlert(message, severity);
  }, []);

  return {
    // Basic notifications
    success,
    error,
    warning,
    info,
    delete: delete_,
    
    // Business notifications
    contractCreated,
    installmentPaid,
    installmentDue,
    installmentOverdue,
    contractEnding,
    maintenanceRequired,
    blacklistWarning,
    commissionCalculated,
    systemAlert,
  };
};
