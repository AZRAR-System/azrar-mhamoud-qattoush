/**
 * © 2025 - Developed by Mahmoud Qattoush
 * AZRAR Real Estate Management System - All Rights Reserved
 *
 * Data Guard Component
 * مكون للتحقق من وجود البيانات المطلوبة قبل عرض المحتوى
 */

import React from 'react';
import { AlertTriangle, Database, Plus, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

export interface DataGuardProps {
  /** المحتوى الذي سيتم عرضه إذا كانت البيانات موجودة */
  children: React.ReactNode;

  /** دالة التحقق من البيانات */
  check: () => { isValid: boolean; message?: string; missingData?: string[] };

  /** رسالة مخصصة عند عدم وجود البيانات */
  emptyMessage?: string;

  /** عنوان الزر للانتقال لإضافة البيانات */
  actionLabel?: string;

  /** رابط الانتقال لإضافة البيانات */
  actionLink?: string;

  /** دالة تُنفذ عند الضغط على زر الإضافة */
  onAction?: () => void;

  /** إظهار أيقونة تحذير */
  showWarning?: boolean;
}

/**
 * مكون DataGuard
 * يتحقق من وجود البيانات المطلوبة قبل عرض المحتوى
 */
export const DataGuard: React.FC<DataGuardProps> = ({
  children,
  check,
  emptyMessage,
  actionLabel,
  actionLink,
  onAction,
  showWarning = true,
}) => {
  const result = check();

  // إذا كانت البيانات موجودة، عرض المحتوى
  if (result.isValid) {
    return <>{children}</>;
  }

  // إذا لم تكن البيانات موجودة، عرض رسالة تنبيه
  return (
    <div className="flex items-center justify-center min-h-[400px] p-8">
      <Card className="max-w-md w-full p-8 text-center">
        {/* أيقونة */}
        <div className="flex justify-center mb-6">
          {showWarning ? (
            <div className="w-20 h-20 rounded-full bg-yellow-100 dark:bg-yellow-900/20 flex items-center justify-center">
              <AlertTriangle className="w-10 h-10 text-yellow-600 dark:text-yellow-500" />
            </div>
          ) : (
            <div className="w-20 h-20 rounded-full bg-indigo-100 dark:bg-indigo-900/20 flex items-center justify-center">
              <Database className="w-10 h-10 text-indigo-600 dark:text-indigo-500" />
            </div>
          )}
        </div>

        {/* العنوان */}
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-3">لا توجد بيانات</h2>

        {/* الرسالة */}
        <p className="text-slate-600 dark:text-slate-400 mb-6">
          {emptyMessage || result.message || 'لا توجد بيانات لعرضها'}
        </p>

        {/* البيانات المفقودة */}
        {result.missingData && result.missingData.length > 0 && (
          <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">البيانات المفقودة:</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {result.missingData.map((item) => (
                <span
                  key={item}
                  className="px-3 py-1 bg-white dark:bg-slate-800 rounded-full text-xs font-medium text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                >
                  {getDataLabel(item)}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* زر الإجراء */}
        {(actionLabel || onAction || actionLink) && (
          <div className="flex justify-center gap-3">
            {onAction && (
              <Button onClick={onAction} className="gap-2">
                <Plus size={18} />
                {actionLabel || 'إضافة بيانات'}
              </Button>
            )}

            {actionLink && (
              <Button
                onClick={() => (window.location.hash = actionLink)}
                variant="outline"
                className="gap-2"
              >
                <ArrowRight size={18} />
                الانتقال
              </Button>
            )}
          </div>
        )}
      </Card>
    </div>
  );
};

/**
 * تحويل اسم البيانات إلى تسمية عربية
 */
const getDataLabel = (dataType: string): string => {
  const labels: Record<string, string> = {
    people: 'الأشخاص',
    properties: 'العقارات',
    contracts: 'العقود',
    installments: 'الأقساط',
    person: 'الشخص',
    property: 'العقار',
    contract: 'العقد',
    personId: 'معرف الشخص',
    propertyId: 'معرف العقار',
    contractId: 'معرف العقد',
  };

  return labels[dataType] || dataType;
};
