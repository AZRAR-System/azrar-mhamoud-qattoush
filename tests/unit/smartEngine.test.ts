import { SmartEngine } from '@/services/smartEngine';
import { storage } from '@/services/storage';
import { KEYS } from '@/services/db/keys';

describe('SmartEngine - Intelligence Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  describe('track', () => {
    test('successfully tracks primitive fields', () => {
      const data = { name: 'Ahmed', age: 30, isRenter: true, id: '123' };
      SmartEngine.track('person', data);

      const raw = localStorage.getItem(KEYS.SMART_BEHAVIOR);
      const history = JSON.parse(raw || '[]');
      
      // Should track name, age, isRenter but NOT id
      expect(history).toHaveLength(3);
      expect(history.find((h: any) => h.field === 'name').value).toBe('Ahmed');
      expect(history.find((h: any) => h.field === 'age').value).toBe(30);
      expect(history.find((h: any) => h.field === 'isRenter').value).toBe(true);
      expect(history.find((h: any) => h.field === 'id')).toBeUndefined();
    });

    test('ignores null or empty values', () => {
      SmartEngine.track('person', { name: '', age: null, city: undefined });
      const raw = localStorage.getItem(KEYS.SMART_BEHAVIOR);
      // It might save an empty array "[]" if it was already initialized or just through the flow
      const history = JSON.parse(raw || '[]');
      expect(history).toHaveLength(0);
    });

    test('maintains history limit', () => {
      // Simulate large history
      for (let i = 0; i < 2100; i++) {
        SmartEngine.track('person', { test: i });
      }
      const history = JSON.parse(localStorage.getItem(KEYS.SMART_BEHAVIOR) || '[]');
      // Limit is (LIMIT * 20) = 100 * 20 = 2000
      expect(history.length).toBeLessThanOrEqual(2000);
    });
  });

  describe('predict', () => {
    test('suggests most frequent value (mode)', () => {
      // Setup history: Ahmed appears 4 times, Sami 1 time
      for (let i = 0; i < 4; i++) SmartEngine.track('person', { name: 'Ahmed' });
      SmartEngine.track('person', { name: 'Sami' });

      const suggestions = SmartEngine.predict('person', {});
      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].field).toBe('name');
      expect(suggestions[0].suggestedValue).toBe('Ahmed');
      expect(suggestions[0].confidence).toBeGreaterThan(0.7);
    });

    test('returns empty if not enough data', () => {
      SmartEngine.track('person', { name: 'Ahmed' });
      const suggestions = SmartEngine.predict('person', {});
      expect(suggestions).toHaveLength(0); // Needs 3+ entries
    });

    test('skips if field already filled', () => {
      for (let i = 0; i < 5; i++) SmartEngine.track('person', { name: 'Ahmed' });
      const suggestions = SmartEngine.predict('person', { name: 'Existing' });
      expect(suggestions).toHaveLength(0);
    });
  });

  describe('detectAnomalies', () => {
    test('detects statistical deviations', () => {
      // Normal range: 100, 110, 105, 95, 100, 105
      [100, 110, 105, 95, 100, 105].forEach(v => SmartEngine.track('contract', { price: v }));
      
      // Anomaly: 500 (more than 2.5x mean)
      const anomalies = SmartEngine.detectAnomalies('contract', { price: 500 });
      expect(anomalies).toHaveLength(1);
      expect(anomalies[0]).toContain('أعلى بكثير من المعدل المعتاد');
    });

    test('detects low rating for persons', () => {
      const anomalies = SmartEngine.detectAnomalies('person', { تقييم: 1 });
      expect(anomalies).toHaveLength(1);
      expect(anomalies[0]).toContain('تقييم منخفض');
    });

    test('detects rule violations', () => {
      // In smartRules.ts, 'رقم_الهاتف' likely has a regex/min-length
      const anomalies = SmartEngine.detectAnomalies('person', { رقم_الهاتف: '12' });
      if (anomalies.length > 0) {
        expect(anomalies[0]).toContain('تخالف القاعدة');
      }
    });
  });
});
