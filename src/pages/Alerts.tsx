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
import { AlertsInboxLayout } from '@/components/alerts/AlertsInboxLayout';
import { usePageVisibility } from '@/context/PageVisibilityContext';
import type { AlertPanelIntent } from '@/services/alerts/alertActionTypes';

export const Alerts: FC<{ sectionIntent?: AlertPanelIntent }> = ({ sectionIntent }) => {
  const { isVisible } = usePageVisibility();
  const page = useAlerts(isVisible, sectionIntent);
  return <AlertsInboxLayout page={page} />;
};
