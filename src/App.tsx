/**
 * © 2025 — Developed by Mahmoud Qattoush
 * AZRAR Real Estate Management System — All Rights Reserved
 */

import React, { Suspense, useEffect } from 'react';
import { HashRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ModalProvider } from './context/ModalContext';
import { ToastProvider, useToast } from './context/ToastContext';
import { GlobalErrorBoundary } from './components/shared/GlobalErrorBoundary';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ActivationProvider, useActivation } from './context/ActivationContext';
import { Loader2 } from 'lucide-react';
import { ROUTE_PATHS } from '@/routes/paths';
import { validateRoutes } from '@/routes/validate';
import { AppShellErrorBoundary } from '@/components/shared/AppShellErrorBoundary';

// Lazy Load Pages
const Dashboard = React.lazy(() =>
  import('./pages/Dashboard').then((module) => ({ default: module.Dashboard }))
);
const People = React.lazy(() =>
  import('./pages/People').then((module) => ({ default: module.People }))
);
const Properties = React.lazy(() =>
  import('./pages/Properties').then((module) => ({ default: module.Properties }))
);
const Contracts = React.lazy(() =>
  import('./pages/Contracts').then((module) => ({ default: module.Contracts }))
);
const Installments = React.lazy(() =>
  import('./pages/Installments').then((module) => ({ default: module.Installments }))
);
const DynamicBuilder = React.lazy(() =>
  import('./pages/DynamicBuilder').then((module) => ({ default: module.DynamicBuilder }))
);
const Alerts = React.lazy(() =>
  import('./pages/Alerts').then((module) => ({ default: module.Alerts }))
);
const Operations = React.lazy(() =>
  import('./pages/Operations').then((module) => ({ default: module.Operations }))
);
const Settings = React.lazy(() =>
  import('./pages/Settings').then((module) => ({ default: module.Settings }))
);
const BackupManager = React.lazy(() =>
  import('./pages/BackupManager').then((module) => ({ default: module.BackupManager }))
);
const Maintenance = React.lazy(() =>
  import('./pages/Maintenance').then((module) => ({ default: module.Maintenance }))
);
const Commissions = React.lazy(() =>
  import('./pages/Commissions').then((module) => ({ default: module.Commissions }))
);
const Reports = React.lazy(() =>
  import('./pages/Reports').then((module) => ({ default: module.Reports }))
);
const LegalHub = React.lazy(() =>
  import('./pages/LegalHub').then((module) => ({ default: module.LegalHub }))
);
const SmartTools = React.lazy(() =>
  import('./pages/SmartTools').then((module) => ({ default: module.SmartTools }))
);
const SystemMaintenance = React.lazy(() =>
  import('./pages/SystemMaintenance').then((module) => ({ default: module.SystemMaintenance }))
);
const AdminControlPanel = React.lazy(() =>
  import('./pages/AdminControlPanel').then((module) => ({ default: module.AdminControlPanel }))
);
const DatabaseManager = React.lazy(() =>
  import('./pages/DatabaseManager').then((module) => ({ default: module.DatabaseManager }))
);
const Sales = React.lazy(() =>
  import('./pages/Sales').then((module) => ({ default: module.Sales }))
);
const Login = React.lazy(() =>
  import('./pages/Login').then((module) => ({ default: module.Login }))
);
const Logout = React.lazy(() =>
  import('./pages/Logout').then((module) => ({ default: module.Logout }))
);
const Activation = React.lazy(() =>
  import('./pages/Activation').then((module) => ({ default: module.Activation }))
);
const LicenseAdminDashboard = React.lazy(() =>
  import('./pages/LicenseAdminDashboard').then((module) => ({
    default: module.LicenseAdminDashboard,
  }))
);
const LicenseAdmin = React.lazy(() =>
  import('./pages/LicenseAdmin').then((module) => ({ default: module.LicenseAdmin }))
);
const LicenseAdminUsers = React.lazy(() =>
  import('./pages/LicenseAdminUsers').then((module) => ({ default: module.LicenseAdminUsers }))
);
const LicenseAdminCustomers = React.lazy(() =>
  import('./pages/LicenseAdminCustomers').then((module) => ({
    default: module.LicenseAdminCustomers,
  }))
);
const NotFound = React.lazy(() =>
  import('./pages/NotFound').then((module) => ({ default: module.NotFound }))
);
const Documentation = React.lazy(() =>
  import('./pages/Documentation').then((module) => ({ default: module.Documentation }))
);
const Contacts = React.lazy(() =>
  import('./pages/Contacts').then((module) => ({ default: module.Contacts }))
);
const BulkWhatsApp = React.lazy(() =>
  import('./pages/BulkWhatsApp').then((module) => ({ default: module.BulkWhatsApp }))
);
const Documents = React.lazy(() =>
  import('./pages/Documents').then((module) => ({ default: module.Documents }))
);
const ComprehensiveTests = React.lazy(() =>
  import('./pages/ComprehensiveTests').then((module) => ({ default: module.ComprehensiveTests }))
);
const DatabaseReset = React.lazy(() => import('./pages/DatabaseReset'));

