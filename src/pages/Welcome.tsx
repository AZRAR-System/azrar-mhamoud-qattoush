import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Logo } from '@/components/ui/Logo';
import { useAuth } from '@/context/AuthContext';
import { ROUTE_PATHS } from '@/routes/paths';
import { CheckCircle2, Loader2 } from 'lucide-react';

const steps = [
  { label: 'تحميل الإعدادات', duration: 800 },
  { label: 'الاتصال بالخادم', duration: 1200 },
  { label: 'مزامنة البيانات', duration: 1500 },
  { label: 'تهيئة الواجهة', duration: 800 },
];

export const Welcome: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [currentStepIndex, setCurrentStepIndex] = useState(-1);
  const [progress, setProgress] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  const userName = user?.اسم_للعرض || user?.اسم_المستخدم || 'مستخدم أزرار';

  useEffect(() => {
    let totalElapsed = 0;
    const totalDuration = steps.reduce((acc, step) => acc + step.duration, 0);

    const startExecution = async () => {
      // Small delay before starting
      await new Promise(resolve => setTimeout(resolve, 500));
      
      for (let i = 0; i < steps.length; i++) {
        setCurrentStepIndex(i);
        const step = steps[i];
        
        // Simulate progress within the step
        const startProgress = (totalElapsed / totalDuration) * 100;
        const endProgress = ((totalElapsed + step.duration) / totalDuration) * 100;
        
        const startTime = Date.now();
        while (Date.now() - startTime < step.duration) {
          const elapsed = Date.now() - startTime;
          const currentProgress = startProgress + (elapsed / step.duration) * (endProgress - startProgress);
          setProgress(Math.min(currentProgress, 99)); // Keep at 99 until last step completes
          await new Promise(resolve => setTimeout(resolve, 16)); // ~60fps
        }
        
        totalElapsed += step.duration;
        setCompletedSteps(prev => [...prev, i]);
      }
      
      setProgress(100);
      setCurrentStepIndex(steps.length); // All done
      
      // Final pause before redirect
      await new Promise(resolve => setTimeout(resolve, 800));
      navigate(ROUTE_PATHS.DASHBOARD, { replace: true });
    };

    startExecution();
  }, [navigate]);

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-slate-900 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white font-tajawal p-6 overflow-hidden">
      {/* Background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
        <div className="absolute -top-1/4 -left-1/4 w-1/2 h-1/2 bg-blue-500 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute -bottom-1/4 -right-1/4 w-1/2 h-1/2 bg-indigo-600 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div className="relative z-10 w-full max-w-md flex flex-col items-center gap-8 animate-in fade-in zoom-in duration-1000">
        {/* Logo Section */}
        <div className="relative group">
          <div className="absolute inset-0 bg-blue-500 rounded-full blur-2xl opacity-20 group-hover:opacity-40 transition-opacity" />
          <Logo size={160} className="relative z-10 drop-shadow-2xl hover:scale-105 transition-transform duration-500 ease-out" />
        </div>

        {/* Welcome Message */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-black tracking-tight animate-in slide-in-from-bottom duration-700 delay-300">
            مرحباً، <span className="text-blue-400">{userName}</span> 👋
          </h1>
          <p className="text-slate-400 font-medium animate-in slide-in-from-bottom duration-700 delay-500">
            جاري تهيئة النظام...
          </p>
        </div>

        {/* Progress Bar Container */}
        <div className="w-full space-y-4 animate-in slide-in-from-bottom duration-700 delay-700">
          <div className="flex justify-between items-end mb-1 px-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">تحميل البيانات</span>
            <span className="text-sm font-black text-blue-400">{Math.round(progress)}%</span>
          </div>
          
          <div className="h-2.5 w-full bg-slate-800/50 rounded-full overflow-hidden border border-white/5 backdrop-blur-sm">
            <div 
              className="h-full bg-gradient-to-r from-blue-600 to-indigo-500 transition-all duration-300 ease-out shadow-[0_0_15px_rgba(59,130,246,0.5)]"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Steps List */}
          <div className="bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-5 mt-6 space-y-4">
            {steps.map((step, idx) => {
              const isActive = currentStepIndex === idx;
              const isCompleted = completedSteps.includes(idx);
              
              return (
                <div 
                  key={idx}
                  className={`flex items-center justify-between transition-all duration-500 ${
                    isActive || isCompleted ? 'opacity-100 translate-x-0' : 'opacity-20 translate-x-4'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      {isCompleted ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400 animate-in zoom-in duration-300" />
                      ) : isActive ? (
                        <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
                      ) : (
                        <div className="w-5 h-5 rounded-full border-2 border-slate-700" />
                      )}
                    </div>
                    <span className={`text-sm font-bold ${isActive ? 'text-white' : isCompleted ? 'text-slate-300' : 'text-slate-500'}`}>
                      {step.label}
                    </span>
                  </div>
                  
                  {isCompleted && (
                    <span className="text-[10px] font-black bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20">
                      مكتمل
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <p className="text-[11px] text-slate-600 font-bold uppercase tracking-[0.2em] mt-8 animate-in fade-in duration-1000 delay-1000">
          AZRAR Property Management System © 2025
        </p>
      </div>
    </div>
  );
};

export default Welcome;
