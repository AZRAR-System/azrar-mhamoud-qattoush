import { useEffect } from 'react';
import { requestDesktopNotificationPermissionOnce } from '@/services/desktopNotifications';

/**
 * يطلب إذن إشعارات سطح المكتب مرة واحدة عند أول تشغيل للواجهة.
 * الإرسال الفعلي يتم من `sendDesktopNotification` في `desktopNotifications.ts` (يستدعيه notificationService للعاجل فقط).
 */
export function useDesktopNotifications(): void {
  useEffect(() => {
    requestDesktopNotificationPermissionOnce();
  }, []);
}
