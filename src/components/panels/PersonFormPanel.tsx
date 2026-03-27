import React, { useEffect, useRef, useState } from 'react';
import { DbService } from '@/services/mockDb';
import type { الأشخاص_tbl, SystemLookup, SmartSuggestion } from '@/types';
import { useToast } from '@/context/ToastContext';
import { User, Plus, FilterX, Check } from 'lucide-react';
import { SmartEngine } from '@/services/smartEngine';
import { SmartAssistant } from '@/components/smart/SmartAssistant';
import { DynamicFieldsSection } from '@/components/dynamic/DynamicFieldsSection';

interface PersonFormProps {
  id?: string; // If ID exists, it's Edit mode
  onClose?: () => void;
  onSuccess?: () => void;
  initialType?: 'فرد' | 'منشأة';
}

export const PersonFormPanel: React.FC<PersonFormProps> = ({
  id,
  onClose,
  onSuccess,
  initialType,
}) => {
  const [formData, setFormData] = useState({
    الاسم: '',
    الرقم_الوطني: '',
    رقم_الهاتف: '',
    رقم_هاتف_اضافي: '',
    العنوان: '',
    ملاحظات: '',
    نوع_الملف: 'فرد' as 'فرد' | 'منشأة',
    طبيعة_الشركة: '',
    selectedRoles: new Set<string>(['مستأجر']),
  });

  const [availableRoles, setAvailableRoles] = useState<SystemLookup[]>([]);
  const [availableCompanyNatures, setAvailableCompanyNatures] = useState<SystemLookup[]>([]);
  const [dynamicValues, setDynamicValues] = useState<Record<string, unknown>>({});
  const [isAddingRole, setIsAddingRole] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [isAddingNature, setIsAddingNature] = useState(false);
  const [newNatureName, setNewNatureName] = useState('');
  const [suggestions, setSuggestions] = useState<SmartSuggestion[]>([]);
  const toast = useToast();

  // Keep initial defaults stable for "new" suggestions.
  const initialFormDataRef = useRef(formData);

  useEffect(() => {
    setAvailableRoles(DbService.getLookupsByCategory('person_roles') || []);
    setAvailableCompanyNatures(DbService.getLookupsByCategory('company_nature') || []);

    if (id && id !== 'new') {
      const person = (DbService.getPeople() as الأشخاص_tbl[]).find((p) => p.رقم_الشخص === id);
      if (person) {
        const roles = DbService.getPersonRoles(person.رقم_الشخص);
        setFormData({
          الاسم: person.الاسم,
          الرقم_الوطني: person.الرقم_الوطني || '',
          رقم_الهاتف: person.رقم_الهاتف,
          رقم_هاتف_اضافي: person.رقم_هاتف_اضافي || '',
          العنوان: person.العنوان || '',
          ملاحظات: person.ملاحظات || '',
          نوع_الملف: person.نوع_الملف || (person.طبيعة_الشركة ? 'منشأة' : 'فرد'),
          طبيعة_الشركة: person.طبيعة_الشركة || '',
          selectedRoles: new Set(roles),
        });
        setDynamicValues(person.حقول_ديناميكية || {});
      }
    } else {
      setDynamicValues({});
      if (initialType) {
        setFormData((prev) => ({
          ...prev,
          نوع_الملف: initialType,
          طبيعة_الشركة: initialType === 'منشأة' ? prev.طبيعة_الشركة : '',
        }));
      }
      // Run smart prediction for new person
      const recs = SmartEngine.predict('person', initialFormDataRef.current);
      setSuggestions(recs);
    }
  }, [id, initialType]);

  const applySuggestions = (recs: SmartSuggestion[]) => {
    const newValues: Record<string, unknown> = {};
    recs.forEach((s) => {
      newValues[s.field] = s.suggestedValue;
    });
    setFormData((prev) => ({ ...prev, ...newValues }));
    setSuggestions([]); // Dismiss
    toast.success('تم تعبئة البيانات تلقائياً');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const rolesArray = Array.from(formData.selectedRoles);

    if (rolesArray.length === 0) return toast.warning('يجب اختيار دور واحد على الأقل');

    const payload = {
      الاسم: formData.الاسم,
      الرقم_الوطني: formData.الرقم_الوطني,
      رقم_الهاتف: formData.رقم_الهاتف,
      رقم_هاتف_اضافي: formData.رقم_هاتف_اضافي?.trim() ? formData.رقم_هاتف_اضافي : undefined,
      رقم_نوع_الشخص: rolesArray[0] as string,
      العنوان: formData.العنوان,
      ملاحظات: formData.ملاحظات,
      نوع_الملف: formData.نوع_الملف,
      طبيعة_الشركة: formData.نوع_الملف === 'منشأة' ? formData.طبيعة_الشركة || undefined : undefined,
      حقول_ديناميكية: Object.keys(dynamicValues || {}).length ? dynamicValues : undefined,
    };

    let res;
    if (id && id !== 'new') {
      res = DbService.updatePerson(id, payload);
      if (res.success) {
        DbService.updatePersonRoles(id, rolesArray);
      }
    } else {
      res = DbService.addPerson(payload, rolesArray);
    }

    if (res.success) {
      toast.success(res.message);
      if (onClose) onClose();
      if (onSuccess) onSuccess();
    } else {
      toast.error(res.message);
    }
  };

  const toggleRole = (role: string) => {
    const newSet = new Set(formData.selectedRoles);
    if (newSet.has(role)) {
      newSet.delete(role);
    } else {
      newSet.add(role);
    }
    setFormData({ ...formData, selectedRoles: newSet });
  };

  const handleAddNewRole = () => {
    if (!newRoleName.trim()) return;
    DbService.addLookup('person_roles', newRoleName.trim());
    setAvailableRoles(DbService.getLookupsByCategory('person_roles'));
    const newSet = new Set(formData.selectedRoles);
    newSet.add(newRoleName.trim());
    setFormData({ ...formData, selectedRoles: newSet });
    setNewRoleName('');
    setIsAddingRole(false);
  };

  const handleAddNewNature = () => {
    if (!newNatureName.trim()) return;
    DbService.addLookup('company_nature', newNatureName.trim());
    setAvailableCompanyNatures(DbService.getLookupsByCategory('company_nature'));
    setFormData({ ...formData, طبيعة_الشركة: newNatureName.trim() });
    setNewNatureName('');
    setIsAddingNature(false);
  };

  return (
    <div className="p-6 h-full flex flex-col">
      <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
        <User className="text-indigo-600" />
        {id && id !== 'new'
          ? formData.نوع_الملف === 'منشأة'
            ? 'تعديل بيانات المنشأة'
            : 'تعديل بيانات الملف'
          : formData.نوع_الملف === 'منشأة'
            ? 'إضافة منشأة جديدة'
            : 'إضافة ملف جديد'}
      </h2>

      <form onSubmit={handleSubmit} className="space-y-5 flex-1 overflow-y-auto">
        <SmartAssistant
          suggestions={suggestions}
          onAccept={applySuggestions}
          onDismiss={() => setSuggestions([])}
        />

        <div className="p-4 bg-gray-50 dark:bg-slate-900/40 rounded-xl border border-gray-200 dark:border-slate-700">
          <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
            نوع الملف
          </label>
          <div className="flex bg-gray-100 dark:bg-slate-900 p-1 rounded-xl w-full overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() =>
                setFormData((prev) => ({ ...prev, نوع_الملف: 'فرد', طبيعة_الشركة: '' }))
              }
              className={`flex-1 px-4 py-2 rounded-lg text-sm font-bold transition whitespace-nowrap ${formData.نوع_الملف === 'فرد' ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              فرد
            </button>
            <button
              type="button"
              onClick={() => setFormData((prev) => ({ ...prev, نوع_الملف: 'منشأة' }))}
              className={`flex-1 px-4 py-2 rounded-lg text-sm font-bold transition whitespace-nowrap ${formData.نوع_الملف === 'منشأة' ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              منشأة
            </button>
          </div>
        </div>

        <div>
          <label
            htmlFor="personForm_name"
            className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1"
          >
            {formData.نوع_الملف === 'منشأة' ? 'اسم المنشأة' : 'الاسم الكامل'}{' '}
            <span className="text-red-500">*</span>
          </label>
          <input
            id="personForm_name"
            required
            className="w-full border p-3 rounded-xl bg-gray-50 dark:bg-slate-900 border-gray-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
            value={formData.الاسم}
            onChange={(e) => setFormData({ ...formData, الاسم: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label
              htmlFor="personForm_phone"
              className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1"
            >
              رقم الهاتف <span className="text-red-500">*</span>
            </label>
            <input
              id="personForm_phone"
              required
              className="w-full border p-3 rounded-xl bg-gray-50 dark:bg-slate-900 border-gray-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
              value={formData.رقم_الهاتف}
              onChange={(e) => setFormData({ ...formData, رقم_الهاتف: e.target.value })}
            />
          </div>
          <div>
            <label
              htmlFor="personForm_phone2"
              className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1"
            >
              رقم هاتف إضافي <span className="text-slate-400">(اختياري)</span>
            </label>
            <input
              id="personForm_phone2"
              className="w-full border p-3 rounded-xl bg-gray-50 dark:bg-slate-900 border-gray-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
              value={formData.رقم_هاتف_اضافي}
              onChange={(e) => setFormData({ ...formData, رقم_هاتف_اضافي: e.target.value })}
            />
          </div>
          <div>
            <label
              htmlFor="personForm_nationalId"
              className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1"
            >
              {formData.نوع_الملف === 'منشأة' ? 'الرقم الوطني للمنشأة' : 'الرقم الوطني'}
            </label>
            <input
              id="personForm_nationalId"
              className="w-full border p-3 rounded-xl bg-gray-50 dark:bg-slate-900 border-gray-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
              value={formData.الرقم_الوطني}
              onChange={(e) => setFormData({ ...formData, الرقم_الوطني: e.target.value })}
            />
          </div>
        </div>

        {formData.نوع_الملف === 'منشأة' && (
          <div className="p-4 bg-gray-50 dark:bg-slate-900/40 rounded-xl border border-gray-200 dark:border-slate-700">
            <div className="flex justify-between items-center mb-3">
              <label
                htmlFor="personForm_companyNature"
                className="text-sm font-bold text-slate-700 dark:text-slate-300"
              >
                طبيعة المنشأة
              </label>
              <button
                type="button"
                onClick={() => setIsAddingNature(true)}
                className="text-xs bg-white dark:bg-slate-800 px-2 py-1 rounded shadow-sm text-indigo-600 hover:text-indigo-700"
              >
                <Plus size={12} className="inline mr-1" /> جديد
              </button>
            </div>

            {isAddingNature && (
              <div className="flex gap-2 mb-3">
                <input
                  id="personForm_newCompanyNature"
                  className="flex-1 text-sm p-1.5 rounded border"
                  placeholder="طبيعة المنشأة..."
                  title="طبيعة المنشأة"
                  aria-label="طبيعة المنشأة"
                  value={newNatureName}
                  onChange={(e) => setNewNatureName(e.target.value)}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleAddNewNature}
                  className="bg-green-500 text-white p-1 rounded"
                  aria-label="حفظ طبيعة المنشأة"
                  title="حفظ طبيعة المنشأة"
                >
                  <Check size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddingNature(false)}
                  className="bg-gray-300 text-gray-700 p-1 rounded"
                  aria-label="إلغاء إضافة طبيعة المنشأة"
                  title="إلغاء إضافة طبيعة المنشأة"
                >
                  <FilterX size={16} />
                </button>
              </div>
            )}

            <select
              id="personForm_companyNature"
              className="w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm outline-none"
              value={formData.طبيعة_الشركة}
              onChange={(e) => setFormData({ ...formData, طبيعة_الشركة: e.target.value })}
              title="طبيعة المنشأة"
              aria-label="طبيعة المنشأة"
            >
              <option value="">—</option>
              {availableCompanyNatures.map((n) => (
                <option key={n.id} value={n.label}>
                  {n.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="p-4 bg-indigo-50 dark:bg-indigo-900/10 rounded-xl border border-indigo-100 dark:border-indigo-800">
          <div className="flex justify-between items-center mb-3">
            <label className="text-sm font-bold text-indigo-800 dark:text-indigo-300">
              تصنيف الأدوار
            </label>
            <button
              type="button"
              onClick={() => setIsAddingRole(true)}
              className="text-xs bg-white dark:bg-slate-800 px-2 py-1 rounded shadow-sm text-indigo-600 hover:text-indigo-700"
            >
              <Plus size={12} className="inline mr-1" /> جديد
            </button>
          </div>

          {isAddingRole && (
            <div className="flex gap-2 mb-3">
              <input
                id="personForm_newRole"
                className="flex-1 text-sm p-1.5 rounded border"
                placeholder="اسم الدور..."
                title="اسم الدور"
                aria-label="اسم الدور"
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                autoFocus
              />
              <button
                type="button"
                onClick={handleAddNewRole}
                className="bg-green-500 text-white p-1 rounded"
                aria-label="حفظ الدور"
                title="حفظ الدور"
              >
                <Check size={16} />
              </button>
              <button
                type="button"
                onClick={() => setIsAddingRole(false)}
                className="bg-gray-300 text-gray-700 p-1 rounded"
                aria-label="إلغاء إضافة دور"
                title="إلغاء إضافة دور"
              >
                <FilterX size={16} />
              </button>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {availableRoles.map((r) => (
              <label
                key={r.id}
                className={`cursor-pointer px-3 py-1.5 rounded-lg text-sm border transition select-none flex items-center gap-2
                            ${formData.selectedRoles.has(r.label) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-gray-200 dark:border-slate-700'}
                        `}
              >
                <input
                  type="checkbox"
                  className="hidden"
                  checked={formData.selectedRoles.has(r.label)}
                  onChange={() => toggleRole(r.label)}
                />
                {r.label}
              </label>
            ))}
          </div>
        </div>

        <div>
          <label
            htmlFor="personForm_address"
            className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1"
          >
            العنوان
          </label>
          <input
            id="personForm_address"
            className="w-full border p-3 rounded-xl bg-gray-50 dark:bg-slate-900 border-gray-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
            value={formData.العنوان}
            onChange={(e) => setFormData({ ...formData, العنوان: e.target.value })}
          />
        </div>

        <div>
          <label
            htmlFor="personForm_notes"
            className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1"
          >
            ملاحظات
          </label>
          <textarea
            id="personForm_notes"
            className="w-full border p-3 rounded-xl bg-gray-50 dark:bg-slate-900 border-gray-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 h-24"
            value={formData.ملاحظات}
            onChange={(e) => setFormData({ ...formData, ملاحظات: e.target.value })}
          />
        </div>

        <DynamicFieldsSection formId="people" values={dynamicValues} onChange={setDynamicValues} />

        <div className="pt-4 flex gap-3 border-t border-gray-100 dark:border-slate-700">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 text-slate-500 font-bold hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition"
          >
            إلغاء
          </button>
          <button
            type="submit"
            className="flex-[2] py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-600/20 transition"
          >
            حفظ البيانات
          </button>
        </div>
      </form>
    </div>
  );
};
