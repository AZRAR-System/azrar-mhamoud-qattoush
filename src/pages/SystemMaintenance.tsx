import type { FC } from 'react';
import { useSystemMaintenance } from '@/hooks/useSystemMaintenance';
import { SystemMaintenancePageView } from '@/components/maintenance/SystemMaintenancePageView';
import { usePageVisibility } from '@/context/PageVisibilityContext';

export const SystemMaintenance: FC = () => {
  const { isVisible } = usePageVisibility();
  const page = useSystemMaintenance(isVisible);
  return <SystemMaintenancePageView page={page} />;
};

export default SystemMaintenance;
