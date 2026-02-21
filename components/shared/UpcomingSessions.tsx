import React from 'react';
import { useNotifications } from '../../context/NotificationContext';
import { Calendar, Clock, User } from 'lucide-react';
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
    <div className={`bg-white rounded-2xl shadow-xl border border-slate-100 p-5 sm:p-6 overflow-hidden relative ${className}`}>
      {/* Decorative background element */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-bl-full -mr-10 -mt-10 opacity-50 pointer-events-none"></div>

      <div className="flex items-center gap-3 mb-6 relative z-10">
        <div className="p-2.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl text-white shadow-lg shadow-blue-500/30">
          <Bell className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900 leading-tight">Upcoming Sessions</h2>
          <p className="text-xs text-slate-500 font-medium pt-0.5">Don't miss your schedule</p>
        </div>
      </div>

      {upcomingSessions.length === 0 ? (
        <div className="text-center py-10 relative z-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-50 rounded-full mb-4 border border-slate-100">
            <Calendar className="h-8 w-8 text-slate-300" />
          </div>
          <p className="text-slate-600 font-medium">No upcoming sessions</p>
          <p className="text-xs text-slate-400 mt-1">Book a tutor to get started!</p>
        </div>
      ) : (
        <div className="space-y-4 relative z-10">
          {upcomingSessions.map((session) => (
            <div
              key={session.notification_id}
              className="relative group bg-white border border-slate-200 rounded-2xl p-4 hover:border-blue-400 hover:shadow-lg hover:shadow-blue-500/10 transition-all duration-300"
            >
              {/* Status Indicator Pill */}
              <div className="absolute top-4 right-4">
                {!session.is_read && (
                  <span className="flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                  </span>
                )}
              </div>

              <h3 className="text-base font-bold text-slate-800 mb-3 pr-8 leading-snug">
                {session.metadata?.subject || 'Untitled Session'}
              </h3>

              <div className="space-y-2.5">
                {/* Date & Time Row */}
                <div className="flex items-center gap-3 text-sm">
                  <div className="flex items-center gap-2 text-slate-600 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100">
                    <Calendar className="h-3.5 w-3.5 text-blue-500" />
                    <span className="font-semibold">
                      {new Date(session.metadata!.session_date!).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric'
                      })}
                    </span>
                  </div>
                  {session.metadata?.session_time && (
                    <div className="flex items-center gap-2 text-slate-600 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100">
                      <Clock className="h-3.5 w-3.5 text-indigo-500" />
                      <span className="font-medium">{session.metadata.session_time}</span>
                    </div>
                  )}
                </div>

                {/* User Info Row */}
                <div className="flex items-center gap-2 text-sm text-slate-500 pl-1">
                  <User className="h-4 w-4 text-slate-400" />
                  <span>
                    {role === 'tutor' ? 'Student' : 'Tutor'}: <span className="font-semibold text-slate-700">{role === 'tutor' ? session.metadata?.student_name : session.metadata?.tutor_name}</span>
                  </span>
                </div>
              </div>

              {/* Bottom decorative line */}
              <div className="absolute bottom-0 left-4 right-4 h-[2px] bg-gradient-to-r from-blue-500/0 via-blue-500/20 to-blue-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default UpcomingSessions;