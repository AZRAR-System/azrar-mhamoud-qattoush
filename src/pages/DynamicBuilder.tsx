import { type FC } from 'react';
import { useDynamicBuilder } from '@/hooks/useDynamicBuilder';
import { DynamicBuilderPageView } from '@/components/dynamic/DynamicBuilderPageView';

/**
 * Dynamic Engine Controller
 */
export const DynamicBuilder: FC = () => {
  const page = useDynamicBuilder();
  return <DynamicBuilderPageView page={page} />;
};
