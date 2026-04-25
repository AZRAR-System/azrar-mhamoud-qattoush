/**
 * © 2025 — Developed by Mahmoud Qattoush
 * AZRAR Real Estate Management System — All Rights Reserved
 *
 * Notification System Examples - Test Cases
 */

import { notificationService } from '@/services/notificationService';

type UnknownRecord = Record<string, unknown>;
const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null;

/**
 * Example 1: Basic Notifications with Sound
 *
 * استخدام الإشعارات الأساسية مع الصوت
 */
export const example1_basicNotifications = () => {
  // Success notification
  notificationService.success('تم حفظ البيانات بنجاح', 'حفظ ناجح');

  // Error notification
  notificationService.error('فشل الاتصال بالخادم', 'خطأ في الاتصال');

  // Warning notification
  notificationService.warning('هناك تحديثات معلقة', 'تحذير');

  // Info notification
  notificationService.info('آخر تحديث: اليوم في 10:30 صباحاً', 'معلومة');

  // Delete notification
  notificationService.delete('تم حذف السجل بنجاح', 'حذف');
};

/**
 * Example 2: Business Event Notifications
 *
 * إشعارات أحداث الأعمال
 */
export const example2_businessEvents = () => {
  // Contract created
  notificationService.contractCreated('CNT-20251222-001', 'أحمد علي الرويلي');

  // Installment paid
  notificationService.installmentPaid(5000, 'محمد السعودي');

  // Installment due soon
  notificationService.installmentDue(3000, 'سارة محمود', 3);

  // Overdue installment
  notificationService.installmentOverdue(2500, 'علي إبراهيم', 5);

  // Contract ending soon
  notificationService.contractEnding('CNT-20250101-042', 'فاطمة خديجة', 15);

  // Maintenance required
  notificationService.maintenanceRequired('PROP-456', 'تسرب مائي بالحمام');

  // Blacklist warning
  notificationService.blacklistWarning('محمد أحمد - متأخر 45 يوم');

  // Commission calculated
  notificationService.commissionCalculated(750, 'عمولة البيع');
};

/**
 * Example 3: Using in React Component with Hook
 *
 * استخدام الإشعارات في مكون React
 */
export const example3_reactComponent = () => {
  const handleSaveContract = () => {
    try {
      const contractId = 'CNT-20251222-001';
      const tenantName = 'أحمد علي';
      notificationService.success('تم إنشاء العقد بنجاح', 'نجاح');
      notificationService.contractCreated(contractId, tenantName);
    } catch (_error) {
      notificationService.error('فشل في إنشاء العقد', 'خطأ');
      notificationService.systemAlert('خطأ في النظام', 'critical');
    }
  };

  return handleSaveContract;
};

/**
 * Example 4: Custom Notifications with Options
 *
 * إشعارات مخصصة مع خيارات متقدمة
 */
export const example4_customOptions = () => {
  notificationService.notify('تم معالجة الطلب بنجاح وسيتم التواصل معك قريباً', 'success', {
    title: 'طلب معالج',
    duration: 6000, // عرض لمدة 6 ثواني
    sound: true,
    showNotification: true,
    category: 'requests',
  });

  // Without sound
  notificationService.notify('تم تحديث البيانات', 'info', {
    sound: false,
    category: 'updates',
  });

  // Silent notification (for logging only)
  notificationService.notify('إجراء في الخلفية', 'info', {
    showNotification: false,
    sound: false,
    category: 'background',
  });
};

/**
 * Example 5: Notification Logging
 *
 * الحصول على سجل الإشعارات
 */
export const example5_notifications_logging = async () => {
  // Get all notification logs
  const logs = await notificationService.getLogs();
  console.warn('All notifications:', logs);

  // Filter by type
  const successLogs = logs.filter((log) => log.type === 'success');
  console.warn('Success notifications:', successLogs);

  // Filter by category
  const contractLogs = logs.filter((log) => log.category === 'contracts');
  console.warn('Contract notifications:', contractLogs);

  // Clear logs
  await notificationService.clearLogs();
};

/**
 * Example 6: Payment Flow with Notifications
 *
 * تدفق الدفع مع الإشعارات
 */
export const example6_paymentFlow = () => {
  const handleInstallmentPayment = (
    installmentId: string,
    amount: number,
    tenantName: string,
    daysLate: number
  ) => {
    try {
      // Process payment
      const paymentProcessed = true;

      if (paymentProcessed) {
        // Notify payment received
        notificationService.success(`تم استلام دفعة بقيمة ${amount} د.أ`, 'دفعة مستقبلة');

        // If it was overdue
        if (daysLate > 0) {
          notificationService.info(
            `شكراً على تسديد الدفعة المتأخرة بمدة ${daysLate} أيام`,
            'دفعة متأخرة'
          );
        }

        // Trigger business event
        notificationService.installmentPaid(amount, tenantName);

        return true;
      }
    } catch (_error) {
      notificationService.error('فشل معالجة الدفع');
      notificationService.systemAlert('خطأ في نظام الدفع', 'critical');
      return false;
    }
  };

  // Test
  handleInstallmentPayment('INS-001', 5000, 'أحمد علي', 0);
  handleInstallmentPayment('INS-002', 3000, 'محمد السعودي', 5);
};

