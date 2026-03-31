import { Suspense, lazy, type FC } from 'react';
import { Loader2 } from 'lucide-react';
import { ROUTE_PATHS } from '@/routes/paths';

type SectionPath =
  | typeof ROUTE_PATHS.PEOPLE
  | typeof ROUTE_PATHS.PROPERTIES
  | typeof ROUTE_PATHS.CONTRACTS
  | typeof ROUTE_PATHS.INSTALLMENTS
  | typeof ROUTE_PATHS.REPORTS
  | typeof ROUTE_PATHS.ALERTS
  | typeof ROUTE_PATHS.OPERATIONS
  | typeof ROUTE_PATHS.SETTINGS;

const People = lazy(() => import('@/pages/People').then((m) => ({ default: m.People })));
const Properties = lazy(() =>
  import('@/pages/Properties').then((m) => ({ default: m.Properties }))
);
const Contracts = lazy(() => import('@/pages/Contracts').then((m) => ({ default: m.Contracts })));
const Installments = lazy(() =>
  import('@/pages/Installments').then((m) => ({ default: m.Installments }))
);
const Reports = lazy(() => import('@/pages/Reports').then((m) => ({ default: m.Reports })));
const Alerts = lazy(() => import('@/pages/Alerts').then((m) => ({ default: m.Alerts })));
const Operations = lazy(() =>
  import('@/pages/Operations').then((m) => ({ default: m.Operations }))
);
const Settings = lazy(() => import('@/pages/Settings').then((m) => ({ default: m.Settings })));

const PageLoader: FC = () => (
  <div className="flex h-full w-full items-center justify-center min-h-[240px]">
    <div className="flex flex-col items-center gap-3">
      <Loader2 size={32} className="text-indigo-600 animate-spin" />
      <p className="text-sm text-slate-500 font-medium animate-pulse">جاري تحميل القسم...</p>
    </div>
  </div>
);

export const SectionViewPanel: FC<{ id?: SectionPath; title?: string }> = ({ id }) => {
  const section = id;

  const Component = (() => {
    switch (section) {
      case ROUTE_PATHS.PEOPLE:
        return People;
      case ROUTE_PATHS.PROPERTIES:
        return Properties;
      case ROUTE_PATHS.CONTRACTS:
        return Contracts;
      case ROUTE_PATHS.INSTALLMENTS:
        return Installments;
      case ROUTE_PATHS.REPORTS:
        return Reports;
      case ROUTE_PATHS.ALERTS:
        return Alerts;
      case ROUTE_PATHS.OPERATIONS:
        return Operations;
      case ROUTE_PATHS.SETTINGS:
        return Settings;
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
    <div className="p-4">
      <Suspense fallback={<PageLoader />}>
        <Component />
      </Suspense>
    </div>
  );
};
