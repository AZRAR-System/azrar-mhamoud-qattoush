import { get, save } from '../kv';
import { KEYS } from '../keys';
import { 
  اتفاقيات_البيع_tbl, 
  عروض_البيع_tbl, 
  عروض_الشراء_tbl, 
  سجل_الملكية_tbl, 
  العقارات_tbl, 
  العقود_tbl, 
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
};

/**
 * Sales Agreements and Ownership History service
 */

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

export function createSalesHandlers(deps: SalesDeps) {
  const { logOperation, getPersonRoles, updatePersonRoles, terminateContract } = deps;

  const finalizeOwnershipTransfer = (id: string, txId: string): DbResult<null> => {
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
    all[idx].transactionId = txId;
    all[idx].transferDate = transferDate;
    save(KEYS.SALES_AGREEMENTS, all);

    listings[listingIdx].الحالة = 'Sold';
    save(KEYS.SALES_LISTINGS, listings);

    props[pIdx].رقم_المالك = newOwnerId;
    props[pIdx].isForSale = false;
    props[pIdx].salePrice = all[idx].السعر_النهائي;
    props[pIdx].حالة_العقار = 'شاغر';
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
      رقم_المعاملة: txId,
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

  return { finalizeOwnershipTransfer };
}
