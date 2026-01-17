import React, { useEffect, useMemo, useState } from 'react';
import { DbService } from '@/services/mockDb';
import type { DynamicFormField, FieldType } from '@/types';

type DynamicValues = Record<string, unknown>;

const coerceValue = (type: FieldType, raw: unknown): string | number => {
  if (raw === undefined || raw === null) return '';
  if (type === 'number') return raw === '' ? '' : Number(raw);
  return String(raw);
};

export const DynamicFieldsSection: React.FC<{
  formId: string;
  values: DynamicValues;
  onChange: (next: DynamicValues) => void;
  title?: string;
}> = ({ formId, values, onChange, title = 'حقول إضافية' }) => {
  const [fields, setFields] = useState<DynamicFormField[]>([]);

  useEffect(() => {
    try {
      const all = DbService.getFormFields?.(formId) || [];
      setFields(Array.isArray(all) ? all : []);
    } catch {
      setFields([]);
    }
  }, [formId]);

  const sorted = useMemo(() => [...fields], [fields]);

  if (!sorted.length) return null;

  const inputClass =
    'w-full border p-3 rounded-xl bg-gray-50 dark:bg-slate-900 border-gray-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-indigo-500';

  const setValue = (name: string, nextVal: unknown) => {
    const next = { ...(values || {}) };
    next[name] = nextVal;
    onChange(next);
  };

  return (
    <div className="p-4 bg-gray-50 dark:bg-slate-900/40 rounded-xl border border-gray-200 dark:border-slate-700">
      <div className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">{title}</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sorted.map((f) => {
          const v = values?.[f.name];

          if (f.type === 'boolean') {
            return (
              <label
                key={f.id}
                className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              >
                <input
                  type="checkbox"
                  className="w-5 h-5"
                  checked={Boolean(v)}
                  onChange={(e) => setValue(f.name, e.target.checked)}
                />
                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{f.label}</span>
              </label>
            );
          }

          if (f.type === 'select') {
            const opts = Array.isArray(f.options) ? f.options : [];
            return (
              <div key={f.id}>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">{f.label}</label>
                <select
                  className="w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm outline-none"
                  value={String(v ?? '')}
                  onChange={(e) => setValue(f.name, e.target.value)}
                >
                  <option value="">—</option>
                  {opts.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </div>
            );
          }

          const inputType = f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text';

          return (
            <div key={f.id}>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">{f.label}</label>
              <input
                type={inputType}
                className={inputClass}
                value={coerceValue(f.type, v)}
                onChange={(e) => setValue(f.name, coerceValue(f.type, e.target.value))}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};
