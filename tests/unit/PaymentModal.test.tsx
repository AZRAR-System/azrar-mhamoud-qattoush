import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

jest.mock('@/components/dynamic/DynamicFieldsSection', () => ({
  DynamicFieldsSection: () => null,
}));

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import type { الكمبيالات_tbl, الأشخاص_tbl } from '@/types';
import { INSTALLMENT_STATUS } from '@/components/installments/installmentsConstants';
import { PaymentModal } from '@/components/installments/PaymentModal';
import { DbService } from '@/services/mockDb';
import { ToastProvider } from '@/context/ToastContext';
import { audioService } from '@/services/audioService';

const installment: الكمبيالات_tbl = {
  رقم_الكمبيالة: 'INS-MODAL-1',
  رقم_العقد: 'C-1',
  تاريخ_استحقاق: '2026-08-01',
  القيمة: 500,
  القيمة_المتبقية: 500,
  حالة_الكمبيالة: INSTALLMENT_STATUS.UNPAID,
  نوع_الكمبيالة: 'دورية',
  سجل_الدفعات: [],
};

const tenant: الأشخاص_tbl = {
  رقم_الشخص: 'P1',
  الاسم: 'مستأجر تجريبي',
} as الأشخاص_tbl;

function renderModal(ui: ReactElement) {
  return render(<ToastProvider>{ui}</ToastProvider>);
}

describe('PaymentModal', () => {
  let markPaidSpy: jest.SpiedFunction<typeof DbService.markInstallmentPaid>;
  let updateDynSpy: jest.SpiedFunction<typeof DbService.updateInstallmentDynamicFields>;
  let audioSpy: jest.SpiedFunction<typeof audioService.playSound>;

  beforeEach(() => {
    audioSpy = jest.spyOn(audioService, 'playSound').mockImplementation(() => {});
    markPaidSpy = jest
      .spyOn(DbService, 'markInstallmentPaid')
      .mockImplementation(() => ({ success: true }) as ReturnType<typeof DbService.markInstallmentPaid>);
    updateDynSpy = jest.spyOn(DbService, 'updateInstallmentDynamicFields').mockReturnValue({
      success: true,
    } as ReturnType<typeof DbService.updateInstallmentDynamicFields>);
  });

  afterEach(() => {
    markPaidSpy.mockRestore();
    updateDynSpy.mockRestore();
    audioSpy.mockRestore();
  });

  it('does not call markInstallmentPaid when amount is zero', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    const onSuccess = jest.fn();

    renderModal(
      <PaymentModal
        installment={installment}
        tenant={tenant}
        onClose={onClose}
        onSuccess={onSuccess}
        userId="u1"
        userRole="Admin"
      />
    );

    await user.click(screen.getByRole('button', { name: /تأكيد السداد/ }));
    expect(markPaidSpy).not.toHaveBeenCalled();
  });

  it('calls markInstallmentPaid with full amount when using كامل then confirm', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    const onSuccess = jest.fn();

    renderModal(
      <PaymentModal
        installment={installment}
        tenant={tenant}
        onClose={onClose}
        onSuccess={onSuccess}
        userId="u1"
        userRole="Admin"
      />
    );

    await user.click(screen.getByRole('button', { name: /^كامل$/ }));
    await user.click(screen.getByRole('button', { name: /تأكيد السداد/ }));

    expect(markPaidSpy).toHaveBeenCalledWith(
      'INS-MODAL-1',
      'u1',
      'Admin',
      expect.objectContaining({
        paidAmount: 500,
        isPartial: false,
      })
    );
    expect(onSuccess).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
