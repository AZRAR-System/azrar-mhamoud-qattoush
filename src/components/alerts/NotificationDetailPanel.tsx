import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  X,
  MessageSquare,
  CreditCard,
  ExternalLink,
  User,
  Building,
  AlertCircle,
  Save,
  ChevronLeft,
  Wrench,
  FileText,
  ShieldAlert,
  RefreshCw,
  Receipt,
  Scale,
  Bell,
  ArrowUpRight,
  FileEdit,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import type { AlertItem } from '@/hooks/useAlerts';
import { getAlertPrimarySpec, resolveSecondaryActions } from '@/services/alerts/alertActionPolicy';
import { buildSettingsMessageTemplatesHrefForAlert } from '@/services/messageTemplateSourceGroups';

interface NotificationDetailPanelProps {
  alert: AlertItem;
  onClose: () => void;
  onAction: (type: string) => void;
  onSaveNote: (note: string) => void;
}

const PRIORITY_LABELS: Record<string, string> = {
  urgent: 'عاجل',
  high: 'مهم',
  normal: 'عادي',
  low: 'منخفض',
};

const PRIORITY_BADGE: Record<string, string> = {
  urgent: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400',
  high: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
  normal: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
  low: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};

const SOURCE_LABELS: Record<string, string> = {
  'العقود_tbl': 'عقد',
  'الكمبيالات_tbl': 'دفعة مالية',
  'العقارات_tbl': 'عقار',
  'الأشخاص_tbl': 'شخص / مستأجر',
  'تذاكر_الصيانة_tbl': 'تذكرة صيانة',
  System: 'النظام',
};

// Map action ID substrings to icons
function getActionIcon(actionId: string) {
  if (actionId.includes('whatsapp')) return <MessageSquare size={15} className="text-emerald-500" />;
  if (actionId.includes('payment') || actionId.includes('pay')) return <CreditCard size={15} className="text-amber-500" />;
  if (actionId.includes('renew')) return <RefreshCw size={15} className="text-blue-500" />;
  if (actionId.includes('tech')) return <Wrench size={15} className="text-emerald-600" />;
  if (actionId.includes('legal')) return <Scale size={15} className="text-purple-500" />;
  if (actionId.includes('person')) return <User size={15} className="text-indigo-500" />;
  if (actionId.includes('receipt')) return <Receipt size={15} className="text-slate-500" />;
  if (actionId.includes('insurance')) return <ShieldAlert size={15} className="text-rose-400" />;
  if (actionId.includes('nav')) return <ArrowUpRight size={15} className="text-slate-400" />;
  return <ExternalLink size={15} className="text-slate-400" />;
}

