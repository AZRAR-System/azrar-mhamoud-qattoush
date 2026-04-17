import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from 'react';
import { المستخدمين_tbl } from '@/types';
import { auditLog } from '@/services/auditLog';
import { buildCache } from '@/services/dbCache';

interface AuthContextType {
  user: المستخدمين_tbl | null;
  isAuthenticated: boolean;
  /** قفل الجلسة (طرفية) — التطبيق يبقى مفتوحاً */
  sessionLocked: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  lockSession: () => void;
  unlockSession: (password: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<المستخدمين_tbl | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [sessionLocked, setSessionLocked] = useState<boolean>(false);

  useEffect(() => {
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

  const lockSession = useCallback(() => {
    setSessionLocked(true);
  }, []);

  const unlockSession = useCallback(async (password: string): Promise<boolean> => {
    const u = user;
    if (!u) return false;
    const username = String(u.اسم_المستخدم || '').trim();
    if (!username || !password) return false;
    try {
      const { DbService } = await import('@/services/mockDb');
      const response = await DbService.authenticateUser(username, password);
      if (response?.success && response.data) {
        setSessionLocked(false);
        return true;
      }
    } catch (e) {
      console.error('Unlock session:', e);
    }
    return false;
  }, [user]);

  const logout = useCallback(() => {
    try {
      const uid = user ? String((user as unknown as Record<string, unknown>)?.id ?? '').trim() : '';
      auditLog.record('AUTH_LOGOUT', 'Auth', uid || undefined, 'تسجيل خروج يدوي أو تلقائي');
    } catch {
      /* ignore */
    }
    setSessionLocked(false);
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('khaberni_user');
    try {
      buildCache();
    } catch {
      /* ignore */
    }
    try {
      void window.desktopAuth?.setSessionUser(null);
    } catch {
      // ignore
    }
  }, [user]);

  const login = async (username: string, password: string) => {
    try {
      const { DbService } = await import('@/services/mockDb');
      const response = await DbService.authenticateUser(username, password);
      if (response && response.success && response.data) {
        setUser(response.data);
        setIsAuthenticated(true);
        setSessionLocked(false);
        localStorage.setItem('khaberni_user', JSON.stringify(response.data));
        try {
          const id = String((response.data as unknown as Record<string, unknown>)?.id ?? '').trim();
          if (id) void window.desktopAuth?.setSessionUser(id);
        } catch {
          // ignore
        }
        try {
          const id = String((response.data as unknown as Record<string, unknown>)?.id ?? '').trim();
          auditLog.record('AUTH_LOGIN', 'Auth', id || undefined, 'تسجيل دخول ناجح');
        } catch {
          /* ignore */
        }
        return true;
      }
    } catch (e) {
      console.error('Login exception:', e);
    }
    return false;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        sessionLocked,
        login,
        logout,
        lockSession,
        unlockSession,
      }}
    >
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
