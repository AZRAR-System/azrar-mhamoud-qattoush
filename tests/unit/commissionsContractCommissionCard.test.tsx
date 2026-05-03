import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { CommissionsContractCommissionCard } from '@/components/commissions/CommissionsContractCommissionCard';
import type { العمولات_tbl } from '@/types';

const getPropCode = () => 'INT-101';
const getNamesRental = () => ({ p1: 'مالك تجريبي', p2: 'مستأجر تجريبي', p3: '' });
const getNamesWithGuarantor = () => ({ p1: 'مالك', p2: 'مستأجر', p3: 'كفيل تجريبي' });

describe('CommissionsContractCommissionCard', () => {
  const onEdit = jest.fn();
  const onPostpone = jest.fn();
  const onDelete = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const baseRental = (): العمولات_tbl => ({
    رقم_العمولة: 'rc-1',
    رقم_العقد: 'C200',
    تاريخ_العقد: '2025-06-10',
    نوع_العمولة: 'Rental',
    شهر_دفع_العمولة: '2025-06',
    رقم_الفرصة: 'OPP-9',
    عمولة_المالك: 120,
    عمولة_المستأجر: 80,
    المجموع: 200,
  });

  test('renders rental commission with parties and wires action buttons', () => {
    const c = baseRental();
    render(
      <CommissionsContractCommissionCard
        c={c}
        variant="default"
        getPropCode={getPropCode}
        getNames={getNamesRental}
        onEdit={onEdit}
        onPostpone={onPostpone}
        onDelete={onDelete}
      />
    );

    expect(screen.getByText('عمولة إيجار')).toBeInTheDocument();
    expect(screen.getByText(/INT-101/)).toBeInTheDocument();
    expect(screen.getByText('مالك تجريبي')).toBeInTheDocument();
    expect(screen.getByText('مستأجر تجريبي')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /تعديل/ }));
    fireEvent.click(screen.getByRole('button', { name: /تأجيل التحصيل/ }));
    fireEvent.click(screen.getByRole('button', { name: /حذف/ }));
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onPostpone).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  test('renewal variant shows badge and parent contract when provided', () => {
    const c = baseRental();
    render(
      <CommissionsContractCommissionCard
        c={c}
        variant="renewal"
        parentContractId="C199"
        getPropCode={getPropCode}
        getNames={getNamesRental}
        onEdit={onEdit}
        onPostpone={onPostpone}
        onDelete={onDelete}
      />
    );

    expect(screen.getByText('تجديد')).toBeInTheDocument();
    expect(screen.getByText(/العقد السابق/)).toBeInTheDocument();
    expect(screen.getByText(/#C199/)).toBeInTheDocument();
  });

  test('sale commission uses buyer/seller labels and amounts', () => {
    const c: العمولات_tbl = {
      رقم_العمولة: 'sc-1',
      رقم_الاتفاقية: 'SA-500',
      تاريخ_العقد: '2025-07-01',
      نوع_العمولة: 'Sale',
      عمولة_المالك: 0,
      عمولة_المستأجر: 0,
      عمولة_البائع: 400,
      عمولة_المشتري: 100,
      المجموع: 500,
    };

    render(
      <CommissionsContractCommissionCard
        c={c}
        variant="default"
        getPropCode={getPropCode}
        getNames={() => ({ p1: 'بائع', p2: 'مشتري', p3: '' })}
        onEdit={onEdit}
        onPostpone={onPostpone}
        onDelete={onDelete}
      />
    );

    expect(screen.getByText('عمولة بيع')).toBeInTheDocument();
    expect(screen.getByText('البائع')).toBeInTheDocument();
    expect(screen.getByText('المشتري')).toBeInTheDocument();
    expect(screen.queryByText('الكفيل')).not.toBeInTheDocument();
    expect(screen.getByText('عمولة البائع')).toBeInTheDocument();
    expect(screen.getByText('عمولة المشتري')).toBeInTheDocument();
  });

  test('shows guarantor block for rental when p3 is set', () => {
    const c = baseRental();
    render(
      <CommissionsContractCommissionCard
        c={c}
        variant="default"
        getPropCode={getPropCode}
        getNames={getNamesWithGuarantor}
        onEdit={onEdit}
        onPostpone={onPostpone}
        onDelete={onDelete}
      />
    );
    expect(screen.getByText('الكفيل')).toBeInTheDocument();
    expect(screen.getByText('كفيل تجريبي')).toBeInTheDocument();
  });

  test('shows deferred collection line when dates are set', () => {
    const c: العمولات_tbl = {
      ...baseRental(),
      تاريخ_تحصيل_مؤجل: '2025-12-01',
      جهة_تحصيل_مؤجل: 'مالك',
    };
    render(
      <CommissionsContractCommissionCard
        c={c}
        variant="default"
        getPropCode={getPropCode}
        getNames={getNamesRental}
        onEdit={onEdit}
        onPostpone={onPostpone}
        onDelete={onDelete}
      />
    );
    expect(screen.getByText(/تحصيل مؤجل/)).toBeInTheDocument();
    expect(screen.getByText(/2025-12-01/)).toBeInTheDocument();
    expect(screen.getByText(/\(مالك\)/)).toBeInTheDocument();
  });

  test('flags property intro in total cell when يوجد_ادخال_عقار', () => {
    const c: العمولات_tbl = { ...baseRental(), يوجد_ادخال_عقار: true };
    render(
      <CommissionsContractCommissionCard
        c={c}
        variant="default"
        getPropCode={getPropCode}
        getNames={getNamesRental}
        onEdit={onEdit}
        onPostpone={onPostpone}
        onDelete={onDelete}
      />
    );
    expect(screen.getByText(/\+ إدخال عقار/)).toBeInTheDocument();
  });
});
