/**
 * مرشّحو «الفني» لتعيين الصيانة — لا يوجد جدول فنيين مستقل في النماذج الحالية.
 * المصدر: (1) معرفات من حقول ديناميكية في تذاكر الصيانة (2) أشخاص بتصنيف يشير إلى فني/صيانة.
 */

import { DbService } from '@/services/mockDb';
import type { الأشخاص_tbl, تذاكر_الصيانة_tbl } from '@/types';

export type TechnicianOption = { id: string; label: string };

const readDynId = (dyn: Record<string, unknown> | undefined, keys: string[]): string => {
  if (!dyn) return '';
  for (const k of keys) {
    const v = dyn[k];
    const s = String(v ?? '').trim();
    if (s) return s;
  }
  return '';
};

/** قائمة فنيين محتملين لعرضها في مودال التعيين (بدون استدعاء DB جديد خارج DbService الحالي). */
export function listMaintenanceTechnicianCandidates(): TechnicianOption[] {
  const people = (DbService.getPeople?.() || []) as الأشخاص_tbl[];
  const tickets = (DbService.getMaintenanceTickets?.() || []) as تذاكر_الصيانة_tbl[];
  const byId = new Map<string, string>();

  for (const t of tickets) {
    const dyn = (t.حقول_ديناميكية || {}) as Record<string, unknown>;
    const pid = readDynId(dyn, ['رقم_الفني', 'technicianId', 'assignedTechnicianId', 'assigned_to']);
    if (!pid) continue;
    const p = people.find((x) => String(x?.رقم_الشخص) === pid);
    byId.set(pid, String(p?.الاسم || `فني #${pid}`));
  }

  for (const p of people) {
    const cl = String(p.تصنيف || '').toLowerCase();
    if (!cl) continue;
    if (
      cl.includes('فني') ||
      cl.includes('صيانة') ||
      cl.includes('technician') ||
      cl.includes('maintenance')
    ) {
      const id = String(p.رقم_الشخص || '').trim();
      if (id) byId.set(id, String(p.الاسم || id));
    }
  }

  return Array.from(byId.entries())
    .map(([id, label]) => ({ id, label }))
    .sort((a, b) => a.label.localeCompare(b.label, 'ar'));
}