// Loading Fallback
const PageLoader = () => (
  <div className="flex h-full w-full items-center justify-center min-h-[400px]">
    <div className="flex flex-col items-center gap-3">
      <Loader2 size={40} className="text-indigo-600 animate-spin" />
      <p className="text-sm text-slate-500 font-medium animate-pulse">جاري تحميل الوحدة...</p>
    </div>
  </div>
);

type ViteMeta = {
  env?: {
    DEV?: unknown;
    VITE_AUTORUN_SYSTEM_TESTS?: unknown;
    VITE_ENABLE_INTEGRATION_TEST_DATA?: unknown;
    VITE_AUTORUN_SYSTEM_TESTS_MUTATION?: unknown;
  };
};

function readQueryFlag(key: string): boolean {
  try {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    const v = params.get(key);
    if (!v) return false;
    const s = String(v).toLowerCase();
    return s === '1' || s === 'true' || s === 'yes' || s === 'on';
  } catch {
    return false;
  }
}

function readViteFlag(value: unknown): boolean {
  if (typeof value === 'string') return value.toLowerCase() === 'true';
  return !!value;
}

const DevRouteValidation: React.FC = () => {
  useEffect(() => {
    const isDev = !!(import.meta as unknown as ViteMeta)?.env?.DEV;
    if (isDev) validateRoutes();
  }, []);
  return null;
};

const DailyAutomation: React.FC = () => {
  const { isAuthenticated } = useAuth();
  useEffect(() => {
    if (!isAuthenticated) return;

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const { DbService } = await import('./services/mockDb');
          DbService.runDailyScheduler();
        } catch (err) {
          console.warn('Failed to run daily scheduler:', err);
        }
      })();
    }, 2000);

    return () => window.clearTimeout(timer);
  }, [isAuthenticated]);

  return null;
};

const DiagnosticsStartupNotice: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const toast = useToast();

  useEffect(() => {
    if (!isAuthenticated) return;
    try {
      const alreadyShown = String(sessionStorage.getItem('diag_notice_shown') || '').trim() === '1';
      if (alreadyShown) return;

      const rawLast = String(localStorage.getItem('app_last_error') || '').trim();
      const rawLog = String(localStorage.getItem('app_error_log') || '').trim();
      const hasAny = !!rawLast || !!rawLog;
      if (!hasAny) return;

      let count: number | undefined;
      if (rawLog) {
        try {
          const parsed = JSON.parse(rawLog) as unknown;
          if (Array.isArray(parsed)) count = parsed.length;
        } catch {
          // ignore
        }
      }

      sessionStorage.setItem('diag_notice_shown', '1');
      const suffix =
        typeof count === 'number' && Number.isFinite(count) ? ` (عدد السجلات: ${count})` : '';
      toast.warning(
        `تم رصد أخطاء سابقة في الواجهة. افتح الإعدادات ← التشخيص لتصدير التقرير أو مسحه.${suffix}`
      );
    } catch {
      // ignore
    }
  }, [isAuthenticated, toast]);

  return null;
};

const AutorunSystemTests: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  useEffect(() => {
    const autorun = (import.meta as unknown as ViteMeta)?.env?.VITE_AUTORUN_SYSTEM_TESTS;
    const enabled = readViteFlag(autorun) || readQueryFlag('autorun');
    if (!enabled) return;
    if (!isAuthenticated) return;
    if (location.pathname === ROUTE_PATHS.SYS_MAINTENANCE) return;
    // Keep legacy behavior (hash-based navigation) to minimize changes.
    window.location.hash = ROUTE_PATHS.SYS_MAINTENANCE;
  }, [isAuthenticated, location.pathname]);

  return null;
};

