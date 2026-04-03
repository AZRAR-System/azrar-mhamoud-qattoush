import { useCallback, useState, type FC } from 'react';
import { Lock, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { ROUTE_PATHS } from '@/routes/paths';

/** شاشة قفل فوق الواجهة دون إغلاق التطبيق — إدخال كلمة مرور المستخدم الحالي */
export const SessionLockOverlay: FC = () => {
  const { user, isAuthenticated, sessionLocked, unlockSession, logout } = useAuth();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleUnlock = useCallback(async () => {
    if (!password.trim()) {
      setError('أدخل كلمة المرور');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const ok = await unlockSession(password);
      if (ok) {
        setPassword('');
      } else {
        setError('كلمة المرور غير صحيحة');
      }
    } catch {
      setError('تعذر التحقق. حاول مرة أخرى.');
    } finally {
      setBusy(false);
    }
  }, [password, unlockSession]);

  if (!isAuthenticated || !sessionLocked || !user) return null;

  return (
    <div
      className="fixed inset-0 z-[10050] flex items-center justify-center bg-slate-950/80 backdrop-blur-md px-4"
      dir="rtl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-lock-title"
    >
      <div className="w-full max-w-md rounded-3xl border border-slate-700/80 bg-slate-900 p-8 shadow-2xl">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600/20 text-indigo-400">
            <Lock size={32} />
          </div>
          <h2 id="session-lock-title" className="text-xl font-bold text-white">
            الجلسة مقفلة
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            تم القفل تلقائياً بعد فترة خمول. أدخل كلمة مرورك للمتابعة.
          </p>
          <p className="mt-1 text-xs font-mono text-indigo-300/90" dir="ltr">
            {String(user.اسم_المستخدم || '')}
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="session-lock-password" className="mb-1 block text-xs font-bold text-slate-400">
              كلمة المرور
            </label>
            <input
              id="session-lock-password"
              type="password"
              autoComplete="current-password"
              className="w-full rounded-xl border border-slate-600 bg-slate-800 px-4 py-3 text-white outline-none ring-indigo-500/40 focus:ring-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleUnlock();
              }}
              disabled={busy}
            />
            {error ? <p className="mt-2 text-xs text-red-400">{error}</p> : null}
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={() => void handleUnlock()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 font-bold text-white transition hover:bg-indigo-500 disabled:opacity-60"
          >
            {busy ? <Loader2 className="animate-spin" size={20} /> : null}
            فتح القفل
          </button>

          <button
            type="button"
            className="w-full py-2 text-center text-xs text-slate-500 underline hover:text-slate-300"
            onClick={() => {
              logout();
              window.location.hash = ROUTE_PATHS.LOGIN;
            }}
          >
            تسجيل الخروج بدلاً من ذلك
          </button>
        </div>
      </div>
    </div>
  );
};
