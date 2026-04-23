/**
 * © 2025 — Developed by Mahmoud Qattoush
 * AZRAR Real Estate Management System — All Rights Reserved
 *
 * Notification Service - Integrated System
 * Handles alerts, toast notifications, and audio feedback
 */

import { audioService } from './audioService';
import { storage } from '@/services/storage';
import { notificationCenter } from './notificationCenter';
import { sendDesktopNotification } from './desktopNotifications';

type NotificationType = 'success' | 'error' | 'warning' | 'info' | 'delete';

interface NotificationOptions {
  title?: string;
  duration?: number;
  sound?: boolean;
  showNotification?: boolean;
  category?: string;
  icon?: string;
  entityId?: string;
  urgent?: boolean;
}

interface NotificationHandler {
  onNotify: (message: string, type: NotificationType, title?: string) => void;
}

/** نفس المحتوى لا يُعرض كـ Toast/صوت أكثر من مرة كل 10 دقائق */
const TOAST_THROTTLE_MS = 10 * 60 * 1000;

export class NotificationService {
  private handler: NotificationHandler | null = null;
  private isEnabled = true;
  private readonly lastToastAtByKey = new Map<string, number>();

  private defaultTitleForType(type: NotificationType): string {
    const m: Record<NotificationType, string> = {
      success: 'نجاح',
      error: 'خطأ',
      warning: 'تحذير',
      info: 'معلومة',
      delete: 'حذف',
    };
    return m[type];
  }

  setHandler(handler: NotificationHandler) {
    this.handler = handler;
  }

  setEnabled(enabled: boolean) {
    this.isEnabled = enabled;
  }

  /**
   * Send a comprehensive notification with sound and toast
   */
  notify(message: string, type: NotificationType = 'info', options: NotificationOptions = {}) {
    if (!this.isEnabled) return;

    const { title, sound = true, showNotification = true, category = type } = options;
    const displayTitle = title ?? this.defaultTitleForType(type);
    const cat = String(category ?? type);
    const urgent = type === 'error' || !!options.urgent;

    const throttleKey = `${cat}|${displayTitle}|${message.slice(0, 240)}`;
    const now = Date.now();
    const lastAt = this.lastToastAtByKey.get(throttleKey);
    if (lastAt !== undefined && now - lastAt < TOAST_THROTTLE_MS) {
      return;
    }
    this.lastToastAtByKey.set(throttleKey, now);
    if (this.lastToastAtByKey.size > 500) {
      const cutoff = now - TOAST_THROTTLE_MS;
      for (const [k, t] of this.lastToastAtByKey) {
        if (t < cutoff) this.lastToastAtByKey.delete(k);
      }
    }

    const ncId = options.entityId
      ? `nc-${cat}-${options.entityId}`
      : `nc-${cat}-${displayTitle}-${message.slice(0, 60)}`.replace(/\s+/g, '-');
    notificationCenter.add({
      id: ncId,
      type,
      title: displayTitle,
      message,
      category: cat,
      entityId: options.entityId,
      urgent,
    });

    if (urgent) {
      sendDesktopNotification(displayTitle, message);
    }

    // Play sound if enabled
    if (sound) {
      audioService.playSound(type);
    }

    // Show toast notification if handler is set
    if (showNotification && this.handler) {
      this.handler.onNotify(message, type, title);
    }

    // Log notification for debugging
    this.logNotification(message, type, cat);
  }

  /**
   * Success notification
   */
  success(message: string, title: string = 'نجاح', options?: NotificationOptions) {
    this.notify(message, 'success', { title, ...options });
  }

  /**
   * Error notification
   */
  error(message: string, title: string = 'خطأ', options?: NotificationOptions) {
    this.notify(message, 'error', { title, ...options });
  }

  /**
   * Warning notification
   */
  warning(message: string, title: string = 'تحذير', options?: NotificationOptions) {
    this.notify(message, 'warning', { title, ...options });
  }

  /**
   * Info notification
   */
  info(message: string, title: string = 'معلومة', options?: NotificationOptions) {
    this.notify(message, 'info', { title, ...options });
  }