export const NotificationDetailPanel: React.FC<NotificationDetailPanelProps> = ({
  alert,
  onClose,
  onAction,
  onSaveNote,
}) => {
  const [noteText, setNoteText] = useState('');

  const primarySpec = getAlertPrimarySpec(alert);
  const secondaryActions = resolveSecondaryActions(alert);
  const sourceLabel = SOURCE_LABELS[String(alert.مرجع_الجدول || '')] || String(alert.مرجع_الجدول || 'غير محدد');

  const handleSave = () => {
    if (!noteText.trim()) return;
    onSaveNote(noteText);
    setNoteText('');
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 w-full max-w-md shadow-2xl animate-slide-in-right">
      {/* Header */}
      <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'p-2.5 rounded-xl',
              alert.priority === 'urgent'
                ? 'bg-rose-500/10 text-rose-500'
                : alert.priority === 'high'
                ? 'bg-amber-500/10 text-amber-500'
                : 'bg-indigo-500/10 text-indigo-500'
            )}
          >
            <AlertCircle size={20} />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-800 dark:text-white leading-tight line-clamp-2 max-w-[220px]">
              {alert.نوع_التنبيه}
            </h3>
            <div className="flex items-center gap-1.5 mt-1">
              <span
                className={cn(
                  'text-[10px] font-black px-2 py-0.5 rounded',
                  PRIORITY_BADGE[alert.priority] ?? PRIORITY_BADGE.normal
                )}
              >
                {PRIORITY_LABELS[alert.priority] ?? alert.priority}
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                {sourceLabel}
              </span>
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors shrink-0"
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {/* Description */}
        <section className="space-y-2">
          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">تفاصيل الإشعار</h4>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            {alert.الوصف}
          </p>
        </section>

        <section className="space-y-2">
          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">مصدر نص الرسالة</h4>
          <Link
            to={buildSettingsMessageTemplatesHrefForAlert(alert)}
            className="flex items-center gap-2 w-full p-3 rounded-xl border border-indigo-200/70 dark:border-indigo-800/60 bg-indigo-50/40 dark:bg-indigo-950/20 text-indigo-800 dark:text-indigo-200 hover:bg-indigo-100/70 dark:hover:bg-indigo-900/30 transition-colors"
          >
            <FileEdit size={16} className="shrink-0 text-indigo-600 dark:text-indigo-400" />
            <span className="text-xs font-bold leading-snug">فتح قوالب الرسائل المناسبة لهذا الإشعار</span>
          </Link>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-relaxed">
            يوجّهك إلى الإعدادات → الرسائل مع تصفية القوالب حسب نوع التنبيه (تذكير، تحصيل، تجديد، …).
          </p>
        </section>

        {/* Entity Data */}
        <section className="space-y-2">
          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">البيانات المرتبطة</h4>
          <div className="grid grid-cols-1 gap-2">
            {alert.tenantName && (
              <div className="flex items-center gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <div className="p-2 rounded-lg bg-white dark:bg-slate-800 shadow-sm text-indigo-500">
                  <User size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-slate-400 font-bold">المستأجر / العميل</p>
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{alert.tenantName}</p>
                </div>
              </div>
            )}

            {alert.propertyCode && (
              <div className="flex items-center gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <div className="p-2 rounded-lg bg-white dark:bg-slate-800 shadow-sm text-amber-500">
                  <Building size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-slate-400 font-bold">العقار / الكود</p>
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{alert.propertyCode}</p>
                </div>
              </div>
            )}

            {alert.مرجع_المعرف && alert.مرجع_المعرف !== 'batch' && (
              <div className="flex items-center gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <div className="p-2 rounded-lg bg-white dark:bg-slate-800 shadow-sm text-slate-500">
                  <FileText size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-slate-400 font-bold">المصدر — {sourceLabel}</p>
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate font-mono">
                    #{alert.مرجع_المعرف}
                  </p>
                </div>
              </div>
            )}

            {alert.count && alert.count > 1 && (
              <div className="flex items-center gap-3 p-3.5 rounded-xl bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30">
                <div className="p-2 rounded-lg bg-white dark:bg-slate-800 shadow-sm text-indigo-600">
                  <Bell size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-indigo-400 font-bold">عدد السجلات المرتبطة</p>
                  <p className="text-sm font-bold text-indigo-700 dark:text-indigo-300">{alert.count} سجلات</p>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Actions */}
        <section className="space-y-2">
          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">الإجراءات المقترحة</h4>
          <div className="grid grid-cols-1 gap-2">
            {/* Primary Action */}
            <button
              onClick={() => onAction('primary')}
              className="flex items-center justify-between w-full p-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-lg shadow-indigo-500/20 group"
            >
              <span className="font-bold text-sm">{primarySpec.label}</span>
              <ChevronLeft size={17} className="group-hover:-translate-x-1 transition-transform" />
            </button>

            {/* Secondary Actions */}
            {secondaryActions.map((act) => (
              <button
                key={act.id}
                onClick={() => onAction(act.id)}
                className="flex items-center gap-3 w-full p-3.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-600 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/20 transition-all text-slate-700 dark:text-slate-200"
              >
                {getActionIcon(act.id)}
                <span className="font-bold text-sm">{act.label}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Notes */}
        <section className="space-y-2">
          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">إضافة ملاحظة</h4>
          <div className="relative">
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="أضف ملاحظة تُحفظ في ملف الكيان الأصلي..."
              className="w-full h-24 p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none text-sm transition-all resize-none"
            />
            <button
              onClick={handleSave}
              disabled={!noteText.trim()}
              className="absolute bottom-3 left-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 disabled:bg-slate-300 disabled:dark:bg-slate-700 text-white text-xs font-bold transition-all shadow-md"
            >
              <Save size={13} />
              حفظ
            </button>
          </div>
        </section>
      </div>

      {/* Footer */}
      <div className="p-5 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800">
        <button
          onClick={() => onAction('open_original')}
          className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:text-indigo-500 hover:border-indigo-500 transition-all text-xs font-bold"
        >
          <ExternalLink size={13} />
          فتح السجل الأصلي بالكامل
        </button>
      </div>
    </div>
  );
};
