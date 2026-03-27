import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ROUTE_PATHS } from '@/routes/paths';
import {
  loadLicenseAdminServerSettings,
  normalizeServerOrigin,
  saveLicenseAdminSelectedServer,
  saveLicenseAdminServers,
} from '@/features/licenseAdmin/settings';
import { fmtDateTime, getErrorMessage, licenseStatusToArabic } from '@/features/licenseAdmin/utils';

type AdminListItem = {
  licenseKey: string;
  status?: string;
  createdAt?: string;
  expiresAt?: string;
  maxActivations?: number;
  activationsCount?: number;
  customerName?: string;
  customerCompany?: string;
  customerPhone?: string;
  customerCity?: string;
};

type CustomerGroup = {
  key: string;
  label: string;
  name?: string;
  company?: string;
  phone?: string;
  city?: string;
  items: AdminListItem[];
};

// (shared license admin helpers live in src/features/licenseAdmin/utils.ts)

const normalize = (v: unknown): string => String(v ?? '').trim();

const buildCustomerKey = (item: AdminListItem): string => {
  const company = normalize(item.customerCompany);
  const name = normalize(item.customerName);
  const phone = normalize(item.customerPhone);
  const city = normalize(item.customerCity);
  return [company, name, phone, city].filter(Boolean).join(' | ') || 'بدون بيانات عميل';
};

