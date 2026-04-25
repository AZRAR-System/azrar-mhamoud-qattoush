import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { Welcome } from '@/pages/Welcome';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';

// Mock dependencies
jest.mock('@/context/AuthContext');
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: jest.fn(),
}));

jest.mock('@/components/ui/Logo', () => ({
  Logo: () => <div data-testid="mock-logo">Logo</div>
}));

describe('Welcome Page Component', () => {
  const mockNavigate = jest.fn();
  const mockUser = { 
    id: '1', 
    اسم_للعرض: 'محمود القتوش', 
    اسم_المستخدم: 'admin', 
    الدور: 'SuperAdmin', 
    isActive: true 
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({ user: mockUser });
    (useNavigate as jest.Mock).mockReturnValue(mockNavigate);
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('renders welcome message with user display name', () => {
    render(<Welcome />);
    expect(screen.getByText(/محمود القتوش/)).toBeInTheDocument();
    expect(screen.getByText(/جاري تهيئة النظام/)).toBeInTheDocument();
  });

  test('renders logo component', () => {
    render(<Welcome />);
    expect(screen.getByTestId('mock-logo')).toBeInTheDocument();
  });

  test('shows initialization steps in the UI', () => {
    render(<Welcome />);
    expect(screen.getByText('تحميل الإعدادات')).toBeInTheDocument();
    expect(screen.getByText('الاتصال بالخادم')).toBeInTheDocument();
    expect(screen.getByText('مزامنة البيانات')).toBeInTheDocument();
    expect(screen.getByText('تهيئة الواجهة')).toBeInTheDocument();
  });

  test('progresses through steps and navigates to dashboard on completion', async () => {
    render(<Welcome />);
    
    // Use runAllTimers to skip through all the setTimeouts in the loop
    await act(async () => {
      jest.runAllTimers();
    });

    // The loops in Welcome.tsx use 'await new Promise(resolve => setTimeout(resolve, 16))'
    // Total duration is 4300ms + 500ms initial + 800ms final = 5600ms
    // 5600 / 16 = ~350 iterations.
    
    for (let i = 0; i < 600; i++) {
       await act(async () => {
         jest.advanceTimersByTime(16);
       });
       // If navigate was called, we can stop
       if (mockNavigate.mock.calls.length > 0) break;
    }

    // Verify navigation was called with ROUTE_PATHS.DASHBOARD (which is '/')
    expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
  });

  test('falls back to username if display name is missing', () => {
    (useAuth as jest.Mock).mockReturnValue({ 
      user: { ...mockUser, اسم_للعرض: undefined } 
    });
    render(<Welcome />);
    expect(screen.getByText(/admin/)).toBeInTheDocument();
  });
});
