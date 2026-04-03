import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DbService } from '@/services/mockDb';

export type GoogleCalendarStatus = {
  loading: boolean;
  available: boolean;
  enabled: boolean;
  connected: boolean;
  lastMessage?: string;
  lastSyncAt?: string;
};

function isDesktopCalendar(): boolean {
  return typeof window !== 'undefined' && !!window.desktopGoogleCalendar?.getStatus;
}

function collectTasksPayload(): Array<{
  id: string;
  title: string;
  date: string;
  time?: string;
  description?: string;
  done: boolean;
}> {
  const out: Array<{
    id: string;
    title: string;
    date: string;
    time?: string;
    description?: string;
    done: boolean;
  }> = [];

  const reminders = DbService.getAllReminders?.() || [];
  for (const r of reminders) {
    out.push({
      id: `rem:${String(r.id)}`,
      title: String(r.title || ''),
      date: String(r.date || ''),
      ...(r.time ? { time: String(r.time) } : {}),
      done: !!r.isDone,
    });
  }

  const followUps = DbService.getAllFollowUps?.() || [];
  for (const f of followUps) {
    out.push({
      id: `fup:${String(f.id)}`,
      title: String(f.task || ''),
      date: String(f.dueDate || ''),
      ...(f.dueTime ? { time: String(f.dueTime) } : {}),
      ...(f.note ? { description: String(f.note) } : {}),
      done: String(f.status) === 'Done',
    });
  }

  return out;
}

export function useGoogleCalendarSync() {
  const [status, setStatus] = useState<GoogleCalendarStatus>({
    loading: true,
    available: false,
    enabled: false,
    connected: false,
  });

  const debounceRef = useRef<number | null>(null);

  const refreshStatus = useCallback(async () => {
    if (!isDesktopCalendar()) {
      setStatus((s) => ({ ...s, loading: false, available: false }));
      return;
    }
    setStatus((s) => ({ ...s, loading: true }));
    try {
      const cal = window.desktopGoogleCalendar;
      if (!cal?.getStatus) {
        setStatus((s) => ({ ...s, loading: false, available: false }));
        return;
      }
      const res = (await cal.getStatus()) as {
        ok?: boolean;
        enabled?: boolean;
        connected?: boolean;
        message?: string;
      };
      if (res?.ok) {
        setStatus({
          loading: false,
          available: true,
          enabled: !!res.enabled,
          connected: !!res.connected,
          lastMessage: typeof res.message === 'string' ? res.message : undefined,
        });
      } else {
        setStatus({
          loading: false,
          available: true,
          enabled: false,
          connected: false,
          lastMessage: typeof res?.message === 'string' ? res.message : 'تعذر قراءة الحالة',
        });
      }
    } catch {
      setStatus({
        loading: false,
        available: true,
        enabled: false,
        connected: false,
        lastMessage: 'تعذر قراءة حالة Google Calendar',
      });
    }
  }, []);

  const setEnabled = useCallback(async (enabled: boolean) => {
    if (!window.desktopGoogleCalendar?.setEnabled) return { ok: false as const };
    const res = (await window.desktopGoogleCalendar.setEnabled(enabled)) as { ok?: boolean };
    await refreshStatus();
    return { ok: !!res?.ok };
  }, [refreshStatus]);

  const startAuth = useCallback(async () => {
    if (!window.desktopGoogleCalendar?.auth) return { ok: false as const, message: 'غير متاح' };
    const res = (await window.desktopGoogleCalendar.auth('start')) as {
      ok?: boolean;
      message?: string;
    };
    await refreshStatus();
    if (res?.ok) return { ok: true as const };
    return { ok: false as const, message: res?.message || 'فشل الربط' };
  }, [refreshStatus]);

  const signOut = useCallback(async () => {
    if (!window.desktopGoogleCalendar?.auth) return { ok: false as const };
    const res = (await window.desktopGoogleCalendar.auth('signOut')) as { ok?: boolean };
    await refreshStatus();
    return { ok: !!res?.ok };
  }, [refreshStatus]);

  const syncNow = useCallback(async () => {
    if (!window.desktopGoogleCalendar?.syncTasks) return { ok: false as const };
    const tasks = collectTasksPayload();
    const res = (await window.desktopGoogleCalendar.syncTasks({ tasks })) as {
      ok?: boolean;
      message?: string;
      created?: number;
      updated?: number;
      deleted?: number;
    };
    const msg =
      res?.ok && (res.message === undefined || res.message === null)
        ? `تم: +${res.created ?? 0} ~${res.updated ?? 0} −${res.deleted ?? 0}`
        : res?.message;
    setStatus((s) => ({
      ...s,
      lastMessage: typeof msg === 'string' ? msg : s.lastMessage,
      lastSyncAt: res?.ok ? new Date().toISOString() : s.lastSyncAt,
    }));
    return res?.ok
      ? { ok: true as const, created: res.created, updated: res.updated, deleted: res.deleted }
      : { ok: false as const, message: res?.message || 'فشل المزامنة' };
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    if (!isDesktopCalendar()) return;
    const onTasks = () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(() => {
        void (async () => {
          const api = window.desktopGoogleCalendar;
          if (!api?.getStatus || !api.syncTasks) return;
          const st = (await api.getStatus()) as { ok?: boolean; enabled?: boolean; connected?: boolean };
          if (st?.ok && st.enabled && st.connected) {
            const tasks = collectTasksPayload();
            const res = (await api.syncTasks({ tasks })) as { ok?: boolean };
            if (res?.ok) {
              setStatus((s) => ({ ...s, lastSyncAt: new Date().toISOString() }));
            }
          }
        })();
      }, 2000);
    };
    window.addEventListener('azrar:tasks-changed', onTasks);
    return () => {
      window.removeEventListener('azrar:tasks-changed', onTasks);
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, []);

  const canSync = useMemo(
    () => status.available && status.enabled && status.connected,
    [status.available, status.enabled, status.connected]
  );

  return {
    status,
    canSync,
    refreshStatus,
    setEnabled,
    startAuth,
    signOut,
    syncNow,
    collectTasksPayload,
  };
}
