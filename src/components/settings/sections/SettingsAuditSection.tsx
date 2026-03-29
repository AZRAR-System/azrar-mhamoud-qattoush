import { FileSpreadsheet } from 'lucide-react';
import { RBACGuard } from '@/components/shared/RBACGuard';
import type { SettingsPageModel } from '@/hooks/useSettingsPage';

type Props = { page: SettingsPageModel };

export function SettingsAuditSection({ page }: Props) {
  const {
    auditLogs,
    handleExportAuditCSV,
    settingsNoAccessFallback,
  } = page;

  return (
    <RBACGuard requiredPermission="SETTINGS_AUDIT" fallback={settingsNoAccessFallback}>
      <div className="flex flex-col animate-fade-in min-h-[min(70vh,720px)]">
        <div className="app-card flex-1 flex flex-col">
          <div className="p-4 border-b font-bold bg-gray-50 dark:bg-slate-900 flex justify-between items-center">
            <span>سجل تغييرات الإعدادات (آخر 20 عملية)</span>
            <button
              onClick={handleExportAuditCSV}
              className="text-xs bg-white dark:bg-slate-800 border px-3 py-1.5 rounded-lg flex items-center gap-2 hover:bg-gray-50"
            >
              <FileSpreadsheet size={14} /> تصدير CSV
            </button>
          </div>
          <div className="flex-1 app-table-wrapper border-none shadow-none rounded-none">
            <table className="app-table">
              <thead className="app-table-thead">
                <tr>
                  <th className="app-table-th">المستخدم</th>
                  <th className="app-table-th">نوع الإجراء</th>
                  <th className="app-table-th">التفاصيل</th>
                  <th className="app-table-th">التاريخ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="app-table-row">
                    <td className="app-table-td font-bold text-slate-700 dark:text-white">
                      {log.اسم_المستخدم}
                    </td>
                    <td className="app-table-td">
                      <span className="bg-indigo-50 text-indigo-700 px-2 py-1 rounded text-xs border border-indigo-100">
                        {log.نوع_العملية}
                      </span>
                    </td>
                    <td className="app-table-td text-slate-600 dark:text-slate-300">
                      {log.details}
                    </td>
                    <td className="app-table-td text-xs font-mono text-slate-400">
                      {new Date(log.تاريخ_العملية).toLocaleString()}
                    </td>
                  </tr>
                ))}
                {auditLogs.length === 0 && (
                  <tr>
                    <td colSpan={4} className="app-table-empty">
                      لا توجد سجلات
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </RBACGuard>
  );
}