const AutorunDesktopTestBootstrap: React.FC = () => {
  const { isAuthenticated, login } = useAuth();
  const startedRef = React.useRef(false);

  useEffect(() => {
    const env = (import.meta as unknown as ViteMeta)?.env;
    const autorunRaw = env?.VITE_AUTORUN_SYSTEM_TESTS;
    const autorunEnabled = readViteFlag(autorunRaw) || readQueryFlag('autorun');
    const isDev = !!env?.DEV;

    try {
      // Helps diagnose cases where env flags don't reach renderer during desktop dev tests.
      const isDesktop = typeof window !== 'undefined' && !!window.desktopDb;
      if (isDev && isDesktop) {
        const hasEnv = typeof env === 'object' && env !== null;
        const hasAutorunKey =
          hasEnv && Object.prototype.hasOwnProperty.call(env, 'VITE_AUTORUN_SYSTEM_TESTS');
        const hasIntegrationKey =
          hasEnv && Object.prototype.hasOwnProperty.call(env, 'VITE_ENABLE_INTEGRATION_TEST_DATA');
        console.warn(
          `[autorun] env check hasEnv=${hasEnv ? '1' : '0'} hasAutorunKey=${hasAutorunKey ? '1' : '0'} hasIntegrationKey=${hasIntegrationKey ? '1' : '0'} autorunRaw=${String(autorunRaw)}`
        );
      }
    } catch {
      // ignore
    }

    if (!autorunEnabled || !isDev) return;

    // Desktop-only: don't run this in browser.
    if (typeof window === 'undefined' || !window.desktopDb) return;

    if (startedRef.current) return;
    startedRef.current = true;

    let cancelled = false;

    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    (async () => {
      const startedAt = Date.now();
      try {
        try {
          console.warn('[autorun] bootstrap start');
        } catch {
          // ignore
        }

        // Wait briefly for the preload bridge to be ready.
        for (let i = 0; i < 40; i++) {
          if (cancelled) return;
          const ok = !!window.desktopDb?.getDeviceId;
          if (ok) break;
          await sleep(250);
        }

        // Retry activation/login for up to ~60s (desktop cache hydration can be slow on first load).
        while (!cancelled && Date.now() - startedAt < 60_000) {
          // 1) Ensure login. Default super admin matches VITE_SEED_DEFAULT_ADMIN_* (see .env.desktop).
          if (!isAuthenticated) {
            try {
              const u = String(import.meta.env.VITE_SEED_DEFAULT_ADMIN_USERNAME || 'admin').trim();
              const p = String(import.meta.env.VITE_SEED_DEFAULT_ADMIN_PASSWORD || '7Bibi@_@_0788');
              await login(u, p);
              try {
                console.warn('[autorun] logged in');
              } catch {
                // ignore
              }
            } catch {
              await sleep(800);
              continue;
            }
          }

          // 2) Navigate to system maintenance to run autorun suite.
          try {
            window.location.hash = ROUTE_PATHS.SYS_MAINTENANCE;
            console.warn('[autorun] navigate -> SYS_MAINTENANCE');
          } catch {
            // ignore
          }
          return;
        }
      } catch {
        // ignore
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, login]);

  return null;
};

const RequireAuth: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to={ROUTE_PATHS.LOGIN} replace state={{ from: location.pathname }} />;
  }

  if (isAuthenticated && location.pathname === ROUTE_PATHS.LOGIN) {
    return <Navigate to={ROUTE_PATHS.DASHBOARD} replace />;
  }

  return <Outlet />;
};

const RequireActivation: React.FC = () => {
  const { isActivated, loading } = useActivation();
  const location = useLocation();

  if (loading) {
    return <PageLoader />;
  }

  if (
    !isActivated &&
    location.pathname !== ROUTE_PATHS.ACTIVATION &&
    location.pathname !== ROUTE_PATHS.LOGIN
  ) {
    return <Navigate to={ROUTE_PATHS.LOGIN} replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
};

const LayoutRoute: React.FC = () => {
  return (
    <AppShellErrorBoundary>
      <Layout>
        <DailyAutomation />
        <DiagnosticsStartupNotice />
        <AutorunSystemTests />
        <Outlet />
      </Layout>
    </AppShellErrorBoundary>
  );
};

const AppRoutes: React.FC = () => {
  return (
    <HashRouter>
      <DevRouteValidation />
      <Routes>
        {/* Public */}
        <Route path={ROUTE_PATHS.ACTIVATION} element={<Activation />} />
        <Route path={ROUTE_PATHS.LICENSE_ADMIN} element={<LicenseAdminDashboard />} />
        <Route path={ROUTE_PATHS.LICENSE_ADMIN_LICENSES} element={<LicenseAdmin />} />
        <Route path={ROUTE_PATHS.LICENSE_ADMIN_USERS} element={<LicenseAdminUsers />} />
        <Route path={ROUTE_PATHS.LICENSE_ADMIN_CUSTOMERS} element={<LicenseAdminCustomers />} />

        {/* Everything else requires activation */}
        <Route element={<RequireActivation />}>
          <Route path={ROUTE_PATHS.LOGOUT} element={<Logout />} />
          <Route path={ROUTE_PATHS.LOGIN} element={<Login />} />

          {/* Protected */}
          <Route element={<RequireAuth />}>
            <Route element={<LayoutRoute />}>
              <Route index element={<Dashboard />} />

              <Route path={ROUTE_PATHS.SALES} element={<Sales />} />
              <Route path={ROUTE_PATHS.PEOPLE} element={<People />} />
              <Route path={ROUTE_PATHS.PROPERTIES} element={<Properties />} />
              <Route path={ROUTE_PATHS.CONTRACTS} element={<Contracts />} />
              <Route path={ROUTE_PATHS.INSTALLMENTS} element={<Installments />} />
              <Route path={ROUTE_PATHS.COMMISSIONS} element={<Commissions />} />
              <Route path={ROUTE_PATHS.MAINTENANCE} element={<Maintenance />} />
              <Route path={ROUTE_PATHS.SYS_MAINTENANCE} element={<SystemMaintenance />} />
              <Route path={ROUTE_PATHS.ADMIN_PANEL} element={<AdminControlPanel />} />
              <Route path={ROUTE_PATHS.DATABASE} element={<DatabaseManager />} />
              <Route path={ROUTE_PATHS.BUILDER} element={<DynamicBuilder />} />
              <Route path={ROUTE_PATHS.ALERTS} element={<Alerts />} />
              <Route path={ROUTE_PATHS.OPERATIONS} element={<Operations />} />
              <Route path={ROUTE_PATHS.SETTINGS} element={<Settings />} />
              <Route path={ROUTE_PATHS.BACKUP} element={<BackupManager />} />
              <Route path={ROUTE_PATHS.REPORTS} element={<Reports />} />
              <Route path={ROUTE_PATHS.LEGAL} element={<LegalHub />} />
              <Route path={ROUTE_PATHS.SMART_TOOLS} element={<SmartTools />} />
              <Route path={ROUTE_PATHS.DOCS} element={<Documentation />} />
              <Route path={ROUTE_PATHS.CONTACTS} element={<Contacts />} />
              <Route path={ROUTE_PATHS.BULK_WHATSAPP} element={<BulkWhatsApp />} />
              <Route path={ROUTE_PATHS.DOCUMENTS} element={<Documents />} />
              <Route path={ROUTE_PATHS.COMPREHENSIVE_TESTS} element={<ComprehensiveTests />} />
              <Route path={ROUTE_PATHS.RESET_DATABASE} element={<DatabaseReset />} />

              {/* 404 */}
              <Route path="*" element={<NotFound />} />
            </Route>
          </Route>
        </Route>
      </Routes>
    </HashRouter>
  );
};

function App() {
  return (
    <GlobalErrorBoundary>
      <ActivationProvider>
        <AuthProvider>
          <AutorunDesktopTestBootstrap />
          <ToastProvider>
            <ModalProvider>
              <Suspense fallback={<PageLoader />}>
                <AppRoutes />
              </Suspense>
            </ModalProvider>
          </ToastProvider>
        </AuthProvider>
      </ActivationProvider>
    </GlobalErrorBoundary>
  );
}

export default App;
