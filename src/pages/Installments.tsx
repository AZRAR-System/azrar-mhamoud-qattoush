import React from 'react';
import { useInstallments } from '@/hooks/useInstallments';
import { InstallmentsPageView } from '@/components/installments/InstallmentsPageView';

export const Installments: React.FC = () => {
  const page = useInstallments();
  return <InstallmentsPageView page={page} />;
};
