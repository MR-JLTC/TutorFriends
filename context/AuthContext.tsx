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
  // Sync initialization from storage based on current path
  const getInitialUser = () => {
    const path = typeof window !== 'undefined' ? window.location.pathname : '';
    return getActiveUser(path) as User | null;
  };

  const getInitialToken = () => {
    const path = typeof window !== 'undefined' ? window.location.pathname : '';
    return getActiveToken(path);
  };

  const [user, setUser] = useState<User | null>(getInitialUser);
  const [token, setToken] = useState<string | null>(getInitialToken);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Re-verify on mount to ensure consistency
    const currentPath = window.location.pathname;
    const resolvedRole = resolveRoleFromPath(currentPath);
    console.log('AuthProvider init:', { currentPath, resolvedRole });

    let storedUser = getActiveUser(currentPath) as User | null;
    let storedToken = getActiveToken(currentPath);

    // Fallback: If no user found for specific path/role, try generic 'user' storage
    // This prevents redirects on refresh if the role-specific key (e.g., user:tutee) is missing but the user is logged in
    if (!storedUser) {
      const rawUser = localStorage.getItem('user');
      const rawToken = localStorage.getItem('token');
      if (rawUser && rawToken) {
        try {
          storedUser = JSON.parse(rawUser);
          storedToken = rawToken;
          console.log('AuthContext: Restored user from generic storage fallback');
        } catch (e) {
          console.error('AuthContext: Failed to parse generic user storage', e);
        }
      }
    }

    if (storedUser && storedToken) {
      setUser(storedUser);
      setToken(storedToken);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const pathRole = resolveRoleFromPath(window.location.pathname);
    const storageRole = mapRoleToStorageKey(user?.role) ?? mapRoleToStorageKey(user?.user_type);
    if (pathRole) {
      setActiveRole(pathRole);
    } else if (storageRole) {
      setActiveRole(storageRole);
    }
  }, [user]);

  // Listen for global 401 unauthorized events from api.ts
  useEffect(() => {
    const handleUnauthorized = () => {
      console.log('AuthContext: Received auth:unauthorized event');
      // If we are already logged out, do nothing
      if (!user && !token) return;

      // Perform logout cleanup
      setUser(null);
      setToken(null);

      const storageRole: AuthRoleKey | null = mapRoleToStorageKey(user?.role) ?? mapRoleToStorageKey(user?.user_type);
      if (storageRole) {
        clearRoleAuth(storageRole);
        setActiveRole(null);
      }
      localStorage.removeItem('user');
      localStorage.removeItem('token');

      // Only redirect if we are not on a public page
      const currentPath = window.location.pathname.toLowerCase();
      const isPublic = currentPath.startsWith('/landing') ||
        currentPath.startsWith('/tuteeregistration') ||
        currentPath.startsWith('/tutorregistration');

      if (!isPublic) {
        navigate('/login');
      }
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => {
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
    };
  }, [user, token, navigate]);

  const handleAuthSuccess = React.useCallback((data: { user: User; accessToken: string }) => {
    // Batch state updates
    Promise.resolve().then(() => {
      // Map student user_type to tutee role
      const mappedRole = data.user.user_type === 'student' ? 'tutee' : data.user.user_type;
      const userWithRole = {
        ...data.user,
        role: data.user.role || mappedRole,
        user_type: data.user.user_type
      };
      setUser(userWithRole);
      setToken(data.accessToken);
      localStorage.setItem('user', JSON.stringify(userWithRole));
      localStorage.setItem('token', data.accessToken);
      const storageRole = mapRoleToStorageKey(userWithRole.role) ?? mapRoleToStorageKey(userWithRole.user_type);
      if (storageRole) {
        setRoleAuth(storageRole, userWithRole, data.accessToken);
      }
    });
    // Don't navigate here - let the components handle their own navigation
  }, []);  // Add empty dependency array since we don't use any external values

  const login = async (email: string, password?: string): Promise<void> => {
    try {
      const response = await apiClient.post('/auth/login', { email, password });
      const { user, accessToken } = response.data;

      // Set both user_type and role to ensure consistent admin checking
      const userWithRole = {
        ...user,
        user_type: 'admin',
        role: 'admin'
      };

      handleAuthSuccess({ user: userWithRole, accessToken });
      setActiveRole('admin');
    } catch (err: any) {
      // Toast is shown globally by axios interceptor; avoid duplicate here
      throw err;
    }
  };

  const loginTutorTutee = async (email: string, password: string, user_type?: string) => {
    console.log('AuthContext: Attempting tutor/tutee login...', { email, user_type });
    try {
      console.log('AuthContext: Making API request...');
      const response = await apiClient.post('/auth/login-tutor-tutee', { email, password, user_type });
      console.log('AuthContext: Received response:', response.data);

      if (response.data.multiple_accounts) {
        console.log('AuthContext: Multiple accounts found, returning raw response');
        return response.data;
      }

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