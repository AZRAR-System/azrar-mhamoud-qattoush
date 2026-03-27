/**
 * Sales domain: listings, purchase offers, agreements (pre-finalize).
 * finalizeOwnershipTransfer stays in mockDb (attachments, people, properties, history).
 */

import type { DbResult } from '@/types';
import {
  اتفاقيات_البيع_tbl,
  العقارات_tbl,
  العمولات_الخارجية_tbl,
  عروض_البيع_tbl,
  عروض_الشراء_tbl,
} from '@/types';
import { dbFail, dbOk } from '@/services/localDbStorage';
import { get, save } from './kv';
import { KEYS } from './keys';

const ok = dbOk;
const fail = dbFail;

export const getSalesListings = () => get<عروض_البيع_tbl>(KEYS.SALES_LISTINGS);

export const createSalesListing = (data: Partial<عروض_البيع_tbl>): DbResult<{ id: string }> => {
  if (!data.رقم_العقار) return fail('يرجى اختيار العقار');
  if (!data.رقم_المالك) return fail('يرجى تحديد المالك');

  const asking = Number(data.السعر_المطلوب || 0);
  const min = Number(data.أقل_سعر_مقبول || 0);
  if (!asking || asking <= 0) return fail('يرجى إدخال السعر المطلوب (إجباري)');
  if (min < 0) return fail('أقل سعر مقبول غير صحيح');

  const all = get<عروض_البيع_tbl>(KEYS.SALES_LISTINGS);
  const existingIdx = all.findIndex(
    (l) => l.رقم_العقار === data.رقم_العقار && l.الحالة !== 'Sold' && l.الحالة !== 'Cancelled'
  );

  if (existingIdx > -1) {
    const existing = all[existingIdx];
    const next: عروض_البيع_tbl = {
      ...existing,
      رقم_المالك: data.رقم_المالك ?? existing.رقم_المالك,
      السعر_المطلوب: asking,
      أقل_سعر_مقبول: min,
    };
    const updated = [...all];
    updated[existingIdx] = next;
    save(KEYS.SALES_LISTINGS, updated);

    const props = get<العقارات_tbl>(KEYS.PROPERTIES);
    const pIdx = props.findIndex((p) => p.رقم_العقار === data.رقم_العقار);
    if (pIdx > -1) {
      props[pIdx].isForSale = true;
      props[pIdx].salePrice = asking;
      props[pIdx].minSalePrice = min;
      save(KEYS.PROPERTIES, props);
    }

    return ok({ id: existing.id }, 'تم تحديث عرض البيع الحالي');
  }

  const id = `LST-${Date.now()}`;
  const today = new Date().toISOString().split('T')[0];
  const record: عروض_البيع_tbl = {
    id,
    رقم_العقار: data.رقم_العقار,
    رقم_المالك: data.رقم_المالك,
    السعر_المطلوب: asking,
    أقل_سعر_مقبول: min,
    الحالة: data.الحالة || 'Active',
    تاريخ_العرض: data.تاريخ_العرض || today,
    نوع_البيع: data.نوع_البيع || 'Cash',
  };
  save(KEYS.SALES_LISTINGS, [...all, record]);

  const props = get<العقارات_tbl>(KEYS.PROPERTIES);
  const pIdx = props.findIndex((p) => p.رقم_العقار === data.رقم_العقار);
  if (pIdx > -1) {
    props[pIdx].isForSale = true;
    props[pIdx].salePrice = asking;
    props[pIdx].minSalePrice = min;
    save(KEYS.PROPERTIES, props);
  }
  return ok({ id });
};

export const cancelOpenSalesListingsForProperty = (
  propertyId: string
): DbResult<{ cancelled: number }> => {
  if (!propertyId) return fail('رقم العقار غير موجود');
  const all = get<عروض_البيع_tbl>(KEYS.SALES_LISTINGS);
  let cancelled = 0;
  const next = all.map((l) => {
    if (l.رقم_العقار !== propertyId) return l;
    if (l.الحالة === 'Sold' || l.الحالة === 'Cancelled') return l;
    cancelled++;
    return { ...l, الحالة: 'Cancelled' };
  });
  if (cancelled > 0) save(KEYS.SALES_LISTINGS, next);

  try {
    const props = get<العقارات_tbl>(KEYS.PROPERTIES);
    const pIdx = props.findIndex((p) => p.رقم_العقار === propertyId);
    if (pIdx > -1) {
      props[pIdx].isForSale = false;
      save(KEYS.PROPERTIES, props);
    }
  } catch {
    /* ignore */
  }

  return ok({ cancelled }, cancelled > 0 ? 'تم إلغاء عرض البيع' : 'لا يوجد عرض بيع مفتوح');
};

