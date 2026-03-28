/**
 * Kanban bucketing + kind filter for dashboard tasks (Calendar tasks layer).
 */

import { parseDateOnly, toDateOnly } from '@/utils/dateOnly';

export type KanbanBucketId = 'overdue' | 'today' | 'week' | 'completed';

export type TaskKindFilter = 'all' | 'general' | 'contract' | 'person' | 'property';

export interface KanbanTask {
  id: string;
  title: string;
  dueDate: string;
  dueTime?: string;
  priority: 'عالية' | 'متوسطة' | 'منخفضة';
  status: 'pending' | 'completed';
  category: string;
  description?: string;
  personId?: string;
  contractId?: string;
  propertyId?: string;
  clientName?: string;
  phone?: string;
}

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDueYMD(dueDate: string): boolean {
  const s = String(dueDate || '').trim();
  if (!YMD_RE.test(s)) return false;
  const d = parseDateOnly(s);
  return !!d;
}

const toMinutes = (hm?: string): number | null => {
  const raw = String(hm || '').trim();
  if (!raw) return null;
  const m = raw.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
};

export function getTaskKind(task: KanbanTask): Exclude<TaskKindFilter, 'all'> {
  const contractId = String(task.contractId || '').trim();
  const personId = String(task.personId || '').trim();
  const propertyId = String(task.propertyId || '').trim();
  if (contractId) return 'contract';
  if (personId) return 'person';
  if (propertyId) return 'property';
  const c = String(task.category || '').trim();
  if (c === 'عقد' || c === 'عقود') return 'contract';
  if (c === 'شخص' || c === 'أشخاص') return 'person';
  if (c === 'عقار' || c === 'عقارات') return 'property';
  return 'general';
}

export function filterTasksByKind(tasks: KanbanTask[], filter: TaskKindFilter): KanbanTask[] {
  if (filter === 'all') return tasks;
  return tasks.filter((t) => getTaskKind(t) === filter);
}

export interface BucketResult {
  bucket: KanbanBucketId;
  noDate?: boolean;
}

export function bucketForTask(task: KanbanTask, todayYMD: string, now: Date): BucketResult {
  if (task.status === 'completed') {
    return { bucket: 'completed' };
  }

  const dueRaw = String(task.dueDate || '').trim();
  if (!isValidDueYMD(dueRaw)) {
    return { bucket: 'week', noDate: true };
  }

  const due = parseDateOnly(dueRaw);
  const today = parseDateOnly(todayYMD);
  if (!due || !today) {
    return { bucket: 'week', noDate: true };
  }

  const dueT = toDateOnly(due).getTime();
  const todayT = toDateOnly(today).getTime();

  if (dueT < todayT) {
    return { bucket: 'overdue' };
  }

  if (dueT === todayT) {
    const tm = toMinutes(task.dueTime);
    if (tm !== null) {
      const nowM = now.getHours() * 60 + now.getMinutes();
      if (nowM >= tm) {
        return { bucket: 'overdue' };
      }
    }
    return { bucket: 'today' };
  }

  // dueT > todayT → upcoming (عمود هذا الأسبوع لجميع المستقبل بما فيها ما بعد الأسبوع)
  return { bucket: 'week' };
}

export function sortTasksForColumn(a: KanbanTask, b: KanbanTask): number {
  if (a.status !== b.status) return a.status === 'pending' ? -1 : 1;
  const ad = String(a.dueDate || '');
  const bd = String(b.dueDate || '');
  if (ad !== bd) return ad.localeCompare(bd);
  const am = toMinutes(a.dueTime);
  const bm = toMinutes(b.dueTime);
  const av = am === null ? Number.POSITIVE_INFINITY : am;
  const bv = bm === null ? Number.POSITIVE_INFINITY : bm;
  if (av !== bv) return av - bv;
  return String(a.title || '').localeCompare(String(b.title || ''));
}

export function buildKanbanColumns(
  tasks: KanbanTask[],
  todayYMD: string,
  now: Date
): Record<KanbanBucketId, KanbanTask[]> {
  const cols: Record<KanbanBucketId, KanbanTask[]> = {
    overdue: [],
    today: [],
    week: [],
    completed: [],
  };

  for (const t of tasks) {
    const { bucket } = bucketForTask(t, todayYMD, now);
    cols[bucket].push(t);
  }

  (Object.keys(cols) as KanbanBucketId[]).forEach((k) => {
    cols[k].sort(sortTasksForColumn);
  });

  return cols;
}
