import { get, save } from '../kv';
import { KEYS } from '../keys';
import { PropertyInspection, DbResult } from '@/types';
import { dbFail, dbOk } from '@/services/localDbStorage';
import { purgeRefs } from '../refs';

export type InspectionDeps = {
  logOperation: (user: string, action: string, table: string, id: string, msg: string) => void;
};

export const getPropertyInspections = (propertyId: string) => {
  return get<PropertyInspection>(KEYS.INSPECTIONS)
    .filter((x) => String(x.propertyId) === String(propertyId))
    .slice()
    .sort((a, b) => String(b.inspectionDate || '').localeCompare(String(a.inspectionDate || '')));
};

export const getInspection = (id: string) =>
  get<PropertyInspection>(KEYS.INSPECTIONS).find((x) => x.id === id) || null;

export const getLatestInspectionForProperty = (propertyId: string) => {
  const all = getPropertyInspections(propertyId);
  return all.length ? all[0] : null;
};

export function createInspectionHandlers(deps: InspectionDeps) {
  const { logOperation } = deps;
  const fail = dbFail;
  const ok = dbOk;

  const createInspection = (data: Omit<PropertyInspection, 'id' | 'createdAt' | 'updatedAt'>): DbResult<PropertyInspection> => {
    if (!data?.propertyId) return fail('رقم العقار مطلوب');
    if (!data?.inspectionDate) return fail('تاريخ الكشف مطلوب');

    const all = get<PropertyInspection>(KEYS.INSPECTIONS);
    const nowIso = new Date().toISOString();
    const newRec: PropertyInspection = {
      ...data,
      id: `INS-${Date.now()}`,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    save(KEYS.INSPECTIONS, [...all, newRec]);
    logOperation('Admin', 'إضافة', 'Inspections', newRec.id, `إضافة كشف للعقار ${data.propertyId}`);
    return ok(newRec, 'تم إضافة الكشف');
  };

  const updateInspection = (id: string, patch: Partial<Omit<PropertyInspection, 'id' | 'createdAt'>>): DbResult<PropertyInspection> => {
    const all = get<PropertyInspection>(KEYS.INSPECTIONS);
    const idx = all.findIndex((x) => x.id === id);
    if (idx === -1) return fail('الكشف غير موجود');

    const next: PropertyInspection = { ...all[idx], ...patch, updatedAt: new Date().toISOString() };
    const updated = [...all];
    updated[idx] = next;
    save(KEYS.INSPECTIONS, updated);
    logOperation('Admin', 'تعديل', 'Inspections', id, 'تعديل بيانات الكشف');
    return ok(next, 'تم تعديل الكشف');
  };

  const deleteInspection = (id: string): DbResult<null> => {
    const all = get<PropertyInspection>(KEYS.INSPECTIONS);
    const target = all.find((x) => x.id === id);
    if (!target) return ok(null, 'الكشف غير موجود');
    purgeRefs('Inspection', id);
    save(KEYS.INSPECTIONS, all.filter((x) => x.id !== id));
    logOperation('Admin', 'حذف', 'Inspections', id, 'حذف كشف (مع المرفقات/الملاحظات/السجل)');
    return ok(null, 'تم حذف الكشف');
  };

  return { createInspection, updateInspection, deleteInspection };
}
