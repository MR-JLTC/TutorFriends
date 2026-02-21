import React, { useEffect, useState } from 'react';
import { Bell, Calendar, Clock, User, BookOpen, RefreshCw, AlertCircle, CheckCircle2, XCircle, Star } from 'lucide-react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import apiClient from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import Modal from '../ui/Modal';
import Button from '../ui/Button';

interface Booking {
  id: number;
  subject: string;
  date: string;
  time: string;
  duration: number;
  status: string;
  tutee_rating?: number | null;
  tutee_comment?: string | null;
  student_notes?: string;
  tutor?: {
    user?: {
      name: string;
    };
  };
}

const TuteeMyBookings: React.FC = () => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackTarget, setFeedbackTarget] = useState<Booking | null>(null);
  const [rating, setRating] = useState<number>(5);
  const [comment, setComment] = useState<string>('');
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const init = async () => {
      await fetchBookingRequests();
    };
    init();
    // Auto-refresh more frequently and on window focus to reflect approvals quickly
    const interval = setInterval(fetchBookingRequests, 10000);
    const onFocus = () => fetchBookingRequests();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [now]); // Re-fetch when current time updates

  // Update current time every minute to check if sessions have started
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

  const hasSessionStarted = (booking: Booking): boolean => {
    const start = parseSessionStart(booking.date, booking.time);
    if (!start) return false;
    return now >= start;
  };

  const hasSessionDurationCompleted = (booking: Booking): boolean => {
    const start = parseSessionStart(booking.date, booking.time);
    if (!start) return false;
    const durationHours = booking.duration || 1.0;
    const end = new Date(start.getTime() + durationHours * 60 * 60 * 1000);
    return now >= end;
  };

  const fetchBookingRequests = async () => {
    try {
      setLoading(true);
      if (!user?.user_id) {
        throw new Error('User not found. Please log in again.');
      }

      const response = await apiClient.get('/users/me/bookings');

      // Validate response data
      if (!Array.isArray(response.data)) {
        console.error('Invalid response:', response.data);
        throw new Error('Invalid response format from server');
      }

      // Process bookings data
      const bookingsWithStatus = response.data.map((booking: any) => {
        return {
          id: booking.id || 0,
          subject: booking.subject || 'Untitled Session',
          date: booking.date || new Date().toISOString(),
          time: booking.time || '00:00',
          duration: booking.duration || 1,
          status: booking.status || 'pending',
          tutee_rating: booking.tutee_rating ?? null,
          tutee_comment: booking.tutee_comment ?? null,
          student_notes: booking.student_notes || '',
          tutor: {
            user: {
              name: booking.tutor?.user?.name || 'Unknown Tutor'
            }
          }
        };
      });

      // Filter bookings: exclude completed sessions
      const validBookings = bookingsWithStatus.filter((booking: any) => {
        const status = booking.status.toLowerCase();

        // Strictly exclude completed sessions as requested
        if (status === 'completed') {
          return false;
        }

        // Include admin_payment_pending bookings ONLY if they have a tutee_rating
        if (status === 'admin_payment_pending') {
          return booking.tutee_rating !== null && booking.tutee_rating !== undefined;
        }
        // Include upcoming bookings that have started (session start time has been reached)
        if (status === 'upcoming') {
          return hasSessionStarted(booking);
        }
        // Include all other statuses
        return true;
      });

      setBookings(validBookings);
      setError(null); // Clear any previous errors
    } catch (err: any) {
      console.error('Failed to fetch bookings:', err);
      const errorMessage = err.response?.data?.message ||
        err.message ||
        'Failed to load your bookings. Please check your connection and try again.';
      setError(errorMessage);
      toast.error(errorMessage);

      // If unauthorized, clear local storage and redirect to login
      if (err.response?.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/#/login';
      }
    } finally {
      setLoading(false);
    }
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center gap-1">
        {Array.from({ length: 5 }, (_, i) => (
          <Star
            key={i}
            className={`h-4 w-4 sm:h-5 sm:w-5 ${i < Math.floor(rating) ? 'text-yellow-400 fill-current' : 'text-slate-300'
              }`}
          />
        ))}
      </div>
    );
  };

  const getStatusDisplay = (status: string) => {
    const normalized = status.toLowerCase();
    switch (normalized) {
      case 'pending':
        return {
          color: 'bg-yellow-50 text-yellow-800 border-yellow-300',
          icon: <AlertCircle className="h-4 w-4" />,
          text: 'Pending'
        };
      case 'confirmed':
        return {
          color: 'bg-green-50 text-green-800 border-green-300',
          icon: <CheckCircle2 className="h-4 w-4" />,
          text: 'Confirmed'
        };
      case 'completed':
        return {
          color: 'bg-blue-50 text-blue-800 border-blue-300',
          icon: <CheckCircle2 className="h-4 w-4" />,
          text: 'Completed'
        };
      case 'cancelled':
        return {
          color: 'bg-red-50 text-red-800 border-red-300',
          icon: <XCircle className="h-4 w-4" />,
          text: 'Cancelled'
        };
      default:
        return {
          color: 'bg-slate-50 text-slate-800 border-slate-300',
          icon: <AlertCircle className="h-4 w-4" />,
          text: status
        };
    }
  };

  if (loading) {
    return (
      <div className="space-y-3 sm:space-y-4 md:space-y-6">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl sm:rounded-2xl p-3 sm:p-4 md:p-6 text-white shadow-lg -mx-2 sm:-mx-3 md:mx-0">
          <div className="flex items-center gap-2 sm:gap-3">
            <Bell className="h-5 w-5 sm:h-6 sm:w-6 md:h-8 md:w-8 flex-shrink-0" />
            <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-white">My Bookings</h1>
          </div>
        </div>
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg border border-slate-200 p-4 sm:p-6 -mx-2 sm:-mx-3 md:mx-0">
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-gradient-to-r from-slate-100 to-slate-50 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-3 sm:space-y-4 md:space-y-6">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl sm:rounded-2xl p-3 sm:p-4 md:p-6 text-white shadow-lg -mx-2 sm:-mx-3 md:mx-0">
          <div className="flex items-center gap-2 sm:gap-3">
            <Bell className="h-5 w-5 sm:h-6 sm:w-6 md:h-8 md:w-8 flex-shrink-0" />
            <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-white">My Bookings</h1>
          </div>
        </div>
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg border-2 border-red-200 p-4 sm:p-6 -mx-2 sm:-mx-3 md:mx-0">
          <div className="flex items-center gap-3 p-4 bg-red-50 rounded-xl">
            <AlertCircle className="h-5 w-5 sm:h-6 sm:w-6 text-red-600 flex-shrink-0" />
            <p className="text-sm sm:text-base text-red-800 font-medium">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-4 md:space-y-6">
      <ToastContainer aria-label="Notification messages" />
      {/* Header */}
      {/* <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl sm:rounded-2xl p-3 sm:p-4 md:p-6 text-white shadow-lg -mx-2 sm:-mx-3 md:mx-0">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 sm:gap-3 md:gap-0">
          <div className="flex items-center gap-2 sm:gap-3">
            <Bell className="h-5 w-5 sm:h-6 sm:w-6 md:h-8 md:w-8 flex-shrink-0" />
            <div>
              <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-white">My Bookings</h1>
              <p className="text-xs sm:text-sm md:text-base text-blue-100/90 mt-0.5 sm:mt-1">
                View and manage your tutoring session bookings
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              toast.info('Refreshing bookings...');
              fetchBookingRequests();
            }}
            className="mt-2 sm:mt-0 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-blue-600 hover:text-blue-700 active:text-blue-800 bg-white hover:bg-blue-50 active:bg-blue-100 rounded-lg sm:rounded-xl transition-all shadow-md hover:shadow-lg w-full sm:w-auto touch-manipulation flex items-center justify-center gap-2"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            <RefreshCw className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span>Refresh</span>
          </button>
        </div>
      </div> */}

      <div className="bg-white rounded-2xl md:rounded-3xl p-4 md:p-5 shadow-sm border border-slate-100 flex items-center gap-4">
        <div className="w-12 h-12 bg-indigo-50/80 rounded-xl flex items-center justify-center shrink-0">
          <RefreshCw className="h-6 w-6 text-indigo-600" />
        </div>
        <p className="text-lg md:text-xl font-bold text-slate-800 tracking-tight">
          View and manage your tutoring session bookings
        </p>
      </div>

      <div className="space-y-4 md:space-y-6">
        {bookings.length === 0 ? (
          <div className="text-center py-12 sm:py-16 px-4 bg-white rounded-xl sm:rounded-2xl shadow-lg border border-slate-200 -mx-2 sm:-mx-3 md:mx-0">
            <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 bg-slate-50 rounded-full mb-4 sm:mb-6 border border-slate-100">
              <BookOpen className="h-8 w-8 sm:h-10 sm:w-10 text-slate-300" />
            </div>
            <h3 className="text-xl sm:text-2xl font-bold text-slate-900 mb-2">No bookings yet</h3>
            <p className="text-sm sm:text-base text-slate-600 max-w-md mx-auto">
              When you book a session with a tutor, it will appear here.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:gap-6">
            {bookings.map((booking) => {
              const statusDisplay = getStatusDisplay(booking.status);
              const bookingDate = new Date(booking.date);

              return (
                <div
                  key={booking.id}
                  className="group relative bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 hover:border-blue-300 hover:shadow-lg transition-all duration-300 overflow-hidden"
                >
                  {/* Status Indicator Bar */}
                  <div className={`absolute left-0 top-6 bottom-6 w-1 rounded-r-full ${booking.status.toLowerCase() === 'completed' ? 'bg-gradient-to-b from-green-500 to-emerald-500' :
                    booking.status.toLowerCase() === 'cancelled' ? 'bg-gradient-to-b from-red-500 to-rose-500' :
                      booking.status.toLowerCase() === 'pending' ? 'bg-gradient-to-b from-yellow-500 to-amber-500' :
                        'bg-gradient-to-b from-blue-500 to-indigo-500'
                    }`} />

                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 sm:gap-6 pl-3">
                    <div className="flex-1 space-y-3">
                      {/* Header & Status */}
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                          <BookOpen className="h-5 w-5" />
                        </div>
                        <h3 className="text-lg sm:text-xl font-bold text-slate-900">{booking.subject}</h3>

                        {/* Status Badges */}
                        <div className="flex items-center gap-2">
                          {(booking.status.toLowerCase() === 'completed' || booking.status.toLowerCase() === 'admin_payment_pending') && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Completed
                            </span>
                          )}
                          {booking.status.toLowerCase() === 'upcoming' && hasSessionDurationCompleted(booking) && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-yellow-50 text-yellow-700 border border-yellow-200">
                              <Clock className="h-3.5 w-3.5" />
                              Pending Completion
                            </span>
                          )}
                          {booking.status.toLowerCase() === 'upcoming' && hasSessionStarted(booking) && !hasSessionDurationCompleted(booking) && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
                              <Clock className="h-3.5 w-3.5" />
                              Session Started
                            </span>
                          )}
                          {booking.status.toLowerCase() !== 'completed' &&
                            booking.status.toLowerCase() !== 'admin_payment_pending' &&
                            booking.status.toLowerCase() !== 'upcoming' && (
                              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${statusDisplay.color.replace('bg-', 'bg-opacity-50 bg-').replace('border-', 'border-opacity-50 border-')}`}>
                                {statusDisplay.icon}
                                {statusDisplay.text}
                              </span>
                            )}
                        </div>
                      </div>

                      {/* Details Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-y-2 gap-x-6 text-sm text-slate-600">
                        <div className="flex items-center gap-2">
                          <div className="w-5 flex justify-center"><User className="h-4 w-4 text-indigo-500" /></div>
                          <span className="font-medium text-slate-900">with {booking.tutor?.user?.name || 'Unknown Tutor'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-5 flex justify-center"><Calendar className="h-4 w-4 text-blue-500" /></div>
                          <span>{bookingDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-5 flex justify-center"><Clock className="h-4 w-4 text-emerald-500" /></div>
                          <span>{booking.time} ({booking.duration}h)</span>
                        </div>
                      </div>

                      {/* Rating Section */}
                      {booking.tutee_rating && (
                        <div className="relative bg-yellow-50/50 rounded-xl p-3 sm:p-4 mt-2 border border-yellow-100">
                          <div className="flex items-center gap-2 mb-1">
                            <Star className="h-4 w-4 text-yellow-500 fill-current" />
                            <span className="text-xs font-bold text-yellow-700 uppercase tracking-wide">Your Review</span>
                          </div>
                          <div className="flex items-center gap-2 mb-2">
                            {renderStars(booking.tutee_rating)}
                          </div>
                          {booking.tutee_comment && (
                            <p className="text-sm text-slate-600 italic">"{booking.tutee_comment}"</p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col items-end gap-2 pt-4 md:pt-0 border-t md:border-t-0 border-slate-100">
                      {(booking.status.toLowerCase() === 'completed' || booking.status.toLowerCase() === 'admin_payment_pending') && !booking.tutee_rating && (
                        <Button
                          onClick={() => { setFeedbackTarget(booking); setFeedbackOpen(true); }}
                          className="bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm text-sm"
                        >
                          <Star className="h-4 w-4 mr-1.5" />
                          Rate Session
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {/* Feedback Modal */}
      {feedbackOpen && feedbackTarget && (
        <Modal
          isOpen={true}
          onClose={() => { setFeedbackOpen(false); setFeedbackTarget(null); setRating(5); setComment(''); }}
          title="Leave feedback"
          footer={<>
            <Button
              onClick={async () => {
                try {
                  setLoading(true);
                  await apiClient.post(`/users/bookings/${feedbackTarget.id}/feedback`, { rating, comment });
                  toast.success('Feedback submitted. Admins have been notified.');
                  setFeedbackOpen(false);
                  setFeedbackTarget(null);
                  setRating(5);
                  setComment('');
                  await fetchBookingRequests();
                } catch (e: any) {
                  console.error('Failed to submit feedback', e);
                  toast.error(e?.response?.data?.message || e?.message || 'Failed to submit feedback');
                } finally { setLoading(false); }
              }}
              className="w-full sm:w-auto px-6 py-2.5 sm:py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold text-sm sm:text-base shadow-md hover:shadow-lg transition-all touch-manipulation"
              style={{ WebkitTapHighlightColor: 'transparent' }}
              disabled={loading}
            >
              {loading ? 'Submitting...' : 'Submit'}
            </Button>
            <Button
              variant="secondary"
              onClick={() => { setFeedbackOpen(false); setFeedbackTarget(null); setRating(5); setComment(''); }}
              className="w-full sm:w-auto mt-2 sm:mt-0 sm:ml-2 px-6 py-2.5 sm:py-2 border-2 border-slate-300 hover:bg-slate-50 rounded-lg font-semibold text-sm sm:text-base transition-all touch-manipulation"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              Cancel
            </Button>
          </>}
        >
          <div className="space-y-4 sm:space-y-5">
            <div>
              <label className="block text-sm sm:text-base font-semibold text-slate-800 mb-2">Rating</label>
              <select
                value={rating}
                onChange={(e) => setRating(Number(e.target.value))}
                className="w-full border-2 border-slate-300 rounded-lg px-4 py-3 text-sm sm:text-base focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all bg-white"
              >
                {[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{n} / 5</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm sm:text-base font-semibold text-slate-800 mb-2">
                Comment <span className="text-slate-500 font-normal text-xs sm:text-sm">(optional)</span>
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="w-full border-2 border-slate-300 rounded-lg px-4 py-3 text-sm sm:text-base focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all resize-none min-h-[120px] sm:min-h-[140px]"
                rows={4}
                placeholder="Share your experience with this session..."
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default TuteeMyBookings;