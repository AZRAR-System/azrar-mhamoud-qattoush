import type { FC } from 'react';
import { useSystemSetup } from '@/hooks/useSystemSetup';
import { SystemSetupPageView } from '@/components/setup/SystemSetupPageView';

/**
 * تهيئة النظام - كولترولر (Controller)
 */
export const SystemSetup: FC = () => {
  const page = useSystemSetup();

  return <SystemSetupPageView page={page} />;
};
