/**
 * Payment due notification targets + WhatsApp send log (KV-backed).
 */

import type { DbResult } from '@/types';
import { العقود_tbl, الأشخاص_tbl, العقارات_tbl, الكمبيالات_tbl } from '@/types';
import { isTenancyRelevant } from '@/utils/tenancy';
import { dbFail, dbOk } from '@/services/localDbStorage';
import { get, save } from './kv';
import { KEYS } from './keys';
import { INSTALLMENT_STATUS } from './installmentConstants';
import { getInstallmentPaidAndRemaining } from './installments';

const toDateOnly = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

const parseDateOnlyLocal = (iso: string | null | undefined) => {
  if (!iso) return null;
  const parts = iso.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
  return new Date(parts[0], parts[1] - 1, parts[2]);
};

const daysBetweenDateOnly = (from: Date, to: Date) => {
  const a = toDateOnly(from).getTime();
  const b = toDateOnly(to).getTime();
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
};

const asUnknownRecord = (value: unknown): Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : Object.create(null);

export type PaymentDueBucket = 'overdue' | 'today' | 'upcoming';

export interface PaymentDueItem {
  installmentId: string;
  contractId: string;
  dueDate: string;
  amountRemaining: number;
  daysUntilDue: number;
  bucket: PaymentDueBucket;
  installmentType?: string;
}

export interface PaymentNotificationTarget {
  key: string;
  tenantId?: string;
  tenantName: string;
  phone?: string;
  extraPhone?: string;
  contractId: string;
  propertyId?: string;
  propertyCode?: string;
  items: PaymentDueItem[];
  guarantorId?: string;
  guarantorName?: string;
  guarantorPhone?: string;
}

export interface NotificationSendLogRecord {
  id: string;
  category: string;
  tenantId?: string;
  tenantName: string;
  phone?: string;
  contractId?: string;
  propertyId?: string;
  propertyCode?: string;
  installmentIds?: string[];
  sentAt: string;
  message?: string;
  note?: string;
  reply?: string;
}

const ok = dbOk;
const fail = dbFail;

export const getPaymentNotificationTargetsInternal = (daysAhead: number) => {
  const norm = (v: unknown) => String(v ?? '').trim();
  const today = toDateOnly(new Date());
  const contracts = get<العقود_tbl>(KEYS.CONTRACTS).filter((c) => isTenancyRelevant(c));
  const people = get<الأشخاص_tbl>(KEYS.PEOPLE);
  const properties = get<العقارات_tbl>(KEYS.PROPERTIES);
  const installments = get<الكمبيالات_tbl>(KEYS.INSTALLMENTS);

  const targetsByKey = new Map<string, PaymentNotificationTarget>();

  for (const contract of contracts) {
    const tenant = people.find((p) => p.رقم_الشخص === contract.رقم_المستاجر);
    const guarantor = people.find((p) => p.رقم_الشخص === contract.رقم_الكفيل);
    const property = properties.find((p) => p.رقم_العقار === contract.رقم_العقار);

    const contractInstallments = installments
      .filter((i) => i.رقم_العقد === contract.رقم_العقد)
      .filter((i) => i.نوع_الكمبيالة !== 'تأمين')
      .filter((i) => asUnknownRecord(i)['isArchived'] !== true)
      .filter((i) => {
        const status = norm(i.حالة_الكمبيالة);
        return status !== INSTALLMENT_STATUS.CANCELLED && status !== INSTALLMENT_STATUS.PAID;
      });

    const dueItems: PaymentDueItem[] = [];
    for (const inst of contractInstallments) {
      const { remaining } = getInstallmentPaidAndRemaining(inst);
      if (remaining <= 0) continue;
      const due = parseDateOnlyLocal(inst.تاريخ_استحقاق);
      if (!due) continue;
      const daysUntilDue = daysBetweenDateOnly(today, due);
      if (daysUntilDue <= 0) continue;
      if (daysUntilDue > daysAhead) continue;
      const bucket: PaymentDueBucket = 'upcoming';

      dueItems.push({
        installmentId: inst.رقم_الكمبيالة,
        contractId: contract.رقم_العقد,
        dueDate: inst.تاريخ_استحقاق,
        amountRemaining: remaining,
        daysUntilDue,
        bucket,
        installmentType: inst.نوع_الكمبيالة,
      });
    }

    if (dueItems.length === 0) continue;

    const key = `${contract.رقم_العقد}`;
    const existing = targetsByKey.get(key);
    if (!existing) {
      targetsByKey.set(key, {
        key,
        tenantId: tenant?.رقم_الشخص,
        tenantName: tenant?.الاسم || 'مستأجر',
        phone: tenant?.رقم_الهاتف,
        extraPhone: tenant?.رقم_هاتف_اضافي,
        contractId: contract.رقم_العقد,
        propertyId: property?.رقم_العقار,
        propertyCode: property?.الكود_الداخلي,
        items: dueItems,
        guarantorId: guarantor?.رقم_الشخص,
        guarantorName: guarantor?.الاسم,
        guarantorPhone: guarantor?.رقم_الهاتف,
      });
    } else {
      existing.items.push(...dueItems);
    }
  }

  return Array.from(targetsByKey.values()).map((t) => ({
    ...t,
    items: t.items.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()),
  }));
};

export const addNotificationSendLogInternal = (log: Omit<NotificationSendLogRecord, 'id'>) => {
  const all = get<NotificationSendLogRecord>(KEYS.NOTIFICATION_SEND_LOGS);
  const rec: NotificationSendLogRecord = {
    id: `NSL-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    ...log,
  };
  save(KEYS.NOTIFICATION_SEND_LOGS, [rec, ...all]);
  return rec;
};

export const updateNotificationSendLogInternal = (
  id: string,
  patch: Partial<Pick<NotificationSendLogRecord, 'note' | 'reply'>>
): DbResult<NotificationSendLogRecord> => {
  const all = get<NotificationSendLogRecord>(KEYS.NOTIFICATION_SEND_LOGS);
  const idx = all.findIndex((x) => x.id === id);
  if (idx === -1) return fail('Not found');
  all[idx] = { ...all[idx], ...patch };
  save(KEYS.NOTIFICATION_SEND_LOGS, all);
  return ok(all[idx]);
};

export const deleteNotificationSendLogInternal = (id: string): DbResult<null> => {
  const all = get<NotificationSendLogRecord>(KEYS.NOTIFICATION_SEND_LOGS);
  const next = all.filter((x) => x.id !== id);
  if (next.length === all.length) return ok(null);
  save(KEYS.NOTIFICATION_SEND_LOGS, next);
  return ok(null);
};
