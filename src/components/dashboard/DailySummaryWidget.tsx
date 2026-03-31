/**
 * © 2025 — Developed by Mahmoud Qattoush
 * AZRAR Real Estate Management System — All Rights Reserved
 *
 * Daily Summary Widget - ملخص يومي للإشعارات والأحداث
 */

import {
  Bell,
  Calendar,
  AlertTriangle,
  TrendingUp,
  Clock,
  FileText,
  Home,
  ArrowRight,
} from 'lucide-react';
import { DbService } from '@/services/mockDb';
import { ROUTE_PATHS } from '@/routes/paths';
import { useSmartModal } from '@/context/ModalContext';
import { formatDateOnly } from '@/utils/dateOnly';
import { PaymentCollectionSendLog } from '@/components/dashboard/PaymentCollectionSendLog';
import type { DashboardData } from '@/hooks/useDashboardData';
import type { tbl_Alerts } from '@/types';

export interface DailySummaryWidgetProps {
  data: DashboardData;
  isDesktopFast: boolean;
}

const getAlertPriority = (alert: tbl_Alerts): string | undefined => {
  const priority = (alert as unknown as Record<string, unknown>)['الأولوية'];
  return typeof priority === 'string' ? priority : undefined;
};

const getTargetItemsLength = (target: unknown): number => {
  if (!target || typeof target !== 'object') return 0;
  const items = (target as { items?: unknown }).items;
  return Array.isArray(items) ? items.length : 0;
};

export const DailySummaryWidget: React.FC<DailySummaryWidgetProps> = ({ data, isDesktopFast }) => {
  const { openPanel } = useSmartModal();

  const today = formatDateOnly(new Date());
  const alertsSource = data.alertsRaw.length > 0 ? data.alertsRaw : DbService.getAlerts();
  const openAlerts = alertsSource.filter((a) => !a.تم_القراءة);
  const criticalAlerts = openAlerts.filter((a) => getAlertPriority(a) === 'عالية').length;

  const snap = data.dailyOperationalSnapshot;

  const paymentRemindersNext7 =
    isDesktopFast && snap
      ? snap.dueNext7Payments
      : DbService.getPaymentNotificationTargets(7).reduce(
          (sum, target) => sum + getTargetItemsLength(target),
          0
        );

  const contractsExpiring =
    isDesktopFast && snap
      ? snap.contractsExpiring30
      : DbService.getContracts().filter((c) => {
          const endDate = new Date(c.تاريخ_النهاية);
          const daysUntilExpiry = Math.ceil(
            (endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
          );
          return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
        }).length;

  const maintenanceOpen =
    isDesktopFast && snap
      ? snap.maintenanceOpen
      : DbService.getMaintenanceTickets().filter(
          (m) => m.الحالة === 'مفتوح' || m.الحالة === 'قيد التنفيذ'
        ).length;

  const totalRevenue =
    isDesktopFast && snap
      ? snap.revenueToday
      : DbService.getInstallments()
          .filter((i) => i.تاريخ_استحقاق === today && i.حالة_الكمبيالة === 'مدفوع')
          .reduce((sum, i) => sum + (Number(i.القيمة) || 0), 0);

  const summaryItems = [
    {
      icon: AlertTriangle,
      label: 'تنبيهات حرجة',
      value: criticalAlerts,
      color: 'text-red-600',
      bgColor: 'bg-red-50 dark:bg-red-900/20',
      action: () => {
        window.location.hash = ROUTE_PATHS.ALERTS;
      },
    },
    {
      icon: Clock,
      label: 'تنبيهات قبل الاستحقاق (7 أيام)',
      value: paymentRemindersNext7,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50 dark:bg-indigo-900/20',
      action: () => openPanel('PAYMENT_NOTIFICATIONS', undefined, { daysAhead: 7 }),
    },
    {
      icon: FileText,
      label: 'عقود قريبة الانتهاء',
      value: contractsExpiring,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50 dark:bg-amber-900/20',
      action: () => {
        window.location.hash = ROUTE_PATHS.CONTRACTS;
      },
    },
    {
      icon: Home,
      label: 'صيانة مفتوحة',
      value: maintenanceOpen,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50 dark:bg-indigo-900/20',
      action: () => {
        window.location.hash = ROUTE_PATHS.MAINTENANCE;
      },
    },
    {
      icon: TrendingUp,
      label: 'إيرادات اليوم',
      value: `${totalRevenue.toLocaleString()} د.أ`,
      color: 'text-green-600',
      bgColor: 'bg-green-50 dark:bg-green-900/20',
      action: () => {
        window.location.hash = ROUTE_PATHS.OPERATIONS;
      },
    },
  ];

  return (
    <div className="app-card">
      <div className="p-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
            <Bell size={20} />
          </div>
          <div>
            <h3 className="font-bold text-lg">الملخص اليومي</h3>
            <p className="text-xs text-indigo-100 flex items-center gap-1">
              <Calendar size={12} />
              {new Date().toLocaleDateString('ar-EG', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold">{openAlerts.length}</div>
          <div className="text-xs text-indigo-100">إجمالي التنبيهات</div>
        </div>
      </div>

      <div className="p-3 sm:p-4 grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3">
        {summaryItems.map((item, index) => (
          <button
            key={index}
            type="button"
            onClick={item.action}
            className="p-2.5 sm:p-3 rounded-xl border border-gray-100 dark:border-slate-700 hover:shadow-md transition group text-right"
          >
            <div className="flex items-start justify-between mb-2">
              <div className={`p-2 rounded-lg ${item.bgColor}`}>
                <item.icon size={16} className={item.color} />
              </div>
              <ArrowRight
                size={14}
                className="text-gray-300 group-hover:text-indigo-500 opacity-0 group-hover:opacity-100 transition"
              />
            </div>
            <div className={`text-2xl font-bold ${item.color} mb-1`}>{item.value}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">{item.label}</div>
          </button>
        ))}
      </div>

      <div className="border-t border-gray-100 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-900/20">
        <PaymentCollectionSendLog />
      </div>
    </div>
  );
};
