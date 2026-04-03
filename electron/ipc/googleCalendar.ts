import type { IpcDeps } from './deps.js';
import { ipcMain } from 'electron';
import { KV_GOOGLE_CALENDAR_ENABLED } from '../googleCalendar/config.js';
import {
  hasValidTokens,
  loadTokensFromSafeStorage,
  signOutGoogle,
  startAuthorizationCodeFlowPkce,
} from '../googleCalendar/googleAuthManager.js';
import {
  syncTasksToGoogleCalendar,
  type GoogleCalendarTaskInput,
} from '../googleCalendar/googleCalendarSync.js';
import { kvGet, kvSet } from '../db.js';
import { toErrorMessage } from '../utils/errors.js';

function isIntegrationEnabled(): boolean {
  return String(kvGet(KV_GOOGLE_CALENDAR_ENABLED) || '').toLowerCase() === 'true';
}

function setIntegrationEnabled(enabled: boolean): void {
  kvSet(KV_GOOGLE_CALENDAR_ENABLED, enabled ? 'true' : 'false');
}

export function registerGoogleCalendar(_deps: IpcDeps): void {
  void _deps;

  ipcMain.handle('googleCalendar:getStatus', async () => {
    try {
      const enabled = isIntegrationEnabled();
      const connected = hasValidTokens();
      const t = loadTokensFromSafeStorage();
      return {
        ok: true as const,
        enabled,
        connected,
        hasRefreshToken: !!t?.refreshToken,
      };
    } catch (e: unknown) {
      return { ok: false as const, message: toErrorMessage(e, 'تعذر قراءة حالة Google Calendar') };
    }
  });

  ipcMain.handle('googleCalendar:setEnabled', async (_e, enabled: unknown) => {
    try {
      setIntegrationEnabled(!!enabled);
      return { ok: true as const };
    } catch (e: unknown) {
      return { ok: false as const, message: toErrorMessage(e, 'تعذر حفظ الإعداد') };
    }
  });

  ipcMain.handle('googleCalendar:auth', async (_e, payload: unknown) => {
    const op =
      payload && typeof payload === 'object' && 'op' in payload
        ? String((payload as { op?: unknown }).op || '')
        : '';
    try {
      if (op === 'signOut') {
        signOutGoogle();
        return { ok: true as const };
      }
      if (op === 'start') {
        await startAuthorizationCodeFlowPkce();
        return { ok: true as const };
      }
      return { ok: false as const, message: 'عملية غير معروفة' };
    } catch (e: unknown) {
      return { ok: false as const, message: toErrorMessage(e, 'فشل تسجيل الدخول في Google') };
    }
  });

  ipcMain.handle('googleCalendar:syncTasks', async (_e, payload: unknown) => {
    try {
      if (!isIntegrationEnabled()) {
        return { ok: false as const, message: 'تكامل Google Calendar معطّل في الإعدادات.' };
      }
      if (!hasValidTokens()) {
        return { ok: false as const, message: 'لم يتم الربط مع حساب Google.' };
      }
      const raw =
        payload && typeof payload === 'object' && 'tasks' in payload
          ? (payload as { tasks?: unknown }).tasks
          : [];
      const list = Array.isArray(raw) ? raw : [];
      const tasks: GoogleCalendarTaskInput[] = [];
      for (const item of list) {
        if (!item || typeof item !== 'object') continue;
        const o = item as Record<string, unknown>;
        tasks.push({
          id: String(o.id ?? ''),
          title: String(o.title ?? ''),
          date: String(o.date ?? ''),
          ...(typeof o.time === 'string' ? { time: o.time } : {}),
          ...(typeof o.description === 'string' ? { description: o.description } : {}),
          ...(typeof o.done === 'boolean' ? { done: o.done } : {}),
        });
      }
      return await syncTasksToGoogleCalendar(tasks);
    } catch (e: unknown) {
      return { ok: false as const, message: toErrorMessage(e, 'فشل المزامنة') };
    }
  });
}
