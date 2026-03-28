import React from 'react';
import type { PeoplePageModel } from '@/hooks/usePeople';

type Props = { page: PeoplePageModel };

export function PeopleImportInput({ page }: Props) {
  const { importRef, t, handleImportFile } = page;

  return (
    <input
      ref={importRef}
      type="file"
      accept=".xlsx,.xls,.csv"
      className="hidden"
      aria-label={t('استيراد ملف أشخاص (Excel/CSV)')}
      title={t('استيراد ملف أشخاص (Excel/CSV)')}
      onChange={(e) => {
        const f = e.target.files?.[0];
        e.target.value = '';
        if (f) void handleImportFile(f);
      }}
    />
  );
}
