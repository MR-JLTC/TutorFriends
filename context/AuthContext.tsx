import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types/index';
import apiClient from '../services/api';
import { useNavigate } from 'react-router-dom';
import { mapRoleToStorageKey, setRoleAuth, getActiveUser, getActiveToken, setActiveRole, clearRoleAuth, getRoleForContext, resolveRoleFromPath } from '../utils/authRole';
import type { AuthRoleKey } from '../utils/authRole';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password?: string) => Promise<void>;
  loginTutorTutee: (email: string, password: string, user_type?: string) => Promise<string | any>;
  register: (details: { name: string; email: string; password: string; university_id?: number }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

function AuthProvider({ children }: AuthProviderProps) {
  // ... (keeping existing code)

  // ...

  const loginTutorTutee = async (email: string, password: string, user_type?: string) => {
    console.log('AuthContext: Attempting tutor/tutee login...', { email, user_type });
    try {
      console.log('AuthContext: Making API request...');
      const response = await apiClient.post('/auth/login-tutor-tutee', { email, password, user_type });
      console.log('AuthContext: Received response:', response.data);

      const { user, accessToken } = response.data;
      console.log('AuthContext: User data:', user);

      // Ensure proper role mapping for both 'student' and 'tutee' user types
      const mappedRole = user.user_type === 'student' || user.user_type === 'tutee' ? 'tutee' : user.user_type;
      console.log('AuthContext: Mapped role:', mappedRole);

      const userWithMappedRole = {
        ...user,
        role: mappedRole
      };
      console.log('AuthContext: User with mapped role:', userWithMappedRole);

      // Update AuthContext state
      setUser(userWithMappedRole);
      setToken(accessToken);
      localStorage.setItem('user', JSON.stringify(userWithMappedRole));
      localStorage.setItem('token', accessToken);
      const storageRole = mapRoleToStorageKey(userWithMappedRole.role) ?? mapRoleToStorageKey(userWithMappedRole.user_type);
      if (storageRole) {
        setRoleAuth(storageRole, userWithMappedRole, accessToken);
        setActiveRole(storageRole);
      }

      console.log('AuthContext: State updated, returning mapped role');
      return mappedRole; // Return the mapped role instead of navigating
    } catch (err: any) {
      // Toast is shown globally by axios interceptor; avoid duplicate here
      throw err;
    }
  };

  const register = async (details: { name: string; email: string; password: string; university_id?: number }) => {
    try {
      const response = await apiClient.post('/auth/register', { ...details, user_type: 'admin' });
      handleAuthSuccess(response.data);
    } catch (err: any) {
      // Toast is shown globally by axios interceptor; avoid duplicate here
      throw err;
    }
  };

  const logout = async () => {
    // If user is a tutor, set online status to offline
    if (user && (user.role === 'tutor' || user.user_type === 'tutor')) {
      try {
        await apiClient.patch(`/tutors/by-user/${user.user_id}/online-status`, { status: 'offline' });
      } catch (err) {
        console.warn('Failed to update tutor online status on logout:', err);
        // Don't block logout if this fails
      }
    }

    const storageRole: AuthRoleKey | null = mapRoleToStorageKey(user?.role) ?? mapRoleToStorageKey(user?.user_type);
    if (storageRole) {
      clearRoleAuth(storageRole);
      const currentRole = getRoleForContext();
      if (currentRole === storageRole) {
        setActiveRole(null);
      }
    }
    setUser(null);
    setToken(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    if (!storageRole) {
      setActiveRole(null);
    }
    const wasAdmin = user?.role === 'admin';
    navigate(wasAdmin ? '/admin-login' : '/login');
  };

  const value = {
    user,
    token,
    isLoading,
    login,
    loginTutorTutee,
    register,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export { AuthContext, AuthProvider };

export function useAuth() {
  const context = React.useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}