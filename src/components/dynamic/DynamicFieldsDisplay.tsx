import React, { useEffect, useMemo, useState } from 'react';
import { DbService } from '@/services/mockDb';
import type { DynamicFormField, FieldType } from '@/types';
import { formatDynamicValue, isEmptyDynamicValue } from '@/components/dynamic/dynamicValue';

type DynamicValues = Record<string, unknown>;

type DisplayItem = {
  key: string;
  label: string;
  type?: FieldType;
  value: unknown;
};

export const DynamicFieldsDisplay: React.FC<{
  formId: string;
  values?: DynamicValues;
  title?: string;
}> = ({ formId, values, title = 'حقول إضافية' }) => {
  const [fields, setFields] = useState<DynamicFormField[]>([]);

  useEffect(() => {
    try {
      const all = DbService.getFormFields?.(formId) || [];
      setFields(Array.isArray(all) ? all : []);
    } catch {
      setFields([]);
    }
  }, [formId]);

  const items = useMemo<DisplayItem[]>(() => {
    const v = values || {};
    const byName = new Map<string, DynamicFormField>();
    (fields || []).forEach((f) => byName.set(f.name, f));

    const definedOrder = (fields || []).map((f) => f.name);
    const extraKeys = Object.keys(v).filter((k) => !byName.has(k));

    const allKeys = [...definedOrder, ...extraKeys.sort((a, b) => a.localeCompare(b))];

    return allKeys
      .map((k) => {
        const def = byName.get(k);
        return {
          key: k,
          label: def?.label || k,
          type: def?.type,
          value: v[k],
        };
      })
      .filter((it) => !isEmptyDynamicValue(it.value));
  }, [fields, values]);

  if (!items.length) return null;

  return (
    <div className="bg-gray-50 dark:bg-slate-900/40 rounded-xl border border-gray-200 dark:border-slate-700 p-4">
      <div className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">{title}</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {items.map((it) => (
          <div
            key={it.key}
            className="bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-700 p-3"
          >
            <div className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">{it.label}</div>
            <div className="text-sm font-bold text-slate-800 dark:text-white break-words whitespace-pre-wrap">
              {formatDynamicValue(it.type, it.value)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
