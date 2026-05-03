import { get, save } from '../kv';
import { KEYS } from '../keys';
import { 
  اتفاقيات_البيع_tbl, 
  عروض_البيع_tbl, 
  عروض_الشراء_tbl, 
  سجل_الملكية_tbl, 
  العقارات_tbl, 
  العقود_tbl, 
  العمولات_tbl,
  Attachment, 
  DbResult 
} from '@/types';
import { dbFail, dbOk } from '@/services/localDbStorage';
import { isTenancyRelevant } from '@/utils/tenancy';
import { DbCache } from '../../dbCache';

const ok = dbOk;
const fail = dbFail;

export type SalesDeps = {
  logOperation: (user: string, action: string, table: string, id: string, msg: string) => void;
  getPersonRoles: (personId: string) => string[];
  updatePersonRoles: (personId: string, roles: string[]) => void;
  terminateContract: (contractId: string, reason: string, date: string) => DbResult<null>;
  upsertCommissionForSale: (
    agreementId: string,
    data: {
      sellerComm: number;
      buyerComm: number;
      listingComm?: number;
      propertyIntroEnabled?: boolean;
      listingEmployee?: string;
      closingEmployee?: string;
      date?: string;
    }
  ) => DbResult<العمولات_tbl>;
};

/**
 * Sales Agreements and Ownership History service
 */

export const getSalesListings = (): عروض_البيع_tbl[] => get<عروض_البيع_tbl>(KEYS.SALES_LISTINGS);
export const getSalesOffers = (listingId?: string): عروض_الشراء_tbl[] => {
  const all = get<عروض_الشراء_tbl>(KEYS.SALES_OFFERS);
  if (listingId) return all.filter(o => o.listingId === listingId);
  return all;
};
export const getSalesAgreements = (): اتفاقيات_البيع_tbl[] => get<اتفاقيات_البيع_tbl>(KEYS.SALES_AGREEMENTS);

export const getOwnershipHistory = (propertyId?: string, personId?: string): سجل_الملكية_tbl[] => {
  if (DbCache.isInitialized) {
    if (propertyId) return DbCache.ownershipHistoryByPropertyId.get(propertyId) || [];
    if (personId) return DbCache.ownershipHistoryByPersonId.get(personId) || [];
  }
  const all = get<سجل_الملكية_tbl>(KEYS.OWNERSHIP_HISTORY);
  if (propertyId) return all.filter((x) => x.رقم_العقار === propertyId);
  if (personId) return all.filter((x) => x.رقم_المالك_القديم === personId || x.رقم_المالك_الجديد === personId);
  return all;
};

export const addSalesOfferNote = (offerId: string, note: string): DbResult<null> => {
  const clean = (note || '').trim();
  if (!clean) return fail('يرجى كتابة ملاحظة');
  const all = get<عروض_الشراء_tbl>(KEYS.SALES_OFFERS);
  const idx = all.findIndex((o) => o.id === offerId);
  if (idx === -1) return fail('العرض غير موجود');

  const stamp = new Date().toISOString().replace('T', ' ').substring(0, 16);
  const prev = (all[idx].ملاحظات_التفاوض || '').trim();
  const line = `• ${stamp}: ${clean}`;
  all[idx].ملاحظات_التفاوض = prev ? `${prev}\n${line}` : line;
  save(KEYS.SALES_OFFERS, all);
  return ok();
};

export const addSalesListing = (listing: Partial<عروض_البيع_tbl>): DbResult<عروض_البيع_tbl> => {
  if (!listing.رقم_العقار) return fail('رقم العقار مطلوب');
  const props = get<العقارات_tbl>(KEYS.PROPERTIES);
  const prop = props.find(p => p.رقم_العقار === listing.رقم_العقار);
  if (!prop) return fail('العقار غير موجود');

  const all = get<عروض_البيع_tbl>(KEYS.SALES_LISTINGS);
  const next: عروض_البيع_tbl = {
    id: `LST-${Date.now()}`,
    رقم_العقار: listing.رقم_العقار,
    رقم_المالك: prop.رقم_المالك,
    السعر_المطلوب: listing.السعر_المطلوب || 0,
    الحالة: 'Active',
    تاريخ_العرض: new Date().toISOString().split('T')[0],
    نوع_البيع: listing.نوع_البيع || 'Cash',
    ملاحظات: listing.ملاحظات,
    متاح_للإيجار_أيضا: listing.متاح_للإيجار_أيضا ?? false
  };
  
  all.push(next);
  save(KEYS.SALES_LISTINGS, all);

  // Update property status
  prop.isForSale = true;
  prop.salePrice = next.السعر_المطلوب;
  save(KEYS.PROPERTIES, props);

  return ok(next, 'تم إضافة عرض البيع بنجاح');
};

