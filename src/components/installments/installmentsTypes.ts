import type { الأشخاص_tbl, العقارات_tbl, العقود_tbl, الكمبيالات_tbl } from '@/types';

export type DesktopContract = العقود_tbl & { id?: string };

export type DesktopInstallmentsRow = {
  contract: DesktopContract;
  tenant?: الأشخاص_tbl;
  property?: العقارات_tbl;
  installments?: الكمبيالات_tbl[];
  hasDebt?: boolean;
  hasDueSoon?: boolean;
  isFullyPaid?: boolean;
};

export type InstallmentsMessageModalContext = {
  installment: الكمبيالات_tbl;
  contract: العقود_tbl;
  tenant: الأشخاص_tbl;
  property: العقارات_tbl;
  category: 'reminder' | 'due' | 'late' | 'warning' | 'legal';
  overdueInstallmentsCount?: number;
  overdueAmountTotal?: number;
  overdueInstallmentsDetails?: string;
};
