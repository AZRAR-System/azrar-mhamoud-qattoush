import React, { useEffect, useState } from 'react';
import { Edit2, Eye, EyeOff, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DS } from '@/constants/designSystem';
import { useAppDialogs } from '@/hooks/useAppDialogs';
import { DbService } from '@/services/mockDb';
import type { MarqueeMessage } from '@/types';

type MarqueeAction = MarqueeMessage['action'];

const getErrorMessage = (error: unknown): string | undefined => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    const msg = (error as { message?: unknown }).message;
    return typeof msg === 'string' ? msg : undefined;
  }
  return undefined;
};

const isMarqueeType = (value: string): value is LocalAd['type'] => value === 'alert' || value === 'info' || value === 'success';
const isMarqueePriority = (value: string): value is LocalAd['priority'] => value === 'Normal' || value === 'High';

type LocalAd = {
  id: string;
  content: string;
  priority: 'Normal' | 'High';
  type: 'alert' | 'info' | 'success';
  createdAt?: string;
  expiresAt?: string;
  enabled?: boolean;
  action?: MarqueeAction;
};

function formatAction(action?: MarqueeAction): string {
  if (!action) return 'بدون إجراء';
  if (action.kind === 'hash') return `فتح صفحة: ${String(action.hash || '')}`;
  if (action.kind === 'panel') {
    const id = action.id ? ` (${String(action.id)})` : '';
    return `فتح لوحة: ${String(action.panel || '')}${id}`;
  }
  return 'بدون إجراء';
}

async function promptAction(dialogs: ReturnType<typeof useAppDialogs>, current?: MarqueeAction): Promise<MarqueeAction | null> {
  const kind = await dialogs.prompt({
    title: 'إجراء عند الضغط (اختياري)',
    message: 'حدد ماذا يحدث عند الضغط على الإعلان في الشريط.',
    inputType: 'select',
    defaultValue: current?.kind ? String(current.kind) : 'none',
    options: [
      { label: 'لا يوجد', value: 'none' },
      { label: 'فتح صفحة (رابط داخل النظام)', value: 'hash' },
      { label: 'فتح لوحة داخلية (Panel)', value: 'panel' },
    ],
    required: true,
  });
  if (!kind || kind === 'none') return null;

  if (kind === 'hash') {
    const def = current?.kind === 'hash' ? String(current.hash || '') : '/alerts?only=unread';
    const hash = await dialogs.prompt({
      title: 'المسار (Hash)',
      message: 'اكتب مساراً مثل: /alerts?only=unread أو /installments?filter=due',
      inputType: 'text',
      defaultValue: def,
      required: true,
    });
    if (!hash) return null;
    const normalized = String(hash).trim();
    return { kind: 'hash', hash: normalized.startsWith('/') ? normalized : `/${normalized}` };
  }

  // panel
  const currentPanel = current?.kind === 'panel' ? String(current.panel || '') : '';
  const panelChoice = await dialogs.prompt({
    title: 'اختر اللوحة',
    inputType: 'select',
    defaultValue: currentPanel || 'PAYMENT_NOTIFICATIONS',
    options: [
      { label: 'تنبيهات الدفع (PAYMENT_NOTIFICATIONS)', value: 'PAYMENT_NOTIFICATIONS' },
      { label: 'تفاصيل عقد (CONTRACT_DETAILS)', value: 'CONTRACT_DETAILS' },
      { label: 'تفاصيل عقار (PROPERTY_DETAILS)', value: 'PROPERTY_DETAILS' },
      { label: 'تفاصيل شخص (PERSON_DETAILS)', value: 'PERSON_DETAILS' },
      { label: 'مولد الإنذارات القانونية (LEGAL_NOTICE_GENERATOR)', value: 'LEGAL_NOTICE_GENERATOR' },
      { label: 'إعلانات الشريط (MARQUEE_ADS)', value: 'MARQUEE_ADS' },
    ],
    required: true,
  });
  if (!panelChoice) return null;

  const panel = panelChoice;

  const defaultId = current?.kind === 'panel' ? String(current.id || '') : '';
  const id = await dialogs.prompt({
    title: 'معرف السجل (اختياري)',
    message: 'اتركه فارغاً إذا كانت اللوحة لا تحتاج معرفاً.',
    inputType: 'text',
    defaultValue: defaultId,
    required: false,
  });

  const idNorm = String(id || '').trim();
  return { kind: 'panel', panel, ...(idNorm ? { id: idNorm } : {}) };
}

function formatExpiry(expiresAt?: string): string {
  const exp = String(expiresAt || '').trim();
  if (!exp) return 'دائم';
  try {
    const d = new Date(exp);
    if (Number.isNaN(d.getTime())) return exp;
    return d.toLocaleString('en-GB');
  } catch {
    return exp;
  }
}

