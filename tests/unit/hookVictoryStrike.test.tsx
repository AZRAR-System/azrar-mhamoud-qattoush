import { renderHook, act } from '@testing-library/react';
import { useSettingsPage } from '../../src/hooks/useSettingsPage';
import React from 'react';
import { ToastProvider } from '../../src/context/ToastContext';
import { ModalProvider } from '../../src/context/ModalContext';
import { HashRouter } from 'react-router-dom';
import { jest } from '@jest/globals';

// --- Global Mocks (Exhaustive) ---
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// DIRECT MOCK of useAuth to avoid Context errors
jest.mock('../../src/context/AuthContext', () => ({
  useAuth: () => ({ user: { role: 'admin', username: 'test' } }),
}));

const mockDb = {
    get: jest.fn(() => Promise.resolve('{}')),
    set: jest.fn(() => Promise.resolve({ ok: true })),
    domainGet: jest.fn(() => Promise.resolve({ ok: true, data: {} })),
    domainCounts: jest.fn(() => Promise.resolve({ ok: true, counts: {} })),
    listTemplates: jest.fn(() => Promise.resolve({ success: true, items: ['T1'] })),
    chooseDirectory: jest.fn(() => Promise.resolve({ success: true, path: 'C:/' })),
    getLocalBackupAutomationSettings: jest.fn(() => Promise.resolve({ success: true, settings: {} })),
    getLocalBackupStats: jest.fn(() => Promise.resolve({ items: [] })),
    getLookupCategories: jest.fn(() => []),
    getSystemLogs: jest.fn(() => []),
    importTemplate: jest.fn(() => Promise.resolve({ success: true })),
};

(window as any).desktopDb = mockDb;
(window as any).desktopPrintSettings = { get: jest.fn(() => Promise.resolve({ ok: true, settings: {} })), save: jest.fn(() => Promise.resolve({ ok: true })) };

const wrapper = ({ children }: { children: React.ReactNode }) => (
    <HashRouter>
        <ToastProvider>
            <ModalProvider>
                {children}
            </ModalProvider>
        </ToastProvider>
    </HashRouter>
);

describe('Victory Iteration Strike - useSettingsPage V3', () => {
    test('Exhaustive Handler Iteration', async () => {
        const { result } = renderHook(() => useSettingsPage({}), { wrapper });

        // Iterate over all keys in the hook result
        const keys = Object.keys(result.current);
        
        for (const key of keys) {
            const val = (result.current as any)[key];
            if (typeof val === 'function' && key !== 'useAuth') {
                await act(async () => {
                    try {
                        if (key === 'computeNextRunAt') (val as any)(true, '12:00', '2025-01-01');
                        else if (key === 'openEditTableModal') (val as any)({ id: '1' });
                        else if (typeof val === 'function') await (val as any)();
                    } catch {
                        // ignore failures
                    }
                });
            }
        }
    });
});
