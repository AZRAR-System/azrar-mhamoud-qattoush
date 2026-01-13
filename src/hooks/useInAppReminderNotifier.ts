import { useEffect } from 'react';
import { DbService } from '@/services/mockDb';
import { notificationService } from '@/services/notificationService';
import { formatDateOnly } from '@/utils/dateOnly';

const NOTIFIED_SESSION_KEY = 'azrar_notified_reminder_ids_v1';

const loadNotifiedSet = (): Set<string> => {
  try {
    const raw = sessionStorage.getItem(NOTIFIED_SESSION_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.map(String));
  } catch {
    return new Set();
  }
};

const saveNotifiedSet = (set: Set<string>) => {
  try {
    sessionStorage.setItem(NOTIFIED_SESSION_KEY, JSON.stringify(Array.from(set)));
  } catch {
    // ignore
  }
};

/**
 * In-app reminder notifier:
 * - Shows a toast + plays sound (via notificationService)
 * - Only for reminders due today
 * - Fires once per reminder id per renderer session
 */
export const useInAppReminderNotifier = () => {
  useEffect(() => {
    const notified = loadNotifiedSet();

    const toMinutes = (hm: unknown): number | null => {
      const raw = String(hm || '').trim();
      if (!raw) return null;
      const m = raw.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
      if (!m) return null;
      return Number(m[1]) * 60 + Number(m[2]);
    };

    const scan = () => {
      const today = formatDateOnly(new Date());
      const reminders = (DbService.getReminders?.() || []).filter((r: any) => !r?.isDone);

      const now = new Date();
      const nowMinutes = now.getHours() * 60 + now.getMinutes();

      const dueToday = reminders.filter((r: any) => String(r?.date) === today);
      for (const r of dueToday) {
        const id = String(r?.id || '');
        if (!id || notified.has(id)) continue;

        const dueMinutes = toMinutes((r as any)?.time);
        // If a time is set, only notify when the time has arrived.
        if (dueMinutes !== null && nowMinutes < dueMinutes) continue;

        const title = String(r?.type) === 'Task' ? 'مهمة اليوم' : 'تذكير اليوم';
        const message = String(r?.title || '').trim() || 'لديك تذكير جديد اليوم';

        notificationService.warning(message, title, { category: 'reminders', sound: true, showNotification: true });

        notified.add(id);
        saveNotifiedSet(notified);
      }
    };

    // Initial scan shortly after mount (gives the app time to hydrate DB)
    const initialTimer = window.setTimeout(scan, 1500);

    // Re-scan periodically in case reminders are created in background
    const interval = window.setInterval(scan, 30000);

    // Re-scan immediately when tasks/reminders change
    const onChanged = () => scan();
    window.addEventListener('azrar:tasks-changed', onChanged);

    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(interval);
      window.removeEventListener('azrar:tasks-changed', onChanged);
    };
  }, []);
};
