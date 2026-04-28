import { useEffect, useMemo, useState } from 'react';
import { DbService, type NotificationSendLogRecord } from '@/services/mockDb';
import { useSmartModal } from '@/context/ModalContext';
import { ROUTE_PATHS } from '@/routes/paths';
import { getInstallmentPaidAndRemaining } from '@/utils/installments';
import { useAppDialogs } from '@/hooks/useAppDialogs';
import type { الكمبيالات_tbl } from '@/types';

interface Props {
  maxItems?: number;
  title?: string;
  className?: string;
}

export const PaymentCollectionSendLog: React.FC<Props> = ({ maxItems = 5, title, className }) => {
  const { openPanel } = useSmartModal();
  const dialogs = useAppDialogs();
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const bump = () => setRefreshKey((k) => k + 1);
    const storageHandler = (e: StorageEvent) => {
      if (!e.key) return;
      if (String(e.key).startsWith('db_')) bump();
    };

    window.addEventListener('focus', bump);
    window.addEventListener('storage', storageHandler);
    window.addEventListener('azrar:installments-changed', bump);
    window.addEventListener('azrar:tasks-changed', bump);

    return () => {
      window.removeEventListener('focus', bump);
      window.removeEventListener('storage', storageHandler);
      window.removeEventListener('azrar:installments-changed', bump);
      window.removeEventListener('azrar:tasks-changed', bump);
    };
  }, []);

  const lastSent = useMemo(() => {
    void refreshKey;

    const installments = DbService.getInstallments?.() || [];
    const installmentById = new Map<string, الكمبيالات_tbl>();
    for (const inst of installments) installmentById.set(String(inst.رقم_الكمبيالة), inst);

    const sentLogs = (DbService.getNotificationSendLogs?.() || [])
      .filter((l) => l.category === 'installment_reminder')
      // Show only reminders that are still relevant (at least one installment remains unpaid).
      .filter((l) => {
        const ids: string[] = Array.isArray(l.installmentIds) ? l.installmentIds : [];
        if (ids.length === 0) return true;
        for (const id of ids) {
          const inst = installmentById.get(String(id));
          if (!inst) return true;
          const status = String(inst.حالة_الكمبيالة ?? '').trim();
          if (status === 'ملغي') continue;
          if (inst.isArchived === true) continue;
          const { remaining } = getInstallmentPaidAndRemaining(inst);
          if (remaining > 0) return true;
        }
        return false;
      });

    // Defensive: dedupe by id in case legacy/duplicate data exists.
    const byId = new Map<string, NotificationSendLogRecord>();
    for (const l of sentLogs) {
      const id = String(l?.id || '').trim();
      if (!id) continue;
      if (!byId.has(id)) byId.set(id, l);
    }

    const unique = Array.from(byId.values());
    unique.sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());

    return unique.slice(0, maxItems);
  }, [maxItems, refreshKey]);

  const openEditLog = (logId: string, field: 'note' | 'reply', currentValue?: string) => {
    openPanel('SMART_PROMPT', `edit_${field}_${logId}`, {
      title: field === 'note' ? 'إضافة ملاحظة على الإشعار' : 'تسجيل رد المستأجر',
      message:
        field === 'note'
          ? 'هذه الملاحظة داخلية (لا تُرسل للمستأجر).'
          : 'سجّل هنا رد المستأجر أو نتيجة التواصل.',
      inputType: 'textarea',
      defaultValue: currentValue || '',
      required: false,
      onConfirm: (val: string) => {
        DbService.updateNotificationSendLog(logId, { [field]: val });
        setRefreshKey((k) => k + 1);
      },
    });
  };

  const handleDeleteLog = async (logId: string) => {
    const ok = await dialogs.confirm({
      title: 'حذف السجل',
      message: 'هل تريد حذف هذا السجل من سجل إشعارات التحصيل؟',
      confirmText: 'حذف',
      cancelText: 'إلغاء',
      isDangerous: true,
    });
    if (!ok) return;
    DbService.deleteNotificationSendLog?.(logId);
    setRefreshKey((k) => k + 1);
  };

  return (
    <div className={className}>
      <div className="p-4 flex items-center justify-between">
        <div className="text-sm font-bold text-slate-700 dark:text-slate-200">
          {title || `سجل إشعارات التحصيل (آخر ${lastSent.length})`}
        </div>
        <button
          onClick={() =>
            openPanel('SECTION_VIEW', ROUTE_PATHS.INSTALLMENTS, { title: 'لوحة السداد الرئيسية' })
          }
          className="text-xs font-bold text-indigo-600 hover:underline"
        >
          فتح لوحة السداد الرئيسية
        </button>
      </div>

      {lastSent.length === 0 ? (
        <div className="px-4 pb-4 text-sm text-slate-500 dark:text-slate-400">
          لا يوجد سجل إرسال بعد.
        </div>
      ) : (
        <div className="px-4 pb-4 space-y-2">
          {lastSent.map((l) => (
            <div
              key={l.id}
              className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 flex items-start justify-between gap-3"
            >
              <div>
                <div className="font-bold text-slate-800 dark:text-white text-sm">
                  {l.tenantName}
                  {l.propertyCode ? ` • ${l.propertyCode}` : ''}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400" dir="ltr">
                  {new Date(l.sentAt).toLocaleString('en-GB')}
                </div>
                {(l.note || l.reply) && (
                  <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                    {l.note ? `ملاحظة: ${String(l.note).slice(0, 60)}` : ''}
                    {l.note && l.reply ? ' • ' : ''}
                    {l.reply ? `رد: ${String(l.reply).slice(0, 60)}` : ''}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => openEditLog(l.id, 'note', l.note)}
                  className="px-3 py-2 rounded-xl text-xs font-bold border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700"
                >
                  ملاحظة
                </button>
                <button
                  onClick={() => openEditLog(l.id, 'reply', l.reply)}
                  className="px-3 py-2 rounded-xl text-xs font-bold border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700"
                >
                  رد
                </button>
                <button
                  onClick={() => void handleDeleteLog(l.id)}
                  className="px-3 py-2 rounded-xl text-xs font-bold border border-rose-200 dark:border-rose-900/40 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                  title="حذف السجل"
                >
                  حذف
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
