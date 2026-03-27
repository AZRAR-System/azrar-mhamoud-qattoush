import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  Lock,
  User,
  LogIn,
  AlertCircle,
  Info,
  Eye,
  EyeOff,
  Database,
  ShieldCheck,
  Save,
  Server,
  Check,
  Loader2,
} from 'lucide-react';
import { storage } from '@/services/storage';
import { ROUTE_PATHS } from '@/routes/paths';
import { useAppDialogs } from '@/hooks/useAppDialogs';
import { useActivation } from '@/context/ActivationContext';
import { safeJsonParseArray } from '@/utils/json';
import { AppModal } from '@/components/ui/AppModal';
import { hashPassword } from '@/services/passwordHash';
import { DesktopDbBridge } from '@/types/electron.types';

type StoredUser = {
  id?: string;
  اسم_المستخدم?: string;
  كلمة_المرور?: string;
  الدور?: string;
  isActive?: boolean;
};

type DesktopSqlSettings = Partial<{
  enabled: boolean;
  server: string;
  port: number;
  database: string;
  authMode: 'sql' | 'windows';
  user: string;
  password?: string;
  encrypt: boolean;
  trustServerCertificate: boolean;
  hasPassword?: boolean;
}>;

const toRecord = (v: unknown): Record<string, unknown> =>
  typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {};

