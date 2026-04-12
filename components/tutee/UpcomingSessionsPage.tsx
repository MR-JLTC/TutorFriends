import React, { useState, useEffect } from 'react';
import apiClient from '../../services/api';
import Button from '../ui/Button';
import Card from '../ui/Card';
import { MessageSquare, Clock, CheckCircle, Info, CalendarClock, XCircle, CheckCircle2 } from 'lucide-react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import RescheduleModal from '../shared/RescheduleModal';
import { useAuth } from '../../hooks/useAuth';

interface Student {
  user_id: number;
  name: string;
  email: string;
}

interface BookingRequest {
  id: number;
  student: Student;
  tutor_id?: number;
  tutor_name?: string;
  subject: string;
  date: string;
  time: string;
  duration: number;
  status: 'pending' | 'accepted' | 'declined' | 'awaiting_payment' | 'confirmed' | 'completed' | 'cancelled' | 'upcoming' | 'reschedule_confirmation' | 'reschedule_approved';
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
  const { user } = useAuth();
  const [reschedulesByBooking, setReschedulesByBooking] = useState<Record<number, any[]>>({});
  const [actionLoading, setActionLoading] = useState<number | null>(null);

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

  const fetchRescheduleProposals = async (bookingIds: number[]) => {
    if (!bookingIds.length) return;
    const results: Record<number, any[]> = {};
    await Promise.all(bookingIds.map(async (id) => {
      try {
        const res = await apiClient.get(`/reschedules/booking/${id}`);
        results[id] = res.data || [];
      } catch {
        results[id] = [];
      }
    }));
    setReschedulesByBooking(results);
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
      fetchRescheduleProposals(futureSessions.map((b: BookingRequest) => b.id));
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to load upcoming sessions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUpcoming();
  }, [now]);

  const handleAcceptReschedule = async (rescheduleId: number) => {
    setActionLoading(rescheduleId);
    try {
      await apiClient.patch(`/reschedules/${rescheduleId}/accept`);
      toast.success('Reschedule accepted!');
      await fetchUpcoming();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to accept reschedule');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectReschedule = async (rescheduleId: number) => {
    setActionLoading(rescheduleId);
    try {
      await apiClient.patch(`/reschedules/${rescheduleId}/reject`);
      toast.success('Reschedule declined — session reverted to original time.');
      await fetchUpcoming();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to decline reschedule');
    } finally {
      setActionLoading(null);
    }
  };

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
                      <div className="flex flex-col">
                        <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Tutor</span>
                        <h3 className="text-lg sm:text-xl font-bold text-slate-900">{request.tutor_name || 'Your Tutor'}</h3>
                      </div>
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

                    {!(reschedulesByBooking[request.id] || []).some(p => p.status === 'pending' && p.receiver_user_id === user?.user_id) && (
                      <Button
                        variant="secondary"
                        onClick={() => { setRescheduleTarget(request); setIsRescheduleModalOpen(true); }}
                        disabled={loading}
                        className="group w-full md:w-auto relative overflow-hidden bg-gradient-to-r from-primary-500 to-primary-700 hover:from-primary-600 hover:to-primary-800 text-white border-0 rounded-xl px-5 py-2.5 text-sm font-semibold shadow-md shadow-primary-200/60 hover:shadow-lg hover:shadow-primary-300/50 flex items-center gap-2 transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Clock className="h-4 w-4 transition-transform duration-300 group-hover:rotate-12 flex-shrink-0" />
                        Reschedule
                      </Button>
                    )}
                  </div>
                </div>

                {/* Pending Reschedule Proposals from tutor */}
                {(reschedulesByBooking[request.id] || [])
                  .filter(p => p.status === 'pending' && p.receiver_user_id === user?.user_id)
                  .map(proposal => (
                    <div key={proposal.reschedule_id} className="mt-4 rounded-2xl border border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50 shadow-sm overflow-hidden">
                      {/* Header strip */}
                      <div className="flex items-center gap-3 bg-amber-100 border-b border-amber-200 px-5 py-3">
                        <div className="w-9 h-9 rounded-full bg-amber-500 flex items-center justify-center flex-shrink-0 shadow">
                          <CalendarClock className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <p className="text-base font-bold text-amber-900 leading-tight">Reschedule Proposed</p>
                          <p className="text-sm text-amber-700">
                            {proposal.proposer?.name || 'Your tutor'} wants to change the session schedule
                          </p>
                        </div>
                      </div>

                      {/* Body */}
                      <div className="px-5 py-4 space-y-4">
                        {/* Proposed & Original side-by-side */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-white border border-amber-200 rounded-xl px-4 py-3 shadow-sm">
                            <p className="text-[11px] text-amber-500 font-semibold uppercase tracking-wide mb-1">New Schedule</p>
                            <p className="text-sm font-bold text-amber-900">
                              {new Date(proposal.proposedDate).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                            </p>
                            <p className="text-sm text-amber-700 font-medium mt-0.5">{proposal.proposedTime}</p>
                          </div>
                          {proposal.originalDate && (
                            <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm">
                              <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wide mb-1">Original</p>
                              <p className="text-sm font-bold text-slate-700">
                                {new Date(proposal.originalDate).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                              </p>
                              <p className="text-sm text-slate-500 font-medium mt-0.5">{proposal.originalTime}</p>
                            </div>
                          )}
                        </div>

                        {/* Reason */}
                        {proposal.reason && (
                          <div className="bg-white border border-amber-200 rounded-xl px-4 py-3">
                            <p className="text-[11px] text-amber-500 font-semibold uppercase tracking-wide mb-1">Reason</p>
                            <p className="text-sm text-amber-800 italic leading-relaxed">&ldquo;{proposal.reason}&rdquo;</p>
                          </div>
                        )}

                        {/* Action buttons */}
                        <div className="flex gap-3 pt-1">
                          <button
                            onClick={() => handleAcceptReschedule(proposal.reschedule_id)}
                            disabled={actionLoading === proposal.reschedule_id}
                            className="flex-1 py-3 px-4 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 shadow-md shadow-green-200"
                          >
                            <CheckCircle2 className="w-5 h-5" />
                            {actionLoading === proposal.reschedule_id ? 'Processing…' : 'Accept Reschedule'}
                          </button>
                          <button
                            onClick={() => handleRejectReschedule(proposal.reschedule_id)}
                            disabled={actionLoading === proposal.reschedule_id}
                            className="flex-1 py-3 px-4 rounded-xl border-2 border-red-200 bg-white text-red-600 hover:bg-red-50 hover:border-red-300 text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                          >
                            <XCircle className="w-5 h-5" />
                            {actionLoading === proposal.reschedule_id ? 'Processing…' : 'Decline'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            ))}
          </div>
        )}
      </div>
      {isRescheduleModalOpen && rescheduleTarget && (
        <RescheduleModal
          open={isRescheduleModalOpen}
          bookingId={rescheduleTarget.id}
          bookingContext={{
            subject: rescheduleTarget.subject,
            currentDate: rescheduleTarget.date,
            currentTime: rescheduleTarget.time,
            currentDuration: rescheduleTarget.duration,
            tutorId: rescheduleTarget.tutor_id,
          }}
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
