/**
 * © 2025 - Developed by Mahmoud Qattoush
 * Sales Tracking Layer - Pipeline and transaction tracking
 */

import React, { useMemo } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, ShoppingCart, ClipboardList, CheckCircle, Clock, DollarSign } from 'lucide-react';
import { DashboardData } from '@/hooks/useDashboardData';

interface SalesTrackingLayerProps {
  data: DashboardData;
}

export const SalesTrackingLayer: React.FC<SalesTrackingLayerProps> = ({ data }) => {
  // ✅ Recent sales from real completed sale agreements
  const recentSales = useMemo(() => {
    try {
      const agreements = data.salesAgreements || [];
      const listings = data.salesListings || [];
      const people = data.people || [];
      const properties = data.properties || [];

      const completed = agreements
        .filter((a: any) => a?.isCompleted)
        .sort((a: any, b: any) => {
          const da = new Date(a.transferDate || a.createdAt || 0).getTime();
          const db = new Date(b.transferDate || b.createdAt || 0).getTime();
          return db - da;
        })
        .slice(0, 6);

      return completed.map((a: any) => {
        const listing = listings.find((l: any) => l.id === a.listingId);
        const property = listing ? properties.find((p: any) => p.رقم_العقار === listing.رقم_العقار) : null;
        const buyer = a.رقم_المشتري ? people.find((p: any) => p.رقم_الشخص === a.رقم_المشتري) : null;

        const amount = Number(a.salePrice ?? listing?.السعر_المطلوب ?? 0) || 0;
        const dateStr = (a.transferDate || a.createdAt || '').toString().split('T')[0];

        return {
          propertyLabel: property?.الكود_الداخلي || property?.العنوان || listing?.id || 'عقار',
          buyerName: buyer?.الاسم || '—',
          date: dateStr || '—',
          amount
        };
      });
    } catch {
      return [] as { propertyLabel: string; buyerName: string; date: string; amount: number }[];
    }
  }, [data.salesAgreements, data.salesListings, data.people, data.properties, data.meta?.updatedAt]);

  // ✅ Sales pipeline data from real sales listings
  const pipelineData = useMemo(() => {
    const salesListings = data.salesListings || [];

    const stages = {
      'Active': { stage: 'عروض جديدة', count: 0, value: 0, color: '#3b82f6' },
      'Pending': { stage: 'تحت التفاوض', count: 0, value: 0, color: '#f59e0b' },
      'On Hold': { stage: 'في الانتظار', count: 0, value: 0, color: '#8b5cf6' },
      'Sold': { stage: 'مكتملة', count: 0, value: 0, color: '#10b981' },
    };

    salesListings.forEach((sale: any) => {
      const status = sale.الحالة || 'Active';
      if (stages[status as keyof typeof stages]) {
        stages[status as keyof typeof stages].count++;
        stages[status as keyof typeof stages].value += sale.السعر_المطلوب || 0;
      }
    });

    const out = Object.values(stages);
    const total = out.reduce((sum, s) => sum + (Number(s.value) || 0), 0);
    return out.map((s) => ({
      ...s,
      percent: total > 0 ? (s.value / total) * 100 : 0,
    }));
  }, [data.salesListings, data.meta?.updatedAt]);

  // ✅ Sales by agent from real data
  const salesByAgent = useMemo(() => {
    const contracts = data.contracts || [];
    const people = data.people || [];
    const agentSales: { [key: string]: { sales: number; value: number } } = {};

    contracts.forEach((contract: any) => {
      const agentId = contract.رقم_الوكيل;
      if (agentId) {
        if (!agentSales[agentId]) {
          agentSales[agentId] = { sales: 0, value: 0 };
        }
        agentSales[agentId].sales++;
        agentSales[agentId].value += contract.قيمة_العقد || 0;
      }
    });

    return Object.entries(agentSales).map(([agentId, stats]) => {
      const agent = people.find((p: any) => String(p.رقم_الشخص) === String(agentId));
      return {
        agent: agent?.الاسم || `وكيل ${agentId}`,
        sales: stats.sales,
        value: stats.value
      };
    }).slice(0, 5); // Top 5 agents
  }, [data.contracts, data.people, data.meta?.updatedAt]);

  // ✅ Daily sales trend from real contracts
  const dailyTrend = useMemo(() => {
    const contracts = data.contracts || [];
    const days = ['السبت', 'الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];
    const dailyData: { [key: string]: { sales: number; value: number } } = {};

    // Initialize all days
    days.forEach(day => {
      dailyData[day] = { sales: 0, value: 0 };
    });

    // Get last 7 days
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dayName = days[date.getDay()];
      const dateStr = date.toISOString().split('T')[0];

      contracts.forEach((contract: any) => {
        const contractDate = String(contract.تاريخ_البداية || '').split('T')[0];
        if (contractDate === dateStr) {
          dailyData[dayName].sales++;
          dailyData[dayName].value += contract.قيمة_العقد || 0;
        }
      });
    }

    return days.map(day => ({
      day,
      sales: dailyData[day].sales,
      value: dailyData[day].value
    }));
  }, [data.contracts, data.meta?.updatedAt]);

  // ✅ Calculate real metrics
  const totalSalesThisMonth = useMemo(() => {
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const agreements = data.salesAgreements || [];

    return agreements.filter((a: any) => {
      if (!a?.isCompleted) return false;
      const d = new Date(a.transferDate || a.createdAt || 0);
      if (Number.isNaN(d.getTime())) return false;
      return d >= firstDayOfMonth && d <= today;
    }).length;
  }, [data.salesAgreements, data.meta?.updatedAt]);

  const avgClosingTime = useMemo(() => {
    const salesListings = data.salesListings || [];
    const soldListings = salesListings.filter((s: any) => s.الحالة === 'Sold');

    if (soldListings.length === 0) return 0;

    const totalDays = soldListings.reduce((sum: number, sale: any) => {
      if (sale.تاريخ_الإنشاء && sale.تاريخ_البيع) {
        const created = new Date(sale.تاريخ_الإنشاء);
        const sold = new Date(sale.تاريخ_البيع);
        const days = Math.ceil((sold.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
        return sum + days;
      }
      return sum;
    }, 0);

    return Math.round(totalDays / soldListings.length);
  }, [data.salesListings, data.meta?.updatedAt]);

  // Key metrics
  const metrics = [
    {
      icon: ShoppingCart,
      label: 'إجمالي المبيعات الشهر الحالي',
      value: totalSalesThisMonth,
      trend: `${totalSalesThisMonth > 0 ? '+' : ''}${totalSalesThisMonth}`,
      color: 'from-green-500 to-green-600'
    },
    {
      icon: DollarSign,
      label: 'قيمة المبيعات',
      value: `${(data.sales.totalValue || 0).toLocaleString('ar-SA')}`,
      trend: `${data.sales.completed} مبيعة`,
      color: 'from-indigo-500 to-indigo-600'
    },
    {
      icon: Clock,
      label: 'متوسط وقت الإغلاق',
      value: avgClosingTime > 0 ? `${avgClosingTime} يوم` : 'لا يوجد',
      trend: avgClosingTime > 0 ? 'متوسط' : '-',
      color: 'from-orange-500 to-orange-600'
    },
  ];

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {metrics.map((metric, index) => {
          const Icon = metric.icon;
          return (
            <div
              key={index}
              className={`bg-gradient-to-br ${metric.color} text-white p-6 rounded-2xl shadow-lg hover:shadow-xl transition group`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium opacity-90">{metric.label}</p>
                  <p className="text-3xl font-bold mt-2">{metric.value}</p>
                  <p className="text-sm opacity-75 mt-2 flex items-center gap-1">
                    <TrendingUp size={14} />
                    {metric.trend} هذا الشهر
                  </p>
                </div>
                <Icon className="w-12 h-12 opacity-20 group-hover:opacity-30 transition" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Sales Pipeline */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm">
        <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-6 flex items-center gap-2">
          <ClipboardList className="text-indigo-500" />
          خط أنابيب المبيعات
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {pipelineData.map((stage, index) => (
            <div
              key={index}
              className="p-4 bg-gray-50 dark:bg-slate-700 rounded-xl border border-gray-200 dark:border-slate-600 hover:shadow-md transition"
            >
              <div className="flex items-center gap-2 mb-3">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: stage.color }}
                ></div>
                <p className="font-bold text-slate-700 dark:text-slate-300">{stage.stage}</p>
              </div>
              <div className="space-y-2">
                <div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{stage.count}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">عقد</p>
                </div>
                <div>
                  <p className="text-lg font-semibold text-slate-800 dark:text-slate-200">
                    {(stage.value / 1000).toFixed(0)}K
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">القيمة الإجمالية</p>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-slate-600">
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  النسبة: {Number(stage.percent || 0).toFixed(1)}%
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Sales Trend */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm">
          <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
            <TrendingUp className="text-green-500" />
            الاتجاه اليومي للمبيعات
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dailyTrend} margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
              <defs>
                <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.1}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ff" />
              <XAxis dataKey="day" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px', color: '#e2e8f0' }}
                formatter={(value) => value.toLocaleString('ar-SA')}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="sales" 
                stroke="#10b981" 
                strokeWidth={2}
                dot={{ fill: '#10b981', r: 5 }}
                name="عدد المبيعات"
              />
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke="#3b82f6" 
                strokeWidth={2}
                dot={{ fill: '#3b82f6', r: 5 }}
                name="القيمة (ر.س)"
                yAxisId="right"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Sales by Agent */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm">
          <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
            <ShoppingCart className="text-purple-500" />
            المبيعات حسب الوكيل
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={salesByAgent} margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ff" />
              <XAxis dataKey="agent" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px', color: '#e2e8f0' }}
                formatter={(value) => value.toLocaleString('ar-SA')}
              />
              <Legend />
              <Bar dataKey="sales" fill="#8b5cf6" radius={[8, 8, 0, 0]} name="عدد المبيعات" />
              <Bar dataKey="value" fill="#3b82f6" radius={[8, 8, 0, 0]} name="القيمة" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Sales */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm">
        <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
          <CheckCircle className="text-green-500" />
          آخر المبيعات
        </h3>

        {recentSales.length === 0 ? (
          <div className="text-center py-10 text-slate-500 dark:text-slate-400">
            لا توجد مبيعات لعرضها حالياً
          </div>
        ) : (
          <div className="space-y-3">
            {recentSales.map((sale, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-700 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-600 transition"
              >
                <div className="flex-1">
                  <p className="font-bold text-slate-900 dark:text-white">{sale.propertyLabel}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{sale.buyerName} • {sale.date}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-green-600 dark:text-green-400">{sale.amount.toLocaleString('ar-SA')} ر.س</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
