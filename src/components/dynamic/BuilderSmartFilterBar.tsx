import React from 'react';
import { Database, Table, Wrench, FileText } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { SmartFilterBar } from '@/components/shared/SmartFilterBar';

interface BuilderSmartFilterBarProps {
  onAddTable: () => void;
  onAddFormField: () => void;
  tablesCount: number;
  fieldsCount: number;
  recordsCount: number;
  activeTableTitle?: string;
  activeFormLabel?: string;
}

export const BuilderSmartFilterBar: React.FC<BuilderSmartFilterBarProps> = ({
  onAddTable,
  onAddFormField,
  tablesCount,
  fieldsCount,
  recordsCount,
  activeTableTitle,
  activeFormLabel,
}) => {
  return (
    <SmartFilterBar
      actions={
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="primary"
            onClick={onAddTable}
            leftIcon={<Table size={18} />}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-6 shadow-lg shadow-indigo-500/20"
          >
            جدول مخصص جديد
          </Button>
          <Button
            variant="secondary"
            onClick={onAddFormField}
            leftIcon={<Wrench size={18} />}
            className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-black px-6"
          >
            إضافة حقل للنموذج
          </Button>
        </div>
      }
      filters={
        <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
          <Database size={18} className="text-indigo-500" />
          <p className="text-sm font-bold">
            تركيز العمل حالياً: <span className="text-slate-800 dark:text-white">{activeFormLabel || '—'}</span> (نماذج) | <span className="text-slate-800 dark:text-white">{activeTableTitle || '—'}</span> (بيانات)
          </p>
        </div>
      }
      pagination={
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/20 px-3 py-1.5 rounded-xl border border-indigo-100 dark:border-indigo-800/50">
            <Table size={14} className="text-indigo-500" />
            <span className="text-xs font-black text-indigo-700 dark:text-indigo-300">
              {tablesCount} جداول
            </span>
          </div>
          <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 px-3 py-1.5 rounded-xl border border-amber-100 dark:border-amber-800/50 text-amber-600 dark:text-amber-400">
            <Wrench size={14} />
            <span className="text-xs font-black">
              {fieldsCount} حقول
            </span>
          </div>
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
            <FileText size={14} />
            <span className="text-xs font-black">
              {recordsCount} سجلات
            </span>
          </div>
        </div>
      }
    />
  );
};
