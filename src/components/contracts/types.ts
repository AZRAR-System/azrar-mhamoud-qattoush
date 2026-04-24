import { العقود_tbl } from '@/types';

export type InstallmentPreviewRow = {
  rank: number;
  type: 'فرق أيام' | 'دفعة أولى' | 'إيجار' | 'تأمين' | 'دورية';
  date: string;
  amount: number;
  propertyCode: string;
  isManual?: boolean;
  note?: string;
};

export interface ContractStepProps {
  contract: Partial<العقود_tbl>;
  setContract: React.Dispatch<React.SetStateAction<Partial<العقود_tbl>>>;
  baseId: string;
  t: (s: string) => string;
}

export interface FinancialStepProps extends ContractStepProps {
  dayDiffValue: number;
  contractValueInfo: {
    monthly: number;
    total: number;
    months: number;
  };
}

export interface TermsStepProps extends ContractStepProps {
  commOwner: number | '';
  setCommOwner: (v: number | '') => void;
  commTenant: number | '';
  setCommTenant: (v: number | '') => void;
  commissionPaidMonth: string;
  setCommissionPaidMonth: (v: string) => void;
  isEditMode: boolean;
  recalcCommissionAuto: () => void;
  contractValueInfo: { total: number; months: number };
  dynamicValues: Record<string, unknown>;
  setDynamicValues: (v: Record<string, unknown>) => void;
  hasPaidInstallments: boolean;
  regenerateInstallments: boolean;
  setRegenerateInstallments: (v: boolean) => void;
}

export interface PreviewStepProps extends ContractStepProps {
  installmentsPreview: InstallmentPreviewRow[];
  setInstallmentsPreview: React.Dispatch<React.SetStateAction<InstallmentPreviewRow[]>>;
  isEditMode: boolean;
  id?: string;
}

export interface MessagesStepProps extends PreviewStepProps {
  commOwner: number | '';
  commTenant: number | '';
}
