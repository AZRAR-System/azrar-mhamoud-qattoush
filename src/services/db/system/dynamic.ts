import { get, save } from '../kv';
import { KEYS } from '../keys';
import { DynamicTable, DynamicRecord, DynamicFormField } from '@/types';

/**
 * Dynamic Tables and Forms management service
 */

export const getDynamicTables = (): DynamicTable[] => get<DynamicTable>(KEYS.DYNAMIC_TABLES);

export const createDynamicTable = (name: string): DynamicTable => {
  const id = `DT-${Date.now()}`;
  const all = get<DynamicTable>(KEYS.DYNAMIC_TABLES);
  const newT = { id, title: name, fields: [] };
  save(KEYS.DYNAMIC_TABLES, [...all, newT]);
  return newT;
};

export const getDynamicRecords = (tableId: string) =>
  get<DynamicRecord>(KEYS.DYNAMIC_RECORDS).filter((r) => r.tableId === tableId);

export const addDynamicRecord = (data: Partial<DynamicRecord>) => {
  const all = get<DynamicRecord>(KEYS.DYNAMIC_RECORDS);
  save(KEYS.DYNAMIC_RECORDS, [...all, { ...data, id: `DR-${Date.now()}` } as DynamicRecord]);
};

export const addFieldToTable = (tableId: string, field: Omit<DynamicTable['fields'][number], 'id'>) => {
  const all = get<DynamicTable>(KEYS.DYNAMIC_TABLES);
  const idx = all.findIndex((t) => t.id === tableId);
  if (idx > -1) {
    all[idx].fields.push({ ...field, id: `FLD-${Date.now()}` });
    save(KEYS.DYNAMIC_TABLES, all);
  }
};

export const getFormFields = (formId: string): DynamicFormField[] =>
  get<DynamicFormField>(KEYS.DYNAMIC_FORM_FIELDS).filter((f) => f.formId === formId);

export const addFormField = (formId: string, field: Partial<DynamicFormField>) => {
  const all = get<DynamicFormField>(KEYS.DYNAMIC_FORM_FIELDS);
  save(KEYS.DYNAMIC_FORM_FIELDS, [
    ...all,
    { ...field, formId, id: `FF-${Date.now()}` } as DynamicFormField,
  ]);
};

export const deleteFormField = (id: string) => {
  save(
    KEYS.DYNAMIC_FORM_FIELDS,
    get<DynamicFormField>(KEYS.DYNAMIC_FORM_FIELDS).filter((f) => f.id !== id)
  );
};
