/**
 * إحصائيات متقدمة في لوحة التحكم
 * مؤشرات وأشكال بيانية للنظام
 */

import { useState, useEffect } from 'react';
import { Pie, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title
} from 'chart.js';
import { Home, Clock, AlertTriangle, TrendingUp } from 'lucide-react';
import { getProperties } from '@/services/db/properties';
import { getContracts } from '@/services/db/contracts';
import { getInstallments } from '@/services/db/installments';
import { formatCurrencyJOD } from '@/utils/format';
import { INSTALLMENT_STATUS } from '@/services/db/installmentConstants';

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title
);

export function AdvancedStats() {
  const [stats, setStats] = useState({
    occupancyRate: 0,
    averageRent: 0,
    latePaymentsRate: 0,
    rentedCount: 0,
    vacantCount: 0,
    maintenanceCount: 0,
    monthlyRevenue: Array(12).fill(0)
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = () => {
    const properties = getProperties();
    const contracts = getContracts();
    const allInstallments = getInstallments();
    
    const installments: { حالة_الكمبيالة: string; تاريخ_الدفع?: string; القيمة?: number }[] = allInstallments.map(i => ({
      حالة_الكمبيالة: i.حالة_الكمبيالة,
      تاريخ_الدفع: i.تاريخ_الدفع,
      القيمة: i.القيمة
    }));

    // معدل الإشغال
    const rentedCount = properties.filter(p => p.حالة_العقار === 'مؤجر').length;
    const vacantCount = properties.filter(p => p.حالة_العقار === 'شاغر').length;
    const maintenanceCount = properties.filter(p => p.حالة_العقار === 'صيانة').length;
    const totalProperties = properties.length || 1;
    const occupancyRate = Math.round((rentedCount / totalProperties) * 100);

    // متوسط الإيجار الشهري
    const activeContracts = contracts.filter(c => c.حالة_العقد === 'نشط');
    const totalRent = activeContracts.reduce((sum, c) => sum + (Number(c.القيمة_السنوية) || 0), 0);
    const averageRent = activeContracts.length > 0 ? Math.round((totalRent / 12) / activeContracts.length) : 0;

    // نسبة التأخر
    const dueInstallments = installments.filter(i => i.حالة_الكمبيالة === 'غير مدفوع');
    const lateInstallments: typeof installments = [];
    const latePaymentsRate = dueInstallments.length > 0 ? Math.round((lateInstallments.length / dueInstallments.length) * 100) : 0;

    // الإيرادات الشهرية آخر 12 شهر
    const now = new Date();
    const monthlyRevenue = Array(12).fill(0);
    
    installments.forEach(inst => {
      if (inst.حالة_الكمبيالة === INSTALLMENT_STATUS.PAID && inst.تاريخ_الدفع) {
        const payDate = new Date(inst.تاريخ_الدفع);
        const monthsAgo = (now.getFullYear() - payDate.getFullYear()) * 12 + now.getMonth() - payDate.getMonth();
        
        if (monthsAgo >= 0 && monthsAgo < 12) {
          monthlyRevenue[11 - monthsAgo] += Number(inst.القيمة) || 0;
        }
      }
    });

    setStats({
      occupancyRate,
      averageRent,
      latePaymentsRate,
      rentedCount,
      vacantCount,
      maintenanceCount,
      monthlyRevenue
    });

    setLoading(false);
  };

  if (loading) {
    return <div className="animate-pulse h-64 bg-gray-100 rounded-xl" />;
  }

  const propertyStatusData = {
    labels: ['مؤجر', 'شاغر', 'صيانة'],
    datasets: [
      {
        data: [stats.rentedCount, stats.vacantCount, stats.maintenanceCount],
        backgroundColor: ['#22c55e', '#ef4444', '#f59e0b'],
        borderWidth: 0
      }
    ]
  };

  const months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  const revenueData = {
    labels: months.slice(-12),
    datasets: [
      {
        label: 'الإيرادات الشهرية',
        data: stats.monthlyRevenue,
        backgroundColor: '#3b82f6',
        borderRadius: 6
      }
    ]
  };

  return (
    <div className="space-y-6">
      {/* بطاقات المؤشرات */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-green-100 rounded-lg">
              <Home className="w-5 h-5 text-green-600" />
            </div>
            <span className="text-sm text-gray-500">معدل الإشغال</span>
          </div>
          <p className="text-2xl font-bold text-green-600">{stats.occupancyRate}%</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-100 rounded-lg">
              <TrendingUp className="w-5 h-5 text-blue-600" />
            </div>
            <span className="text-sm text-gray-500">متوسط الإيجار</span>
          </div>
          <p className="text-2xl font-bold text-blue-600">{formatCurrencyJOD(stats.averageRent)}</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <span className="text-sm text-gray-500">نسبة التأخر</span>
          </div>
          <p className="text-2xl font-bold text-red-600">{stats.latePaymentsRate}%</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-amber-100 rounded-lg">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <span className="text-sm text-gray-500">إجمالي العقارات</span>
          </div>
          <p className="text-2xl font-bold text-amber-600">{stats.rentedCount + stats.vacantCount + stats.maintenanceCount}</p>
        </div>
      </div>

      {/* الرسوم البيانية */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <h3 className="font-medium text-gray-900 mb-4">توزيع العقارات</h3>
          <div className="h-64 flex items-center justify-center">
            <Pie data={propertyStatusData} options={{ maintainAspectRatio: false }} />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <h3 className="font-medium text-gray-900 mb-4">الإيرادات الشهرية آخر 12 شهر</h3>
          <div className="h-64">
            <Bar
              data={revenueData}
              options={{
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true } }
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}