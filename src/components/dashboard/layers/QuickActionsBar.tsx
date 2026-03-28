/**
 * © 2025 - Developed by Mahmoud Qattoush
 * Quick Actions Bar - Fast access to main sections with integrated forms
 */

import React from 'react';
import { Plus, FileText, Phone, Search, Bell, BarChart3, Users, Building2 } from 'lucide-react';
import { useSmartModal } from '@/context/ModalContext';
import { useToast } from '@/context/ToastContext';
import { GLOBAL_SEARCH_OPEN_EVENT } from '@/components/shared/GlobalSearch';
import { ROUTE_PATHS } from '@/routes/paths';

export interface QuickActionsBarProps {
  /** card = إطار مستقل؛ inline = بدون إطار إضافي (للاستخدام داخل بطاقة أب مع التبويبات) */
  variant?: 'card' | 'inline';
}

export const QuickActionsBar: React.FC<QuickActionsBarProps> = ({ variant = 'card' }) => {
  const { openPanel } = useSmartModal();
  const toast = useToast();

  const openSection = (section: string, title: string) => {
    openPanel('SECTION_VIEW', section, { title });
  };

  const handleAddContract = () => {
    openPanel('CONTRACT_FORM', 'new', {
      onSuccess: () => {
        toast.success('تم إضافة العقد بنجاح');
      },
    });
  };

  const handleAddPerson = () => {
    openPanel('PERSON_FORM', 'new', {
      onSuccess: () => {
        toast.success('تم إضافة الشخص بنجاح');
      },
    });
  };

  const handleAddProperty = () => {
    openPanel('PROPERTY_FORM', 'new', {
      onSuccess: () => {
        toast.success('تم إضافة العقار بنجاح');
      },
    });
  };

  const actions = [
    {
      icon: Plus,
      label: 'عقد جديد',
      color: 'bg-indigo-500 hover:bg-indigo-600',
      action: handleAddContract,
      desc: 'أضف عقد جديد من قسم العقود',
    },
    {
      icon: Users,
      label: 'شخص جديد',
      color: 'bg-purple-500 hover:bg-purple-600',
      action: handleAddPerson,
      desc: 'أضف شخص جديد من قسم الأشخاص',
    },
    {
      icon: Building2,
      label: 'عقار جديد',
      color: 'bg-green-500 hover:bg-green-600',
      action: handleAddProperty,
      desc: 'أضف عقار جديد من قسم العقارات',
    },
    {
      icon: BarChart3,
      label: 'تقارير',
      color: 'bg-indigo-500 hover:bg-indigo-600',
      action: () => openSection(ROUTE_PATHS.REPORTS, 'التقارير'),
      desc: 'عرض التقارير المتقدمة',
    },
    {
      icon: Bell,
      label: 'إشعارات',
      color: 'bg-yellow-500 hover:bg-yellow-600',
      action: () => openSection(ROUTE_PATHS.ALERTS, 'الإشعارات'),
      desc: 'عرض الإشعارات والتنبيهات',
    },
    {
      icon: Search,
      label: 'بحث',
      color: 'bg-cyan-500 hover:bg-cyan-600',
      action: () => window.dispatchEvent(new Event(GLOBAL_SEARCH_OPEN_EVENT)),
      desc: 'بحث متقدم عن البيانات',
    },
    {
      icon: FileText,
      label: 'مستندات',
      color: 'bg-orange-500 hover:bg-orange-600',
      action: () => {
        window.location.hash = ROUTE_PATHS.DOCUMENTS;
      },
      desc: 'إدارة المستندات',
    },
    {
      icon: Phone,
      label: 'اتصالات',
      color: 'bg-pink-500 hover:bg-pink-600',
      action: () => {
        window.location.hash = ROUTE_PATHS.CONTACTS;
      },
      desc: 'نظام الاتصالات',
    },
  ];

  const isInline = variant === 'inline';

  const inner = (
    <>
      <div className={`flex items-center gap-2 ${isInline ? 'mb-3' : 'mb-4'}`}>
        <div className="w-1 h-6 bg-gradient-to-b from-indigo-500 to-indigo-600 rounded-full shrink-0" />
        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">
          اختصارات سريعة مرتبطة بالأقسام الرئيسية
        </h3>
      </div>

      <div
        className={`grid grid-cols-2 sm:grid-cols-4 ${isInline ? 'lg:grid-cols-4 xl:grid-cols-8' : 'lg:grid-cols-8'} gap-2`}
      >
        {actions.map((action, index) => {
          const Icon = action.icon;
          return (
            <button
              key={index}
              onClick={action.action}
              className={`${action.color} text-white p-3 rounded-xl transition flex flex-col items-center justify-center gap-1 shadow-sm hover:shadow-md group`}
              title={action.desc}
            >
              <Icon size={18} className="group-hover:scale-110 transition" />
              <span className="text-xs font-bold text-center leading-tight">{action.label}</span>
            </button>
          );
        })}
      </div>

      <div
        className={`${isInline ? 'mt-3 p-2.5' : 'mt-4 p-3'} bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-700 rounded-lg`}
      >
        <p className="text-xs text-indigo-700 dark:text-indigo-300 leading-relaxed">
          <strong>ملاحظة:</strong> بعض الاختصارات تفتح طبقة عرض داخلية، بينما (اتصالات/مستندات) تفتح
          صفحات كاملة.
        </p>
      </div>
    </>
  );

  if (isInline) {
    return (
      <div className="w-full min-w-0" dir="rtl">
        {inner}
      </div>
    );
  }

  return (
    <div className="mb-6 p-4 app-card" dir="rtl">
      {inner}
    </div>
  );
};
