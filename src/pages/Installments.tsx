import type { FC } from 'react';
import { useInstallments } from '@/hooks/useInstallments';
import { InstallmentsPageView } from '@/components/installments/InstallmentsPageView';

export const Installments: FC = () => {
  const page = useInstallments();
  return <InstallmentsPageView page={page} />;
};
