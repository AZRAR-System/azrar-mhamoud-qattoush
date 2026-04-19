import { type FC } from 'react';
import { Plus, Database, Table, Type, CheckCircle, Trash2, Wrench } from 'lucide-react';
import { DatePicker } from '@/components/ui/DatePicker';
import { PaginationControls } from '@/components/shared/PaginationControls';
import { StatCard } from '@/components/shared/StatCard';
import { DS } from '@/constants/designSystem';
import type { UseDynamicBuilderReturn } from '@/hooks/useDynamicBuilder';
import type { FieldType } from '@/types';

const SYSTEM_FORMS = [
  { id: 'people', label: 'نموذج الأشخاص' },
  { id: 'properties', label: 'نموذج العقارات' },
  { id: 'contracts', label: 'نموذج العقود' },
  { id: 'installments', label: 'نموذج الكمبيالات' },
  { id: 'maintenance', label: 'نموذج الصيانة' },
];

const inputClass = 'w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-white rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none';
const selectClass = 'w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm rounded-lg p-2 appearance-none focus:ring-2 focus:ring-indigo-500 outline-none';

export const DynamicBuilderPageView: FC<{ page: UseDynamicBuilderReturn }> = ({ page }) => {
  const {
    tables, activeTable, setActiveTable, records,
    recordsPage, setRecordsPage, recordsPageCount, visibleRecords,
    activeForm, setActiveForm, formFields,
    newFormField, setNewFormField,
    showNewTable, setShowNewTable, newTableName, setNewTableName,
    showNewField, setShowNewField, newField, setNewField,
    newRecordData, setNewRecordData,
    handleCreateTable, handleAddField, handleAddRecord, handleAddFormField, handleDeleteFormField,
  } = page;

  return (
    <div className="flex flex-col h-full animate-fade-in pb-6">
      <div className={DS.components.pageHeader}>
        <div>
          <h2 className={`${DS.components.pageTitle} flex items-center gap-2 text-right`} dir="rtl">
            <Database size={22} /> منشئ النظام المتقدم (Dynamic Engine)
          </h2>
          <p className={DS.components.pageSubtitle}>إدارة الحقول + الجداول + النماذج الديناميكية</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <StatCard
          label="الجداول المخصصة"
          value={tables.length}
          icon={Database}
          color="indigo"
        />
        <StatCard
          label="الحقول الإضافية"
          value={formFields.length}
          icon={Wrench}
          color="amber"
        />
      </div>

      <div className="flex flex-col lg:flex-row gap-6 flex-1" dir="rtl">
        <div className="w-full lg:w-80 app-card p-4">
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2 mb-3">
            <Wrench size={16} /> الحقول الإضافية للنماذج
          </h3>

          <div className="space-y-2 mb-4">
            {SYSTEM_FORMS.map((f) => (
              <button
                key={f.id}
                onClick={() => setActiveForm(f.id)}
                className={`w-full text-right px-3 py-2 rounded-lg text-sm font-medium ${activeForm === f.id ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600'}`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="p-3 bg-gray-50 dark:bg-slate-700/40 rounded-xl border border-gray-200 dark:border-slate-600 mb-5">
            <h4 className="text-xs text-slate-600 dark:text-slate-300 mb-2 font-bold">إضافة حقل جديد</h4>
            <input placeholder="عنوان الحقل" className={`${inputClass} mb-2`} value={newFormField.label} onChange={(e) => setNewFormField({ ...newFormField, label: e.target.value })} />
            <input placeholder="اسم برمجي (owner_phone)" className={`${inputClass} mb-2`} value={newFormField.name} onChange={(e) => setNewFormField({ ...newFormField, name: e.target.value.replace(/\s+/g, '_') })} />
            <select className={`${selectClass} mb-3`} value={newFormField.type} onChange={(e) => setNewFormField({ ...newFormField, type: e.target.value as FieldType })}>
              <option value="text">نص</option>
              <option value="number">رقم</option>
              <option value="date">تاريخ</option>
            </select>
            <button className="w-full bg-indigo-600 text-white py-1.5 rounded-lg text-sm font-bold hover:bg-indigo-700" onClick={handleAddFormField}>إضافة</button>
          </div>

          <div>
            <h4 className="font-bold text-xs text-slate-500 dark:text-slate-400 mb-2">الحقول المعرفة ({formFields.length})</h4>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {formFields.map((f) => (
                <div key={f.id} className="p-2 bg-gray-50 dark:bg-slate-700 rounded-xl flex justify-between items-center text-sm">
                  <span className="text-slate-700 dark:text-white">{f.label}</span>
                  <button onClick={() => handleDeleteFormField(f.id)} className="text-red-500 hover:text-red-700"><Trash2 size={16} /></button>
                </div>
              ))}
              {formFields.length === 0 && <p className="text-xs text-gray-400 text-center py-4">لا يوجد حقول إضافية</p>}
            </div>
          </div>
        </div>

        <div className="flex-1 app-card flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50">
            <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <Table size={16} /> الجداول المخصصة
            </h3>
            <button onClick={() => setShowNewTable(true)} className="text-indigo-600 hover:bg-indigo-100 p-2 rounded-lg"><Plus size={18} /></button>
          </div>

          {showNewTable && (
            <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 border-b border-indigo-200 dark:border-indigo-800">
              <input className={`${inputClass} mb-2`} placeholder="اسم الجدول الجديد" value={newTableName} onChange={(e) => setNewTableName(e.target.value)} />
              <button className="w-full bg-indigo-600 text-white py-2 rounded-lg" onClick={handleCreateTable}>إنشاء الجدول</button>
            </div>
          )}

          <div className="p-2 flex gap-2 overflow-x-auto">
            {tables.map((t) => (
              <button key={t.id} onClick={() => setActiveTable(t.id)} className={`px-4 py-2 rounded-xl text-sm font-bold ${activeTable === t.id ? 'bg-indigo-600 text-white shadow' : 'bg-gray-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'}`}>
                {t.title}
              </button>
            ))}
          </div>

          {activeTable ? (
            <>
              <div className="p-4 border-b border-gray-200 dark:border-slate-700 flex justify-between items-center">
                <h4 className="font-bold text-lg">{tables.find((t) => t.id === activeTable)?.title}</h4>
                <button onClick={() => setShowNewField(!showNewField)} className="bg-gray-100 dark:bg-slate-700 px-3 py-2 rounded-lg text-sm flex items-center gap-2">
                  <Type size={16} /> إضافة حقل
                </button>
              </div>

              {showNewField && (
                <div className="p-4 grid grid-cols-4 gap-4 border-b border-gray-200 dark:border-slate-700 bg-indigo-50/50 dark:bg-slate-900/20">
                  <input className={inputClass} placeholder="عنوان الحقل" value={newField.label} onChange={(e) => setNewField({ ...newField, label: e.target.value })} />
                  <input className={`${inputClass} font-mono`} placeholder="field_name" value={newField.name} onChange={(e) => setNewField({ ...newField, name: e.target.value })} />
                  <select className={selectClass} value={newField.type} onChange={(e) => setNewField({ ...newField, type: e.target.value as FieldType })}>
                    <option value="text">نص</option>
                    <option value="number">رقم</option>
                    <option value="date">تاريخ</option>
                  </select>
                  <button onClick={handleAddField} className="bg-indigo-600 text-white rounded-lg px-3 py-2 flex items-center gap-2"><CheckCircle size={16} /> إضافة</button>
                </div>
              )}

              <div className="p-4">
                <h4 className="text-sm font-bold mb-3 flex items-center gap-2"><Plus size={16} className="text-emerald-500" /> إضافة سجل جديد</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 text-right">
                  {tables.find((t) => t.id === activeTable)?.fields.map((f) => {
                    const currentValue = newRecordData[f.name];
                    const inputValue = typeof currentValue === 'string' || typeof currentValue === 'number' ? String(currentValue) : '';
                    return (
                      <div key={f.id}>
                        <label className="block text-xs mb-1">{f.label}</label>
                        {f.type === 'date' ? (
                          <DatePicker value={typeof currentValue === 'string' ? currentValue : undefined} onChange={(d) => setNewRecordData({ ...newRecordData, [f.name]: d })} />
                        ) : (
                          <input type={f.type === 'number' ? 'number' : 'text'} className={inputClass} value={inputValue} onChange={(e) => setNewRecordData({ ...newRecordData, [f.name]: e.target.value })} />
                        )}
                      </div>
                    );
                  })}
                </div>
                {(tables.find((t) => t.id === activeTable)?.fields.length ?? 0) > 0 && (
                  <button onClick={handleAddRecord} className="mt-4 bg-green-600 text-white px-6 py-2 rounded-xl text-sm font-bold">حفظ السجل</button>
                )}
              </div>

              <div className="flex-1 p-4 overflow-y-auto">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="text-xs text-slate-600 dark:text-slate-400">الإجمالي: {records.length.toLocaleString()} سجل</div>
                  <PaginationControls page={recordsPage} pageCount={recordsPageCount} onPageChange={setRecordsPage} />
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-right border-collapse min-w-[600px]">
                    <thead>
                      <tr className="bg-gray-100 dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-200">
                        {tables.find((t) => t.id === activeTable)?.fields.map((f) => <th key={f.id} className="p-3 border border-slate-200 dark:border-slate-700">{f.label}</th>)}
                      </tr>
                    </thead>
                    <tbody className="text-slate-700 dark:text-slate-300">
                      {visibleRecords.map((r) => (
                        <tr key={r.id} className="border-b transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          {tables.find((t) => t.id === activeTable)?.fields.map((f) => (
                            <td key={f.id} className="p-3 border border-slate-200 dark:border-slate-700">{r[f.name] ? String(r[f.name]) : '-'}</td>
                          ))}
                        </tr>
                      ))}
                      {records.length === 0 && <tr><td colSpan={50} className="text-center py-6 text-gray-400">لا توجد سجلات</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400">اختر جدولاً أو أنشئ جدولاً جديداً</div>
          )}
        </div>
      </div>
    </div>
  );
};
