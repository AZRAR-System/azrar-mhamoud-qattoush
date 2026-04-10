import React, { Suspense } from 'react';
import { ROUTE_PATHS } from '@/routes/paths';
import { Loader2 } from 'lucide-react';

// Lazy Load Pages (Mirrored from App.tsx but accessible via path resolver)
const Dashboard = React.lazy(() => import('@/pages/Dashboard').then(m => ({ default: m.Dashboard })));
const People = React.lazy(() => import('@/pages/People').then(m => ({ default: m.People })));
const Properties = React.lazy(() => import('@/pages/Properties').then(m => ({ default: m.Properties })));
const Contracts = React.lazy(() => import('@/pages/Contracts').then(m => ({ default: m.Contracts })));
const Installments = React.lazy(() => import('@/pages/Installments').then(m => ({ default: m.Installments })));
const DynamicBuilder = React.lazy(() => import('@/pages/DynamicBuilder').then(m => ({ default: m.DynamicBuilder })));
const Alerts = React.lazy(() => import('@/pages/Alerts').then(m => ({ default: m.Alerts })));
const Operations = React.lazy(() => import('@/pages/Operations').then(m => ({ default: m.Operations })));
const Settings = React.lazy(() => import('@/pages/Settings').then(m => ({ default: m.Settings })));
const BackupManager = React.lazy(() => import('@/pages/BackupManager').then(m => ({ default: m.BackupManager })));
const Maintenance = React.lazy(() => import('@/pages/Maintenance').then(m => ({ default: m.Maintenance })));
const Commissions = React.lazy(() => import('@/pages/Commissions').then(m => ({ default: m.Commissions })));
const Reports = React.lazy(() => import('@/pages/Reports').then(m => ({ default: m.Reports })));
const LegalHub = React.lazy(() => import('@/pages/LegalHub').then(m => ({ default: m.LegalHub })));
const SmartTools = React.lazy(() => import('@/pages/SmartTools').then(m => ({ default: m.SmartTools })));
const SystemMaintenance = React.lazy(() => import('@/pages/SystemMaintenance').then(m => ({ default: m.SystemMaintenance })));
const AdminControlPanel = React.lazy(() => import('@/pages/AdminControlPanel').then(m => ({ default: m.AdminControlPanel })));
const Sales = React.lazy(() => import('@/pages/sales').then(m => ({ default: m.Sales })));
const OwnerPortal = React.lazy(() => import('@/pages/OwnerPortal').then(m => ({ default: m.OwnerPortal })));
const LicenseAdmin = React.lazy(() => import('@/pages/LicenseAdmin').then(m => ({ default: m.LicenseAdmin })));
const Documentation = React.lazy(() => import('@/pages/Documentation').then(m => ({ default: m.Documentation })));
const Contacts = React.lazy(() => import('@/pages/Contacts').then(m => ({ default: m.Contacts })));
const BulkWhatsApp = React.lazy(() => import('@/pages/BulkWhatsApp').then(m => ({ default: m.BulkWhatsApp })));
const Documents = React.lazy(() => import('@/pages/Documents').then(m => ({ default: m.Documents })));
const ComprehensiveTests = React.lazy(() => import('@/pages/ComprehensiveTests').then(m => ({ default: m.ComprehensiveTests })));
const NotFound = React.lazy(() => import('@/pages/NotFound').then(m => ({ default: m.NotFound })));

const PageLoader = () => (
    <div className="flex h-full w-full items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
            <Loader2 size={40} className="text-indigo-600 animate-spin" />
            <p className="text-sm text-slate-500 font-medium animate-pulse">جاري تحميل الوحدة...</p>
        </div>
    </div>
);

interface RouterPageProps {
    path: string;
}

export const RouterPage: React.FC<RouterPageProps> = ({ path }) => {
    let Component: React.LazyExoticComponent<React.FC<any>> | null = null;

    switch (path) {
        case ROUTE_PATHS.DASHBOARD: Component = Dashboard; break;
        case ROUTE_PATHS.SALES: Component = Sales; break;
        case ROUTE_PATHS.PEOPLE: Component = People; break;
        case ROUTE_PATHS.PROPERTIES: Component = Properties; break;
        case ROUTE_PATHS.CONTRACTS: Component = Contracts; break;
        case ROUTE_PATHS.INSTALLMENTS: Component = Installments; break;
        case ROUTE_PATHS.COMMISSIONS: Component = Commissions; break;
        case ROUTE_PATHS.MAINTENANCE: Component = Maintenance; break;
        case ROUTE_PATHS.ALERTS: Component = Alerts; break;
        case ROUTE_PATHS.REPORTS: Component = Reports; break;
        case ROUTE_PATHS.LEGAL: Component = LegalHub; break;
        case ROUTE_PATHS.SMART_TOOLS: Component = SmartTools; break;
        case ROUTE_PATHS.ADMIN_PANEL: Component = AdminControlPanel; break;
        case ROUTE_PATHS.SETTINGS: Component = Settings; break;
        case ROUTE_PATHS.BACKUP: Component = BackupManager; break;
        case ROUTE_PATHS.OPERATIONS: Component = Operations; break;
        case ROUTE_PATHS.SYS_MAINTENANCE: Component = SystemMaintenance; break;
        case ROUTE_PATHS.BUILDER: Component = DynamicBuilder; break;
        case ROUTE_PATHS.DOCS: Component = Documentation; break;
        case ROUTE_PATHS.OWNER_PORTAL: Component = OwnerPortal; break;
        case ROUTE_PATHS.CONTACTS: Component = Contacts; break;
        case ROUTE_PATHS.BULK_WHATSAPP: Component = BulkWhatsApp; break;
        case ROUTE_PATHS.DOCUMENTS: Component = Documents; break;
        case ROUTE_PATHS.COMPREHENSIVE_TESTS: Component = ComprehensiveTests; break;
        case ROUTE_PATHS.LICENSE_ADMIN: Component = LicenseAdmin; break;
        default: Component = NotFound; break;
    }

    return (
        <Suspense fallback={<PageLoader />}>
            {Component && <Component />}
        </Suspense>
    );
};
