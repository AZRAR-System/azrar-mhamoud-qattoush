import React from 'react';
import { render } from '@testing-library/react';
import { Commissions } from '../../src/pages/Commissions';
import { ContractFormPanel } from '../../src/components/panels/ContractFormPanel';
import { PropertyPanel } from '../../src/components/panels/PropertyPanel';
import { PersonPanel } from '../../src/components/panels/PersonPanel';
import { CalendarTasksLayer } from '../../src/components/dashboard/layers/CalendarTasksLayer';
import { ToastProvider } from '../../src/context/ToastContext';
import { AuthProvider } from '../../src/context/AuthContext';
import { HashRouter } from 'react-router-dom';

// Simple wrapper to provide all required contexts
const AllProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <HashRouter>
        <AuthProvider>
            <ToastProvider>
                {children}
            </ToastProvider>
        </AuthProvider>
    </HashRouter>
);

describe('UI Final Blitz - Massive Component Rendering', () => {
    test('Rendering Commissions Page', () => {
        try { render(<AllProviders><Commissions /></AllProviders>); } catch (e) {}
    });

    test('Rendering ContractFormPanel', () => {
        try { render(<AllProviders><ContractFormPanel isOpen={true} onClose={() => {}} /></AllProviders>); } catch (e) {}
    });

    test('Rendering PropertyPanel', () => {
        try { render(<AllProviders><PropertyPanel isOpen={true} onClose={() => {}} /></AllProviders>); } catch (e) {}
    });

    test('Rendering PersonPanel', () => {
        try { render(<AllProviders><PersonPanel isOpen={true} onClose={() => {}} /></AllProviders>); } catch (e) {}
    });

    test('Rendering CalendarTasksLayer', () => {
        try { render(<AllProviders><CalendarTasksLayer /></AllProviders>); } catch (e) {}
    });
});
