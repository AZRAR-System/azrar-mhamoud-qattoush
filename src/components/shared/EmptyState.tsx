/**
 * © 2025 - Developed by Mahmoud Qattoush
 * AZRAR Real Estate Management System - All Rights Reserved
 * 
 * Empty State Component
 * مكون لعرض حالة البيانات الفارغة بشكل احترافي
 */

import React from 'react';
import { 
  Database, 
  FileText, 
  Users, 
  Home, 
  FileCheck, 
  DollarSign,
  Plus,
  Search,
  Filter,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/Button';

export interface EmptyStateProps {
  /** نوع البيانات الفارغة */
  type?: 'people' | 'properties' | 'contracts' | 'installments' | 'search' | 'filter' | 'general';
  
  /** عنوان مخصص */
  title?: string;
  
  /** رسالة مخصصة */
  message?: string;
  
  /** نص زر الإضافة */
  actionLabel?: string;
  
  /** دالة تُنفذ عند الضغط على زر الإضافة */
  onAction?: () => void;
  
  /** إظهار زر الإضافة */
  showAction?: boolean;
  
  /** أيقونة مخصصة */
  icon?: React.ReactNode;
}

/**
 * مكون EmptyState
 * يعرض رسالة احترافية عند عدم وجود بيانات
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  type = 'general',
  title,
  message,
  actionLabel,
  onAction,
  showAction = true,
  icon
}) => {
  const config = getEmptyStateConfig(type);

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      {/* الأيقونة */}
      <div className="w-24 h-24 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-6">
        {icon || config.icon}
      </div>

      {/* العنوان */}
      <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">
        {title || config.title}
      </h3>

      {/* الرسالة */}
      <p className="text-slate-600 dark:text-slate-400 text-center max-w-md mb-6">
        {message || config.message}
      </p>

      {/* زر الإضافة */}
      {showAction && onAction && (
        <Button onClick={onAction} className="gap-2">
          <Plus size={18} />
          {actionLabel || config.actionLabel}
        </Button>
      )}
    </div>
  );
};

/**
 * الحصول على إعدادات EmptyState حسب النوع
 */
const getEmptyStateConfig = (type: string) => {
  const configs: Record<string, {
    icon: React.ReactNode;
    title: string;
    message: string;
    actionLabel: string;
  }> = {
    people: {
      icon: <Users className="w-12 h-12 text-slate-400" />,
      title: 'لا يوجد أشخاص',
      message: 'لم يتم إضافة أي أشخاص بعد. ابدأ بإضافة مالكين أو مستأجرين أو كفلاء.',
      actionLabel: 'إضافة شخص جديد'
    },
    properties: {
      icon: <Home className="w-12 h-12 text-slate-400" />,
      title: 'لا توجد عقارات',
      message: 'لم يتم إضافة أي عقارات بعد. ابدأ بإضافة شقق أو محلات تجارية أو مكاتب.',
      actionLabel: 'إضافة عقار جديد'
    },
    contracts: {
      icon: <FileCheck className="w-12 h-12 text-slate-400" />,
      title: 'لا توجد عقود',
      message: 'لم يتم إنشاء أي عقود بعد. ابدأ بإنشاء عقد إيجار جديد.',
      actionLabel: 'إنشاء عقد جديد'
    },
    installments: {
      icon: <DollarSign className="w-12 h-12 text-slate-400" />,
      title: 'لا توجد أقساط',
      message: 'لا توجد أقساط مستحقة حالياً. سيتم إنشاء الأقساط تلقائياً عند إضافة عقود.',
      actionLabel: 'عرض العقود'
    },
    search: {
      icon: <Search className="w-12 h-12 text-slate-400" />,
      title: 'لا توجد نتائج',
      message: 'لم يتم العثور على أي نتائج مطابقة لبحثك. حاول استخدام كلمات مختلفة.',
      actionLabel: 'مسح البحث'
    },
    filter: {
      icon: <Filter className="w-12 h-12 text-slate-400" />,
      title: 'لا توجد نتائج',
      message: 'لا توجد بيانات تطابق الفلاتر المحددة. حاول تغيير معايير الفلترة.',
      actionLabel: 'مسح الفلاتر'
    },
    general: {
      icon: <Database className="w-12 h-12 text-slate-400" />,
      title: 'لا توجد بيانات',
      message: 'لا توجد بيانات لعرضها في الوقت الحالي.',
      actionLabel: 'إضافة بيانات'
    }
  };

  return configs[type] || configs.general;
};

