import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Lock, User, LogIn, AlertCircle, Info, Eye, EyeOff } from 'lucide-react';
import { storage } from '@/services/storage';
import { isCodeActivationAllowed } from '@/services/activation';
import { ROUTE_PATHS } from '@/routes/paths';
import { useAppDialogs } from '@/hooks/useAppDialogs';
import { useActivation } from '@/context/ActivationContext';
import { safeJsonParseArray } from '@/utils/json';

type StoredUser = {
    id?: unknown;
    اسم_المستخدم?: unknown;
    كلمة_المرور?: unknown;
    الدور?: unknown;
    isActive?: unknown;
};

const toRecord = (v: unknown): Record<string, unknown> => (typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {});

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

        const [activationCode, setActivationCode] = useState('');
        const [activationError, setActivationError] = useState('');
        const [activationBusy, setActivationBusy] = useState(false);
        const [deviceId, setDeviceId] = useState<string>('');

        const usernameRef = useRef<HTMLInputElement | null>(null);
        const passwordRef = useRef<HTMLInputElement | null>(null);
  
    const { login } = useAuth();
    const { isActivated, loading: activationLoading, activatedAt, activationError: activationStatusError, activate, activateWithLicenseFileContent, refresh } = useActivation();

    const canUseCodeActivation = useMemo(() => {
        return isCodeActivationAllowed();
    }, []);
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

    const handleActivateByCode = async () => {
        if (!canUseCodeActivation) {
            setActivationError('في نسخة الإنتاج: التفعيل يتم عبر ملف تفعيل مُوقّع مرتبط ببصمة الجهاز.');
            return;
        }
        setActivationError('');
        setError('');
        setNotice('');
        const code = activationCode.trim();
        if (code.length < 6) {
            setActivationError('يرجى إدخال رمز تفعيل صحيح.');
            return;
        }

        setActivationBusy(true);
        try {
            await activate(code);
            await refresh();

            // Re-run bootstrap so desktop KV hydration happens after activation.
            window.location.reload();
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            setActivationError(msg || 'تعذر تفعيل النظام.');
        } finally {
            setActivationBusy(false);
        }
    };

    const handlePickLicenseFile = async () => {
        setActivationError('');
        setError('');
        setNotice('');
        setActivationBusy(true);
        try {
            const res = await window.desktopDb?.pickLicenseFile?.();
            const rec = (res && typeof res === 'object') ? (res as Record<string, unknown>) : {};
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
                    const remember = (rememberRaw === null || rememberRaw === undefined) ? true : String(rememberRaw).toLowerCase() !== 'false';
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

    const handleCreateDefaultAdmin = async () => {
        setError('');
        setNotice('');
        try {
            const users = await getUsers();
            if (users.length > 0) {
                setNotice('يوجد مستخدمون بالفعل — لن يتم إنشاء حساب مدير جديد تلقائياً.');
                return;
            }

                        const adminUsernameRaw = await dialogs.prompt({
                            title: 'إنشاء حساب المدير',
                            message: 'أدخل اسم المستخدم لحساب المدير:',
                            inputType: 'text',
                            defaultValue: 'admin',
                            placeholder: 'اسم المستخدم',
                            required: true,
                        });
                        if (adminUsernameRaw === null || adminUsernameRaw === undefined) return;

                        const adminUsername = adminUsernameRaw.trim();
                        if (!adminUsername) {
                setError('اسم المستخدم مطلوب لإنشاء حساب المدير.');
                return;
            }

                        const adminPasswordRaw = await dialogs.prompt({
                            title: 'إنشاء حساب المدير',
                            message: 'أدخل كلمة المرور لحساب المدير (لا تقل عن 6 أحرف):',
                            inputType: 'password',
                            placeholder: 'كلمة المرور',
                            required: true,
                        });
                        if (adminPasswordRaw === null || adminPasswordRaw === undefined) return;

                        const adminPassword = adminPasswordRaw.trim();
                        if (!adminPassword) {
                setError('كلمة المرور مطلوبة لإنشاء حساب المدير.');
                return;
            }
            if (adminPassword.length < 6) {
                setError('كلمة المرور قصيرة جداً (الحد الأدنى 6 أحرف).');
                return;
            }

            const adminUser = {
                id: '1',
                اسم_المستخدم: adminUsername,
                كلمة_المرور: adminPassword,
                الدور: 'SuperAdmin',
                isActive: true,
            };

            await persistUsers([adminUser]);
            setHasAnyUsers(true);
            setUsername(adminUsername);
            setPassword('');
            setNotice('تم إنشاء حساب السوبر أدمن بنجاح. يمكنك تسجيل الدخول الآن.');
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(toRecord(e).message || '').trim();
            setError(msg || 'تعذر إنشاء المستخدم admin');
        }
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

            const idx = users.findIndex(u => u?.اسم_المستخدم === 'admin');
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

            users[idx] = { ...users[idx], كلمة_المرور: trimmed, isActive: true, الدور: users[idx].الدور || 'SuperAdmin' };
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
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white">نظام AZRAR لإدارة العقارات</h1>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mt-2">يرجى تفعيل النظام ثم تسجيل الدخول للمتابعة</p>
        </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">

                    {/* Activation panel */}
                    <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white/70 dark:bg-slate-900/40 p-5 md:p-6">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <div className="text-sm font-bold text-slate-800 dark:text-white">التفعيل</div>
                                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">تفعيل البرنامج قبل استخدامه</div>
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
                                <div className="text-[11px] font-bold text-slate-600 dark:text-slate-300">بصمة الجهاز</div>
                                <div className="mt-1 text-[11px] text-slate-700 dark:text-slate-200 break-all" dir="ltr">
                                    {deviceId || 'غير متاح'}
                                </div>
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="text-xs font-bold text-slate-700 dark:text-slate-200">الحالة:</div>
                                <div className={"text-xs font-bold " + (isActivated ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300')}>
                                    {activationLoading ? '...' : (isActivated ? 'مُفعّل' : 'غير مُفعّل')}
                                </div>
                            </div>

                            {isActivated && activatedAt && (
                                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                    آخر تفعيل: {new Date(activatedAt).toLocaleString()}
                                </div>
                            )}

                            {!isActivated && (
                                <>
                                    {canUseCodeActivation && (
                                        <div>
                                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">رمز التفعيل</label>
                                            <input
                                                type="text"
                                                className="w-full bg-slate-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-600 rounded-xl py-3 px-4 focus:ring-2 focus:ring-indigo-500 outline-none transition text-slate-800 dark:text-white"
                                                placeholder="أدخل رمز التفعيل"
                                                value={activationCode}
                                                onChange={(e) => {
                                                    setActivationCode(e.target.value);
                                                    if (activationError) setActivationError('');
                                                }}
                                            />
                                        </div>
                                    )}

                                    {(activationError || activationStatusError) && (
                                        <div className="text-xs text-rose-600 dark:text-rose-300 font-semibold">{activationError || activationStatusError}</div>
                                    )}

                                    <div className="flex gap-3">
                                        {canUseCodeActivation && (
                                            <button
                                                type="button"
                                                onClick={() => void handleActivateByCode()}
                                                disabled={activationBusy || activationLoading || activationCode.trim().length < 6}
                                                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-bold transition shadow-lg shadow-indigo-600/30 disabled:opacity-70 disabled:cursor-not-allowed"
                                            >
                                                {activationBusy ? 'جاري التفعيل...' : 'تفعيل'}
                                            </button>
                                        )}

                                        <button
                                            type="button"
                                            onClick={() => void handlePickLicenseFile()}
                                            disabled={activationBusy || activationLoading || !window.desktopDb?.pickLicenseFile}
                                            className="flex-1 text-xs font-bold py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition disabled:opacity-70 disabled:cursor-not-allowed"
                                        >
                                            تحميل ملف التفعيل
                                        </button>
                                    </div>

                                    <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                                        {canUseCodeActivation
                                            ? 'إن كان لديك ملف/رمز تفعيل من الدعم، استخدمه هنا.'
                                            : 'في نسخة الإنتاج: التفعيل يتم عبر ملف تفعيل مُوقّع مرتبط ببصمة الجهاز.'}
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
                        <form onSubmit={handleSubmit} className="space-y-6" noValidate>
            
            <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">اسم المستخدم</label>
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
                                    <div className="mt-2 text-xs text-rose-600 dark:text-rose-300 font-semibold">{usernameError}</div>
                                )}
            </div>

            <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">كلمة المرور</label>
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
                    <Lock className="absolute top-1/2 -translate-y-1/2 right-3 text-slate-400 pointer-events-none" size={18} />
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
                                    <div className="mt-2 text-xs text-rose-600 dark:text-rose-300 font-semibold">{passwordError}</div>
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
                                onClick={() => {
                                    setNotice('إذا نسيت كلمة المرور، راجع مسؤول النظام. إذا كانت هذه أول مرة، أنشئ حساب السوبر أدمن من الأسفل.');
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

                    </div>
                </div>

        <div className="mt-8 text-center border-t border-gray-100 dark:border-slate-700 pt-4 text-[10px] text-slate-400 dark:text-slate-500">
            <p dir="ltr">&copy; 2025 — Developed by <span className="font-bold">Mahmoud Qattoush</span></p>
            <p dir="ltr">AZRAR Real Estate Management System — All Rights Reserved</p>
        </div>

      </div>
    </div>
  );
};
