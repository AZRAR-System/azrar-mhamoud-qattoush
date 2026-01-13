import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Lock, User, LogIn, AlertCircle, Info } from 'lucide-react';
import { storage } from '@/services/storage';
import { ROUTE_PATHS } from '@/routes/paths';
import { useAppDialogs } from '@/hooks/useAppDialogs';

export const Login = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
  const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
        const [hasAnyUsers, setHasAnyUsers] = useState<boolean | null>(null);
  
  const { login } = useAuth();
      const dialogs = useAppDialogs();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
        setNotice('');

    // Simulate network delay for realism
    setTimeout(async () => {
        const success = await login(username, password);
        setLoading(false);
        if (success) {
            window.location.hash = ROUTE_PATHS.DASHBOARD;
        } else {
            setError('اسم المستخدم أو كلمة المرور غير صحيحة');
        }
    }, 800);
  };

    const getUsers = async (): Promise<any[]> => {
        const raw = await storage.getItem('db_users');
        if (!raw) return [];
        try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    };

    const persistUsers = async (users: any[]) => {
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
                        if (adminUsernameRaw == null) return;

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
                        if (adminPasswordRaw == null) return;

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
        } catch (e: any) {
            setError(e?.message || 'تعذر إنشاء المستخدم admin');
        }
    };

    const handleChangeAdminPassword = async () => {
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
                        if (newPass == null) return;
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
        } catch (e: any) {
            setError(e?.message || 'تعذر تعديل كلمة مرور admin');
        }
    };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-900 transition-colors duration-300 relative overflow-hidden">
      
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute -top-20 -left-20 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl"></div>
      </div>

      <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-2xl w-full max-w-md border border-gray-100 dark:border-slate-700 relative z-10 animate-scale-up">
        
        <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-500/30">
                <span className="text-3xl font-bold text-white">A</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white">نظام AZRAR لإدارة العقارات</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-2">يرجى تسجيل الدخول للمتابعة</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
            
            <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">اسم المستخدم</label>
                <div className="relative">
                    <input 
                        type="text" 
                        required
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-600 rounded-xl py-3 pr-10 pl-4 focus:ring-2 focus:ring-indigo-500 outline-none transition text-slate-800 dark:text-white"
                        placeholder="أدخل اسم المستخدم"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                    />
                    <User className="absolute top-3.5 right-3 text-slate-400" size={18} />
                </div>
            </div>

            <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">كلمة المرور</label>
                <div className="relative">
                    <input 
                        type="password" 
                        required
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-600 rounded-xl py-3 pr-10 pl-4 focus:ring-2 focus:ring-indigo-500 outline-none transition text-slate-800 dark:text-white"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                    <Lock className="absolute top-3.5 right-3 text-slate-400" size={18} />
                </div>
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
                disabled={loading}
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

        </form>

        <div className="mt-8 text-center border-t border-gray-100 dark:border-slate-700 pt-4 text-[10px] text-slate-400 dark:text-slate-500">
            <p dir="ltr">&copy; 2025 — Developed by <span className="font-bold">Mahmoud Qattoush</span></p>
            <p dir="ltr">AZRAR Real Estate Management System — All Rights Reserved</p>
        </div>

      </div>
    </div>
  );
};
