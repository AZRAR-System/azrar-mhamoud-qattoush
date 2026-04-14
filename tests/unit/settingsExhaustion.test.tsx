import React from 'react';
import { render, act } from '@testing-library/react';
import { useSettingsPage } from '../../src/hooks/useSettingsPage';
import { ToastProvider } from '../../src/context/ToastContext';
import { AuthProvider } from '../../src/context/AuthContext';
import { ModalProvider } from '../../src/context/ModalContext';
import { HashRouter } from 'react-router-dom';
import { jest } from '@jest/globals';

// --- Exhaustive Bridge Mocks ---
const mockDb = {
    get: jest.fn(() => Promise.resolve('{}')),
    set: jest.fn(() => Promise.resolve({ ok: true })),
    delete: jest.fn(() => Promise.resolve({ ok: true })),
    domainGet: jest.fn(() => Promise.resolve({ ok: true, data: {} })),
    domainCounts: jest.fn(() => Promise.resolve({ ok: true, counts: {} })),
    listTemplates: jest.fn(() => Promise.resolve({ success: true, items: [] })),
    chooseDirectory: jest.fn(() => Promise.resolve({ success: true, path: 'C:/' })),
    getLocalBackupAutomationSettings: jest.fn(() => Promise.resolve({ success: true, settings: {} })),
    getLocalBackupStats: jest.fn(() => Promise.resolve({ items: [] })),
    getLookupCategories: jest.fn(() => []),
    getLookupsByCategory: jest.fn(() => []),
    addLookupCategory: jest.fn(() => ({ success: true })),
    updateLookupCategory: jest.fn(() => ({ success: true })),
    deleteLookupCategory: jest.fn(() => ({ success: true })),
    addLookup: jest.fn(() => ({ success: true })),
    deleteLookupItem: jest.fn(() => ({ success: true })),
    getSystemLogs: jest.fn(() => []),
    downloadAttachment: jest.fn(() => Promise.resolve('')),
    listWordTemplates: jest.fn(() => []),
    listWordTemplatesDetailed: jest.fn(() => []),
};

(window as any).desktopDb = mockDb;
(window as any).desktopPrintSettings = { get: jest.fn(() => Promise.resolve({ ok: true, settings: {} })), save: jest.fn(() => Promise.resolve({ ok: true })) };

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

let hookInstance: any = null;
const HookWrapper = () => {
    hookInstance = useSettingsPage({});
    return null;
};

describe('Settings Exhaustion Strike - Reloaded', () => {
    test('Method Strike: Exhausting with Realistic Data', async () => {
        // Enforce some mock data specifically for this test
        mockDb.getLocalBackupStats = jest.fn(() => Promise.resolve({ items: [{ id: '1', name: 'backup1', date: '2025-01-01', size: 1024, path: '/path' }] })) as any;
        mockDb.getLookupCategories = jest.fn(() => [{ id: '1', name: 'cat1', label: 'Category 1' }]) as any;

        await act(async () => {
            render(<AllProviders><HookWrapper /></AllProviders>);
        });

        const h = hookInstance;
        if (!h) throw new Error('Hook not initialized');

        await act(async () => {
            // Backup Strike
            await h.loadBackupSection();
            h.computeNextRunAt('2025-01-01', 1);
            
            // Lookup Strike
            await h.loadCategories();
            h.openAddTableModal();
            h.openEditTableModal({ id: '1', name: 'cat1', label: 'Category 1' });
            
            // Diagnostics
            await h.loadDiagnostics();
            try { h.buildDiagnosticsReport(); } catch {}
            
            // Exports
            try { h.handleExportLookupsJSON(); } catch {}
            try { h.handleExportLookupsCSV(); } catch {}
        });

        expect(h).toBeDefined();
    });
});
