import type { FC } from 'react';
import { useSmartTools } from '@/hooks/useSmartTools';
import { SmartToolsPageView } from '@/components/tools/SmartToolsPageView';
import { usePageVisibility } from '@/context/PageVisibilityContext';

export const SmartTools: FC = () => {
  const { isVisible } = usePageVisibility();
  const page = useSmartTools(isVisible);
  return <SmartToolsPageView page={page} />;
};
