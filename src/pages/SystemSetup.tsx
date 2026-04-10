import React, { useState, useEffect, useRef } from 'react';
import { 
  Server, 
  ShieldCheck, 
  ShieldAlert, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  Terminal, 
  ChevronRight,
  Database,
  Globe,
  ArrowLeft
} from 'lucide-react';
import { ROUTE_PATHS } from '@/routes/paths';

type Step = 'welcome' | 'requirements' | 'install' | 'success';

export const SystemSetup: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<Step>('welcome');
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [isInstalling, setIsInstalling] = useState(false);
  const [installResult, setInstallResult] = useState<{ ok: boolean; message: string } | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Check Admin on mount of requirements step
  useEffect(() => {
    if (currentStep === 'requirements') {
      void (async () => {
        try {
          const res = await window.desktopDb.checkAdminStatus();
          setIsAdmin(res.isAdmin);
        } catch (err) {
          console.error('Failed to check admin status:', err);
          setIsAdmin(false);
        }
      })();
    }
  }, [currentStep]);

  // Listen for logs
  useEffect(() => {
    const removeListener = window.desktopDb.onSqlSetupLog((line) => {
      setLogs((prev) => [...prev, line]);
    });
    return () => removeListener();
  }, []);

  const handleStartInstallation = async () => {
    setIsInstalling(true);
    setLogs([]);
    try {
      const res = await window.desktopDb.startInstallation();
      setInstallResult(res);
      if (res.ok) {
        setCurrentStep('success');
      }
    } catch (err) {
      setInstallResult({ ok: false, message: String(err) });
    } finally {
      setIsInstalling(false);
    }
  };

  const renderContent = () => {
    switch (currentStep) {
      case 'welcome':
        return (
          <div className="flex flex-col items-center animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="w-24 h-24 bg-indigo-100 rounded-3xl flex items-center justify-center mb-6 shadow-sm">
              <Server size={48} className="text-indigo-600" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900 mb-4 text-center">مرحباً بك في أزرار</h1>
            <p className="text-lg text-slate-600 text-center mb-8 max-w-md leading-relaxed">
              سنقوم الآن بتهيئة بيئة النظام وتثبيت محرك قواعد البيانات (SQL Server Express) لضمان عمل التطبيق بكفاءة عالية على جهازك.
            </p>
            <button
              onClick={() => setCurrentStep('requirements')}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-2xl font-semibold transition-all shadow-lg hover:shadow-indigo-200 active:scale-95"
            >
              ابدأ الإعداد
              <ChevronRight size={20} />
            </button>
          </div>
        );

      case 'requirements':
        return (
          <div className="flex flex-col items-center animate-in fade-in slide-in-from-left-4 duration-500">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-slate-900 mb-2">فحص المتطلبات</h2>
              <p className="text-slate-500">نتأكد من جاهزية جهازك لعملية التثبيت.</p>
            </div>

            <div className="w-full max-w-md bg-white border border-slate-100 rounded-3xl p-6 mb-8 shadow-sm">
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-50">
                <div className="flex items-center gap-3">
                  <ShieldCheck className={isAdmin === true ? "text-emerald-500" : "text-slate-300"} size={24} />
                  <span className="font-medium text-slate-700">صلاحيات المسؤول (Admin)</span>
                </div>
                {isAdmin === null ? (
                  <Loader2 className="animate-spin text-indigo-500" size={20} />
                ) : isAdmin ? (
                  <span className="text-xs font-bold bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full text-rtl">متوفر</span>
                ) : (
                  <span className="text-xs font-bold bg-amber-50 text-amber-600 px-3 py-1 rounded-full text-rtl">غير متوفر</span>
                )}
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Database className="text-slate-300" size={24} />
                  <span className="font-medium text-slate-700">مساحة القرص (2GB)</span>
                </div>
                <span className="text-xs font-bold bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full">جاهز</span>
              </div>
            </div>

            {!isAdmin && isAdmin !== null && (
              <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex items-start gap-3 mb-8 max-w-md">
                <ShieldAlert className="text-amber-600 shrink-0" size={20} />
                <p className="text-sm text-amber-800 leading-relaxed">
                  يجب تشغيل التطبيق كمسؤول (Run as Administrator) لتتمكن من تثبيت SQL Server وفتح منافذ الجدار الناري.
                </p>
              </div>
            )}

            <div className="flex gap-4">
              <button
                onClick={() => setCurrentStep('welcome')}
                className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-6 py-3 rounded-2xl font-semibold transition-all"
              >
                تراجع
              </button>
              <button
                disabled={!isAdmin}
                onClick={() => setCurrentStep('install')}
                className={`flex items-center gap-2 px-8 py-3 rounded-2xl font-semibold transition-all shadow-lg ${
                  isAdmin 
                    ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-100" 
                    : "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
                }`}
              >
                المتابعة للتثبيت
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        );

      case 'install':
        return (
          <div className="flex flex-col h-full animate-in fade-in zoom-in-95 duration-500">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-slate-900 mb-2">جاري تهيئة النظام</h2>
              <p className="text-slate-500">يتم الآن تحميل محرك قاعدة البيانات وضبط إعدادات الشبكة.</p>
            </div>

            <div className="relative flex-1 bg-slate-900 rounded-3xl p-6 font-mono text-sm overflow-hidden flex flex-col shadow-2xl min-h-[300px]">
              <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Terminal size={18} className="text-indigo-400" />
                  <span className="text-slate-400 text-xs font-bold tracking-widest uppercase">system_setup_logs</span>
                </div>
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-700" />
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-700" />
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-700" />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto space-y-1.5 custom-scrollbar pr-2">
                {logs.length === 0 && !isInstalling && (
                  <p className="text-slate-500 italic">اضغط على الزر أدناه للبدء...</p>
                )}
                {logs.map((log, i) => (
                  <div key={i} className="flex gap-3 text-rtl">
                    <span className="text-slate-600 shrink-0 text-[10px] mt-1">[{i + 1}]</span>
                    <span className={log.startsWith('[ERROR]') ? 'text-rose-400' : log.startsWith('[SYSTEM]') ? 'text-indigo-400' : 'text-slate-300'}>
                      {log}
                    </span>
                  </div>
                ))}
                <div ref={logEndRef} />
              </div>

              {isInstalling && (
                <div className="absolute bottom-6 right-6 flex items-center gap-3 bg-slate-800 px-4 py-2 rounded-xl border border-slate-700 animate-pulse">
                  <Loader2 className="animate-spin text-indigo-400" size={16} />
                  <span className="text-slate-300 text-xs font-medium">جاري العمل...</span>
                </div>
              )}
            </div>

            <div className="mt-8 flex justify-center gap-4">
              {!isInstalling && !installResult && (
                <button
                  onClick={handleStartInstallation}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-10 py-4 rounded-2xl font-bold transition-all shadow-xl shadow-indigo-100 flex items-center gap-3 active:scale-95"
                >
                  <Globe size={20} />
                  بدء التثبيت الآن
                </button>
              )}
              {installResult && !installResult.ok && (
                <button
                  onClick={handleStartInstallation}
                  className="bg-rose-600 hover:bg-rose-700 text-white px-8 py-3 rounded-2xl font-semibold transition-all shadow-lg flex items-center gap-2"
                >
                  إعادة المحاولة
                </button>
              )}
            </div>
          </div>
        );

      case 'success':
        return (
          <div className="flex flex-col items-center animate-in fade-in zoom-in-95 duration-700">
            <div className="w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center mb-8 relative">
              <div className="absolute inset-0 bg-emerald-100 rounded-full animate-ping opacity-25" />
              <CheckCircle2 size={64} className="text-emerald-500 relative z-10" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900 mb-4 text-center">اكتمل الإعداد بنجاح!</h1>
            <p className="text-lg text-slate-600 text-center mb-10 max-w-sm leading-relaxed">
              تم تثبيت محرك قاعدة البيانات بنجاح وضبط كافة الإعدادات الحيوية. نظام أزرار جاهز الآن للخدمة.
            </p>
            <button
              onClick={() => window.location.hash = ROUTE_PATHS.LOGIN}
              className="bg-slate-900 hover:bg-slate-800 text-white px-12 py-4 rounded-2xl font-bold transition-all shadow-xl hover:-translate-y-1 active:scale-95 flex items-center gap-3"
            >
              الانتقال لتسجيل الدخول
              <ChevronRight size={20} />
            </button>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-tajawal rtl" dir="rtl">
      {/* Background Decorative Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-50/50 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-50/50 rounded-full blur-[100px]" />
      </div>

      <div className="w-full max-w-2xl bg-white/80 backdrop-blur-xl border border-white rounded-[40px] p-8 md:p-12 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.08)] relative z-10 flex flex-col min-h-[600px]">
        {/* Progress Bar */}
        <div className="flex items-center gap-2 mb-12">
          {(['welcome', 'requirements', 'install', 'success'] as Step[]).map((step, i) => {
            const steps: Step[] = ['welcome', 'requirements', 'install', 'success'];
            const stepIndex = steps.indexOf(currentStep);
            const active = steps.indexOf(step) <= stepIndex;
            return (
              <React.Fragment key={step}>
                <div 
                  className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${
                    active ? 'bg-indigo-600' : 'bg-slate-100'
                  }`} 
                />
                {i < 3 && <div className="w-1 h-1 rounded-full bg-slate-200" />}
              </React.Fragment>
            );
          })}
        </div>

        <div className="flex-1 flex flex-col items-center justify-center">
          {renderContent()}
        </div>

        {/* Footer Brand */}
        <div className="mt-12 pt-8 border-t border-slate-50 flex items-center justify-between text-slate-400">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} />
            <span className="text-[10px] font-bold tracking-widest uppercase">AZRAR SECURE SETUP</span>
          </div>
          <span className="text-[10px] font-medium">v3.2.0</span>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap');
        .font-tajawal { font-family: 'Tajawal', sans-serif; }
        .text-rtl { direction: ltr; text-align: right; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 20px; }
      `}</style>
    </div>
  );
};
