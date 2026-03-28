import type { PropertiesPageModel } from '@/hooks/useProperties';

type Props = { page: PropertiesPageModel };

export function PropertiesImportInput({ page }: Props) {
  const { importRef, t, handleImportFile } = page;

  return (
    <input
      ref={importRef}
      type="file"
      accept=".xlsx,.xls,.csv"
      aria-label={t('استيراد ملف العقارات')}
      title={t('استيراد ملف العقارات')}
      className="hidden"
      onChange={(e) => {
        const f = e.target.files?.[0];
        e.target.value = '';
        if (f) void handleImportFile(f);
      }}
    />
  );
}
