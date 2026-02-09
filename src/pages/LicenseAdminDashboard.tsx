import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ROUTE_PATHS } from '@/routes/paths';
import {
  loadLicenseAdminServerSettings,
  normalizeServerOrigin,
  saveLicenseAdminSelectedServer,
  saveLicenseAdminServers,
} from '@/features/licenseAdmin/settings';

const getErr = (e: unknown): string => {
  if (e instanceof Error) return e.message;
  return String(e || '');
};

export const LicenseAdminDashboard: React.FC = () => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const [servers, setServers] = useState<string[]>([]);
  const [selectedServer, setSelectedServer] = useState('');
  const [newServer, setNewServer] = useState('');

  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [tokenConfigured, setTokenConfigured] = useState<boolean | null>(null);

  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');

  const canUseBridge = typeof window !== 'undefined' && !!window.desktopLicenseAdmin;

  useEffect(() => {
    const st = loadLicenseAdminServerSettings();
    setServers(st.servers);
    setSelectedServer(st.selectedServer);
  }, []);

  useEffect(() => {
    if (!selectedServer) return;
    saveLicenseAdminSelectedServer(selectedServer);
  }, [selectedServer]);

  const serverOptions = useMemo(
    () => servers.map((s) => ({ value: s, label: s })),
    [servers]
  );

  const refreshSession = async () => {
    if (!canUseBridge) {
      setLoggedIn(false);
      setTokenConfigured(null);
      return;
    }

    setBusy(true);
    setError('');
    setInfo('');
    try {
      const res = await window.desktopLicenseAdmin.getUser();
      const rec = res && typeof res === 'object' ? (res as Record<string, unknown>) : {};
      const ok = rec.ok === true;
      setLoggedIn(ok);

      if (!ok) {
        setTokenConfigured(null);
        return;
      }

      const tokRes = await window.desktopLicenseAdmin.getAdminTokenStatus({ serverUrl: selectedServer });
      const tokRec = tokRes && typeof tokRes === 'object' ? (tokRes as Record<string, unknown>) : {};
      if (tokRec.ok === true) setTokenConfigured(Boolean(tokRec.configured));
      else setTokenConfigured(null);
    } catch (e: unknown) {
      setLoggedIn(false);
      setTokenConfigured(null);
      setError(getErr(e) || 'تعذر تحميل الحالة');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void refreshSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedServer]);

  const doLogin = async () => {
    if (!canUseBridge) return;
    setBusy(true);
    setError('');
    setInfo('');
    try {
      const res = await window.desktopLicenseAdmin.login({ username: username.trim(), password: password.trim() });
      const rec = res && typeof res === 'object' ? (res as Record<string, unknown>) : {};
      if (rec.ok !== true) throw new Error(String(rec.error || 'Login failed'));
      setPassword('');
      setInfo('تم تسجيل الدخول');
      await refreshSession();
    } catch (e: unknown) {
      setError(getErr(e) || 'فشل تسجيل الدخول');
      setLoggedIn(false);
      setTokenConfigured(null);
    } finally {
      setBusy(false);
    }
  };

  const doLogout = async () => {
    if (!canUseBridge) return;
    setBusy(true);
    setError('');
    setInfo('');
    try {
      await window.desktopLicenseAdmin.logout();
      setInfo('تم تسجيل الخروج');
    } finally {
      setBusy(false);
      await refreshSession();
    }
  };

  const addServer = () => {
    const origin = normalizeServerOrigin(newServer);
    if (!origin) {
      setError('رابط السيرفر غير صالح');
      return;
    }
    const next = Array.from(new Set([origin, ...servers]));
    setServers(next);
    setSelectedServer(origin);
    saveLicenseAdminServers(next);
    setNewServer('');
    setInfo('تمت إضافة السيرفر');
  };

  const removeSelectedServer = () => {
    if (!selectedServer) return;
    const next = servers.filter((s) => s !== selectedServer);
    setServers(next);
    saveLicenseAdminServers(next);
    const fallback = next[0] || normalizeServerOrigin('http://127.0.0.1:5056');
    setSelectedServer(fallback);
    setInfo('تم حذف السيرفر من القائمة');
  };

  return (
    <div className="h-screen overflow-y-auto bg-slate-50 dark:bg-slate-950" dir="rtl">
      <div className="p-4 md:p-6 space-y-4 max-w-5xl mx-auto">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">لوحة برنامج إدارة التفعيل</h1>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              نقطة انطلاق لإعداد السيرفر/الدخول ثم إدارة التراخيص والمتابعة.
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => void refreshSession()} disabled={busy}>
              تحديث الحالة
            </Button>
            {loggedIn ? (
              <Button variant="secondary" onClick={() => void doLogout()} disabled={busy}>
                تسجيل الخروج
              </Button>
            ) : null}
          </div>
        </div>

        <Card className="p-4 space-y-3">
          <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">السيرفر</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <div className="text-xs text-slate-500 mb-1">اختيار سيرفر</div>
              <Select
                value={selectedServer}
                onChange={(e) => setSelectedServer(String(e.target.value))}
                options={serverOptions}
                disabled={busy || servers.length === 0}
              />
              <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 break-all">
                {selectedServer ? `المحدد: ${selectedServer}` : '—'}
              </div>
            </div>

            <div>
              <div className="text-xs text-slate-500 mb-1">إضافة سيرفر جديد</div>
              <div className="flex items-center gap-2">
                <Input
                  value={newServer}
                  onChange={(e) => setNewServer(e.target.value)}
                  placeholder="https://license.example.com"
                  disabled={busy}
                />
                <Button onClick={addServer} disabled={busy}>
                  إضافة
                </Button>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <Button variant="danger" onClick={removeSelectedServer} disabled={busy || servers.length <= 1}>
                  حذف المحدد
                </Button>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">الدخول</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                الحالة: {canUseBridge ? (loggedIn ? 'مُسجل دخول' : loggedIn === false ? 'غير مُسجل' : '—') : 'Electron فقط'}
                {loggedIn ? ` — توكن السيرفر: ${tokenConfigured === null ? '—' : tokenConfigured ? 'مُعد' : 'غير مُعد'}` : ''}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link to={ROUTE_PATHS.LICENSE_ADMIN_USERS}>
                <Button variant="secondary" disabled={busy || !loggedIn}>
                  المستخدمين
                </Button>
              </Link>
            </div>
          </div>

          {!loggedIn ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <div className="text-xs text-slate-500 mb-1">اسم المستخدم</div>
                <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="admin" disabled={busy} />
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-1">كلمة المرور</div>
                <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="••••••••" disabled={busy} />
              </div>
              <div className="flex items-end">
                <Button onClick={() => void doLogin()} disabled={busy || !canUseBridge}>
                  دخول
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-sm text-slate-600 dark:text-slate-300">
              يمكنك الآن الدخول إلى إدارة التراخيص أو العملاء.
            </div>
          )}
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-4 space-y-3">
            <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">إدارة التراخيص</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">إصدار/تعليق/إلغاء + ربط جهاز + حفظ ملف ترخيص</div>
            <Link to={ROUTE_PATHS.LICENSE_ADMIN_LICENSES}>
              <Button disabled={!loggedIn || busy || !canUseBridge}>
                فتح
              </Button>
            </Link>
          </Card>

          <Card className="p-4 space-y-3">
            <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">العملاء والمفاتيح</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">تجميع مفاتيح الترخيص حسب العميل</div>
            <Link to={ROUTE_PATHS.LICENSE_ADMIN_CUSTOMERS}>
              <Button variant="secondary" disabled={!loggedIn || busy || !canUseBridge}>
                فتح
              </Button>
            </Link>
          </Card>

          <Card className="p-4 space-y-3">
            <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">تفعيل النظام</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">عرض بصمة الجهاز + تفعيل عبر ملف أو الإنترنت</div>
            <Link to={ROUTE_PATHS.ACTIVATION}>
              <Button variant="secondary" disabled={busy}>
                فتح
              </Button>
            </Link>
          </Card>
        </div>

        {error ? <div className="text-sm text-red-600">{error}</div> : null}
        {info ? <div className="text-sm text-slate-600 dark:text-slate-300">{info}</div> : null}
      </div>
    </div>
  );
};
