/**
 * © 2025 - Developed by Mahmoud Qattoush
 * KPI Cards Component - Display Key Performance Indicators
 */

import React from 'react';
import {
  TrendingUp,
  DollarSign,
  Briefcase,
  Home,
  AlertTriangle,
  Bell,
  Users,
  CalendarDays,
  Timer,
  Wallet,
  ListTodo,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { DashboardData } from '@/hooks/useDashboardData';
import { useSmartModal } from '@/context/ModalContext';
import { formatCurrencyJOD, formatNumber } from '@/utils/format';
import { ROUTE_PATHS } from '@/routes/paths';
import {
  KpiCalculatorCard,
  KpiQuickCommissionCard,
} from '@/components/dashboard/layers/KpiQuickTools';
import { StatsCardRow } from '@/components/shared/StatsCardRow';

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
  /** يعرض شريط تقدّم نسبة الإشغال (بطاقة العقارات الموحّدة) */
  showOccupancyBar?: boolean;
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

  const goInstallments = () => navigateTo(ROUTE_PATHS.INSTALLMENTS);
  const goInstallmentsDebt = () =>
    navigateToWithQuery(ROUTE_PATHS.INSTALLMENTS, { filter: 'debt' });
  const goContractsExpiring = () =>
    navigateToWithQuery(ROUTE_PATHS.CONTRACTS, { status: 'expiring' });
  const goDashboardCalendar = () => {
    try {
      localStorage.setItem('dashboard_active_layer', 'calendar');
    } catch {
      void 0;
    }
    navigateTo(ROUTE_PATHS.DASHBOARD);
  };

  const totalProperties = Number(data.kpis.totalProperties || 0) || 0;
  const occupiedCount =
    Number(
      data.kpis.occupiedProperties ?? data.properties.filter((p) => p.IsRented === true).length
    ) || 0;
  const vacantCount = Math.max(0, totalProperties - occupiedCount);
  const unreadAlertsTotal =
    (data.alerts?.critical || 0) + (data.alerts?.warning || 0) + (data.alerts?.info || 0);

  /** ترتيب: إجراءات عاجلة → مالية → محفظة العقود والعقارات */
  const cards: KPICard[] = [
    {
      title: 'أقساط اليوم',
      value: formatNumber(data.kpis.dueTodayInstallmentsCount ?? 0),
      icon: CalendarDays,
      color: 'from-sky-500 to-blue-600',
      textColor: 'text-sky-600',
      bgColor: 'bg-sky-50 dark:bg-sky-900/20',
      trend: 'قسط مستحق اليوم (متبقي) — اضغط للانتقال إلى الأقساط',
      onClick: goInstallments,
    },
    {
      title: 'متأخرات التحصيل',
      value: formatCurrencyJOD(data.kpis.overdueCollectionAmount ?? 0),
      icon: Wallet,
      color: 'from-red-600 to-rose-700',
      textColor: 'text-red-600',
      bgColor: 'bg-red-50 dark:bg-red-900/20',
      trend: 'مجموع المتبقي للأقساط المتأخرة',
      onClick: goInstallmentsDebt,
    },
    {
      title: 'مهام متأخرة',
      value: formatNumber(data.tasks?.overdue ?? 0),
      icon: ListTodo,
      color: 'from-violet-500 to-purple-600',
      textColor: 'text-violet-600',
      bgColor: 'bg-violet-50 dark:bg-violet-900/20',
      trend: 'متابعات معلّقة بتاريخ مرّ — طبقة التقويم',
      onClick: goDashboardCalendar,
    },
    {
      title: 'عقود تنتهي قريباً (30 يوماً)',
      value: formatNumber(data.kpis.expiringContracts30dCount ?? 0),
      icon: Timer,
      color: 'from-rose-500 to-orange-500',
      textColor: 'text-rose-600',
      bgColor: 'bg-rose-50 dark:bg-rose-900/20',
      trend: 'عقود سارية تنتهي خلال 30 يوماً',
      onClick: goContractsExpiring,
    },
    {
      title: 'تنبيهات قبل الاستحقاق',
      value: data.kpis.dueNext7Payments,
      icon: AlertTriangle,
      color: 'from-red-500 to-orange-600',
      textColor: 'text-red-600',
      bgColor: 'bg-red-50 dark:bg-red-900/20',
      trend: 'دفعات مستحقة خلال 7 أيام — اضغط للتفاصيل',
      onClick: () => openPanel('NOTIFICATION_CENTER'),
    },
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
            السنة الحالية: {formatCurrencyJOD(data.kpis.currentYearRevenue || 0)} | السنة السابقة:{' '}
            {formatCurrencyJOD(data.kpis.previousYearRevenue || 0)}
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
      title: 'العقارات والإشغال',
      value: `${data.kpis.occupancyRate}%`,
      icon: Home,
      color: 'from-purple-500 to-pink-600',
      textColor: 'text-purple-600',
      bgColor: 'bg-purple-50 dark:bg-purple-900/20',
      trend: `إجمالي ${formatNumber(totalProperties)} عقار • مؤجر ${formatNumber(occupiedCount)} • شاغر ${formatNumber(vacantCount)}`,
      onClick: () => navigateTo(ROUTE_PATHS.PROPERTIES),
      showOccupancyBar: true,
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
  ];

// Removed manual gridClass as we use StatsCardRow

  const renderMetricCard = (card: KPICard, index: number) => {
    const Icon = card.icon;
    const className = `glass-card p-5 sm:p-6 relative group h-full flex flex-col transition-all duration-500 hover:shadow-2xl hover:shadow-indigo-500/10 hover:-translate-y-1 border-white/40 dark:border-slate-800/60 ${
      card.onClick ? 'cursor-pointer' : 'cursor-default'
    }`;

    return (
      <div key={`${card.title}-${index}`} className={className} onClick={card.onClick}>
        <div
          className={`absolute -right-4 -top-4 w-24 h-24 bg-gradient-to-br ${card.color} opacity-0 group-hover:opacity-10 blur-2xl transition-opacity duration-500 rounded-full pointer-events-none`}
        />

        <div className="relative z-10 flex flex-col flex-1 min-h-0">
          <div className="flex items-start justify-between mb-5">
            <div
              className={`p-4 rounded-2xl ${card.bgColor} shadow-inner group-hover:scale-110 transition-transform duration-500`}
            >
              <Icon className={`${card.textColor} group-hover:animate-pulse`} size={24} />
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">
                {card.title}
              </span>
              <div className="text-2xl font-black text-slate-900 dark:text-white tracking-tight group-hover:text-gradient transition-all">
                {card.value}
              </div>
            </div>
          </div>

          <div className="mt-auto pt-4 border-t border-slate-100/50 dark:border-slate-800/50 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 dark:text-slate-400 min-w-0">
              <TrendingUp size={12} className={`${card.textColor} shrink-0`} />
              <span className="leading-snug">{card.trend}</span>
            </div>
            <div
              className={`w-1.5 h-1.5 rounded-full bg-gradient-to-r ${card.color} animate-pulse shrink-0`}
            />
          </div>

          {card.showOccupancyBar && (
            <div className="mt-4 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden shadow-inner">
              <div
                className={`h-full bg-gradient-to-r ${card.color} shadow-lg shadow-indigo-500/20 transition-all duration-1000 ease-out`}
                style={{ width: `${data.kpis.occupancyRate}%` }}
              />
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6" dir="rtl">
      <StatsCardRow>
        {cards.slice(0, 4).map((c, i) => renderMetricCard(c, i))}
      </StatsCardRow>
      <StatsCardRow>
        {cards.slice(4, 8).map((c, i) => renderMetricCard(c, i + 4))}
      </StatsCardRow>
      <StatsCardRow>
        {cards.slice(8, 10).map((c, i) => renderMetricCard(c, i + 8))}
        <KpiCalculatorCard />
        <KpiQuickCommissionCard />
      </StatsCardRow>
    </div>
  );
};
