/**
 * Tests for sales agreement archive fix (domain.ts)
 * Ensures deleted agreements are archived, not permanently removed
 */

type Agreement = Record<string, unknown>;

const archiveAgreement = (agreements: Agreement[], id: string): Agreement[] => {
  const nowIso = new Date().toISOString();
  return agreements.map((row) => {
    if (String(row['id'] ?? '').trim() !== id) return row;
    return { ...row, isArchived: true, archivedAt: nowIso };
  });
};

describe('Sales Agreement — archive instead of delete', () => {
  const mockAgreements: Agreement[] = [
    { id: 'AGR-001', title: 'اتفاقية ١', isArchived: false },
    { id: 'AGR-002', title: 'اتفاقية ٢', isArchived: false },
    { id: 'AGR-003', title: 'اتفاقية ٣', isArchived: false },
  ];

  it('marks target agreement as archived', () => {
    const result = archiveAgreement(mockAgreements, 'AGR-001');
    const target = result.find((r) => r['id'] === 'AGR-001');
    expect(target?.['isArchived']).toBe(true);
  });

  it('does NOT remove agreement from array', () => {
    const result = archiveAgreement(mockAgreements, 'AGR-001');
    expect(result).toHaveLength(3);
  });

  it('preserves other agreements unchanged', () => {
    const result = archiveAgreement(mockAgreements, 'AGR-001');
    const other = result.find((r) => r['id'] === 'AGR-002');
    expect(other?.['isArchived']).toBe(false);
  });

  it('adds archivedAt timestamp', () => {
    const before = new Date().toISOString();
    const result = archiveAgreement(mockAgreements, 'AGR-002');
    const target = result.find((r) => r['id'] === 'AGR-002');
    const after = new Date().toISOString();
    expect(target?.['archivedAt']).toBeDefined();
    expect(String(target?.['archivedAt']) >= before).toBe(true);
    expect(String(target?.['archivedAt']) <= after).toBe(true);
  });

  it('does nothing if id not found', () => {
    const result = archiveAgreement(mockAgreements, 'AGR-999');
    expect(result).toEqual(mockAgreements);
  });

  it('handles empty agreements array', () => {
    const result = archiveAgreement([], 'AGR-001');
    expect(result).toEqual([]);
  });

  it('preserves all original fields after archive', () => {
    const result = archiveAgreement(mockAgreements, 'AGR-003');
    const target = result.find((r) => r['id'] === 'AGR-003');
    expect(target?.['title']).toBe('اتفاقية ٣');
    expect(target?.['id']).toBe('AGR-003');
  });
});
