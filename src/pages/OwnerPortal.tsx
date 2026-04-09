/**
 * لوحة تحكم المالك
 * صفحة خاصة بمالكي العقارات لعرض بياناتهم
 */

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Navigate } from 'react-router-dom';
import { getOwnerReport } from '@/services/ownerReport';
import { getPeopleByRole } from '@/services/db/people';
import { formatCurrencyJOD, formatDateYMD } from '@/utils/format';
import { Home, FileText, BarChart3, Receipt } from 'lucide-react';
import type { OwnerReportData } from '@/services/ownerReport';

const tabs = [
  { id: 'properties', label: 'عقاراتي', icon: Home },
  { id: 'contracts', label: 'عقودي', icon: FileText },
  { id: 'revenue', label: 'إيراداتي', icon: BarChart3 },
  { id: 'statement', label: 'كشف الحساب', icon: Receipt },
];

export function OwnerPortal() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('properties');
  const [report, setReport] = useState<OwnerReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedOwnerId, setSelectedOwnerId] = useState<string | null>(null);
  const [owners, setOwners] = useState<{id: string, name: string}[]>([]);

  useEffect(() => {
    // جلب قائمة جميع المالكين
    const ownersList = getPeopleByRole('مالك').map(p => ({
      id: p.رقم_الشخص,
      name: p.الاسم
    }));
    setOwners(ownersList);

    if (ownersList.length > 0 && !selectedOwnerId) {
      setSelectedOwnerId(ownersList[0].id);
    }
  }, []);

  useEffect(() => {
    if (selectedOwnerId) {
      const data = getOwnerReport(selectedOwnerId);
      setReport(data);
      setLoading(false);
    }
  }, [selectedOwnerId]);

  // التحقق من الصلاحيات
  if (!user) {
    return <Navigate to="/dashboard" replace />;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500">لا يوجد بيانات لعرضها</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* رأس الصفحة */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">لوحة المالك</h1>
          {report && <p className="text-gray-500">{report.owner.الاسم}</p>}
        </div>

        <div className="w-full sm:w-auto">
          <select
            value={selectedOwnerId || ''}
            onChange={(e) => setSelectedOwnerId(e.target.value)}
            className="w-full sm:w-64 p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium"
          >
            <option value="">اختر مالك</option>
            {owners.map(owner => (
              <option key={owner.id} value={owner.id}>{owner.name}</option>
            ))}
          </select>
        </div>

        <div className="text-sm text-gray-500">
          تاريخ التحديث: {formatDateYMD(new Date())}
        </div>
      </div>

      {/* بطاقات الملخص */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <p className="text-sm text-gray-500 mb-1">إجمالي المُحصل</p>
          <p className="text-2xl font-bold text-green-600">{formatCurrencyJOD(report.totalCollected)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <p className="text-sm text-gray-500 mb-1">إجمالي العمولات</p>
          <p className="text-2xl font-bold text-amber-600">{formatCurrencyJOD(report.totalCommissions)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <p className="text-sm text-gray-500 mb-1">صافي المبلغ</p>
          <p className="text-2xl font-bold text-blue-600">{formatCurrencyJOD(report.netOwnerAmount)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <p className="text-sm text-gray-500 mb-1">المبلغ المعلق</p>
          <p className="text-2xl font-bold text-red-600">{formatCurrencyJOD(report.pendingAmount)}</p>
        </div>
      </div>

      {/* التبويبات */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="flex overflow-x-auto border-b border-gray-200">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors
                  ${activeTab === tab.id
                    ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'}
                `}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="p-4">
          {/* عقاراتي */}
          {activeTab === 'properties' && (
            <div className="space-y-4">
              <h3 className="font-medium text-gray-900 mb-4">العقارات المملوكة ({report.properties.length})</h3>
              <div className="grid gap-3">
                {report.properties.map((p) => (
                  <div key={p.رقم_العقار} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium">{p.الكود_الداخلي || p.رقم_العقار}</p>
                      <p className="text-sm text-gray-500">{p.العنوان || '-'}</p>
                    </div>
                    <span className={`
                      px-2 py-1 rounded text-xs font-medium
                      ${p.حالة_العقار === 'مؤجر' ? 'bg-green-100 text-green-700' :
                        p.حالة_العقار === 'شاغر' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}
                    `}>
                      {p.حالة_العقار || 'غير محدد'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* عقودي */}
          {activeTab === 'contracts' && (
            <div className="space-y-4">
              <h3 className="font-medium text-gray-900 mb-4">العقود النشطة ({report.activeContracts.length})</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-4 py-2 text-right font-medium text-gray-600">رقم العقد</th>
                      <th className="px-4 py-2 text-right font-medium text-gray-600">العقار</th>
                      <th className="px-4 py-2 text-right font-medium text-gray-600">تاريخ البداية</th>
                      <th className="px-4 py-2 text-right font-medium text-gray-600">تاريخ النهاية</th>
                      <th className="px-4 py-2 text-right font-medium text-gray-600">الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.activeContracts.map((c) => (
                      <tr key={c.رقم_العقد} className="border-t border-gray-100">
                        <td className="px-4 py-3">{c.رقم_العقد}</td>
                        <td className="px-4 py-3">{c.رقم_العقار}</td>
                        <td className="px-4 py-3">{c.تاريخ_البداية}</td>
                        <td className="px-4 py-3">{c.تاريخ_النهاية}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-1 rounded text-xs bg-green-100 text-green-700">نشط</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* إيراداتي */}
          {activeTab === 'revenue' && (
            <div className="space-y-4">
              <h3 className="font-medium text-gray-900 mb-4">الإيرادات الشهرية</h3>
              <div className="space-y-3">
                {Object.entries(report.byMonth).sort().reverse().slice(0, 12).map(([month, data]) => (
                  <div key={month} className="flex items-center gap-4">
                    <span className="w-20 text-sm text-gray-600">{month}</span>
                    <div className="flex-1">
                      <div className="h-6 bg-gray-100 rounded relative overflow-hidden">
                        <div
                          className="absolute inset-y-0 right-0 bg-blue-500 rounded"
                          style={{ width: `${Math.min((data.collected / Math.max(...Object.values(report.byMonth).map((m) => m.collected), 1)) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                    <span className="w-24 text-right text-sm font-medium">{formatCurrencyJOD(data.net)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* كشف الحساب */}
          {activeTab === 'statement' && (
            <div className="space-y-4">
              <h3 className="font-medium text-gray-900 mb-4">تفاصيل الدفعات</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-4 py-2 text-right font-medium text-gray-600">التاريخ</th>
                      <th className="px-4 py-2 text-right font-medium text-gray-600">رقم العقد</th>
                      <th className="px-4 py-2 text-right font-medium text-gray-600">المبلغ</th>
                      <th className="px-4 py-2 text-right font-medium text-gray-600">العمولة</th>
                      <th className="px-4 py-2 text-right font-medium text-gray-600">الصافي</th>
                      <th className="px-4 py-2 text-right font-medium text-gray-600">الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.installments.slice(0, 30).map((i) => (
                      <tr key={i.رقم_الكمبيالة} className="border-t border-gray-100">
                        <td className="px-4 py-3">{i.تاريخ_استحقاق}</td>
                        <td className="px-4 py-3">{i.contractNumber}</td>
                        <td className="px-4 py-3">{formatCurrencyJOD(i.القيمة)}</td>
                        <td className="px-4 py-3">{formatCurrencyJOD(i.commission)}</td>
                        <td className="px-4 py-3">{formatCurrencyJOD(i.net)}</td>
                        <td className="px-4 py-3">
                          <span className={`
                            px-2 py-1 rounded text-xs
                            ${i.isPaid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}
                          `}>
                            {i.isPaid ? 'مدفوع' : 'معلق'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}