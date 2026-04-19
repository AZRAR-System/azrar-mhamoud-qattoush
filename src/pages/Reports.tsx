/**
 * © 2025 - Developed by Mahmoud Qattoush
 * AZRAR Real Estate Management System - All Rights Reserved
 *
 * مركز التقارير المتقدم (Advanced Reports Center)
 * - توليد تقارير مالية وإدارية تفصيلية
 * - تصدير البيانات إلى Excel وعمليات الطباعة
 * - لوحة معلومات (Dashboard) سريعة للأداء المالي
 */

import type { FC } from 'react';
import { useReports } from '@/hooks/useReports';
import { ReportsPageView } from '@/components/reports/ReportsPageView';

export const Reports: FC = () => {
  const page = useReports();
  return <ReportsPageView page={page} />;
};

export default Reports;