export const getSalesOffers = (listingId?: string) => {
  const all = get<عروض_الشراء_tbl>(KEYS.SALES_OFFERS);
  return listingId ? all.filter((o) => o.listingId === listingId) : all;
};

export const submitSalesOffer = (data: Partial<عروض_الشراء_tbl>): DbResult<null> => {
  if (!data.listingId) return fail('رقم عرض البيع غير موجود');
  if (!data.رقم_المشتري) return fail('يرجى اختيار المشتري');
  if (!data.قيمة_العرض || Number(data.قيمة_العرض) <= 0) return fail('قيمة العرض غير صحيحة');

  const listings = get<عروض_البيع_tbl>(KEYS.SALES_LISTINGS);
  const listing = listings.find((l) => l.id === data.listingId);
  if (!listing) return fail('عرض البيع غير موجود');
  if (listing.الحالة !== 'Active') return fail('لا يمكن تقديم عروض لهذا العرض لأنه غير نشط');

  const agreements = get<اتفاقيات_البيع_tbl>(KEYS.SALES_AGREEMENTS);
  const existingAgreement = agreements.find((a) => a.listingId === listing.id && !a.isCompleted);
  if (existingAgreement) return fail('لا يمكن تقديم عروض: توجد اتفاقية قيد الإجراء لهذا العرض');

  const all = get<عروض_الشراء_tbl>(KEYS.SALES_OFFERS);
  const newOffer = {
    ...data,
    id: `OFF-${Date.now()}`,
    الحالة: 'Pending',
    تاريخ_العرض: new Date().toISOString(),
  } as عروض_الشراء_tbl;
  save(KEYS.SALES_OFFERS, [...all, newOffer]);
  return ok();
};

export const updateOfferStatus = (id: string, status: string): DbResult<null> => {
  const all = get<عروض_الشراء_tbl>(KEYS.SALES_OFFERS);
  const idx = all.findIndex((o) => o.id === id);
  if (idx > -1) {
    const offer = all[idx];
    const listings = get<عروض_البيع_tbl>(KEYS.SALES_LISTINGS);
    const listing = listings.find((l) => l.id === offer.listingId);
    if (!listing) return fail('عرض البيع غير موجود');
    if (listing.الحالة === 'Sold' || listing.الحالة === 'Cancelled')
      return fail('لا يمكن تعديل حالة العرض بعد إغلاقه');

    if (status === 'Accepted') {
      offer.الحالة = 'Accepted';
      for (let i = 0; i < all.length; i++) {
        if (
          all[i].listingId === offer.listingId &&
          all[i].id !== offer.id &&
          all[i].الحالة === 'Pending'
        ) {
          all[i].الحالة = 'Rejected';
        }
      }
      const lIdx = listings.findIndex((l) => l.id === offer.listingId);
      if (lIdx > -1 && listings[lIdx].الحالة === 'Active') {
        listings[lIdx].الحالة = 'Pending';
        save(KEYS.SALES_LISTINGS, listings);
      }
    } else {
      offer.الحالة = status as عروض_الشراء_tbl['الحالة'];
    }

    save(KEYS.SALES_OFFERS, all);
    return ok(null);
  }
  return fail('Not found');
};

export const getSalesAgreements = () => get<اتفاقيات_البيع_tbl>(KEYS.SALES_AGREEMENTS);

