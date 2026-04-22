import React from 'react';
import { Settings, CheckCircle, Calculator, Wallet, ServerCog } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { SmartFilterBar } from '@/components/shared/SmartFilterBar';

interface ToolsSmartFilterBarProps {
  onApproveContract: () => void;
  onApproveCommission: () => void;
  previewCount: number;
  totalCommission: string;
  hasContractData: boolean;
  hasCommissionData: boolean;
}

export const ToolsSmartFilterBar: React.FC<ToolsSmartFilterBarProps> = ({
  onApproveContract,
  onApproveCommission,
  previewCount,
  totalCommission,
  hasContractData,
  hasCommissionData,
}) => {
  return (
    <SmartFilterBar
      actions={
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="primary"
            onClick={onApproveContract}
            disabled={!hasContractData}
            leftIcon={<CheckCircle size={18} />}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-6 shadow-lg shadow-indigo-500/20"
          >
            اعتماد العقد
          </Button>
          <Button
            variant="secondary"
            onClick={onApproveCommission}
            disabled={!hasCommissionData}
            leftIcon={<Wallet size={18} />}
            className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-black px-6"
          >
            اعتماد العمولة
          </Button>
        </div>
      }
      filters={
        <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
          <Settings size={18} className="text-indigo-500" />
          <p className="text-sm font-bold">
            أدوات الاحتساب الذكي: قم بإدخال البيانات واضغط على "معاينة" للتحقق قبل الاعتماد النهائي.
          </p>
        </div>
      }
      pagination={
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/20 px-3 py-1.5 rounded-xl border border-indigo-100 dark:border-indigo-800/50">
            <Calculator size={14} className="text-indigo-500" />
            <span className="text-xs font-black text-indigo-700 dark:text-indigo-300">
              {previewCount} دفعات معاينة
            </span>
          </div>
          <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1.5 rounded-xl border border-emerald-100 dark:border-emerald-800/50 text-emerald-600 dark:text-emerald-400">
            <ServerCog size={14} />
            <span className="text-xs font-black">
              {totalCommission} عمولة إجمالية
            </span>
          </div>
        </div>
      }
    />
  );
};
