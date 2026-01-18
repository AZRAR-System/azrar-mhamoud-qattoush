/**
 * © 2025 — Developed by Mahmoud Qattoush
 * AZRAR Real Estate Management System — All Rights Reserved
 * 
 * Database Reset Page
 * صفحة حذف البيانات وإعادة تهيئة النظام
 */

import React, { useEffect, useState } from 'react';
import { Trash2, RefreshCw, Database, AlertTriangle, CheckCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { DS } from '@/constants/designSystem';
import { AppModal } from '@/components/ui/AppModal';
import { isSuperAdmin } from '@/utils/roles';
import { ROUTE_PATHS } from '@/routes/paths';
import { clearAllData, resetToFreshState, getDatabaseStats } from '../services/resetDatabase';

const DatabaseReset: React.FC = () => {
  const { user } = useAuth();
  const toast = useToast();
  const [stats, setStats] = useState<Record<string, number>>({});
  const [showConfirm, setShowConfirm] = useState<false | 'reset' | 'clear'>(false);
  const [confirmText, setConfirmText] = useState('');
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isWorking, setIsWorking] = useState(false);

  const isAllowed = isSuperAdmin(user?.الدور);

  const refreshStats = async () => {
    const s = await getDatabaseStats();
    setStats(s);
  };

  useEffect(() => {
    if (!isAllowed) return;
    void refreshStats();
  }, [isAllowed]);

  if (!isAllowed) {
    return (
      <div className="p-6 max-w-3xl mx-auto" dir="rtl">
        <div className="app-card rounded-lg shadow-lg p-6 border-red-200 dark:border-red-900/40">
          <div className="flex items-start gap-3">
            <AlertTriangle className="text-red-600 mt-1" size={24} />
            <div className="flex-1">
              <h1 className="text-xl font-bold text-slate-800 dark:text-white">غير مصرح</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                هذه الصفحة مخصصة للمشرف الأعلى (SuperAdmin) لأنها قد تحذف جميع البيانات.
              </p>
              <button
                onClick={() => {
                  window.location.hash = ROUTE_PATHS.SETTINGS;
                  window.location.reload();
                }}
                className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
              >
                العودة للإعدادات
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleClearAll = async () => {
    if (confirmText !== 'حذف نهائي') {
      toast.warning('يرجى كتابة "حذف نهائي" للتأكيد');
      return;
    }

    setIsWorking(true);
    try {
      const res = await clearAllData();
      setResult(res);
      setShowConfirm(false);
      setConfirmText('');
      await refreshStats();
    
      if (res.success) {
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      }
    } finally {
      setIsWorking(false);
    }
  };

  const handleResetToFresh = async () => {
    if (confirmText !== 'إعادة تهيئة') {
      toast.warning('يرجى كتابة "إعادة تهيئة" للتأكيد');
      return;
    }

    setIsWorking(true);
    try {
      const res = await resetToFreshState();
      setResult(res);
      setShowConfirm(false);
      setConfirmText('');
      await refreshStats();
    
      if (res.success) {
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      }
    } finally {
      setIsWorking(false);
    }
  };

  const totalRecords = Object.values(stats).reduce((sum: number, count: number) => sum + count, 0);

  return (
    <div className="p-6 max-w-4xl mx-auto" dir="rtl">
      <div className="app-card rounded-lg shadow-lg p-6">
        {/* Header */}
        <div className={`${DS.components.pageHeader} pb-4 border-b border-gray-200 dark:border-slate-700`}>
          <div>
            <h1 className={`${DS.components.pageTitle} flex items-center gap-2`}>
              <Database size={22} className="text-indigo-600" />
              إدارة قاعدة البيانات
            </h1>
            <p className={DS.components.pageSubtitle}>حذف البيانات وإعادة تهيئة النظام</p>
          </div>
        </div>

        {/* Stats */}
        <div className="mb-6 p-4 bg-indigo-50 dark:bg-slate-700 rounded-lg">
          <h2 className="text-lg font-bold mb-3 text-gray-800 dark:text-white flex items-center gap-2">
            <Database size={20} />
            إحصائيات البيانات الحالية
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {Object.entries(stats).map(([key, count]) => (
              <div key={key} className="bg-white dark:bg-slate-600 p-3 rounded shadow-sm">
                <div className="text-xs text-gray-500 dark:text-gray-300 truncate">{key}</div>
                <div className="text-xl font-bold text-indigo-600 dark:text-indigo-400">{count}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-indigo-200 dark:border-slate-600">
            <div className="text-lg font-bold text-gray-800 dark:text-white">
              إجمالي السجلات: <span className="text-indigo-600 dark:text-indigo-400">{totalRecords}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-4">
          {/* Reset to Fresh State */}
          <div className="p-4 border-2 border-green-200 dark:border-green-700 rounded-lg bg-green-50 dark:bg-green-900/20">
            <div className="flex items-start gap-3 mb-3">
              <RefreshCw className="text-green-600 dark:text-green-400 mt-1" size={24} />
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-1">إعادة تهيئة النظام</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                  حذف جميع البيانات والاحتفاظ بـ:
                </p>
                <ul className="text-sm text-gray-600 dark:text-gray-300 list-disc list-inside space-y-1 mb-3">
                  <li>مستخدم admin (اسم المستخدم: admin، كلمة المرور: 123456)</li>
                  <li>القوائم الأساسية (Lookups)</li>
                </ul>
                <button
                  onClick={() => setShowConfirm('reset')}
                  disabled={isWorking}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2 transition-colors"
                >
                  <RefreshCw size={18} />
                  إعادة تهيئة النظام
                </button>
              </div>
            </div>
          </div>

          {/* Clear All Data */}
          <div className="p-4 border-2 border-red-200 dark:border-red-700 rounded-lg bg-red-50 dark:bg-red-900/20">
            <div className="flex items-start gap-3 mb-3">
              <AlertTriangle className="text-red-600 dark:text-red-400 mt-1" size={24} />
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-1">حذف جميع البيانات</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                  ⚠️ تحذير: سيتم حذف جميع البيانات نهائياً بدون إمكانية الاسترجاع!
                </p>
                <button
                  onClick={() => setShowConfirm('clear')}
                  disabled={isWorking}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center gap-2 transition-colors"
                >
                  <Trash2 size={18} />
                  حذف جميع البيانات
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Confirmation Dialog */}
        <AppModal
          open={!!showConfirm}
          title="تأكيد العملية"
          onClose={() => {
            setShowConfirm(false);
            setConfirmText('');
          }}
          size="md"
          footer={
            <div className="flex gap-3">
              <button
                onClick={showConfirm === 'reset' ? handleResetToFresh : handleClearAll}
                disabled={isWorking}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                تأكيد
              </button>
              <button
                onClick={() => {
                  setShowConfirm(false);
                  setConfirmText('');
                }}
                disabled={isWorking}
                className="flex-1 px-4 py-2 bg-gray-300 hover:bg-gray-400 dark:bg-slate-600 dark:hover:bg-slate-500 text-gray-800 dark:text-white rounded-lg transition-colors"
              >
                إلغاء
              </button>
            </div>
          }
        >
          {showConfirm ? (
            <>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                {showConfirm === 'reset' ? 'اكتب "إعادة تهيئة" للتأكيد:' : 'اكتب "حذف نهائي" للتأكيد:'}
              </p>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                className="w-full p-3 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-white"
                placeholder={showConfirm === 'reset' ? 'إعادة تهيئة' : 'حذف نهائي'}
                autoFocus
              />
            </>
          ) : null}
        </AppModal>

        {/* Result Message */}
        {result && (
          <div className={`mt-4 p-4 rounded-lg flex items-start gap-3 ${
            result.success
              ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700'
              : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700'
          }`}>
            {result.success ? (
              <CheckCircle className="text-green-600 dark:text-green-400 mt-1" size={24} />
            ) : (
              <AlertTriangle className="text-red-600 dark:text-red-400 mt-1" size={24} />
            )}
            <div className="flex-1">
              <p className={`font-medium ${
                result.success ? 'text-green-800 dark:text-green-300' : 'text-red-800 dark:text-red-300'
              }`}>
                {result.message}
              </p>
              {result.success && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  سيتم إعادة تحميل الصفحة تلقائياً...
                </p>
              )}
            </div>
          </div>
        )}

        {/* Refresh Button */}
        <div className="mt-6 pt-4 border-t border-gray-200 dark:border-slate-700">
          <button
            onClick={() => void refreshStats()}
            disabled={isWorking}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center gap-2 transition-colors"
          >
            <RefreshCw size={18} />
            تحديث الإحصائيات
          </button>
        </div>
      </div>
    </div>
  );
};

export default DatabaseReset;

