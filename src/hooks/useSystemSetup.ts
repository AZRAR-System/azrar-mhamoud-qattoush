import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { ROUTE_PATHS } from '@/routes/paths';

export type Step = 'welcome' | 'requirements' | 'install' | 'success';

export function useSystemSetup() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated) { navigate('/login'); return; }
    const role = String(user?.الدور ?? '').trim().toLowerCase();
    if (role !== 'superadmin' && role !== 'admin') navigate('/');
  }, [isAuthenticated, user, navigate]);

  const [currentStep, setCurrentStep] = useState<Step>('welcome');
  const [isAdmin, setIsAdmin]           = useState<boolean | null>(null);
  const [logs, setLogs]                 = useState<string[]>([]);
  const [isInstalling, setIsInstalling] = useState(false);
  const [installResult, setInstallResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [detection, setDetection]       = useState<{ installed: boolean; connected: boolean; message?: string } | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Detect existing installation
  useEffect(() => {
    if (currentStep === 'welcome') {
      void (async () => {
        try {
          const res = await window.desktopDb.sqlIsAlreadyInstalled();
          setDetection(res);
        } catch (err) {
          console.error('Failed to detect SQL installation:', err);
        }
      })();
    }
  }, [currentStep]);

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
    const db = window.desktopDb;
    if (!db) {
      setInstallResult({ ok: false, message: 'خطأ: جسر الاتصال بالنظام غير متاح.' });
      return;
    }

    setIsInstalling(true);
    setLogs([]);
    try {
      const res = await db.startInstallation();
      setInstallResult(res);
      
      if (res.ok) {
        setLogs(prev => [...prev, '[SYSTEM] Installation successful! Finalizing connection...']);
        const bootstrap = await db.sqlApplyBootstrapCredentials();
        if (bootstrap.ok) {
          setLogs(prev => [...prev, '[SYSTEM] Local credentials applied successfully.']);
          setLogs(prev => [...prev, '[SYSTEM] Connecting to local Database...']);
          const conn = await db.sqlConnect();
          if (conn.ok) {
            setLogs(prev => [...prev, '[SYSTEM] Database connection established. Registration complete!']);
            setCurrentStep('success');
          } else {
            setLogs(prev => [...prev, `[ERROR] Connection failed: ${conn.message}`]);
            setInstallResult({ ok: false, message: 'فشل الاتصال التلقائي بقاعدة البيانات. يرجى التحقق من لوحة التحكم.' });
          }
        } else {
          const errorMessage = !bootstrap.ok ? bootstrap.message : 'Unknown error';
          setLogs(prev => [...prev, `[ERROR] Failed to apply credentials: ${errorMessage}`]);
          setCurrentStep('success');
        }
      }
    } catch (err) {
      setInstallResult({ ok: false, message: String(err) });
    } finally {
      setIsInstalling(false);
    }
  };

  const handleFastLink = async () => {
    const db = window.desktopDb;
    if (!db) return;

    setIsInstalling(true);
    setLogs(['[SYSTEM] بدء عملية الربط السريع بالمحرك المكتشف...']);
    setCurrentStep('install');

    try {
      setLogs(prev => [...prev, '[SYSTEM] استرجاع بيانات المحرك المحلي...']);
      const bootstrap = await db.sqlApplyBootstrapCredentials();
      
      if (bootstrap.ok) {
        setLogs(prev => [...prev, '[SYSTEM] تم تطبيق الإعدادات بنجاح.']);
        setLogs(prev => [...prev, '[SYSTEM] جاري اختبار الاتصال بقاعدة البيانات...']);
        const conn = await db.sqlConnect();
        if (conn.ok) {
          setLogs(prev => [...prev, '[SYSTEM] تم الاتصال بنجاح!']);
          setTimeout(() => setCurrentStep('success'), 1000);
        } else {
          setLogs(prev => [...prev, `[ERROR] فشل الاتصال: ${conn.message}`]);
          setInstallResult({ ok: false, message: 'فشل الربط التلقائي. يرجى المحاولة يدوياً.' });
        }
      } else {
        setLogs(prev => [...prev, `[ERROR] فشل تطبيق البيانات: ${bootstrap.message}`]);
        setInstallResult({ ok: false, message: 'فشل قراءة ملف التهيئة المسبق.' });
      }
    } catch (err) {
      setLogs(prev => [...prev, `[ERROR] خطأ غير متوقع: ${String(err)}`]);
      setInstallResult({ ok: false, message: String(err) });
    } finally {
      setIsInstalling(false);
    }
  };

  const handleQuitApp = async () => {
    try {
      await window.desktopDb?.quitApp?.();
    } catch {
      window.close();
    }
  };

  const handleGoToLogin = () => {
    window.location.hash = ROUTE_PATHS.LOGIN;
  };

  return {
    currentStep, setCurrentStep,
    isAdmin, setIsAdmin,
    logs, setLogs,
    isInstalling, setIsInstalling,
    installResult, setInstallResult,
    detection, setDetection,
    logEndRef,
    handleStartInstallation, handleFastLink, handleQuitApp, handleGoToLogin,
  };
}

export type UseSystemSetupReturn = ReturnType<typeof useSystemSetup>;
