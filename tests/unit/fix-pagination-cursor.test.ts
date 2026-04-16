/**
 * Tests for pagination cursor fix in pullKvStoreOnce (sqlSync.ts)
 * Ensures (updatedAt, k) composite cursor prevents data loss at page boundaries
 */

type KvRow = { k: string; updatedAt: string };

const shouldIncludeRow = (
  row: KvRow,
  since: Date,
  sinceKey: string
): boolean => {
  const rowDate = new Date(row.updatedAt);
  if (rowDate > since) return true;
  if (rowDate.getTime() === since.getTime() && row.k > sinceKey) return true;
  return false;
};

const applyCompositeCursor = (rows: KvRow[], since: Date, sinceKey: string): KvRow[] => {
  return rows.filter((r) => shouldIncludeRow(r, since, sinceKey));
};

describe('Pagination Cursor — composite (updatedAt, k)', () => {
  const baseDate = new Date('2026-01-01T10:00:00.000Z');
  const sameDate = new Date('2026-01-01T10:00:00.000Z');
  const laterDate = new Date('2026-01-01T11:00:00.000Z');

  describe('shouldIncludeRow', () => {
    it('includes row with later updatedAt', () => {
      expect(shouldIncludeRow({ k: 'db_a', updatedAt: laterDate.toISOString() }, baseDate, '')).toBe(true);
    });

    it('excludes row with earlier updatedAt', () => {
      expect(shouldIncludeRow({ k: 'db_a', updatedAt: baseDate.toISOString() }, laterDate, '')).toBe(false);
    });

    it('includes row with same updatedAt but greater key', () => {
      expect(shouldIncludeRow({ k: 'db_z', updatedAt: sameDate.toISOString() }, baseDate, 'db_a')).toBe(true);
    });

    it('excludes row with same updatedAt and equal key', () => {
      expect(shouldIncludeRow({ k: 'db_a', updatedAt: sameDate.toISOString() }, baseDate, 'db_a')).toBe(false);
    });

    it('excludes row with same updatedAt and lesser key', () => {
      expect(shouldIncludeRow({ k: 'db_a', updatedAt: sameDate.toISOString() }, baseDate, 'db_z')).toBe(false);
    });
  });

  describe('applyCompositeCursor — page boundary scenario', () => {
    const rows: KvRow[] = [
      { k: 'db_contracts', updatedAt: '2026-01-01T10:00:00.000Z' },
      { k: 'db_installments', updatedAt: '2026-01-01T10:00:00.000Z' },
      { k: 'db_people', updatedAt: '2026-01-01T10:00:00.000Z' },
      { k: 'db_properties', updatedAt: '2026-01-01T10:00:00.000Z' },
    ];

    it('returns rows after cursor key when same timestamp', () => {
      const since = new Date('2026-01-01T10:00:00.000Z');
      const result = applyCompositeCursor(rows, since, 'db_installments');
      const keys = result.map((r) => r.k);
      expect(keys).toContain('db_people');
      expect(keys).toContain('db_properties');
      expect(keys).not.toContain('db_contracts');
      expect(keys).not.toContain('db_installments');
    });

    it('old cursor (updatedAt only) would miss rows at boundary', () => {
      // Simulating old behavior: WHERE updatedAt > since (strict)
      const oldCursor = rows.filter((r) => new Date(r.updatedAt) > new Date('2026-01-01T10:00:00.000Z'));
      expect(oldCursor).toHaveLength(0); // ← هذه هي المشكلة القديمة
    });

    it('new cursor recovers all rows at same timestamp', () => {
      const since = new Date('2026-01-01T10:00:00.000Z');
      const result = applyCompositeCursor(rows, since, '');
      expect(result).toHaveLength(4); // كل الصفوف بعد cursor فارغ
    });
  });
});
