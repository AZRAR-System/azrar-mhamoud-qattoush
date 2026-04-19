import type { FC } from 'react';
import { useCommissions } from '@/hooks/useCommissions';
import { CommissionsPageView } from '@/components/commissions/CommissionsPageView';
import { usePageVisibility } from '@/context/PageVisibilityContext';

export const Commissions: FC = () => {
  const { isVisible } = usePageVisibility();
  const page = useCommissions(isVisible);
  return <CommissionsPageView page={page} />;
};
