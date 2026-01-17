import React, { useMemo } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle, Info, Phone } from 'lucide-react';
import { DbService } from '@/services/mockDb';
import type { tbl_Alerts } from '@/types/types';

interface GenericAlertPanelProps {
  id?: string;
  onClose: () => void;
  alert?: unknown;
}

type GenericAlertLike = Partial<tbl_Alerts> & {
  title?: string;
  description?: string;
  timestamp?: string | number | Date;
  level?: string;
  tenant?: string;
  المستأجر?: string;
  اسم_المستأجر?: string;
  رقم_الهاتف?: string;
  الكود_الداخلي?: string;
};

const isGenericAlertLike = (value: unknown): value is GenericAlertLike => typeof value === 'object' && value !== null;

const getLevelMeta = (level?: string) => {
  if (level === 'critical') return { icon: AlertTriangle, title: 'حرج', color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20' };
  if (level === 'warning') return { icon: AlertCircle, title: 'تحذير', color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-900/20' };
  if (level === 'success') return { icon: CheckCircle, title: 'تم', color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' };
  return { icon: Info, title: 'معلومة', color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-900/20' };
};

export const GenericAlertPanel: React.FC<GenericAlertPanelProps> = ({ id, alert, onClose }) => {
  const resolved = useMemo<GenericAlertLike | null>(() => {
    if (alert && isGenericAlertLike(alert)) return alert;
    if (!id) return null;
    const a = (DbService.getAlerts?.() || []).find((x) => String(x.id) === String(id));
    return a || null;
  }, [id, alert]);

  const title = resolved?.title || resolved?.نوع_التنبيه || 'تنبيه';
  const description = resolved?.description || resolved?.الوصف || '';
  const timestamp = resolved?.timestamp || resolved?.تاريخ_الانشاء || '—';
  const level = resolved?.level || (resolved?.category === 'SmartBehavior' ? 'critical' : undefined);
  const tenantName = resolved?.tenantName || resolved?.المستأجر || resolved?.tenant || resolved?.اسم_المستأجر;
  const phone = resolved?.phone || resolved?.رقم_الهاتف;
  const propertyCode = resolved?.propertyCode || resolved?.الكود_الداخلي;

  const meta = getLevelMeta(level);
  const Icon = meta.icon;

  return (
    <div className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-xl ${meta.bg}`}>
            <Icon size={18} className={meta.color} />
          </div>
          <div>
            <div className="font-bold text-slate-900 dark:text-white text-lg">{title}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">نوع: {meta.title}</div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="px-3 py-2 rounded-xl text-xs font-bold border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800"
        >
          إغلاق
        </button>
      </div>

      <div className="mt-4 space-y-3">
        {description ? (
          <div className="p-4 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700">
            <div className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap">{description}</div>
          </div>
        ) : (
          <div className="text-sm text-slate-500 dark:text-slate-400">لا توجد تفاصيل إضافية.</div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="p-3 rounded-xl border border-gray-100 dark:border-slate-700">
            <div className="text-xs text-slate-500 dark:text-slate-400">التاريخ</div>
            <div className="text-sm font-bold text-slate-800 dark:text-white" dir="ltr">
              {String(timestamp).includes('T') ? String(timestamp).split('T')[0] : String(timestamp)}
            </div>
          </div>

          <div className="p-3 rounded-xl border border-gray-100 dark:border-slate-700">
            <div className="text-xs text-slate-500 dark:text-slate-400">العقار / المستأجر</div>
            <div className="text-sm font-bold text-slate-800 dark:text-white">
              {tenantName ? tenantName : '—'}{propertyCode ? ` • ${propertyCode}` : ''}
            </div>
          </div>

          <div className="p-3 rounded-xl border border-gray-100 dark:border-slate-700">
            <div className="text-xs text-slate-500 dark:text-slate-400">المعرف</div>
            <div className="text-sm font-bold text-slate-800 dark:text-white" dir="ltr">{resolved?.id || id || '—'}</div>
          </div>

          <div className="p-3 rounded-xl border border-gray-100 dark:border-slate-700">
            <div className="text-xs text-slate-500 dark:text-slate-400">رقم الهاتف</div>
            <div className="text-sm font-bold text-slate-800 dark:text-white" dir="ltr">
              {phone ? (
                <span className="inline-flex items-center gap-2">
                  <Phone size={14} className="text-slate-400" /> {phone}
                </span>
              ) : (
                '—'
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
