import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { ROUTE_PATHS } from '@/routes/paths';
import { CheckCircle2, LogIn, LogOut } from 'lucide-react';

export const Logout = () => {
  const { isAuthenticated, logout } = useAuth();
  const [didRun, setDidRun] = useState(false);

  const subtitle = useMemo(() => {
    if (isAuthenticated) return 'جاري إنهاء الجلسة بأمان...';
    return 'تم تسجيل الخروج بنجاح.';
  }, [isAuthenticated]);

  useEffect(() => {
    if (didRun) return;
    setDidRun(true);

    // If there is an active session, clear it.
    if (isAuthenticated) logout();

    // Navigate to login after a short, polished confirmation.
    const t = setTimeout(() => {
      window.location.hash = ROUTE_PATHS.LOGIN;
    }, 900);

    return () => clearTimeout(t);
  }, [didRun, isAuthenticated, logout]);

  return (
    <div className="min-h-screen w-full relative flex items-center justify-center overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">

      {/* دوائر نابضة في الخلفية */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1000ms' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-indigo-500/10 rounded-full blur-2xl animate-pulse" style={{ animationDelay: '500ms' }} />
        <div className="absolute top-10 right-10 w-48 h-48 bg-violet-500/10 rounded-full blur-2xl animate-ping" style={{ animationDuration: '3s' }} />
        <div className="absolute bottom-10 left-10 w-56 h-56 bg-cyan-500/10 rounded-full blur-2xl animate-ping" style={{ animationDuration: '4s' }} />
      </div>

      <div className="app-card p-8 rounded-3xl shadow-2xl w-full max-w-md border-gray-100 dark:border-slate-700 relative z-10 animate-scale-up">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-500/30">
            <CheckCircle2 size={30} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">تسجيل الخروج</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-2">{subtitle}</p>
        </div>

        <div className="mt-6 p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-700">
          <div className="flex items-center justify-center gap-2 text-slate-600 dark:text-slate-300 text-sm font-bold">
            <LogOut size={16} className="text-slate-400" />
            <span>سيتم تحويلك لصفحة تسجيل الدخول تلقائيًا</span>
          </div>
        </div>

        <div className="mt-6 flex gap-2">
          <a
            href="#/login"
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-bold transition shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2"
          >
            الذهاب لتسجيل الدخول <LogIn size={18} />
          </a>
        </div>

        <div className="mt-8 text-center border-t border-gray-100 dark:border-slate-700 pt-4 text-[10px] text-slate-400 dark:text-slate-500">
          <p dir="ltr">
            &copy; 2025 — Developed by <span className="font-bold">Mahmoud Qattoush</span>
          </p>
          <p dir="ltr">AZRAR Real Estate Management System — All Rights Reserved</p>
        </div>
      </div>
    </div>
  );
};