export const updateSalesAgreement = (
  id: string,
  patch: Partial<اتفاقيات_البيع_tbl>,
  commissions?: {
    buyer?: number;
    seller?: number;
    external?: number;
    expenses?: اتفاقيات_البيع_tbl['مصاريف_البيع'];
  }
): DbResult<null> => {
  const all = get<اتفاقيات_البيع_tbl>(KEYS.SALES_AGREEMENTS);
  const idx = all.findIndex((a) => a.id === id);
  if (idx === -1) return fail('الاتفاقية غير موجودة');
  if (all[idx].isCompleted) return fail('لا يمكن تعديل اتفاقية مكتملة');

  const current = all[idx];

  const expense = commissions?.expenses ?? patch.مصاريف_البيع ?? current.مصاريف_البيع;

  const feesTotal = expense
    ? Number(expense.رسوم_التنازل || 0) +
      Number(expense.ضريبة_الابنية || 0) +
      Number(expense.نقل_اشتراك_الكهرباء || 0) +
      Number(expense.نقل_اشتراك_المياه || 0) +
      Number(expense.قيمة_التأمينات || 0)
    : 0;

  const commBuyer = Number(commissions?.buyer ?? patch.عمولة_المشتري ?? current.عمولة_المشتري ?? 0);
  const commSeller = Number(commissions?.seller ?? patch.عمولة_البائع ?? current.عمولة_البائع ?? 0);
  const commExternal = Number(
    commissions?.external ?? patch.عمولة_وسيط_خارجي ?? current.عمولة_وسيط_خارجي ?? 0
  );
  const commTotal = commBuyer + commSeller + commExternal;

  const downPayment = patch.قيمة_الدفعة_الاولى ?? current.قيمة_الدفعة_الاولى;
  const remaining = Number(current.السعر_النهائي) - Number(downPayment || 0);

  const next: اتفاقيات_البيع_tbl = {
    ...current,
    ...patch,
    مصاريف_البيع: expense,
    إجمالي_المصاريف: feesTotal,
    عمولة_المشتري: commBuyer,
    عمولة_البائع: commSeller,
    عمولة_وسيط_خارجي: commExternal,
    إجمالي_العمولات: commTotal,
    قيمة_المتبقي: remaining,
    العمولة_الإجمالية: Number(
      patch.العمولة_الإجمالية ?? current.العمولة_الإجمالية ?? commBuyer + commSeller
    ),
  };

  all[idx] = next;
  save(KEYS.SALES_AGREEMENTS, all);

  const extId = `EXT-${id}`;
  const exts = get<العمولات_الخارجية_tbl>(KEYS.EXTERNAL_COMMISSIONS);
  const extIdx = exts.findIndex((e) => e.id === extId);
  if (commExternal > 0) {
    const record: العمولات_الخارجية_tbl = {
      id: extId,
      العنوان: `وساطة بيع ${current.listingId}`,
      النوع: 'وساطة',
      التاريخ: new Date().toISOString().split('T')[0],
      القيمة: commExternal,
    };
    if (extIdx > -1) {
      exts[extIdx] = { ...exts[extIdx], ...record };
    } else {
      exts.push(record);
    }
  } else if (extIdx > -1) {
    exts.splice(extIdx, 1);
  }
  save(KEYS.EXTERNAL_COMMISSIONS, exts);

  return ok(null);
};

export const deleteSalesAgreement = (id: string): DbResult<null> => {
  const all = get<اتفاقيات_البيع_tbl>(KEYS.SALES_AGREEMENTS);
  const idx = all.findIndex((a) => a.id === id);
  if (idx === -1) return fail('الاتفاقية غير موجودة');
  const current = all[idx];
  if (current.isCompleted) return fail('لا يمكن حذف اتفاقية مكتملة بعد نقل الملكية');

  all.splice(idx, 1);
  save(KEYS.SALES_AGREEMENTS, all);

  const extId = `EXT-${id}`;
  const exts = get<العمولات_الخارجية_tbl>(KEYS.EXTERNAL_COMMISSIONS);
  const extIdx = exts.findIndex((e) => e.id === extId);
  if (extIdx > -1) {
    exts.splice(extIdx, 1);
    save(KEYS.EXTERNAL_COMMISSIONS, exts);
  }

  if (current.listingId) {
    const offers = get<عروض_الشراء_tbl>(KEYS.SALES_OFFERS);
    const filteredOffers = offers.filter((o) => o.listingId !== current.listingId);
    if (filteredOffers.length !== offers.length) {
      save(KEYS.SALES_OFFERS, filteredOffers);
    }
  }

  const hasOtherActive = all.some((a) => a.listingId === current.listingId && !a.isCompleted);
  if (!hasOtherActive) {
    const listings = get<عروض_البيع_tbl>(KEYS.SALES_LISTINGS);
    const lIdx = listings.findIndex((l) => l.id === current.listingId);
    if (lIdx > -1 && listings[lIdx].الحالة === 'Pending') {
      listings[lIdx].الحالة = 'Active';
      save(KEYS.SALES_LISTINGS, listings);
    }
  }

  return ok();
};

