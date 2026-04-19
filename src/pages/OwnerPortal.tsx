import type { FC } from 'react';
import { useOwnerPortal } from '@/hooks/useOwnerPortal';
import { OwnerPortalPageView } from '@/components/owner/OwnerPortalPageView';

/**
 * لوحة تحكم المالك - كولترولر (Controller)
 * يربط المنطق (useOwnerPortal) بالعرض (OwnerPortalPageView)
 */
export const OwnerPortal: FC = () => {
  const page = useOwnerPortal();
  
  // نمرر الـ page المحتوي على كل البيانات والـ handlers للـ View
  return <OwnerPortalPageView page={page} />;
};