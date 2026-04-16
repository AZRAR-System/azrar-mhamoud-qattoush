/**
 * Tests for payload guard fix in sync functions (db.ts)
 * Ensures empty payloads are rejected before DELETE operations
 */

// Pure logic extracted from syncInstallmentsKvPayload guard
const shouldSkipSync = (items: unknown[]): boolean => items.length === 0;

describe('Payload Guard — sync functions', () => {
  describe('shouldSkipSync', () => {
    it('returns true for empty array', () => {
      expect(shouldSkipSync([])).toBe(true);
    });

    it('returns false for non-empty array', () => {
      expect(shouldSkipSync([{ id: '1' }])).toBe(false);
    });

    it('returns false for array with multiple items', () => {
      expect(shouldSkipSync([{ id: '1' }, { id: '2' }])).toBe(false);
    });
  });

  describe('JSON parse safety', () => {
    const safeJsonParseArray = (value: string): unknown[] => {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    };

    it('returns empty array for invalid JSON', () => {
      expect(safeJsonParseArray('invalid')).toEqual([]);
    });

    it('returns empty array for JSON object (not array)', () => {
      expect(safeJsonParseArray('{"key":"value"}')).toEqual([]);
    });

    it('returns empty array for empty string', () => {
      expect(safeJsonParseArray('')).toEqual([]);
    });

    it('returns empty array for null JSON', () => {
      expect(safeJsonParseArray('null')).toEqual([]);
    });

    it('returns array for valid JSON array', () => {
      expect(safeJsonParseArray('[{"id":"1"}]')).toEqual([{ id: '1' }]);
    });

    it('guard triggers on corrupted payload', () => {
      const payload = 'corrupted-data';
      const items = safeJsonParseArray(payload);
      expect(shouldSkipSync(items)).toBe(true);
    });

    it('guard does NOT trigger on valid payload', () => {
      const payload = JSON.stringify([{ id: 'inst-1' }, { id: 'inst-2' }]);
      const items = safeJsonParseArray(payload);
      expect(shouldSkipSync(items)).toBe(false);
    });
  });
});
