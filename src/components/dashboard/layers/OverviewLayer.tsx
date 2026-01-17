/**
 * © 2025 - Developed by Mahmoud Qattoush
 * Overview Layer - Financial and system overview
 */

import React, { useMemo } from 'react';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, Building2, Users, DollarSign } from 'lucide-react';
import { DashboardData } from '@/hooks/useDashboardData';
import type { العمليات_tbl } from '@/types';
import { formatCurrencyJOD } from '@/utils/format';

const toRecord = (v: unknown): Record<string, unknown> => (typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {});

const isOperationLog = (v: unknown): v is العمليات_tbl => {
  const rec = toRecord(v);
  return typeof rec.id === 'string' && typeof rec['تاريخ_العملية'] === 'string' && typeof rec['نوع_العملية'] === 'string';
};

const getCommissionMonthKey = (comm: unknown): string | null => {
  const rec = toRecord(comm);
  const rawDate = rec['تاريخ_الإنشاء'] ?? rec['تاريخ_العقد'];
  if (typeof rawDate !== 'string' || rawDate.length < 7) return null;
  const date = new Date(rawDate);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

const getPropertyTypeLabel = (prop: unknown): string => {
  const rec = toRecord(prop);
  const t1 = rec['نوع_العقار'];
  if (typeof t1 === 'string' && t1.trim()) return t1;
  const t2 = rec['النوع'];
  if (typeof t2 === 'string' && t2.trim()) return t2;
  return 'غير محدد';
};

interface OverviewLayerProps {
  data: DashboardData;
}

export const OverviewLayer: React.FC<OverviewLayerProps> = ({ data }) => {
  const { commissionsAll, properties, contracts, desktopAggregations, logsRaw } = data;

  // ✅ Generate revenue trend data from real commissions
  const revenueTrendData = useMemo(() => {
    const commissions = commissionsAll || [];
    const monthlyRevenue: { [key: string]: number } = {};

    // Group commissions by month (fallback to تاريخ_العقد when creation date not present)
    commissions.forEach((comm) => {
      const monthKey = getCommissionMonthKey(comm);
      if (!monthKey) return;
      const rec = toRecord(comm);
      const total = rec['المجموع'];
      const amount = typeof total === 'number' ? total : Number(total || 0) || 0;
      monthlyRevenue[monthKey] = (monthlyRevenue[monthKey] || 0) + amount;
    });

    // Get last 12 months
    const months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
    const result = [];
    const today = new Date();

    for (let i = 11; i >= 0; i--) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      result.push({
        month: months[date.getMonth()],
        revenue: monthlyRevenue[monthKey] || 0
      });
    }

    return result;
  }, [commissionsAll]);

  // ✅ Property distribution by type from real data
  const propertyDistribution = useMemo(() => {
    const fromSql = desktopAggregations?.propertyTypeCounts;

    const typeCounts: Array<{ name: string; value: number }> = fromSql
      ? fromSql
      : (() => {
          const list = properties || [];
          const map: Record<string, number> = {};
          list.forEach((prop) => {
            const type = getPropertyTypeLabel(prop as unknown);
            map[type] = (map[type] || 0) + 1;
          });
          return Object.entries(map).map(([name, value]) => ({ name, value }));
        })();

    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];
    return typeCounts.map((row, index) => ({
      name: row.name,
      value: row.value,
      color: colors[index % colors.length]
    }));
  }, [properties, desktopAggregations]);

  // ✅ Contract status distribution from real data
  const contractStatus = useMemo(() => {
    const fromSql = desktopAggregations?.contractStatusCounts;

    const statusCounts: { [key: string]: number } = {};
    if (fromSql) {
      fromSql.forEach((r) => {
        statusCounts[String(r?.name || 'غير محدد')] = Number(r?.value || 0) || 0;
      });
    } else {
      const list = contracts || [];
      list.forEach((contract) => {
        const status = contract.حالة_العقد || 'غير محدد';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });
    }

    const statusColors: { [key: string]: string } = {
      'نشط': '#10b981',
      'مجدد': '#3b82f6',
      'منتهي': '#ef4444',
      'ملغي': '#6b7280',
      'معلق': '#f59e0b'
    };

    return Object.entries(statusCounts).map(([name, value]) => ({
      name,
      value,
      color: statusColors[name] || '#8b5cf6'
    }));
  }, [contracts, desktopAggregations]);

  const overviewStats = [
    {
      icon: Building2,
      label: 'إجمالي العقارات',
      value: data.kpis.totalProperties || 0,
      trend: null,
      color: 'from-indigo-500 to-indigo-600'
    },
    {
      icon: Users,
      label: 'العملاء النشطين',
      value: data.kpis.totalPeople || 0,
      trend: null,
      color: 'from-purple-500 to-purple-600'
    },
    {
      icon: DollarSign,
      label: 'إيرادات الشهر الحالي',
      value: formatCurrencyJOD(data.kpis.totalRevenue || 0),
      trend: null,
      color: 'from-green-500 to-green-600'
    },
  ];

  const systemHealth = data.systemHealth || null;

  const recentActivities = useMemo(() => {
    try {
      const logs = (logsRaw || []).filter(isOperationLog);
      return logs
        .slice()
        .sort((a, b) => new Date(b.تاريخ_العملية).getTime() - new Date(a.تاريخ_العملية).getTime())
        .slice(0, 5)
        .map((l) => ({
          id: l.id,
          title: l.نوع_العملية,
          details: l.details || `${l.اسم_الجدول} • ${l.رقم_السجل}`,
          time: l.تاريخ_العملية?.split('T')[0] || '—'
        }));
    } catch {
      return [] as Array<{ id: string; title: string; details: string; time: string }>;
    }
  }, [logsRaw]);

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {overviewStats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div
              key={index}
              className={`bg-gradient-to-br ${stat.color} text-white p-6 rounded-2xl shadow-lg hover:shadow-xl transition group`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium opacity-90">{stat.label}</p>
                  <p className="text-3xl font-bold mt-2">{stat.value}</p>
                </div>
                <Icon className="w-12 h-12 opacity-20 group-hover:opacity-30 transition" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Revenue Comparisons */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="app-card p-5">
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">مقارنة الإيرادات (شهر)</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 rounded-xl bg-green-50 dark:bg-green-900/20">
              <div className="text-xs text-slate-600 dark:text-slate-400 font-bold mb-1">الشهر الحالي</div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrencyJOD(data.kpis.totalRevenue || 0)}</div>
            </div>
            <div className="p-4 rounded-xl bg-gray-50 dark:bg-slate-900/20">
              <div className="text-xs text-slate-600 dark:text-slate-400 font-bold mb-1">الشهر السابق</div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrencyJOD(data.kpis.previousMonthRevenue || 0)}</div>
            </div>
          </div>
        </div>

        <div className="app-card p-5">
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">مقارنة الإيرادات (سنة)</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-900/20">
              <div className="text-xs text-slate-600 dark:text-slate-400 font-bold mb-1">السنة الحالية</div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrencyJOD(data.kpis.currentYearRevenue || 0)}</div>
            </div>
            <div className="p-4 rounded-xl bg-gray-50 dark:bg-slate-900/20">
              <div className="text-xs text-slate-600 dark:text-slate-400 font-bold mb-1">السنة السابقة</div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrencyJOD(data.kpis.previousYearRevenue || 0)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Trend Chart */}
        <div className="app-card p-6 overflow-visible">
          <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
            <TrendingUp className="text-indigo-500" />
            اتجاه الإيرادات - آخر 12 شهر
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={revenueTrendData} margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ff" />
              <XAxis dataKey="month" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px', color: '#e2e8f0' }}
                formatter={(value) => formatCurrencyJOD(value)}
              />
              <Area 
                type="monotone" 
                dataKey="revenue" 
                stroke="#3b82f6" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorRevenue)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Property Distribution */}
        <div className="app-card p-6 overflow-visible">
          <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
            <Building2 className="text-green-500" />
            توزيع العقارات
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={propertyDistribution}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {propertyDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => value.toString()} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Contract Status */}
        <div className="app-card p-6 overflow-visible">
          <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-4">
            حالة العقود
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={contractStatus} margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ff" />
              <XAxis dataKey="name" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px', color: '#e2e8f0' }}
              />
              <Bar dataKey="value" fill="#3b82f6" radius={[8, 8, 0, 0]}>
                {contractStatus.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* System Health */}
        <div className="app-card p-6 overflow-visible">
          <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-4">
            صحة النظام
          </h3>

          {!systemHealth ? (
            <div className="text-center py-8 text-slate-600 dark:text-slate-400">لا تتوفر بيانات صحة النظام حالياً</div>
          ) : (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-400">مؤشر الصحة</span>
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{systemHealth.score}%</span>
                </div>
                <div className="w-full h-2 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-green-500 to-green-600"
                    style={{ width: `${Math.max(0, Math.min(100, systemHealth.score))}%` }}
                  ></div>
                </div>
              </div>

              <div className={`mt-4 p-3 rounded-lg border ${
                systemHealth.status === 'Excellent' || systemHealth.status === 'Good'
                  ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800'
                  : systemHealth.status === 'Warning'
                  ? 'bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800'
                  : 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'
              }`}>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {systemHealth.status}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="app-card p-6">
        <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-4">
          آخر الأنشطة
        </h3>

        {recentActivities.length === 0 ? (
          <div className="text-center py-8 text-slate-600 dark:text-slate-400">لا توجد أنشطة لعرضها</div>
        ) : (
          <div className="space-y-3">
            {recentActivities.map((a) => (
              <div
                key={a.id}
                className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-slate-700 rounded-lg border border-gray-200 dark:border-slate-600"
              >
                <div className="w-2 h-2 rounded-full bg-indigo-500 mt-2"></div>
                <div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{a.title}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{a.details}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">{a.time}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
