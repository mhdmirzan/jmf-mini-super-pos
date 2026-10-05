import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authService } from '../services/api';
import type { User, UserRole } from '../types';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  hasRole: (...roles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing session on mount
  useEffect(() => {
    const storedUserId = localStorage.getItem('pos_user_id');
    if (storedUserId) {
      authService.verify(storedUserId).then((result: any) => {
        if (result.success) {
          setUser(result.user);
        } else {
          localStorage.removeItem('pos_user_id');
        }
        setIsLoading(false);
      });
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const result = await authService.login(username, password);
    if (result.success) {
      setUser(result.user);
      localStorage.setItem('pos_user_id', result.user.id);
      return { success: true };
    }
    return { success: false, error: result.error };
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem('pos_user_id');
  }, []);

  const hasRole = useCallback((...roles: UserRole[]) => {
    if (!user) return false;
    const current = (user.role || '').toUpperCase();
    if (current === 'SUPER_ADMIN') return true;
    return roles.map((r) => String(r).toUpperCase()).includes(current);
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
