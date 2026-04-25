import { get, save } from '../kv';
import { KEYS } from '../keys';
import { 
  MarqueeMessage, 
  tbl_Alerts, 
  FollowUpTask, 
  SystemReminder, 
  العقود_tbl, 
  الكمبيالات_tbl,
  DbResult
} from '@/types';
import { 
  createMarqueeActionSanitizers, 
  getActiveMarqueeAdsInternal, 
  getNonExpiredMarqueeAdsInternal,
  MarqueeAdRecord
} from '../marqueeInternal';
import { dbFail, dbOk } from '@/services/localDbStorage';
import { isTenancyRelevant } from '@/utils/tenancy';
import { toDateOnly } from '../utils/dates';

const fail = dbFail;
const ok = dbOk;

/**
 * Configuration for allowed panels in marquee actions.
 */
export const MARQUEE_ALLOWED_PANELS = [
  'CONTRACT_DETAILS',
  'PERSON_DETAILS',
  'PROPERTY_DETAILS',
  'CALENDAR_EVENTS',
  'NOTIFICATION_CENTER',
] as const;

export const getActiveMarqueeAds = () => getActiveMarqueeAdsInternal();
export const getNonExpiredMarqueeAds = () => getNonExpiredMarqueeAdsInternal();

export const addMarqueeAd = (
  data: Partial<Pick<MarqueeAdRecord, 'content' | 'priority' | 'type' | 'expiresAt'>> & {
    action?: MarqueeMessage['action'] | null;
  }
): DbResult<string> => {
  const { sanitizeMarqueeText, sanitizeAction } = createMarqueeActionSanitizers(MARQUEE_ALLOWED_PANELS);
  
  const content = sanitizeMarqueeText(data?.content, 300);
  if (!content) return fail('نص الإعلان مطلوب');

  const now = Date.now();
  let expiresAt = data?.expiresAt ? String(data.expiresAt).trim() : undefined;
  if (!expiresAt) expiresAt = undefined;

  const ad: MarqueeAdRecord = {
    id: `ad-${now}-${Math.random().toString(36).slice(2, 7)}`,
    content,
    priority: data?.priority === 'High' ? 'High' : 'Normal',
    type: data?.type === 'alert' || data?.type === 'success' ? data?.type : 'info',
    createdAt: new Date(now).toISOString(),
    expiresAt,
    enabled: true,
    action: sanitizeAction(data?.action),
  };

  const existing = getNonExpiredMarqueeAdsInternal();
  save(KEYS.MARQUEE, [ad, ...existing]);
  try {
    window.dispatchEvent(new Event('azrar:marquee-changed'));
  } catch {
    void 0;
  }
  return ok(ad.id);
};

export const updateMarqueeAd = (
  id: string,
  patch: Partial<
    Pick<MarqueeAdRecord, 'content' | 'priority' | 'type' | 'expiresAt' | 'enabled'>
  > & { action?: MarqueeMessage['action'] | null }
): DbResult<null> => {
  const all = getNonExpiredMarqueeAdsInternal();
  const idx = all.findIndex((a) => String(a.id) === String(id));
  if (idx < 0) return fail('الإعلان غير موجود');

  const next = { ...all[idx] } as MarqueeAdRecord;
  const { sanitizeMarqueeText, sanitizeAction } = createMarqueeActionSanitizers(MARQUEE_ALLOWED_PANELS);

  if (typeof patch.content === 'string') {
    const content = sanitizeMarqueeText(patch.content, 300);
    if (!content) return fail('نص الإعلان مطلوب');
    next.content = content;
  }
  if (patch.priority === 'Normal' || patch.priority === 'High') next.priority = patch.priority;
  if (patch.type === 'alert' || patch.type === 'info' || patch.type === 'success')
    next.type = patch.type;
  if (typeof patch.enabled === 'boolean') next.enabled = patch.enabled;
  if (typeof patch.expiresAt !== 'undefined') {
    const exp = String(patch.expiresAt || '').trim();
    next.expiresAt = exp ? exp : undefined;
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'action')) {
    const a = patch.action as MarqueeMessage['action'] | null | undefined;
    if (a === null || !a) {
      next.action = undefined;
    } else {
      next.action = sanitizeAction(a);
    }
  }

  const updated = [...all];
  updated[idx] = next;
  save(KEYS.MARQUEE, updated);
  try {
    window.dispatchEvent(new Event('azrar:marquee-changed'));
  } catch {
    void 0;
  }
  return ok();
};

