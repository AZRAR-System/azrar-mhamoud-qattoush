import type { FC } from 'react';
import { useLicenseAdmin } from '@/hooks/useLicenseAdmin';
import { LicenseAdminPageView } from '@/components/license/LicenseAdminPageView';
import { usePageVisibility } from '@/context/PageVisibilityContext';

export const LicenseAdmin: FC = () => {
  const { isVisible } = usePageVisibility();
  const page = useLicenseAdmin(isVisible);
  return <LicenseAdminPageView page={page} />;
};

export default LicenseAdmin;
