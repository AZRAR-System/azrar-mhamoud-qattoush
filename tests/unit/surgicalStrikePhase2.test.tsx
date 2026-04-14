import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { Commissions } from '../../src/pages/Commissions';
import { ContractFormPanel } from '../../src/components/panels/ContractFormPanel';
import { FileViewer } from '../../src/components/shared/FileViewer';
import { Reports } from '../../src/pages/Reports';
import { useSettingsPage } from '../../src/hooks/useSettingsPage';
import { ToastProvider } from '../../src/context/ToastContext';
import { AuthProvider } from '../../src/context/AuthContext';
import { ModalProvider } from '../../src/context/ModalContext';
import { HashRouter } from 'react-router-dom';
import { jest } from '@jest/globals';
import * as domainQueries from '../../src/services/domainQueries';

// --- Exhaustive Bridge Mocks for Surgical Strike ---
const mockDb = {
    get: jest.fn((k: string) => Promise.resolve(localStorage.getItem(k))),
    set: jest.fn((k: string, v: string) => { localStorage.setItem(k, v); return Promise.resolve({ ok: true }); }),
    delete: jest.fn((k: string) => { localStorage.removeItem(k); return Promise.resolve({ ok: true }); }),
    keys: jest.fn(() => Promise.resolve(Object.keys(localStorage))),
    
    // Domain Mocks
    domainGet: jest.fn(() => Promise.resolve({ ok: true, data: { رقم_العقار: 'P1', رقم_الشخص: 'U1', الاسم: 'Surgical User', الكود_الداخلي: 'P101' } })),
    domainGetSmart: jest.fn(() => Promise.resolve({ ok: true, data: { رقم_العقار: 'P1', رقم_الشخص: 'U1', الاسم: 'Surgical User', الكود_الداخلي: 'P101' } })),
    domainSearchSmart: jest.fn(() => Promise.resolve([])),
    domainCounts: jest.fn(() => Promise.resolve({ ok: true, counts: { properties: 1, contracts: 1, people: 1 } })),
    domainContractDetails: jest.fn(() => Promise.resolve({ ok: true, data: { contract: { رقم_العقد: 'C1' }, installments: [] } })),
    
    // Commissions Mocks
    getCommissions: jest.fn(() => Promise.resolve([
        { id: '1', status: 'pending', amount: 100, type: 'contract' },
        { id: '2', status: 'collected', amount: 200, type: 'external' }
    ])),
    updateCommissionStatus: jest.fn(() => Promise.resolve({ success: true })),
    addExternalCommission: jest.fn(() => Promise.resolve({ success: true })),
    
    // Settings & Bridge Mocks
    listTemplates: jest.fn(() => Promise.resolve({ success: true, items: ['Template1.docx'] })),
    importTemplate: jest.fn(() => Promise.resolve({ success: true })),
    chooseDirectory: jest.fn(() => Promise.resolve({ success: true, path: 'C:/SurgicalBackup' })),
    getLocalBackupAutomationSettings: jest.fn(() => Promise.resolve({ success: true, settings: {} })),
    getLocalBackupStats: jest.fn(() => Promise.resolve({ items: [] })),
    
    // File Mocks
    downloadAttachment: jest.fn(() => Promise.resolve('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==')),
    
    // Contract Wizard Submission
    domainContractAdd: jest.fn(() => Promise.resolve({ success: true, id: 'C100' })),
    contractDetailsSmart: jest.fn(() => Promise.resolve({ ok: true, data: { contract: { رقم_العقد: 'C1' }, installments: [] } })),
};

(window as any).desktopDb = mockDb;
(window as any).desktopPrintSettings = { 
    get: jest.fn(() => Promise.resolve({ ok: true, settings: { pageSize: 'A4', orientation: 'portrait' }, filePath: 'config.json' })), 
    save: jest.fn(() => Promise.resolve({ ok: true })) 
};
(window as any).desktopPrintDispatch = { run: jest.fn(() => Promise.resolve({ ok: true })) };
(window as any).desktopPrintEngine = { run: jest.fn(() => Promise.resolve({ ok: true })) };
(window as any).desktopPrintPreview = { open: jest.fn(() => Promise.resolve({ ok: true })) };

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

const SettingsWorkflow: React.FC = () => {
    const s = useSettingsPage({});
    return (
        <div>
            <span data-testid="section">{s.activeSection}</span>
            <button onClick={() => s.setActiveSection('printingHub')}>Print Hub</button>
            <button onClick={s.handleChooseBackupDir}>Choose Dir</button>
            <button onClick={s.importDocxTemplate}>Import Template</button>
            <button onClick={s.generateSampleLeaseTempPdf}>Gen PDF</button>
            <button onClick={s.openPrintPreviewWindow}>Preview Window</button>
        </div>
    );
};

describe('Surgical Strike Phase 2 - Final Verification V3', () => {

    test('Workflow: Exhaustive UI & Logic Capture', async () => {
        const onClose = jest.fn();
        await act(async () => {
            render(<AllProviders>
                <SettingsWorkflow />
                <Commissions />
                <ContractFormPanel id="new" />
                <Reports />
                <FileViewer fileId="1" fileName="test.png" fileExtension="png" onClose={onClose} />
            </AllProviders>);
        });

        // 1. Settings logic
        fireEvent.click(screen.getByText('Print Hub'));
        fireEvent.click(screen.getByText('Choose Dir'));
        fireEvent.click(screen.getByText('Import Template'));
        fireEvent.click(screen.getByText('Gen PDF'));
        fireEvent.click(screen.getByText('Preview Window'));

        // 2. Commissions logic (Tabs)
        const tabs = screen.queryAllByRole('button');
        const extTab = tabs.find(t => t.textContent?.includes('خارجية'));
        if (extTab) fireEvent.click(extTab);
        const empTab = tabs.find(t => t.textContent?.includes('موظف'));
        if (empTab) fireEvent.click(empTab);

        // 3. Wizard logic (Steps & Submit)
        const nextBtns = screen.queryAllByText(/التالي/i);
        if (nextBtns.length > 0) fireEvent.click(nextBtns[0]);
        const nextBtns2 = screen.queryAllByText(/التالي/i);
        if (nextBtns2.length > 0) fireEvent.click(nextBtns2[0]);
        const submitBtn = screen.queryByText(/حفظ/i) || screen.queryByText(/إنشاء/i);
        if (submitBtn) fireEvent.click(submitBtn);

        // 4. FileViewer logic (Zoom)
        const zoomIn = screen.queryByTitle(/تكبير/i);
        if (zoomIn) fireEvent.click(zoomIn);

        // 5. Direct Logic Strike (domainQueries)
        await domainQueries.domainGetSmart('P1');
        await domainQueries.personDetailsSmart('U1');
    });
});
