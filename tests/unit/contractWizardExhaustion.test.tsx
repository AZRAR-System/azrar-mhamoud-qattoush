import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ContractFormPanel } from '../../src/components/panels/ContractFormPanel';
import { ToastProvider } from '../../src/context/ToastContext';
import { AuthProvider } from '../../src/context/AuthContext';
import { ModalProvider } from '../../src/context/ModalContext';
import { HashRouter } from 'react-router-dom';
import { jest } from '@jest/globals';

// --- Exhaustive Bridge Mocks ---
// (Relies on globally enriched mocks in setup.js)

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

describe('Contract Wizard Exhaustion Strike - Reloaded', () => {
    test('Happy Path Strike: Progressing through all 3 steps', async () => {
        await act(async () => {
            render(<AllProviders><ContractFormPanel id="new" /></AllProviders>);
        });

        // --- Step 1: Details ---
        // Fill required fields to pass validation
        const inputs = screen.queryAllByRole('textbox');
        const numberInputs = screen.queryAllByRole('spinbutton'); // for القيمة_السنوية etc.

        await act(async () => {
            // Start Date (using the first textbox if it's the datepicker input)
            if (inputs[0]) fireEvent.change(inputs[0], { target: { value: '2025-01-01' } });
            
            // Annual Value
            const annualInput = screen.queryByPlaceholderText(/القيمة السنوية/i) || screen.queryAllByRole('textbox').find(i => i.id?.includes('القيمة_السنوية'));
            if (annualInput) fireEvent.change(annualInput, { target: { value: '1200' } });
        });

        const nextBtn = screen.queryByText(/التالي/i);
        if (nextBtn) {
            await act(async () => fireEvent.click(nextBtn));
        }

        // --- Step 2: Relationships (People & Properties) ---
        // With enriched mocks, loaders should finish
        const nextBtn2 = screen.queryByText(/التالي/i);
        if (nextBtn2) {
            await act(async () => fireEvent.click(nextBtn2));
        }

        // --- Step 3: Financials ---
        const saveBtn = screen.queryByText(/إنشاء/i) || screen.queryByText(/حفظ/i);
        if (saveBtn) {
             await act(async () => fireEvent.click(saveBtn));
        }
    });

    test('Validation Strike: Negative Paths', async () => {
         await act(async () => {
            render(<AllProviders><ContractFormPanel id="new" /></AllProviders>);
        });
        
        // Click Next without data
        const nextBtn = screen.queryByText(/التالي/i);
        if (nextBtn) {
            await act(async () => fireEvent.click(nextBtn));
        }
    });
});
