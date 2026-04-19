import type { FC } from 'react';
import { useAdminControlPanel } from '@/hooks/useAdminControlPanel';
import { AdminControlPanelPageView } from '@/components/admin/AdminControlPanelPageView';
import { usePageVisibility } from '@/context/PageVisibilityContext';

export const AdminControlPanel: FC = () => {
  const { isVisible } = usePageVisibility();
  const page = useAdminControlPanel(isVisible);
  return <AdminControlPanelPageView page={page} />;
};

export default AdminControlPanel;
