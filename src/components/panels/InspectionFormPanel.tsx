
import React, { useEffect, useMemo, useState } from 'react';
import { DbService } from '@/services/mockDb';
import { AttachmentManager } from '@/components/AttachmentManager';
import { PersonPicker } from '@/components/shared/PersonPicker';
import { useToast } from '@/context/ToastContext';
import { Save, Trash2, ClipboardCheck } from 'lucide-react';
import { storage } from '@/services/storage';
import { domainGetSmart } from '@/services/domainQueries';

type UnknownRecord = Record<string, unknown>;
const isRecord = (value: unknown): value is UnknownRecord => typeof value === 'object' && value !== null;
const toRecordOrNull = (value: unknown): UnknownRecord | null => (isRecord(value) ? value : null);

interface InspectionFormPanelProps {
  id?: string; // inspection id (edit)
  propertyId?: string; // used when creating a new inspection
  onClose?: () => void;
  onSuccess?: () => void;
}

export const InspectionFormPanel: React.FC<InspectionFormPanelProps> = ({ id, propertyId, onClose, onSuccess }) => {
  const toast = useToast();
  const [inspectionId, setInspectionId] = useState<string | undefined>(id);
  const [resolvedPropertyId, setResolvedPropertyId] = useState<string>(propertyId || '');

  const desktopDb = typeof window !== 'undefined' ? window.desktopDb : undefined;
  const isDesktop = storage.isDesktop() && !!desktopDb;
  const isDesktopFast = isDesktop && typeof desktopDb?.domainGet === 'function';
  const desktopUnsupported = isDesktop && !isDesktopFast;

  const [desktopProperty, setDesktopProperty] = useState<unknown>(null);

  const [form, setForm] = useState({
    inspectionDate: new Date().toISOString().slice(0, 10),
    inspectorId: '',
    clientId: '',
    isReady: true,
    notes: '',
  });

  useEffect(() => {
    if (!id) return;
    const existing = DbService.getInspection(id);
    if (!existing) return;

    setInspectionId(existing.id);
    setResolvedPropertyId(existing.propertyId);
    setForm({
      inspectionDate: existing.inspectionDate || new Date().toISOString().slice(0, 10),
      inspectorId: existing.inspectorId || '',
      clientId: existing.clientId || '',
      isReady: typeof existing.isReady === 'boolean' ? existing.isReady : true,
      notes: existing.notes || '',
    });
  }, [id]);

  useEffect(() => {
    if (!id && propertyId) setResolvedPropertyId(propertyId);
  }, [id, propertyId]);

  useEffect(() => {
    if (!isDesktopFast) return;
    let alive = true;
    const pid = String(resolvedPropertyId || '').trim();
    if (!pid) {
      setDesktopProperty(null);
      return;
    }
    void (async () => {
      try {
        const p = await domainGetSmart('properties', pid);
        if (alive) setDesktopProperty(p);
      } catch {
        if (alive) setDesktopProperty(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [isDesktopFast, resolvedPropertyId]);

  const property = useMemo(() => {
    if (!resolvedPropertyId) return null;
    if (desktopUnsupported) return null;
    if (isDesktopFast) return toRecordOrNull(desktopProperty);
    const d = DbService.getPropertyDetails(resolvedPropertyId);
    return toRecordOrNull(d?.property);
  }, [resolvedPropertyId, isDesktopFast, desktopUnsupported, desktopProperty]);

  const handleSave = () => {
    if (!resolvedPropertyId) {
      toast.warning('يجب اختيار العقار');
      return;
    }
    if (!form.inspectionDate) {
      toast.warning('تاريخ الكشف مطلوب');
      return;
    }

    if (!inspectionId) {
      const res = DbService.createInspection({
        propertyId: resolvedPropertyId,
        inspectionDate: form.inspectionDate,
        inspectorId: form.inspectorId || undefined,
        clientId: form.clientId || undefined,
        isReady: form.isReady,
        notes: form.notes || undefined,
      });

      if (!res.success) {
        toast.error(res.message || 'فشل إنشاء الكشف');
        return;
      }

      const data = (res as unknown as { data?: unknown }).data;
      const newId = isRecord(data) && typeof data.id === 'string' ? data.id : undefined;
      if (newId) setInspectionId(newId);
      toast.success(res.message || 'تم إنشاء الكشف');
      if (onSuccess) onSuccess();
      return;
    }

    const res = DbService.updateInspection(inspectionId, {
      inspectionDate: form.inspectionDate,
      inspectorId: form.inspectorId || undefined,
      clientId: form.clientId || undefined,
      isReady: form.isReady,
      notes: form.notes || undefined,
    });

    if (!res.success) {
      toast.error(res.message || 'فشل تعديل الكشف');
      return;
    }

    toast.success(res.message || 'تم حفظ الكشف');
    if (onSuccess) onSuccess();
  };

  const handleDelete = async () => {
    if (!inspectionId) return;

    const ok = await toast.confirm({
      title: 'حذف كشف',
      message: 'هل أنت متأكد من حذف هذا الكشف؟ سيتم حذف المرفقات المرتبطة به أيضاً.',
      confirmText: 'حذف',
      cancelText: 'إلغاء',
      isDangerous: true,
    });

    if (!ok) return;

    const res = DbService.deleteInspection(inspectionId);
    if (!res.success) {
      toast.error(res.message || 'فشل حذف الكشف');
      return;
    }

    toast.success(res.message || 'تم حذف الكشف');
    if (onSuccess) onSuccess();
    if (onClose) onClose();
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-800">
      <div className="p-6 bg-indigo-50 dark:bg-indigo-900/20 border-b border-indigo-100 dark:border-indigo-900">
        <h2 className="text-xl font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-2">
          <ClipboardCheck size={22} />
          {inspectionId ? 'تعديل كشف' : 'كشف جديد'}
        </h2>
        <p className="text-sm text-indigo-600/80 dark:text-indigo-200/70 mt-1">
          {property
            ? (() => {
                const internal = property['الكود_الداخلي'];
                const num = property['رقم_العقار'];
                const internalText = typeof internal === 'string' || typeof internal === 'number' ? String(internal) : '';
                const numText = typeof num === 'string' || typeof num === 'number' ? String(num) : '';
                const label = internalText || numText;
                return `العقار: ${label}`;
              })()
            : resolvedPropertyId
              ? `رقم العقار: ${resolvedPropertyId}`
              : '—'}
        </p>
      </div>

      <div className="p-6 space-y-6 flex-1">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">تاريخ الكشف <span className="text-red-500">*</span></label>
            <input
              type="date"
              value={form.inspectionDate}
              onChange={(e) => setForm({ ...form, inspectionDate: e.target.value })}
              className="w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={!!form.isReady}
                onChange={(e) => setForm({ ...form, isReady: e.target.checked })}
                className="w-4 h-4"
              />
              جاهز للعرض / جاهز للتأجير
            </label>
          </div>
        </div>

        <PersonPicker
          label="الموظف/الكاشف (اختياري)"
          value={form.inspectorId}
          onChange={(id) => setForm({ ...form, inspectorId: id || '' })}
          placeholder="اختر الموظف..."
        />

        <PersonPicker
          label="العميل المرتبط (اختياري)"
          value={form.clientId}
          onChange={(id) => setForm({ ...form, clientId: id || '' })}
          placeholder="اختر العميل..."
        />

        <div>
          <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">ملاحظات</label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="w-full h-28 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="مثال: حالة الدهان ممتازة، يحتاج صيانة بسيطة للكهرباء..."
          />
        </div>

        {inspectionId ? (
          <div className="space-y-3">
            <div className="text-sm font-bold text-slate-700 dark:text-slate-300">صور وملفات الكشف</div>
            <AttachmentManager referenceType="Inspection" referenceId={inspectionId} />
          </div>
        ) : (
          <div className="bg-yellow-50 dark:bg-yellow-900/10 p-4 rounded-xl border border-yellow-200 dark:border-yellow-800 text-sm text-yellow-800 dark:text-yellow-300">
            احفظ الكشف أولاً ثم ارفع الصور/الملفات.
          </div>
        )}
      </div>

      <div className="p-4 border-t border-gray-100 dark:border-slate-700 flex justify-end gap-3 bg-gray-50 dark:bg-slate-900/50">
        {inspectionId ? (
          <button
            type="button"
            onClick={handleDelete}
            className="px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 transition flex items-center gap-2"
          >
            <Trash2 size={16} /> حذف
          </button>
        ) : null}

        <button
          type="button"
          onClick={onClose}
          className="px-6 py-2.5 rounded-xl text-slate-600 font-bold hover:bg-gray-200 dark:hover:bg-slate-800 transition"
        >
          إغلاق
        </button>

        <button
          type="button"
          onClick={handleSave}
          className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-600/20 flex items-center gap-2"
        >
          <Save size={18} /> حفظ
        </button>
      </div>
    </div>
  );
};
