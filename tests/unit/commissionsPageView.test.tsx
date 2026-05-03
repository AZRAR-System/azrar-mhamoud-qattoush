import React from 'react';
import { render, screen } from '@testing-library/react';
import type { useCommissions } from '@/hooks/useCommissions';
import { CommissionsPageView } from '@/components/commissions/CommissionsPageView';
import type { العمولات_tbl, العمولات_الخارجية_tbl, المستخدمين_tbl } from '@/types';
import type { EmployeeCommissionRow } from '@/hooks/useCommissions';

jest.mock('@/components/commissions/CommissionsSmartFilterBar', () => ({
  CommissionsSmartFilterBar: (props: { activeTab: string }) => (
    <div data-testid="commissions-filter-bar" data-active-tab={props.activeTab}>
      filter-bar
    </div>
  ),
}));

type CommissionsPage = ReturnType<typeof useCommissions>;

const rentalCommission = (overrides: Partial<العمولات_tbl> = {}): العمولات_tbl => ({
  رقم_العمولة: 'cm-1',
  رقم_العقد: 'C-TEST-1',
  تاريخ_العقد: '2025-06-12',
  نوع_العمولة: 'Rental',
  شهر_دفع_العمولة: '2025-06',
  رقم_الفرصة: '77',
  عمولة_المالك: 60,
  عمولة_المستأجر: 40,
  المجموع: 100,
  ...overrides,
});

function createMockPage(overrides: Partial<CommissionsPage> = {}): CommissionsPage {
  const selectedMonth = overrides.selectedMonth ?? '2025-06';
  const comm = rentalCommission({ شهر_دفع_العمولة: selectedMonth });
  const renewalComm = rentalCommission({
    رقم_العمولة: 'cm-ren',
    رقم_العقد: 'C-REN-2',
    شهر_دفع_العمولة: selectedMonth,
  });

  const externalRow: العمولات_الخارجية_tbl = {
    id: 'ext-1',
    العنوان: 'عمولة استشارية',
    النوع: 'خدمات',
    التاريخ: `${selectedMonth}-05`,
    القيمة: 250,
    ملاحظات: 'ملاحظة',
  };

  const employeeRow: EmployeeCommissionRow = {
    type: 'إيجار',
    date: '2025-06-20',
    reference: 'REF-1',
    property: 'P-9',
    opportunity: '88',
    officeCommission: 300,
    tier: 'A',
    employeeBase: 100,
    intro: 10,
    employeeTotal: 110,
    ownerName: 'مالك صف',
    client: 'عميل صف',
  };

  const mockUser: المستخدمين_tbl = {
    id: 'u1',
    اسم_المستخدم: 'comm_tester',
    اسم_للعرض: 'فاحص العمولات',
    الدور: 'Admin',
    isActive: true,
  };

  const defaults: CommissionsPage = {
    activeTab: 'contracts',
    setActiveTab: jest.fn(),
    listPageSize: 10,
    employeePage: 1,
    setEmployeePage: jest.fn(),
    contractsPage: 1,
    setContractsPage: jest.fn(),
    externalPage: 1,
    setExternalPage: jest.fn(),
    commissionsForSelectedMonth: [comm],
    filteredCommissions: [comm],
    filteredRenewalCommissions: [renewalComm],
    commissionsRenewalForSelectedMonth: [renewalComm],
    renewalTotalOwner: 60,
    renewalTotalTenant: 40,
    renewalGrandTotal: 100,
    getRenewalParentContractId: jest.fn(() => 'C-PARENT-1'),
    filteredExternal: [externalRow],
    filteredEmployeeRows: [employeeRow],
    visibleEmployeeRows: [employeeRow],
    visibleContractCommissions: [comm],
    visibleExternal: [externalRow],
    employeePageCount: 1,
    contractsPageCount: 1,
    externalPageCount: 1,
    totalOwner: 60,
    totalTenant: 40,
    grandTotalContracts: 100,
    totalExternal: 250,
    employeeTotals: {
      totalOffice: 300,
      totalIntro: 10,
      totalEmployee: 110,
      count: 1,
    },
    employeeMonthSummary: {
      rentBase: 100,
      saleBase: 0,
      intro: 10,
      total: 110,
      external: 0,
      totalWithExternal: 110,
    },
    selectedMonth,
    setSelectedMonth: jest.fn(),
    searchTerm: '',
    setSearchTerm: jest.fn(),
    contractSearchTerm: '',
    setContractSearchTerm: jest.fn(),
    filterType: 'All',
    setFilterType: jest.fn(),
    systemUsers: [mockUser],
    employeeUserFilter: '',
    setEmployeeUserFilter: jest.fn(),
    isExternalModalOpen: false,
    externalModalMode: 'add',
    newExtComm: {
      التاريخ: '2025-06-01',
      العنوان: '',
      القيمة: 0,
      النوع: '',
      ملاحظات: '',
    },
    setNewExtComm: jest.fn(),
    editingExternalId: null,
    isContractModalOpen: false,
    editingContractComm: null,
    setEditingContractComm: jest.fn(),
    contractEmployeeBreakdown: null,
    handleAddExternal: jest.fn(),
    handleDeleteExternal: jest.fn(),
    openAddExternalModal: jest.fn(),
    openEditExternalModal: jest.fn(),
    closeExternalModal: jest.fn(),
    openEditContractModal: jest.fn(),
    closeContractModal: jest.fn(),
    handleSaveContractEdit: jest.fn(),
    handleDeleteContractCommission: jest.fn(),
    handlePostponeCommissionCollection: jest.fn(),
    handleExportEmployeeCsv: jest.fn(),
    handleExportEmployeeXlsx: jest.fn(),
    handleExportContractCommissionsXlsx: jest.fn(),
    getPropCode: () => 'CODE-X',
    getNames: () => ({ p1: 'مالك واجهة', p2: 'مستأجر واجهة', p3: '' }),
    availableTypes: ['خدمات'],
    user: mockUser,
    loadData: jest.fn(),
  };

  return { ...defaults, ...overrides };
}

