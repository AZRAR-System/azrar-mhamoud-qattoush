import React, { useEffect, useMemo, useState } from 'react';
import { DbService } from '@/services/mockDb';
import { ClearanceWizard } from '@/components/ClearanceWizard';
import { useSmartModal } from '@/context/ModalContext';
import { storage } from '@/services/storage';
import { contractDetailsSmart } from '@/services/domainQueries';

export const ClearanceWizardPanel: React.FC<{
  id: string;
  onClose: () => void;
  onDone?: () => void;
}> = ({ id, onClose, onDone }) => {
  const { openPanel } = useSmartModal();

  const isDesktop = storage.isDesktop() && !!(window as any)?.desktopDb;
  const isDesktopFast = isDesktop && !!(window as any)?.desktopDb?.domainContractDetails;
  const desktopUnsupported = isDesktop && !isDesktopFast;

  const [desktopContract, setDesktopContract] = useState<any | null>(null);

  useEffect(() => {
    if (!isDesktopFast) return;
    let alive = true;
    void (async () => {
      try {
        const d = await contractDetailsSmart(id);
        if (alive) setDesktopContract(d?.contract || null);
      } catch {
        if (alive) setDesktopContract(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id, isDesktopFast]);

  const contract = useMemo(() => {
    if (desktopUnsupported) return null;
    if (isDesktopFast) return desktopContract;
    const details = DbService.getContractDetails(id);
    return details?.contract || null;
  }, [id, isDesktopFast, desktopUnsupported, desktopContract]);

  if (desktopUnsupported) {
    return (
      <div className="p-10 text-center text-slate-600 dark:text-slate-300">
        <div className="font-bold">غير مدعوم في وضع الديسكتوب الحالي</div>
        <div className="text-sm mt-2">يرجى تحديث نسخة الديسكتوب أو تفعيل وضع السرعة/SQL.</div>
      </div>
    );
  }

  if (!contract) {
    return <div className="p-10 text-center text-slate-600">تعذر تحميل بيانات العقد.</div>;
  }

  return (
    <ClearanceWizard
      contract={contract}
      onClose={onClose}
      onComplete={() => {
        try {
          if (onDone) onDone();
        } finally {
          onClose();
          // Open report if exists (will show an error message if no record).
          openPanel('CLEARANCE_REPORT', id);
        }
      }}
    />
  );
};
