/**
 * © 2025 - Developed by Mahmoud Qattoush
 * AZRAR Real Estate Management System - All Rights Reserved
 *
 * صفحة العمليات والإجراءات (Operations & Procedures Page)
 * - سداد دفعات المستأجرين (الكمبيالات)
 * - إدارة العقود والتحصيلات بشكل تفاعلي
 * - توثيق العمليات المالية في سجل النظام
 */

import type { FC } from 'react';
import { useOperations } from '@/hooks/useOperations';
import { OperationsPageView } from '@/components/operations/OperationsPageView';

export const Operations: FC = () => {
  const page = useOperations();
  return <OperationsPageView page={page} />;
};

export default Operations;
