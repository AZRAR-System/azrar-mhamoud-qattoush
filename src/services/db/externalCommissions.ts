import { get, save } from './kv';
import { KEYS } from './keys';
import { العمولات_الخارجية_tbl, DbResult } from '@/types';
import { dbFail, dbOk } from '@/services/localDbStorage';

export type ExternalCommDeps = {
  logOperation: (user: string, action: string, table: string, id: string, msg: string) => void;
};

export const getExternalCommissions = () => get<العمولات_الخارجية_tbl>(KEYS.EXTERNAL_COMMISSIONS);

export function createExternalCommHandlers(deps: ExternalCommDeps) {
  const { logOperation } = deps;
  const fail = dbFail;
  const ok = dbOk;

  const addExternalCommission = (data: Partial<العمولات_الخارجية_tbl>): DbResult<null> => {
    const all = getExternalCommissions();
    const id = `EXT-${Date.now()}`;
    save(KEYS.EXTERNAL_COMMISSIONS, [...all, { ...data, id: id } as العمولات_الخارجية_tbl]);
    logOperation('Admin', 'إضافة', 'ExternalCommissions', id, 'إضافة عمولة خارجية');
    return ok();
  };

  const updateExternalCommission = (id: string, patch: Partial<العمولات_الخارجية_tbl>): DbResult<null> => {
    const all = getExternalCommissions();
    const idx = all.findIndex((c) => c.id === id);
    if (idx === -1) return fail('العمولة غير موجودة');
    all[idx] = { ...all[idx], ...patch };
    save(KEYS.EXTERNAL_COMMISSIONS, all);
    logOperation('Admin', 'تعديل', 'ExternalCommissions', id, 'تعديل عمولة خارجية');
    return ok();
  };

  const deleteExternalCommission = (id: string): DbResult<null> => {
    const all = getExternalCommissions();
    save(KEYS.EXTERNAL_COMMISSIONS, all.filter((c) => c.id !== id));
    logOperation('Admin', 'حذف', 'ExternalCommissions', id, 'حذف عمولة خارجية');
    return ok();
  };

  return { addExternalCommission, updateExternalCommission, deleteExternalCommission };
}
