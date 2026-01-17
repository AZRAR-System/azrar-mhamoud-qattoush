/**
 * © 2025 - Developed by Mahmoud Qattoush
 * KPI Cards Component - Display Key Performance Indicators
 */

import React from 'react';
import { TrendingUp, DollarSign, Briefcase, Home, AlertTriangle, Bell, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { DashboardData } from '@/hooks/useDashboardData';
import { useSmartModal } from '@/context/ModalContext';
import { formatCurrencyJOD, formatNumber } from '@/utils/format';
import { ROUTE_PATHS } from '@/routes/paths';

interface KPICardsProps {
  data: DashboardData;
}

interface KPICard {
  title: string;
  value: React.ReactNode;
  icon: LucideIcon;
  color: string;
  textColor: string;
  bgColor: string;
  trend: React.ReactNode;
  onClick?: () => void;
}

export const KPICards: React.FC<KPICardsProps> = ({ data }) => {
  const { openPanel } = useSmartModal();

  const navigateTo = (path: string) => {
    window.location.hash = path;
  };

  const navigateToWithQuery = (path: string, query: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && String(value).length > 0) params.set(key, String(value));
    });
    const suffix = params.toString() ? `?${params.toString()}` : '';
    window.location.hash = `${path}${suffix}`;
  };

  // ✅ Calculate real trends
  const totalProperties = Number(data.kpis.totalProperties || 0) || 0;
  const occupiedCount = Number(data.kpis.occupiedProperties ?? data.properties.filter(p => p.IsRented === true).length) || 0;
  const vacantCount = Math.max(0, totalProperties - occupiedCount);
  const unreadAlertsTotal = (data.alerts?.critical || 0) + (data.alerts?.warning || 0) + (data.alerts?.info || 0);

  const cards: KPICard[] = [
    {
      title: 'إيرادات الشهر الحالي',
        value: formatCurrencyJOD(data.kpis.totalRevenue),
      icon: DollarSign,
      color: 'from-green-500 to-emerald-600',
      textColor: 'text-green-600',
      bgColor: 'bg-green-50 dark:bg-green-900/20',
      trend: (
        <div className="flex flex-col gap-0.5">
            <div>الشهر السابق: {formatCurrencyJOD(data.kpis.previousMonthRevenue || 0)}</div>
          <div>
              السنة الحالية: {formatCurrencyJOD(data.kpis.currentYearRevenue || 0)} | السنة السابقة: {formatCurrencyJOD(data.kpis.previousYearRevenue || 0)}
          </div>
        </div>
      ),
      onClick: () => navigateTo(ROUTE_PATHS.COMMISSIONS),
    },
    {
      title: 'العقود النشطة',
        value: formatNumber(data.kpis.activeContracts),
      icon: Briefcase,
      color: 'from-indigo-500 to-cyan-600',
      textColor: 'text-indigo-600',
      bgColor: 'bg-indigo-50 dark:bg-indigo-900/20',
      trend: `من ${data.kpis.totalContracts ?? data.contracts.length} عقد`,
      onClick: () => navigateToWithQuery(ROUTE_PATHS.CONTRACTS, { status: 'active' }),
    },
    {
      title: 'نسبة الإشغال',
      value: `${data.kpis.occupancyRate}%`,
      icon: Home,
      color: 'from-purple-500 to-pink-600',
      textColor: 'text-purple-600',
      bgColor: 'bg-purple-50 dark:bg-purple-900/20',
      trend: `${occupiedCount} من ${totalProperties} عقار`,
      onClick: () => navigateToWithQuery(ROUTE_PATHS.PROPERTIES, { occupancy: 'rented' }),
    },
    {
      title: 'عقارات شاغرة',
      value: formatNumber(vacantCount),
      icon: Home,
      color: 'from-amber-500 to-yellow-600',
      textColor: 'text-amber-700 dark:text-amber-300',
      bgColor: 'bg-amber-50 dark:bg-amber-900/20',
      trend: 'عرض العقارات الشاغرة',
      onClick: () => navigateToWithQuery(ROUTE_PATHS.PROPERTIES, { occupancy: 'vacant' }),
    },
    {
      title: 'تنبيهات قبل الاستحقاق',
      value: data.kpis.dueNext7Payments,
      icon: AlertTriangle,
      color: 'from-red-500 to-orange-600',
      textColor: 'text-red-600',
      bgColor: 'bg-red-50 dark:bg-red-900/20',
      trend: `خلال 7 أيام: ${data.kpis.dueNext7Payments}`,
      onClick: () => openPanel('PAYMENT_NOTIFICATIONS', undefined, { daysAhead: 7 }),
    },
    {
      title: 'تنبيهات غير مقروءة',
      value: formatNumber(unreadAlertsTotal),
      icon: Bell,
      color: 'from-amber-500 to-yellow-600',
      textColor: 'text-amber-700 dark:text-amber-300',
      bgColor: 'bg-amber-50 dark:bg-amber-900/20',
      trend: `حرجة: ${data.alerts?.critical || 0} • تحذير: ${data.alerts?.warning || 0} • معلومات: ${data.alerts?.info || 0}`,
      onClick: () => navigateToWithQuery(ROUTE_PATHS.ALERTS, { only: 'unread' }),
    },
    {
      title: 'إجمالي الأشخاص',
        value: formatNumber(data.kpis.totalPeople),
      icon: Users,
      color: 'from-indigo-500 to-indigo-600',
      textColor: 'text-indigo-600',
      bgColor: 'bg-indigo-50 dark:bg-indigo-900/20',
      trend: 'ملاك ومستأجرين ووكلاء',
      onClick: () => navigateTo(ROUTE_PATHS.PEOPLE),
    },
    {
      title: 'العقارات',
      value: data.kpis.totalProperties,
      icon: Home,
      color: 'from-yellow-500 to-orange-600',
      textColor: 'text-yellow-600',
      bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
      trend: `${occupiedCount} مؤجر، ${totalProperties - occupiedCount} شاغر`,
      onClick: () => navigateTo(ROUTE_PATHS.PROPERTIES),
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
      {cards.map((card, index) => {
        const Icon = card.icon;
        const className = `app-card p-6 overflow-hidden relative group hover:shadow-md transition w-full text-right ${
          card.onClick ? 'cursor-pointer hover:-translate-y-0.5' : 'cursor-default'
        }`;

        const content = (
          <>
            {/* Background Gradient */}
            <div
              className={`absolute -right-8 -top-8 w-32 h-32 bg-gradient-to-br ${card.color} opacity-5 rounded-full`}
            ></div>

            <div className="relative z-10">
              {/* Header with Icon */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-600 dark:text-slate-400">{card.title}</h3>
                <div className={`p-3 rounded-xl ${card.bgColor}`}>
                  <Icon className={`${card.textColor}`} size={20} />
                </div>
              </div>

              {/* Value */}
              <div className="mb-2">
                <p className="text-3xl font-bold text-slate-900 dark:text-white">{card.value}</p>
              </div>

              {/* Trend */}
              <div className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400">
                <TrendingUp size={14} className={card.textColor} />
                {card.trend}
              </div>

              {/* Progress Bar (Optional) */}
              {card.title === 'نسبة الإشغال' && (
                <div className="mt-4 h-2 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full bg-gradient-to-r ${card.color} transition-all duration-500`}
                    style={{ width: `${data.kpis.occupancyRate}%` }}
                  ></div>
                </div>
              )}
            </div>
          </>
        );

        return card.onClick ? (
          <button key={index} type="button" onClick={card.onClick} className={className}>
            {content}
          </button>
        ) : (
          <div key={index} className={className}>
            {content}
          </div>
        );
      })}
    </div>
  );
};
