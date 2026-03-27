/**
 * © 2025 — Developed by Mahmoud Qattoush
 * Smart Behavior Engine
 * Tracks user input patterns and provides AI-like suggestions and anomaly detection.
 * Now Integrated with Rules Library for Self-Learning Validation.
 */

import { SmartBehaviorPattern, SmartSuggestion, SmartCategory } from '../types';
import { FIELD_RULES } from './smartRules';
import { storage } from '@/services/storage';

const KEY_SMART_BEHAVIOR = 'db_smart_behavior';
const LIMIT = 100; // Track last 100 inputs per category

export const SmartEngine = {
  // --- 1. TRACKING MODULE ---
  track: (category: SmartCategory, data: Record<string, unknown>) => {
    try {
      const raw = localStorage.getItem(KEY_SMART_BEHAVIOR);
      const history: SmartBehaviorPattern[] = raw ? JSON.parse(raw) : [];

      const newEntries: SmartBehaviorPattern[] = [];

      // Extract trackable fields (primitives only)
      Object.keys(data).forEach((key) => {
        const value = data[key];
        if (
          value !== undefined &&
          value !== null &&
          value !== '' &&
          (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
        ) {
          // Skip unique IDs or dates usually
          if (
            key.includes('id') ||
            key.includes('Id') ||
            key.includes('date') ||
            key.includes('تاريخ')
          )
            return;

          newEntries.push({
            category,
            field: key,
            value: value,
            timestamp: Date.now(),
          });
        }
      });

      // Add new entries
      const updatedHistory = [...history, ...newEntries];

      // Cleanup: Keep only last LIMIT * 10 items
      const keptHistory = updatedHistory.slice(-(LIMIT * 20));

      const serialized = JSON.stringify(keptHistory);
      void storage.setItem(KEY_SMART_BEHAVIOR, serialized);
      localStorage.setItem(KEY_SMART_BEHAVIOR, serialized);
    } catch (e) {
      console.error('SmartEngine Track Error:', e);
    }
  },

  // --- 2. PREDICTOR (Enhanced with Rules) ---
  predict: (
    category: SmartCategory,
    currentFormData: Record<string, unknown>
  ): SmartSuggestion[] => {
    try {
      const raw = localStorage.getItem(KEY_SMART_BEHAVIOR);
      if (!raw) return [];
      const history: SmartBehaviorPattern[] = JSON.parse(raw);

      const suggestions: SmartSuggestion[] = [];
      const categoryHistory = history.filter((h) => h.category === category);

      // Group by field
      const fieldsMap: Record<string, unknown[]> = {};
      categoryHistory.forEach((h) => {
        if (!fieldsMap[h.field]) fieldsMap[h.field] = [];
        fieldsMap[h.field].push(h.value);
      });

      Object.keys(fieldsMap).forEach((field) => {
        // If field is already filled in form, skip
        if (currentFormData[field]) return;

        const values = fieldsMap[field];
        if (values.length < 3) return; // Need minimal data

        // Filter values based on Rules Library (Self-Correction: Don't suggest bad data)
        const rule = FIELD_RULES[field];
        let validValues = values;

        if (rule && rule.validation) {
          validValues = values.filter((v) => {
            if (rule.validation?.regex && !rule.validation.regex.test(String(v))) return false;
            if (rule.validation?.min !== undefined && Number(v) < rule.validation.min) return false;
            if (rule.validation?.max !== undefined && Number(v) > rule.validation.max) return false;
            return true;
          });
        }

        if (validValues.length === 0) return; // No valid history to suggest

        // Find Mode (Most Frequent)
        const frequency: Record<string, number> = {};
        let maxFreq = 0;
        let modeValue = null;

        validValues.forEach((v) => {
          const k = String(v);
          frequency[k] = (frequency[k] || 0) + 1;
          if (frequency[k] > maxFreq) {
            maxFreq = frequency[k];
            modeValue = v;
          }
        });

        const confidence = maxFreq / validValues.length;

        // Only suggest if confidence is significant
        if (confidence > 0.3 && modeValue !== null) {
          suggestions.push({
            field,
            suggestedValue: modeValue,
            confidence: parseFloat(confidence.toFixed(2)),
            reason: rule ? `بناءً على النمط المتكرر و ${rule.hint}` : undefined,
          });
        }
      });

      return suggestions;
    } catch {
      return [];
    }
  },

  // --- 3. ANOMALY DETECTION (Statistical + Rule Based) ---
  detectAnomalies: (category: SmartCategory, data: Record<string, unknown>): string[] => {
    const anomalies: string[] = [];
    try {
      const raw = localStorage.getItem(KEY_SMART_BEHAVIOR);
      const history: SmartBehaviorPattern[] = raw ? JSON.parse(raw) : [];

      Object.keys(data).forEach((key) => {
        const val = data[key];
        const rule = FIELD_RULES[key];

        // A. Check Rules Library (Static Validation)
        if (rule && rule.validation) {
          let failed = false;
          if (rule.validation.regex && !rule.validation.regex.test(String(val))) failed = true;
          if (rule.validation.min !== undefined && Number(val) < rule.validation.min) failed = true;
          if (rule.validation.max !== undefined && Number(val) > rule.validation.max) failed = true;

          if (failed) {
            anomalies.push(`تنبيه ذكي: القيمة في "${key}" تخالف القاعدة: ${rule.hint}`);
          }
        }

        // B. Check Statistical Deviation (Dynamic Learning)
        if (typeof val === 'number' && val > 0) {
          const previousValues = history
            .filter(
              (h): h is SmartBehaviorPattern & { value: number } =>
                h.category === category && h.field === key && typeof h.value === 'number'
            )
            .map((h) => h.value);

          if (previousValues.length > 5) {
            const sum = previousValues.reduce((a, b) => a + b, 0);
            const mean = sum / previousValues.length;

            // Heuristic: If value deviates significantly (> 2.5x mean)
            if (val > mean * 2.5) {
              anomalies.push(
                `القيمة المدخلة في "${key}" (${val}) أعلى بكثير من المعدل المعتاد (${Math.round(mean)}).`
              );
            }
          }
        }
      });

      // Specific Logic for Low Rating
      const rating = data['تقييم'];
      if (category === 'person' && typeof rating === 'number' && rating < 3) {
        anomalies.push('يتم إضافة شخص بتقييم منخفض، يرجى الحذر عند التعامل.');
      }
    } catch (e) {
      console.error('Anomaly Check Error', e);
    }
    return anomalies;
  },
};