export const createSalesAgreement = (
  data: Partial<اتفاقيات_البيع_tbl>,
  listing: عروض_البيع_tbl,
  commissions: {
    buyer?: number;
    seller?: number;
    external?: number;
    expenses?: اتفاقيات_البيع_tbl['مصاريف_البيع'];
  }
): DbResult<{ id: string }> => {
  const id = `AGR-${Date.now()}`;
  const all = get<اتفاقيات_البيع_tbl>(KEYS.SALES_AGREEMENTS);
  const existing = all.find((a) => a.listingId === data.listingId && !a.isCompleted);
  if (existing) return fail('توجد اتفاقية قيد الإجراء لهذا العرض بالفعل');

  if (!data.listingId) return fail('رقم عرض البيع غير موجود');
  if (!data.رقم_المشتري) return fail('يرجى تحديد المشتري');

  const listings = get<عروض_البيع_tbl>(KEYS.SALES_LISTINGS);
  const lIdx = listings.findIndex((l) => l.id === data.listingId);
  if (lIdx > -1 && listings[lIdx].الحالة === 'Active') {
    listings[lIdx].الحالة = 'Pending';
    save(KEYS.SALES_LISTINGS, listings);
  }

  const expense = commissions?.expenses;
  const feesTotal = expense
    ? Number(expense.رسوم_التنازل || 0) +
      Number(expense.ضريبة_الابنية || 0) +
      Number(expense.نقل_اشتراك_الكهرباء || 0) +
      Number(expense.نقل_اشتراك_المياه || 0) +
      Number(expense.قيمة_التأمينات || 0)
    : 0;
  const commBuyer = Number(commissions?.buyer || 0);
  const commSeller = Number(commissions?.seller || 0);
  const commExternal = Number(commissions?.external || 0);
  const commTotal = commBuyer + commSeller + commExternal;

  const today = new Date().toISOString().split('T')[0];
  const record: اتفاقيات_البيع_tbl = {
    id,
    listingId: data.listingId,
    رقم_المشتري: data.رقم_المشتري,
    رقم_الفرصة: data.رقم_الفرصة,
    يوجد_ادخال_عقار: data.يوجد_ادخال_عقار,
    اسم_المستخدم: data.اسم_المستخدم,
    تاريخ_الاتفاقية: String(data.تاريخ_الاتفاقية || today),
    السعر_النهائي: Number(data.السعر_النهائي || 0),
    العمولة_الإجمالية: Number(data.العمولة_الإجمالية || commBuyer + commSeller),
    قيمة_الدفعة_الاولى: data.قيمة_الدفعة_الاولى,
    قيمة_المتبقي: data.قيمة_المتبقي,
    طريقة_الدفع: data.طريقة_الدفع || 'Cash',
    isCompleted: false,
    رقم_العقار: listing?.رقم_العقار,
    رقم_البائع: listing?.رقم_المالك,
    عمولة_المشتري: commBuyer,
    عمولة_البائع: commSeller,
    عمولة_وسيط_خارجي: commExternal,
    مصاريف_البيع: expense,
    إجمالي_المصاريف: feesTotal,
    إجمالي_العمولات: commTotal,
  };

  save(KEYS.SALES_AGREEMENTS, [...all, record]);
  if ((commissions?.external || 0) > 0) {
    const exts = get<العمولات_الخارجية_tbl>(KEYS.EXTERNAL_COMMISSIONS);
    save(KEYS.EXTERNAL_COMMISSIONS, [
      ...exts,
      {
        id: `EXT-${id}`,
        العنوان: `وساطة بيع ${listing.id}`,
        النوع: 'وساطة',
        التاريخ: new Date().toISOString().split('T')[0],
        القيمة: Number(commissions.external || 0),
      },
    ]);
  }
  return ok({ id });
};
