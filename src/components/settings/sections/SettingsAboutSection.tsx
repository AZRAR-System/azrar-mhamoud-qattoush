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
import type { SettingsPageModel } from '@/hooks/useSettingsPage';

type Props = { page: SettingsPageModel };

export function SettingsAboutSection({ page }: Props) {
  const {
    resetOnboarding,
  } = page;

  return (
    <div className="flex items-center justify-center h-full p-8 animate-fade-in bg-gray-50 dark:bg-slate-900/50">
      <div className="app-card p-8 rounded-3xl text-center max-w-md border-gray-100 dark:border-slate-700">
        <div className="w-20 h-20 bg-gradient-to-br from-indigo-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-600/30 mx-auto mb-6 text-white text-3xl font-bold">
          خ
        </div>
        <h3 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">
          نظام خبرني العقاري
        </h3>
        <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">الإصدار 3.0</p>
    
        <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl text-xs text-slate-600 dark:text-slate-300 border border-gray-100 dark:border-slate-700 leading-relaxed">
          <p className="font-bold mb-1">© 2025 — Developed by Mahmoud Qattoush</p>
          <p>AZRAR Real Estate Management System — All Rights Reserved</p>
        </div>
    
        <button
          onClick={resetOnboarding}
          className="mt-6 flex items-center justify-center gap-2 text-indigo-600 text-xs font-bold hover:underline mx-auto"
        >
          <PlayCircle size={14} /> إعادة تشغيل الجولة التعليمية
        </button>
      </div>
    </div>
  );
}