/**
 * Example 7: Real-time Alerts
 *
 * التنبيهات الفورية
 */
export const example7_realtimeAlerts = () => {
  // Check installments due today
  const checkDueInstallments = (installations: unknown[]) => {
    const today = new Date().toISOString().split('T')[0];

    installations.forEach((inst) => {
      if (!isRecord(inst)) return;
      const dueDate = String(inst['دueDate'] ?? inst['dueDate'] ?? '').trim();
      const status = String(inst['status'] ?? '').trim();
      const amount = String(inst['amount'] ?? '').trim();
      const tenant = String(inst['tenant'] ?? '').trim();

      if (dueDate === today && status === 'unpaid') {
        notificationService.warning(`دفعة مستحقة اليوم: ${amount} د.أ من ${tenant}`, 'دفعة مستحقة');
      }
    });
  };

  // Check overdue installments
  const checkOverdueInstallments = (installations: unknown[]) => {
    const today = new Date();

    installations.forEach((inst) => {
      if (!isRecord(inst)) return;
      const dueDateStr = String(inst['dueDate'] ?? inst['دueDate'] ?? '').trim();
      const dueDate = new Date(dueDateStr);
      const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysOverdue > 0 && String(inst['status'] ?? '').trim() === 'unpaid') {
        notificationService.error(
          `دفعة متأخرة منذ ${daysOverdue} يوم: ${String(inst['amount'] ?? '').trim()} د.أ`,
          'دفعة متأخرة'
        );
      }
    });
  };

  // Check expiring contracts
  const checkExpiringContracts = (contracts: unknown[]) => {
    const today = new Date();
    const thirtyDaysLater = new Date();
    thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);

    contracts.forEach((contract) => {
      if (!isRecord(contract)) return;
      const endDate = new Date(String(contract['endDate'] ?? '').trim());

      if (
        endDate > today &&
        endDate < thirtyDaysLater &&
        String(contract['status'] ?? '').trim() === 'active'
      ) {
        const daysRemaining = Math.floor(
          (endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        );
        notificationService.warning(`العقد ينتهي خلال ${daysRemaining} يوم`, 'تجديد عقد');
      }
    });
  };

  return {
    checkDueInstallments,
    checkOverdueInstallments,
    checkExpiringContracts,
  };
};

/**
 * Example 8: Error Handling with Notifications
 *
 * معالجة الأخطاء مع الإشعارات
 */
export const example8_errorHandling = () => {
  const handleDataOperation = async <T>(operation: () => Promise<T>): Promise<T> => {
    try {
      const result = await operation();
      notificationService.success('تمت العملية بنجاح');
      return result;
    } catch (error: unknown) {
      // User-friendly error messages
      const errorMap: Record<string, string> = {
        NETWORK_ERROR: 'فشل الاتصال بالخادم',
        VALIDATION_ERROR: 'البيانات المدخلة غير صحيحة',
        AUTH_ERROR: 'ليس لديك صلاحيات كافية',
        NOT_FOUND: 'السجل المطلوب غير موجود',
        CONFLICT: 'البيانات متضاربة مع بيانات موجودة',
      };

      const code = isRecord(error) ? String(error['code'] ?? '').trim() : '';
      const message = isRecord(error) ? String(error['message'] ?? '').trim() : '';
      const errorMessage = (code && errorMap[code]) || message || 'حدث خطأ غير معروف';
      notificationService.error(errorMessage);

      // Log critical errors
      if (isRecord(error) && Boolean(error['critical'])) {
        notificationService.systemAlert(`خطأ حرج: ${errorMessage}`, 'critical');
      }

      throw error;
    }
  };

  return handleDataOperation;
};

/**
 * Example 9: Batch Notifications
 *
 * إشعارات دفعية
 */
export const example9_batchNotifications = () => {
  const notifyProcessingComplete = (successful: number, failed: number, total: number) => {
    if (failed === 0) {
      notificationService.success(
        `تمت معالجة ${successful} من ${total} سجلات بنجاح`,
        'معالجة كاملة'
      );
    } else {
      notificationService.warning(
        `تمت معالجة ${successful} من ${total} سجلات. فشل ${failed} سجلات`,
        'معالجة جزئية'
      );
    }
  };

  // Usage
  notifyProcessingComplete(48, 2, 50);
};

/**
 * Example 10: Integration Test
 *
 * اختبار التكامل الكامل
 */
export const example10_integrationTest = async () => {
  console.warn('🧪 بدء اختبار نظام الإشعارات...');

  // Test 1: Basic notifications
  notificationService.success('✅ اختبار 1: إشعارات أساسية');

  // Test 2: Business notifications
  notificationService.contractCreated('CNT-TEST-001', 'عميل اختبار');

  // Test 3: Logging
  const logs = await notificationService.getLogs();
  console.warn(`✅ اختبار 2: تم تسجيل ${logs.length} إشعار`);

  // Test 4: System alerts
  notificationService.systemAlert('اختبار التنبيهات', 'info');

  console.warn('✅ اكتمل اختبار نظام الإشعارات بنجاح!');
};
