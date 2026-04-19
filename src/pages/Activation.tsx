import type { FC } from 'react';
import { useActivation } from '@/hooks/useActivation';
import { ActivationPageView } from '@/components/activation/ActivationPageView';

/**
 * Activation Page Controller
 */
export const Activation: FC = () => {
  const page = useActivation();
  return <ActivationPageView page={page} />;
};