export const deleteSalesListing = (id: string): DbResult<null> => {
  const all = get<عروض_البيع_tbl>(KEYS.SALES_LISTINGS);
  const idx = all.findIndex(l => l.id === id);
  if (idx === -1) return fail('العرض غير موجود');

  const deleted = all.splice(idx, 1)[0];
  save(KEYS.SALES_LISTINGS, all);

  // Revert property status if no other active listings for this property
  const stillHas = all.some(l => l.رقم_العقار === deleted.رقم_العقار && l.الحالة === 'Active');
  if (!stillHas) {
    const props = get<العقارات_tbl>(KEYS.PROPERTIES);
    const pIdx = props.findIndex(p => p.رقم_العقار === deleted.رقم_العقار);
    if (pIdx !== -1) {
      props[pIdx].isForSale = false;
      save(KEYS.PROPERTIES, props);
    }
  }

  return ok(null, 'تم حذف عرض البيع بنجاح');
};

export const updateSalesListing = (id: string, updates: Partial<عروض_البيع_tbl>): DbResult<null> => {
  const all = get<عروض_البيع_tbl>(KEYS.SALES_LISTINGS);
  const idx = all.findIndex(l => l.id === id);
  if (idx === -1) return fail('العرض غير موجود');

  all[idx] = { ...all[idx], ...updates };
  save(KEYS.SALES_LISTINGS, all);

  // Update property price if changed
  if (updates.السعر_المطلوب) {
    const props = get<العقارات_tbl>(KEYS.PROPERTIES);
    const pIdx = props.findIndex(p => p.رقم_العقار === all[idx].رقم_العقار);
    if (pIdx !== -1) {
      props[pIdx].salePrice = updates.السعر_المطلوب;
      save(KEYS.PROPERTIES, props);
    }
  }

  return ok(null, 'تم تحديث عرض البيع بنجاح');
};

export const submitSalesOffer = (offer: Partial<عروض_الشراء_tbl>): DbResult<عروض_الشراء_tbl> => {
  if (!offer.listingId) return fail('رقم عرض البيع مطلوب');
  if (!offer.رقم_المشتري) return fail('رقم المشتري مطلوب');

  const all = get<عروض_الشراء_tbl>(KEYS.SALES_OFFERS);
  const next: عروض_الشراء_tbl = {
    id: `OFF-${Date.now()}`,
    listingId: offer.listingId,
    رقم_المشتري: offer.رقم_المشتري,
    قيمة_العرض: offer.قيمة_العرض || 0,
    تاريخ_العرض: new Date().toISOString().split('T')[0],
    الحالة: 'Pending',
    ملاحظات: offer.ملاحظات
  };

  all.push(next);
  save(KEYS.SALES_OFFERS, all);
  return ok(next, 'تم إضافة عرض الشراء بنجاح');
};

export const updateOfferStatus = (id: string, status: 'Accepted' | 'Rejected'): DbResult<null> => {
  const all = get<عروض_الشراء_tbl>(KEYS.SALES_OFFERS);
  const idx = all.findIndex(o => o.id === id);
  if (idx === -1) return fail('العرض غير موجود');

  all[idx].الحالة = status;
  save(KEYS.SALES_OFFERS, all);
  return ok(null, 'تم تحديث حالة العرض');
};

export const deleteSalesOffer = (id: string): DbResult<null> => {
  const all = get<عروض_الشراء_tbl>(KEYS.SALES_OFFERS);
  const idx = all.findIndex(o => o.id === id);
  if (idx === -1) return fail('العرض غير موجود');

  all.splice(idx, 1);
  save(KEYS.SALES_OFFERS, all);
  return ok(null, 'تم حذف عرض الشراء بنجاح');
};



