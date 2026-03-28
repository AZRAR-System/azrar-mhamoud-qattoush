import type { ContractsPageModel } from '@/hooks/useContracts';

type Props = { page: ContractsPageModel };

export function ContractsImportInput({ page }: Props) {
  const { importRef, t, handleImportFile } = page;

  return (
    <input
      ref={importRef}
      type="file"
      accept=".xlsx,.xls,.csv"
      aria-label={t('استيراد ملف العقود')}
      title={t('استيراد ملف العقود')}
      className="hidden"
      onChange={(e) => {
        const f = e.target.files?.[0];
        e.target.value = '';
        if (f) void handleImportFile(f);
      }}
    />
  );
}
