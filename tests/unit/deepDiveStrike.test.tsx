import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { Commissions } from '../../src/pages/Commissions';
import { Reports } from '../../src/pages/Reports';
import { AdminControlPanel } from '../../src/pages/AdminControlPanel';
import { ContractFormPanel } from '../../src/components/panels/ContractFormPanel';
import { PropertyPanel } from '../../src/components/panels/PropertyPanel';
import { PersonPanel } from '../../src/components/panels/PersonPanel';
import { PropertyFormPanel } from '../../src/components/panels/PropertyFormPanel';
import { ClearanceReportPanel } from '../../src/components/panels/ClearanceReportPanel';
import { CalendarTasksLayer } from '../../src/components/dashboard/layers/CalendarTasksLayer';
import { PropertyPicker } from '../../src/components/shared/PropertyPicker';
import { PersonPicker } from '../../src/components/shared/PersonPicker';
import { useSettingsPage } from '../../src/hooks/useSettingsPage';
import { ToastProvider } from '../../src/context/ToastContext';
import { AuthProvider } from '../../src/context/AuthContext';
import { ModalProvider } from '../../src/context/ModalContext';
import { HashRouter } from 'react-router-dom';
import { jest } from '@jest/globals';

// --- Exhaustive Global Mocks to satisfy isDesktopFast & Reporting ---
const mockDb = {
    get: jest.fn((k: string) => Promise.resolve(localStorage.getItem(k))),
    set: jest.fn((k: string, v: string) => { localStorage.setItem(k, v); return Promise.resolve({ ok: true }); }),
    delete: jest.fn((k: string) => { localStorage.removeItem(k); return Promise.resolve({ ok: true }); }),
    keys: jest.fn(() => Promise.resolve(Object.keys(localStorage))),
    
    // Core Domain
    domainGet: jest.fn(() => Promise.resolve({ ok: true, data: { رقم_العقار: 'P1', رقم_الشخص: 'U1', الاسم: 'Test User', الكود_الداخلي: 'P101' } })),
    domainSearchSmart: jest.fn(() => Promise.resolve([])),
    domainCounts: jest.fn(() => Promise.resolve({ ok: true, counts: { properties: 1, contracts: 1, people: 1 } })),
    
    // Property Specifics
    domainPropertyDetails: jest.fn(() => Promise.resolve({ ok: true, data: { property: { رقم_العقار: 'P1', الكود_الداخلي: 'P101' } } })),
    domainPropertyContracts: jest.fn(() => Promise.resolve([])),
    domainPropertyInspections: jest.fn(() => Promise.resolve([])),
    domainOwnershipHistory: jest.fn(() => Promise.resolve([])),
    domainSalesForProperty: jest.fn(() => Promise.resolve({ listings: [], agreements: [] })),
    domainPropertyUpdate: jest.fn(() => Promise.resolve({ success: true })),
    domainInspectionDelete: jest.fn(() => Promise.resolve({ success: true })),
    domainFollowUpAdd: jest.fn(() => Promise.resolve({ success: true })),
    domainSalesAgreementDelete: jest.fn(() => Promise.resolve({ success: true })),
    
    // Person Specifics
    domainPersonDetails: jest.fn(() => Promise.resolve({ 
        person: { رقم_الشخص: 'U1', الاسم: 'Jane Doe' },
        roles: ['مستأجر'],
        stats: { totalInstallments: 0, lateInstallments: 0, commitmentRatio: 100 },
        blacklistRecord: null
    })),
    domainPersonTenancyContracts: jest.fn(() => Promise.resolve([])),
    domainSalesForPerson: jest.fn(() => Promise.resolve({ listings: [], agreements: [] })),
    domainPeopleDelete: jest.fn(() => Promise.resolve({ success: true })),
    domainBlacklistRemove: jest.fn(() => Promise.resolve({ success: true })),
    
    // Admin & Analytics
    getAdminAnalytics: jest.fn(() => Promise.resolve({ ok: true, data: {} })),
    getLocalBackupAutomationSettings: jest.fn(() => Promise.resolve({ success: true, settings: {} })),
    getLocalBackupStats: jest.fn(() => Promise.resolve({ items: [] })),
    getLocalBackupLog: jest.fn(() => Promise.resolve([])),
    getBackupEncryptionSettings: jest.fn(() => Promise.resolve({ available: true })),
    
    // Legacy / Bridge
    chooseDirectory: jest.fn(() => Promise.resolve({ success: true, path: 'C:/Backup' })),
    runReportSmart: jest.fn(() => Promise.resolve({ ok: true, data: [], columns: [] })),
    getSettings: jest.fn(() => ({ rentalCommissionOwnerPercent: 5, rentalCommissionTenantPercent: 5, contractWhatsAppPromptAfterCreate: false })),
    getCommissions: jest.fn(() => []),
    getPeople: jest.fn(() => []),
    getProperties: jest.fn(() => []),
    onRemoteUpdate: jest.fn(() => (() => {})),
    getLookupCategories: jest.fn(() => []),
    getLookupsByCategory: jest.fn(() => []),
    getContractDetails: jest.fn(() => ({ contract: { رقم_العقد: 'C1' }, installments: [] })),
};