  /**
   * Delete notification
   */
  delete(message: string, title: string = 'حذف', options?: NotificationOptions) {
    this.notify(message, 'delete', { title, ...options });
  }

  /**
   * Custom notification with specific category
   */
  custom(
    message: string,
    type: NotificationType,
    category: string,
    title?: string,
    options?: Omit<NotificationOptions, 'category'>
  ) {
    this.notify(message, type, { title, category, ...options });
  }

  /**
   * Business event notifications
   */
  contractCreated(contractId: string, tenantName: string) {
    this.success(`تم إنشاء عقد جديد لـ ${tenantName}`, 'عقد جديد', {
      category: 'contracts',
    });
  }

  installmentPaid(amount: number, tenantName: string) {
    this.success(`تم استلام دفعة بقيمة ${amount} د.أ من ${tenantName}`, 'دفعة تم استلامها', {
      category: 'payments',
    });
  }

  installmentDue(amount: number, tenantName: string, daysUntilDue: number) {
    // Policy: pre-due reminders only (no due-today / overdue reminders)
    if (daysUntilDue <= 0) return;
    if (daysUntilDue <= 7) {
      this.warning(
        `دفعة ستستحق خلال ${daysUntilDue} أيام بقيمة ${amount} د.أ من ${tenantName}`,
        'تذكير قبل الاستحقاق',
        {
          category: 'payments',
        }
      );
    }
  }

  installmentOverdue(amount: number, tenantName: string, daysOverdue: number) {
    // Policy: no overdue reminders
    void amount;
    void tenantName;
    void daysOverdue;
    return;
  }

  contractEnding(contractId: string, tenantName: string, daysRemaining: number) {
    this.warning(`العقد مع ${tenantName} ينتهي خلال ${daysRemaining} أيام`, 'انتهاء عقد قريب', {
      category: 'contracts',
      urgent: true,
      entityId: contractId,
    });
  }

  maintenanceRequired(propertyCode: string, issueType: string) {
    this.warning(`صيانة مطلوبة للعقار ${propertyCode}: ${issueType}`, 'صيانة مطلوبة', {
      category: 'maintenance',
    });
  }

  blacklistWarning(tenantName: string) {
    this.error(`⚠️ تحذير: ${tenantName} مدرج في قائمة المستأجرين المشكوك فيهم`, 'تحذير سمعة', {
      category: 'blacklist',
    });
  }

  commissionCalculated(amount: number, type: string) {
    this.success(`تم حساب عمولة ${type} بقيمة ${amount} د.أ`, 'عمولة محسوبة', {
      category: 'commissions',
    });
  }

  systemAlert(message: string, severity: 'critical' | 'warning' | 'info' = 'warning') {
    const typeMap = {
      critical: 'error' as NotificationType,
      warning: 'warning' as NotificationType,
      info: 'info' as NotificationType,
    };
    this.notify(message, typeMap[severity], {
      title: `تنبيه نظام - ${severity}`,
      category: 'system',
      urgent: severity === 'critical',
    });
  }

  /**
   * Log notification for debugging
   */
  private logNotification(message: string, type: NotificationType, category: string) {
    const log = {
      timestamp: new Date().toISOString(),
      message,
      type,
      category,
    };

    const notifications = JSON.parse(localStorage.getItem('notificationLogs') || '[]');
    notifications.push(log);

    // Keep only last 100 notifications
    if (notifications.length > 100) {
      notifications.shift();
    }
    const serialized = JSON.stringify(notifications);
    void storage.setItem('notificationLogs', serialized);
    localStorage.setItem('notificationLogs', serialized);
  }

  /**
   * Get notification logs
   */
  getLogs(): Array<Record<string, unknown>> {
    const raw: unknown = JSON.parse(localStorage.getItem('notificationLogs') || '[]');
    if (!Array.isArray(raw)) return [];
    return raw.filter((x): x is Record<string, unknown> => typeof x === 'object' && x !== null);
  }

  /**
   * Clear notification logs
   */
  clearLogs() {
    localStorage.setItem('notificationLogs', '[]');
    void storage.setItem('notificationLogs', '[]');
    localStorage.setItem('notificationLogs', '[]');
  }
}

export const notificationService = new NotificationService();
