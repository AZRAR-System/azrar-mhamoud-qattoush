/**
 * Marquee ads: sanitization + non-expired/active helpers (used by DbService marquee APIs).
 */

import type { MarqueeMessage } from '@/types';
import { get, save } from './kv';
import { KEYS } from './keys';

const asUnknownRecord = (value: unknown): Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : Object.create(null);

/** Shared by addMarqueeAd / updateMarqueeAd / getMarqueeMessages — single implementation. */
export type MarqueePlainJson =
  | null
  | string
  | number
  | boolean
  | MarqueePlainJson[]
  | { [key: string]: MarqueePlainJson };

export const sanitizeMarqueeTextForDb = (raw: unknown, maxLen = 300): string => {
  const s = String(raw ?? '')
    .replace(/[\u202A-\u202E\u2066-\u2069\u200E\u200F]/g, '')
    // eslint-disable-next-line no-control-regex -- strip bidi/control for DB text
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return s.length > maxLen ? s.slice(0, maxLen) : s;
};

export const createMarqueeActionSanitizers = (allowedPanels: readonly string[]) => {
  const isAllowedPanel = (p: unknown): p is string =>
    typeof p === 'string' && (allowedPanels as readonly string[]).includes(p);

  const toPlainJsonValue = (input: unknown, depth = 0): MarqueePlainJson | undefined => {
    if (depth > 3) return undefined;
    if (input === null) return null;
    if (typeof input === 'string') return sanitizeMarqueeTextForDb(input, 200);
    if (typeof input === 'number') return Number.isFinite(input) ? input : undefined;
    if (typeof input === 'boolean') return input;
    if (Array.isArray(input)) {
      const out: MarqueePlainJson[] = [];
      for (const v of input.slice(0, 50)) {
        const vv = toPlainJsonValue(v, depth + 1);
        if (typeof vv !== 'undefined') out.push(vv);
      }
      return out;
    }
    if (typeof input === 'object') {
      const rec = asUnknownRecord(input);
      const out: { [key: string]: MarqueePlainJson } = Object.create(null);
      const keys = Object.keys(rec).slice(0, 50);
      for (const k of keys) {
        if (k === '__proto__' || k === 'prototype' || k === 'constructor') continue;
        const vv = toPlainJsonValue(rec[k], depth + 1);
        if (typeof vv !== 'undefined') out[k] = vv;
      }
      return out;
    }
    return undefined;
  };

  const sanitizeOptions = (v: unknown): Record<string, unknown> | undefined => {
    const plain = toPlainJsonValue(v, 0);
    return plain && typeof plain === 'object' && !Array.isArray(plain)
      ? (plain as Record<string, unknown>)
      : undefined;
  };

  const sanitizeHash = (h: unknown): string | null => {
    const s = sanitizeMarqueeTextForDb(h, 200);
    if (!s) return null;
    if (!s.startsWith('/')) return null;
    if (/\s/.test(s)) return null;
    return s;
  };

  const sanitizeAction = (a: unknown): MarqueeMessage['action'] | undefined => {
    const rec = asUnknownRecord(a);
    const kind = typeof rec['kind'] === 'string' ? rec['kind'].trim() : '';
    if (kind === 'hash') {
      const hash = sanitizeHash(rec['hash']);
      return hash ? { kind: 'hash', hash } : undefined;
    }
    if (kind === 'panel') {
      const panel = typeof rec['panel'] === 'string' ? rec['panel'].trim() : '';
      if (!isAllowedPanel(panel)) return undefined;
      const id = sanitizeMarqueeTextForDb(rec['id'], 80);
      const options =
        typeof rec['options'] !== 'undefined' ? sanitizeOptions(rec['options']) : undefined;
      return {
        kind: 'panel',
        panel,
        ...(id ? { id } : {}),
        ...(typeof options !== 'undefined' ? { options } : {}),
      };
    }
    return undefined;
  };

  return { sanitizeMarqueeText: sanitizeMarqueeTextForDb, sanitizeAction };
};

export type MarqueeAdRecord = {
  id: string;
  content: string;
  priority: 'Normal' | 'High';
  type: 'alert' | 'info' | 'success';
  createdAt: string;
  expiresAt?: string;
  enabled?: boolean;
  action?: MarqueeMessage['action'];
};

export const getNonExpiredMarqueeAdsInternal = (): MarqueeAdRecord[] => {
  const all = get<MarqueeAdRecord>(KEYS.MARQUEE);
  const now = Date.now();
  const kept: MarqueeAdRecord[] = [];
  let changed = false;

  for (const a of all) {
    const exp = String(asUnknownRecord(a)['expiresAt'] ?? '').trim();
    if (exp) {
      const t = new Date(exp).getTime();
      if (!Number.isFinite(t) || t <= now) {
        changed = true;
        continue;
      }
    }
    kept.push(a);
  }

  if (changed) {
    save(KEYS.MARQUEE, kept);
  }

  return kept;
};

export const getActiveMarqueeAdsInternal = (): MarqueeAdRecord[] => {
  return getNonExpiredMarqueeAdsInternal().filter((a) => asUnknownRecord(a)['enabled'] !== false);
};
