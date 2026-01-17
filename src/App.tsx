/**
 * © 2025 — Developed by Mahmoud Qattoush
 * AZRAR Real Estate Management System — All Rights Reserved
 */

import React, { Suspense, useEffect } from 'react';
import { HashRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ModalProvider } from './context/ModalContext';
import { ToastProvider } from './context/ToastContext';
import { GlobalErrorBoundary } from './components/shared/GlobalErrorBoundary';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Loader2 } from 'lucide-react';
import { ROUTE_PATHS } from '@/routes/paths';
import { validateRoutes } from '@/routes/validate';
import { DbService } from './services/mockDb';
import { AppShellErrorBoundary } from '@/components/shared/AppShellErrorBoundary';

// Lazy Load Pages
const Dashboard = React.lazy(() => import('./pages/Dashboard').then(module => ({ default: module.Dashboard })));
const People = React.lazy(() => import('./pages/People').then(module => ({ default: module.People })));
const Properties = React.lazy(() => import('./pages/Properties').then(module => ({ default: module.Properties })));
const Contracts = React.lazy(() => import('./pages/Contracts').then(module => ({ default: module.Contracts })));
const Installments = React.lazy(() => import('./pages/Installments').then(module => ({ default: module.Installments })));
const DynamicBuilder = React.lazy(() => import('./pages/DynamicBuilder').then(module => ({ default: module.DynamicBuilder })));
const Alerts = React.lazy(() => import('./pages/Alerts').then(module => ({ default: module.Alerts })));
const Operations = React.lazy(() => import('./pages/Operations').then(module => ({ default: module.Operations })));
const Settings = React.lazy(() => import('./pages/Settings').then(module => ({ default: module.Settings })));
const Maintenance = React.lazy(() => import('./pages/Maintenance').then(module => ({ default: module.Maintenance })));
const Commissions = React.lazy(() => import('./pages/Commissions').then(module => ({ default: module.Commissions })));
const Reports = React.lazy(() => import('./pages/Reports').then(module => ({ default: module.Reports })));
const LegalHub = React.lazy(() => import('./pages/LegalHub').then(module => ({ default: module.LegalHub })));
const SmartTools = React.lazy(() => import('./pages/SmartTools').then(module => ({ default: module.SmartTools })));
const SystemMaintenance = React.lazy(() => import('./pages/SystemMaintenance').then(module => ({ default: module.SystemMaintenance })));
const AdminControlPanel = React.lazy(() => import('./pages/AdminControlPanel').then(module => ({ default: module.AdminControlPanel })));
const DatabaseManager = React.lazy(() => import('./pages/DatabaseManager').then(module => ({ default: module.DatabaseManager })));
const Sales = React.lazy(() => import('./pages/Sales').then(module => ({ default: module.Sales })));
const Login = React.lazy(() => import('./pages/Login').then(module => ({ default: module.Login })));
const Logout = React.lazy(() => import('./pages/Logout').then(module => ({ default: module.Logout })));
const NotFound = React.lazy(() => import('./pages/NotFound').then(module => ({ default: module.NotFound })));
const Documentation = React.lazy(() => import('./pages/Documentation').then(module => ({ default: module.Documentation })));
const Contacts = React.lazy(() => import('./pages/Contacts').then(module => ({ default: module.Contacts })));
const BulkWhatsApp = React.lazy(() => import('./pages/BulkWhatsApp').then(module => ({ default: module.BulkWhatsApp })));
const Documents = React.lazy(() => import('./pages/Documents').then(module => ({ default: module.Documents })));
const ComprehensiveTests = React.lazy(() => import('./pages/ComprehensiveTests').then(module => ({ default: module.ComprehensiveTests })));
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
  };
};

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
      try {
        DbService.runDailyScheduler();
      } catch (err) {
        console.warn('Failed to run daily scheduler:', err);
      }
    }, 2000);

    return () => window.clearTimeout(timer);
  }, [isAuthenticated]);

  return null;
};

const AutorunSystemTests: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  useEffect(() => {
    const autorun = (import.meta as unknown as ViteMeta)?.env?.VITE_AUTORUN_SYSTEM_TESTS;
    const enabled = typeof autorun === 'string' ? autorun.toLowerCase() === 'true' : !!autorun;
    if (!enabled) return;
    if (!isAuthenticated) return;
    if (location.pathname === ROUTE_PATHS.SYS_MAINTENANCE) return;
    // Keep legacy behavior (hash-based navigation) to minimize changes.
    window.location.hash = ROUTE_PATHS.SYS_MAINTENANCE;
  }, [isAuthenticated, location.pathname]);

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

const LayoutRoute: React.FC = () => {
  return (
    <AppShellErrorBoundary>
      <Layout>
        <DailyAutomation />
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
        <Route path={ROUTE_PATHS.LOGOUT} element={<Logout />} />
        <Route path={ROUTE_PATHS.LOGIN} element={<Login />} />

        {/* Protected */}
        <Route element={<RequireAuth />}>
          <Route element={<LayoutRoute />}>
            <Route index element={<Dashboard />} />

            <Route path={ROUTE_PATHS.SALES} element={<Sales />} />
            <Route path={ROUTE_PATHS.PEOPLE} element={<People />} />
            <Route path={ROUTE_PATHS.COMPANIES} element={<Navigate to={ROUTE_PATHS.PEOPLE} replace />} />
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
      </Routes>
    </HashRouter>
  );
};

function App() {
  return (
    <GlobalErrorBoundary>
      <AuthProvider>
        <ToastProvider>
          <ModalProvider>
            <Suspense fallback={<PageLoader />}>
              <AppRoutes />
            </Suspense>
          </ModalProvider>
        </ToastProvider>
      </AuthProvider>
    </GlobalErrorBoundary>
  );
}

export default App;