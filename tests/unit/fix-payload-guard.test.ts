/**
 * Tests for payload guard fix in sync functions (db.ts).
 * Malformed/non-array payloads are rejected, but valid arrays (including [])
 * must be allowed so SQLite mirror tables can reflect deletes from KV arrays.
 */

// Pure logic matching parseKvArrayForSync + the sync guard.
const parseKvArrayForSync = (value: string): unknown[] | null => {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const shouldSkipSync = (items: unknown[] | null): boolean => items === null;

describe('Payload Guard — sync functions', () => {
  describe('shouldSkipSync', () => {
    it('returns true for malformed/non-array payloads', () => {
      expect(shouldSkipSync(null)).toBe(true);
    });

    it('returns false for valid empty array so deletes are mirrored', () => {
      expect(shouldSkipSync([])).toBe(false);
    });

    it('returns false for valid non-empty array', () => {
      expect(shouldSkipSync([{ id: '1' }])).toBe(false);
    });

    it('returns false for array with multiple items', () => {
      expect(shouldSkipSync([{ id: '1' }, { id: '2' }])).toBe(false);
    });
  });

  describe('JSON parse safety', () => {
    it('returns null for invalid JSON', () => {
      expect(parseKvArrayForSync('invalid')).toBeNull();
    });

    it('returns null for JSON object (not array)', () => {
      expect(parseKvArrayForSync('{"key":"value"}')).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(parseKvArrayForSync('')).toBeNull();
    });

    it('returns null for null JSON', () => {
      expect(parseKvArrayForSync('null')).toBeNull();
    });

    it('returns empty array for valid empty JSON array', () => {
      expect(parseKvArrayForSync('[]')).toEqual([]);
    });

    it('returns array for valid JSON array', () => {
      expect(parseKvArrayForSync('[{"id":"1"}]')).toEqual([{ id: '1' }]);
    });

    it('guard triggers on corrupted payload', () => {
      const payload = 'corrupted-data';
      const items = parseKvArrayForSync(payload);
      expect(shouldSkipSync(items)).toBe(true);
    });

    it('guard does NOT trigger on valid empty payload', () => {
      const payload = '[]';
      const items = parseKvArrayForSync(payload);
      expect(shouldSkipSync(items)).toBe(false);
    });

    it('guard does NOT trigger on valid payload', () => {
      const payload = JSON.stringify([{ id: 'inst-1' }, { id: 'inst-2' }]);
      const items = parseKvArrayForSync(payload);
      expect(shouldSkipSync(items)).toBe(false);
    });
  });
});
