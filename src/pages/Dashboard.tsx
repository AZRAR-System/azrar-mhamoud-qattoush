import { type FC } from 'react';
import { useDashboard } from '@/hooks/useDashboard';
import { DashboardPageView } from '@/components/dashboard/DashboardPageView';

/**
 * © 2025 - Developed by Mahmoud Qattoush
 * Dashboard Controller
 */
export const Dashboard: FC = () => {
  const page = useDashboard();
  return <DashboardPageView page={page} />;
};
