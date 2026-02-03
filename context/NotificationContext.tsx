import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '../components/ui/Toast';
import { notificationService } from '../services/notificationService';
import { Notification } from '../types/index';
import { useAuth } from './AuthContext';
import { getActiveToken } from '../utils/authRole';

interface NotificationContextState {
  notifications: Notification[];
  unreadCount: number;
  hasUpcomingSessions: boolean;
  isLoading: boolean;
  error: string | null;
}

interface NotificationContextType extends NotificationContextState {
  markAsRead: (notificationId: number | string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (notificationId: number) => Promise<void>;
  refreshNotifications: () => Promise<void>;
}

const initialState: NotificationContextState = {
  notifications: [],
  unreadCount: 0,
  hasUpcomingSessions: false,
  isLoading: true,
  error: null
};

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<NotificationContextState>(initialState);
  const { notify } = useToast();
  const { user: authUser } = useAuth();
  const activeUserIdRef = useRef<number | null>(null);
  const lastSettledUserIdRef = useRef<number | null>(null);

  const refreshNotifications = useCallback(async () => {
    // Only proceed if we have a token AND an authenticated user in state
    const token = getActiveToken();
    const currentUserId = authUser?.user_id ?? null;
    const currentRole = authUser?.role;

    // Strict check: both token (storage) and user (state) must exist
    if (!token || !currentUserId || !authUser) {
      activeUserIdRef.current = null;
      lastSettledUserIdRef.current = null;
      setState(prev => ({
        ...initialState,
        isLoading: false,
        error: null
      }));
      return;
    }

    const isNewUser = lastSettledUserIdRef.current !== currentUserId;
    activeUserIdRef.current = currentUserId;

    try {
      setState(prev => (
        isNewUser
          ? {
            ...initialState,
            isLoading: true,
            error: null
          }
          : { ...prev, isLoading: true, error: null }
      ));

      // Each service method now handles its own errors and returns safe defaults
      // Pass user role when checking upcoming sessions to ensure the backend
      // can return role-specific upcoming session info when supported.
      const userType = currentRole === 'tutor' || currentRole === 'tutee' ? currentRole : undefined;

      const [notifs, count, upcomingSessions] = await Promise.all([
        notificationService.getNotifications(),
        notificationService.getUnreadCount(),
        notificationService.hasUpcomingSessions(userType as any)
      ]);

      if (activeUserIdRef.current !== currentUserId) {
        return;
      }

      lastSettledUserIdRef.current = currentUserId;

      setState(prev => ({
        ...prev,
        notifications: notifs,
        unreadCount: count,
        hasUpcomingSessions: upcomingSessions,
        isLoading: false
      }));
    } catch (error) {
      console.error('Failed to refresh notifications:', error);
      if (activeUserIdRef.current !== currentUserId) {
        return;
      }
      // Keep any existing notifications but mark as not loading
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Failed to refresh notifications'
      }));
    }
  }, [authUser?.user_id, authUser?.role]);

  useEffect(() => {
    refreshNotifications();
  }, [refreshNotifications]);

  useEffect(() => {
    const onFocus = () => refreshNotifications();
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
    };
  }, [refreshNotifications]);

  // Poll for new notifications periodically while the user is authenticated.
  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null;
    let isMounted = true;

    const poll = async () => {
      // Double check active state
      if (!authUser || !getActiveToken()) return;

      await refreshNotifications();

      if (isMounted && authUser) {
        timeoutId = setTimeout(poll, 10000);
      }
    };

    if (authUser && getActiveToken()) {
      poll();
    }

    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [refreshNotifications, authUser]);

  const markAsRead = async (notificationId: number | string) => {
    try {
      await notificationService.markAsRead(notificationId);
      await refreshNotifications();
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead();
      await refreshNotifications();
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  };

  const deleteNotification = async (notificationId: number) => {
    try {
      await notificationService.deleteNotification(notificationId);
      await refreshNotifications();
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  };

  return (
    <NotificationContext.Provider
      value={{
        ...state,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        refreshNotifications
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};