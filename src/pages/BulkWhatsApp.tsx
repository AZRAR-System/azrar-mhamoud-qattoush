import type { FC } from 'react';
import { useBulkWhatsApp } from '@/hooks/useBulkWhatsApp';
import { BulkWhatsAppPageView } from '@/components/whatsapp/BulkWhatsAppPageView';

/**
 * إرسال واتساب جماعي - كولترولر (Controller)
 */
export const BulkWhatsApp: FC = () => {
  const page = useBulkWhatsApp();

  return <BulkWhatsAppPageView page={page} />;
};
