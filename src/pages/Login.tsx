import { useEffect, useMemo, useRef, useState } from 'react';
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
  CheckCircle2,
  ServerCog,
  Sparkles,
  KeyRound,
} from 'lucide-react';
import { storage } from '@/services/storage';
import { ROUTE_PATHS } from '@/routes/paths';
import { useAppDialogs } from '@/hooks/useAppDialogs';
import { useToast } from '@/context/ToastContext';
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

const SEED_ADMIN_USER = String(import.meta.env.VITE_SEED_DEFAULT_ADMIN_USERNAME || 'admin').trim();
const SEED_ADMIN_PASS = String(import.meta.env.VITE_SEED_DEFAULT_ADMIN_PASSWORD || '');
const LOGIN_PREFILL = String(import.meta.env.VITE_LOGIN_PREFILL || '').toLowerCase() === 'true';

export const Login = () => {
  const [username, setUsername] = useState(SEED_ADMIN_USER);
  const [password, setPassword] = useState(() =>
    LOGIN_PREFILL && SEED_ADMIN_PASS.length > 0 ? SEED_ADMIN_PASS : ''
  );
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
  const [sqlFeedback, setSqlFeedback] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

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
  const toast = useToast();

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
    if (!window.desktopDb?.sqlTestConnection) {
      toast.warning('ميزة الاتصال متاحة في نسخة سطح المكتب فقط.', 'غير متاح');
      return;
    }
    setSqlBusy(true);
    setSqlFeedback(null);
    try {
      const res = await window.desktopDb.sqlTestConnection(
        sqlForm as Parameters<NonNullable<DesktopDbBridge['sqlTestConnection']>>[0]
      );
      const rec = toRecord(res);
      if (rec.ok) {
        const msg = String(rec.message || 'تم التحقق من الاتصال بـ SQL Server بنجاح.');
        toast.success(msg, 'اتصال ناجح');
        setSqlFeedback({ kind: 'ok', text: msg });
      } else {
        const msg = String(
          rec.message || 'تعذر الاتصال بالخادم. تحقق من العنوان والمنفذ والصلاحيات.'
        );
        toast.error(msg, 'فشل اختبار الاتصال');
        setSqlFeedback({ kind: 'err', text: msg });
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'حدث خطأ غير متوقع أثناء اختبار الاتصال.';
      toast.error(msg, 'خطأ');
      setSqlFeedback({ kind: 'err', text: msg });
    } finally {
      setSqlBusy(false);
    }
  };

  const handleSqlSave = async () => {
    if (!window.desktopDb?.sqlSaveSettings) {
      toast.warning('حفظ الإعدادات متاح في نسخة سطح المكتب فقط.', 'غير متاح');
      return;
    }
    setSqlBusy(true);
    setSqlFeedback(null);
    try {
      const res = await window.desktopDb.sqlSaveSettings(
        sqlForm as Parameters<NonNullable<DesktopDbBridge['sqlSaveSettings']>>[0]
      );
      const rec = toRecord(res);
      if (rec.success !== false) {
        const msg = String(rec.message || 'تم حفظ إعدادات الاتصال بنجاح.');
        toast.success(msg, 'تم الحفظ');
        setShowDbSettings(false);
      } else {
        const msg = String(rec.message || 'تعذر حفظ الإعدادات. راجع الاتصال أو الصلاحيات.');
        toast.error(msg, 'فشل الحفظ');
        setSqlFeedback({ kind: 'err', text: msg });
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'حدث خطأ غير متوقع أثناء حفظ الإعدادات.';
      toast.error(msg, 'خطأ');
      setSqlFeedback({ kind: 'err', text: msg });
    } finally {
      setSqlBusy(false);
    }
  };

  useEffect(() => {
    if (showDbSettings && window.desktopDb?.sqlGetSettings) {
      setSqlFeedback(null);
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 via-white to-indigo-50/40 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 transition-colors duration-300 relative overflow-x-hidden overflow-y-auto py-8 px-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
        <div className="absolute -top-32 -right-32 h-[28rem] w-[28rem] rounded-full bg-indigo-400/15 blur-3xl dark:bg-indigo-500/10" />
        <div className="absolute -bottom-24 -left-24 h-[24rem] w-[24rem] rounded-full bg-violet-400/12 blur-3xl dark:bg-violet-600/10" />
        <div className="absolute top-1/2 left-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-200/20 blur-3xl dark:bg-slate-800/20" />
      </div>

      <div className="relative z-10 w-full max-w-5xl rounded-[2rem] border border-slate-200/80 bg-white/85 shadow-2xl shadow-slate-900/10 backdrop-blur-xl dark:border-slate-700/80 dark:bg-slate-900/75 dark:shadow-black/40 md:max-w-6xl animate-scale-up">
        <div className="border-b border-slate-200/80 bg-gradient-to-l from-indigo-50/90 to-white px-6 py-8 text-center dark:border-slate-700/80 dark:from-indigo-950/40 dark:to-slate-900/90 md:px-10 md:py-10 rounded-t-[2rem]">
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-slate-900 text-white shadow-xl shadow-indigo-900/30 ring-4 ring-white/50 dark:ring-slate-800/80">
            <Sparkles size={36} strokeWidth={1.5} className="opacity-95" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white md:text-3xl">
            نظام أزرار العقاري
          </h1>
          <p className="mx-auto mt-2 max-w-lg text-sm font-medium leading-relaxed text-slate-600 dark:text-slate-400">
            فعّل الترخيص ثم سجّل الدخول للوصول إلى لوحة التحكم بأمان.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 p-6 md:p-8 lg:grid-cols-2 lg:gap-10">
          {/* Activation panel */}
          <div className="flex flex-col rounded-2xl border border-slate-200/90 bg-slate-50/50 p-5 shadow-inner dark:border-slate-700/80 dark:bg-slate-950/40 md:p-6">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200/80 pb-4 dark:border-slate-700/60">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
                  <KeyRound size={20} />
                </span>
                <div>
                  <div className="text-base font-black text-slate-900 dark:text-white">
                    ترخيص النظام
                  </div>
                  <div className="mt-1 text-xs font-medium leading-relaxed text-slate-500 dark:text-slate-400">
                    ربط التثبيت بجهازك عبر ملف تفعيل صالح
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold text-indigo-700 transition hover:bg-indigo-50 dark:text-indigo-300 dark:hover:bg-indigo-950/50"
                onClick={() => void refresh()}
                disabled={activationBusy}
              >
                تحديث
              </button>
            </div>

            <div className="mt-5 flex flex-1 flex-col space-y-4">
              <div className="rounded-xl border border-slate-200/90 bg-white/80 p-3 dark:border-slate-600/60 dark:bg-slate-900/50">
                <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  بصمة الجهاز
                </div>
                <div
                  className="mt-2 font-mono text-[11px] leading-relaxed text-slate-800 dark:text-slate-200 break-all"
                  dir="ltr"
                >
                  {deviceId || 'غير متاح'}
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 rounded-xl bg-white/60 px-3 py-2.5 dark:bg-slate-900/40">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  حالة التفعيل
                </span>
                <span
                  className={`rounded-full px-3 py-1 text-[11px] font-black ${
                    activationLoading
                      ? 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                      : isActivated
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300'
                        : 'bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-200'
                  }`}
                >
                  {activationLoading ? 'جاري التحقق…' : isActivated ? 'مُفعّل' : 'غير مُفعّل'}
                </span>
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
                <div className="flex items-center gap-2 rounded-xl border border-emerald-200/90 bg-emerald-50/90 px-3 py-3 text-xs font-bold text-emerald-900 dark:border-emerald-800/50 dark:bg-emerald-950/30 dark:text-emerald-200">
                  <CheckCircle2 className="shrink-0" size={18} />
                  النظام مُفعّل — يمكنك المتابعة إلى تسجيل الدخول.
                </div>
              )}
            </div>
          </div>

          {/* Login panel */}
          <div className="flex flex-col rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm dark:border-slate-700/80 dark:bg-slate-950/30 md:p-6">
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
                      dir="ltr"
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-3.5 pr-12 pl-4 text-sm font-bold text-left outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
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
                      dir="ltr"
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-3.5 pr-12 pl-4 text-sm font-bold text-left outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
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
                <div className="flex items-center gap-3 border-b border-slate-100 pb-4 dark:border-slate-700/60">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
                    <LogIn size={22} strokeWidth={2} />
                  </span>
                  <div>
                    <h2 className="text-lg font-black text-slate-900 dark:text-white">
                      تسجيل الدخول
                    </h2>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      أدخل بيانات المستخدم النشط لديك
                    </p>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-bold text-slate-600 dark:text-slate-300">
                    اسم المستخدم
                  </label>
                  <div className="group relative">
                    <input
                      type="text"
                      required
                      ref={usernameRef}
                      autoComplete="username"
                      autoCapitalize="none"
                      autoCorrect="off"
                      className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50/90 py-3.5 pl-4 pr-12 text-sm font-semibold text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 dark:border-slate-600 dark:bg-slate-900/80 dark:text-white"
                      placeholder="مثال: admin"
                      value={username}
                      onChange={(e) => {
                        setUsername(e.target.value);
                        if (error) setError('');
                      }}
                    />
                    <User
                      className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition group-focus-within:text-indigo-500"
                      size={18}
                    />
                  </div>
                  {usernameError && (
                    <div className="mt-2 text-xs text-rose-600 dark:text-rose-300 font-semibold">
                      {usernameError}
                    </div>
                  )}
                </div>

                <div>
                  <label className="mb-2 block text-xs font-bold text-slate-600 dark:text-slate-300">
                    كلمة المرور
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      ref={passwordRef}
                      autoComplete="current-password"
                      dir="ltr"
                      className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50/90 py-3.5 pl-4 pr-[4.5rem] text-left text-sm font-semibold text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 dark:border-slate-600 dark:bg-slate-900/80 dark:text-white"
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
                      className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
                      size={18}
                    />
                    <button
                      type="button"
                      className="absolute right-12 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-700 dark:hover:text-slate-200"
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

                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                  <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300 select-none">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
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

                  <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs font-bold">
                    <button
                      type="button"
                      className="text-indigo-700 transition hover:text-indigo-900 dark:text-indigo-300 dark:hover:text-indigo-100"
                      onClick={() => {
                        setSqlFeedback(null);
                        setShowDbSettings(true);
                      }}
                    >
                      إعدادات قاعدة البيانات
                    </button>
                    <button
                      type="button"
                      className="text-slate-500 transition hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                      onClick={() => {
                        setNotice(
                          'إذا نسيت كلمة المرور، راجع مسؤول النظام. في أول تشغيل، أنشئ حساب المدير من الخيار أسفل النموذج.'
                        );
                        setError('');
                      }}
                    >
                      مساعدة
                    </button>
                  </div>
                </div>

                {error && (
                  <div
                    role="alert"
                    className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50/95 p-4 text-sm font-semibold text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-200"
                  >
                    <AlertCircle className="mt-0.5 shrink-0" size={18} />
                    <span>{error}</span>
                  </div>
                )}

                {notice && (
                  <div
                    role="status"
                    className="flex items-start gap-3 rounded-2xl border border-indigo-200/80 bg-indigo-50/90 p-4 text-sm font-semibold text-indigo-950 dark:border-indigo-800/40 dark:bg-indigo-950/35 dark:text-indigo-100"
                  >
                    <CheckCircle2
                      className="mt-0.5 shrink-0 text-indigo-600 dark:text-indigo-400"
                      size={18}
                    />
                    <span>{notice}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || activationLoading || !isActivated}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-l from-indigo-600 to-indigo-700 py-3.5 text-sm font-black text-white shadow-lg shadow-indigo-600/25 transition hover:from-indigo-500 hover:to-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
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

        <div className="border-t border-slate-200/80 px-6 py-5 text-center dark:border-slate-700/80 md:px-8">
          <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500" dir="ltr">
            &copy; {new Date().getFullYear()} — Developed by{' '}
            <span className="font-bold text-slate-500 dark:text-slate-400">Mahmoud Qattoush</span>
          </p>
          <p className="mt-1 text-[10px] text-slate-400/90 dark:text-slate-600" dir="ltr">
            AZRAR Real Estate Management System — All Rights Reserved
          </p>
        </div>
      </div>

      {/* Database Settings Modal */}
      <AppModal
        open={showDbSettings}
        onClose={() => !sqlBusy && setShowDbSettings(false)}
        size="3xl"
        title={
          <span className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-slate-800 text-white shadow-md">
              <ServerCog size={20} strokeWidth={2} />
            </span>
            <span className="text-base font-black text-slate-900 dark:text-white">
              اتصال SQL Server
            </span>
          </span>
        }
        titleClassName="!flex-1 !min-w-0"
        headerClassName="border-b border-slate-200/80 bg-slate-50/40 dark:border-slate-700/80 dark:bg-slate-900/40"
        bodyClassName="!p-4 sm:!p-6"
      >
        <div className="space-y-6" dir="rtl">
          {typeof window !== 'undefined' && !window.desktopDb?.sqlGetSettings ? (
            <div
              role="status"
              className="flex gap-3 rounded-2xl border border-amber-200/90 bg-amber-50/95 p-4 text-sm font-semibold text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/25 dark:text-amber-100"
            >
              <Info className="mt-0.5 shrink-0" size={18} />
              <span>
                إعدادات الخادم متاحة في <strong>نسخة سطح المكتب (Electron)</strong> فقط. في المتصفح
                يعمل النظام محلياً دون هذا الاتصال.
              </span>
            </div>
          ) : null}

          {sqlFeedback && (
            <div
              role={sqlFeedback.kind === 'err' ? 'alert' : 'status'}
              className={`flex items-start gap-3 rounded-2xl border p-4 text-sm font-semibold ${
                sqlFeedback.kind === 'ok'
                  ? 'border-emerald-200/90 bg-emerald-50/95 text-emerald-950 dark:border-emerald-800/50 dark:bg-emerald-950/30 dark:text-emerald-100'
                  : 'border-rose-200/90 bg-rose-50/95 text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/35 dark:text-rose-100'
              }`}
            >
              {sqlFeedback.kind === 'ok' ? (
                <CheckCircle2
                  className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400"
                  size={18}
                />
              ) : (
                <AlertCircle
                  className="mt-0.5 shrink-0 text-rose-600 dark:text-rose-400"
                  size={18}
                />
              )}
              <span className="leading-relaxed">{sqlFeedback.text}</span>
            </div>
          )}

          <p className="text-xs font-medium leading-relaxed text-slate-500 dark:text-slate-400">
            يُستخدم للمزامنة مع SQL Server. تأكد من تشغيل الخادم، فتح المنفذ، ومنح حساب تسجيل الدخول
            صلاحية الوصول إلى قاعدة البيانات المحددة.
          </p>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-6">
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
                  dir="ltr"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-3.5 pr-12 pl-4 text-sm font-bold text-left outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
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
                dir="ltr"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-3.5 px-4 text-sm font-mono font-bold text-left outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
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
                  dir="ltr"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-3.5 pr-12 pl-4 text-sm font-bold text-left outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
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
                  dir="ltr"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-3.5 pr-12 pl-4 text-sm font-bold text-left outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
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
                  dir="ltr"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-3.5 pr-12 pl-4 text-sm font-bold text-left outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  placeholder={sqlForm.hasPassword ? '•••••••• (محفوظة)' : 'أدخل كلمة المرور'}
                  value={sqlForm.password}
                  onChange={(e) => setSqlForm((p) => ({ ...p, password: e.target.value }))}
                  disabled={sqlBusy}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-200/80 pt-6 dark:border-slate-700/60 sm:flex-row sm:gap-4">
            <button
              type="button"
              onClick={() => void handleSqlTest()}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl border-2 border-slate-200 bg-white px-6 py-3.5 text-sm font-black text-slate-800 shadow-sm transition hover:bg-slate-50 active:scale-[0.99] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
              disabled={sqlBusy}
            >
              {sqlBusy ? (
                <Loader2 size={18} className="animate-spin text-indigo-500" />
              ) : (
                <ShieldCheck size={18} className="text-emerald-600 dark:text-emerald-400" />
              )}
              اختبار الاتصال
            </button>
            <button
              type="button"
              onClick={() => void handleSqlSave()}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-l from-indigo-600 to-indigo-700 px-8 py-3.5 text-sm font-black text-white shadow-lg shadow-indigo-600/20 transition hover:from-indigo-500 hover:to-indigo-600 active:scale-[0.99] disabled:opacity-50"
              disabled={sqlBusy}
            >
              {sqlBusy ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              حفظ الإعدادات
            </button>
          </div>
        </div>
      </AppModal>
    </div>
  );
};
