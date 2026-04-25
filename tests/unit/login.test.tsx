import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { Login } from '@/pages/Login';
import { useAuth } from '@/context/AuthContext';
import { useActivation } from '@/context/ActivationContext';
import { useToast } from '@/context/ToastContext';
import { ROUTE_PATHS } from '@/routes/paths';

// Mock dependencies
jest.mock('@/utils/env', () => ({
  getEnv: (key: string, fallback: string) => fallback,
  isDev: () => true,
}));

jest.mock('@/context/AuthContext');
jest.mock('@/context/ActivationContext');
jest.mock('@/context/ToastContext');
jest.mock('@/hooks/useAppDialogs', () => ({
  useAppDialogs: () => ({
    confirm: jest.fn(),
    alert: jest.fn(),
    prompt: jest.fn(),
  })
}));

// Mock package.json
jest.mock('../../package.json', () => ({
  version: '3.3.27'
}), { virtual: true });

describe('Login Page Component', () => {
  const mockLogin = jest.fn();
  const mockToast = { success: jest.fn(), error: jest.fn(), info: jest.fn() };
  const mockActivation = { 
    isActivated: true, 
    loading: false, 
    checkStatus: jest.fn(),
    activatedAt: '2025-01-01T10:00:00Z',
    deviceId: 'MOCK-HWID-123',
    refresh: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({ login: mockLogin });
    (useActivation as jest.Mock).mockReturnValue(mockActivation);
    (useToast as jest.Mock).mockReturnValue(mockToast);
    
    // Mock window.desktopDb
    (window as any).desktopDb = {
      getDeviceId: jest.fn().mockResolvedValue('MOCK-HWID-123'),
      getSystemUsers: jest.fn().mockResolvedValue([{ id: '1' }]),
      sqlGetSettings: jest.fn().mockResolvedValue({}),
      onRemoteUpdate: jest.fn(() => () => {}),
      get: jest.fn().mockResolvedValue(JSON.stringify([{ id: '1' }])), 
      set: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
      keys: jest.fn().mockResolvedValue(['db_users']),
    };
  });

  test('renders login page with professional branding', async () => {
    await act(async () => {
      render(<Login />);
    });
    expect(screen.getByText(/نظام أزرار/)).toBeInTheDocument();
  });

  test('displays activation status in the new sidebar', async () => {
    await act(async () => {
      render(<Login />);
    });
    expect(screen.getByText('حالة النظام')).toBeInTheDocument();
  });

  test('shows registration form for first-time setup', async () => {
    (window as any).desktopDb.get.mockResolvedValue(JSON.stringify([]));
    
    await act(async () => {
      render(<Login />);
    });

    await waitFor(() => {
      expect(screen.getByText(/إعداد حساب السوبر أدمن/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/إعداد حساب السوبر أدمن/));
    expect(screen.getByText('إنشاء حساب المدير')).toBeInTheDocument();
  });

  test('validates login fields and shows error alert', async () => {
    await act(async () => {
      render(<Login />);
    });

    const submitBtn = screen.getByRole('button', { name: /دخول للنظام/ });
    fireEvent.change(screen.getByPlaceholderText('admin'), { target: { value: 'wrong' } });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'wrong' } });

    mockLogin.mockResolvedValue(false);

    await act(async () => {
      fireEvent.click(submitBtn);
    });

    await waitFor(() => {
      expect(screen.getByText(/اسم المستخدم أو كلمة المرور/)).toBeInTheDocument();
    });
  });

  test('redirects to welcome page on successful login', async () => {
    mockLogin.mockResolvedValue(true);
    
    const mockReplace = jest.fn();
    const originalLocation = window.location;

    // Minimal location mock
    delete (window as any).location;
    window.location = {
      replace: mockReplace,
      href: 'http://localhost/',
    } as any;

    await act(async () => {
      render(<Login />);
    });

    fireEvent.change(screen.getByPlaceholderText('admin'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'password' } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /دخول للنظام/ }));
    });

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalled();
      expect(mockReplace.mock.calls[0][0]).toContain(ROUTE_PATHS.WELCOME);
    }, { timeout: 4000 });

    // Restore
    window.location = originalLocation;
  });
});
