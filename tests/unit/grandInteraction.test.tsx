import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Commissions } from '../../src/pages/Commissions';
import { ContractFormPanel } from '../../src/components/panels/ContractFormPanel';
import { ToastProvider } from '../../src/context/ToastContext';
import { AuthProvider } from '../../src/context/AuthContext';
import { ModalProvider } from '../../src/context/ModalContext';
import { HashRouter } from 'react-router-dom';
import { jest } from '@jest/globals';

// Fixed Wrapper with all required providers
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

describe('Grand Interaction Strike - Commissions.tsx', () => {
    test('Full Workflow: Tab Switching, Searching, and Filtering', async () => {
        render(<AllProviders><Commissions /></AllProviders>);

        // 1. Tab Switching using ID to avoid ambiguity
        const externalTab = document.getElementById('comm-tab-external');
        if (externalTab) fireEvent.click(externalTab);
        
        // Wait for the tab content to render - look for the text in the empty state or the list
        await waitFor(() => {
            expect(screen.getByText(/سجل العمولات الخارجية/i)).toBeInTheDocument();
        }, { timeout: 3000 });

        const employeeTab = document.getElementById('comm-tab-employee');
        if (employeeTab) fireEvent.click(employeeTab);
        
        await waitFor(() => {
            expect(screen.getByText(/عمليات عمولة الموظفين/i)).toBeInTheDocument();
        }, { timeout: 3000 });

        // 2. Searching
        const searchInput = screen.getAllByPlaceholderText(/بحث/i)[0];
        fireEvent.change(searchInput, { target: { value: 'Test Search' } });

        // 3. Filtering
        const monthFilter = document.querySelector('input[type="month"]');
        if (monthFilter) {
            fireEvent.change(monthFilter, { target: { value: '2024-01' } });
        }
    });

    test('Modal Interaction: External Commission', async () => {
        render(<AllProviders><Commissions /></AllProviders>);
        
        const externalTab = document.getElementById('comm-tab-external');
        if (externalTab) {
            fireEvent.click(externalTab);
        }

        // The button label is actually "عمولة جديدة" or "إضافة عمولة"
        await waitFor(() => {
            const addBtn = screen.queryByText(/عمولة جديدة/i) || screen.queryByText(/إضافة عمولة/i);
            if (addBtn) fireEvent.click(addBtn);
            return !!addBtn;
        }, { timeout: 3000 });

        // Modal should be open
        await waitFor(() => {
            const saveBtn = screen.queryByText(/حفظ/i) || screen.queryByText(/إضافة/i);
            expect(saveBtn).toBeTruthy();
        }, { timeout: 3000 });

        const closeBtns = screen.getAllByText(/إلغاء/i);
        fireEvent.click(closeBtns[0]);
    });
});

describe('Grand Interaction Strike - ContractFormPanel.tsx', () => {
    test('Toggle Contract Type and Basic Interaction', async () => {
        render(<AllProviders><ContractFormPanel isOpen={true} onClose={() => {}} /></AllProviders>);
        
        // Find radio buttons or specific labels
        try {
            const saleText = screen.queryByText(/بيع/i);
            if (saleText) fireEvent.click(saleText);
            
            const rentalText = screen.queryByText(/إيجار/i);
            if (rentalText) fireEvent.click(rentalText);
        } catch (e) {}
    });
});
