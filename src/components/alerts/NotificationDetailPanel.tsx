import React, { useState } from 'react';
import { 
  X, 
  MessageSquare, 
  CreditCard, 
  ExternalLink, 
  User, 
  Building, 
  DollarSign,
  AlertCircle,
  Save,
  ChevronLeft
} from 'lucide-react';
import { cn } from '@/utils/cn';
import type { AlertItem } from '@/hooks/useAlerts';
import { getAlertPrimarySpec, resolveSecondaryActions } from '@/services/alerts/alertActionPolicy';

interface NotificationDetailPanelProps {
  alert: AlertItem;
  onClose: () => void;
  onAction: (type: string) => void;
  onSaveNote: (note: string) => void;
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

  const handleSave = () => {
    if (!noteText.trim()) return;
    onSaveNote(noteText);
    setNoteText('');
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 w-full max-w-md shadow-2xl animate-slide-in-right">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className={cn(
            "p-2.5 rounded-xl",
            alert.priority === 'urgent' ? "bg-rose-500/10 text-rose-500" : "bg-indigo-500/10 text-indigo-500"
          )}>
            <AlertCircle size={22} />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-800 dark:text-white leading-tight">
              {alert.نوع_التنبيه}
            </h3>
            <span className={cn(
              "text-[10px] font-black uppercase px-2 py-0.5 rounded mt-1 inline-block",
              alert.priority === 'urgent' ? "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
            )}>
              {alert.priority} Priority
            </span>
          </div>
        </div>
        <button 
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors"
        >
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        {/* Description */}
        <section className="space-y-2">
          <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">تفاصيل الإشعار</h4>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
            {alert.الوصف}
          </p>
        </section>

        {/* Entity Data */}
        <section className="grid grid-cols-1 gap-4">
          <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">البيانات المرتبطة</h4>
          
          <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
            <div className="p-2 rounded-lg bg-white dark:bg-slate-800 shadow-sm text-indigo-500">
              <User size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-slate-400 font-bold">المستأجر / العميل</p>
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{alert.tenantName || 'غير محدد'}</p>
            </div>
          </div>

          <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
            <div className="p-2 rounded-lg bg-white dark:bg-slate-800 shadow-sm text-amber-500">
              <Building size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-slate-400 font-bold">العقار / الكود</p>
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{alert.propertyCode || 'غير محدد'}</p>
            </div>
          </div>

          {alert.count && alert.count > 1 && (
            <div className="flex items-center gap-4 p-4 rounded-xl bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30">
              <div className="p-2 rounded-lg bg-white dark:bg-slate-800 shadow-sm text-indigo-600">
                <DollarSign size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-indigo-400 font-bold">عدد السجلات</p>
                <p className="text-sm font-bold text-indigo-700 dark:text-indigo-300 truncate">{alert.count} سجلات مرتبطة</p>
              </div>
            </div>
          )}
        </section>

        {/* Actions */}
        <section className="space-y-3">
          <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">الإجراءات المقترحة</h4>
          <div className="grid grid-cols-1 gap-2">
            <button
              onClick={() => onAction('primary')}
              className="flex items-center justify-between w-full p-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-lg shadow-indigo-500/20 group"
            >
              <span className="font-bold text-sm">{primarySpec.label}</span>
              <ChevronLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
            </button>
            
            {secondaryActions.map((act) => (
              <button
                key={act.id}
                onClick={() => onAction(act.id)}
                className="flex items-center gap-3 w-full p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-600 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/20 transition-all text-slate-700 dark:text-slate-200"
              >
                {act.id.includes('whatsapp') ? <MessageSquare size={16} className="text-emerald-500" /> : 
                 act.id.includes('payment') ? <CreditCard size={16} className="text-amber-500" /> : 
                 <ExternalLink size={16} className="text-slate-400" />}
                <span className="font-bold text-sm">{act.label}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Notes */}
        <section className="space-y-3">
          <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">إضافة ملاحظة</h4>
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
              className="absolute bottom-3 left-3 flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 disabled:bg-slate-300 disabled:dark:bg-slate-700 text-white text-xs font-bold transition-all shadow-md"
            >
              <Save size={14} />
              حفظ
            </button>
          </div>
        </section>
      </div>

      {/* Footer / Original Link */}
      <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800">
        <button 
          onClick={() => onAction('open_original')}
          className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:text-indigo-500 hover:border-indigo-500 transition-all text-xs font-bold"
        >
          <ExternalLink size={14} />
          عرض السجل الأصلي بالكامل
        </button>
      </div>
    </div>
  );
};