export const MarqueeAdsPanel: React.FC = () => {
  const dialogs = useAppDialogs();
  const [busy, setBusy] = useState(false);
  const [localItems, setLocalItems] = useState<LocalAd[]>([]);

  const refresh = async () => {
    setBusy(true);
    try {
      const ads = DbService.getMarqueeAds?.() as LocalAd[] | undefined;
      setLocalItems(Array.isArray(ads) ? ads : []);
    } catch {
      setLocalItems([]);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void refresh();

    const handler = () => void refresh();
    window.addEventListener('azrar:marquee-changed', handler);
    window.addEventListener('azrar:db-changed', handler as EventListener);
    window.addEventListener('focus', handler);
    return () => {
      window.removeEventListener('azrar:marquee-changed', handler);
      window.removeEventListener('azrar:db-changed', handler as EventListener);
      window.removeEventListener('focus', handler);
    };
  }, []);

  const handleAdd = async () => {
    const content = await dialogs.prompt({
      title: 'إضافة إعلان للشريط',
      message: 'اكتب نص الإعلان الذي سيظهر في الشريط.',
      inputType: 'textarea',
      placeholder: 'مثال: تحديث نظام... / تنبيه مهم...',
      required: true,
    });
    if (!content) return;

    const type = await dialogs.prompt({
      title: 'نوع الإعلان',
      message: 'اختر نوع الإعلان لتحديد لونه في الشريط.',
      inputType: 'select',
      defaultValue: 'info',
      options: [
        { label: 'معلومة (Info)', value: 'info' },
        { label: 'نجاح (Success)', value: 'success' },
        { label: 'تنبيه (Alert)', value: 'alert' },
      ],
      required: true,
    });
    if (!type) return;
    const typeValue = String(type);
    if (!isMarqueeType(typeValue)) return;

    const priority = await dialogs.prompt({
      title: 'أولوية الإعلان',
      message: 'الأولوية العالية تُعرض بلون أقوى.',
      inputType: 'select',
      defaultValue: 'Normal',
      options: [
        { label: 'عادي (Normal)', value: 'Normal' },
        { label: 'عالي (High)', value: 'High' },
      ],
      required: true,
    });
    if (!priority) return;
    const priorityValue = String(priority);
    if (!isMarqueePriority(priorityValue)) return;

    const action = await promptAction(dialogs);

    const hoursStr = await dialogs.prompt({
      title: 'مدة الظهور (بالساعات) أو 0 للدائم',
      message: 'حدد عدد الساعات، أو اكتب 0 ليبقى الإعلان دائماً.',
      inputType: 'number',
      defaultValue: '0',
      placeholder: '0',
      required: true,
      validationRegex: /^\d+$/,
      validationError: 'أدخل رقم صحيح (0 أو أكثر)'
    });
    if (hoursStr === null) return;

    const durationHours = Number(hoursStr);

    setBusy(true);
    try {
      const local = DbService.addMarqueeAd({
        content,
        durationHours: Number.isFinite(durationHours) && durationHours >= 0 ? durationHours : 0,
        type: typeValue,
        priority: priorityValue,
        ...(action ? { action } : {}),
      });
      if (!local.success) dialogs.toast.error(local.message || 'فشل إضافة الإعلان');
      else dialogs.toast.success('تمت إضافة الإعلان');
    } catch (e: unknown) {
      dialogs.toast.error(getErrorMessage(e) || 'فشل إضافة الإعلان');
    } finally {
      setBusy(false);
      void refresh();
    }
  };

  const handleToggleEnabled = async (ad: LocalAd) => {
    const nextEnabled = ad.enabled === false ? true : false;
    const ok = await dialogs.confirm({
      title: nextEnabled ? 'تفعيل الإعلان' : 'إيقاف الإعلان',
      message: nextEnabled
        ? 'هل تريد تفعيل هذا الإعلان ليظهر في الشريط؟'
        : 'هل تريد إيقاف هذا الإعلان (سيبقى محفوظاً لكن لن يظهر في الشريط)؟',
      confirmText: nextEnabled ? 'تفعيل' : 'إيقاف',
      cancelText: 'إلغاء',
      isDangerous: !nextEnabled,
    });
    if (!ok) return;

    setBusy(true);
    try {
      const res = DbService.updateMarqueeAd?.(ad.id, { enabled: nextEnabled });
      if (res?.success) dialogs.toast.success(nextEnabled ? 'تم تفعيل الإعلان' : 'تم إيقاف الإعلان');
      else dialogs.toast.error(res?.message || 'فشل تحديث الإعلان');
    } catch (e: unknown) {
      dialogs.toast.error(getErrorMessage(e) || 'فشل تحديث الإعلان');
    } finally {
      setBusy(false);
      void refresh();
    }
  };

  const handleEdit = async (ad: LocalAd) => {
    const content = await dialogs.prompt({
      title: 'تعديل الإعلان',
      message: 'عدّل نص الإعلان.',
      inputType: 'textarea',
      defaultValue: String(ad.content || ''),
      required: true,
    });
    if (!content) return;

    const type = await dialogs.prompt({
      title: 'نوع الإعلان',
      inputType: 'select',
      defaultValue: String(ad.type || 'info'),
      options: [
        { label: 'معلومة (Info)', value: 'info' },
        { label: 'نجاح (Success)', value: 'success' },
        { label: 'تنبيه (Alert)', value: 'alert' },
      ],
      required: true,
    });
    if (!type) return;
    const typeValue = String(type);
    if (!isMarqueeType(typeValue)) return;

    const priority = await dialogs.prompt({
      title: 'الأولوية',
      inputType: 'select',
      defaultValue: String(ad.priority || 'Normal'),
      options: [
        { label: 'عادي (Normal)', value: 'Normal' },
        { label: 'عالي (High)', value: 'High' },
      ],
      required: true,
    });
    if (!priority) return;
    const priorityValue = String(priority);
    if (!isMarqueePriority(priorityValue)) return;

    const action = await promptAction(dialogs, ad.action);

    const expiryHoursStr = await dialogs.prompt({
      title: 'تحديث مدة الظهور (اختياري)',
      message: 'اكتب عدد الساعات من الآن، أو اتركه فارغاً للإبقاء كما هو. اكتب 0 لجعله دائماً.',
      inputType: 'text',
      defaultValue: '',
      placeholder: 'مثال: 24 أو 0 أو اتركه فارغاً',
      required: false,
      validationRegex: /^$|^\d+$/,
      validationError: 'أدخل رقم صحيح أو اتركه فارغاً'
    });
    if (expiryHoursStr === null) return;

    let expiresAtPatch: string | undefined = undefined;
    if (String(expiryHoursStr).trim() !== '') {
      const hours = Number(expiryHoursStr);
      expiresAtPatch = hours > 0 ? new Date(Date.now() + hours * 60 * 60 * 1000).toISOString() : '';
    }

    setBusy(true);
    try {
      const patch: Partial<Pick<LocalAd, 'content' | 'type' | 'priority' | 'expiresAt'>> & { action?: MarqueeAction | null } = {
        content,
        type: typeValue,
        priority: priorityValue,
        action,
      };
      if (typeof expiresAtPatch !== 'undefined') patch.expiresAt = expiresAtPatch;

      const res = DbService.updateMarqueeAd?.(ad.id, patch);
      if (res?.success) dialogs.toast.success('تم تحديث الإعلان');
      else dialogs.toast.error(res?.message || 'فشل تحديث الإعلان');
    } catch (e: unknown) {
      dialogs.toast.error(getErrorMessage(e) || 'فشل تحديث الإعلان');
    } finally {
      setBusy(false);
      void refresh();
    }
  };

  const handleDeleteLocal = async (id: string) => {
    const ok = await dialogs.confirm({
      title: 'حذف إعلان محلي',
      message: 'هل تريد حذف هذا الإعلان؟',
      confirmText: 'حذف',
      cancelText: 'إلغاء',
      isDangerous: true,
    });
    if (!ok) return;

    try {
      const res = DbService.deleteMarqueeAd(id);
      if (res.success) dialogs.toast.success('تم حذف الإعلان');
      else dialogs.toast.error(res.message || 'فشل حذف الإعلان');
    } catch (e: unknown) {
      dialogs.toast.error(getErrorMessage(e) || 'فشل حذف الإعلان');
    } finally {
      void refresh();
    }
  };

  return (
    <div className="animate-fade-in space-y-4 pb-10">
      <div className={DS.components.pageHeader}>
        <div>
          <h2 className={DS.components.pageTitle}>إعلانات الشريط</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            إضافة/حذف إعلانات الشريط (تُحفظ في نسخة Desktop وتُزامَن مع SQL عند تفعيل المزامنة).
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="icon" onClick={refresh} title="تحديث" isLoading={busy}>
            <RefreshCw size={18} />
          </Button>
          <Button variant="primary" onClick={handleAdd} className="gap-2" isLoading={busy}>
            <Plus size={18} /> إضافة إعلان
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {localItems.length === 0 ? (
          <Card className="p-6 text-center text-slate-500">لا توجد إعلانات</Card>
        ) : (
          localItems.map((it) => (
            <Card key={it.id} className="p-4 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-slate-800 dark:text-white break-words">{String(it.content || '')}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  الحالة: {it.enabled === false ? 'متوقف' : 'نشط'} • النوع: {String(it.type || 'info')} • الأولوية: {String(it.priority || 'Normal')} • الانتهاء: {formatExpiry(it.expiresAt)}
                  {' '}• الإجراء: {formatAction(it.action)}
                </div>
              </div>
              <Button
                variant="secondary"
                size="icon"
                title={it.enabled === false ? 'تفعيل' : 'إيقاف'}
                onClick={() => handleToggleEnabled(it)}
                isLoading={busy}
              >
                {it.enabled === false ? <Eye size={18} /> : <EyeOff size={18} />}
              </Button>
              <Button
                variant="secondary"
                size="icon"
                title="تعديل"
                onClick={() => handleEdit(it)}
                isLoading={busy}
              >
                <Edit2 size={18} />
              </Button>
              <Button
                variant="secondary"
                size="icon"
                title="حذف"
                onClick={() => handleDeleteLocal(String(it.id))}
                isLoading={busy}
              >
                <Trash2 size={18} />
              </Button>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};
