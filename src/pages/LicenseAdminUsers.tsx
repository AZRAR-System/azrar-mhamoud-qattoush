import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { ROUTE_PATHS } from '@/routes/paths';

const getErr = (e: unknown): string => {
  if (e instanceof Error) return e.message;
  return String(e || '');
};

export const LicenseAdminUsers: React.FC = () => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const [username, setUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const canUseBridge = typeof window !== 'undefined' && !!window.desktopLicenseAdmin;

  const load = async () => {
    if (!canUseBridge) {
      setError('Desktop bridge not available. Run in Electron.');
      return;
    }

    setBusy(true);
    setError('');
    setInfo('');
    try {
      const res = await window.desktopLicenseAdmin?.getUser();
      const rec = res && typeof res === 'object' ? (res as Record<string, unknown>) : {};
      if (rec.ok !== true) throw new Error(String(rec.error || 'Unauthorized'));
      const user =
        rec.user && typeof rec.user === 'object' ? (rec.user as Record<string, unknown>) : {};
      setUsername(String(user.username || ''));
      setInfo('تم تحميل بيانات المستخدم');
    } catch (e: unknown) {
      setError(getErr(e) || 'Failed to load user');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    if (!canUseBridge) return;
    setError('');
    setInfo('');

    const u = username.trim();
    if (!u) {
      setError('اسم المستخدم مطلوب');
      return;
    }

    const p = newPassword.trim();
    const c = confirmPassword.trim();
    if (p || c) {
      if (!p) {
        setError('أدخل كلمة المرور الجديدة');
        return;
      }
      if (p !== c) {
        setError('كلمة المرور الجديدة غير متطابقة');
        return;
      }
    }

    setBusy(true);
    try {
      const res = await window.desktopLicenseAdmin?.updateUser({
        username: u,
        newPassword: p || undefined,
      });
      const rec = res && typeof res === 'object' ? (res as Record<string, unknown>) : {};
      if (rec.ok !== true) throw new Error(String(rec.error || 'Failed'));
      setInfo('تم حفظ بيانات المستخدم');
      setNewPassword('');
      setConfirmPassword('');
    } catch (e: unknown) {
      setError(getErr(e) || 'Failed to save');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="h-screen overflow-y-auto bg-slate-50 dark:bg-slate-950" dir="rtl">
      <div className="p-4 md:p-6 space-y-4 max-w-3xl mx-auto">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">المستخدمين</h1>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              تعديل اسم المستخدم وكلمة المرور لبرنامج إدارة التفعيل
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link to={ROUTE_PATHS.LICENSE_ADMIN}>
              <Button variant="secondary">لوحة التحكم</Button>
            </Link>
            <Link to={ROUTE_PATHS.LICENSE_ADMIN_LICENSES}>
              <Button variant="secondary">التراخيص</Button>
            </Link>
          </div>
        </div>

        <Card className="p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">
                اسم المستخدم
              </div>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
              />
            </div>
            <div className="md:col-span-2">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                لتغيير كلمة المرور: أدخل كلمة المرور الجديدة ثم التأكيد. إذا تركتها فارغة سيتم فقط
                تعديل اسم المستخدم.
              </div>
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">
                كلمة المرور الجديدة
              </div>
              <Input
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                type="password"
                placeholder="••••••••"
              />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">
                تأكيد كلمة المرور
              </div>
              <Input
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                type="password"
                placeholder="••••••••"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button onClick={() => void save()} disabled={busy || !canUseBridge}>
              حفظ
            </Button>
            <Button
              variant="secondary"
              onClick={() => void load()}
              disabled={busy || !canUseBridge}
            >
              إعادة تحميل
            </Button>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {canUseBridge ? 'تعمل داخل Electron' : 'هذه الصفحة تعمل داخل Electron فقط'}
            </div>
          </div>

          {error ? <div className="text-sm text-red-600">{error}</div> : null}
          {info ? <div className="text-sm text-slate-600 dark:text-slate-300">{info}</div> : null}
        </Card>
      </div>
    </div>
  );
};
