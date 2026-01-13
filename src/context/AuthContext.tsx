import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { المستخدمين_tbl } from '@/types';
import { DbService } from '@/services';
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
  const timerRef = useRef<any>(null);

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

  const logout = () => {
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('khaberni_user');
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  const login = async (username: string, password: string) => {
    try {
        const response = await DbService.authenticateUser(username, password) as any;
        if (response && response.success && response.data) {
          setUser(response.data);
          setIsAuthenticated(true);
          localStorage.setItem('khaberni_user', JSON.stringify(response.data));
          resetTimer(); // Start tracking activity
          return true;
        }
    } catch (e) {
        console.error("Login exception:", e);
    }
    return false;
  };

  const resetTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (isAuthenticated) {
        timerRef.current = setTimeout(() => {
            console.log("Auto-logging out due to inactivity");
            logout();
            notificationService.warning('تم تسجيل الخروج تلقائياً لعدم النشاط لمدة 30 دقيقة.', 'تسجيل خروج تلقائي');
        }, INACTIVITY_LIMIT);
    }
  };

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
  }, [isAuthenticated]);

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
