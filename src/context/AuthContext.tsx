import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import axios from 'axios';
import { message } from 'antd';

interface AuthContextType {
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:4500';

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => {
    // Initialize token from localStorage
    return localStorage.getItem('token');
  });
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    // Initialize authentication state from localStorage
    return !!localStorage.getItem('token');
  });

  useEffect(() => {
    // Update isAuthenticated when token changes
    setIsAuthenticated(!!token);
  }, [token]);

  const login = async (email: string, password: string): Promise<void> => {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/auth/login`, {
        email,
        password,
      });

      const { token: newToken } = response.data;
      
      // Store token in localStorage
      localStorage.setItem('token', newToken);
      setToken(newToken);
      setIsAuthenticated(true);
    } catch (error: any) {
      console.error('Login error:', error);
      const msg = error.response?.data?.message || 'Login failed';
      // Show toast on every login error
      message.error(msg);
      throw new Error(msg);
    }
  };

  const logout = (): void => {
    // Remove token from localStorage
    localStorage.removeItem('token');
    setToken(null);
    setIsAuthenticated(false);
  };

  const value: AuthContextType = {
    token,
    isAuthenticated,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

