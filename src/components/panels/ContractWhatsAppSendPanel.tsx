import React from 'react';
import { MessageComposer } from '@/components/MessageComposer';
import type { الأشخاص_tbl, العقارات_tbl, العقود_tbl } from '@/types/types';

type InstallmentInfo = {
  rank: number;
  type: string;
  date: string;
  amount: number;
};

type AttachmentInfo = {
  fileName: string;
};

export const ContractWhatsAppSendPanel: React.FC<{
  onClose: () => void;
  contract?: العقود_tbl | null;
  property?: العقارات_tbl | null;
  tenant?: الأشخاص_tbl | null;
  owner?: الأشخاص_tbl | null;
  guarantor?: الأشخاص_tbl | null;
  commissionOwner?: number;
  commissionTenant?: number;
  installments?: InstallmentInfo[];
  attachments?: AttachmentInfo[];
}> = ({ onClose, contract, property, tenant, installments }) => {
  const tenantPhones = React.useMemo(() => {
    const phones = [
      String(tenant?.رقم_الهاتف || '').trim(),
      String(tenant?.رقم_هاتف_اضافي || '').trim(),
    ].filter(Boolean);
    return phones.length ? phones : undefined;
  }, [tenant]);

  const overdueDetails = React.useMemo(() => {
    const list = (installments || []).filter((x) => x?.date);
    if (!list.length) return '';
    return list
      .slice(0, 10)
      .map((x) => `• ${x.type} #${x.rank}: ${x.amount.toLocaleString('en-US')} د.أ — ${x.date}`)
      .join('\n');
  }, [installments]);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="text-xs text-slate-500 dark:text-slate-400">
        {String(property?.الكود_الداخلي || '') ? `العقار: ${property?.الكود_الداخلي}` : null}
        {String(contract?.رقم_العقد || '') ? ` • العقد: ${contract?.رقم_العقد}` : null}
      </div>

      <MessageComposer
        tenantName={String(tenant?.الاسم || 'المستأجر')}
        tenantPhone={String(tenant?.رقم_الهاتف || '962790000000')}
        tenantPhones={tenantPhones}
        propertyCode={String(property?.الكود_الداخلي || '')}
        contractNumber={String(contract?.رقم_العقد || '')}
        overdueInstallmentsDetails={overdueDetails}
        onClose={onClose}
      />
    </div>
  );
};

export default ContractWhatsAppSendPanel;
