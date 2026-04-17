/**
 * Tests for notification system
 * Covers: duplicate prevention, stable IDs, navigation routing by category
 */

// --- Stable ID generation logic ---
const buildNotificationId = (
  cat: string,
  entityId?: string,
  title?: string,
  message?: string
): string => {
  if (entityId) return `nc-${cat}-${entityId}`;
  return `nc-${cat}-${title ?? ''}-${(message ?? '').slice(0, 60)}`.replace(/\s+/g, '-');
};

// --- Navigation routing logic ---
const resolveNavigationTarget = (
  category: string,
  entityId?: string
): { type: 'panel'; panel: string; id: string } | { type: 'route'; route: string } => {
  const cat = category.toLowerCase();
  const eid = (entityId ?? '').trim();

  if (eid) {
    if (cat.includes('contract') || cat === 'contract_renewal')
      return { type: 'panel', panel: 'CONTRACT_DETAILS', id: eid };
    if (cat.includes('person') || cat === 'people' || cat === 'blacklist')
      return { type: 'panel', panel: 'PERSON_DETAILS', id: eid };
    if (cat.includes('propert'))
      return { type: 'panel', panel: 'PROPERTY_DETAILS', id: eid };
    if (
      cat.includes('payment') || cat === 'payments' ||
      cat === 'overdue' || cat === 'collection' ||
      cat === 'financial' || cat === 'installment'
    ) return { type: 'panel', panel: 'INSTALLMENT_DETAILS', id: eid };
    if (cat === 'maintenance')
      return { type: 'panel', panel: 'MAINTENANCE_DETAILS', id: eid };
  }

  if (cat.includes('payment') || cat === 'collection') return { type: 'route', route: '/installments' };
  if (cat.includes('contract')) return { type: 'route', route: '/contracts' };
  if (cat === 'maintenance') return { type: 'route', route: '/maintenance' };
  if (cat === 'system') return { type: 'route', route: '/settings' };
  return { type: 'route', route: '/alerts' };
};

describe('Notification stable ID generation', () => {
  it('uses entityId when available', () => {
    const id = buildNotificationId('contracts', 'cot_001');
    expect(id).toBe('nc-contracts-cot_001');
  });

  it('same category + entityId produces same ID', () => {
    const id1 = buildNotificationId('contract_renewal', 'cot_005');
    const id2 = buildNotificationId('contract_renewal', 'cot_005');
    expect(id1).toBe(id2);
  });

  it('different entityId produces different ID', () => {
    const id1 = buildNotificationId('contracts', 'cot_001');
    const id2 = buildNotificationId('contracts', 'cot_002');
    expect(id1).not.toBe(id2);
  });

  it('builds ID from content when no entityId', () => {
    const id = buildNotificationId('system', undefined, 'تنبيه', 'رسالة');
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('same content produces same ID (no duplicates)', () => {
    const id1 = buildNotificationId('system', undefined, 'تنبيه', 'رسالة');
    const id2 = buildNotificationId('system', undefined, 'تنبيه', 'رسالة');
    expect(id1).toBe(id2);
  });
});

describe('Notification navigation routing', () => {
  describe('with entityId', () => {
    it('contracts → opens CONTRACT_DETAILS panel', () => {
      const result = resolveNavigationTarget('contracts', 'cot_001');
      expect(result.type).toBe('panel');
      expect((result as any).panel).toBe('CONTRACT_DETAILS');
      expect((result as any).id).toBe('cot_001');
    });

    it('contract_renewal → opens CONTRACT_DETAILS panel', () => {
      const result = resolveNavigationTarget('contract_renewal', 'cot_005');
      expect(result.type).toBe('panel');
      expect((result as any).panel).toBe('CONTRACT_DETAILS');
    });

    it('payments → opens INSTALLMENT_DETAILS panel', () => {
      const result = resolveNavigationTarget('payments', 'inst_001');
      expect(result.type).toBe('panel');
      expect((result as any).panel).toBe('INSTALLMENT_DETAILS');
    });

    it('overdue → opens INSTALLMENT_DETAILS panel', () => {
      const result = resolveNavigationTarget('overdue', 'inst_002');
      expect(result.type).toBe('panel');
      expect((result as any).panel).toBe('INSTALLMENT_DETAILS');
    });

    it('financial → opens INSTALLMENT_DETAILS panel', () => {
      const result = resolveNavigationTarget('Financial', 'inst_003');
      expect(result.type).toBe('panel');
      expect((result as any).panel).toBe('INSTALLMENT_DETAILS');
    });

    it('maintenance → opens MAINTENANCE_DETAILS panel', () => {
      const result = resolveNavigationTarget('maintenance', 'maint_001');
      expect(result.type).toBe('panel');
      expect((result as any).panel).toBe('MAINTENANCE_DETAILS');
    });

    it('person → opens PERSON_DETAILS panel', () => {
      const result = resolveNavigationTarget('people', 'P-001');
      expect(result.type).toBe('panel');
      expect((result as any).panel).toBe('PERSON_DETAILS');
    });

    it('blacklist → opens PERSON_DETAILS panel', () => {
      const result = resolveNavigationTarget('blacklist', 'P-002');
      expect(result.type).toBe('panel');
      expect((result as any).panel).toBe('PERSON_DETAILS');
    });
  });

  describe('without entityId — route navigation', () => {
    it('payments without entityId → installments route', () => {
      const result = resolveNavigationTarget('payments');
      expect(result.type).toBe('route');
      expect((result as any).route).toBe('/installments');
    });

    it('contracts without entityId → contracts route', () => {
      const result = resolveNavigationTarget('contracts');
      expect(result.type).toBe('route');
      expect((result as any).route).toBe('/contracts');
    });

    it('system → settings route', () => {
      const result = resolveNavigationTarget('system');
      expect(result.type).toBe('route');
      expect((result as any).route).toBe('/settings');
    });

    it('unknown category → alerts route', () => {
      const result = resolveNavigationTarget('unknown');
      expect(result.type).toBe('route');
      expect((result as any).route).toBe('/alerts');
    });
  });
});
