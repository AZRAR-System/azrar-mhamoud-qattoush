import { Suspense, lazy, useEffect, useRef, type FC } from 'react';
import { Loader2 } from 'lucide-react';
import { ROUTE_PATHS } from '@/routes/paths';
import type { AlertPanelIntent } from '@/services/alerts/alertActionTypes';
import { EmbeddedViewRoot } from '@/context/EmbeddedViewContext';

type SectionPath =
  | typeof ROUTE_PATHS.DASHBOARD
  | typeof ROUTE_PATHS.PEOPLE
  | typeof ROUTE_PATHS.PROPERTIES
  | typeof ROUTE_PATHS.CONTRACTS
  | typeof ROUTE_PATHS.INSTALLMENTS
  | typeof ROUTE_PATHS.MAINTENANCE
  | typeof ROUTE_PATHS.REPORTS
  | typeof ROUTE_PATHS.ALERTS
  | typeof ROUTE_PATHS.OPERATIONS
  | typeof ROUTE_PATHS.SETTINGS
  | typeof ROUTE_PATHS.SMART_TOOLS;

const Dashboard = lazy(() => import('@/pages/Dashboard').then((m) => ({ default: m.Dashboard })));
const People = lazy(() => import('@/pages/People').then((m) => ({ default: m.People })));
const Properties = lazy(() =>
  import('@/pages/Properties').then((m) => ({ default: m.Properties }))
);
const Contracts = lazy(() => import('@/pages/Contracts').then((m) => ({ default: m.Contracts })));
const Installments = lazy(() =>
  import('@/pages/Installments').then((m) => ({ default: m.Installments }))
);
const Maintenance = lazy(() =>
  import('@/pages/Maintenance').then((m) => ({ default: m.Maintenance }))
);
const Reports = lazy(() => import('@/pages/Reports').then((m) => ({ default: m.Reports })));
const Alerts = lazy(() => import('@/pages/Alerts').then((m) => ({ default: m.Alerts })));
const Operations = lazy(() =>
  import('@/pages/Operations').then((m) => ({ default: m.Operations }))
);
const Settings = lazy(() => import('@/pages/Settings').then((m) => ({ default: m.Settings })));
const SmartTools = lazy(() =>
  import('@/pages/SmartTools').then((m) => ({ default: m.SmartTools }))
);

const PageLoader: FC = () => (
  <div className="flex h-full w-full items-center justify-center min-h-[240px]">
    <div className="flex flex-col items-center gap-3">
      <Loader2 size={32} className="text-indigo-600 animate-spin" />
      <p className="text-sm text-slate-500 font-medium animate-pulse">جاري تحميل القسم...</p>
    </div>
  </div>
);

type InstallmentsOpenTarget = {
  contractId?: string;
  installmentId?: string;
  filter?: 'all' | 'debt' | 'due' | 'paid';
  fromAlert?: boolean;
  onlyTargetPanel?: boolean;
  intentKey?: string;
};

const InstallmentsWithTarget: FC<InstallmentsOpenTarget> = ({
  contractId,
  installmentId,
  filter,
  fromAlert,
  onlyTargetPanel,
  intentKey,
}) => {
  const lastWrittenIntentRef = useRef<string>('');

  useEffect(() => {
    const hasTarget = !!String(contractId || '').trim() || !!String(installmentId || '').trim();
    if (!hasTarget && !fromAlert && !filter) return;
    const stableIntentKey = String(intentKey || '').trim();
    if (stableIntentKey && lastWrittenIntentRef.current === stableIntentKey) return;
    const payload = JSON.stringify({
      contractId: String(contractId || '').trim(),
      installmentId: String(installmentId || '').trim(),
      filter: filter || 'all',
      fromAlert: !!fromAlert,
      onlyTargetPanel: !!onlyTargetPanel,
      intentKey: stableIntentKey,
    });
    if (sessionStorage.getItem('installments_open_target') === payload) return;
    sessionStorage.setItem(
      'installments_open_target',
      payload
    );
    if (stableIntentKey) lastWrittenIntentRef.current = stableIntentKey;
  }, [contractId, installmentId, filter, fromAlert, onlyTargetPanel, intentKey]);

  return <Installments />;
};

export const SectionViewPanel: FC<{
  id?: SectionPath;
  title?: string;
  contractId?: string;
  installmentId?: string;
  filter?: 'all' | 'debt' | 'due' | 'paid';
  fromAlert?: boolean;
  onlyTargetPanel?: boolean;
  intentKey?: string;
  /** يُمرَّر من `openAlertsInSection` عبر PanelProps */
  alertsIntent?: AlertPanelIntent;
}> = ({ id, contractId, installmentId, filter, fromAlert, onlyTargetPanel, intentKey, alertsIntent }) => {
  const section = id;

  const Component = (() => {
    switch (section) {
      case ROUTE_PATHS.DASHBOARD:
        return Dashboard;
      case ROUTE_PATHS.PEOPLE:
        return People;
      case ROUTE_PATHS.PROPERTIES:
        return Properties;
      case ROUTE_PATHS.CONTRACTS:
        return Contracts;
      case ROUTE_PATHS.INSTALLMENTS:
        return () => (
          <InstallmentsWithTarget
            contractId={contractId}
            installmentId={installmentId}
            filter={filter}
            fromAlert={fromAlert}
            onlyTargetPanel={onlyTargetPanel}
            intentKey={intentKey}
          />
        );
      case ROUTE_PATHS.MAINTENANCE:
        return Maintenance;
      case ROUTE_PATHS.REPORTS:
        return Reports;
      case ROUTE_PATHS.ALERTS:
        return () => <Alerts sectionIntent={alertsIntent} />;
      case ROUTE_PATHS.OPERATIONS:
        return Operations;
      case ROUTE_PATHS.SETTINGS:
        return Settings;
      case ROUTE_PATHS.SMART_TOOLS:
        return SmartTools;
      default:
        return null;
    }
  })();

  if (!Component) {
    return (
      <div className="p-6">
        <p className="text-sm text-slate-600 dark:text-slate-300">القسم غير معروف.</p>
      </div>
    );
  }

  return (
    <EmbeddedViewRoot>
      <div className="h-full w-full min-w-0">
        <Suspense fallback={<PageLoader />}>
          <Component />
        </Suspense>
      </div>
    </EmbeddedViewRoot>
  );
};