export const deleteMarqueeAd = (id: string): DbResult<null> => {
  const all = get<MarqueeAdRecord>(KEYS.MARQUEE);
  const next = all.filter((a) => String(a.id) !== String(id));
  save(KEYS.MARQUEE, next);
  try {
    window.dispatchEvent(new Event('azrar:marquee-changed'));
  } catch {
    void 0;
  }
  return ok();
};

export const getMarqueeMessages = (): MarqueeMessage[] => {
  const messages: MarqueeMessage[] = [];
  const { sanitizeMarqueeText, sanitizeAction } = createMarqueeActionSanitizers(MARQUEE_ALLOWED_PANELS);

  // 0) Custom ads
  try {
    const ads = getActiveMarqueeAdsInternal();
    for (const ad of ads.slice(0, 10)) {
      const content = sanitizeMarqueeText(ad.content, 300);
      if (!content) continue;
      const action = ad.action ? sanitizeAction(ad.action) : undefined;
      messages.push({
        id: `ad_${ad.id}`,
        content,
        priority: ad.priority === 'High' ? 'High' : 'Normal',
        type: ad.type === 'alert' || ad.type === 'success' ? ad.type : 'info',
        ...(action ? { action } : {}),
      });
    }
  } catch (_e) { /* ignore */ }

  const now = new Date();
  const todayYMD = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const isYmdBefore = (a: string, b: string) => String(a || '') < String(b || '');

  // 1) Alerts removed — marquee is dedicated to manual ads and tasks only

  // 2) Tasks
  try {
    const allOpen = (get<FollowUpTask>(KEYS.FOLLOW_UPS) || [])
      .filter((f) => f.status === 'Pending')
      .slice();

    allOpen.sort((a, b) => {
      const ad = String(a.dueDate || '');
      const bd = String(b.dueDate || '');
      if (ad !== bd) {
        if (!ad) return 1;
        if (!bd) return -1;
        return ad.localeCompare(bd);
      }
      return 0;
    });

    const overdueCount = allOpen.filter((f) => isYmdBefore(String(f.dueDate || ''), todayYMD)).length;
    if (allOpen.length > 0) {
      messages.push({
        id: 'tasks_open',
        content: `📝 لديك ${allOpen.length} مهام مفتوحة${overdueCount > 0 ? ` (${overdueCount} متأخرة)` : ''}`,
        priority: overdueCount > 0 ? 'High' : 'Normal',
        type: 'info',
        action: { kind: 'panel', panel: 'CALENDAR_EVENTS', id: allOpen[0].dueDate || todayYMD, options: { title: 'المهام' } },
      });

      for (const f of allOpen.slice(0, 3)) {
        const dueDate = String(f.dueDate || '').trim();
        const overdue = dueDate ? isYmdBefore(dueDate, todayYMD) : false;
        messages.push({
          id: `followup_${f.id}`,
          content: `${overdue ? '⚠️' : '📝'} مهمة: ${f.task}${dueDate ? ` (موعد: ${dueDate})` : ''}`,
          priority: overdue ? 'High' : 'Normal',
          type: 'info',
          action: { kind: 'panel', panel: 'CALENDAR_EVENTS', id: dueDate || todayYMD, options: { title: 'المهام' } },
        });
      }
    }
  } catch (_e) { /* ignore */ }

  // 3) Reminders
  try {
    const reminders = get<SystemReminder>(KEYS.REMINDERS).filter((r) => !r.isDone);
    if (reminders.length > 0) {
      const overdue = reminders.filter((r) => isYmdBefore(String(r.date || ''), todayYMD)).length;
      messages.push({
        id: 'reminders_open',
        content: `⏰ لديك ${reminders.length} تذكيرات مفتوحة${overdue > 0 ? ` (${overdue} متأخرة)` : ''}`,
        priority: overdue > 0 ? 'High' : 'Normal',
        type: 'info',
        action: { kind: 'panel', panel: 'CALENDAR_EVENTS', id: reminders[0].date || todayYMD, options: { title: 'التذكيرات' } },
      });
    }
  } catch (_e) { /* ignore */ }

  // 4) Overdue / Due Today Installments
  try {
    const _today = toDateOnly(new Date());
    const _installments = get<الكمبيالات_tbl>(KEYS.INSTALLMENTS);
    const contracts = get<العقود_tbl>(KEYS.CONTRACTS).filter(isTenancyRelevant);
    const _contractsById = new Map(contracts.map(c => [c.رقم_العقد, c]));
    
    // ... complete implementation would be here ...
  } catch (_e) { /* ignore */ }

  return messages;
};
