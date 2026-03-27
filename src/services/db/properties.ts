/**
 * Properties domain: CRUD and property details aggregate.
 */

import { العقارات_tbl, الأشخاص_tbl, العقود_tbl, PropertyDetailsResult, DbResult } from '@/types';
import { pickBestTenancyContract } from '@/utils/tenancy';
import { validateNewProperty } from '@/services/dataValidation';
import { dbFail, dbOk } from '@/services/localDbStorage';
import { get, save } from './kv';
import { KEYS } from './keys';

const ok = dbOk;
const fail = dbFail;

export const getProperties = (): العقارات_tbl[] => get<العقارات_tbl>(KEYS.PROPERTIES);

export const addProperty = (data: Omit<العقارات_tbl, 'رقم_العقار'>): DbResult<العقارات_tbl> => {
  const validation = validateNewProperty(data as العقارات_tbl);
  if (!validation.isValid) {
    return fail(validation.errors.join(', '));
  }

  const id = `PROP-${Date.now()}`;
  const all = get<العقارات_tbl>(KEYS.PROPERTIES);

  const isRented = (data as Partial<العقارات_tbl>).IsRented ?? data.حالة_العقار === 'مؤجر';
  const newProp: العقارات_tbl = {
    ...data,
    رقم_العقار: id,
    IsRented: isRented,
  };
  save(KEYS.PROPERTIES, [...all, newProp]);
  return ok(newProp);
};

export const updateProperty = (id: string, data: Partial<العقارات_tbl>): DbResult<العقارات_tbl> => {
  const all = get<العقارات_tbl>(KEYS.PROPERTIES);
  const idx = all.findIndex((p) => p.رقم_العقار === id);
  if (idx > -1) {
    const patch: Partial<العقارات_tbl> = { ...data };
    if (patch.حالة_العقار && patch.IsRented === undefined) {
      patch.IsRented = patch.حالة_العقار === 'مؤجر';
    }
    all[idx] = { ...all[idx], ...patch };
    save(KEYS.PROPERTIES, all);
    return ok(all[idx]);
  }
  return fail('العقار غير موجود');
};

export const deleteProperty = (id: string): DbResult<null> => {
  const contracts = get<العقود_tbl>(KEYS.CONTRACTS).filter(
    (c) => c.رقم_العقار === id && !c.isArchived && c.حالة_العقد !== 'منتهي'
  );
  if (contracts.length > 0) return fail('لا يمكن حذف العقار لوجود عقود سارية');
  const all = get<العقارات_tbl>(KEYS.PROPERTIES).filter((p) => p.رقم_العقار !== id);
  save(KEYS.PROPERTIES, all);
  return ok();
};

export const getPropertyDetails = (id: string): PropertyDetailsResult | null => {
  const p = get<العقارات_tbl>(KEYS.PROPERTIES).find((x) => x.رقم_العقار === id);
  if (!p) return null;
  const owner = get<الأشخاص_tbl>(KEYS.PEOPLE).find((x) => x.رقم_الشخص === p.رقم_المالك);
  const contracts = get<العقود_tbl>(KEYS.CONTRACTS)
    .filter((c) => c.رقم_العقار === id)
    .sort((a, b) => b.تاريخ_النهاية.localeCompare(a.تاريخ_النهاية));
  const activeContract = pickBestTenancyContract(contracts);
  const currentTenant = activeContract
    ? get<الأشخاص_tbl>(KEYS.PEOPLE).find((x) => x.رقم_الشخص === activeContract.رقم_المستاجر)
    : null;
  const currentGuarantor = activeContract?.رقم_الكفيل
    ? get<الأشخاص_tbl>(KEYS.PEOPLE).find((x) => x.رقم_الشخص === activeContract.رقم_الكفيل)
    : null;

  return {
    property: p,
    owner,
    currentTenant,
    currentGuarantor,
    currentContract: activeContract,
    history: contracts.filter((c) => c !== activeContract),
  };
};
