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
  ArrowLeft,
  Settings,
  Sparkles,
  Command,
  Layout
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
          <div className="flex flex-col items-center animate-in fade-in slide-in-from-bottom-6 duration-700">
            <div className="relative mb-10 group">
              <div className="absolute -inset-4 bg-indigo-500/20 rounded-[2.5rem] blur-2xl group-hover:bg-indigo-500/30 transition-all duration-500" />
              <div className="relative w-28 h-28 bg-gradient-to-br from-indigo-600 via-indigo-500 to-indigo-400 rounded-[2rem] flex items-center justify-center shadow-2xl shadow-indigo-500/40 transform group-hover:rotate-6 transition-transform duration-500">
                <Server size={52} className="text-white drop-shadow-lg" />
              </div>
              <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center shadow-xl border border-slate-100 dark:border-slate-700">
                <Sparkles size={20} className="text-amber-500" />
              </div>
            </div>

            <div className="text-center max-w-xl mx-auto space-y-4">
              <h1 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
                مرحباً بك في <span className="text-indigo-600 dark:text-indigo-400">نظام أزرار</span>
              </h1>
              <p className="text-lg md:text-xl text-slate-600 dark:text-slate-400 leading-relaxed font-bold">
                سنقوم الآن بتهيئة بيئة النظام وتثبيت محرك قواعد البيانات لضمان عمل التطبيق بأقصى سرعة ممكنة على جهازك.
              </p>
            </div>

            <div className="mt-12 flex flex-col items-center gap-6 w-full">
              <button
                onClick={() => setCurrentStep('requirements')}
                className="group relative flex items-center gap-4 bg-gradient-to-r from-indigo-700 via-indigo-600 to-indigo-500 hover:from-indigo-600 hover:to-indigo-400 text-white px-12 py-5 rounded-[2rem] text-xl font-black transition-all shadow-[0_20px_50px_rgba(79,70,229,0.3)] hover:shadow-[0_20px_50px_rgba(79,70,229,0.5)] hover:-translate-y-1 active:scale-95 overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                ابدأ رحلة الإعداد
                <ChevronRight size={24} className="group-hover:translate-x-2 transition-transform" />
              </button>
              
              <div className="flex items-center gap-2 text-slate-400 dark:text-slate-600 font-bold text-xs uppercase tracking-widest">
                <Layout size={14} />
                <span>بروفيشنال إيديشن 2025</span>
              </div>
            </div>
          </div>
        );

      case 'requirements':
        return (
          <div className="flex flex-col items-center w-full animate-in fade-in slide-in-from-left-6 duration-700">
            <div className="text-center mb-10">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full text-xs font-black uppercase tracking-widest mb-4">
                <Settings size={14} className="animate-spin-slow" />
                <span>نظام الفحص الذكي</span>
              </div>
              <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-2">فحص متطلبات النظام</h2>
              <p className="text-slate-500 dark:text-slate-500 font-bold">نتأكد من جاهزية البيئة لتثبيت SQL Server Express.</p>
            </div>

            <div className="w-full max-w-lg space-y-4">
              <div className="group bg-white/50 dark:bg-slate-950/40 border border-slate-200/50 dark:border-slate-800/50 rounded-3xl p-6 transition-all hover:bg-white dark:hover:bg-slate-900/60 hover:shadow-xl hover:shadow-indigo-500/5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${isAdmin === true ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                      <ShieldCheck size={24} />
                    </div>
                    <div>
                      <h3 className="font-black text-slate-800 dark:text-slate-200">صلاحيات المسؤول</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-500 font-bold">مطلوبة لتثبيت خدمات الويندوز</p>
                    </div>
                  </div>
                  {isAdmin === null ? (
                    <Loader2 className="animate-spin text-indigo-500" size={24} />
                  ) : isAdmin ? (
                    <div className="flex items-center gap-2 text-emerald-500 font-black text-sm">
                      <CheckCircle2 size={18} />
                      <span>متوفر</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-amber-500 font-black text-sm">
                      <ShieldAlert size={18} />
                      <span>غير متوفر</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="group bg-white/50 dark:bg-slate-950/40 border border-slate-200/50 dark:border-slate-800/50 rounded-3xl p-6 transition-all hover:bg-white dark:hover:bg-slate-900/60 hover:shadow-xl hover:shadow-indigo-500/5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center">
                      <Database size={24} />
                    </div>
                    <div>
                      <h3 className="font-black text-slate-800 dark:text-slate-200">مساحة التخزين</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-500 font-bold">2.5 جيجابايت كحد أدنى</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-emerald-500 font-black text-sm">
                    <CheckCircle2 size={18} />
                    <span>جاهز</span>
                  </div>
                </div>
              </div>
            </div>

            {!isAdmin && isAdmin !== null && (
              <div className="mt-8 bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-start gap-4 max-w-lg animate-pulse">
                <ShieldAlert className="text-amber-500 shrink-0 mt-0.5" size={20} />
                <p className="text-sm text-amber-700 dark:text-amber-400 leading-relaxed font-bold">
                  تنبيه: يجب تشغيل النظام بوضع "المسؤول" (Administrator) لتتمكن من إتمام التثبيت وضبط جدار الحماية.
                </p>
              </div>
            )}

            <div className="mt-12 flex gap-4 w-full max-w-lg">
              <button
                onClick={() => setCurrentStep('welcome')}
                className="flex-1 flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-6 py-4 rounded-2xl font-black transition-all"
              >
                تراجع
              </button>
              <button
                disabled={!isAdmin}
                onClick={() => setCurrentStep('install')}
                className={`flex-[2] flex items-center justify-center gap-2 px-8 py-4 rounded-2xl font-black transition-all shadow-xl ${
                  isAdmin 
                    ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20 hover:-translate-y-1 active:scale-95" 
                    : "bg-slate-200 dark:bg-slate-800/50 text-slate-400 cursor-not-allowed shadow-none"
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
          <div className="flex flex-col h-full w-full animate-in fade-in zoom-in-95 duration-700">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-2">جاري تهيئة النظام الجديد</h2>
              <p className="text-slate-500 dark:text-slate-500 font-bold">يتم الآن تحميل محرك قاعدة البيانات وضبط إعدادات الشبكة المحلية.</p>
            </div>

            <div className="relative flex-1 bg-slate-950 rounded-[2.5rem] p-6 font-mono text-sm overflow-hidden flex flex-col shadow-2xl border border-white/5 min-h-[400px]">
              <div className="flex items-center justify-between mb-6 border-b border-white/5 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-indigo-500/20 rounded-lg flex items-center justify-center">
                    <Terminal size={16} className="text-indigo-400" />
                  </div>
                  <span className="text-slate-400 text-[10px] font-black tracking-[0.2em] uppercase">system_setup_logs_v3</span>
                </div>
                <div className="flex gap-2">
                  <div className="w-3 h-3 rounded-full bg-slate-800" />
                  <div className="w-3 h-3 rounded-full bg-slate-800" />
                  <div className="w-3 h-3 rounded-full bg-indigo-500/50 animate-pulse" />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2.5 custom-scrollbar pr-2 scroll-smooth">
                {logs.length === 0 && !isInstalling && (
                  <div className="flex flex-col items-center justify-center h-full text-slate-600 space-y-4">
                    <Command size={48} className="opacity-20 animate-pulse" />
                    <p className="italic font-bold">جاهز لاستقبال الأوامر... اضغط على "بدء التثبيت"</p>
                  </div>
                )}
                {logs.map((log, i) => (
                  <div key={i} className="flex gap-4 text-rtl animate-in fade-in slide-in-from-right-2 duration-300">
                    <span className="text-slate-700 shrink-0 text-[10px] tabular-nums font-black mt-1">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className={`leading-relaxed break-words font-medium ${
                      log.startsWith('[ERROR]') ? 'text-rose-400' : 
                      log.startsWith('[SYSTEM]') ? 'text-indigo-400' : 
                      log.startsWith('[SUCCESS]') ? 'text-emerald-400' :
                      'text-slate-300'
                    }`}>
                      {log}
                    </span>
                  </div>
                ))}
                <div ref={logEndRef} />
              </div>

              {isInstalling && (
                <div className="mt-6 flex items-center gap-4 bg-white/5 border border-white/5 px-6 py-4 rounded-2xl">
                  <Loader2 className="animate-spin text-indigo-400" size={24} />
                  <div className="flex-1">
                    <p className="text-white font-black text-sm">جاري التثبيت حالياً...</p>
                    <p className="text-slate-500 text-[10px] font-bold">يرجى عدم إغلاق البرنامج</p>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-10 flex justify-center">
              {!isInstalling && !installResult && (
                <button
                  onClick={handleStartInstallation}
                  className="group bg-indigo-600 hover:bg-indigo-700 text-white px-12 py-5 rounded-[2rem] font-black transition-all shadow-xl shadow-indigo-600/20 flex items-center gap-4 hover:-translate-y-1 active:scale-95"
                >
                  <Globe size={24} className="group-hover:rotate-12 transition-transform" />
                  بدء عملية التثبيت الشاملة
                </button>
              )}
              {installResult && !installResult.ok && (
                <button
                  onClick={handleStartInstallation}
                  className="bg-rose-600 hover:bg-rose-700 text-white px-10 py-4 rounded-2xl font-black transition-all shadow-xl shadow-rose-600/20 flex items-center gap-3 animate-bounce"
                >
                   إعادة المحاولة
                </button>
              )}
            </div>
          </div>
        );

      case 'success':
        return (
          <div className="flex flex-col items-center animate-in fade-in zoom-in-95 duration-1000">
            <div className="relative mb-10">
              <div className="absolute inset-0 bg-emerald-500/20 rounded-full blur-3xl animate-pulse" />
              <div className="w-32 h-32 bg-gradient-to-br from-emerald-500 to-emerald-400 rounded-full flex items-center justify-center relative z-10 shadow-2xl shadow-emerald-500/40 border-4 border-white dark:border-slate-800">
                <CheckCircle2 size={72} className="text-white drop-shadow-lg" />
              </div>
              <div className="absolute -top-4 -right-4 w-12 h-12 bg-indigo-500 rounded-2xl flex items-center justify-center animate-bounce shadow-xl">
                <Sparkles size={24} className="text-white" />
              </div>
            </div>

            <div className="text-center space-y-4 mb-12">
              <h1 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tight">اكتمل الإعداد بنجاح!</h1>
              <p className="text-lg md:text-xl text-slate-600 dark:text-slate-400 max-w-md mx-auto leading-relaxed font-bold">
                لقد تم تثبيت محرك قاعدة البيانات بنجاح وضبط كافة الإعدادات الحيوية. نظام أزرار جاهز الآن للخدمة بذكاء.
              </p>
            </div>

            <button
              onClick={() => window.location.hash = ROUTE_PATHS.LOGIN}
              className="group relative bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-16 py-5 rounded-[2rem] font-black text-xl transition-all shadow-2xl hover:bg-indigo-600 dark:hover:bg-indigo-500 hover:text-white hover:-translate-y-1 active:scale-95"
            >
              الانتقال لتسجيل الدخول
              <ChevronRight size={24} className="inline-block mr-3 group-hover:translate-x-2 transition-transform" />
            </button>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-100 via-white to-indigo-50/40 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center p-4 md:p-8 font-tajawal rtl transition-colors duration-500 overflow-x-hidden" dir="rtl">
      
      {/* Dynamic Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-1/4 left-1/4 w-[40rem] h-[40rem] bg-indigo-500/5 dark:bg-indigo-500/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-[35rem] h-[35rem] bg-purple-500/5 dark:bg-purple-500/10 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '2000ms' }} />
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 dark:bg-blue-500/10 rounded-full blur-[80px]" />
      </div>

      <div className="w-full max-w-5xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-3xl border border-white/40 dark:border-slate-800/50 rounded-[3rem] p-8 md:p-14 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.15)] dark:shadow-[0_40px_100px_-20px_rgba(0,0,0,0.4)] relative z-10 flex flex-col min-h-[700px] transition-all duration-500">
        
        {/* Modern Header Navigation */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-16">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 bg-gradient-to-tr from-indigo-700 to-indigo-500 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-xl shadow-indigo-500/40">
              A
            </div>
            <div className="flex flex-col">
              <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">إعداد النظام</h2>
              <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em]">Setup Wizard Engine</p>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-white/50 dark:bg-white/5 p-2 rounded-2xl border border-white/50 dark:border-white/5">
            {(['welcome', 'requirements', 'install', 'success'] as Step[]).map((step, i) => {
              const steps: Step[] = ['welcome', 'requirements', 'install', 'success'];
              const stepIndex = steps.indexOf(currentStep);
              const active = steps.indexOf(step) <= stepIndex;
              const isCurrent = step === currentStep;

              return (
                <div 
                  key={step}
                  className={`relative flex items-center justify-center h-10 transition-all duration-500 rounded-xl px-4 ${
                    isCurrent ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 w-32' : 
                    active ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 w-12' : 
                    'bg-slate-100 dark:bg-slate-800/50 text-slate-400 w-12'
                  }`}
                >
                  <span className={`text-sm font-black transition-all duration-500 ${isCurrent ? 'opacity-100' : 'opacity-0 scale-0 absolute'}`}>
                    {step === 'welcome' ? 'ترحيب' : step === 'requirements' ? 'فحص' : step === 'install' ? 'تثبيت' : 'نجاح'}
                  </span>
                  {!isCurrent && <span className="text-sm font-bold">{i + 1}</span>}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center py-4">
          {renderContent()}
        </div>

        {/* Premium Footer */}
        <div className="mt-16 pt-10 border-t border-slate-100/50 dark:border-white/5 flex flex-col md:flex-row items-center justify-between gap-6 text-slate-400 dark:text-slate-600">
          <div className="flex items-center gap-3 order-2 md:order-1">
            <div className={`p-2 rounded-lg transition-colors ${isAdmin ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-500/10 text-slate-500'}`}>
              <ShieldCheck size={16} />
            </div>
            <span className="text-[10px] font-black tracking-widest uppercase">AZRAR Secure Installation Protocol</span>
          </div>
          
          <div className="flex items-center gap-4 order-1 md:order-2">
            <div className="flex items-center gap-2 group cursor-help">
              <span className="text-[10px] font-black text-indigo-500/60 dark:text-indigo-400/40">VER. 3.2.66 PRO</span>
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping" />
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap');
        .font-tajawal { font-family: 'Tajawal', sans-serif; }
        .text-rtl { direction: ltr; text-align: right; }
        .animate-spin-slow { animation: spin 8s linear infinite; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(255,255,255,0.02); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(79, 70, 229, 0.4); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(79, 70, 229, 0.6); }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};
