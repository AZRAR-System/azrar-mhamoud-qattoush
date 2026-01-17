
import React from 'react';
import {
  CheckCircle, AlertTriangle, XCircle, Clock, AlertOctagon, Ban, Info,
  Home, DollarSign, FileText, Wrench, Calendar, TrendingUp, TrendingDown,
  Shield, Star, Zap
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type StatusType = 'success' | 'warning' | 'caution' | 'danger' | 'neutral' | 'info';

const STATUS_MAP: Record<string, { type: StatusType; icon: LucideIcon | null }> = {
  // ═══════════════════════════════════════════════════════════════════════════════
  // حالات النجاح (Success States)
  // ═══════════════════════════════════════════════════════════════════════════════
  'نشط': { type: 'success', icon: CheckCircle },
  'مؤجر': { type: 'success', icon: Home },
  'مجدد': { type: 'success', icon: CheckCircle },
  'مدفوع': { type: 'success', icon: DollarSign },
  'Active': { type: 'success', icon: CheckCircle },
  'Completed': { type: 'success', icon: CheckCircle },
  'سليم': { type: 'success', icon: Shield },
  'ممتاز': { type: 'success', icon: Star },
  'منتظم': { type: 'success', icon: CheckCircle },
  'Sold': { type: 'success', icon: TrendingUp },
  'مكتمل': { type: 'success', icon: CheckCircle },
  'موافق عليه': { type: 'success', icon: CheckCircle },
  'PASS': { type: 'success', icon: CheckCircle },
  'نجح': { type: 'success', icon: CheckCircle },

  // ═══════════════════════════════════════════════════════════════════════════════
  // حالات التحذير (Warning States)
  // ═══════════════════════════════════════════════════════════════════════════════
  'قريب الانتهاء': { type: 'warning', icon: Clock },
  'مستحق': { type: 'warning', icon: Calendar },
  'Pending': { type: 'warning', icon: Clock },
  'Negotiation': { type: 'warning', icon: FileText },
  'تحت الصيانة': { type: 'warning', icon: Wrench },
  'مفتوح': { type: 'warning', icon: AlertTriangle },
  'قيد التنفيذ': { type: 'warning', icon: Zap },
  'قيد المراجعة': { type: 'warning', icon: FileText },
  'يحتاج متابعة': { type: 'warning', icon: AlertTriangle },

  // ═══════════════════════════════════════════════════════════════════════════════
  // حالات الخطر (Danger States)
  // ═══════════════════════════════════════════════════════════════════════════════
  'منتهي': { type: 'danger', icon: AlertOctagon },
  'مفسوخ': { type: 'danger', icon: Ban },
  'ملغي': { type: 'danger', icon: XCircle },
  'متأخر': { type: 'danger', icon: TrendingDown },
  'متأخرة': { type: 'danger', icon: TrendingDown },
  'مماطل': { type: 'danger', icon: AlertTriangle },
  'Rejected': { type: 'danger', icon: XCircle },
  'محظور': { type: 'danger', icon: Ban },
  'مرفوض': { type: 'danger', icon: XCircle },
  'متعثر': { type: 'danger', icon: AlertOctagon },
  'FAIL': { type: 'danger', icon: XCircle },
  'فشل': { type: 'danger', icon: XCircle },
  'Critical': { type: 'danger', icon: AlertOctagon },
  'High': { type: 'warning', icon: AlertTriangle },
  'معطل': { type: 'danger', icon: XCircle },

  // ═══════════════════════════════════════════════════════════════════════════════
  // حالات المعلومات (Info States)
  // ═══════════════════════════════════════════════════════════════════════════════
  'شاغر': { type: 'info', icon: Home },
  'معروض للبيع': { type: 'info', icon: TrendingUp },
  'جديد': { type: 'info', icon: Star },
  'قيد الإنشاء': { type: 'info', icon: Wrench },
  'Medium': { type: 'caution', icon: AlertTriangle },

  // ═══════════════════════════════════════════════════════════════════════════════
  // حالات محايدة (Neutral States)
  // ═══════════════════════════════════════════════════════════════════════════════
  'مؤرشف': { type: 'neutral', icon: Info },
  'Archived': { type: 'neutral', icon: Info },
  'مغلق': { type: 'neutral', icon: CheckCircle },
  'معلق': { type: 'neutral', icon: Clock },
  'SKIP': { type: 'neutral', icon: Info },
  'تم تخطيه': { type: 'neutral', icon: Info },
  'Low': { type: 'neutral', icon: Info },
};

export const StatusBadge: React.FC<{ status: string, className?: string, showIcon?: boolean }> = ({ status, className, showIcon = true }) => {
  const config = STATUS_MAP[status] || { type: 'neutral', icon: null };
  const Icon = config.icon;

  const styles = {
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20',
    warning: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20',
    caution: 'bg-yellow-50 text-yellow-800 border-yellow-200 dark:bg-yellow-500/10 dark:text-yellow-300 dark:border-yellow-500/20',
    danger: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20',
    info: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20',
    neutral: 'bg-slate-100/70 text-slate-700 border-slate-200/80 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700',
  };

  const iconBg = {
    success: 'bg-emerald-200/60 dark:bg-emerald-500/20',
    warning: 'bg-amber-200/60 dark:bg-amber-500/20',
    caution: 'bg-yellow-200/70 dark:bg-yellow-500/20',
    danger: 'bg-red-200/60 dark:bg-red-500/20',
    info: 'bg-indigo-200/60 dark:bg-indigo-500/20',
    neutral: 'bg-slate-200/70 dark:bg-slate-700/50',
  };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${styles[config.type]} ${className}`}>
      {showIcon && Icon ? (
        <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full ${iconBg[config.type as StatusType]}`}>
          <Icon size={12} strokeWidth={2.6} />
        </span>
      ) : null}
      {status}
    </span>
  );
};
