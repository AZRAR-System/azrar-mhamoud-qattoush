/**
 * © 2025 — Developed by Mahmoud Qattoush
 * Comprehensive Testing Panel
 * لوحة الفحص الشامل للنظام
 */

import React from 'react';

export const ComprehensiveTestPanel: React.FC = () => {
  return (
    <div className="w-full h-full bg-gray-900 text-gray-100 p-8 overflow-auto" dir="rtl">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-4">الفحص الشامل للنظام</h1>
        <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-4">
          <p className="text-yellow-100">
            تم تعطيل وحدة الفحص الشامل مؤقتاً لأن ملف الاختبارات كان غير متوافق مع نماذج البيانات
            الحالية. يمكن إعادة تفعيلها بعد توحيد الـtypes وتحديث سيناريوهات الاختبار.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ComprehensiveTestPanel;
