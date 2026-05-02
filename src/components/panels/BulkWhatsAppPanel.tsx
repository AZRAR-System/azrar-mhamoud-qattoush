import { useLayoutEffect, useRef, type FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTE_PATHS } from '@/routes/paths';
import { useSmartModal } from '@/context/ModalContext';

/** التوجيه إلى صفحة مركز التنبيهات — واتساب جماعي (مصدر واحد للواجهة الكاملة). */
export const BulkWhatsAppPanel: FC = () => {
  const navigate = useNavigate();
  const { activePanels, closePanel } = useSmartModal();
  const handledRef = useRef(false);

  useLayoutEffect(() => {
    if (handledRef.current) return;
    const panel = [...activePanels].reverse().find((p) => p.type === 'BULK_WHATSAPP');
    if (!panel) return;
    handledRef.current = true;
    navigate(ROUTE_PATHS.ALERTS_BULK, { replace: true });
    closePanel(panel.id);
  }, [activePanels, navigate, closePanel]);

  return (
    <div className="p-4">
      <div className="text-sm text-slate-600 dark:text-slate-300">جاري فتح واتساب جماعي…</div>
    </div>
  );
};
