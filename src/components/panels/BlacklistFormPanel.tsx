
import React, { useState, useEffect } from 'react';
import { DbService } from '@/services/mockDb';
import { useToast } from '@/context/ToastContext';
import { ShieldAlert, AlertTriangle, Save } from 'lucide-react';
import { storage } from '@/services/storage';
import { domainGetSmart } from '@/services/domainQueries';

type UnknownRecord = Record<string, unknown>;
const isRecord = (value: unknown): value is UnknownRecord => typeof value === 'object' && value !== null;
const toRecordOrNull = (value: unknown): UnknownRecord | null => (isRecord(value) ? value : null);

const SEVERITIES = ['Low', 'Medium', 'High', 'Critical'] as const;
type Severity = (typeof SEVERITIES)[number];

interface BlacklistFormProps {
  id: string; // If mode is 'create', this is personId. If 'edit', this is blacklistRecordId.
  mode?: 'create' | 'edit';
  onClose?: () => void;
  onSuccess?: () => void;
}

export const BlacklistFormPanel: React.FC<BlacklistFormProps> = ({ id, mode = 'create', onClose, onSuccess }) => {
    const [person, setPerson] = useState<UnknownRecord | null>(null);
  const [formData, setFormData] = useState({
    reason: '',
        severity: 'Medium' as Severity
  });
  const toast = useToast();

        const desktopDb = typeof window !== 'undefined' ? window.desktopDb : undefined;
        const isDesktop = storage.isDesktop() && !!desktopDb;
        const isDesktopFast = isDesktop && typeof desktopDb?.domainGet === 'function';
    const desktopUnsupported = isDesktop && !isDesktopFast;

  useEffect(() => {
    if (desktopUnsupported) return;
    if (mode === 'create') {
        if (isDesktopFast) {
            void (async () => {
                try {
                    const p = await domainGetSmart('people', id);
                    setPerson(toRecordOrNull(p));
                } catch {
                    setPerson(null);
                }
            })();
        } else {
            const p = DbService.getPersonDetails(id);
            if (p) setPerson(toRecordOrNull(p.person));
        }
    } else {
        // Edit Mode: Fetch Record then Person
        const record = DbService.getBlacklistRecord(id);
        if (record) {
            setFormData({ reason: record.reason, severity: record.severity });
            if (isDesktopFast) {
                void (async () => {
                    try {
                        const p = await domainGetSmart('people', record.personId);
                        setPerson(toRecordOrNull(p));
                    } catch {
                        setPerson(null);
                    }
                })();
            } else {
                const p = DbService.getPersonDetails(record.personId);
                if (p) setPerson(toRecordOrNull(p.person));
            }
        }
    }
  }, [id, mode, isDesktopFast, desktopUnsupported]);

  if (desktopUnsupported) {
      return (
          <div className="p-10 text-center text-slate-600 dark:text-slate-300">
              <div className="mx-auto mb-3 w-12 h-12 rounded-full bg-yellow-100 dark:bg-yellow-900/20 flex items-center justify-center">
                  <ShieldAlert className="w-6 h-6 text-yellow-700 dark:text-yellow-300" />
              </div>
              <div className="font-bold">غير مدعوم في وضع الديسكتوب الحالي</div>
              <div className="text-sm mt-2">هذه الشاشة تحتاج وضع السرعة/SQL في نسخة الديسكتوب.</div>
          </div>
      );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if(!formData.reason) return toast.warning('يجب ذكر سبب الإضافة للقائمة السوداء');

    if (mode === 'create') {
        DbService.addToBlacklist({
            personId: id,
            reason: formData.reason,
            severity: formData.severity
        });
        toast.error('تمت إضافة الشخص للقائمة السوداء');
    } else {
        DbService.updateBlacklistRecord(id, {
            reason: formData.reason,
            severity: formData.severity
        });
        toast.success('تم تحديث سجل القائمة السوداء');
    }

    if (onSuccess) onSuccess();
    if (onClose) onClose();
  };

  if (!person) return <div className="p-10 text-center">جاري التحميل...</div>;

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-800">
        <div className="p-6 bg-red-50 dark:bg-red-900/20 border-b border-red-100 dark:border-red-900">
            <h2 className="text-xl font-bold text-red-700 dark:text-red-400 flex items-center gap-2">
                <ShieldAlert size={24} /> {mode === 'create' ? 'إضافة للقائمة السوداء' : 'تعديل سجل الحظر'}
            </h2>
            <p className="text-sm text-red-600/80 mt-1">
                {mode === 'create'
                    ? `إضافة "${String(person['الاسم'])}" للقائمة السوداء سيؤدي لظهور تحذيرات.`
                    : `تعديل تفاصيل حظر "${String(person['الاسم'])}".`}
            </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 flex-1">
            <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">درجة الخطورة</label>
                <div className="grid grid-cols-4 gap-2">
                    {SEVERITIES.map((sev) => (
                        <button
                            key={sev}
                            type="button"
                            onClick={() => setFormData({ ...formData, severity: sev })}
                            className={`py-2 rounded-lg text-xs font-bold border transition
                                ${formData.severity === sev 
                                    ? 'bg-red-600 text-white border-red-600 shadow-md' 
                                    : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-gray-200 dark:border-slate-600 hover:bg-red-50'}
                            `}
                        >
                            {sev === 'Low' && 'منخفضة'}
                            {sev === 'Medium' && 'متوسطة'}
                            {sev === 'High' && 'عالية'}
                            {sev === 'Critical' && 'حرجة'}
                        </button>
                    ))}
                </div>
            </div>

            <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">سبب الحظر / المشكلة <span className="text-red-500">*</span></label>
                <textarea 
                    required
                    className="w-full h-32 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-xl p-3 outline-none focus:ring-2 focus:ring-red-500"
                    placeholder="مثال: تأخير مستمر في الدفعات، أضرار في العقار، مشاكل قانونية..."
                    value={formData.reason}
                    onChange={e => setFormData({...formData, reason: e.target.value})}
                />
            </div>

            <div className="bg-yellow-50 dark:bg-yellow-900/10 p-4 rounded-xl flex gap-3 text-yellow-800 dark:text-yellow-300 text-sm">
                <AlertTriangle className="flex-shrink-0" size={20} />
                <p>سيتم منع إتمام أي عقود جديدة لهذا الشخص إلا بموافقة إدارية خاصة.</p>
            </div>
        </form>

        <div className="p-4 border-t border-gray-100 dark:border-slate-700 flex justify-end gap-3 bg-gray-50 dark:bg-slate-900/50">
            <button type="button" onClick={onClose} className="px-6 py-2.5 rounded-xl text-slate-600 font-bold hover:bg-gray-200 transition">إلغاء</button>
            <button onClick={handleSubmit} className="px-6 py-2.5 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 shadow-lg shadow-red-600/20 flex items-center gap-2">
                <Save size={18} /> {mode === 'create' ? 'تأكيد الحظر' : 'حفظ التعديلات'}
            </button>
        </div>
    </div>
  );
};
