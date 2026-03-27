/**
 * © 2025 — Developed by Mahmoud Qattoush
 * AZRAR Real Estate Management System — All Rights Reserved
 *
 * Daily Summary Widget - ملخص يومي للإشعارات والأحداث
 */

import React, { useState, useEffect } from 'react';
import {
  Bell,
  Calendar,
  AlertTriangle,
  CheckCircle,
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
import { dashboardSummarySmart } from '@/services/domainQueries';
import type { tbl_Alerts } from '@/types';

interface DailySummary {
  date: string;
  totalAlerts: number;
  criticalAlerts: number;
  paymentsToday: number;
  paymentRemindersNext7: number;
  contractsExpiring: number;
  maintenanceOpen: number;
  newContracts: number;
  totalRevenue: number;
}

export const DailySummaryWidget: React.FC = () => {
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const { openPanel } = useSmartModal();

  useEffect(() => {
    void loadDailySummary();
  }, []);

  const loadDailySummary = async () => {
    const today = formatDateOnly(new Date());
    const alerts: tbl_Alerts[] = DbService.getAlerts();

    const isDesktop = typeof window !== 'undefined' && !!window.desktopDb;

    const toYMD = (d: Date) => {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    };
    const todayYMD = toYMD(new Date());
    const weekFromNow = new Date();
    weekFromNow.setDate(weekFromNow.getDate() + 7);
    const weekYMD = toYMD(weekFromNow);

    const desktopSummary = await dashboardSummarySmart({ todayYMD, weekYMD });
    const isDesktopFast = isDesktop && !!desktopSummary;

    // حساب الإحصائيات (تنبيهات مفتوحة فقط)
    const openAlerts = alerts.filter((a) => !a.تم_القراءة);
    const getAlertPriority = (alert: tbl_Alerts): string | undefined => {
      const priority = (alert as unknown as Record<string, unknown>)['الأولوية'];
      return typeof priority === 'string' ? priority : undefined;
    };
    const criticalAlerts = openAlerts.filter((a) => getAlertPriority(a) === 'عالية').length;

    const paymentsToday = isDesktopFast
      ? Number(desktopSummary?.paymentsToday || 0) || 0
      : isDesktop
        ? 0
        : DbService.getInstallments().filter(
            (i) => i.تاريخ_استحقاق === today && i.حالة_الكمبيالة === 'مدفوع'
          ).length;

    // ✅ Payment notifications policy: pre-due reminders only (align with panel)
    const getTargetItemsLength = (target: unknown): number => {
      if (!target || typeof target !== 'object') return 0;
      const items = (target as { items?: unknown }).items;
      return Array.isArray(items) ? items.length : 0;
    };

    const paymentRemindersNext7 = isDesktopFast
      ? Number(desktopSummary?.dueNext7Payments || 0) || 0
      : isDesktop
        ? 0
        : DbService.getPaymentNotificationTargets(7).reduce(
            (sum, target) => sum + getTargetItemsLength(target),
            0
          );

    const contractsExpiring = isDesktopFast
      ? Number(desktopSummary?.contractsExpiring30 || 0) || 0
      : isDesktop
        ? 0
        : DbService.getContracts().filter((c) => {
            const endDate = new Date(c.تاريخ_النهاية);
            const daysUntilExpiry = Math.ceil(
              (endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
            );
            return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
          }).length;

    const maintenanceOpen = isDesktopFast
      ? Number(desktopSummary?.maintenanceOpen || 0) || 0
      : isDesktop
        ? 0
        : DbService.getMaintenanceTickets().filter(
            (m) => m.الحالة === 'مفتوح' || m.الحالة === 'قيد التنفيذ'
          ).length;

    const newContracts = 0; // لا يوجد تاريخ إنشاء في نموذج العقود الحالي

    const totalRevenue = isDesktopFast
      ? Number(desktopSummary?.revenueToday || 0) || 0
      : isDesktop
        ? 0
        : DbService.getInstallments()
            .filter((i) => i.تاريخ_استحقاق === today && i.حالة_الكمبيالة === 'مدفوع')
            .reduce((sum, i) => sum + (Number(i.القيمة) || 0), 0);

    setSummary({
      date: today,
      totalAlerts: openAlerts.length,
      criticalAlerts,
      paymentsToday,
      paymentRemindersNext7,
      contractsExpiring,
      maintenanceOpen,
      newContracts,
      totalRevenue,
    });
  };

  if (!summary) return null;

  const summaryItems = [
    {
      icon: AlertTriangle,
      label: 'تنبيهات حرجة',
      value: summary.criticalAlerts,
      color: 'text-red-600',
      bgColor: 'bg-red-50 dark:bg-red-900/20',
      action: () => (window.location.hash = ROUTE_PATHS.ALERTS),
    },
    {
      icon: Clock,
      label: 'تنبيهات قبل الاستحقاق (7 أيام)',
      value: summary.paymentRemindersNext7,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50 dark:bg-indigo-900/20',
      action: () => openPanel('PAYMENT_NOTIFICATIONS', undefined, { daysAhead: 7 }),
    },
    {
      icon: FileText,
      label: 'عقود قريبة الانتهاء',
      value: summary.contractsExpiring,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50 dark:bg-amber-900/20',
      action: () => (window.location.hash = ROUTE_PATHS.CONTRACTS),
    },
    {
      icon: Home,
      label: 'صيانة مفتوحة',
      value: summary.maintenanceOpen,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50 dark:bg-indigo-900/20',
      action: () => (window.location.hash = ROUTE_PATHS.MAINTENANCE),
    },
    {
      icon: CheckCircle,
      label: 'عقود جديدة اليوم',
      value: summary.newContracts,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50 dark:bg-emerald-900/20',
      action: () => (window.location.hash = ROUTE_PATHS.CONTRACTS),
    },
    {
      icon: TrendingUp,
      label: 'إيرادات اليوم',
      value: `${summary.totalRevenue.toLocaleString()} د.أ`,
      color: 'text-green-600',
      bgColor: 'bg-green-50 dark:bg-green-900/20',
      action: () => (window.location.hash = ROUTE_PATHS.OPERATIONS),
    },
  ];

  return (
    <div className="app-card">
      {/* Header */}
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
          <div className="text-2xl font-bold">{summary.totalAlerts}</div>
          <div className="text-xs text-indigo-100">إجمالي التنبيهات</div>
        </div>
      </div>

      {/* Summary Grid */}
      <div className="p-4 grid grid-cols-2 md:grid-cols-3 gap-3">
        {summaryItems.map((item, index) => (
          <button
            key={index}
            onClick={item.action}
            className="p-3 rounded-xl border border-gray-100 dark:border-slate-700 hover:shadow-md transition group text-right"
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

      {/* Sent Notifications History */}
      <div className="border-t border-gray-100 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-900/20">
        <PaymentCollectionSendLog />
      </div>
    </div>
  );
};
