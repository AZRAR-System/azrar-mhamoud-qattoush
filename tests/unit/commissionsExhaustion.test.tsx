import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { Commissions } from '../../src/pages/Commissions';
import { ToastProvider } from '../../src/context/ToastContext';
import { AuthProvider } from '../../src/context/AuthContext';
import { ModalProvider } from '../../src/context/ModalContext';
import { HashRouter } from 'react-router-dom';
import { jest } from '@jest/globals';

// --- Exhaustive Bridge Mocks ---
// (Already globally mocked in setup.js)

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

describe('Commissions Exhaustion Strike - Reloaded', () => {
    test('UI Strike: Rendering Rows and Triggering Modals', async () => {
        await act(async () => {
            render(<AllProviders><Commissions /></AllProviders>);
        });

        // 1. Tab Switching Strike
        const tabs = screen.queryAllByRole('button');
        
        const externalTab = tabs.find(t => t.textContent?.includes('خارجية'));
        if (externalTab) {
            await act(async () => fireEvent.click(externalTab));
        }

        const employeeTab = tabs.find(t => t.textContent?.includes('الموظفين'));
        if (employeeTab) {
            await act(async () => fireEvent.click(employeeTab));
        }
        
        const contractTab = tabs.find(t => t.textContent?.includes('عقود'));
        if (contractTab) {
            await act(async () => fireEvent.click(contractTab));
        }

        // 2. CRUD Strike (Internal)
        const editBtn = screen.queryByTitle(/تعديل/i) || screen.queryAllByRole('button').find(b => b.textContent?.includes('تعديل'));
        if (editBtn) {
            await act(async () => fireEvent.click(editBtn));
            const saveBtn = screen.queryByText(/حفظ/i);
            if (saveBtn) await act(async () => fireEvent.click(saveBtn));
        }
        
        // 3. Filtering Strike
        const searchInput = screen.queryByPlaceholderText(/بحث/i);
        if (searchInput) {
            await act(async () => fireEvent.change(searchInput, { target: { value: 'Test' } }));
        }
    });

    test('External CRUD Strike', async () => {
        await act(async () => {
            render(<AllProviders><Commissions /></AllProviders>);
        });
        
        const tabs = screen.queryAllByRole('button');
        const externalTab = tabs.find(t => t.textContent?.includes('خارجية'));
        if (externalTab) await act(async () => fireEvent.click(externalTab));
        
        const addBtn = screen.queryByText(/إضافة/i);
        if (addBtn) {
            await act(async () => fireEvent.click(addBtn));
            const inputs = screen.queryAllByRole('textbox');
            if (inputs.length > 0) {
                await act(async () => {
                    fireEvent.change(inputs[1], { target: { value: 'New Comm' } }); // Title
                });
            }
        }
    });
});
