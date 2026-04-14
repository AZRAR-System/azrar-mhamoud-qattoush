import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { CalendarTasksLayer } from '../../src/components/dashboard/layers/CalendarTasksLayer';
import { AdminControlPanel } from '../../src/pages/AdminControlPanel';
import { PropertyPicker } from '../../src/components/shared/PropertyPicker';
import { PropertyPanel } from '../../src/components/panels/PropertyPanel';
import { PropertyFormPanel } from '../../src/components/panels/PropertyFormPanel';
import { PersonPanel } from '../../src/components/panels/PersonPanel';
import { ToastProvider } from '../../src/context/ToastContext';
import { AuthProvider } from '../../src/context/AuthContext';
import { ModalProvider } from '../../src/context/ModalContext';
import { HashRouter } from 'react-router-dom';
import { jest } from '@jest/globals';

// --- Exhaustive Bridge Mocks ---
const mockDb = {
    get: jest.fn(() => Promise.resolve('[]')),
    domainGet: jest.fn(() => Promise.resolve({ ok: true, data: { رقم_العقار: 'P1', رقم_الشخص: 'U1', الاسم: 'Test' } })),
    domainGetSmart: jest.fn(() => Promise.resolve({ ok: true, data: { رقم_العقار: 'P1', الاسم: 'Test' } })),
    domainCounts: jest.fn(() => Promise.resolve({ ok: true, counts: {} })),
    getAdminAnalytics: jest.fn(() => ({ totalCollected: 1000, occupiedProps: 5, vacantProps: 2, topDebtors: [] })),
    getSystemUsers: jest.fn(() => []),
    getPermissionDefinitions: jest.fn(() => []),
    getBlacklist: jest.fn(() => []),
    getPeople: jest.fn(() => []),
    getProperties: jest.fn(() => []),
    getContractDetails: jest.fn(() => ({ contract: {}, installments: [] })),
};

(window as any).desktopDb = mockDb;

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

describe('UI Panel Glory Strike - Final Exhaustion', () => {
    test('Panel Strike: Rendering and Pivoting all major UI blocks', async () => {
        const dashboardData = {
            stats: {},
            properties: [],
            contracts: [],
            people: [],
            followUps: [],
            installments: [],
            desktopHighlights: { dueInstallmentsToday: [], expiringContracts: [] }
        };

        await act(async () => {
            render(<AllProviders>
                <CalendarTasksLayer data={dashboardData as any} />
                <AdminControlPanel />
                <PropertyPicker onSelect={() => {}} />
                <PropertyPanel id="P1" />
                <PropertyFormPanel id="new" />
                <PersonPanel id="U1" />
            </AllProviders>);
        });

        // 1. Calendar Strike (Month switch)
        const nextMonth = screen.queryByTitle(/الشهر التالي/i);
        if (nextMonth) fireEvent.click(nextMonth);

        // 2. Admin Strike (Tab switch)
        // Use getAllByRole to find the button specifically
        const tabs = screen.queryAllByRole('button');
        const activityTab = tabs.find(t => t.textContent?.includes('سجل'));
        if (activityTab) fireEvent.click(activityTab);
        
        const usersTab = tabs.find(t => t.textContent?.includes('المستخدمين'));
        if (usersTab) fireEvent.click(usersTab);

        // 3. Property Picker Strike (Search)
        const searchInput = screen.queryByPlaceholderText(/بحث/i);
        if (searchInput) {
            fireEvent.change(searchInput, { target: { value: 'P101' } });
        }
    });
});