describe('CommissionsPageView', () => {
  test('renders hero, month context ribbon, and global KPI shell', () => {
    const page = createMockPage();
    render(<CommissionsPageView page={page} />);

    expect(screen.getByText('العمولات والإيرادات')).toBeInTheDocument();
    expect(screen.getByText(/الشهر المحاسبي النشط/)).toBeInTheDocument();
    expect(screen.getByText('2025-06')).toBeInTheDocument();
    expect(screen.getByText('لوحة مقارنة سريعة')).toBeInTheDocument();
    expect(screen.getByTestId('commissions-filter-bar')).toHaveAttribute('data-active-tab', 'contracts');
  });

  test('contracts tab shows distribution shell, renewal list, and main register', () => {
    const page = createMockPage({ activeTab: 'contracts' });
    render(<CommissionsPageView page={page} />);

    expect(screen.getByText('عمولات العقود — تفكيك حسب مصدر التحصيل')).toBeInTheDocument();
    expect(screen.getByText('عمولات عقود التجديد')).toBeInTheDocument();
    expect(screen.getByText('جميع عمولات العقود للشهر')).toBeInTheDocument();
    expect(screen.getByText('تجديد')).toBeInTheDocument();
    expect(screen.getAllByText('عمولة إيجار').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('مالك واجهة').length).toBeGreaterThanOrEqual(2);
  });

  test('employee tab shows shells and logged-in username in month summary header', () => {
    const page = createMockPage({ activeTab: 'employee' });
    render(<CommissionsPageView page={page} />);

    expect(screen.getByText('ملخص العمليات والعمولات (المفلترة)')).toBeInTheDocument();
    expect(screen.getByText(/ملخص أرباح الشهر/)).toBeInTheDocument();
    expect(screen.getByText('comm_tester')).toBeInTheDocument();
    expect(screen.getByText('عمليات عمولة الموظفين')).toBeInTheDocument();
    expect(screen.getByText('إيجار')).toBeInTheDocument();
  });

  test('external tab shows summary shell, register title, and external row', () => {
    const page = createMockPage({ activeTab: 'external' });
    render(<CommissionsPageView page={page} />);

    expect(screen.getByText('ملخص العمولات الخارجية (المفلترة)')).toBeInTheDocument();
    expect(screen.getByText('سجل العمولات الخارجية')).toBeInTheDocument();
    expect(screen.getByText('عمولة استشارية')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /إضافة عمولة/ }).length).toBeGreaterThanOrEqual(1);
  });
});
