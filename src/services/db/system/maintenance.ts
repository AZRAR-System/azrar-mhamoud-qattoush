import { get, save } from '../kv';
import { KEYS } from '../keys';
import { تذاكر_الصيانة_tbl, DbResult } from '@/types';
import { dbOk } from '@/services/localDbStorage';
import { buildCache } from '../../dbCache';
import { purgeRefs } from '../refs';

const ok = dbOk;

/**
 * Maintenance Ticket management service
 */

export const getMaintenanceTickets = (): تذاكر_الصيانة_tbl[] => get<تذاكر_الصيانة_tbl>(KEYS.MAINTENANCE);

export const addMaintenanceTicket = (data: تذاكر_الصيانة_tbl): DbResult<null> => {
  const all = get<تذاكر_الصيانة_tbl>(KEYS.MAINTENANCE);
  save(KEYS.MAINTENANCE, [...all, { ...data, رقم_التذكرة: `MNT-${Date.now()}` }]);
  buildCache();
  return ok();
};

export const updateMaintenanceTicket = (id: string, data: Partial<تذاكر_الصيانة_tbl>) => {
  const all = get<تذاكر_الصيانة_tbl>(KEYS.MAINTENANCE);
  const idx = all.findIndex((t) => t.رقم_التذكرة === id);
  if (idx > -1) {
    const patch: Partial<تذاكر_الصيانة_tbl> = { ...data };
    if (patch.الحالة === 'مغلق' && !patch.تاريخ_الإغلاق) {
      patch.تاريخ_الإغلاق = new Date().toISOString().split('T')[0];
    }
    all[idx] = { ...all[idx], ...patch };
    save(KEYS.MAINTENANCE, all);
    buildCache();
  }
};

export const deleteMaintenanceTicket = (
  id: string, 
  logOperation: (user: string, action: string, table: string, id: string, msg: string) => void
): DbResult<null> => {
  const all = get<تذاكر_الصيانة_tbl>(KEYS.MAINTENANCE);
  const idx = all.findIndex((t) => t.رقم_التذكرة === id);
  if (idx === -1) return ok();

  const next = all.filter((t) => t.رقم_التذكرة !== id);
  save(KEYS.MAINTENANCE, next);
  purgeRefs('Maintenance', id);

  logOperation('Admin', 'حذف', 'Maintenance', id, 'حذف تذكرة صيانة نهائياً');
  buildCache();
  return ok();
};