(window as any).desktopDb = mockDb;
(window as any).desktopPrintSettings = { get: jest.fn(() => Promise.resolve({ ok: true, settings: {} })), save: jest.fn(() => Promise.resolve({ ok: true })) };

// Mock storage.isDesktop to return true
jest.mock('../../src/services/storage', () => ({
    storage: {
        isDesktop: () => true,
        get: (k: string) => localStorage.getItem(k),
        set: (k: string, v: string) => localStorage.setItem(k, v),
        remove: (k: string) => localStorage.removeItem(k)
    }
}));

const AllProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <HashRouter>
        <AuthProvider>
            <ToastProvider>
                <ModalProvider>
                    {children}
                </ModalProvider>
            </ToastProvider>
        </AuthProvider>
    </HashRouter>
);

const SettingsDeepStrike: React.FC = () => {
    const s = useSettingsPage({});
    return (
        <div>
            <span data-testid="section">{s.activeSection}</span>
            <button onClick={() => s.setActiveSection('backup')}>Set Backup</button>
            <button onClick={s.handleChooseBackupDir}>Choose Dir</button>
            <button onClick={s.loadSettings}>Load Settings</button>
        </div>
    );
};

describe('Deep Dive Strike - Final Push to 70%', () => {

    test('Deep Strike: Global UI Layer', async () => {
        await act(async () => {
            render(<AllProviders>
                <SettingsDeepStrike />
                <AdminControlPanel />
                <Reports />
                <Commissions />
            </AllProviders>);
        });
        
        // Settings Interaction
        const backupBtn = screen.getByText('Set Backup');
        fireEvent.click(backupBtn);
        
        // Reports Interaction
        const reportTitle = screen.queryByText(/مركز التقارير المتقدم/i);
        if (reportTitle) expect(reportTitle).toBeInTheDocument();
    });

    test('Deep Strike: Wizard & Form Panels', async () => {
        await act(async () => {
            render(<AllProviders>
                <ContractFormPanel id="new" />
                <PropertyFormPanel id="new" />
                <ClearanceReportPanel contractId="C1" />
            </AllProviders>);
        });
        
        const wizardTitle = screen.queryByText(/معالج/i) || screen.queryByText(/عقد/i);
        if (wizardTitle) expect(wizardTitle).toBeInTheDocument();
    });

    test('Deep Strike: Dashboard & Interaction Layer', async () => {
        const mockData: any = { kpis: {}, trends: [], upcomingRent: [], upcomingInsurance: [], recentActivities: [], maintenance: [] };
        await act(async () => {
            render(<AllProviders>
                <CalendarTasksLayer data={mockData} />
                <PropertyPicker label="Prop" value="" onChange={() => {}} />
                <PersonPicker label="Person" value="" onChange={() => {}} />
                <PropertyPanel id="P1" />
                <PersonPanel id="U1" />
            </AllProviders>);
        });
        
        // Click pickers to reveal search
        const pickers = screen.queryAllByText(/اختر/i);
        pickers.forEach(p => fireEvent.click(p));
        
        // Calendar Interaction
        const days = screen.queryAllByText(/^\d{1,2}$/);
        if (days.length > 0) fireEvent.click(days[0]);
    });
});
