/**
 * One-time migration: legacy contract IDs → canonical cot_XXX + cross-table reference updates.
 */

import type { NotificationSendLogRecord } from './paymentNotifications';
import {
  ActivityRecord,
  Attachment,
  ClearanceRecord,
  LegalNoticeRecord,
  NoteRecord,
  العقود_tbl,
  العمولات_tbl,
  الكمبيالات_tbl,
} from '@/types';
import { storage } from '@/services/storage';
import { get, save } from './kv';
import { KEYS } from './keys';

const asUnknownRecord = (value: unknown): Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : Object.create(null);

export const CONTRACT_NUMBER_MIGRATION_KEY = 'migration_contract_numbers_cot_v1';

const isCanonicalContractNumber = (id: string) => /^cot_\d+$/i.test(String(id || '').trim());

const normalizeCotContractNumber = (id: string): string => {
  const raw = String(id || '').trim();
  const m = /^cot_(\d+)$/i.exec(raw);
  if (!m) return raw;
  const n = parseInt(m[1], 10);
  if (!Number.isFinite(n) || n <= 0) return raw;
  return `cot_${String(n).padStart(3, '0')}`;
};

const toYyyyMmDdKey = (raw: string): string => {
  const s = String(raw ?? '').trim();
  if (!s) return '19700101';

  const m1 = /^(\d{4})[-\/](\d{2})[-\/](\d{2})/.exec(s);
  if (m1) return `${m1[1]}${m1[2]}${m1[3]}`;

  const ts = Date.parse(s);
  if (!Number.isFinite(ts)) return '19700101';
  const d = new Date(ts);
  const yyyy = String(d.getFullYear()).padStart(4, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
};

export const migrateLegacyContractNumbersOnce = () => {
  try {
    if (localStorage.getItem(CONTRACT_NUMBER_MIGRATION_KEY) === '1') return;
  } catch {
    // ignore
  }

  try {
    const contracts = get<العقود_tbl>(KEYS.CONTRACTS);
    if (!Array.isArray(contracts) || contracts.length === 0) {
      try {
        localStorage.setItem(CONTRACT_NUMBER_MIGRATION_KEY, '1');
        void storage.setItem(CONTRACT_NUMBER_MIGRATION_KEY, '1');
      } catch {
        // ignore
      }
      return;
    }

    const usedIds = new Set<string>();
    const usedSeq = new Set<number>();
    let maxSeq = 0;

    const mapping = new Map<string, string>();

    for (const c of contracts) {
      const raw = String(c?.رقم_العقد ?? '').trim();
      if (!raw) continue;
      if (isCanonicalContractNumber(raw)) {
        const normalized = normalizeCotContractNumber(raw);
        const m = /^cot_(\d+)$/i.exec(normalized);
        if (m) {
          const n = parseInt(m[1], 10);
          if (Number.isFinite(n)) {
            usedSeq.add(n);
            if (n > maxSeq) maxSeq = n;
          }
        }
        usedIds.add(normalized);
        if (normalized !== raw) mapping.set(raw, normalized);
      }
    }

    const legacy = contracts
      .map((c) => ({
        c,
        oldId: String(c?.رقم_العقد ?? '').trim(),
        dateKey: toYyyyMmDdKey(String(c?.تاريخ_البداية ?? '')),
      }))
      .filter((x) => x.oldId && !isCanonicalContractNumber(x.oldId));

    if (legacy.length === 0 && mapping.size === 0) {
      try {
        localStorage.setItem(CONTRACT_NUMBER_MIGRATION_KEY, '1');
        void storage.setItem(CONTRACT_NUMBER_MIGRATION_KEY, '1');
      } catch {
        // ignore
      }
      return;
    }

    legacy.sort((a, b) => {
      const cmp = String(a.dateKey).localeCompare(String(b.dateKey));
      if (cmp) return cmp;
      return String(a.oldId).localeCompare(String(b.oldId), 'en', {
        numeric: true,
        sensitivity: 'base',
      });
    });

    let seq = maxSeq + 1;
    for (const item of legacy) {
      if (!item.oldId) continue;
      if (mapping.has(item.oldId)) continue;

      while (usedSeq.has(seq) || usedIds.has(`cot_${String(seq).padStart(3, '0')}`)) {
        seq++;
      }
      const newId = `cot_${String(seq).padStart(3, '0')}`;
      mapping.set(item.oldId, newId);
      usedSeq.add(seq);
      usedIds.add(newId);
      seq++;
    }

    if (mapping.size === 0) {
      try {
        localStorage.setItem(CONTRACT_NUMBER_MIGRATION_KEY, '1');
        void storage.setItem(CONTRACT_NUMBER_MIGRATION_KEY, '1');
      } catch {
        // ignore
      }
      return;
    }

    const nextContracts = contracts.map((c) => {
      const oldId = String(c?.رقم_العقد ?? '').trim();
      const nextId = mapping.get(oldId);
      if (!nextId) {
        const linked = String(asUnknownRecord(c)['linkedContractId'] ?? '').trim();
        const rel = String(asUnknownRecord(c)['عقد_مرتبط'] ?? '').trim();
        const patch = { ...c } as العقود_tbl;
        if (linked && mapping.has(linked))
          asUnknownRecord(patch)['linkedContractId'] = mapping.get(linked);
        if (rel && mapping.has(rel)) asUnknownRecord(patch)['عقد_مرتبط'] = mapping.get(rel);
        return patch;
      }

      const patch = { ...c, رقم_العقد: nextId } as العقود_tbl;
      const linked = String(asUnknownRecord(c)['linkedContractId'] ?? '').trim();
      const rel = String(asUnknownRecord(c)['عقد_مرتبط'] ?? '').trim();
      if (linked && mapping.has(linked))
        asUnknownRecord(patch)['linkedContractId'] = mapping.get(linked);
      if (rel && mapping.has(rel)) asUnknownRecord(patch)['عقد_مرتبط'] = mapping.get(rel);
      return patch;
    });
    save(KEYS.CONTRACTS, nextContracts);

    const installments = get<الكمبيالات_tbl>(KEYS.INSTALLMENTS);
    if (Array.isArray(installments) && installments.length) {
      const nextInstallments = installments.map((i) => {
        const oldId = String(i?.رقم_العقد ?? '').trim();
        const nextId = mapping.get(oldId);
        return nextId ? ({ ...i, رقم_العقد: nextId } as الكمبيالات_tbl) : i;
      });
      save(KEYS.INSTALLMENTS, nextInstallments);
    }

    const commissions = get<العمولات_tbl>(KEYS.COMMISSIONS);
    if (Array.isArray(commissions) && commissions.length) {
      const nextCommissions = commissions.map((r) => {
        const oldId = String(r?.رقم_العقد ?? '').trim();
        const nextId = mapping.get(oldId);
        return nextId ? ({ ...r, رقم_العقد: nextId } as العمولات_tbl) : r;
      });
      save(KEYS.COMMISSIONS, nextCommissions);
    }

    const atts = get<Attachment>(KEYS.ATTACHMENTS);
    if (Array.isArray(atts) && atts.length) {
      const nextAtts = atts.map((a) => {
        if (a?.referenceType !== 'Contract') return a;
        const oldId = String(a?.referenceId ?? '').trim();
        const nextId = mapping.get(oldId);
        return nextId ? ({ ...a, referenceId: nextId } as Attachment) : a;
      });
      save(KEYS.ATTACHMENTS, nextAtts);
    }

    const acts = get<ActivityRecord>(KEYS.ACTIVITIES);
    if (Array.isArray(acts) && acts.length) {
      const nextActs = acts.map((a) => {
        if (a?.referenceType !== 'Contract') return a;
        const oldId = String(a?.referenceId ?? '').trim();
        const nextId = mapping.get(oldId);
        return nextId ? ({ ...a, referenceId: nextId } as ActivityRecord) : a;
      });
      save(KEYS.ACTIVITIES, nextActs);
    }
    const notes = get<NoteRecord>(KEYS.NOTES);
    if (Array.isArray(notes) && notes.length) {
      const nextNotes = notes.map((n) => {
        if (n?.referenceType !== 'Contract') return n;
        const oldId = String(n?.referenceId ?? '').trim();
        const nextId = mapping.get(oldId);
        return nextId ? ({ ...n, referenceId: nextId } as NoteRecord) : n;
      });
      save(KEYS.NOTES, nextNotes);
    }

    const crs = get<ClearanceRecord>(KEYS.CLEARANCE_RECORDS);
    if (Array.isArray(crs) && crs.length) {
      const nextCrs = crs.map((r) => {
        const oldId = String(r?.contractId ?? '').trim();
        const nextId = mapping.get(oldId);
        if (!nextId) return r;
        const nextRec: ClearanceRecord = { ...r, contractId: nextId };
        if (String(asUnknownRecord(r)['id'] ?? '') === `CLR-${oldId}`) {
          asUnknownRecord(nextRec)['id'] = `CLR-${nextId}`;
        }
        return nextRec;
      });
      save(KEYS.CLEARANCE_RECORDS, nextCrs);
    }

    const legal = get<LegalNoticeRecord>(KEYS.LEGAL_HISTORY);
    if (Array.isArray(legal) && legal.length) {
      const nextLegal = legal.map((r) => {
        const oldId = String(r?.contractId ?? '').trim();
        const nextId = mapping.get(oldId);
        return nextId ? ({ ...r, contractId: nextId } as LegalNoticeRecord) : r;
      });
      save(KEYS.LEGAL_HISTORY, nextLegal);
    }

    const nlogs = get<NotificationSendLogRecord>(KEYS.NOTIFICATION_SEND_LOGS);
    if (Array.isArray(nlogs) && nlogs.length) {
      const nextLogs = nlogs.map((l) => {
        const oldId = String(asUnknownRecord(l)['contractId'] ?? '').trim();
        const nextId = mapping.get(oldId);
        return nextId ? ({ ...l, contractId: nextId } as NotificationSendLogRecord) : l;
      });
      save(KEYS.NOTIFICATION_SEND_LOGS, nextLogs);
    }

    try {
      localStorage.setItem(CONTRACT_NUMBER_MIGRATION_KEY, '1');
      void storage.setItem(CONTRACT_NUMBER_MIGRATION_KEY, '1');
    } catch {
      // ignore
    }
  } catch (e) {
    console.warn('Contract number migration failed', e);
  }
};
