import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api.ts';

interface StaffUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface CoordinatorAuthContextType {
  staffUser: StaffUser | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => void;
  error: string | null;
}

const CoordinatorAuthContext = createContext<CoordinatorAuthContextType | undefined>(undefined);

export const CoordinatorAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [staffUser, setStaffUser] = useState<StaffUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function checkAuth() {
      const token = localStorage.getItem('syntuc_staff_token');
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await api.getCoordinatorMe();
        setStaffUser(res.user);
      } catch (e) {
        localStorage.removeItem('syntuc_staff_token');
        setStaffUser(null);
      } finally {
        setLoading(false);
      }
    }
    checkAuth();
  }, []);

  const login = async (email: string, pass: string) => {
    setError(null);
    try {
      const res = await api.coordinatorLogin(email, pass);
      setStaffUser(res.user);
    } catch (err: any) {
      setError(err.message || 'Login failed');
      throw err;
    }
  };

  const logout = () => {
    localStorage.removeItem('syntuc_staff_token');
    setStaffUser(null);
  };

  return (
    <CoordinatorAuthContext.Provider
      value={{
        staffUser,
        isAuthenticated: Boolean(staffUser),
        loading,
        login,
        logout,
        error,
      }}
    >
      {children}
    </CoordinatorAuthContext.Provider>
  );
};

export const useCoordinatorAuth = () => {
  const context = useContext(CoordinatorAuthContext);
  if (!context) {
    throw new Error('useCoordinatorAuth must be used within CoordinatorAuthProvider');
  }
  return context;
};
