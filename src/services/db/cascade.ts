/**
 * Cascade deletes across domains. Built via factory so logging stays in mockDb (no circular imports).
 */

import type { DbResult } from '@/types';
import {
  الأشخاص_tbl,
  العقارات_tbl,
  العقود_tbl,
  الكمبيالات_tbl,
  العمولات_tbl,
  العمولات_الخارجية_tbl,
  BlacklistRecord,
  ClearanceRecord,
  ClientInteraction,
  LegalNoticeRecord,
  PropertyInspection,
  شخص_دور_tbl,
  اتفاقيات_البيع_tbl,
  عروض_البيع_tbl,
  عروض_الشراء_tbl,
  سجل_الملكية_tbl,
  تذاكر_الصيانة_tbl,
  المستخدمين_tbl,
  مستخدم_صلاحية_tbl,
} from '@/types';
import { dbOk } from '@/services/localDbStorage';
import { get, save } from './kv';
import { KEYS } from './keys';
import { purgeRefs } from './refs';

const ok = dbOk;

type UnknownRecord = Record<string, unknown>;
const asUnknownRecord = (value: unknown): UnknownRecord =>
  !!value && typeof value === 'object' && !Array.isArray(value)
    ? (value as UnknownRecord)
    : Object.create(null);

/** Matches mockDb NotificationSendLogRecord shape for cascade filters */
type NotificationSendLogRow = {
  contractId?: string;
  propertyId?: string;
  tenantId?: string;
};

export type CascadeLogOperation = (
  user: string,
  action: string,
  table: string,
  recordId: string,
  details: string,
  meta?: { ipAddress?: string; deviceInfo?: string }
) => void;

