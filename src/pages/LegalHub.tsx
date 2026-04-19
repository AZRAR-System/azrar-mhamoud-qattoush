import type { FC } from 'react';
import { useLegalHub } from '@/hooks/useLegalHub';
import { LegalHubPageView } from '@/components/legal/LegalHubPageView';
import { usePageVisibility } from '@/context/PageVisibilityContext';

export const LegalHub: FC = () => {
  const { isVisible } = usePageVisibility();
  const page = useLegalHub(isVisible);
  return <LegalHubPageView page={page} />;
};
