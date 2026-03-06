import React, { useState, useEffect } from 'react';
import apiClient from '../../services/api';
import Button from '../ui/Button';
import Card from '../ui/Card';
import { MessageSquare, Clock, CheckCircle, Info } from 'lucide-react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import RescheduleModal from '../shared/RescheduleModal';

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

  if (loading) {
    return (
      <div className="space-y-4 sm:space-y-4 md:space-y-6 pb-6 md:pb-10">
        <div className="bg-sky-600 from-primary-600 via-primary-700 to-primary-800 rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 text-white shadow-xl relative overflow-hidden -mx-2 sm:-mx-3 md:mx-0 border border-primary-500/30">
          <div className="absolute inset-0 opacity-20 pointer-events-none">
            <div className="absolute top-0 right-0 w-40 h-40 bg-white rounded-full -mr-20 -mt-20 blur-3xl"></div>
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-white rounded-full -ml-16 -mb-16 blur-3xl"></div>
          </div>
          <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="min-w-0 flex-1 flex items-center gap-2 bg-white/10 p-1.5 sm:p-2 rounded-lg backdrop-blur-md border border-white/20 shadow-inner">
              <div className="p-1 bg-white/20 rounded-md shadow-sm shrink-0 animate-pulse">
                <div className="h-3 w-3 sm:h-3.5 sm:w-3.5 bg-white/50 rounded-full" />
              </div>
              <div className="h-4 w-48 bg-white/30 rounded animate-pulse"></div>
            </div>
          </div>
        </div>

        <div className="space-y-4 sm:space-y-5 md:space-y-6 lg:space-y-8">
          {[1, 2].map((i) => (
            <div key={i} className="bg-gradient-to-br from-white via-primary-50/20 to-primary-100/10 rounded-xl sm:rounded-2xl md:rounded-3xl shadow-lg md:shadow-xl border-2 border-slate-200/80 p-4 sm:p-5 md:p-7 lg:p-8 -mx-2 sm:-mx-3 md:mx-0 overflow-hidden relative">
              <div className="absolute top-0 left-0 right-0 h-1 md:h-1.5 bg-slate-200 animate-pulse" />
              <div className="animate-pulse space-y-6">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div className="flex-1 space-y-4">
                    <div className="h-6 sm:h-8 bg-slate-200 rounded-lg w-3/4"></div>
                    <div className="h-4 sm:h-5 bg-slate-200 rounded-lg w-1/2"></div>
                    <div className="flex flex-wrap gap-2">
                      <div className="h-8 sm:h-10 bg-slate-200 rounded-xl w-24"></div>
                      <div className="h-8 sm:h-10 bg-slate-200 rounded-xl w-20"></div>
                      <div className="h-8 sm:h-10 bg-slate-200 rounded-xl w-24"></div>
                    </div>
                  </div>
                  <div className="h-10 sm:h-12 bg-slate-200 rounded-2xl w-32 shrink-0"></div>
                </div>
                <div className="h-24 sm:h-32 bg-slate-100 rounded-xl md:rounded-2xl border-2 border-slate-100"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-4 md:space-y-6">
      <div className="bg-sky-600 from-primary-600 via-primary-700 to-primary-800 rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 text-white shadow-xl relative overflow-hidden -mx-2 sm:-mx-3 md:mx-0 border border-primary-500/30">
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <div className="absolute top-0 right-0 w-40 h-40 bg-white rounded-full -mr-20 -mt-20 blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-white rounded-full -ml-16 -mb-16 blur-3xl"></div>
        </div>
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="min-w-0 flex-1 flex items-center gap-2 bg-white/10 p-1.5 sm:p-2 rounded-lg backdrop-blur-md border border-white/20 shadow-inner">
            <div className="p-1 bg-white/20 rounded-md shadow-sm shrink-0">
              <Info className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-white drop-shadow-md" />
            </div>
            <p className="text-xs sm:text-sm md:text-base text-white font-medium leading-snug tracking-wide text-shadow-sm">
              Manage and mark your upcoming sessions
            </p>
          </div>
        </div>
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
