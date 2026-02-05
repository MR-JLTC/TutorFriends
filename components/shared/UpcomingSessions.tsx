import React from 'react';
import { useNotifications } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';
import { Bell } from 'lucide-react';

interface UpcomingSessionsProps {
  className?: string;
}

const UpcomingSessions: React.FC<UpcomingSessionsProps> = ({ className = '' }) => {
  const { notifications, isLoading } = useNotifications();
  const { user: authUser } = useAuth();
  const role = authUser?.role;

  // Filter only upcoming session notifications and sort by date
  const upcomingSessions = notifications
    .filter(n => n.type === 'upcoming_session' && n.metadata?.session_date)
    .sort((a, b) => {
      const dateA = new Date(a.metadata!.session_date!).getTime();
      const dateB = new Date(b.metadata!.session_date!).getTime();
      return dateA - dateB;
    });

  if (isLoading) {
    return (
      <div className={`bg-white rounded-xl shadow-lg border border-slate-200 p-4 sm:p-6 ${className}`}>
        <div className="flex items-center gap-2 mb-4">
          <div className="h-8 w-8 bg-blue-100 rounded-lg animate-pulse" />
          <div className="h-6 w-32 bg-slate-200 rounded animate-pulse" />
        </div>
        <div className="space-y-4">
          <div className="h-24 bg-slate-50 rounded-xl animate-pulse" />
          <div className="h-24 bg-slate-50 rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-xl shadow-lg border border-slate-200 p-4 sm:p-6 ${className}`}>
      <div className="flex items-center gap-2 mb-6">
        <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
          <Bell className="h-5 w-5" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Upcoming Sessions</h2>
      </div>

      {upcomingSessions.length === 0 ? (
        <div className="text-center py-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-slate-100 rounded-full mb-3">
            <Bell className="h-6 w-6 text-slate-400" />
          </div>
          <p className="text-slate-500 font-medium">No upcoming sessions scheduled</p>
        </div>
      ) : (
        <div className="space-y-3">
          {upcomingSessions.map((session) => (
            <div
              key={session.notification_id}
              className="relative group bg-white border border-slate-200 rounded-xl p-4 hover:border-blue-300 hover:shadow-md transition-all duration-300"
            >
              {/* Status Indicator Bar */}
              <div className="absolute left-0 top-4 bottom-4 w-1 bg-gradient-to-b from-blue-500 to-indigo-500 rounded-r-full" />

              {/* Unread Dot */}
              {!session.is_read && (
                <span className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full animate-pulse ring-2 ring-white" />
              )}

              <div className="pl-3">
                <h3 className="text-base font-bold text-slate-900 mb-2 truncate pr-4">
                  {session.metadata?.subject || 'Untitled Session'}
                </h3>

                <div className="space-y-2">
                  {/* User Info */}
                  <div className="flex items-center text-sm text-slate-600">
                    <div className="w-5 flex-shrink-0 flex justify-center mr-2">
                      <User className="h-4 w-4 text-indigo-500" />
                    </div>
                    <span>
                      {role === 'tutor'
                        ? (session.metadata?.student_name ? `Student: ${session.metadata.student_name}` : 'Student')
                        : (session.metadata?.tutor_name ? `Tutor: ${session.metadata.tutor_name}` : 'Tutor')}
                    </span>
                  </div>

                  {/* Date Info */}
                  <div className="flex items-center text-sm text-slate-600">
                    <div className="w-5 flex-shrink-0 flex justify-center mr-2">
                      <Calendar className="h-4 w-4 text-blue-500" />
                    </div>
                    <span>
                      {new Date(session.metadata!.session_date!).toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </span>
                  </div>

                  {/* Time Info */}
                  {session.metadata?.session_time && (
                    <div className="flex items-center text-sm text-slate-600">
                      <div className="w-5 flex-shrink-0 flex justify-center mr-2">
                        <Clock className="h-4 w-4 text-emerald-500" />
                      </div>
                      <span>{session.metadata.session_time}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default UpcomingSessions;