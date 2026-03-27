import React from 'react';
import {
  Database,
  Building,
  List,
  Upload,
  Globe,
  Phone,
  Bell,
  Image as ImageIcon,
  Plus,
  Trash2,
  Download,
  Search,
  Check,
  FolderOpen,
  ArrowRight,
  RefreshCcw,
  Edit2,
  BadgeDollarSign,
  History,
  FileJson,
  Shield,
  FileSpreadsheet,
  Info,
  PlayCircle,
  AlertTriangle,
  Copy,
  MessageCircle,
  FileText,
} from 'lucide-react';
import { CONTRACT_WORD_TEMPLATE_VARIABLES } from '@/constants/contractWordTemplateVariables';
import { Button } from '@/components/ui/Button';
import { RBACGuard } from '@/components/shared/RBACGuard';
import type { SettingsPageModel } from '@/hooks/useSettingsPage';

type Props = { page: SettingsPageModel };

export function SettingsContractWordSection({ page }: Props) {
  const {
    copyToClipboard,
    exportContractWordVariablesExcel,
    setActiveSection,
    settingsNoAccessFallback,
  } = page;

  return (
    <RBACGuard requiredPermission="SETTINGS_ADMIN" fallback={settingsNoAccessFallback}>
      <div className="p-8 overflow-y-auto custom-scrollbar h-full space-y-6 animate-fade-in">
        <section className="bg-gray-50 dark:bg-slate-900/50 rounded-2xl p-6 border border-gray-100 dark:border-slate-700">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2 flex items-center gap-2">
            <FileText className="text-indigo-500" size={20} /> متغيرات قالب العقد (Word)
          </h3>
    
          <div className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            هذه الصفحة مخصصة لمتغيرات قالب العقد داخل ملف Word. استخدم صيغة المتغيرات مثل{' '}
            <span className="font-mono" dir="ltr">
              {'{{ownerName}}'}
            </span>{' '}
            داخل ملف Word، ثم عند إنشاء/طباعة عقد سيقوم النظام بتعبئة القيم تلقائياً.
          </div>
    
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => void exportContractWordVariablesExcel()}
            >
              <Download size={16} /> تنزيل المتغيرات (Excel)
            </Button>
            <Button variant="secondary" onClick={() => setActiveSection('templates')}>
              <ArrowRight size={16} /> الذهاب لإدارة القوالب
            </Button>
          </div>
    
          <div className="mt-4 text-[12px] text-slate-500 dark:text-slate-400">
            أمثلة سريعة:{' '}
            <span className="font-mono" dir="ltr">
              {'اسم المؤجر: {{ownerName}}'}
            </span>{' '}
            •{' '}
            <span className="font-mono" dir="ltr">
              {'مدة الإيجار: {{contractDurationText}}'}
            </span>{' '}
            •{' '}
            <span className="font-mono" dir="ltr">
              {'كيفية أداء البدل: {{contractRentPaymentText}}'}
            </span>
          </div>
        </section>
    
        <section className="bg-white/60 dark:bg-slate-950/20 rounded-2xl p-6 border border-slate-200 dark:border-slate-700">
          <div className="font-bold text-sm text-slate-800 dark:text-slate-100 mb-3">
            قائمة المتغيرات (اضغط نسخ)
          </div>
    
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {CONTRACT_WORD_TEMPLATE_VARIABLES.map((v) => {
              const placeholder = `{{${v.key}}}`;
              return (
                <div
                  key={v.key}
                  className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2"
                >
                  <div className="min-w-0">
                    <div
                      className="text-xs font-bold text-slate-700 dark:text-slate-200"
                      dir="ltr"
                    >
                      {placeholder}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      {v.label}
                      {v.example ? ` • مثال: ${v.example}` : ''}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void copyToClipboard(placeholder)}
                    className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:underline"
                  >
                    <Copy size={14} /> نسخ
                  </button>
                </div>
              );
            })}
          </div>
    
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-4">
            ملاحظة: القوالب القديمة التي تعتمد على نجوم (****) ما زالت تعمل تلقائياً.
          </div>
        </section>
      </div>
    </RBACGuard>
  );
}
