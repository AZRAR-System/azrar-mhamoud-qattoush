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

  // 4) Recent Activity Feed
  try {
    const cutoffs: Record<string, number> = {
      'Contracts_إضافة': Date.now() - 48 * 3600 * 1000,
      'Installments_سداد': Date.now() - 8 * 3600 * 1000,
      'Properties_مؤجر': Date.now() - 24 * 3600 * 1000,
      'Contracts_فسخ': Date.now() - 72 * 3600 * 1000,
    };

    const getHoursRemaining = (logTime: number, hours: number | null): string => {
      if (hours === null) return 'دائم';
      const remaining = Math.max(0, Math.ceil((logTime + hours * 3600 * 1000 - Date.now()) / 3600000));
      if (remaining <= 0) return 'ينتهي قريباً';
      if (remaining === 1) return 'ينتهي خلال ساعة';
      if (remaining < 24) return `ينتهي بعد ${remaining} ساعة`;
      return `ينتهي بعد ${Math.ceil(remaining / 24)} يوم`;
    };

    const recentLogs = get<{ id: string; نوع_العملية: string; اسم_الجدول: string; رقم_السجل: string; تاريخ_العملية: string; details?: string }>(KEYS.LOGS)
      .filter(l => {
        const table = String(l.اسم_الجدول || '');
        const op = String(l.نوع_العملية || '');
        const logTime = Date.parse(String(l.تاريخ_العملية || ''));
        if (!Number.isFinite(logTime)) return false;
        if (table === 'Contracts' && op === 'إضافة') return logTime >= cutoffs['Contracts_إضافة'];
        if (table === 'Installments' && op === 'سداد') return logTime >= cutoffs['Installments_سداد'];
        if (table === 'Contracts' && op === 'فسخ') return logTime >= cutoffs['Contracts_فسخ'];
        if (table === 'Properties' && op === 'تعديل') {
          const prop = get<any>(KEYS.PROPERTIES).find((p: any) => p.رقم_العقار === String(l.رقم_السجل || ''));
          return prop?.IsRented && logTime >= cutoffs['Properties_مؤجر'];
        }
        if (table === 'Properties' && op === 'إضافة') {
          const prop = get<any>(KEYS.PROPERTIES).find((p: any) => p.رقم_العقار === String(l.رقم_السجل || ''));
          return prop && !prop.IsRented;
        }
        return false;
      })
      .sort((a, b) => String(b.تاريخ_العملية || '').localeCompare(String(a.تاريخ_العملية || '')))
      .slice(0, 8);

    for (const log of recentLogs) {
      const table = String(log.اسم_الجدول || '');
      const op = String(log.نوع_العملية || '');
      const id = String(log.رقم_السجل || '');
      const logTime = Date.parse(String(log.تاريخ_العملية || ''));
      let content = '';
      let action: MarqueeMessage['action'] | undefined;

      if (table === 'Contracts' && op === 'إضافة') {
        try {
          const contract = get<any>(KEYS.CONTRACTS).find((c: any) => c.رقم_العقد === id);
          const tenant = contract ? get<any>(KEYS.PEOPLE).find((p: any) => p.رقم_الشخص === contract.رقم_المستاجر) : null;
          const prop = contract ? get<any>(KEYS.PROPERTIES).find((p: any) => p.رقم_العقار === contract.رقم_العقار) : null;
          const propCode = prop?.الكود_الداخلي || id;
          const tenantName = tenant?.الاسم || '';
          const annual = contract?.القيمة_السنوية ? contract.القيمة_السنوية + ' د.أ/سنة' : '';
          const exp = getHoursRemaining(logTime, 48);
          content = `عقد جديد — ${propCode}${tenantName ? ' · ' + tenantName : ''}${annual ? ' · ' + annual : ''} [${exp}]`;
        } catch { content = `عقد جديد — ${id}`; }
        action = { kind: 'panel', panel: 'CONTRACT_DETAILS', id };
      } else if (table === 'Properties') {
        try {
          const prop = get<any>(KEYS.PROPERTIES).find((p: any) => p.رقم_العقار === id);
          const owner = prop ? get<any>(KEYS.PEOPLE).find((p: any) => p.رقم_الشخص === prop.رقم_المالك) : null;
          const code = prop?.الكود_الداخلي || id;
          const type = prop?.النوع || '';
          const address = prop?.العنوان || '';
          const ownerName = owner?.الاسم || '';
          const isRented = prop?.IsRented;
          const exp = getHoursRemaining(logTime, isRented ? 24 : null);
          const status = isRented ? 'عقار مؤجر' : (op === 'إضافة' ? 'عقار جديد' : 'عقار شاغر');
          content = `${status} — ${code}${type ? ' · ' + type : ''}${ownerName ? ' · ' + ownerName : ''}${address ? ' · ' + address : ''} [${exp}]`;
        } catch { content = `عقار — ${id}`; }
        action = { kind: 'panel', panel: 'PROPERTY_DETAILS', id };
      } else if (table === 'Installments' && op === 'سداد') {
        try {
          const inst = get<any>(KEYS.INSTALLMENTS).find((i: any) => i.رقم_الكمبيالة === id);
          const contract = inst ? get<any>(KEYS.CONTRACTS).find((c: any) => c.رقم_العقد === inst.رقم_العقد) : null;
          const tenant = contract ? get<any>(KEYS.PEOPLE).find((p: any) => p.رقم_الشخص === contract.رقم_المستاجر) : null;
          const prop = contract ? get<any>(KEYS.PROPERTIES).find((p: any) => p.رقم_العقار === contract.رقم_العقار) : null;
          const propCode = prop?.الكود_الداخلي || '';
          const amount = inst?.القيمة || '';
          const tenantName = tenant?.الاسم || '';
          const exp = getHoursRemaining(logTime, 8);
          content = `دفعة مسددة — ${propCode ? propCode + ' · ' : ''}${amount ? amount + ' د.أ' : ''}${tenantName ? ' · ' + tenantName : ''} [${exp}]`;
          action = contract ? { kind: 'panel', panel: 'CONTRACT_DETAILS', id: contract.رقم_العقد } : { kind: 'panel', panel: 'CONTRACT_DETAILS', id };
        } catch { content = `دفعة مسددة — ${id}`; }
      } else if (table === 'Contracts' && op === 'فسخ') {
        try {
          const contract = get<any>(KEYS.CONTRACTS).find((c: any) => c.رقم_العقد === id);
          const tenant = contract ? get<any>(KEYS.PEOPLE).find((p: any) => p.رقم_الشخص === contract.رقم_المستاجر) : null;
          const prop = contract ? get<any>(KEYS.PROPERTIES).find((p: any) => p.رقم_العقار === contract.رقم_العقار) : null;
          const propCode = prop?.الكود_الداخلي || '';
          const tenantName = tenant?.الاسم || '';
          const exp = getHoursRemaining(logTime, 72);
          content = `عقد مفسوخ — ${propCode ? propCode + ' · ' : ''}${id}${tenantName ? ' · ' + tenantName : ''} [${exp}]`;
        } catch { content = `عقد مفسوخ — ${id}`; }
        action = { kind: 'panel', panel: 'CONTRACT_DETAILS', id };
      }

      if (content) {
        messages.push({
          id: `activity_${log.id}`,
          content,
          priority: 'Normal',
          type: 'info',
          ...(action ? { action } : {}),
        });
      }
    }
  } catch (_e) { /* ignore */ }

  return messages;
};
