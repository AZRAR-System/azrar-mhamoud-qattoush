/**
 * © 2025 - Developed by Mahmoud Qattoush
 * AZRAR Real Estate Management System - All Rights Reserved
 *
 * صفحة مركز الإشعارات (Notification Hub)
 * - متابعة التحصيل المالي وجودة البيانات بنظام Kanban
 */

import { FC } from 'react';
import { useAlerts } from '@/hooks/useAlerts';
import { NotificationHubLayout } from '@/components/alerts/NotificationHubLayout';
import { usePageVisibility } from '@/context/PageVisibilityContext';

import { AlertPanelIntent } from '@/services/alerts/alertActionTypes';

export const Alerts: FC<{ sectionIntent?: AlertPanelIntent }> = ({ sectionIntent }) => {
  const { isVisible } = usePageVisibility();
  const page = useAlerts(isVisible, sectionIntent);
  return <NotificationHubLayout page={page} />;
};
