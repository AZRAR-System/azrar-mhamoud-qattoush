import React, { Suspense } from 'react';

const BulkWhatsApp = React.lazy(() =>
  import('@/pages/BulkWhatsApp').then((module) => ({ default: module.BulkWhatsApp }))
);

const PanelLoader = () => (
  <div className="p-4">
    <div className="text-sm text-slate-600 dark:text-slate-300">جاري تحميل واتساب جماعي...</div>
  </div>
);

export const BulkWhatsAppPanel: React.FC = () => {
  return (
    <Suspense fallback={<PanelLoader />}>
      <BulkWhatsApp />
    </Suspense>
  );
};
