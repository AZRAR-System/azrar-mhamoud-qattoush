/**
 * kpiCache — In-Memory KPI Cache
 * Hot layer (≤5ms) for Dashboard KPIs
 * TTL: 2min | Invalidated on: azrar:db-changed
 */

const TTL_MS = 120_000; // 2 دقيقة — يتوافق مع interval الـ Dashboard

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class KpiCache {
  private readonly store = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string): T | null {
    const entry = this.store.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    if (Date.now() - entry.timestamp > TTL_MS) {
      this.store.delete(key);
      return null;
    }
    return entry.data;
  }

  set<T>(key: string, data: T): void {
    this.store.set(key, { data, timestamp: Date.now() });
  }

  invalidate(prefix?: string): void {
    if (!prefix) {
      this.store.clear();
      return;
    }
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }

  get size(): number {
    return this.store.size;
  }
}

export const kpiCache = new KpiCache();
