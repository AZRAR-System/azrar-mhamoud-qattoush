import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useRef,
  useCallback,
} from 'react';
import { المستخدمين_tbl } from '@/types';
import { notificationService } from '@/services/notificationService';

interface AuthContextType {
  user: المستخدمين_tbl | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<المستخدمين_tbl | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Inactivity limit in milliseconds (30 minutes)
  const INACTIVITY_LIMIT = 30 * 60 * 1000;

  useEffect(() => {
    // Check for persisted session (simplified)
    const storedUser = localStorage.getItem('khaberni_user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
        setIsAuthenticated(true);
      } catch {
        localStorage.removeItem('khaberni_user');
      }
    }
  }, []);

  useEffect(() => {
    try {
      const id = user ? String((user as unknown as Record<string, unknown>)?.id ?? '').trim() : '';
      void window.desktopAuth?.setSessionUser(id || null);
    } catch {
      // ignore
    }
  }, [user]);

  const logout = useCallback(() => {
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('khaberni_user');
    try {
      void window.desktopAuth?.setSessionUser(null);
    } catch {
      // ignore
    }
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const login = async (username: string, password: string) => {
    try {
      const { DbService } = await import('@/services/mockDb');
      const response = await DbService.authenticateUser(username, password);
      if (response && response.success && response.data) {
        setUser(response.data);
        setIsAuthenticated(true);
        localStorage.setItem('khaberni_user', JSON.stringify(response.data));
        try {
          const id = String((response.data as unknown as Record<string, unknown>)?.id ?? '').trim();
          if (id) void window.desktopAuth?.setSessionUser(id);
        } catch {
          // ignore
        }
        resetTimer(); // Start tracking activity
        return true;
      }
    } catch (e) {
      console.error('Login exception:', e);
    }
    return false;
  };

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (isAuthenticated) {
      timerRef.current = setTimeout(() => {
        console.warn('Auto-logging out due to inactivity');
        logout();
        notificationService.warning(
          'تم تسجيل الخروج تلقائياً لعدم النشاط لمدة 30 دقيقة.',
          'تسجيل خروج تلقائي'
        );
      }, INACTIVITY_LIMIT);
    }
  }, [INACTIVITY_LIMIT, isAuthenticated, logout]);

  // Activity Listeners
  useEffect(() => {
    if (!isAuthenticated) return;

    const handleActivity = () => resetTimer();

    // Events to track
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('scroll', handleActivity);
    window.addEventListener('click', handleActivity);

    // Initial start
    resetTimer();

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('scroll', handleActivity);
      window.removeEventListener('click', handleActivity);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isAuthenticated, resetTimer]);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