export const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasAnyUsers, setHasAnyUsers] = useState<boolean | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [rememberUsername, setRememberUsername] = useState(true);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [activationError, setActivationError] = useState('');
  const [activationBusy, setActivationBusy] = useState(false);
  const [deviceId, setDeviceId] = useState<string>('');

  // Registration State
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [regUsername, setRegUsername] = useState('admin');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regLoading, setRegLoading] = useState(false);

  // DB Settings State
  const [showDbSettings, setShowDbSettings] = useState(false);
  const [sqlForm, setSqlForm] = useState<DesktopSqlSettings>({
    enabled: true,
    server: '',
    port: 1433,
    database: 'AZRAR',
    authMode: 'sql',
    user: 'sa',
    password: '',
    encrypt: true,
    trustServerCertificate: true,
  });
  const [sqlBusy, setSqlBusy] = useState(false);

  const usernameRef = useRef<HTMLInputElement | null>(null);
  const passwordRef = useRef<HTMLInputElement | null>(null);

  const { login } = useAuth();
  const {
    isActivated,
    loading: activationLoading,
    activatedAt,
    activationError: activationStatusError,
    activateWithLicenseFileContent,
    refresh,
  } = useActivation();
  const dialogs = useAppDialogs();

  const REMEMBER_KEY = 'azrar_login_remember_username';
  const LAST_USERNAME_KEY = 'azrar_login_last_username';

  const trimmedUsername = useMemo(() => username.trim(), [username]);
  const trimmedPassword = useMemo(() => password, [password]);

  const usernameError = useMemo(() => {
    if (!submitAttempted) return '';
    if (!trimmedUsername) return 'اسم المستخدم مطلوب.';
    return '';
  }, [submitAttempted, trimmedUsername]);

  const passwordError = useMemo(() => {
    if (!submitAttempted) return '';
    if (!trimmedPassword) return 'كلمة المرور مطلوبة.';
    return '';
  }, [submitAttempted, trimmedPassword]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitAttempted(true);
    setError('');
    setNotice('');

    const u = trimmedUsername;
    const p = trimmedPassword;
    if (!u) {
      setError('يرجى إدخال اسم المستخدم.');
      usernameRef.current?.focus();
      return;
    }
    if (!p) {
      setError('يرجى إدخال كلمة المرور.');
      passwordRef.current?.focus();
      return;
    }

    setLoading(true);
    try {
      if (!isActivated) {
        setError('يرجى تفعيل النظام أولاً قبل تسجيل الدخول.');
        return;
      }
      const success = await login(u, p);
      if (success) {
        if (rememberUsername) {
          await storage.setItem(REMEMBER_KEY, 'true');
          await storage.setItem(LAST_USERNAME_KEY, u);
        } else {
          await storage.setItem(REMEMBER_KEY, 'false');
          await storage.removeItem(LAST_USERNAME_KEY);
        }
        window.location.hash = ROUTE_PATHS.DASHBOARD;
        return;
      }
      setError('اسم المستخدم أو كلمة المرور غير صحيحة');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // Prefer HW fingerprint when available (new activation binding).
        const fpRes = await window.desktopLicense?.getDeviceFingerprint?.();
        const fp = fpRes && typeof fpRes === 'object' ? (fpRes as Record<string, unknown>) : {};
        const fpVal = typeof fp.fingerprint === 'string' ? fp.fingerprint.trim() : '';
        if (!mounted) return;
        if (fpVal) {
          setDeviceId(fpVal);
          return;
        }

        const id = await window.desktopDb?.getDeviceId?.();
        if (!mounted) return;
        if (typeof id === 'string' && id.trim()) setDeviceId(id.trim());
      } catch {
        // ignore
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const handlePickLicenseFile = async () => {
    setActivationError('');
    setError('');
    setNotice('');
    setActivationBusy(true);
    try {
      const res = await window.desktopDb?.pickLicenseFile?.();
      const rec = res && typeof res === 'object' ? (res as Record<string, unknown>) : {};
      if (rec.canceled) return;
      if (rec.ok !== true) {
        const err = typeof rec.error === 'string' ? rec.error : 'تعذر تحميل ملف التفعيل.';
        setActivationError(err);
        return;
      }
      const content = typeof rec.content === 'string' ? rec.content : '';
      if (!content.trim()) {
        setActivationError('ملف التفعيل فارغ.');
        return;
      }

      await activateWithLicenseFileContent(content);
      await refresh();
      window.location.reload();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setActivationError(msg || 'تعذر تحميل ملف التفعيل.');
    } finally {
      setActivationBusy(false);
    }
  };

  const getUsers = async (): Promise<StoredUser[]> => {
    const raw = await storage.getItem('db_users');
    if (!raw) return [];
    return safeJsonParseArray(raw) as StoredUser[];
  };

  const persistUsers = async (users: StoredUser[]) => {
    await storage.setItem('db_users', JSON.stringify(users));
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const users = await getUsers();
        if (mounted) setHasAnyUsers(users.length > 0);
      } catch {
        if (mounted) setHasAnyUsers(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const rememberRaw = await storage.getItem(REMEMBER_KEY);
        const remember =
          rememberRaw === null || rememberRaw === undefined
            ? true
            : String(rememberRaw).toLowerCase() !== 'false';
        if (!mounted) return;
        setRememberUsername(remember);
        if (!remember) return;

        const last = await storage.getItem(LAST_USERNAME_KEY);
        if (!mounted) return;
        if (typeof last === 'string' && last.trim()) setUsername(last.trim());
      } catch {
        // ignore
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');

    if (!regUsername.trim()) {
      setError('اسم المستخدم مطلوب.');
      return;
    }
    if (regPassword.length < 6) {
      setError('كلمة المرور يجب أن لا تقل عن 6 أحرف.');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setError('كلمات المرور غير متطابقة.');
      return;
    }

    setRegLoading(true);
    try {
      const users = await getUsers();
      if (users.length > 0) {
        setError('يوجد مستخدمون بالفعل في النظام.');
        return;
      }

      const hashedPassword = await hashPassword(regPassword);
      const newUser: StoredUser = {
        id: '1',
        اسم_المستخدم: regUsername.trim(),
        كلمة_المرور: hashedPassword,
        الدور: 'SuperAdmin',
        isActive: true,
      };

      await persistUsers([newUser]);
      setHasAnyUsers(true);
      setUsername(regUsername.trim());
      setPassword('');
      setShowRegisterForm(false);
      setNotice('تم إنشاء حساب السوبر أدمن بنجاح. يمكنك تسجيل الدخول الآن.');
    } catch {
      setError('حدث خطأ أثناء إنشاء الحساب.');
    } finally {
      setRegLoading(false);
    }
  };

  const handleSqlTest = async () => {
    if (!window.desktopDb?.sqlTestConnection) return;
    setSqlBusy(true);
    try {
      const res = await window.desktopDb.sqlTestConnection(
        sqlForm as Parameters<NonNullable<DesktopDbBridge['sqlTestConnection']>>[0]
      );
      const rec = toRecord(res);
      if (rec.ok) {
        setNotice('تم الاتصال بقاعدة البيانات بنجاح.');
      } else {
        setError(String(rec.message || 'فشل الاتصال بقاعدة البيانات.'));
      }
    } catch {
      setError('حدث خطأ أثناء اختبار الاتصال.');
    } finally {
      setSqlBusy(false);
    }
  };

  const handleSqlSave = async () => {
    if (!window.desktopDb?.sqlSaveSettings) return;
    setSqlBusy(true);
    try {
      const res = await window.desktopDb.sqlSaveSettings(
        sqlForm as Parameters<NonNullable<DesktopDbBridge['sqlSaveSettings']>>[0]
      );
      const rec = toRecord(res);
      if (rec.success !== false) {
        setNotice('تم حفظ إعدادات قاعدة البيانات.');
        setShowDbSettings(false);
      } else {
        setError(String(rec.message || 'فشل حفظ الإعدادات.'));
      }
    } catch {
      setError('حدث خطأ أثناء حفظ الإعدادات.');
    } finally {
      setSqlBusy(false);
    }
  };

  useEffect(() => {
    if (showDbSettings && window.desktopDb?.sqlGetSettings) {
      void (async () => {
        const s = await window.desktopDb?.sqlGetSettings?.();
        if (s) setSqlForm(s as DesktopSqlSettings);
      })();
    }
  }, [showDbSettings]);

  const handleCreateDefaultAdmin = async () => {
    setShowRegisterForm(true);
  };

  const _handleChangeAdminPassword = async () => {
    setError('');
    setNotice('');
    try {
      const users = await getUsers();
      if (users.length === 0) {
        setError('لا يوجد مستخدمون. أنشئ admin أولاً.');
        return;
      }

      const idx = users.findIndex((u) => u?.اسم_المستخدم === 'admin');
      if (idx < 0) {
        setError('لا يوجد حساب admin حالياً.');
        return;
      }

      const newPass = await dialogs.prompt({
        title: 'تغيير كلمة مرور admin',
        message: 'أدخل كلمة المرور الجديدة لحساب admin:',
        inputType: 'password',
        placeholder: 'كلمة المرور الجديدة',
        required: true,
      });
      if (newPass === null || newPass === undefined) return;
      const trimmed = String(newPass).trim();
      if (trimmed.length < 4) {
        setError('كلمة المرور قصيرة جداً.');
        return;
      }

      users[idx] = {
        ...users[idx],
        كلمة_المرور: trimmed,
        isActive: true,
        الدور: users[idx].الدور || 'SuperAdmin',
      };
      await persistUsers(users);

      setUsername('admin');
      setPassword(trimmed);
      setNotice('تم تعديل كلمة مرور حساب المدير بنجاح.');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(toRecord(e).message || '').trim();
      setError(msg || 'تعذر تعديل كلمة مرور admin');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-900 transition-colors duration-300 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -top-20 -left-20 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl"></div>
      </div>

      <div className="app-card p-6 md:p-8 rounded-3xl shadow-2xl w-full max-w-5xl border-gray-100 dark:border-slate-700 relative z-10 animate-scale-up">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-500/30">
            <span className="text-3xl font-bold text-white">A</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
            نظام AZRAR لإدارة العقارات
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-2">
            يرجى تفعيل النظام ثم تسجيل الدخول للمتابعة
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
          {/* Activation panel */}
          <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white/70 dark:bg-slate-900/40 p-5 md:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-bold text-slate-800 dark:text-white">التفعيل</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  تفعيل البرنامج قبل استخدامه
                </div>
              </div>
              <button
                type="button"
                className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:underline"
                onClick={() => void refresh()}
                disabled={activationBusy}
              >
                تحديث الحالة
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-3">
                <div className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                  بصمة الجهاز
                </div>
                <div
                  className="mt-1 text-[11px] text-slate-700 dark:text-slate-200 break-all"
                  dir="ltr"
                >
                  {deviceId || 'غير متاح'}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-slate-700 dark:text-slate-200">الحالة:</div>
                <div
                  className={
                    'text-xs font-bold ' +
                    (isActivated
                      ? 'text-emerald-700 dark:text-emerald-300'
                      : 'text-rose-700 dark:text-rose-300')
                  }
                >
                  {activationLoading ? '...' : isActivated ? 'مُفعّل' : 'غير مُفعّل'}
                </div>
              </div>

              {isActivated && activatedAt && (
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  آخر تفعيل: {new Date(activatedAt).toLocaleString()}
                </div>
              )}

              {!isActivated && (
                <>
                  {(activationError || activationStatusError) && (
                    <div className="text-xs text-rose-600 dark:text-rose-300 font-semibold">
                      {activationError || activationStatusError}
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        window.location.hash = ROUTE_PATHS.ACTIVATION;
                      }}
                      disabled={activationBusy || activationLoading}
                      className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-bold transition shadow-lg shadow-indigo-600/30 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      صفحة التفعيل
                    </button>

                    <button
                      type="button"
                      onClick={() => void handlePickLicenseFile()}
                      disabled={
                        activationBusy || activationLoading || !window.desktopDb?.pickLicenseFile
                      }
                      className="flex-1 text-xs font-bold py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      تحميل ملف التفعيل
                    </button>
                  </div>

                  <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    التفعيل يتم عبر ملف تفعيل مُوقّع مرتبط ببصمة الجهاز أو عبر الإنترنت من صفحة
                    التفعيل.
                  </div>
                </>
              )}

              {isActivated && (
                <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-200 text-xs font-semibold p-3">
                  النظام مُفعّل ويمكنك تسجيل الدخول.
                </div>
              )}
            </div>
          </div>

          {/* Login panel */}
          <div>
            {showRegisterForm ? (
              <form onSubmit={handleRegister} className="space-y-6 animate-slide-in-right">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400">
                    <User size={20} />
                  </div>
                  <h2 className="text-xl font-black text-slate-800 dark:text-white">
                    إنشاء حساب المدير
                  </h2>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-widest px-1">
                    اسم المستخدم
                  </label>
                  <div className="relative group">
                    <User
                      size={18}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors"
                    />
                    <input
                      type="text"
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-3.5 pr-12 pl-4 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      value={regUsername}
                      onChange={(e) => setRegUsername(e.target.value)}
                      placeholder="admin"
                      disabled={regLoading}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-widest px-1">
                    كلمة المرور
                  </label>
                  <div className="relative group">
                    <Lock
                      size={18}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors"
                    />
                    <input
                      type="password"
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-3.5 pr-12 pl-4 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="••••••••"
                      disabled={regLoading}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-widest px-1">
                    تأكيد كلمة المرور
                  </label>
                  <div className="relative group">
                    <ShieldCheck
                      size={18}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors"
                    />
                    <input
                      type="password"
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-3.5 pr-12 pl-4 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      value={regConfirmPassword}
                      onChange={(e) => setRegConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      disabled={regLoading}
                    />
                  </div>
                </div>

                {error && (
                  <div className="bg-rose-50 dark:bg-rose-900/20 text-rose-600 text-xs p-3 rounded-xl flex items-center gap-2 border border-rose-100 dark:border-rose-800 font-bold">
                    <AlertCircle size={14} />
                    {error}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={regLoading}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-bold transition shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2"
                  >
                    {regLoading ? (
                      <Loader2 className="animate-spin" size={18} />
                    ) : (
                      <>
                        إنشاء الحساب <Check size={18} />
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowRegisterForm(false)}
                    disabled={regLoading}
                    className="px-6 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 rounded-xl font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6" noValidate>
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                    اسم المستخدم
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      ref={usernameRef}
                      autoComplete="username"
                      autoCapitalize="none"
                      autoCorrect="off"
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-600 rounded-xl py-3 pr-10 pl-4 focus:ring-2 focus:ring-indigo-500 outline-none transition text-slate-800 dark:text-white"
                      placeholder="أدخل اسم المستخدم"
                      value={username}
                      onChange={(e) => {
                        setUsername(e.target.value);
                        if (error) setError('');
                      }}
                    />
                    <User className="absolute top-3.5 right-3 text-slate-400" size={18} />
                  </div>
                  {usernameError && (
                    <div className="mt-2 text-xs text-rose-600 dark:text-rose-300 font-semibold">
                      {usernameError}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                    كلمة المرور
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      ref={passwordRef}
                      autoComplete="current-password"
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-600 rounded-xl py-3 pr-20 pl-4 focus:ring-2 focus:ring-indigo-500 outline-none transition text-slate-800 dark:text-white"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (error) setError('');
                      }}
                      onKeyDown={(e) => {
                        try {
                          setCapsLockOn(!!e.getModifierState?.('CapsLock'));
                        } catch {
                          // ignore
                        }
                      }}
                      onKeyUp={(e) => {
                        try {
                          setCapsLockOn(!!e.getModifierState?.('CapsLock'));
                        } catch {
                          // ignore
                        }
                      }}
                    />
                    <Lock
                      className="absolute top-1/2 -translate-y-1/2 right-3 text-slate-400 pointer-events-none"
                      size={18}
                    />
                    <button
                      type="button"
                      className="absolute top-1/2 -translate-y-1/2 right-11 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                      onClick={() => setShowPassword((v) => !v)}
                      title={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                      aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {passwordError && (
                    <div className="mt-2 text-xs text-rose-600 dark:text-rose-300 font-semibold">
                      {passwordError}
                    </div>
                  )}
                  {capsLockOn && (
                    <div className="mt-2 text-xs text-amber-700 dark:text-amber-300 font-semibold">
                      تنبيه: زر Caps Lock مفعّل.
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between gap-3">
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300 select-none">
                    <input
                      type="checkbox"
                      checked={rememberUsername}
                      onChange={(e) => {
                        const next = e.target.checked;
                        setRememberUsername(next);
                        if (!next) {
                          void storage.setItem(REMEMBER_KEY, 'false');
                          void storage.removeItem(LAST_USERNAME_KEY);
                        }
                      }}
                    />
                    تذكّر اسم المستخدم
                  </label>

                  <button
                    type="button"
                    className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:underline"
                    onClick={() => setShowDbSettings(true)}
                  >
                    إعدادات قاعدة البيانات
                  </button>

                  <button
                    type="button"
                    className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:underline"
                    onClick={() => {
                      setNotice(
                        'إذا نسيت كلمة المرور، راجع مسؤول النظام. إذا كانت هذه أول مرة، أنشئ حساب السوبر أدمن من الأسفل.'
                      );
                      setError('');
                    }}
                  >
                    مساعدة تسجيل الدخول
                  </button>
                </div>

                {error && (
                  <div className="bg-red-50 dark:bg-red-900/20 text-red-600 text-sm p-3 rounded-xl flex items-center gap-2 border border-red-100 dark:border-red-800">
                    <AlertCircle size={16} />
                    {error}
                  </div>
                )}

                {notice && (
                  <div className="bg-slate-50 dark:bg-slate-700/30 text-slate-700 dark:text-slate-200 text-sm p-3 rounded-xl flex items-center gap-2 border border-slate-100 dark:border-slate-700">
                    <Info size={16} />
                    {notice}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || activationLoading || !isActivated}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-bold transition shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <>
                      تسجيل الدخول <LogIn size={18} />
                    </>
                  )}
                </button>

                {hasAnyUsers === false && (
                  <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-700/30 rounded-xl border border-slate-100 dark:border-slate-700">
                    <div className="flex items-center gap-2 text-slate-500 dark:text-slate-300 text-xs font-bold">
                      <Info size={14} />
                      <span>إعداد أول مرة</span>
                    </div>
                    <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                      لا يوجد مستخدمون حالياً. أنشئ حساب السوبر أدمن لاستخدام النظام.
                    </div>
                    <div className="mt-3 w-full">
                      <button
                        type="button"
                        onClick={handleCreateDefaultAdmin}
                        className="w-full text-xs font-bold py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                      >
                        إنشاء حساب السوبر أدمن
                      </button>
                    </div>
                  </div>
                )}

                {!isActivated && (
                  <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                    تسجيل الدخول معطّل حتى يتم تفعيل النظام.
                  </div>
                )}
              </form>
            )}
          </div>
        </div>

        <div className="mt-8 text-center border-t border-gray-100 dark:border-slate-700 pt-4 text-[10px] text-slate-400 dark:text-slate-500">
          <p dir="ltr">
            &copy; 2025 — Developed by <span className="font-bold">Mahmoud Qattoush</span>
          </p>
          <p dir="ltr">AZRAR Real Estate Management System — All Rights Reserved</p>
        </div>
      </div>

      {/* Database Settings Modal */}
      <AppModal
        open={showDbSettings}
        onClose={() => !sqlBusy && setShowDbSettings(false)}
        title="إعدادات الاتصال بقاعدة البيانات (SQL Server)"
      >
        <div className="space-y-8 p-4" dir="rtl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-xs font-black text-slate-500 mb-2 uppercase tracking-widest px-1">
                عنوان الخادم (Server Name)
              </label>
              <div className="relative group">
                <Server
                  size={18}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors"
                />
                <input
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-3.5 pr-12 pl-4 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  placeholder="127.0.0.1 أو اسم الخادم"
                  value={sqlForm.server}
                  onChange={(e) => setSqlForm((p) => ({ ...p, server: e.target.value }))}
                  disabled={sqlBusy}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-black text-slate-500 mb-2 uppercase tracking-widest px-1">
                المنفذ (Port)
              </label>
              <input
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-3.5 px-4 text-sm font-mono font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                placeholder="1433"
                value={String(sqlForm.port ?? 1433)}
                onChange={(e) =>
                  setSqlForm((p) => ({ ...p, port: Number(e.target.value || 1433) || 1433 }))
                }
                disabled={sqlBusy}
              />
            </div>

            <div>
              <label className="block text-xs font-black text-slate-500 mb-2 uppercase tracking-widest px-1">
                قاعدة البيانات
              </label>
              <div className="relative group">
                <Database
                  size={18}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors"
                />
                <input
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-3.5 pr-12 pl-4 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  placeholder="AZRAR"
                  value={sqlForm.database}
                  onChange={(e) => setSqlForm((p) => ({ ...p, database: e.target.value }))}
                  disabled={sqlBusy}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-black text-slate-500 mb-2 uppercase tracking-widest px-1">
                اسم المستخدم
              </label>
              <div className="relative group">
                <User
                  size={18}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors"
                />
                <input
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-3.5 pr-12 pl-4 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  placeholder="sa"
                  value={sqlForm.user}
                  onChange={(e) => setSqlForm((p) => ({ ...p, user: e.target.value }))}
                  disabled={sqlBusy}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-black text-slate-500 mb-2 uppercase tracking-widest px-1">
                كلمة المرور
              </label>
              <div className="relative group">
                <Lock
                  size={18}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors"
                />
                <input
                  type="password"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-3.5 pr-12 pl-4 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  placeholder={sqlForm.hasPassword ? '•••••••• (محفوظة)' : 'أدخل كلمة المرور'}
                  value={sqlForm.password}
                  onChange={(e) => setSqlForm((p) => ({ ...p, password: e.target.value }))}
                  disabled={sqlBusy}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 pt-6">
            <button
              onClick={handleSqlTest}
              className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 px-6 py-3 rounded-2xl text-sm font-black flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95"
              disabled={sqlBusy}
            >
              {sqlBusy ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <ShieldCheck size={18} className="text-emerald-500" />
              )}
              <span>اختبار الاتصال</span>
            </button>
            <button
              onClick={handleSqlSave}
              className="flex-1 bg-indigo-600 text-white hover:bg-indigo-700 px-8 py-3 rounded-2xl text-sm font-black flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-500/20 active:scale-95 disabled:opacity-50"
              disabled={sqlBusy}
            >
              {sqlBusy ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              <span>حفظ الإعدادات</span>
            </button>
          </div>
        </div>
      </AppModal>
    </div>
  );
};
