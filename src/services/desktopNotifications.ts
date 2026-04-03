/**
 * إشعارات سطح المكتب (Web Notification API) — بدون React.
 */

const PERMISSION_REQUESTED_KEY = 'azrar_desktop_notif_permission_requested_v1';

export function isAppWindowFocusedForDesktopNotify(): boolean {
  if (typeof document === 'undefined') return true;
  try {
    return document.visibilityState === 'visible' && document.hasFocus();
  } catch {
    return false;
  }
}

/** طلب الإذن مرة واحدة لكل متصفح/تخزين محلي */
export function requestDesktopNotificationPermissionOnce(): void {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  try {
    if (localStorage.getItem(PERMISSION_REQUESTED_KEY) === '1') return;
    localStorage.setItem(PERMISSION_REQUESTED_KEY, '1');
    if (Notification.permission === 'default') {
      void Notification.requestPermission();
    }
  } catch {
    // ignore
  }
}

/**
 * يُستدعى للإشعارات العاجلة فقط.
 * لا يُرسل إذا كانت النافذة ظاهرة ومُركّزة.
 */
export function sendDesktopNotification(title: string, body: string): void {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  if (isAppWindowFocusedForDesktopNotify()) return;
  try {
    const t = String(title || '').trim() || 'AZRAR';
    const b = String(body || '').trim();
    new Notification(t, { body: b });
  } catch {
    // ignore
  }
}
