import React, { useState, useEffect } from 'react';
import apiClient from '../../services/api';
import Button from '../ui/Button';
import Card from '../ui/Card';
import { MessageSquare, Clock, CheckCircle, X, AlertCircle } from 'lucide-react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import RescheduleModal from './RescheduleModal';

interface Student {
  user_id: number;
  name: string;
  email: string;
}

interface BookingRequest {
  id: number;
  student: Student;
  subject: string;
  date: string;
  time: string;
  duration: number;
  status: 'pending' | 'accepted' | 'declined' | 'awaiting_payment' | 'confirmed' | 'completed' | 'cancelled' | 'upcoming';
  payment_proof?: string;
  student_notes?: string;
  created_at: string;
}

const UpcomingSessionsPage: React.FC = () => {
  const [bookingRequests, setBookingRequests] = useState<BookingRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [isRescheduleModalOpen, setIsRescheduleModalOpen] = useState(false);
  const [rescheduleTarget, setRescheduleTarget] = useState<BookingRequest | null>(null);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const parseSessionStart = (dateStr: string, timeStr: string): Date | null => {
    if (!dateStr || !timeStr) return null;
    let sessionDate = new Date(`${dateStr.split('T')[0]}T${timeStr}`);
    if (!isNaN(sessionDate.getTime())) return sessionDate;
    sessionDate = new Date(dateStr);
    if (isNaN(sessionDate.getTime())) return null;
    const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?/i);
    if (timeMatch) {
      let hours = parseInt(timeMatch[1], 10);
      const minutes = parseInt(timeMatch[2], 10);
      const ampm = timeMatch[3];
      if (ampm && ampm.toLowerCase() === 'pm' && hours < 12) hours += 12;
      if (ampm && ampm.toLowerCase() === 'am' && hours === 12) hours = 0;
      sessionDate.setHours(hours, minutes, 0, 0);
    }
    return sessionDate;
  };

  const fetchUpcoming = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/users/upcoming-sessions/list');
      const allUpcoming = res.data?.data || [];
      const futureSessions = allUpcoming.filter((b: BookingRequest) => {
        const start = parseSessionStart(b.date, b.time);
        return start && start > now;
      });
      setBookingRequests(futureSessions);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to load upcoming sessions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUpcoming();
  }, [now]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'text-green-600 bg-green-50 border-green-200';
      case 'upcoming': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmed': return <CheckCircle className="h-4 w-4" />;
      case 'upcoming': return <Clock className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-3 sm:space-y-4 md:space-y-6">
      <ToastContainer />
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl sm:rounded-2xl p-3 sm:p-4 md:p-6 text-white shadow-lg -mx-2 sm:-mx-3 md:mx-0">
        <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
          <MessageSquare className="h-5 w-5 sm:h-6 sm:w-6 md:h-8 md:w-8 flex-shrink-0" />
          <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-white">Upcoming Sessions</h1>
        </div>
        <p className="text-xs sm:text-sm md:text-base lg:text-lg text-blue-100/90 leading-relaxed">
          Manage and mark your upcoming sessions
        </p>
      </div>
      <div className="space-y-4 md:space-y-6">
        {bookingRequests.length === 0 ? (
          <Card className="p-8 sm:p-12 text-center bg-white border-slate-100 shadow-sm rounded-2xl">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-50 rounded-full mb-4 border border-slate-100">
              <MessageSquare className="h-8 w-8 text-slate-300" />
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-slate-900 mb-2">No upcoming sessions</h3>
            <p className="text-slate-500 max-w-sm mx-auto">You have no upcoming sessions scheduled at the moment.</p>
          </Card>
        ) : (
          <div className="grid gap-4 sm:gap-6">
            {bookingRequests.map(request => (
              <div
                key={request.id}
                className="group relative bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 hover:border-blue-300 hover:shadow-lg transition-all duration-300 overflow-hidden"
              >
                {/* Status Indicator Bar */}
                <div className="absolute left-0 top-6 bottom-6 w-1 bg-gradient-to-b from-blue-500 to-indigo-500 rounded-r-full" />

                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 sm:gap-6 pl-3">
                  <div className="flex-1 space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-lg sm:text-xl font-bold text-slate-900">{request.student?.name || 'Student'}</h3>
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(request.status)}`}>
                        {getStatusIcon(request.status)}
                        <span>{request.status.replace('_', ' ').charAt(0).toUpperCase() + request.status.replace('_', ' ').slice(1)}</span>
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-6 text-sm text-slate-600">
                      <div className="flex items-center gap-2">
                        <div className="w-5 flex justify-center"><MessageSquare className="h-4 w-4 text-slate-400" /></div>
                        <span className="font-medium text-slate-900">{request.subject}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-5 flex justify-center"><Clock className="h-4 w-4 text-emerald-500" /></div>
                        <span>{request.duration} hours</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-5 flex justify-center"><Clock className="h-4 w-4 text-blue-500" /></div>
                        <span className="capitalize">{new Date(request.date).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-5 flex justify-center"><Clock className="h-4 w-4 text-indigo-500" /></div>
                        <span>{request.time}</span>
                      </div>
                    </div>

                    {request.student_notes && (
                      <div className="relative bg-slate-50 rounded-xl p-3 sm:p-4 mt-2">
                        <p className="text-sm text-slate-600 italic">
                          <span className="font-semibold text-slate-500 not-italic uppercase text-xs tracking-wide block mb-1">Notes</span>
                          "{request.student_notes}"
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Actions Column */}
                  <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-start gap-4 pt-4 md:pt-0 border-t md:border-t-0 border-slate-100">
                    <div className="text-xs font-medium text-slate-400">
                      Requested {new Date(request.created_at).toLocaleDateString()}
                    </div>

                    <Button
                      variant="secondary"
                      onClick={() => { setRescheduleTarget(request); setIsRescheduleModalOpen(true); }}
                      disabled={loading}
                      className="w-full md:w-auto bg-white border-slate-200 text-slate-700 hover:border-blue-300 hover:text-blue-600 shadow-sm"
                    >
                      <Clock className="h-4 w-4 mr-2" />
                      Reschedule
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {isRescheduleModalOpen && rescheduleTarget && (
        <RescheduleModal
          open={isRescheduleModalOpen}
          bookingId={rescheduleTarget.id}
          onClose={() => { setIsRescheduleModalOpen(false); setRescheduleTarget(null); }}
          onSuccess={() => {
            setIsRescheduleModalOpen(false);
            setRescheduleTarget(null);
            fetchUpcoming();
          }}
        />
      )}
    </div>
  );
}

export default UpcomingSessionsPage;
