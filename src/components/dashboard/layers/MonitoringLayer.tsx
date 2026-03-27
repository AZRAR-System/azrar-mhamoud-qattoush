/**
 * © 2025 - Developed by Mahmoud Qattoush
 * Monitoring Layer - Alerts and system health
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle,
  Zap,
  TrendingDown,
  Bell,
  Activity,
} from 'lucide-react';
import { DashboardData } from '@/hooks/useDashboardData';
import { isTenancyRelevant } from '@/utils/tenancy';
import { useSmartModal } from '@/context/ModalContext';
import { storage } from '@/services/storage';
import { formatDateYMD } from '@/utils/format';

interface MonitoringLayerProps {
  data: DashboardData;
}

interface Alert {
  id: string | number;
  level: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  timestamp: string;
  action: string;
  raw?: unknown;
}

type ApiProbe = {
  mode: 'local' | 'server';
  ok: boolean;
  latencyMs?: number;
  error?: string;
};

type DbProbe = {
  ok: boolean;
  engine: 'sqlite' | 'localStorage';
  sizeMb?: number;
  keys?: number;
  records?: number;
  path?: string;
  error?: string;
};

export const MonitoringLayer: React.FC<MonitoringLayerProps> = ({ data }) => {
  const { openPanel } = useSmartModal();
  const [selectedTab, setSelectedTab] = useState<'all' | 'critical' | 'warning' | 'info'>('all');
  const [allAlerts, setAllAlerts] = useState<Alert[]>([]);
  const [apiProbe, setApiProbe] = useState<ApiProbe>({ mode: 'local', ok: true });
  const [dbProbe, setDbProbe] = useState<DbProbe>({
    ok: true,
    engine: storage.isDesktop() ? 'sqlite' : 'localStorage',
  });

  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const loadRealAlerts = useCallback(() => {
    try {
      const current = dataRef.current;
      const contracts = current.contracts || [];
      const properties = current.properties || [];
      const followUps = current.followUps || [];
      const storedAlerts = current.alertsRaw || [];
      const highlights = current.desktopHighlights;
      const salesListings = current.salesListings || [];

      const alerts: Alert[] = [];
      const today = new Date();

      // ✅ Include stored alerts (if any)
      storedAlerts.slice(0, 5).forEach((a) => {
        const alertType = String(a.نوع_التنبيه || '');
        const isCritical = a.category === 'SmartBehavior' || alertType.includes('خطر');
        const isWarning = alertType.includes('تحذير');

        const level: Alert['level'] = isCritical ? 'critical' : isWarning ? 'warning' : 'info';

        alerts.push({
          id: a.id,
          level,
          title: a.نوع_التنبيه || 'تنبيه',
          description: a.الوصف || '',
          timestamp: formatDateYMD(a.تاريخ_الانشاء),
          action: 'عرض',
          raw: a,
        });
      });

      // ✅ Critical: Contracts expiring soon
      const desktopExpiring = highlights?.expiringContracts ?? [];
      if (desktopExpiring.length > 0 && contracts.length === 0) {
        desktopExpiring.slice(0, 2).forEach((r) => {
          const endDate = new Date(String(r.endDate || ''));
          const daysUntilExpiry = Number.isFinite(endDate.getTime())
            ? Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
            : 0;
          const propertyCode = String(r.propertyCode || '').trim() || 'عقار';

          alerts.push({
            id: `expiring-${String(r.contractId || '')}`,
            level: 'critical',
            title: 'عقد على وشك الانتهاء',
            description: `عقد ${propertyCode} ينتهي خلال ${daysUntilExpiry} يوم`,
            timestamp: `${daysUntilExpiry} يوم`,
            action: 'تجديد',
            raw: { contractId: r.contractId, propertyCode, endDate: r.endDate },
          });
        });
      } else {
        const expiringContracts = contracts.filter((c) => {
          const endDate = new Date(c.تاريخ_النهاية);
          const daysUntilExpiry = Math.ceil(
            (endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
          );
          return isTenancyRelevant(c) && daysUntilExpiry > 0 && daysUntilExpiry <= 30;
        });

        expiringContracts.slice(0, 2).forEach((contract) => {
          const property = properties.find((p) => p.رقم_العقار === contract.رقم_العقار);
          const daysUntilExpiry = Math.ceil(
            (new Date(contract.تاريخ_النهاية).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
          );

          alerts.push({
            id: `expiring-${contract.رقم_العقد}`,
            level: 'critical',
            title: 'عقد على وشك الانتهاء',
            description: `عقد ${property?.الكود_الداخلي || 'عقار'} ينتهي خلال ${daysUntilExpiry} يوم`,
            timestamp: `${daysUntilExpiry} يوم`,
            action: 'تجديد',
            raw: { contract, property },
          });
        });
      }

      // ✅ Warning: Properties with incomplete data
      const desktopIncomplete = highlights?.incompleteProperties ?? [];
      if (desktopIncomplete.length > 0 && properties.length === 0) {
        desktopIncomplete.slice(0, 2).forEach((r) => {
          const propertyCode = String(r.propertyCode || '').trim() || '—';
          alerts.push({
            id: `incomplete-${String(r.propertyId || '')}`,
            level: 'warning',
            title: 'تحديث بيانات مطلوب',
            description: `بيانات العقار (${propertyCode}) تحتاج تحديث`,
            timestamp: '—',
            action: 'تحديث',
            raw: {
              propertyId: r.propertyId,
              propertyCode,
              missing: { water: r.missingWater, electric: r.missingElectric, area: r.missingArea },
            },
          });
        });
      } else {
        const incompleteProperties = properties.filter(
          (p) => !p.رقم_اشتراك_الكهرباء || !p.رقم_اشتراك_المياه || !p.المساحة
        );

        incompleteProperties.slice(0, 2).forEach((property) => {
          alerts.push({
            id: `incomplete-${property.رقم_العقار}`,
            level: 'warning',
            title: 'تحديث بيانات مطلوب',
            description: `بيانات العقار (${property.الكود_الداخلي}) تحتاج تحديث`,
            timestamp: '—',
            action: 'تحديث',
            raw: { property },
          });
        });
      }

      // ✅ Warning: Overdue follow-ups
      const overdueFollowUps = followUps.filter((f) => {
        const followUpDate = new Date(f.dueDate);
        return followUpDate < today && f.status !== 'Done';
      });

      if (overdueFollowUps.length > 0) {
        alerts.push({
          id: 'overdue-followups',
          level: 'warning',
          title: 'متابعات متأخرة',
          description: `يوجد ${overdueFollowUps.length} متابعة متأخرة تحتاج إلى إجراء`,
          timestamp: '—',
          action: 'عرض',
          raw: { overdueFollowUps },
        });
      }

      // ✅ Info: Recent sales
      const recentSales = salesListings.filter((s) => s.الحالة === 'Sold');

      if (recentSales.length > 0) {
        const latestSale = recentSales[0];
        const property = properties.find((p) => p.رقم_العقار === latestSale.رقم_العقار);

        alerts.push({
          id: `sale-${latestSale.id}`,
          level: 'info',
          title: 'مبيعة جديدة',
          description: `تم تسجيل مبيعة جديدة - ${property?.الكود_الداخلي || 'عقار'}`,
          timestamp: '—',
          action: 'عرض',
          raw: { latestSale, property },
        });
      }

      setAllAlerts(alerts);
    } catch (error) {
      console.error('Error loading alerts:', error);
    }
  }, []);

  // ✅ Load real alerts from database
  useEffect(() => {
    loadRealAlerts();
  }, [data.meta?.updatedAt, loadRealAlerts]);

  useEffect(() => {
    let cancelled = false;

    const probeApi = async (): Promise<ApiProbe> => {
      return { mode: 'local', ok: true };
    };

    const probeDb = async (): Promise<DbProbe> => {
      try {
        const isDesktop = storage.isDesktop();
        const keys = await storage.keys();
        const dbKeys = keys.filter((k) => k.startsWith('db_'));

        let bytes = 0;
        let records = 0;

        for (const k of dbKeys) {
          const v = await storage.getItem(k);
          if (typeof v !== 'string') continue;
          bytes += v.length;

          try {
            const parsed = JSON.parse(v);
            if (Array.isArray(parsed)) records += parsed.length;
          } catch {
            // ignore parse failures for non-JSON keys
          }
        }

        const sizeMb = Math.round((bytes / (1024 * 1024)) * 100) / 100;
        const path =
          isDesktop && typeof window.desktopDb?.getPath === 'function'
            ? await window.desktopDb.getPath()
            : undefined;

        return {
          ok: true,
          engine: isDesktop ? 'sqlite' : 'localStorage',
          sizeMb,
          keys: dbKeys.length,
          records,
          path,
        };
      } catch (e: unknown) {
        return {
          ok: false,
          engine: storage.isDesktop() ? 'sqlite' : 'localStorage',
          error: e instanceof Error ? e.message : String(e),
        };
      }
    };

    const run = async () => {
      const [apiRes, dbRes] = await Promise.all([probeApi(), probeDb()]);
      if (cancelled) return;
      setApiProbe(apiRes);
      setDbProbe(dbRes);
    };

    run();
    const intervalId = window.setInterval(run, 20000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  const filteredAlerts =
    selectedTab === 'all' ? allAlerts : allAlerts.filter((a: Alert) => a.level === selectedTab);

  const getAlertIcon = (level: Alert['level']) => {
    switch (level) {
      case 'critical':
        return <AlertTriangle className="text-red-500" />;
      case 'warning':
        return <AlertCircle className="text-orange-500" />;
      case 'info':
        return <Info className="text-indigo-500" />;
      default:
        return <CheckCircle className="text-green-500" />;
    }
  };

  const getAlertColor = (level: Alert['level']) => {
    switch (level) {
      case 'critical':
        return 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800';
      case 'warning':
        return 'bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800';
      case 'info':
        return 'bg-indigo-50 dark:bg-indigo-950 border-indigo-200 dark:border-indigo-800';
      default:
        return 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800';
    }
  };

  // Key metrics
  const alertSummary = [
    {
      icon: AlertTriangle,
      label: 'التنبيهات الحرجة',
      value: allAlerts.filter((a: Alert) => a.level === 'critical').length,
      color: 'from-red-500 to-red-600',
    },
    {
      icon: AlertCircle,
      label: 'تحذيرات',
      value: allAlerts.filter((a: Alert) => a.level === 'warning').length,
      color: 'from-orange-500 to-orange-600',
    },
    {
      icon: Info,
      label: 'معلومات',
      value: allAlerts.filter((a: Alert) => a.level === 'info').length,
      color: 'from-indigo-500 to-indigo-600',
    },
  ];

  type PendingActionItem = {
    action: string;
    assignee: string;
    dueDate: string;
    priority: 'عالية' | 'متوسطة' | 'منخفضة';
  };
  const pendingActions = useMemo<PendingActionItem[]>(() => {
    try {
      const followUps = data.followUps || [];
      const pending = followUps
        .filter((f) => f.status === 'Pending')
        .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
        .slice(0, 6);

      return pending.map((f) => ({
        action: f.task,
        assignee: f.clientName || '—',
        dueDate: formatDateYMD(f.dueDate),
        priority: 'متوسطة',
      }));
    } catch {
      return [];
    }
  }, [data.followUps]);

  return (
    <div className="space-y-6">
      {/* Alert Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {alertSummary.map((item, index) => {
          const Icon = item.icon;
          return (
            <div
              key={index}
              className={`bg-gradient-to-br ${item.color} text-white p-6 rounded-2xl shadow-lg hover:shadow-xl transition group`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium opacity-90">{item.label}</p>
                  <p className="text-3xl font-bold mt-2">{item.value}</p>
                  <p className="text-sm opacity-75 mt-2">يتطلب انتباه</p>
                </div>
                <Icon className="w-12 h-12 opacity-20 group-hover:opacity-30 transition" />
              </div>
            </div>
          );
        })}
      </div>

      {/* System Health Status */}
      <div className="app-card p-6">
        <h3 className="font-bold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
          <Activity className="text-green-500" />
          حالة النظام
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* App Mode */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div
                className={`w-3 h-3 rounded-full ${apiProbe.mode === 'local' ? 'bg-amber-500' : apiProbe.ok ? 'bg-green-500' : 'bg-red-500'}`}
              ></div>
              <p className="font-bold text-slate-700 dark:text-slate-300">وضع التطبيق</p>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">الحالة:</span>
                <span
                  className={`font-bold ${apiProbe.mode === 'local' ? 'text-amber-600 dark:text-amber-400' : apiProbe.ok ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
                >
                  {apiProbe.mode === 'local'
                    ? 'وضع محلي (بدون سيرفر)'
                    : apiProbe.ok
                      ? 'متصل'
                      : 'غير متصل'}
                </span>
              </div>
            </div>
          </div>

          {/* Database Status */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div
                className={`w-3 h-3 rounded-full ${dbProbe.ok ? 'bg-green-500' : 'bg-red-500'}`}
              ></div>
              <p className="font-bold text-slate-700 dark:text-slate-300">قاعدة البيانات</p>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">الحالة:</span>
                <span
                  className={`font-bold ${dbProbe.ok ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
                >
                  {dbProbe.ok ? 'متصلة' : 'غير متاحة'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">حجم البيانات:</span>
                <span className="text-slate-700 dark:text-slate-300 font-bold">
                  {typeof dbProbe.sizeMb === 'number' ? `${dbProbe.sizeMb} MB` : '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">عدد السجلات:</span>
                <span className="text-slate-700 dark:text-slate-300 font-bold">
                  {typeof dbProbe.records === 'number' ? dbProbe.records : '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">المحرك:</span>
                <span className="text-slate-700 dark:text-slate-300 font-bold">
                  {dbProbe.engine === 'sqlite' ? 'SQLite (Desktop)' : 'localStorage (Browser)'}
                </span>
              </div>
              {dbProbe.engine === 'sqlite' && dbProbe.path ? (
                <div className="text-xs text-slate-600 dark:text-slate-400 mt-2 break-words">
                  {dbProbe.path}
                </div>
              ) : null}
              {!dbProbe.ok && dbProbe.error ? (
                <div className="text-xs text-red-600 dark:text-red-400 mt-2 break-words">
                  {dbProbe.error}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Pending Actions */}
      <div className="app-card p-6">
        <h3 className="font-bold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
          <Zap className="text-yellow-500" />
          الإجراءات المعلقة
        </h3>
        {pendingActions.length === 0 ? (
          <div className="text-center py-8 text-slate-600 dark:text-slate-400">
            لا توجد إجراءات معلقة
          </div>
        ) : (
          <div className="space-y-3">
            {pendingActions.map((item, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-700 rounded-lg border border-gray-200 dark:border-slate-600"
              >
                <div>
                  <p className="font-bold text-slate-900 dark:text-white">{item.action}</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{item.assignee}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {item.dueDate}
                  </p>
                  <span
                    className={`text-xs font-bold px-2 py-1 rounded inline-block mt-1 ${
                      item.priority === 'عالية'
                        ? 'bg-red-200 dark:bg-red-900 text-red-800 dark:text-red-200'
                        : item.priority === 'متوسطة'
                          ? 'bg-orange-200 dark:bg-orange-900 text-orange-800 dark:text-orange-200'
                          : 'bg-green-200 dark:bg-green-900 text-green-800 dark:text-green-200'
                    }`}
                  >
                    {item.priority}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Alerts Feed */}
      <div className="app-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
            <Bell className="text-indigo-500" />
            التنبيهات الحديثة
          </h3>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
          {(['all', 'critical', 'warning', 'info'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setSelectedTab(tab)}
              className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition ${
                selectedTab === tab
                  ? 'bg-indigo-500 text-white'
                  : 'bg-gray-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600'
              }`}
            >
              {tab === 'all'
                ? 'الكل'
                : tab === 'critical'
                  ? 'حرجة'
                  : tab === 'warning'
                    ? 'تحذيرات'
                    : 'معلومات'}
            </button>
          ))}
        </div>

        {/* Alerts List */}
        <div className="space-y-3 max-h-[600px] overflow-y-auto">
          {filteredAlerts.length > 0 ? (
            filteredAlerts.map((alert) => (
              <button
                key={alert.id}
                type="button"
                onClick={() => openPanel('GENERIC_ALERT', String(alert.id), { alert })}
                className={`w-full text-right flex items-start gap-3 p-4 rounded-lg border transition hover:shadow-md ${getAlertColor(alert.level)}`}
              >
                <div className="flex-shrink-0 mt-1">{getAlertIcon(alert.level)}</div>
                <div className="flex-1">
                  <p className="font-bold text-slate-900 dark:text-white">{alert.title}</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    {alert.description}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-500 mt-2">
                    {alert.timestamp}
                  </p>
                </div>
                <span className="flex-shrink-0 px-3 py-1 bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 rounded text-sm font-medium">
                  {alert.action}
                </span>
              </button>
            ))
          ) : (
            <div className="text-center py-8">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
              <p className="text-slate-600 dark:text-slate-400">لا توجد تنبيهات</p>
            </div>
          )}
        </div>
      </div>

      {/* Performance Insights */}
      <div className="app-card p-6">
        <h3 className="font-bold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
          <TrendingDown className="text-purple-500" />
          رؤى الأداء
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-indigo-50 dark:bg-indigo-950 rounded-lg border border-indigo-200 dark:border-indigo-800">
            <p className="text-sm text-indigo-600 dark:text-indigo-400 font-medium mb-2">
              إجمالي العقود
            </p>
            <p className="font-bold text-slate-900 dark:text-white">
              {data.contracts?.length || 0}
            </p>
          </div>
          <div className="p-4 bg-orange-50 dark:bg-orange-950 rounded-lg border border-orange-200 dark:border-orange-800">
            <p className="text-sm text-orange-600 dark:text-orange-400 font-medium mb-2">
              العقارات
            </p>
            <p className="font-bold text-slate-900 dark:text-white">
              {data.properties?.length || 0}
            </p>
          </div>
          <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
            <p className="text-sm text-green-600 dark:text-green-400 font-medium mb-2">الأشخاص</p>
            <p className="font-bold text-slate-900 dark:text-white">{data.people?.length || 0}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
