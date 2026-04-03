import { useCallback, useMemo, useState, type FC } from 'react';
import { Navigate } from 'react-router-dom';
import { Download, Filter, RefreshCw, ScrollText } from 'lucide-react';
import { auditLog, type AuditLogRecord } from '@/services/auditLog';
import { useAuth } from '@/context/AuthContext';
import { isSuperAdmin } from '@/utils/roles';
import { ROUTE_PATHS } from '@/routes/paths';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { exportToXlsx } from '@/utils/xlsx';
import { useDbSignal } from '@/hooks/useDbSignal';

function parseDay(iso: string): string {
  const s = String(iso || '').trim();
  const d = s.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : '';
}

export const AuditLog: FC = () => {
  const { user } = useAuth();
  const dbTick = useDbSignal();

  const [userFilter, setUserFilter] = useState<string>('');
  const [actionFilter, setActionFilter] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  const rows = useMemo(() => {
    void dbTick;
    return auditLog.getAll();
  }, [dbTick]);

  const userOptions = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => {
      if (r.userName) set.add(r.userName);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ar'));
  }, [rows]);

  const actionOptions = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => {
      if (r.action) set.add(r.action);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ar'));
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (userFilter && r.userName !== userFilter) return false;
      if (actionFilter && r.action !== actionFilter) return false;
      const day = parseDay(r.timestamp);
      if (dateFrom && day && day < dateFrom) return false;
      if (dateTo && day && day > dateTo) return false;
      return true;
    });
  }, [rows, userFilter, actionFilter, dateFrom, dateTo]);

  const handleExport = useCallback(() => {
    const data: Array<Record<string, unknown>> = filtered.map((r: AuditLogRecord) => ({
      id: r.id,
      userId: r.userId ?? '',
      userName: r.userName,
      action: r.action,
      entity: r.entity,
      entityId: r.entityId ?? '',
      details: r.details ?? '',
      timestamp: r.timestamp,
      ip: r.ip ?? '',
    }));
    void exportToXlsx(
      'سجل_التدقيق',
      [
        { key: 'timestamp', header: 'الوقت' },
        { key: 'userName', header: 'المستخدم' },
        { key: 'userId', header: 'معرف المستخدم' },
        { key: 'action', header: 'النوع / الإجراء' },
        { key: 'entity', header: 'الكيان' },
        { key: 'entityId', header: 'معرف السجل' },
        { key: 'details', header: 'التفاصيل' },
        { key: 'ip', header: 'IP' },
        { key: 'id', header: 'المعرّف' },
      ],
      data as Record<string, unknown>[],
      `audit-log-${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  }, [filtered]);

  if (!isSuperAdmin(user?.الدور)) {
    return <Navigate to={ROUTE_PATHS.DASHBOARD} replace />;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-200">
            <ScrollText size={26} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white">سجل التدقيق</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              آخر 500 عملية — تصفية وتصدير Excel
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => window.location.reload()} className="gap-2">
            <RefreshCw size={16} /> تحديث
          </Button>
          <Button onClick={() => void handleExport()} className="gap-2">
            <Download size={16} /> تصدير Excel
          </Button>
        </div>
      </div>

      <Card className="p-6">
        <div className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
          <Filter size={16} /> تصفية
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-500">المستخدم</label>
            <Select
              className="w-full"
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              options={[
                { value: '', label: 'الكل' },
                ...userOptions.map((u) => ({ value: u, label: u })),
              ]}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-500">نوع الإجراء</label>
            <Select
              className="w-full"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              options={[
                { value: '', label: 'الكل' },
                ...actionOptions.map((a) => ({ value: a, label: a })),
              ]}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-500">من تاريخ</label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-500">إلى تاريخ</label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-right text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/80">
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className="px-4 py-3 font-bold">الوقت</th>
                <th className="px-4 py-3 font-bold">المستخدم</th>
                <th className="px-4 py-3 font-bold">الإجراء</th>
                <th className="px-4 py-3 font-bold">الكيان</th>
                <th className="px-4 py-3 font-bold">معرف</th>
                <th className="px-4 py-3 font-bold">التفاصيل</th>
                <th className="px-4 py-3 font-bold">IP</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                    لا توجد سجلات مطابقة
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-slate-100 dark:border-slate-800/80 hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                  >
                    <td className="whitespace-nowrap px-4 py-2 font-mono text-xs text-slate-600 dark:text-slate-300" dir="ltr">
                      {r.timestamp}
                    </td>
                    <td className="px-4 py-2">{r.userName}</td>
                    <td className="px-4 py-2 font-medium">{r.action}</td>
                    <td className="px-4 py-2">{r.entity}</td>
                    <td className="max-w-[120px] truncate px-4 py-2 font-mono text-xs" title={r.entityId}>
                      {r.entityId ?? '—'}
                    </td>
                    <td className="max-w-md truncate px-4 py-2 text-slate-600 dark:text-slate-400" title={r.details}>
                      {r.details ?? '—'}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs" dir="ltr">
                      {r.ip ?? '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900/40">
          عرض {filtered.length} من {rows.length} سجل
        </div>
      </Card>
    </div>
  );
};
