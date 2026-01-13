/**
 * © 2025 — Developed by Mahmoud Qattoush
 * AZRAR Real Estate Management System — All Rights Reserved
 */

import React, { Suspense, useEffect, useState } from 'react';
import { Layout } from './components/Layout';
import { ModalProvider } from './context/ModalContext';
import { ToastProvider } from './context/ToastContext';
import { GlobalErrorBoundary } from './components/shared/GlobalErrorBoundary';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Loader2 } from 'lucide-react';
import { ROUTE_PATHS } from '@/routes/paths';
import { validateRoutes } from '@/routes/validate';
import { DbService } from './services/mockDb';

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

// Router Component to handle manual hash routing
const RouterContent = () => {
  const { isAuthenticated } = useAuth();
  const [currentHash, setCurrentHash] = useState(window.location.hash.slice(1).split('?')[0] || '/');

  useEffect(() => {
    const isDev = !!(import.meta as any)?.env?.DEV;
    if (isDev) {
      validateRoutes();
    }
  }, []);

  useEffect(() => {
    const handleHashChange = () => {
      let hash = window.location.hash.slice(1);
      if (hash.includes('?')) hash = hash.split('?')[0];
      if (!hash) hash = '/';
      setCurrentHash(hash);
    };
    
    // Initial check
    handleHashChange();

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Run Daily Automation when a user logs in (Simulated Background Job)
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

  // Auth Redirects
  useEffect(() => {
      if (!isAuthenticated && currentHash !== ROUTE_PATHS.LOGIN && currentHash !== ROUTE_PATHS.LOGOUT) {
        window.location.hash = ROUTE_PATHS.LOGIN;
      } else if (isAuthenticated && currentHash === ROUTE_PATHS.LOGIN) {
        window.location.hash = ROUTE_PATHS.DASHBOARD;
      }
  }, [isAuthenticated, currentHash]);

  // Optional: in dev/test automation, jump straight to System Maintenance tests.
  useEffect(() => {
    const autorun = (import.meta as any)?.env?.VITE_AUTORUN_SYSTEM_TESTS;
    const enabled = typeof autorun === 'string' ? autorun.toLowerCase() === 'true' : !!autorun;
    if (!enabled) return;
    if (!isAuthenticated) return;
    if (currentHash === ROUTE_PATHS.SYS_MAINTENANCE) return;
    window.location.hash = ROUTE_PATHS.SYS_MAINTENANCE;
  }, [currentHash, isAuthenticated]);

    // Public routes
    if (currentHash === ROUTE_PATHS.LOGOUT) return <Logout />;

  if (!isAuthenticated) return <Login />;

  let Component = NotFound;
  
    switch (currentHash) {
      case ROUTE_PATHS.DASHBOARD: Component = Dashboard; break;
      case ROUTE_PATHS.SALES: Component = Sales; break;
      case ROUTE_PATHS.PEOPLE: Component = People; break;
      case ROUTE_PATHS.COMPANIES: Component = People; break;
      case ROUTE_PATHS.PROPERTIES: Component = Properties; break;
      case ROUTE_PATHS.CONTRACTS: Component = Contracts; break;
      case ROUTE_PATHS.INSTALLMENTS: Component = Installments; break;
      case ROUTE_PATHS.COMMISSIONS: Component = Commissions; break;
      case ROUTE_PATHS.MAINTENANCE: Component = Maintenance; break;
      case ROUTE_PATHS.SYS_MAINTENANCE: Component = SystemMaintenance; break;
      case ROUTE_PATHS.ADMIN_PANEL: Component = AdminControlPanel; break;
      case ROUTE_PATHS.DATABASE: Component = DatabaseManager; break;
      case ROUTE_PATHS.BUILDER: Component = DynamicBuilder; break;
      case ROUTE_PATHS.ALERTS: Component = Alerts; break;
      case ROUTE_PATHS.OPERATIONS: Component = Operations; break;
      case ROUTE_PATHS.SETTINGS: Component = Settings; break;
      case ROUTE_PATHS.REPORTS: Component = Reports; break;
      case ROUTE_PATHS.LEGAL: Component = LegalHub; break;
      case ROUTE_PATHS.SMART_TOOLS: Component = SmartTools; break;
      case ROUTE_PATHS.DOCS: Component = Documentation; break;
      case ROUTE_PATHS.CONTACTS: Component = Contacts; break;
      case ROUTE_PATHS.BULK_WHATSAPP: Component = BulkWhatsApp; break;
      case ROUTE_PATHS.DOCUMENTS: Component = Documents; break;
      case ROUTE_PATHS.COMPREHENSIVE_TESTS: Component = ComprehensiveTests; break;
      case ROUTE_PATHS.RESET_DATABASE: Component = DatabaseReset; break;
      default: Component = NotFound; break;
    }

  return (
      <Layout>
          <Component />
      </Layout>
  );
};

function App() {
  return (
    <GlobalErrorBoundary>
      <AuthProvider>
        <ToastProvider>
          <ModalProvider>
            <Suspense fallback={<PageLoader />}>
              <RouterContent />
            </Suspense>
          </ModalProvider>
        </ToastProvider>
      </AuthProvider>
    </GlobalErrorBoundary>
  );
}

export default App;