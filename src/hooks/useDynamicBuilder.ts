import { useMemo, useState, useEffect } from 'react';
import { DbService } from '@/services/mockDb';
import { useToast } from '@/context/ToastContext';
import { useDbSignal } from '@/hooks/useDbSignal';
import { useResponsivePageSize } from '@/hooks/useResponsivePageSize';
import type { DynamicTable, DynamicRecord, DynamicFormField, FieldType } from '@/types';

const getErrorMessage = (error: unknown): string | undefined => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return undefined;
};

export function useDynamicBuilder() {
  const toast = useToast();
  const dbSignal = useDbSignal();

  // Dynamic Tables
  const [tables, setTables] = useState<DynamicTable[]>([]);
  const [activeTable, setActiveTable] = useState<string | null>(null);
  const [records, setRecords] = useState<DynamicRecord[]>([]);

  const recordsPageSize = useResponsivePageSize({
    base: 10, sm: 12, md: 16, lg: 20, xl: 24, '2xl': 30,
  });
  const [recordsPage, setRecordsPage] = useState(1);
  const recordsPageCount = useMemo(
    () => Math.max(1, Math.ceil((records.length || 0) / recordsPageSize)),
    [records.length, recordsPageSize]
  );

  useEffect(() => {
    setRecordsPage(1);
  }, [activeTable, recordsPageSize, dbSignal]);

  useEffect(() => {
    setRecordsPage((p) => Math.min(Math.max(1, p), recordsPageCount));
  }, [recordsPageCount]);

  const visibleRecords = useMemo(() => {
    const start = (recordsPage - 1) * recordsPageSize;
    return records.slice(start, start + recordsPageSize);
  }, [records, recordsPage, recordsPageSize]);

  // Dynamic Fields for Forms
  const [activeForm, setActiveForm] = useState<string>('people');
  const [formFields, setFormFields] = useState<DynamicFormField[]>([]);
  const [newFormField, setNewFormField] = useState<{
    name: string;
    label: string;
    type: FieldType;
  }>({ name: '', label: '', type: 'text' });

  // UI states
  const [showNewTable, setShowNewTable] = useState(false);
  const [newTableName, setNewTableName] = useState('');
  const [showNewField, setShowNewField] = useState(false);
  const [newField, setNewField] = useState({ name: '', label: '', type: 'text' as FieldType });
  const [newRecordData, setNewRecordData] = useState<Record<string, unknown>>({});

  // Loading
  useEffect(() => {
    const t = DbService.getDynamicTables();
    setTables(t);
    if (t.length > 0 && (!activeTable || !t.some((x) => x.id === activeTable)))
      setActiveTable(t[0].id);
    if (t.length === 0 && activeTable) setActiveTable(null);
  }, [activeTable, dbSignal]);

  useEffect(() => {
    if (activeTable) {
      setRecords(DbService.getDynamicRecords(activeTable));
      setNewRecordData({});
    }
  }, [activeTable, dbSignal]);

  useEffect(() => {
    setFormFields(DbService.getFormFields(activeForm));
  }, [activeForm, dbSignal]);

  // Handlers
  const handleCreateTable = () => {
    if (newTableName.trim()) {
      const t = DbService.createDynamicTable(newTableName);
      setTables([...tables, t]);
      setActiveTable(t.id);
      setShowNewTable(false);
      setNewTableName('');
    } else {
      toast.warning('يرجى إدخال اسم للجدول.');
    }
  };

  const handleAddField = () => {
    if (activeTable && newField.name && newField.label) {
      try {
        DbService.addFieldToTable(activeTable, newField);
        setTables(DbService.getDynamicTables());
        setShowNewField(false);
        setNewField({ name: '', label: '', type: 'text' });
      } catch (e: unknown) {
        toast.error(getErrorMessage(e) || 'حدث خطأ أثناء إضافة الحقل');
      }
    } else {
      toast.warning('يرجى تعبئة اسم الحقل والعنوان');
    }
  };

  const handleAddRecord = () => {
    if (activeTable) {
      DbService.addDynamicRecord({
        tableId: activeTable,
        ...newRecordData,
      });
      setRecords(DbService.getDynamicRecords(activeTable));
      setNewRecordData({});
    }
  };

  const handleAddFormField = () => {
    if (!newFormField.name.trim() || !newFormField.label.trim()) {
      toast.warning('يرجى تعبئة عنوان الحقل والاسم البرمجي');
      return;
    }
    try {
      DbService.addFormField(activeForm, newFormField);
      setFormFields(DbService.getFormFields(activeForm));
      setNewFormField({ name: '', label: '', type: 'text' });
    } catch (e: unknown) {
      toast.error(getErrorMessage(e) || 'حدث خطأ أثناء إضافة الحقل');
    }
  };

  const handleDeleteFormField = async (id: string) => {
    const ok = await toast.confirm({
      title: 'حذف حقل',
      message: 'هل تريد حذف هذا الحقل؟',
      confirmText: 'حذف',
      cancelText: 'إلغاء',
      isDangerous: true,
    });
    if (!ok) return;
    DbService.deleteFormField(id);
    setFormFields(DbService.getFormFields(activeForm));
  };

  return {
    tables, activeTable, setActiveTable, records,
    recordsPage, setRecordsPage, recordsPageCount, visibleRecords,
    activeForm, setActiveForm, formFields,
    newFormField, setNewFormField,
    showNewTable, setShowNewTable, newTableName, setNewTableName,
    showNewField, setShowNewField, newField, setNewField,
    newRecordData, setNewRecordData,
    handleCreateTable, handleAddField, handleAddRecord, handleAddFormField, handleDeleteFormField,
  };
}

export type UseDynamicBuilderReturn = ReturnType<typeof useDynamicBuilder>;
