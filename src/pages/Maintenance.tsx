/**
 * © 2025 - Developed by Mahmoud Qattoush
 * AZRAR Real Estate Management System - All Rights Reserved
 *
 * صفحة الصيانة والدعم الفني (Maintenance Management Page)
 * - إدارة طلبات الصيانة وتكاليف الإصلاح
 * - توزيع المسؤوليات بين المالك والمستأجر
 * - متابعة حالات التذاكر وإغلاقها
 * - التكامل مع الممتلكات والأشخاص
 */

import type { FC } from 'react';
import { useMaintenance } from '@/hooks/useMaintenance';
import { MaintenancePageView } from '@/components/maintenance/MaintenancePageView';
import { usePageVisibility } from '@/context/PageVisibilityContext';

export const Maintenance: FC = () => {
  const { isVisible } = usePageVisibility();
  const page = useMaintenance(isVisible);
  return <MaintenancePageView page={page} />;
};
