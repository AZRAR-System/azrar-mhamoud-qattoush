/**
 * © 2025 - Developed by Mahmoud Qattoush
 * AZRAR Real Estate Management System - All Rights Reserved
 *
 * صفحة التنبيهات والإشعارات (Alerts Management Page)
 * - متابعة التحصيل المالي وجودة البيانات
 * - إرسال إشعارات واتساب تلقائية ويدوية
 * - إدارة المخاطر وتنبيهات انتهاء العقود
 */

import type { FC } from 'react';
import { useAlerts } from '@/hooks/useAlerts';
import { AlertsPageView } from '@/components/alerts/AlertsPageView';
import { usePageVisibility } from '@/context/PageVisibilityContext';

export const Alerts: FC = () => {
  const { isVisible } = usePageVisibility();
  const page = useAlerts(isVisible);
  return <AlertsPageView page={page} />;
};