export const LicenseAdminCustomers: React.FC = () => {
  const [serverUrl, setServerUrl] = useState('http://127.0.0.1:5056');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [items, setItems] = useState<AdminListItem[]>([]);
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);

  const canUseBridge = typeof window !== 'undefined' && !!window.desktopLicenseAdmin;

  useEffect(() => {
    const st = loadLicenseAdminServerSettings();
    if (st.selectedServer) setServerUrl(st.selectedServer);
  }, []);

  const refreshList = async () => {
    if (!canUseBridge) {
      setError('Desktop bridge not available. Run in Electron.');
      return;
    }

    setError('');
    setInfo('');
    setBusy(true);
    try {
      const res = await window.desktopLicenseAdmin?.list({ serverUrl, q: '', limit: 500 });
      const rec = res && typeof res === 'object' ? (res as Record<string, unknown>) : {};
      if (rec.ok !== true) throw new Error(String(rec.error || 'Failed'));

      const result =
        rec.result && typeof rec.result === 'object' ? (rec.result as Record<string, unknown>) : {};
      const arr = Array.isArray(result.items) ? result.items : [];
      const parsed = arr
        .map((r) => (r && typeof r === 'object' ? (r as Record<string, unknown>) : null))
        .filter((r): r is Record<string, unknown> => r !== null)
        .map((r) => ({
          licenseKey: String(r.licenseKey || ''),
          status: typeof r.status === 'string' ? String(r.status) : undefined,
          createdAt: typeof r.createdAt === 'string' ? String(r.createdAt) : undefined,
          expiresAt: typeof r.expiresAt === 'string' ? String(r.expiresAt) : undefined,
          maxActivations: typeof r.maxActivations === 'number' ? r.maxActivations : undefined,
          activationsCount: typeof r.activationsCount === 'number' ? r.activationsCount : undefined,
          customerName: typeof r.customerName === 'string' ? String(r.customerName) : undefined,
          customerCompany:
            typeof r.customerCompany === 'string' ? String(r.customerCompany) : undefined,
          customerPhone: typeof r.customerPhone === 'string' ? String(r.customerPhone) : undefined,
          customerCity: typeof r.customerCity === 'string' ? String(r.customerCity) : undefined,
        }))
        .filter((x) => x.licenseKey);

      setItems(parsed);
      setInfo(`تم تحميل ${parsed.length} ترخيص`);
    } catch (e: unknown) {
      const msg = getErrorMessage(e) || 'Failed to refresh';
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const run = async () => {
      if (!canUseBridge) {
        setLoggedIn(false);
        return;
      }
      try {
        const res = await window.desktopLicenseAdmin?.getUser();
        const rec = res && typeof res === 'object' ? (res as Record<string, unknown>) : {};
        setLoggedIn(rec.ok === true);
      } catch {
        setLoggedIn(false);
      }
    };
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (loggedIn !== true) return;
    void refreshList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedIn]);

  const grouped = useMemo(() => {
    const byKey = new Map<string, CustomerGroup>();
    for (const it of items) {
      const k = buildCustomerKey(it);
      const cur = byKey.get(k);
      if (!cur) {
        const company = normalize(it.customerCompany) || undefined;
        const name = normalize(it.customerName) || undefined;
        const phone = normalize(it.customerPhone) || undefined;
        const city = normalize(it.customerCity) || undefined;
        const label = company || name || 'بدون بيانات عميل';
        byKey.set(k, {
          key: k,
          label,
          company,
          name,
          phone,
          city,
          items: [it],
        });
      } else {
        cur.items.push(it);
      }
    }

    const out = Array.from(byKey.values());
    out.sort((a, b) => b.items.length - a.items.length || a.label.localeCompare(b.label));
    return out;
  }, [items]);

  const filtered = useMemo(() => {
    const q = normalize(search).toLowerCase();
    if (!q) return grouped;
    return grouped.filter((g) => g.key.toLowerCase().includes(q));
  }, [grouped, search]);

  return (
    <div className="h-screen overflow-y-auto bg-slate-50 dark:bg-slate-950" dir="rtl">
      <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              العملاء والمفاتيح
            </h1>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              تجميع مفاتيح الترخيص حسب العميل
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link to={ROUTE_PATHS.LICENSE_ADMIN}>
              <Button variant="secondary" disabled={busy}>
                رجوع
              </Button>
            </Link>
            <Link to={ROUTE_PATHS.LICENSE_ADMIN_LICENSES}>
              <Button variant="secondary" disabled={busy || loggedIn !== true}>
                التراخيص
              </Button>
            </Link>
            <Button
              variant="secondary"
              onClick={() => void refreshList()}
              disabled={busy || loggedIn !== true}
            >
              تحديث
            </Button>
          </div>
        </div>

        <Card className="p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">
                رابط سيرفر التفعيل
              </div>
              <Input
                value={serverUrl}
                onChange={(e) => {
                  const nextRaw = e.target.value;
                  setServerUrl(nextRaw);
                  const origin = normalizeServerOrigin(nextRaw);
                  if (origin) {
                    const st = loadLicenseAdminServerSettings();
                    saveLicenseAdminSelectedServer(origin);
                    saveLicenseAdminServers(Array.from(new Set([origin, ...st.servers])));
                  }
                }}
                placeholder="http://127.0.0.1:5056"
                disabled={busy}
              />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">
                بحث
              </div>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="بحث بالاسم/الشركة/الهاتف/المدينة"
                disabled={busy}
              />
            </div>
          </div>
          {error ? <div className="text-sm text-red-600">{error}</div> : null}
          {info ? <div className="text-sm text-slate-600 dark:text-slate-300">{info}</div> : null}

          {!canUseBridge ? (
            <div className="text-sm text-slate-500">هذه الصفحة تعمل داخل Electron فقط</div>
          ) : loggedIn === false ? (
            <div className="text-sm text-slate-500">
              يرجى تسجيل الدخول من صفحة “إدارة التفعيل” أولاً.
            </div>
          ) : null}
        </Card>

        {loggedIn === true ? (
          <div className="space-y-4">
            {filtered.map((g) => (
              <Card key={g.key} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                      {g.label}
                    </div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 flex flex-wrap gap-x-3 gap-y-1">
                      {g.name ? <span>الاسم: {g.name}</span> : null}
                      {g.company ? <span>الشركة: {g.company}</span> : null}
                      {g.phone ? <span>الهاتف: {g.phone}</span> : null}
                      {g.city ? <span>المدينة: {g.city}</span> : null}
                    </div>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    عدد المفاتيح: {g.items.length}
                  </div>
                </div>

                <div className="app-table-wrapper">
                  <div className="max-h-[400px] overflow-auto no-scrollbar">
                    <table className="app-table">
                      <thead className="app-table-thead">
                        <tr>
                          <th className="app-table-th">المفتاح</th>
                          <th className="app-table-th">الحالة</th>
                          <th className="app-table-th">الانتهاء</th>
                          <th className="app-table-th text-center">الأجهزة</th>
                          <th className="app-table-th">تاريخ الإنشاء</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100/50 dark:divide-slate-800/50">
                        {g.items.map((it) => (
                          <tr
                            key={it.licenseKey}
                            className="app-table-row app-table-row-striped group"
                          >
                            <td className="app-table-td" title={it.licenseKey}>
                              <div
                                className="font-mono text-[10px] font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/20 px-2 py-1 rounded-lg border border-indigo-100/50 dark:border-indigo-800/50 inline-block"
                                dir="ltr"
                              >
                                {it.licenseKey}
                              </div>
                            </td>
                            <td className="app-table-td">
                              {it.status ? (
                                <StatusBadge
                                  status={licenseStatusToArabic(it.status)}
                                  className="!text-[10px] !px-2 !py-0.5"
                                />
                              ) : (
                                ''
                              )}
                            </td>
                            <td className="app-table-td font-mono text-[10px] text-slate-500 font-bold whitespace-nowrap">
                              {it.expiresAt ? fmtDateTime(it.expiresAt) : ''}
                            </td>
                            <td className="app-table-td text-center">
                              <span className="text-xs font-black text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
                                {typeof it.activationsCount === 'number'
                                  ? it.activationsCount
                                  : '0'}
                              </span>
                            </td>
                            <td className="app-table-td font-mono text-[10px] text-slate-400 font-medium whitespace-nowrap">
                              {it.createdAt ? fmtDateTime(it.createdAt) : ''}
                            </td>
                          </tr>
                        ))}
                        {g.items.length === 0 ? (
                          <tr>
                            <td className="app-table-empty" colSpan={5}>
                              لا توجد بيانات
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </div>
              </Card>
            ))}

            {filtered.length === 0 ? (
              <div className="text-sm text-slate-500">لا توجد نتائج</div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
};
