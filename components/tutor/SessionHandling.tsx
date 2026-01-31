import React, { useState, useEffect } from 'react';
import apiClient, { getFileUrl } from '../../services/api';
import Button from '../ui/Button';
import Card from '../ui/Card';
import Modal from '../ui/Modal';
import { useAuth } from '../../context/AuthContext';
import { MessageSquare, Clock, CheckCircle, X, Eye, AlertCircle, Calendar, User, FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useNavigate } from 'react-router-dom';
import ErrorBoundary from '../ErrorBoundary';
import RescheduleModal from '../shared/RescheduleModal'; // New import

interface Student {
  user_id: number;
  name: string;
  email: string;
  profile_image_url?: string;
}

interface BookingRequest {
  id: number;
  student: Student;
  subject: string;
  date: string;
  time: string;
  duration: number;
  status: 'pending' | 'accepted' | 'declined' | 'awaiting_payment' | 'awaiting_confirmation' | 'confirmed' | 'completed' | 'cancelled' | 'upcoming';
  payment_proof?: string;
  student_notes?: string;
  created_at: string;
}

const SessionHandlingContent: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tutorId, setTutorId] = useState<number | null>(null);
  const [bookingRequests, setBookingRequests] = useState<BookingRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [resolvingTutor, setResolvingTutor] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'awaiting_payment' | 'confirmed' | 'upcoming' | 'declined'>('all');
  const [isMounted, setIsMounted] = useState(true);
  const [tuteeProfile, setTuteeProfile] = useState<any | null>(null);
  const [tuteeProfileLoading, setTuteeProfileLoading] = useState(false);
  const [isTuteeModalOpen, setIsTuteeModalOpen] = useState(false);
  const [acceptConfirmOpen, setAcceptConfirmOpen] = useState(false);
  const [acceptTarget, setAcceptTarget] = useState<BookingRequest | null>(null);
  const [isRescheduleModalOpen, setIsRescheduleModalOpen] = useState(false); // New state
  const [rescheduleTarget, setRescheduleTarget] = useState<BookingRequest | null>(null); // New state
  const [now, setNow] = useState(new Date());

  // Calendar State
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    let day = new Date(year, month, 1).getDay();
    return day === 0 ? 6 : day - 1; // 0 = Mon, 6 = Sun
  };

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const isSameDay = (d1: Date, d2: Date) => {
    return d1.getDate() === d2.getDate() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getFullYear() === d2.getFullYear();
  };

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
      return sessionDate;
    }
    return null;
  };

  const hasSessionStarted = (request: BookingRequest): boolean => {
    if (request.status !== 'upcoming') return false;
    const start = parseSessionStart(request.date, request.time);
    return start ? now >= start : false;
  };

  const getSessionsOnDate = (date: Date) => {
    const sessions = bookingRequests.filter(req => {
      const reqDate = new Date(req.date);
      // Include all relevant statuses that a tutor should be aware of on the calendar
      const relevantStatuses = [
        'upcoming',
        'confirmed',
        'pending',
        'payment_approved',
        'awaiting_payment',
        'accepted',
        'completed'
      ];
      return isSameDay(reqDate, date) && relevantStatuses.includes(req.status);
    });
    // Debug logging for specific dates that have sessions
    if (sessions.length > 0) {
      // console.log(`[Calendar] Found ${sessions.length} sessions for ${date.toDateString()}:`, sessions.map(s => s.id));
    }
    return sessions;
  };

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000); // Rerender component every minute to check for overdue sessions
    return () => clearInterval(timer);
  }, []);

  // Determine if there is any unreviewed payment proof awaiting tutor action
  const hasUnreviewedPaymentProof = bookingRequests.some(
    (r) => r.status === 'awaiting_payment' && !!r.payment_proof
  );

  // Determine if there are unreviewed bookings (pending bookings that need tutor action)
  const hasUnreviewedBookings = bookingRequests.some(
    (r) => r.status === 'pending'
  );

  const resolveTutorIdAndFetch = async () => {
    if (!user?.user_id) {
      setResolveError('User information not found. Please log in again.');
      toast.error('Session missing or expired. Redirecting to login...');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      navigate('/login');
      return;
    }
    setResolvingTutor(true);
    setResolveError(null);
    try {
      console.log('Attempting to resolve tutor_id for user:', user.user_id);
      // First get the tutor_id
      const tutorRes = await apiClient.get(`/tutors/by-user/${user.user_id}/tutor-id`);
      console.log('Tutor ID response:', tutorRes.data);

      if (!tutorRes.data?.tutor_id) {
        throw new Error('⚠️ Access Restricted: Your tutor profile is not yet created. Please complete your tutor application first.');
      }

      // Try to get tutor status by user_id first; if that fails, fall back to tutor_id endpoint
      let statusRes;
      let rawStatus: any = null;
      try {
        statusRes = await apiClient.get(`/tutors/by-user/${user.user_id}/status`);
        rawStatus = statusRes.data?.status;
        console.log('Status (by-user) response:', statusRes.data);
      } catch (e) {
        console.warn('Failed to fetch status by user, will try tutor endpoint. Error:', e);
      }

      // If by-user returned nothing or a non-string, try the tutor endpoint
      if (!rawStatus && tutorRes.data?.tutor_id) {
        try {
          const alt = await apiClient.get(`/tutors/${tutorRes.data.tutor_id}/status`);
          console.log('Status (by-tutor) response:', alt.data);
          rawStatus = rawStatus || alt.data?.status;
          statusRes = statusRes || alt;
        } catch (e) {
          console.warn('Failed to fetch status by tutor id as fallback. Error:', e);
        }
      }

      // Normalize and check status
      const currentStatus = String(rawStatus || '').toLowerCase().trim();
      console.log('Resolved tutor status:', { rawStatus, currentStatus });

      if (currentStatus !== 'approved') {
        const errorMessage = '⚠️ Access Restricted: Your tutor profile is not yet approved. Click on "Application & Verification" in the sidebar menu to check your status and complete any pending requirements.';
        console.error('Access restricted:', { status: rawStatus, message: errorMessage });
        throw new Error(errorMessage);
      }

      console.log('Successfully resolved tutor_id:', tutorRes.data.tutor_id);
      if (isMounted) {
        setTutorId(tutorRes.data.tutor_id);
      }
      await fetchBookingRequests(tutorRes.data.tutor_id);
    } catch (err: any) {
      console.error('Failed to resolve tutor id for user', user.user_id, err);
      const status = err?.response?.status;
      const serverMessage = err?.response?.data?.message || err?.message;

      if (status === 401) {
        toast.error('Session expired. Redirecting to login...');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
        return;
      }

      // Handle case where tutor profile doesn't exist or isn't approved
      if (status === 404 || (serverMessage && serverMessage.includes('Tutor not found'))) {
        const message = '⚠️ Access Restricted: To manage tutoring sessions, you need to:';
        const details = [
          '1. Complete your tutor profile application',
          '2. Submit required documents',
          '3. Receive admin approval'
        ].join('\n');
        const guidance = 'Go to "Application & Verification" in the sidebar menu to check your status or complete these steps.';

        if (isMounted) {
          setResolveError(`${message}\n\n${details}\n\n${guidance}`);
        }
        toast.error(message, {
          autoClose: 7000 // Show longer to ensure readability
        });
        return;
      }

      // Generic error handling for other cases
      const friendly = serverMessage || 'Failed to load tutor information. Please try refreshing the page.';
      if (isMounted) {
        setResolveError(friendly.toString());
      }
      toast.error(friendly.toString());
    } finally {
      if (isMounted) {
        setResolvingTutor(false);
      }
    }
  };

  useEffect(() => {
    setIsMounted(true);
    resolveTutorIdAndFetch();
    return () => {
      setIsMounted(false);
    };
  }, [user]);

  const fetchBookingRequests = async (overrideTutorId?: number) => {
    const idToUse = overrideTutorId || tutorId;
    if (!idToUse) {
      console.warn('No tutor ID available for fetching bookings');
      return;
    }
    try {
      console.log('Fetching booking requests for tutor:', idToUse);
      const response = await apiClient.get(`/tutors/${idToUse}/booking-requests`);

      // Log raw response for debugging
      console.log('Raw booking response:', response.data);
      console.log('Response type:', Array.isArray(response.data) ? 'Array' : typeof response.data);
      console.log('Response length:', Array.isArray(response.data) ? response.data.length : 'N/A');

      // Handle different response formats
      let bookings = [];
      if (Array.isArray(response.data)) {
        bookings = response.data;
      } else if (Array.isArray(response.data?.data)) {
        bookings = response.data.data;
      } else if (response.data?.bookings && Array.isArray(response.data.bookings)) {
        bookings = response.data.bookings;
      }

      if (bookings.length === 0 && !Array.isArray(response.data)) {
        console.warn('Unexpected response format:', response.data);
      }

      console.log('Processed bookings:', bookings);

      // Map backend booking entity shape to the UI-friendly shape expected below
      const mapped = bookings.map(b => ({
        id: b.id,
        student: {
          user_id: b.student?.user_id || b.student?.user?.user_id,
          name: b.student?.user?.name || b.student?.name || 'Student',
          email: b.student?.user?.email || b.student?.email || '',
          profile_image_url: b.student?.user?.profile_image_url || b.student?.profile_image_url || b.student?.user?.profile_image || b.student?.profile_image || '',
        },
        subject: b.subject,
        date: b.date,
        time: b.time,
        duration: b.duration,
        status: b.status,
        payment_proof: b.payment_proof ? (b.payment_proof.startsWith('http') ? b.payment_proof : b.payment_proof) : undefined,
        student_notes: b.student_notes,
        created_at: b.created_at,
      })) as BookingRequest[];
      console.log('Mapped booking-requests:', mapped);
      if (isMounted) {
        setBookingRequests(mapped);
      }
    } catch (error: any) {
      console.error('Failed to fetch booking requests:', error);
      toast.error('Failed to load booking requests. Please check your connection and try again.');
      if (error.response?.data?.message) {
        toast.error(error.response.data.message);
      }
      if (error?.response?.status === 401) {
        toast.error('Session expired. Redirecting to login...');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
      }
    }
  };

  const handleBookingAction = async (bookingId: number, action: 'accept' | 'decline') => {
    setLoading(true);
    try {
      const response = await apiClient.post(`/tutors/booking-requests/${bookingId}/${action}`);

      if (response.data.success) {
        toast.success(`Booking ${action}ed successfully!`);
        await fetchBookingRequests();
      } else {
        throw new Error('Failed to update booking status');
      }
    } catch (error) {
      console.error(`Failed to ${action} booking:`, error);
      toast.error(`Failed to ${action} booking. Please try again.`);
      if (error.response?.data?.message) {
        toast.error(error.response.data.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentAction = async (bookingId: number, action: 'approve' | 'reject') => {
    setLoading(true);
    try {
      const response = await apiClient.post(`/tutors/booking-requests/${bookingId}/payment-${action}`);

      if (response.data.success) {
        toast.success(`Payment ${action}d successfully!`);
        await fetchBookingRequests();
      } else {
        throw new Error('Failed to update payment status');
      }
    } catch (error) {
      console.error(`Failed to ${action} payment:`, error);
      toast.error(`Failed to ${action} payment. Please check your connection and try again.`);
      if (error.response?.data?.message) {
        toast.error(error.response.data.message);
      }
    } finally {
      setLoading(false);
    }
  };



  const handleMarkDone = async (bookingId: number) => {
    setLoading(true);
    try {
      // Use the /complete endpoint without a file - it accepts optional file
      const formData = new FormData();
      formData.append('status', 'completed'); // Set status to completed

      const res = await apiClient.post(
        `/tutors/booking-requests/${bookingId}/complete`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );

      if (res.data?.success) {
        toast.success('Session marked as completed');
        await fetchBookingRequests();
      } else {
        throw new Error(res.data?.message || 'Failed to mark completed');
      }
    } catch (err: any) {
      console.error('Failed to mark session completed', err);
      toast.error(err?.response?.data?.message || err?.message || 'Failed to mark session completed');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'accepted': return 'text-primary-600 bg-primary-50 border-primary-200';
      case 'declined': return 'text-red-600 bg-red-50 border-red-200';
      case 'awaiting_payment': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'payment_approved': return 'text-primary-700 bg-primary-50 border-primary-200';
      case 'confirmed': return 'text-green-600 bg-green-50 border-green-200';
      case 'completed': return 'text-purple-600 bg-purple-50 border-purple-200';
      case 'cancelled': return 'text-slate-600 bg-slate-50 border-slate-200';
      default: return 'text-slate-600 bg-slate-50 border-slate-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="h-4 w-4" />;
      case 'accepted': return <CheckCircle className="h-4 w-4" />;
      case 'declined': return <X className="h-4 w-4" />;
      case 'awaiting_payment': return <AlertCircle className="h-4 w-4" />;
      case 'payment_approved': return <CheckCircle className="h-4 w-4" />;
      case 'confirmed': return <CheckCircle className="h-4 w-4" />;
      case 'completed': return <CheckCircle className="h-4 w-4" />;
      case 'cancelled': return <X className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  // Helper: Check if a session has ended (past its scheduled end time)
  const hasSessionEnded = (request: BookingRequest): boolean => {
    const start = parseSessionStart(request.date, request.time);
    if (!start) return false;

    const durationHours = request.duration || 1.0;
    const endTime = new Date(start.getTime() + durationHours * 60 * 60 * 1000);
    const currentTime = new Date();

    // Session has ended if current time is past the end time
    return currentTime.getTime() > endTime.getTime();
  };

  // Sort: 1) awaiting_payment with proof, 2) awaiting_payment without proof, 3) others
  // Tie-breaker: most recent first
  const priorityFor = (r: BookingRequest) => {
    if (r.status === 'awaiting_payment' && r.payment_proof) return 0;
    if (r.status === 'awaiting_payment') return 1;
    return 2;
  };
  const sortedRequests = [...bookingRequests].sort((a, b) => {
    const pa = priorityFor(a);
    const pb = priorityFor(b);
    if (pa !== pb) return pa - pb;
    const aCreated = new Date(a.created_at).getTime();
    const bCreated = new Date(b.created_at).getTime();
    return bCreated - aCreated;
  });

  const filteredRequests = sortedRequests.filter(request => {
    // Exclude sessions with status "awaiting_confirmation"
    if (request.status === 'awaiting_confirmation') {
      return false;
    }

    // Filter out sessions that have already ended (past their scheduled end time)
    // Only apply this to sessions that are scheduled (upcoming, confirmed)
    const scheduledStatuses = ['upcoming', 'confirmed'];
    if (scheduledStatuses.includes(request.status) && hasSessionEnded(request)) {
      return false;
    }

    if (selectedDate) {
      const requestDate = new Date(request.date);
      if (!isSameDay(requestDate, selectedDate)) {
        return false;
      }
    }

    if (filter === 'all') {
      // Show all requests (including declined, but excluding completed and cancelled)
      return request.status !== 'completed' && request.status !== 'cancelled';
    } else if (filter === 'upcoming') {
      const eligibleStatusesForUpcomingTab = ['upcoming', 'confirmed'];
      return eligibleStatusesForUpcomingTab.includes(request.status);
    }
    return request.status === filter;
  });

  // Helper: count upcoming sessions (status 'upcoming' or 'confirmed' and start time in the future)
  const countUpcomingSessions = () => {
    const now = new Date();
    return bookingRequests.filter(r => {
      const eligibleStatuses = ['upcoming', 'confirmed'];
      if (!eligibleStatuses.includes(r.status)) return false;
      const start = parseSessionStart(r.date, r.time);
      return start && start > now;
    }).length;
  };

  const isOverdue = (request: BookingRequest): boolean => {
    const start = parseSessionStart(request.date, request.time);
    if (!start) return false;

    const durationHours = request.duration || 1.0;
    const end = new Date(start.getTime() + durationHours * 60 * 60 * 1000);
    const currentTime = new Date();

    const eligibleStatuses = ['upcoming', 'confirmed'];
    return currentTime.getTime() > end.getTime() && eligibleStatuses.includes(request.status);
  };





  const isSessionEligibleForMarkAsDone = (r: BookingRequest) => {
    // Only show button for 'upcoming' status sessions (explicitly exclude declined, cancelled, completed)
    if (r.status !== 'upcoming') return false;

    const start = parseSessionStart(r.date, r.time);
    if (!start) return false;

    const durationHours = r.duration || 1.0;
    const end = new Date(start.getTime() + durationHours * 60 * 60 * 1000);
    const now = new Date();

    // Show button only if session duration has completed (end time has passed)
    return now >= end;
  };





  const stats = {
    total: bookingRequests.length,
    pending: bookingRequests.filter(r => r.status === 'pending').length,
    awaiting_payment: bookingRequests.filter(r => r.status === 'awaiting_payment').length,
    confirmed: bookingRequests.filter(r => r.status === 'confirmed').length,
    upcoming: countUpcomingSessions(),
  };

  return (
    <div className="space-y-3 sm:space-y-4 md:space-y-6 pb-6 sm:pb-8 md:pb-10">
      <ToastContainer aria-label="Notification messages" />
      <div className="relative overflow-hidden rounded-xl sm:rounded-2xl bg-gradient-to-r from-primary-600 via-primary-700 to-primary-900 shadow-2xl p-4 sm:p-6 md:p-8 -mx-2 sm:-mx-3 md:mx-0 transition-all duration-300">
        {/* Modern Abstract Shapes Background */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-white rounded-full blur-3xl opacity-60 animate-pulse"></div>
          <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-primary-400 rounded-full blur-3xl opacity-60"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay"></div>
        </div>

        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex-1 space-y-2">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight flex items-center gap-3 drop-shadow-md">
              <div className="p-2 sm:p-2.5 bg-white/10 rounded-xl backdrop-blur-sm border border-white/20 shadow-inner">
                <MessageSquare className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
              </div>
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-white to-primary-100">
                Session Handling
              </span>
            </h1>
            <p className="text-sm sm:text-base md:text-lg text-blue-50/90 font-medium max-w-2xl leading-relaxed pl-1">
              Seamlessly manage your tutoring requests, track sessions, and monitor payments.
            </p>
          </div>

          {/* Optional: Add a subtle action button or indicator here if needed in future */}
          {/* <div className="hidden md:block p-3 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-md">
             <span className="text-xs font-bold text-white/80 uppercase tracking-widest">Active System</span>
          </div> */}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
        <Card className="p-4 sm:p-5 md:p-6 bg-gradient-to-br from-white to-slate-50 rounded-xl sm:rounded-2xl shadow-xl border border-slate-200/50 hover:shadow-2xl transition-all duration-300">
          <div className="flex items-center">
            <div className="p-2.5 sm:p-3 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl mr-3 flex-shrink-0 shadow-lg">
              <MessageSquare className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm font-semibold text-slate-600 uppercase tracking-wide">Total Requests</p>
              <p className="text-xl sm:text-2xl md:text-3xl font-bold text-primary-700">{stats.total}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 sm:p-5 md:p-6 bg-gradient-to-br from-white to-slate-50 rounded-xl sm:rounded-2xl shadow-xl border border-slate-200/50 hover:shadow-2xl transition-all duration-300">
          <div className="flex items-center">
            <div className="p-2.5 sm:p-3 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl mr-3 flex-shrink-0 shadow-lg">
              <Clock className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm font-semibold text-slate-600 uppercase tracking-wide">Pending</p>
              <p className="text-xl sm:text-2xl md:text-3xl font-bold text-primary-700">{stats.pending}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 sm:p-5 md:p-6 bg-gradient-to-br from-white to-slate-50 rounded-xl sm:rounded-2xl shadow-xl border border-slate-200/50 hover:shadow-2xl transition-all duration-300">
          <div className="flex items-center">
            <div className="p-2.5 sm:p-3 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl mr-3 flex-shrink-0 shadow-lg">
              <AlertCircle className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm font-semibold text-slate-600 uppercase tracking-wide">Awaiting Payment</p>
              <p className="text-xl sm:text-2xl md:text-3xl font-bold text-primary-700">{stats.awaiting_payment}</p>
            </div>
          </div>
        </Card>

        {/* Upcoming widget removed from Session Handling — upcoming sessions live in the dedicated Upcoming Sessions sidebar page. */}
      </div>

      {/* Unified Filter & Calendar Section */}
      <Card className="p-4 sm:p-5 md:p-6 bg-gradient-to-br from-white to-slate-50 rounded-xl sm:rounded-2xl shadow-xl border border-slate-200/50">
        <div className="space-y-6">
          {/* Status Filter Tabs */}
          <div>
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-2">
              <span className="w-1 h-4 bg-primary-500 rounded-full"></span>
              Filter by Status
            </h3>
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'all', label: 'All Requests' },
                { key: 'pending', label: 'Pending' },
                { key: 'awaiting_payment', label: 'Awaiting Payment' },
                { key: 'confirmed', label: 'Confirmed' },
                { key: 'upcoming', label: 'Upcoming' },
                { key: 'declined', label: 'Declined' }
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setFilter(tab.key as any)}
                  className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-sm hover:shadow-md touch-manipulation ${filter === tab.key
                    ? 'bg-gradient-to-r from-primary-600 to-primary-700 text-white shadow-primary-500/30'
                    : 'text-slate-600 hover:text-slate-800 bg-white border border-slate-200 hover:border-primary-300'
                    }`}
                  style={{ WebkitTapHighlightColor: 'transparent' }}
                >
                  <span className="inline-flex items-center space-x-1 sm:space-x-1.5 md:space-x-2">
                    <span>{tab.label}</span>
                    {tab.key === 'pending' && hasUnreviewedBookings && (
                      <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-white/20 text-white border border-white/20">
                        {stats.pending}
                      </span>
                    )}
                    {tab.key === 'awaiting_payment' && hasUnreviewedPaymentProof && (
                      <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-white/20 text-white border border-white/20">
                        !
                      </span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="h-px bg-slate-200/60 w-full" />

          {/* Calendar Filter */}
          <div>
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2 mr-2">
                  <span className="w-1 h-4 bg-primary-500 rounded-full"></span>
                  Filter by Date
                </h3>
                <div className="flex gap-2 items-center bg-white border border-slate-200 rounded-lg px-2 py-1 shadow-sm">
                  <Calendar className="h-4 w-4 text-primary-500" />
                  <select
                    value={currentDate.getMonth()}
                    onChange={(e) => setCurrentDate(new Date(currentDate.getFullYear(), parseInt(e.target.value), 1))}
                    className="bg-transparent font-semibold text-slate-700 text-sm border-none focus:ring-0 cursor-pointer py-1 pr-6 pl-0"
                  >
                    {Array.from({ length: 12 }).map((_, i) => (
                      <option key={i} value={i}>
                        {new Date(2000, i, 1).toLocaleString('default', { month: 'short' })}
                      </option>
                    ))}
                  </select>
                  <select
                    value={currentDate.getFullYear()}
                    onChange={(e) => setCurrentDate(new Date(parseInt(e.target.value), currentDate.getMonth(), 1))}
                    className="bg-transparent font-semibold text-slate-700 text-sm border-none focus:ring-0 cursor-pointer py-1 pr-6 pl-0"
                  >
                    {Array.from({ length: 10 }).map((_, i) => {
                      const year = new Date().getFullYear() - 2 + i;
                      return <option key={year} value={year}>{year}</option>;
                    })}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-all border border-slate-200">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setCurrentDate(new Date())}
                  className="px-3 py-1.5 text-xs font-semibold text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-lg transition-all border border-primary-200"
                >
                  Today
                </button>
                <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-all border border-slate-200">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="bg-slate-50/50 rounded-xl p-3 border border-slate-100">
              <div className="grid grid-cols-7 gap-1 text-center mb-1">
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(day => (
                  <div key={day} className="text-[10px] font-bold text-slate-400 uppercase">
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: getFirstDayOfMonth(currentDate) }).map((_, i) => (
                  <div key={`empty-${i}`} className="h-8 sm:h-9" />
                ))}

                {Array.from({ length: getDaysInMonth(currentDate) }).map((_, i) => {
                  const day = i + 1;
                  const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
                  const isSelected = selectedDate && isSameDay(date, selectedDate);
                  const isToday = isSameDay(date, new Date());

                  // Get all sessions for this date
                  const sessionsOnDate = getSessionsOnDate(date);
                  const hasSession = sessionsOnDate.length > 0;

                  return (
                    <div key={day} className="relative group">
                      <button
                        onClick={() => setSelectedDate(isSelected ? null : date)}
                        className={`
                                    relative h-9 sm:h-11 w-full rounded-xl flex flex-col items-center justify-center transition-all text-sm
                                    ${isSelected
                            ? 'bg-primary-600 text-white shadow-md transform scale-105 z-10 font-bold'
                            : 'hover:bg-white text-slate-600 hover:text-slate-900 border border-transparent hover:border-slate-200 hover:shadow-sm'}
                                    ${isToday && !isSelected ? 'bg-primary-50 text-primary-700 font-bold border-primary-100' : ''}
                                `}
                      >
                        <span className="z-10 relative">{day}</span>
                        {hasSession && (
                          <span className={`absolute bottom-1.5 w-5 h-1.5 rounded-full shadow-sm transition-all duration-300 ${isSelected ? 'bg-white/90' : 'bg-primary-500'}`} />
                        )}
                      </button>

                      {/* Tooltip for sessions */}
                      {hasSession && (
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 w-48 bg-white text-slate-700 text-xs rounded-lg shadow-xl border border-slate-200 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-50 overflow-hidden">
                          <div className="bg-slate-50 px-3 py-1.5 border-b border-slate-100">
                            <p className="font-bold text-slate-800">{date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</p>
                          </div>
                          <div className="p-1 space-y-0.5 max-h-64 overflow-y-auto">
                            {(() => {
                              // console.log(`[Tooltip] Rendering ${sessionsOnDate.length} sessions for ${date.toDateString()}`);
                              return sessionsOnDate.map((session) => (
                                <div key={session.id} className="px-2 py-1.5 hover:bg-slate-50 rounded flex flex-col gap-0.5">
                                  <span className="font-semibold text-primary-700 truncate">{session.subject}</span>
                                  <div className="flex items-center justify-between text-[10px] text-slate-500">
                                    <span>{session.time}</span>
                                    <span className={`px-1 rounded-full text-[9px] ${session.status === 'confirmed' || session.status === 'upcoming' ? 'bg-green-100 text-green-700' :
                                      session.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                                        'bg-slate-100 text-slate-600'
                                      }`}>
                                      {session.status === 'awaiting_payment' ? 'payment' : session.status}
                                    </span>
                                  </div>
                                </div>
                              ))
                            })()}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {selectedDate && (
              <div className="mt-3 flex justify-between items-center bg-primary-50 px-3 py-2 rounded-lg border border-primary-100 animate-in fade-in slide-in-from-top-1">
                <p className="text-xs text-primary-800 font-medium">
                  Viewing: <span className="font-bold">{selectedDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                </p>
                <button
                  onClick={() => setSelectedDate(null)}
                  className="text-xs font-bold text-primary-600 hover:text-primary-800 hover:underline"
                >
                  Clear Date
                </button>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Booking Requests */}
      <div className="space-y-3 sm:space-y-4 pb-4">
        {filteredRequests.length === 0 ? (
          <Card className="p-6 sm:p-8 text-center">
            <MessageSquare className="h-10 w-10 sm:h-12 sm:w-12 text-slate-400 mx-auto mb-3 sm:mb-4" />
            <h3 className="text-base sm:text-lg font-medium text-slate-900 mb-1">No booking requests</h3>
            <p className="text-xs sm:text-sm md:text-base text-slate-600">
              {filter === 'all'
                ? "You haven't received any booking requests yet."
                : `No ${filter.replace('_', ' ')} requests found.`
              }
            </p>
          </Card>
        ) : (
          filteredRequests.map(request => {
            const statusColors: Record<string, string> = {
              'pending': 'bg-gradient-to-r from-yellow-500 to-amber-500',
              'accepted': 'bg-gradient-to-r from-primary-500 to-primary-700',
              'confirmed': 'bg-gradient-to-r from-green-500 to-emerald-500',
              'awaiting_payment': 'bg-gradient-to-r from-orange-500 to-amber-500',
              'upcoming': 'bg-gradient-to-r from-primary-500 to-primary-700',
              'completed': 'bg-gradient-to-r from-purple-500 to-primary-700',
              'declined': 'bg-gradient-to-r from-red-500 to-rose-500',
              'cancelled': 'bg-gradient-to-r from-slate-500 to-slate-600',
            };

            return (
              <Card
                key={request.id}
                className={`group relative bg-gradient-to-br from-white to-primary-50/30 rounded-xl sm:rounded-2xl shadow-lg border-2 ${isOverdue(request)
                  ? 'border-red-300 hover:border-red-400 bg-red-50/50'
                  : 'border-slate-200 hover:border-primary-300'
                  } p-4 sm:p-5 md:p-6 transition-all duration-300 overflow-hidden`}
              >
                {/* Decorative gradient bar */}
                <div className={`absolute top-0 left-0 right-0 h-1 ${statusColors[request.status] || 'bg-gradient-to-r from-primary-500 to-primary-700'}`} />

                <div className="flex flex-col gap-4 sm:gap-5">
                  {/* Header Row */}
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                        <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-900 break-words">
                          {request.subject}
                        </h3>
                        <button
                          onClick={async () => {
                            // Open tutee profile modal
                            const sid = request.student.user_id;
                            if (!sid) {
                              toast.error('Student ID not available');
                              return;
                            }
                            setTuteeProfileLoading(true);
                            // Seed the modal with minimal student info so name and avatar
                            // appear immediately while we fetch the full profile.
                            setTuteeProfile({ user_id: sid, name: request.student.name, email: request.student.email, profile_image_url: (request.student as any)?.profile_image_url || (request.student as any)?.profile_image || '' });
                            setIsTuteeModalOpen(true);
                            try {
                              // Try a few endpoints for full profile: /users/:id/profile, then /users/:id
                              let profileData: any = null;
                              try {
                                const pRes = await apiClient.get(`/users/${sid}/profile`);
                                profileData = pRes.data;
                              } catch (e) {
                                try {
                                  const r = await apiClient.get(`/users/${sid}`);
                                  profileData = r.data;
                                } catch (e2) {
                                  console.warn('No detailed profile endpoints available, will use booking student info', e2);
                                  profileData = { user_id: sid, ...request.student };
                                }
                              }

                              // Try to fetch booking history count for the student (best-effort)
                              try {
                                const bRes = await apiClient.get(`/users/${sid}/bookings`);
                                const bookingsArr = Array.isArray(bRes.data) ? bRes.data : (Array.isArray(bRes.data?.data) ? bRes.data.data : (Array.isArray(bRes.data?.bookings) ? bRes.data.bookings : []));
                                profileData._bookingsCount = bookingsArr.length;
                              } catch (e) {
                                // ignore booking fetch errors
                              }

                              setTuteeProfile(profileData || { user_id: sid, ...request.student });
                            } catch (err) {
                              console.warn('Failed to fetch full tutee profile, falling back to minimal data', err);
                              setTuteeProfile({ user_id: sid, ...request.student });
                            } finally {
                              setTuteeProfileLoading(false);
                            }
                          }}
                          className="inline-flex items-center justify-center p-1.5 sm:p-2 rounded-lg bg-primary-50 hover:bg-primary-100 active:bg-primary-200 text-primary-600 touch-manipulation transition-colors shadow-sm hover:shadow-md"
                          title="View tutee profile"
                          style={{ WebkitTapHighlightColor: 'transparent' }}
                        >
                          <Eye className="h-4 w-4 sm:h-5 sm:w-5" />
                        </button>
                      </div>
                      {/* Status badge moved below subject name */}
                      <div className="mb-3">
                        <div className={`inline-flex items-center px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm md:text-base font-bold gap-1.5 sm:gap-2 shadow-md border-2 ${getStatusColor(request.status)}`}>
                          {getStatusIcon(request.status)}
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: request.status === 'pending' ? '#eab308' : request.status === 'confirmed' ? '#16a34a' : request.status === 'awaiting_payment' ? '#f97316' : request.status === 'declined' ? '#dc2626' : hasSessionStarted(request) ? '#22c55e' : '#3b82f6' }} />
                          <span className="whitespace-nowrap">
                            {hasSessionStarted(request)
                              ? "Session Started"
                              : (request.status.replace('_', ' ').charAt(0).toUpperCase() + request.status.replace('_', ' ').slice(1))
                            }
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs sm:text-sm text-slate-600 mb-3">
                        <span className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white rounded-lg border border-slate-200 shadow-sm">
                          <User className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary-600 flex-shrink-0" />
                          <span className="truncate max-w-[120px] sm:max-w-none">{request.student.name}</span>
                        </span>
                        <span className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white rounded-lg border border-slate-200 shadow-sm">
                          <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </Calendar>
                          <span className="whitespace-nowrap">{new Date(request.date).toLocaleDateString()}</span>
                        </span>
                        <span className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white rounded-lg border border-slate-200 shadow-sm">
                          <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </Clock>
                          <span className="whitespace-nowrap">{request.time}</span>
                        </span>
                        <span className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white rounded-lg border border-slate-200 shadow-sm">
                          <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </Clock>
                          <span className="whitespace-nowrap">{request.duration} {request.duration === 1 ? 'hour' : 'hours'}</span>
                        </span>
                      </div>

                      {request.student_notes && (
                        <div className="p-3 sm:p-4 bg-gradient-to-br from-slate-50 to-primary-50/50 rounded-xl border-2 border-slate-200 shadow-sm">
                          <div className="flex items-start gap-2 sm:gap-3">
                            <div className="p-1.5 sm:p-2 bg-primary-100 rounded-lg flex-shrink-0 mt-0.5">
                              <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-primary-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="text-xs sm:text-sm md:text-base font-semibold text-slate-800 mb-1.5 sm:mb-2">Student Notes</h4>
                              <p className="text-xs sm:text-sm md:text-base text-slate-700 leading-relaxed whitespace-pre-wrap break-words">
                                {request.student_notes}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Payment proof review moved to admin. Tutors cannot view or approve payment proofs. */}


                  {/* Session Details */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-3 sm:p-4 bg-gradient-to-r from-primary-50 via-primary-100/50 to-primary-50 rounded-xl border-2 border-primary-200/50 shadow-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-xs sm:text-sm font-semibold text-slate-700">Requested:</span>
                      <span className="text-xs sm:text-sm md:text-base font-medium text-slate-900">
                        {new Date(request.created_at).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4 pt-4 sm:pt-5 border-t-2 border-slate-200 mt-4">
                  <div className="hidden sm:block text-[10px] sm:text-xs text-slate-500">
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-2 w-full sm:w-auto">
                    {request.status === 'pending' && (
                      <>
                        <Button
                          onClick={() => { setAcceptTarget(request); setAcceptConfirmOpen(true); }}
                          disabled={loading}
                          className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 active:from-green-800 active:to-emerald-800 text-white rounded-xl px-5 py-3 shadow-md hover:shadow-lg transition-all text-sm sm:text-base font-semibold flex items-center justify-center gap-2 w-full sm:w-auto touch-manipulation min-h-[44px]"
                          style={{ WebkitTapHighlightColor: 'transparent' }}
                        >
                          <CheckCircle className="h-5 w-5 flex-shrink-0" />
                          <span>Accept</span>
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => handleBookingAction(request.id, 'decline')}
                          disabled={loading}
                          className="bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 active:from-red-800 active:to-rose-800 text-white rounded-xl px-5 py-3 shadow-md hover:shadow-lg transition-all text-sm sm:text-base font-semibold flex items-center justify-center gap-2 w-full sm:w-auto touch-manipulation min-h-[44px]"
                          style={{ WebkitTapHighlightColor: 'transparent' }}
                        >
                          <X className="h-5 w-5 flex-shrink-0" />
                          <span>Decline</span>
                        </Button>
                      </>
                    )}
                    {(request.status === 'upcoming' || request.status === 'confirmed') && (
                      <Button
                        variant="secondary"
                        onClick={() => { setRescheduleTarget(request); setIsRescheduleModalOpen(true); }}
                        disabled={loading}
                        className="bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 active:from-primary-800 active:to-primary-900 text-white rounded-xl px-5 py-3 shadow-md hover:shadow-lg transition-all text-sm sm:text-base font-semibold flex items-center justify-center gap-2 w-full sm:w-auto touch-manipulation min-h-[44px]"
                        style={{ WebkitTapHighlightColor: 'transparent' }}
                      >
                        <Clock className="h-5 w-5 flex-shrink-0" />
                        <span>Reschedule</span>
                      </Button>
                    )}

                    {/* Mark as done button for overdue upcoming sessions in Session Handling */}
                    {isSessionEligibleForMarkAsDone(request) && (
                      <Button
                        onClick={() => handleMarkDone(request.id)}
                        disabled={loading}
                        className="bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 active:from-primary-800 active:to-primary-900 text-white rounded-xl px-5 py-3 shadow-md hover:shadow-lg transition-all text-sm sm:text-base font-semibold flex items-center justify-center gap-2 w-full sm:w-auto touch-manipulation min-h-[44px]"
                        style={{ WebkitTapHighlightColor: 'transparent' }}
                      >
                        <CheckCircle className="h-5 w-5 flex-shrink-0" />
                        <span>Mark as done</span>
                      </Button>
                    )}

                    {/* No payment confirmation actions in Session Handling */}
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Tutee Profile Modal */}
      {isTuteeModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => { setIsTuteeModalOpen(false); setTuteeProfile(null); }}
          title="Tutee Profile"
          footer={<Button onClick={() => { setIsTuteeModalOpen(false); setTuteeProfile(null); }}>Close</Button>}
        >
          {tuteeProfileLoading ? (
            <div className="text-slate-600">Loading profile...</div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="h-20 w-20 rounded-full overflow-hidden border">
                  <img src={getFileUrl(tuteeProfile?.profile_image_url || tuteeProfile?.profile_image || '')} alt={tuteeProfile?.name || 'Tutee'} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(tuteeProfile?.name || 'Tutee')}`; }} />
                </div>
                <div className="flex-1">
                  <div className="text-xl font-semibold">{tuteeProfile?.name || tuteeProfile?.email}</div>
                  <div className="text-sm text-slate-600">{tuteeProfile?.email}</div>
                  {tuteeProfile?.university_name || tuteeProfile?.university_id ? (
                    <div className="text-sm text-slate-500 mt-1">{tuteeProfile?.university_name || ''}</div>
                  ) : null}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="text-sm text-slate-500">Joined: {tuteeProfile?.created_at ? new Date(tuteeProfile.created_at).toLocaleDateString() : '—'}</div>
                  <div className="text-sm text-slate-500">Bookings: {tuteeProfile?._bookingsCount ?? '—'}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  {tuteeProfile?.course_name || tuteeProfile?.course_id ? (
                    <div><strong>Course:</strong> {tuteeProfile?.course_name || ''}</div>
                  ) : null}
                  {tuteeProfile?.year_level ? (
                    <div><strong>Year level:</strong> {tuteeProfile.year_level}</div>
                  ) : null}
                  {tuteeProfile?.phone || tuteeProfile?.contact_number ? (
                    <div><strong>Phone:</strong> {tuteeProfile.phone || tuteeProfile.contact_number} <button onClick={async () => { try { await navigator.clipboard.writeText(tuteeProfile.phone || tuteeProfile.contact_number); toast.success('Phone copied'); } catch { toast.error('Unable to copy'); } }} className="ml-2 text-xs text-primary-600">Copy</button></div>
                  ) : null}
                  {tuteeProfile?.city || tuteeProfile?.country ? (
                    <div><strong>Location:</strong> {[tuteeProfile.city, tuteeProfile.country].filter(Boolean).join(', ')}</div>
                  ) : null}
                </div>

                <div className="space-y-2">
                  {tuteeProfile?.bio && (
                    <div>
                      <strong>Bio</strong>
                      <p className="text-sm text-slate-700 mt-1">{tuteeProfile.bio}</p>
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    {tuteeProfile?.email && (
                      <a href={`mailto:${tuteeProfile.email}`} className="px-3 py-1 bg-primary-600 text-white rounded-md text-sm">Send email</a>
                    )}
                    {tuteeProfile?.phone && (
                      <button onClick={async () => { try { await navigator.clipboard.writeText(tuteeProfile.phone); toast.success('Phone copied'); } catch { toast.error('Unable to copy'); } }} className="px-3 py-1 border rounded-md text-sm">Copy phone</button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </Modal>
      )}
      {/* Accept Confirmation Modal for tutors */}
      {acceptConfirmOpen && acceptTarget && (
        <Modal
          isOpen={true}
          onClose={() => { setAcceptConfirmOpen(false); setAcceptTarget(null); }}
          title="Confirm Accept Booking"
          footer={
            <>
              <button
                onClick={async () => {
                  // call the existing handler which updates server and refreshes list
                  await handleBookingAction(acceptTarget.id, 'accept');
                  setAcceptConfirmOpen(false);
                  setAcceptTarget(null);
                }}
                disabled={loading}
                className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 shadow-md"
              >
                {loading ? 'Accepting...' : 'Confirm Accept'}
              </button>
              <button
                onClick={() => { setAcceptConfirmOpen(false); setAcceptTarget(null); }}
                className="px-4 py-2 border rounded-md hover:bg-slate-100 ml-2"
              >
                Cancel
              </button>
            </>
          }
        >
          <div className="space-y-4">
            <div className="rounded-lg overflow-hidden shadow-sm">
              <div className="bg-gradient-to-r from-green-600 to-emerald-500 p-4 text-white flex items-center gap-4">
                <div className="h-16 w-16 rounded-full overflow-hidden flex-shrink-0 border-2 border-white shadow-lg">
                  <img
                    src={
                      acceptTarget.student.profile_image_url
                        ? getFileUrl(acceptTarget.student.profile_image_url)
                        : `https://ui-avatars.com/api/?name=${encodeURIComponent(acceptTarget.student.name)}&background=10b981&color=fff&size=128`
                    }
                    alt={acceptTarget.student.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(acceptTarget.student.name)}&background=10b981&color=fff&size=128`;
                    }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-lg truncate">Accept booking from {acceptTarget.student.name}</div>
                  <div className="text-sm opacity-90 truncate">{acceptTarget.student.email}</div>
                </div>
                <div className="ml-auto text-sm inline-flex items-center bg-white/20 px-2 py-1 rounded text-white flex-shrink-0">
                  {acceptTarget.duration} hr{acceptTarget.duration !== 1 ? 's' : ''}
                </div>
              </div>
              <div className="p-4 bg-white">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="text-sm">
                    <div className="font-medium">Subject</div>
                    <div className="text-slate-700">{acceptTarget.subject}</div>
                  </div>
                  <div className="text-sm">
                    <div className="font-medium">When</div>
                    <div className="text-slate-700">{new Date(acceptTarget.date).toLocaleDateString()} · {acceptTarget.time}</div>
                  </div>
                  <div className="text-sm sm:col-span-2">
                    <div className="font-medium">Notes</div>
                    <div className="text-slate-700">{acceptTarget.student_notes || 'No notes'}</div>
                  </div>
                </div>
                <div className="mt-3 text-xs text-slate-500">Accepting will notify the student that their booking is approved. You can still cancel later if needed.</div>
              </div>
            </div>
          </div>
        </Modal>
      )}
      {/* Tutor resolution status */}
      {resolvingTutor && (
        <Card className="p-4 sm:p-5 mb-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h3 className="text-base sm:text-lg font-medium text-slate-800">Loading tutor information…</h3>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">Resolving your tutor profile. This may take a moment.</p>
            </div>
            <div className="text-xs sm:text-sm text-slate-500">Please wait…</div>
          </div>
        </Card>
      )}

      {resolveError && (
        <Card className="p-4 sm:p-5 border-2 border-red-200 bg-red-50 mb-4">
          <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h3 className="text-base sm:text-lg font-medium text-red-800">Failed to load tutor information</h3>
              <p className="text-xs sm:text-sm text-red-700 mt-2 break-words">{resolveError}</p>
              <p className="text-xs sm:text-sm text-slate-500 mt-2">Possible causes: backend not running, expired session, or missing tutor profile.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <Button onClick={() => resolveTutorIdAndFetch()} className="px-4 py-2.5 text-sm min-h-[44px] w-full sm:w-auto">Retry</Button>
              <Button variant="secondary" onClick={() => { localStorage.removeItem('token'); localStorage.removeItem('user'); navigate('/login'); }} className="px-4 py-2.5 text-sm min-h-[44px] w-full sm:w-auto">Sign in again</Button>
            </div>
          </div>
        </Card>
      )}

      {/* Reschedule Modal */}
      {isRescheduleModalOpen && rescheduleTarget && (
        <RescheduleModal
          open={isRescheduleModalOpen}
          bookingId={rescheduleTarget.id}
          onClose={() => { setIsRescheduleModalOpen(false); setRescheduleTarget(null); }}
          onSuccess={() => {
            setIsRescheduleModalOpen(false);
            setRescheduleTarget(null);
            fetchBookingRequests(); // Refresh the list after successful reschedule
          }}
        />
      )}
    </div>
  );
};

const SessionHandling: React.FC = () => {
  return (
    <ErrorBoundary>
      <SessionHandlingContent />
    </ErrorBoundary>
  );
};

export default SessionHandling;