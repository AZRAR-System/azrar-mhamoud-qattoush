
import React, { useState, useEffect } from 'react';
import { DbService } from '@/services/mockDb';
import { useToast } from '@/context/ToastContext';
import { DS } from '@/constants/designSystem';
import { useDbSignal } from '@/hooks/useDbSignal';

import {
  DynamicTable,
  DynamicRecord,
  DynamicFormField,
  FieldType
} from '@/types';

import {
  Plus,
  Database,
  Table,
  Type,
  CheckCircle,
  ChevronDown,
  Trash2,
  Wrench
} from 'lucide-react';

import { DatePicker } from '@/components/ui/DatePicker';

// ---------------------------------------------------
// نماذج النظام الأساسية التي يمكن إضافة حقول لها
// ---------------------------------------------------
const SYSTEM_FORMS = [
  { id: 'people', label: 'نموذج الأشخاص' },
  { id: 'properties', label: 'نموذج العقارات' },
  { id: 'contracts', label: 'نموذج العقود' },
  { id: 'installments', label: 'نموذج الكمبيالات' },
  { id: 'maintenance', label: 'نموذج الصيانة' }
];

export const DynamicBuilder: React.FC = () => {
  const toast = useToast();
  const dbSignal = useDbSignal();
  // Dynamic Tables
  const [tables, setTables] = useState<DynamicTable[]>([]);
  const [activeTable, setActiveTable] = useState<string | null>(null);
  const [records, setRecords] = useState<DynamicRecord[]>([]);

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
  const [newRecordData, setNewRecordData] = useState<any>({});

  // ---------------------------------------------------
  // LOAD TABLES + ACTIVE TABLE
  // ---------------------------------------------------
  useEffect(() => {
    const t = DbService.getDynamicTables();
    setTables(t);
    if (t.length > 0 && (!activeTable || !t.some(x => x.id === activeTable))) setActiveTable(t[0].id);
    if (t.length === 0 && activeTable) setActiveTable(null);
  }, [activeTable, dbSignal]);

  useEffect(() => {
    if (activeTable) {
      setRecords(DbService.getDynamicRecords(activeTable));
      setNewRecordData({});
    }
  }, [activeTable, dbSignal]);

  // ---------------------------------------------------
  // LOAD FORM FIELDS
  // ---------------------------------------------------
  useEffect(() => {
    setFormFields(DbService.getFormFields(activeForm));
  }, [activeForm, dbSignal]);

  // ---------------------------------------------------
  // CREATE TABLE
  // ---------------------------------------------------
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

  // ---------------------------------------------------
  // ADD FIELD TO TABLE
  // ---------------------------------------------------
  const handleAddField = () => {
    if (activeTable && newField.name && newField.label) {
      try {
        DbService.addFieldToTable(activeTable, newField);

        setTables(DbService.getDynamicTables());
        setShowNewField(false);
        setNewField({ name: '', label: '', type: 'text' });
      } catch (e: any) {
        toast.error(e?.message || 'حدث خطأ أثناء إضافة الحقل');
      }
    } else {
      toast.warning('يرجى تعبئة اسم الحقل والعنوان');
    }
  };

  // ---------------------------------------------------
  // ADD RECORD
  // ---------------------------------------------------
  const handleAddRecord = () => {
    if (activeTable) {
      DbService.addDynamicRecord({
        tableId: activeTable,
        ...newRecordData
      });
      setRecords(DbService.getDynamicRecords(activeTable));
      setNewRecordData({});
    }
  };

  // ---------------------------------------------------
  // ADD FORM FIELD (نموذج عقد/عقار/شخص…)
  // ---------------------------------------------------
  const handleAddFormField = () => {
    if (!newFormField.name.trim() || !newFormField.label.trim()) {
      toast.warning('يرجى تعبئة عنوان الحقل والاسم البرمجي');
      return;
    }

    try {
      DbService.addFormField(activeForm, newFormField);
      setFormFields(DbService.getFormFields(activeForm));
      setNewFormField({ name: '', label: '', type: 'text' });
    } catch (e: any) {
      toast.error(e?.message || 'حدث خطأ أثناء إضافة الحقل');
    }
  };

  // ---------------------------------------------------
  // DELETE FORM FIELD
  // ---------------------------------------------------
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

  // ---------------------------------------------------
  // UI CLASSES
  // ---------------------------------------------------
  const inputClass = "w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-white rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none";
  const selectClass = "w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm rounded-lg p-2 appearance-none focus:ring-2 focus:ring-indigo-500 outline-none";


  // ###################################################
  // ###################################################
  //                     RENDER
  // ###################################################
  // ###################################################
  return (
    <div className="flex flex-col h-full animate-fade-in pb-6">
      
      {/* HEADER */}
      <div className={DS.components.pageHeader}>
        <div>
          <h2 className={`${DS.components.pageTitle} flex items-center gap-2`}>
            <Database size={22} />
            منشئ النظام المتقدم (Dynamic Engine)
          </h2>
          <p className={DS.components.pageSubtitle}>إدارة الحقول + الجداول + النماذج الديناميكية</p>
        </div>
      </div>


      <div className="flex gap-6 flex-1">

        {/* ---------------------------------- */}
        {/*       LEFT: Form Field Builder      */}
        {/* ---------------------------------- */}
        <div className="w-80 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl shadow-sm p-4">
          
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2 mb-3">
            <Wrench size={16} /> الحقول الإضافية للنماذج
          </h3>

          <div className="space-y-2 mb-4">
            {SYSTEM_FORMS.map(f => (
              <button
                key={f.id}
                onClick={() => setActiveForm(f.id)}
                className={`w-full text-right px-3 py-2 rounded-lg text-sm font-medium 
                  ${activeForm === f.id 
                    ? 'bg-indigo-600 text-white' 
                    : 'bg-gray-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600'}`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Add new form field */}
          <div className="p-3 bg-gray-50 dark:bg-slate-700/40 rounded-xl border border-gray-200 dark:border-slate-600 mb-5">
            <h4 className="text-xs text-slate-600 dark:text-slate-300 mb-2 font-bold">إضافة حقل جديد</h4>

            <input
              placeholder="عنوان الحقل"
              className={`${inputClass} mb-2`}
              value={newFormField.label}
              onChange={e => setNewFormField({ ...newFormField, label: e.target.value })}
            />

            <input
              placeholder="اسم برمجي (owner_phone)"
              className={`${inputClass} mb-2`}
              value={newFormField.name}
              onChange={e => setNewFormField({ ...newFormField, name: e.target.value.replace(/\s+/g, '_') })}
            />

            <select
              className={`${selectClass} mb-3`}
              value={newFormField.type}
              onChange={e => setNewFormField({ ...newFormField, type: e.target.value as FieldType })}
            >
              <option value="text">نص</option>
              <option value="number">رقم</option>
              <option value="date">تاريخ</option>
            </select>

            <button
              className="w-full bg-indigo-600 text-white py-1.5 rounded-lg text-sm font-bold hover:bg-indigo-700"
              onClick={handleAddFormField}
            >
              إضافة
            </button>
          </div>

          {/* List existing fields */}
          <div>
            <h4 className="font-bold text-xs text-slate-500 dark:text-slate-400 mb-2">
              الحقول المعرفة ({formFields.length})
            </h4>

            <div className="space-y-2 max-h-80 overflow-y-auto">
              {formFields.map(f => (
                <div
                  key={f.id}
                  className="p-2 bg-gray-50 dark:bg-slate-700 rounded-xl flex justify-between items-center text-sm"
                >
                  <span className="text-slate-700 dark:text-white">{f.label}</span>

                  <button
                    onClick={() => handleDeleteFormField(f.id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}

              {formFields.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-4">لا يوجد حقول إضافية</p>
              )}
            </div>
          </div>

        </div>


        {/* ---------------------------------- */}
        {/*       RIGHT: Dynamic Tables         */}
        {/* ---------------------------------- */}
        <div className="flex-1 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 flex flex-col overflow-hidden">

          {/* TABLES LIST */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50">
            <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <Table size={16} /> الجداول المخصصة
            </h3>

            <button onClick={() => setShowNewTable(true)} className="text-indigo-600 hover:bg-indigo-100 p-2 rounded-lg">
              <Plus size={18} />
            </button>
          </div>

          {/* NEW TABLE UI */}
          {showNewTable && (
            <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 border-b border-indigo-200 dark:border-indigo-800">
              <input
                className={`${inputClass} mb-2`}
                placeholder="اسم الجدول الجديد"
                value={newTableName}
                onChange={e => setNewTableName(e.target.value)}
              />

              <button
                className="w-full bg-indigo-600 text-white py-2 rounded-lg"
                onClick={handleCreateTable}
              >
                إنشاء الجدول
              </button>
            </div>
          )}

          {/* SELECT TABLE */}
          <div className="p-2 flex gap-2 overflow-x-auto">
            {tables.map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTable(t.id)}
                className={`px-4 py-2 rounded-xl text-sm font-bold 
                  ${activeTable === t.id
                    ? 'bg-indigo-600 text-white shadow'
                    : 'bg-gray-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'}`}
              >
                {t.title}
              </button>
            ))}
          </div>

          {/* TABLE CONTENT */}
          {activeTable ? (
            <>
              {/* ADD FIELD BUTTON */}
              <div className="p-4 border-b border-gray-200 dark:border-slate-700 flex justify-between items-center">
                <h4 className="font-bold text-lg">{tables.find(t => t.id === activeTable)?.title}</h4>

                <button
                  onClick={() => setShowNewField(!showNewField)}
                  className="bg-gray-100 dark:bg-slate-700 px-3 py-2 rounded-lg text-sm flex items-center gap-2"
                >
                  <Type size={16} /> إضافة حقل
                </button>
              </div>

              {/* CREATE FIELD UI */}
              {showNewField && (
                <div className="p-4 grid grid-cols-4 gap-4 border-b border-gray-200 dark:border-slate-700 bg-indigo-50/50 dark:bg-slate-900/20">

                  <input
                    className={inputClass}
                    placeholder="عنوان الحقل"
                    value={newField.label}
                    onChange={e => setNewField({ ...newField, label: e.target.value })}
                  />

                  <input
                    className={`${inputClass} font-mono`}
                    placeholder="field_name"
                    value={newField.name}
                    onChange={e => setNewField({ ...newField, name: e.target.value })}
                  />

                  <select
                    className={selectClass}
                    value={newField.type}
                    onChange={e => setNewField({ ...newField, type: e.target.value as FieldType })}
                  >
                    <option value="text">نص</option>
                    <option value="number">رقم</option>
                    <option value="date">تاريخ</option>
                  </select>

                  <button
                    onClick={handleAddField}
                    className="bg-indigo-600 text-white rounded-lg px-3 py-2 flex items-center gap-2"
                  >
                    <CheckCircle size={16} /> إضافة
                  </button>
                </div>
              )}

              {/* ADD RECORD FORM */}
              <div className="p-4">
                <h4 className="text-sm font-bold mb-3 flex items-center gap-2">
                  <Plus size={16} className="text-emerald-500" /> إضافة سجل جديد
                </h4>

                <div className="grid grid-cols-3 gap-4">
                  {tables.find(t => t.id === activeTable)?.fields.map(f => (
                    <div key={f.id}>
                      <label className="block text-xs mb-1">{f.label}</label>

                      {f.type === 'date' ? (
                        <DatePicker
                          value={newRecordData[f.name] || ''}
                          onChange={d => setNewRecordData({ ...newRecordData, [f.name]: d })}
                        />
                      ) : (
                        <input
                          type={f.type === 'number' ? 'number' : 'text'}
                          className={inputClass}
                          value={newRecordData[f.name] || ''}
                          onChange={e => setNewRecordData({ ...newRecordData, [f.name]: e.target.value })}
                        />
                      )}
                    </div>
                  ))}
                </div>

                {tables.find(t => t.id === activeTable)?.fields.length! > 0 && (
                  <button
                    onClick={handleAddRecord}
                    className="mt-4 bg-green-600 text-white px-6 py-2 rounded-xl text-sm font-bold"
                  >
                    حفظ السجل
                  </button>
                )}
              </div>

              {/* DATA TABLE */}
              <div className="flex-1 p-4 overflow-y-auto">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="bg-gray-100 text-xs">
                      {tables.find(t => t.id === activeTable)?.fields.map(f => (
                        <th key={f.id} className="p-3 border">{f.label}</th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {records.map(r => (
                      <tr key={r.id} className="border-b">
                        {tables.find(t => t.id === activeTable)?.fields.map(f => (
                          <td key={f.id} className="p-3 border">
                            {r[f.name] || '-'}
                          </td>
                        ))}
                      </tr>
                    ))}

                    {records.length === 0 && (
                      <tr>
                        <td colSpan={50} className="text-center py-6 text-gray-400">
                          لا توجد سجلات
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              اختر جدولاً أو أنشئ جدولاً جديداً
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

