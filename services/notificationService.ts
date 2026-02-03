import apiClient from './api';
import type { Notification } from '../types/notification';

// 📦 API Response wrapper
export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
}

export class NotificationService {
  private baseUrl: string;
  private maxNotifications = 30;

  constructor() {
    this.baseUrl = '/users/notifications';
  }

  async getNotifications(): Promise<Notification[]> {
    try {
      const response = await apiClient.get<ApiResponse<Notification[]>>(this.baseUrl);
      return response.data?.data || [];
    } catch (error: any) {
      // Suppress 401 errors as they are handled globally
      if (error?.response?.status !== 401) {
        console.error('Error fetching notifications:', error);
      }
      return []; // Return empty array on any error
    }
  }

  async getUnreadCount(): Promise<number> {
    try {
      const response = await apiClient.get<ApiResponse<{ count: number }>>(`${this.baseUrl}/unread-count`);
      return response.data?.data?.count || 0;
    } catch (error: any) {
      if (error?.response?.status !== 401) {
        console.error('Error getting unread count:', error);
      }
      return 0; // Return 0 on any error
    }
  }

  async markAsRead(notificationId: number | string): Promise<void> {
    try {
      const response = await apiClient.patch<ApiResponse<void>>(
        `${this.baseUrl}/${notificationId}/read`
      );
      if (!response.data?.success) {
        throw new Error(response.data?.message || 'Failed to mark notification as read');
      }
    } catch (error: any) {
      if (error?.response?.status !== 401) {
        console.error('Error marking notification as read:', error);
      }
      // Don't throw, just log the error
    }
  }

  async markAllAsRead(): Promise<void> {
    try {
      const response = await apiClient.patch<ApiResponse<void>>(`${this.baseUrl}/mark-all-read`);
      if (!response.data?.success) {
        throw new Error(response.data?.message || 'Failed to mark all notifications as read');
      }
    } catch (error: any) {
      if (error?.response?.status !== 401) {
        console.error('Error marking all notifications as read:', error);
      }
      // Don't throw, just log the error
    }
  }

  async deleteNotification(notificationId: number): Promise<void> {
    try {
      const response = await apiClient.delete<ApiResponse<void>>(`${this.baseUrl}/${notificationId}`);
      if (!response.data?.success) {
        throw new Error(response.data?.message || 'Failed to delete notification');
      }
    } catch (error: any) {
      if (error?.response?.status !== 401) {
        console.error('Error deleting notification:', error);
      }
      // Don't throw, just log the error
    }
  }

  /**
   * Check whether the current user (or a specific role) has upcoming sessions.
   * Some backend endpoints support detecting the role from the token; others
   * accept an optional userType query param. We expose an optional userType here
   * to improve compatibility with both styles.
   */
  async hasUpcomingSessions(userType?: 'tutor' | 'tutee'): Promise<boolean> {
    try {
      const url = `${this.baseUrl}/upcoming-sessions`;
      const response = await apiClient.get<ApiResponse<{ hasUpcoming: boolean }>>(url, {
        params: userType ? { userType } : undefined
      });
      return response.data?.data?.hasUpcoming || false;
    } catch (error: any) {
      if (error?.response?.status !== 401) {
        console.error('Error checking upcoming sessions:', error);
      }
      return false; // Return false on any error
    }
  }
}

export const notificationService = new NotificationService();
