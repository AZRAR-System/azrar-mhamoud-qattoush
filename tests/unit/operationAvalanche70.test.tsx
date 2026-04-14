import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { AdminControlPanel } from '../../src/pages/AdminControlPanel';
import { Reports } from '../../src/pages/Reports';
import { useSettingsPage } from '../../src/hooks/useSettingsPage';
import { runIntegrationTests } from '../../src/services/integrationTests';
import { ToastProvider } from '../../src/context/ToastContext';
import { AuthProvider } from '../../src/context/AuthContext';
import { ModalProvider } from '../../src/context/ModalContext';
import { HashRouter } from 'react-router-dom';
import { jest } from '@jest/globals';

// 1. Setup global flag for integration tests
(window as any).ENABLE_INTEGRATION_TEST_DATA = true;

// 2. Fully Mock Desktop globals to prevent Bridge errors
(window as any).desktopDb = {
    get: jest.fn((key) => Promise.resolve(globalThis.localStorage.getItem(key))),
    set: jest.fn((key, val) => {
        globalThis.localStorage.setItem(key, val);
        return Promise.resolve({ ok: true });
    }),
    delete: jest.fn((key) => {
        globalThis.localStorage.removeItem(key);
        return Promise.resolve({ ok: true });
    }),
    keys: jest.fn(() => Promise.resolve(Object.keys(globalThis.localStorage))),
    onRemoteUpdate: jest.fn(() => (() => {})),
    domainGet: jest.fn(() => Promise.resolve({ ok: true, data: null })),
    domainSearchSmart: jest.fn(() => Promise.resolve([])),
    domainSearch: jest.fn(() => Promise.resolve({ ok: true, items: [] })),
    getAdminAnalytics: jest.fn(() => Promise.resolve({ ok: true, data: {} })),
    getLocalBackupAutomationSettings: jest.fn(() => Promise.resolve({ success: true, settings: {} })),
    getLocalBackupStats: jest.fn(() => Promise.resolve({ items: [] })),
    getLocalBackupLog: jest.fn(() => Promise.resolve([])),
    getBackupEncryptionSettings: jest.fn(() => Promise.resolve({ available: true })),
    getBackupDir: jest.fn(() => Promise.resolve('C:/Backup')),
    listTemplates: jest.fn(() => Promise.resolve({ success: true, items: ['Template 1'] })),
    chooseDirectory: jest.fn(() => Promise.resolve({ success: true, path: 'C:/Backup' })),
    domainCounts: jest.fn(() => Promise.resolve({ ok: true, counts: { properties: 0, contracts: 0, people: 0 } })),
    domainDashboardSummary: jest.fn(() => Promise.resolve({ ok: true, data: {} })),
    domainDashboardPerformance: jest.fn(() => Promise.resolve({ ok: true, data: {} })),
    domainDashboardHighlights: jest.fn(() => Promise.resolve({ ok: true, data: {} })),
    domainPaymentNotificationTargets: jest.fn(() => Promise.resolve({ ok: true, items: [] })),
    domainPersonDetails: jest.fn(() => Promise.resolve({ ok: true, data: {} })),
    domainPersonTenancyContracts: jest.fn(() => Promise.resolve({ ok: true, items: [] })),
    domainContractDetails: jest.fn(() => Promise.resolve({ ok: true, data: {} })),
    domainContractPickerSearch: jest.fn(() => Promise.resolve({ ok: true, items: [] })),
    domainPropertyPickerSearch: jest.fn(() => Promise.resolve({ ok: true, items: [] })),
    domainPropertyPickerSearchPaged: jest.fn(() => Promise.resolve({ ok: true, items: [], total: 0 })),
    domainOwnershipHistory: jest.fn(() => Promise.resolve({ ok: true, items: [] })),
    domainPropertyInspections: jest.fn(() => Promise.resolve({ ok: true, items: [] })),
    domainPropertyContracts: jest.fn(() => Promise.resolve({ ok: true, items: [] })),
    domainSalesForPerson: jest.fn(() => Promise.resolve({ ok: true, listings: [], agreements: [] })),
    domainSalesForProperty: jest.fn(() => Promise.resolve({ ok: true, listings: [], agreements: [] })),
    domainBlacklistRemove: jest.fn(() => Promise.resolve({ ok: true })),
    domainUpdateProperty: jest.fn(() => Promise.resolve({ ok: true })),
    installmentsContractsPagedSmart: jest.fn(() => Promise.resolve({ ok: true, items: [], total: 0 })),
};

(window as any).desktopPrintSettings = {
    get: jest.fn(() => Promise.resolve({ ok: true, settings: {}, filePath: 'config.json' })),
    save: jest.fn(() => Promise.resolve({ ok: true })),
};

(window as any).desktopPrintDispatch = { run: jest.fn() };
(window as any).desktopPrintEngine = { run: jest.fn() };
(window as any).desktopPrintPreview = { open: jest.fn() };

// Mock runReportSmart to return valid empty data
jest.mock('../../src/services/reporting', () => ({
    runReportSmart: jest.fn((id: string) => Promise.resolve({ ok: true, data: [], title: id, columns: [] })),
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

const SettingsTestRunner: React.FC = () => {
    const settings = useSettingsPage({});
    return (
        <div>
            <div data-testid="section-display">{settings.activeSection}</div>
            <button data-testid="btn-general" onClick={() => settings.setActiveSection('general')}>Set General</button>
            <button data-testid="btn-printingHub" onClick={() => settings.setActiveSection('printingHub')}>Set Printing</button>
            <button data-testid="btn-server" onClick={() => settings.setActiveSection('server')}>Set Server</button>
            <button data-testid="btn-backup" onClick={() => settings.setActiveSection('backup')}>Set Backup</button>
            <button data-testid="btn-audit" onClick={() => settings.setActiveSection('audit')}>Set Audit</button>
            <button data-testid="btn-diagnostics" onClick={() => settings.setActiveSection('diagnostics')}>Set Diagnostics</button>
            <button data-testid="btn-lookups" onClick={() => settings.setActiveSection('lookups')}>Set Lookups</button>
            <button data-testid="btn-legal" onClick={() => settings.setActiveSection('legal')}>Set Legal</button>
            <button data-testid="btn-sms" onClick={() => settings.setActiveSection('sms')}>Set SMS</button>
            <button onClick={() => settings.handleChooseBackupDir()}>Choose Dir</button>
            <button onClick={() => settings.loadSettings()}>Load Settings</button>
        </div>
    );
};

describe('Operation Avalanche 70 - Logic & Integration Strike', () => {
    
    test('Backend Logic Strike: runIntegrationTests', async () => {
        const results = await runIntegrationTests();
        expect(results.length).toBeGreaterThan(0);
    });

    test('UI Logic Strike: useSettingsPage Hook', async () => {
        render(<AllProviders><SettingsTestRunner /></AllProviders>);
        const sections = ['general', 'printingHub', 'server', 'backup', 'audit', 'diagnostics', 'lookups', 'legal', 'sms'];
        for (const section of sections) {
            const btn = screen.getByTestId(`btn-${section}`);
            fireEvent.click(btn);
        }
    });

    test('Admin UI Strike: AdminControlPanel', async () => {
        render(<AllProviders><AdminControlPanel /></AllProviders>);
        await waitFor(() => {
            expect(screen.getByText(/توزيع العقارات/i)).toBeInTheDocument();
        });
    });

    test('Reports UI Strike: Reports', async () => {
        render(<AllProviders><Reports /></AllProviders>);
        await waitFor(() => {
            expect(screen.getByText(/مركز التقارير المتقدم/i)).toBeInTheDocument();
        });
    });
});