export function makeCascadeDeletes(logOperation: CascadeLogOperation) {
  const forceDeleteSalesAgreementInternal = (id: string): DbResult<null> => {
    const agreements = get<اتفاقيات_البيع_tbl>(KEYS.SALES_AGREEMENTS);
    const agreement = agreements.find((a) => a.id === id);
    if (!agreement) return ok();

    save(KEYS.SALES_AGREEMENTS, agreements.filter((a) => a.id !== id));

    const ext = get<العمولات_الخارجية_tbl>(KEYS.EXTERNAL_COMMISSIONS);
    if (ext.some((x) => x.id === `EXT-${id}`)) {
      save(
        KEYS.EXTERNAL_COMMISSIONS,
        ext.filter((x) => x.id !== `EXT-${id}`)
      );
    }

    const oh = get<سجل_الملكية_tbl>(KEYS.OWNERSHIP_HISTORY);
    if (oh.some((r) => r.agreementId === id)) {
      save(KEYS.OWNERSHIP_HISTORY, oh.filter((r) => r.agreementId !== id));
    }

    purgeRefs('Sales', id);

    if (agreement.listingId) {
      const offers = get<عروض_الشراء_tbl>(KEYS.SALES_OFFERS);
      const filteredOffers = offers.filter((o) => o.listingId !== agreement.listingId);
      if (filteredOffers.length !== offers.length) {
        save(KEYS.SALES_OFFERS, filteredOffers);
      }
    }

    if (agreement.listingId) {
      const listings = get<عروض_البيع_tbl>(KEYS.SALES_LISTINGS);
      const idx = listings.findIndex((l) => l.id === agreement.listingId);
      if (idx > -1) {
        const anyAg = get<اتفاقيات_البيع_tbl>(KEYS.SALES_AGREEMENTS).some(
          (a) => a.listingId === agreement.listingId && !a.isCompleted
        );
        if (!anyAg && listings[idx].الحالة !== 'Active') {
          const updated = [...listings];
          updated[idx] = { ...updated[idx], الحالة: 'Active' };
          save(KEYS.SALES_LISTINGS, updated);
        }
      }
    }

    return ok();
  };

  const deleteContractCascadeInternal = (id: string): DbResult<null> => {
    const all = get<العقود_tbl>(KEYS.CONTRACTS);
    const contract = all.find((c) => c.رقم_العقد === id);
    if (!contract) return ok();

    const filteredContracts = all.filter((c) => c.رقم_العقد !== id);
    for (const c of filteredContracts) {
      if (c.عقد_مرتبط === id) c.عقد_مرتبط = undefined;
      const legacyLinked = asUnknownRecord(c)['linkedContractId'];
      if (legacyLinked === id) asUnknownRecord(c)['linkedContractId'] = undefined;
    }
    save(KEYS.CONTRACTS, filteredContracts);

    const props = get<العقارات_tbl>(KEYS.PROPERTIES);
    const pIdx = props.findIndex((p) => p.رقم_العقار === contract.رقم_العقار);
    if (pIdx > -1) {
      const updated = [...props];
      const next = { ...updated[pIdx], حالة_العقار: 'شاغر' };
      asUnknownRecord(next)['IsRented'] = false;
      updated[pIdx] = next;
      save(KEYS.PROPERTIES, updated);
    }

    const inst = get<الكمبيالات_tbl>(KEYS.INSTALLMENTS).filter((i) => i.رقم_العقد !== id);
    save(KEYS.INSTALLMENTS, inst);

    const comm = get<العمولات_tbl>(KEYS.COMMISSIONS).filter((c) => c.رقم_العقد !== id);
    save(KEYS.COMMISSIONS, comm);

    const crs = get<ClearanceRecord>(KEYS.CLEARANCE_RECORDS);
    if (crs.some((r) => r.contractId === id || asUnknownRecord(r)['id'] === `CLR-${id}`)) {
      save(
        KEYS.CLEARANCE_RECORDS,
        crs.filter((r) => !(r.contractId === id || asUnknownRecord(r)['id'] === `CLR-${id}`))
      );
    }

    const legal = get<LegalNoticeRecord>(KEYS.LEGAL_HISTORY);
    if (legal.some((r) => r.contractId === id)) {
      save(KEYS.LEGAL_HISTORY, legal.filter((r) => r.contractId !== id));
    }

    const nlogs = get<NotificationSendLogRow>(KEYS.NOTIFICATION_SEND_LOGS);
    if (nlogs.some((l) => l.contractId === id)) {
      save(KEYS.NOTIFICATION_SEND_LOGS, nlogs.filter((l) => l.contractId !== id));
    }

    purgeRefs('Contract', id);

    logOperation(
      'Admin',
      'حذف',
      'Contracts',
      id,
      'حذف عقد نهائياً (Cascade) مع كل البيانات المرتبطة'
    );
    return ok();
  };

  const deletePropertyCascadeInternal = (id: string): DbResult<null> => {
    const props = get<العقارات_tbl>(KEYS.PROPERTIES);
    const prop = props.find((p) => p.رقم_العقار === id);
    if (!prop) return ok();

    const contractIds = get<العقود_tbl>(KEYS.CONTRACTS)
      .filter((c) => c.رقم_العقار === id)
      .map((c) => c.رقم_العقد);
    for (const cid of contractIds) {
      deleteContractCascadeInternal(cid);
    }

    const tickets = get<تذاكر_الصيانة_tbl>(KEYS.MAINTENANCE).filter((t) => t.رقم_العقار !== id);
    save(KEYS.MAINTENANCE, tickets);

    const listings = get<عروض_البيع_tbl>(KEYS.SALES_LISTINGS).filter((l) => l.رقم_العقار === id);
    if (listings.length) {
      const listingIds = listings.map((l) => l.id);

      const offers = get<عروض_الشراء_tbl>(KEYS.SALES_OFFERS).filter(
        (o) => !listingIds.includes(o.listingId)
      );
      save(KEYS.SALES_OFFERS, offers);

      const ags = get<اتفاقيات_البيع_tbl>(KEYS.SALES_AGREEMENTS).filter((a) =>
        listingIds.includes(a.listingId)
      );
      for (const a of ags) {
        forceDeleteSalesAgreementInternal(a.id);
      }

      for (const lid of listingIds) {
        purgeRefs('Sales', lid);
      }

      save(
        KEYS.SALES_LISTINGS,
        get<عروض_البيع_tbl>(KEYS.SALES_LISTINGS).filter((l) => l.رقم_العقار !== id)
      );
    }

    const oh = get<سجل_الملكية_tbl>(KEYS.OWNERSHIP_HISTORY);
    if (oh.some((r) => r.رقم_العقار === id)) {
      save(KEYS.OWNERSHIP_HISTORY, oh.filter((r) => r.رقم_العقار !== id));
    }

    const nlogs = get<NotificationSendLogRow>(KEYS.NOTIFICATION_SEND_LOGS);
    if (nlogs.some((l) => l.propertyId === id)) {
      save(KEYS.NOTIFICATION_SEND_LOGS, nlogs.filter((l) => l.propertyId !== id));
    }

    const inspections = get<PropertyInspection>(KEYS.INSPECTIONS);
    const toDelete = inspections.filter((x) => x.propertyId === id);
    if (toDelete.length) {
      for (const ins of toDelete) {
        purgeRefs('Inspection', ins.id);
      }
      save(KEYS.INSPECTIONS, inspections.filter((x) => x.propertyId !== id));
    }

    purgeRefs('Property', id);

    save(
      KEYS.PROPERTIES,
      props.filter((p) => p.رقم_العقار !== id)
    );

    logOperation(
      'Admin',
      'حذف',
      'Properties',
      id,
      'حذف عقار نهائياً (Cascade) مع كل البيانات المرتبطة'
    );
    return ok();
  };

  const deletePersonCascadeInternal = (id: string): DbResult<null> => {
    const people = get<الأشخاص_tbl>(KEYS.PEOPLE);
    const person = people.find((p) => p.رقم_الشخص === id);
    if (!person) return ok();

    const ownedPropIds = get<العقارات_tbl>(KEYS.PROPERTIES)
      .filter((p) => p.رقم_المالك === id)
      .map((p) => p.رقم_العقار);
    for (const pid of ownedPropIds) {
      deletePropertyCascadeInternal(pid);
    }

    const tenantContractIds = get<العقود_tbl>(KEYS.CONTRACTS)
      .filter((c) => c.رقم_المستاجر === id)
      .map((c) => c.رقم_العقد);
    for (const cid of tenantContractIds) {
      deleteContractCascadeInternal(cid);
    }

    const offers = get<عروض_الشراء_tbl>(KEYS.SALES_OFFERS);
    if (offers.some((o) => o.رقم_المشتري === id)) {
      save(KEYS.SALES_OFFERS, offers.filter((o) => o.رقم_المشتري !== id));
    }

    const agreements = get<اتفاقيات_البيع_tbl>(KEYS.SALES_AGREEMENTS);
    const agToDelete = agreements.filter((a) => a.رقم_المشتري === id || a.رقم_البائع === id);
    for (const a of agToDelete) {
      forceDeleteSalesAgreementInternal(a.id);
    }

    const listings = get<عروض_البيع_tbl>(KEYS.SALES_LISTINGS).filter((l) => l.رقم_المالك === id);
    for (const l of listings) {
      const offers2 = get<عروض_الشراء_tbl>(KEYS.SALES_OFFERS).filter((o) => o.listingId !== l.id);
      save(KEYS.SALES_OFFERS, offers2);
      const ags2 = get<اتفاقيات_البيع_tbl>(KEYS.SALES_AGREEMENTS).filter((a) => a.listingId === l.id);
      for (const a of ags2) forceDeleteSalesAgreementInternal(a.id);
      purgeRefs('Sales', l.id);
    }
    if (listings.length) {
      save(
        KEYS.SALES_LISTINGS,
        get<عروض_البيع_tbl>(KEYS.SALES_LISTINGS).filter((l) => l.رقم_المالك !== id)
      );
    }

    const oh2 = get<سجل_الملكية_tbl>(KEYS.OWNERSHIP_HISTORY);
    if (oh2.some((r) => r.رقم_المالك_القديم === id || r.رقم_المالك_الجديد === id)) {
      save(
        KEYS.OWNERSHIP_HISTORY,
        oh2.filter((r) => !(r.رقم_المالك_القديم === id || r.رقم_المالك_الجديد === id))
      );
    }

    const nlogs2 = get<NotificationSendLogRow>(KEYS.NOTIFICATION_SEND_LOGS);
    if (nlogs2.some((l) => l.tenantId === id)) {
      save(KEYS.NOTIFICATION_SEND_LOGS, nlogs2.filter((l) => l.tenantId !== id));
    }

    const interactions = get<ClientInteraction>(KEYS.CLIENT_INTERACTIONS);
    if (interactions.some((i) => i.clientId === id)) {
      save(KEYS.CLIENT_INTERACTIONS, interactions.filter((i) => i.clientId !== id));
    }

    const users = get<المستخدمين_tbl>(KEYS.USERS);
    const linkedUsers = users.filter((u) => asUnknownRecord(u)['linkedPersonId'] === id);
    if (linkedUsers.length) {
      const linkedIds = new Set(linkedUsers.map((u) => u.id));
      save(KEYS.USERS, users.filter((u) => !linkedIds.has(u.id)));
      const perms = get<مستخدم_صلاحية_tbl>(KEYS.USER_PERMISSIONS);
      if (perms.some((p) => linkedIds.has(p.userId))) {
        save(KEYS.USER_PERMISSIONS, perms.filter((p) => !linkedIds.has(p.userId)));
      }
    }

    const roles = get<شخص_دور_tbl>(KEYS.ROLES);
    if (roles.some((r) => r.رقم_الشخص === id)) {
      save(KEYS.ROLES, roles.filter((r) => r.رقم_الشخص !== id));
    }
    const blacklist = get<BlacklistRecord>(KEYS.BLACKLIST);
    if (blacklist.some((b) => b.personId === id)) {
      save(KEYS.BLACKLIST, blacklist.filter((b) => b.personId !== id));
    }

    purgeRefs('Person', id);

    save(KEYS.PEOPLE, people.filter((p) => p.رقم_الشخص !== id));

    logOperation(
      'Admin',
      'حذف',
      'People',
      id,
      'حذف شخص نهائياً (Cascade) مع كل البيانات المرتبطة'
    );
    return ok();
  };

  return {
    forceDeleteSalesAgreementInternal,
    deleteContractCascadeInternal,
    deletePropertyCascadeInternal,
    deletePersonCascadeInternal,
  };
}