export function createSalesHandlers(deps: SalesDeps) {
  const { 
    logOperation, 
    getPersonRoles, 
    updatePersonRoles, 
    terminateContract,
    upsertCommissionForSale
  } = deps;

  const addSalesAgreement = (agreement: Partial<اتفاقيات_البيع_tbl>): DbResult<اتفاقيات_البيع_tbl> => {
    if (!agreement.listingId) return fail('رقم عرض البيع مطلوب');
    if (!agreement.رقم_المشتري) return fail('رقم المشتري مطلوب');

    const all = get<اتفاقيات_البيع_tbl>(KEYS.SALES_AGREEMENTS);
    const dup = all.find((a) => a.listingId === agreement.listingId && !a.isCompleted);
    if (dup) return fail('توجد اتفاقية قيد الإجراء لهذا العرض بالفعل — أكملها أو عدّلها قبل إنشاء اتفاقية جديدة.');

    const listings = get<عروض_البيع_tbl>(KEYS.SALES_LISTINGS);
    const lIdx = listings.findIndex((l) => l.id === agreement.listingId);
    if (lIdx !== -1 && listings[lIdx].الحالة === 'Active') {
      listings[lIdx].الحالة = 'Pending';
      save(KEYS.SALES_LISTINGS, listings);
    }

    const next: اتفاقيات_البيع_tbl = {
      id: `AGR-${Date.now()}`,
      listingId: agreement.listingId,
      رقم_المشتري: agreement.رقم_المشتري,
      رقم_العقار: agreement.رقم_العقار,
      رقم_البائع: agreement.رقم_البائع,
      رقم_الفرصة: agreement.رقم_الفرصة,
      يوجد_ادخال_عقار: agreement.يوجد_ادخال_عقار,
      اسم_المستخدم: agreement.اسم_المستخدم,
      السعر_النهائي: agreement.السعر_النهائي || 0,
      عمولة_البائع: agreement.عمولة_البائع || 0,
      عمولة_المشتري: agreement.عمولة_المشتري || 0,
      العمولة_الإجمالية: agreement.العمولة_الإجمالية || 0,
      عمولة_إدخال_عقار: agreement.عمولة_إدخال_عقار || 0,
      موظف_إدخال_العقار: agreement.موظف_إدخال_العقار,
      تاريخ_الاتفاقية: agreement.تاريخ_الاتفاقية || new Date().toISOString().split('T')[0],
      طريقة_الدفع: agreement.طريقة_الدفع || 'Cash',
      isCompleted: false,
      ملاحظات: agreement.ملاحظات,
      transferDate: agreement.transferDate,
    };

    all.push(next);
    save(KEYS.SALES_AGREEMENTS, all);

    // Sync to Financial module
    upsertCommissionForSale(next.id, {
      sellerComm: next.عمولة_البائع,
      buyerComm: next.عمولة_المشتري,
      listingComm: next.عمولة_إدخال_عقار,
      propertyIntroEnabled: !!(next.يوجد_ادخال_عقار || (next.عمولة_إدخال_عقار || 0) > 0),
      listingEmployee: next.موظف_إدخال_العقار,
      closingEmployee: 'system',
      date: next.تاريخ_الاتفاقية,
    });

    logOperation('system', 'ADD_AGREEMENT', 'sales_agreements', next.id, `إنشاء اتفاقية بيع لعقار ${next.رقم_العقار}`);
  
    return ok(next, 'تم إنشاء الاتفاقية بنجاح');
  };

  const updateSalesAgreement = (id: string, updates: Partial<اتفاقيات_البيع_tbl>): DbResult<null> => {
    const all = get<اتفاقيات_البيع_tbl>(KEYS.SALES_AGREEMENTS);
    const idx = all.findIndex((a) => a.id === id);
    if (idx === -1) return fail('الاتفاقية غير موجودة');
    if (all[idx].isCompleted) return fail('لا يمكن تعديل اتفاقية بعد إتمام نقل الملكية');

    const prev = all[idx];
    all[idx] = { ...prev, ...updates };
    save(KEYS.SALES_AGREEMENTS, all);

    // Sync to Financial module
    upsertCommissionForSale(id, {
      sellerComm: all[idx].عمولة_البائع,
      buyerComm: all[idx].عمولة_المشتري,
      listingComm: all[idx].عمولة_إدخال_عقار,
      propertyIntroEnabled: !!(all[idx].يوجد_ادخال_عقار || (all[idx].عمولة_إدخال_عقار || 0) > 0),
      listingEmployee: all[idx].موظف_إدخال_العقار,
      date: all[idx].تاريخ_الاتفاقية,
    });

    logOperation('system', 'UPDATE_AGREEMENT', 'sales_agreements', id, `تحديث اتفاقية بيع لعقار ${all[idx].رقم_العقار}`);
    return ok(null, 'تم تحديث الاتفاقية بنجاح');
  };

  const finalizeOwnershipTransfer = (id: string, data: { transactionId: string, expenses?: number, targetStatus?: string }): DbResult<null> => {
    const { transactionId, expenses, targetStatus } = data;
    const all = get<اتفاقيات_البيع_tbl>(KEYS.SALES_AGREEMENTS);
    const idx = all.findIndex((a) => a.id === id);
    if (idx === -1) return fail('Agreement not found');
    if (all[idx].isCompleted) return fail('تم إتمام نقل الملكية مسبقاً');

    const listings = get<عروض_البيع_tbl>(KEYS.SALES_LISTINGS);
    const listingIdx = listings.findIndex((l) => l.id === all[idx].listingId);
    if (listingIdx === -1) return fail('عرض البيع غير موجود');
    const listing = listings[listingIdx];

    const oldOwnerId = listing.رقم_المالك;
    const newOwnerId = all[idx].رقم_المشتري;

    // Attachments check
    try {
      const attachments = get<Attachment>(KEYS.ATTACHMENTS);
      const propHasAny = attachments.some(a => a.referenceType === 'Property' && a.referenceId === listing.رقم_العقار);
      const buyerHasAny = attachments.some(a => a.referenceType === 'Person' && a.referenceId === newOwnerId);
      if (!propHasAny || !buyerHasAny) {
        return fail('لا يمكن إتمام النقل: يجب رفع مستندات البيع/نقل الملكية ضمن مرفقات العقار ومرفقات المشتري');
      }
    } catch { return fail('لا يمكن إتمام النقل: تحقق من مرفقات العقار/المشتري'); }

    // Property check
    const props = get<العقارات_tbl>(KEYS.PROPERTIES);
    const pIdx = props.findIndex((p) => p.رقم_العقار === listing.رقم_العقار);
    if (pIdx === -1) return fail('العقار غير موجود');
    if (props[pIdx].رقم_المالك !== oldOwnerId) return fail('مالك العقار الحالي لا يطابق مالك عرض البيع');

    const transferDate = new Date().toISOString().split('T')[0];

    // Terminate active rentals
    const contracts = get<العقود_tbl>(KEYS.CONTRACTS);
    const activeContracts = contracts.filter(c => c.رقم_العقار === listing.رقم_العقار && isTenancyRelevant(c));
    for (const c of activeContracts) {
      const res = terminateContract(c.رقم_العقد, 'تم بيع العقار - نقل ملكية', transferDate);
      if (!res.success) return fail(`تعذر إتمام نقل الملكية: ${res.message}`);
    }

    // Update state
    all[idx].isCompleted = true;
    all[idx].transactionId = transactionId;
    all[idx].transferDate = transferDate;
    if (expenses !== undefined) all[idx].إجمالي_المصاريف = expenses;
    save(KEYS.SALES_AGREEMENTS, all);

    listings[listingIdx].الحالة = 'Sold';
    save(KEYS.SALES_LISTINGS, listings);

    props[pIdx].رقم_المالك = newOwnerId;
    props[pIdx].isForSale = false;
    props[pIdx].salePrice = all[idx].السعر_النهائي;
    props[pIdx].حالة_العقار = targetStatus || 'شاغر';
    props[pIdx].IsRented = false;
    save(KEYS.PROPERTIES, props);

    // History
    const hist = get<سجل_الملكية_tbl>(KEYS.OWNERSHIP_HISTORY);
    hist.push({
      id: `OWN-${Date.now()}`,
      رقم_العقار: listing.رقم_العقار,
      رقم_المالك_القديم: oldOwnerId,
      رقم_المالك_الجديد: newOwnerId,
      تاريخ_نقل_الملكية: transferDate,
      رقم_المعاملة: transactionId,
      agreementId: id,
      listingId: listing.id,
      السعر_النهائي: all[idx].السعر_النهائي,
    });
    save(KEYS.OWNERSHIP_HISTORY, hist);

    logOperation('system', 'OWNERSHIP_TRANSFER', 'sales_agreements', id, `نقل ملكية عقار ${listing.رقم_العقار}`);

    // Roles update
    const buyerRoles = getPersonRoles(newOwnerId);
    if (!buyerRoles.includes('مالك')) updatePersonRoles(newOwnerId, Array.from(new Set([...buyerRoles, 'مالك'])));

    const stillOwns = get<العقارات_tbl>(KEYS.PROPERTIES).some(p => p.رقم_المالك === oldOwnerId);
    if (!stillOwns) {
      const sellerRoles = getPersonRoles(oldOwnerId);
      if (sellerRoles.includes('مالك')) updatePersonRoles(oldOwnerId, sellerRoles.filter(r => r !== 'مالك'));
    }

    // Offers cleanup
    const offers = get<عروض_الشراء_tbl>(KEYS.SALES_OFFERS);
    let offersChanged = false;
    for (const o of offers) {
      if (o.listingId === listing.id && o.الحالة === 'Pending') {
        o.الحالة = 'Rejected';
        offersChanged = true;
      }
    }
    if (offersChanged) save(KEYS.SALES_OFFERS, offers);

    return ok(null, 'تم نقل الملكية بنجاح');
  };

  return { addSalesAgreement, updateSalesAgreement, finalizeOwnershipTransfer };
}
