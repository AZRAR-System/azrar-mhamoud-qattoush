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
  Loader2,
  CheckCircle2,
  ServerCog,
  Sparkles,
  KeyRound,
  LifeBuoy,
} from 'lucide-react';
import { storage } from '@/services/storage';
import { ROUTE_PATHS } from '@/routes/paths';
import { useAppDialogs } from '@/hooks/useAppDialogs';
import { useToast } from '@/context/ToastContext';
import { useActivation } from '@/context/ActivationContext';
import { safeJsonParseArray } from '@/utils/json';
import { AppModal } from '@/components/ui/AppModal';
import { hashPassword } from '@/services/passwordHash';
import { version as packageJsonVersion } from '../../package.json';
import { DesktopDbBridge } from '@/types/electron.types';

import { getEnv } from '@/utils/env';

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

const SEED_ADMIN_USER = getEnv('VITE_SEED_DEFAULT_ADMIN_USERNAME', 'admin').trim();
const SEED_ADMIN_PASS = getEnv('VITE_SEED_DEFAULT_ADMIN_PASSWORD', '');
const LOGIN_PREFILL = getEnv('VITE_LOGIN_PREFILL', '').toLowerCase() === 'true';

export const Login = () => {
  const [username, setUsername] = useState(SEED_ADMIN_USER);
  const [password, setPassword] = useState(() =>
    LOGIN_PREFILL && SEED_ADMIN_PASS.length > 0 ? SEED_ADMIN_PASS : ''
  );
  const [error, setError] = useState('');
  const [_notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasAnyUsers, setHasAnyUsers] = useState<boolean | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [rememberUsername, setRememberUsername] = useState(true);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [_deviceId, setDeviceId] = useState<string>('');

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
    activatedAt: _activatedAt,
    activationError: _activationStatusError,
    activateWithLicenseFileContent: _activateWithLicenseFileContent,
    refresh: _refresh,
  } = useActivation();
  const dialogs = useAppDialogs();
  const toast = useToast();

  const REMEMBER_KEY = 'azrar_login_remember_username';
  const LAST_USERNAME_KEY = 'azrar_login_last_username';

  const trimmedUsername = useMemo(() => username.trim(), [username]);
  const trimmedPassword = useMemo(() => password, [password]);

  const _usernameError = useMemo(() => {
    if (!submitAttempted) return '';
    if (!trimmedUsername) return 'اسم المستخدم مطلوب.';
    return '';
  }, [submitAttempted, trimmedUsername]);

  const _passwordError = useMemo(() => {
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
        window.location.replace(`#${ROUTE_PATHS.WELCOME}`);
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
      const msg = e instanceof Error ? e.message : String((e as { message?: string })?.message || '').trim();
      setError(msg || 'تعذر تعديل كلمة مرور admin');
    }
  };
  return (
    <div className="min-h-screen w-full bg-[#f8fafc] dark:bg-[#020617] flex items-center justify-center p-4 md:p-8 font-tajawal rtl transition-colors duration-700 overflow-hidden relative" dir="rtl">
      {/* Premium Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-500/10 dark:bg-indigo-600/10 rounded-full blur-[120px] animate-pulse-slow" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-500/10 dark:bg-purple-600/10 rounded-full blur-[100px] animate-pulse-slow" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.03)_0%,transparent_70%)]" />
      </div>

      <div className="relative z-10 w-full max-w-5xl flex flex-col items-center gap-8 animate-scale-up">
        {/* Main Glass Card */}
        <div className="w-full rounded-[2.5rem] border border-white/40 bg-white/70 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] backdrop-blur-2xl dark:border-slate-800/50 dark:bg-slate-900/80 dark:shadow-black/60 overflow-hidden flex flex-col lg:flex-row">
          
          {/* Sidebar / Branding Section */}
          <div className="lg:w-[40%] bg-gradient-to-br from-indigo-600 via-indigo-700 to-slate-900 p-8 lg:p-12 text-white flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 w-full h-full opacity-10 pointer-events-none">
              <div className="absolute top-10 right-10 w-64 h-64 border-[40px] border-white rounded-full blur-2xl" />
            </div>

            <div className="relative z-10">
              <div className="mb-8 inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-white/15 backdrop-blur-md shadow-2xl ring-1 ring-white/30">
                <Sparkles size={40} className="text-white drop-shadow-lg" />
              </div>
              <h1 className="text-3xl lg:text-4xl font-black tracking-tight leading-tight">
                نظام أزرار <br/> العقاري المتكامل
              </h1>
              <p className="mt-4 text-indigo-100/80 text-sm font-medium leading-relaxed max-w-xs">
                الحل الأذكى لإدارة العقارات، العقود، والتحصيل المالي بكل سهولة واحترافية.
              </p>
            </div>

            <div className="relative z-10 mt-12 space-y-6">
              <div className="flex items-center gap-4 group">
                <div className="h-12 w-12 flex items-center justify-center rounded-2xl bg-white/10 group-hover:bg-white/20 transition-colors">
                   <KeyRound size={22} />
                </div>
                <div>
                   <div className="text-sm font-bold">حالة النظام</div>
                   <div className={`text-xs ${isActivated ? 'text-emerald-300' : 'text-rose-300'} font-black`}>
                     {activationLoading ? 'جاري التحقق...' : isActivated ? 'النظام مُفعّل وجاهز' : 'بانتظار التفعيل'}
                   </div>
                </div>
              </div>

              {!isActivated && (
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm animate-pulse-gentle">
                  <p className="text-[11px] font-medium leading-relaxed text-indigo-100/70">
                    يرجى تفعيل النظام عبر ملف الترخيص المعتمد للمتابعة.
                  </p>
                </div>
              )}
            </div>

            <div className="relative z-10 mt-auto pt-10 border-t border-white/10">
               <div className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-100/50">Version {packageJsonVersion}</span>
               </div>
            </div>
          </div>

          {/* Form Section */}
          <div className="flex-1 p-8 lg:p-12 bg-white/30 dark:bg-transparent">
            {showRegisterForm ? (
              <form onSubmit={handleRegister} className="space-y-6 animate-tab-slide-in">
                <div className="mb-8">
                  <h2 className="text-2xl font-black text-slate-900 dark:text-white">إنشاء حساب المدير</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">يرجى تعيين بيانات الدخول للمرة الأولى.</p>
                </div>

                <div className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mr-1">اسم المستخدم</label>
                    <div className="relative group">
                      <User size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                      <input
                        type="text"
                        className="w-full bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl py-4 pr-12 pl-4 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all shadow-sm"
                        value={regUsername}
                        onChange={(e) => setRegUsername(e.target.value)}
                        placeholder="admin"
                        disabled={regLoading}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mr-1">كلمة المرور</label>
                      <input
                        type="password"
                        dir="ltr"
                        className="w-full bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl py-4 px-5 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all shadow-sm"
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="••••••••"
                        disabled={regLoading}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mr-1">تأكيد الكلمة</label>
                      <input
                        type="password"
                        dir="ltr"
                        className="w-full bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl py-4 px-5 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all shadow-sm"
                        value={regConfirmPassword}
                        onChange={(e) => setRegConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        disabled={regLoading}
                      />
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs p-4 rounded-2xl flex items-center gap-3 font-bold">
                    <AlertCircle size={18} />
                    {error}
                  </div>
                )}

                <div className="flex gap-4 pt-4">
                  <button
                    type="submit"
                    disabled={regLoading}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-2xl font-black transition-all shadow-xl shadow-indigo-600/20 flex items-center justify-center gap-2 active:scale-[0.98]"
                  >
                    {regLoading ? <Loader2 className="animate-spin" size={20} /> : 'تأكيد الحساب'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowRegisterForm(false)}
                    className="px-8 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 rounded-2xl font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-8 animate-fade-in" noValidate>
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-6">
                  <div>
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white">تسجيل الدخول</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">مرحباً بك مجدداً في نظامك المفضل.</p>
                  </div>
                  <div className="h-14 w-14 flex items-center justify-center rounded-2xl bg-indigo-600/5 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
                    <LogIn size={28} />
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="group space-y-2">
                    <label className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mr-1">اسم المستخدم</label>
                    <div className="relative">
                      <User size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                      <input
                        type="text"
                        required
                        ref={usernameRef}
                        autoComplete="username"
                        className="w-full bg-slate-50/50 dark:bg-slate-800/30 border-2 border-slate-100 dark:border-slate-800 rounded-2xl py-4 pr-12 pl-4 text-sm font-bold outline-none focus:bg-white dark:focus:bg-slate-800 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all"
                        placeholder="admin"
                        value={username}
                        onChange={(e) => {
                          setUsername(e.target.value);
                          if (error) setError('');
                        }}
                      />
                    </div>
                  </div>

                  <div className="group space-y-2">
                    <div className="flex items-center justify-between">
                       <label className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mr-1">كلمة المرور</label>
                       {capsLockOn && <span className="text-[10px] font-black text-amber-600 flex items-center gap-1"><AlertCircle size={10} /> CAPS LOCK نشط</span>}
                    </div>
                    <div className="relative">
                      <Lock size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        ref={passwordRef}
                        autoComplete="current-password"
                        dir="ltr"
                        className="w-full bg-slate-50/50 dark:bg-slate-800/30 border-2 border-slate-100 dark:border-slate-800 rounded-2xl py-4 pr-12 pl-14 text-sm font-bold outline-none focus:bg-white dark:focus:bg-slate-800 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-left"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          if (error) setError('');
                        }}
                        onKeyDown={(e) => setCapsLockOn(!!e.getModifierState?.('CapsLock'))}
                      />
                      <button
                        type="button"
                        className="absolute left-4 top-1/2 -translate-y-1/2 h-8 w-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      className="w-5 h-5 rounded-lg border-2 border-slate-200 text-indigo-600 focus:ring-indigo-500 transition-all"
                      checked={rememberUsername}
                      onChange={(e) => setRememberUsername(e.target.checked)}
                    />
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-400">تذكّرني لاحقاً</span>
                  </label>
                  
                  <button
                    type="button"
                    onClick={() => setShowDbSettings(true)}
                    className="text-xs font-black text-indigo-600 dark:text-indigo-400 hover:underline underline-offset-4"
                  >
                    إعدادات قاعدة البيانات
                  </button>
                </div>

                {error && (
                  <div className="bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs p-4 rounded-2xl flex items-center gap-3 font-bold animate-shake">
                    <AlertCircle size={18} />
                    <span>{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || activationLoading || !isActivated}
                  className="w-full bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white py-4.5 rounded-2xl font-black text-lg transition-all shadow-xl shadow-indigo-600/25 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                >
                  {loading ? (
                    <Loader2 size={24} className="animate-spin" />
                  ) : (
                    <>
                      دخول للنظام <LogIn size={20} />
                    </>
                  )}
                </button>

                {hasAnyUsers === false && (
                   <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 flex flex-col items-center gap-3">
                      <p className="text-[11px] font-bold text-amber-800 dark:text-amber-300 text-center">لا يوجد مستخدمين مسجلين حالياً. يرجى إنشاء حساب المدير.</p>
                      <button
                        type="button"
                        onClick={handleCreateDefaultAdmin}
                        className="w-full py-2.5 bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-900 text-amber-700 dark:text-amber-400 text-xs font-black rounded-xl hover:bg-amber-50 transition-colors"
                      >
                        إعداد حساب السوبر أدمن
                      </button>
                   </div>
                )}
              </form>
            )}
          </div>
        </div>

        {/* Bottom Technical Bar */}
        <div className="flex flex-wrap items-center justify-center gap-8 text-slate-400 dark:text-slate-600">
           <button onClick={() => setShowDbSettings(true)} className="flex items-center gap-2 hover:text-indigo-600 transition-colors group">
              <ServerCog size={16} className="group-hover:rotate-45 transition-transform" />
              <span className="text-[11px] font-bold uppercase tracking-widest">Database Settings</span>
           </button>
           <button onClick={() => window.location.hash = ROUTE_PATHS.ACTIVATION} className="flex items-center gap-2 hover:text-emerald-600 transition-colors group">
              <KeyRound size={16} className="group-hover:scale-110 transition-transform" />
              <span className="text-[11px] font-bold uppercase tracking-widest">Activation Hub</span>
           </button>
           <button className="flex items-center gap-2 hover:text-indigo-600 transition-colors group">
              <LifeBuoy size={16} className="group-hover:rotate-12 transition-transform" />
              <span className="text-[11px] font-bold uppercase tracking-widest">Technical Support</span>
           </button>
        </div>

        <div className="text-center opacity-50">
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
            &copy; {new Date().getFullYear()} AZRAR Real Estate — All Rights Reserved
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
