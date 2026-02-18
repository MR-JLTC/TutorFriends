import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../../context/NotificationContext';
import { BsBell, BsBellFill } from 'react-icons/bs';
import { Notification } from '../../types/notification';

export const NotificationBell: React.FC = () => {
  const { notifications, unreadCount, markAsRead, isLoading, refreshNotifications } = useNotifications();
  // Hide upcoming-session notifications from the header bell — they are shown
  // in-page via the UpcomingSessions component in the dashboard layouts.
  const visibleNotifications = notifications.filter(n => n.type !== 'upcoming_session');
  const visibleUnreadCount = visibleNotifications.filter(n => !n.is_read).length;
  const [showNotifications, setShowNotifications] = useState(false);
  const navigate = useNavigate();

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  return (
    <div className="relative">
      <button
        className="p-1.5 sm:p-2 hover:bg-gray-100 active:bg-gray-200 rounded-full relative transition-colors touch-manipulation"
        onClick={async () => {
          const next = !showNotifications;
          setShowNotifications(next);
          if (next) {
            await refreshNotifications();
          }
        }}
        style={{ WebkitTapHighlightColor: 'transparent' }}
        aria-label={`Notifications${visibleUnreadCount > 0 ? ` (${visibleUnreadCount} unread)` : ''}`}
      >
        {visibleUnreadCount > 0 ? <BsBellFill className="text-blue-500 w-5 h-5 sm:w-6 sm:h-6" /> : <BsBell className="w-5 h-5 sm:w-6 sm:h-6" />}
        {visibleUnreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 sm:-top-1 sm:-right-1 bg-red-500 text-white rounded-full w-4 h-4 sm:w-5 sm:h-5 text-[10px] sm:text-xs flex items-center justify-center animate-pulse font-semibold">
            {visibleUnreadCount > 9 ? '9+' : visibleUnreadCount}
          </span>
        )}
        {visibleNotifications.some(n => !n.is_read && n.type === 'payment') && (
          <span className="absolute bottom-0 left-0 w-2.5 h-2.5 sm:w-3 sm:h-3 bg-yellow-500 border-2 border-white rounded-full animate-pulse"></span>
        )}
      </button>

      {showNotifications && (
        <>
          {/* Mobile overlay */}
          <div
            className="fixed inset-0 bg-black bg-opacity-30 z-40 sm:hidden"
            onClick={() => setShowNotifications(false)}
          />
          <div className="fixed sm:absolute right-0 sm:right-0 top-14 sm:top-auto sm:mt-2 w-full sm:w-80 max-w-full sm:max-w-sm bg-white rounded-t-2xl sm:rounded-lg shadow-xl border border-gray-200 z-50 max-h-[calc(100vh-3.5rem)] sm:max-h-[400px] flex flex-col">
            <div className="p-4 sm:p-4 flex-shrink-0 border-b border-gray-200 bg-gradient-to-r from-slate-50 to-white">
              <div className="flex items-center justify-between">
                <h3 className="text-lg sm:text-lg font-bold text-slate-800">Notifications</h3>
                <button
                  onClick={() => setShowNotifications(false)}
                  className="p-2 rounded-lg hover:bg-gray-100 active:bg-gray-200 text-gray-500 touch-manipulation transition-colors"
                  aria-label="Close notifications"
                  style={{ WebkitTapHighlightColor: 'transparent' }}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="overflow-y-auto flex-1 min-h-0">
              {visibleNotifications.some(n => !n.is_read && n.type === 'payment') && (
                <div className="mb-3 p-3 sm:p-3 bg-yellow-50 border-l-4 border-yellow-400 rounded-r-lg mx-3 sm:mx-4">
                  <p className="text-sm sm:text-sm text-yellow-800 font-semibold">
                    You have pending payment notifications
                  </p>
                </div>
              )}
              {isLoading ? (
                <div className="animate-pulse space-y-3 sm:space-y-4 px-4 sm:px-4 pb-4 sm:pb-4">
                  <div className="h-20 sm:h-20 bg-gray-200 rounded-lg"></div>
                  <div className="h-20 sm:h-20 bg-gray-200 rounded-lg"></div>
                </div>
              ) : visibleNotifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 sm:py-12 px-4">
                  <BsBell className="w-12 h-12 sm:w-12 sm:h-12 text-gray-300 mb-3" />
                  <p className="text-sm sm:text-base text-gray-500 font-medium">No notifications</p>
                </div>
              ) : (
                <div className="space-y-3 sm:space-y-3 px-4 sm:px-4 pb-4 sm:pb-4">
                  {visibleNotifications.map((notification: Notification) => (
                    <div
                      key={notification.notification_id}
                      className={`p-3 sm:p-3 rounded-xl border ${notification.is_read
                        ? 'bg-white border-gray-200'
                        : notification.type === 'payment'
                          ? 'bg-yellow-50 border-yellow-300'
                          : 'bg-blue-50 border-blue-200'
                        } shadow-sm`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start gap-2">
                            {notification.type === 'payment' && !notification.is_read && (
                              <span className="inline-flex items-center justify-center w-2 h-2 sm:w-2 sm:h-2 mt-1.5 bg-red-500 rounded-full animate-pulse flex-shrink-0"></span>
                            )}
                            <p className="text-sm sm:text-sm font-semibold text-gray-900 break-words leading-relaxed">
                              {notification.message}
                            </p>
                          </div>
                          {notification.metadata?.session_date && (
                            <p className="text-xs sm:text-xs text-gray-600 mt-2 break-words">
                              <span className="font-medium">Session:</span> {new Date(notification.metadata.session_date).toLocaleDateString()}
                              {notification.metadata.session_time && ` at ${notification.metadata.session_time}`}
                            </p>
                          )}
                          <p className="text-xs sm:text-xs text-gray-500 mt-2">
                            {formatDate(notification.created_at)}
                          </p>
                        </div>
                        {notification.type === 'payment' && !notification.is_read && (
                          <span className="ml-2 px-2 sm:px-2 py-1 sm:py-1 text-xs sm:text-xs font-semibold text-yellow-800 bg-yellow-200 rounded-full whitespace-nowrap flex-shrink-0">
                            Payment
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mt-3">
                        {notification.type === 'payment' && !notification.is_read && (
                          <button
                            onClick={() => {
                              navigate('/tutee-dashboard/payment');
                              setShowNotifications(false);
                            }}
                            className="text-sm font-semibold text-white bg-gradient-to-r from-yellow-600 to-yellow-700 hover:from-yellow-700 hover:to-yellow-800 active:from-yellow-800 active:to-yellow-900 px-4 py-2.5 rounded-lg transition-all w-full sm:w-auto touch-manipulation shadow-md hover:shadow-lg"
                            style={{ WebkitTapHighlightColor: 'transparent' }}
                          >
                            Go to Payment
                          </button>
                        )}
                        {!notification.is_read && (
                          <button
                            onClick={() => markAsRead(notification.notification_id)}
                            className="text-xs sm:text-xs text-blue-600 hover:text-blue-700 active:text-blue-800 font-medium text-left sm:text-center touch-manipulation py-2 sm:py-0"
                            style={{ WebkitTapHighlightColor: 'transparent' }}
                          >
                            Mark as read
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};