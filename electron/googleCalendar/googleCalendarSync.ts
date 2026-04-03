import { GOOGLE_CALENDAR_API, KV_GOOGLE_CALENDAR_EVENT_MAP } from './config.js';
import { refreshAccessTokenIfNeeded, type StoredGoogleTokens } from './googleAuthManager.js';
import { kvGet, kvSet } from '../db.js';
import { toErrorMessage } from '../utils/errors.js';

export type GoogleCalendarTaskInput = {
  id: string;
  title: string;
  /** YYYY-MM-DD */
  date: string;
  time?: string;
  description?: string;
  /** If true, event is removed from Google when previously synced */
  done?: boolean;
};

function safeJsonParseRecord(raw: string | null): Record<string, string> {
  if (!raw) return {};
  try {
    const j = JSON.parse(raw) as unknown;
    if (!j || typeof j !== 'object') return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(j as Record<string, unknown>)) {
      if (typeof v === 'string' && v) out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

function loadEventMap(): Record<string, string> {
  return safeJsonParseRecord(kvGet(KV_GOOGLE_CALENDAR_EVENT_MAP));
}

function saveEventMap(map: Record<string, string>): void {
  kvSet(KV_GOOGLE_CALENDAR_EVENT_MAP, JSON.stringify(map));
}

function addOneDayYmd(ymd: string): string {
  const [y, m, d] = ymd.split('-').map((x) => parseInt(x, 10));
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + 1);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function buildDateTimeIso(dateYmd: string, timeHm?: string): { start: string; end: string; allDay: boolean } {
  const d = String(dateYmd || '').trim();
  const t = String(timeHm || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const fallback = `${y}-${m}-${day}`;
    return { start: fallback, end: addOneDayYmd(fallback), allDay: true };
  }
  if (t && /^\d{1,2}:\d{2}$/.test(t)) {
    const [hh, mm] = t.split(':').map((x) => parseInt(x, 10));
    const pad = (n: number) => String(n).padStart(2, '0');
    const startIso = `${d}T${pad(hh)}:${pad(mm)}:00`;
    const endDate = new Date(`${d}T${pad(hh)}:${pad(mm)}:00`);
    endDate.setMinutes(endDate.getMinutes() + 30);
    const endIso = endDate.toISOString().slice(0, 19);
    return { start: startIso, end: endIso, allDay: false };
  }
  return { start: d, end: addOneDayYmd(d), allDay: true };
}

async function calendarFetch(
  tokens: StoredGoogleTokens,
  method: string,
  url: string,
  body?: unknown
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${tokens.accessToken}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return res;
}

/**
 * One-way sync: AZRAR tasks → Google Calendar `primary`.
 * Updates existing events when task id was mapped; creates otherwise.
 * Removes calendar events for tasks marked done when mapped.
 */
export async function syncTasksToGoogleCalendar(tasks: GoogleCalendarTaskInput[]): Promise<{
  ok: boolean;
  created?: number;
  updated?: number;
  deleted?: number;
  message?: string;
}> {
  let tokens: StoredGoogleTokens | null;
  try {
    tokens = await refreshAccessTokenIfNeeded();
  } catch (e: unknown) {
    return { ok: false, message: toErrorMessage(e, 'فشل تحديث رمز Google') };
  }
  if (!tokens?.accessToken) {
    return { ok: false, message: 'لم يتم الربط مع Google Calendar.' };
  }

  const map = loadEventMap();
  let created = 0;
  let updated = 0;
  let deleted = 0;

  try {
    const seen = new Set<string>();

    for (const task of tasks) {
      const id = String(task.id || '').trim();
      if (!id) continue;
      seen.add(id);

      const eventId = map[id];
      if (task.done) {
        if (eventId) {
          const delUrl = `${GOOGLE_CALENDAR_API}/calendars/primary/events/${encodeURIComponent(eventId)}`;
          const res = await calendarFetch(tokens, 'DELETE', delUrl);
          if (res.status === 204 || res.status === 200 || res.status === 404) {
            delete map[id];
            deleted += 1;
          } else {
            const errText = await res.text().catch(() => '');
            throw new Error(errText || `delete ${res.status}`);
          }
        }
        continue;
      }

      const title = String(task.title || 'مهمة AZRAR').trim() || 'مهمة AZRAR';
      const { start, end, allDay } = buildDateTimeIso(task.date, task.time);
      const descParts = [
        task.description ? String(task.description) : '',
        `AZRAR task id: ${id}`,
      ].filter(Boolean);
      const description = descParts.join('\n\n');

      const body: Record<string, unknown> = {
        summary: `AZRAR · ${title}`,
        description,
        extendedProperties: {
          private: { azrarTaskId: id },
        },
      };

      if (allDay) {
        body.start = { date: start };
        body.end = { date: end };
      } else {
        body.start = { dateTime: start, timeZone: 'Asia/Amman' };
        body.end = { dateTime: end, timeZone: 'Asia/Amman' };
      }

      if (eventId) {
        const patchUrl = `${GOOGLE_CALENDAR_API}/calendars/primary/events/${encodeURIComponent(eventId)}`;
        const res = await calendarFetch(tokens, 'PATCH', patchUrl, body);
        if (!res.ok) {
          const t = await res.text().catch(() => '');
          throw new Error(t || `patch ${res.status}`);
        }
        updated += 1;
      } else {
        const insertUrl = `${GOOGLE_CALENDAR_API}/calendars/primary/events`;
        const res = await calendarFetch(tokens, 'POST', insertUrl, body);
        if (!res.ok) {
          const t = await res.text().catch(() => '');
          throw new Error(t || `insert ${res.status}`);
        }
        const j = (await res.json()) as { id?: string };
        if (j?.id) {
          map[id] = j.id;
          created += 1;
        }
      }
    }

    // Optional: remove orphan mappings not in current task list (skipped — keep map stable)

    saveEventMap(map);

    return { ok: true, created, updated, deleted };
  } catch (e: unknown) {
    saveEventMap(map);
    return { ok: false, message: toErrorMessage(e, 'فشل مزامنة Google Calendar') };
  }
}
