import React, { useEffect, useState, useMemo } from 'react';
import apiClient from '../../services/api';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import { CheckCircle, History, Clock, Calendar, User, Upload, FileText, Star, TrendingUp, BookOpen, Info, X, DollarSign } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

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
  status: string;
  created_at: string;
  student_notes?: string;
  rating?: number;
  rating_comment?: string;
  session_rate_per_hour?: number;
}

interface Payment {
  payment_id: number;
  booking_request_id?: number;
  student_id?: number;
  tutor_id?: number;
  amount: number;
  sender?: string;
  status?: string;
  student?: {
    student_id?: number;
    user?: {
      user_id?: number;
    };
  };
}

const SessionHistory: React.FC = () => {
  const [sessions, setSessions] = useState<BookingRequest[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const [now, setNow] = useState(new Date());
  const [proofModalOpen, setProofModalOpen] = useState(false);
  const [proofTarget, setProofTarget] = useState<BookingRequest | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [tutorId, setTutorId] = useState<number | null>(null);
  const [sessionRate, setSessionRate] = useState<number | null>(null);
  const [bookingIdsWithPayouts, setBookingIdsWithPayouts] = useState<Set<number>>(new Set());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000); // Rerender every minute
    return () => clearInterval(timer);
  }, []);

  const parseSessionStart = (dateStr: string, timeStr: string): Date | null => {
    if (!dateStr || !timeStr) {
      return null;
    }
    let sessionDate = new Date(`${dateStr.split('T')[0]}T${timeStr}`);
    if (!isNaN(sessionDate.getTime())) {
      return sessionDate;
    }
    sessionDate = new Date(dateStr);
    if (isNaN(sessionDate.getTime())) {
      return null;
    }
    const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?/i);
    if (timeMatch) {
      let hours = parseInt(timeMatch[1], 10);
      const minutes = parseInt(timeMatch[2], 10);
      const ampm = timeMatch[3];
      if (ampm && ampm.toLowerCase() === 'pm' && hours < 12) {
        hours += 12;
      }
      if (ampm && ampm.toLowerCase() === 'am' && hours === 12) {
        hours = 0;
      }
      sessionDate.setHours(hours, minutes, 0, 0);
      return sessionDate;
    }
    return null;
  };

  // Helper: Check if a session duration has completed (past its scheduled end time)
  const hasSessionDurationCompleted = (b: BookingRequest): boolean => {
    const start = parseSessionStart(b.date, b.time);
    if (!start) return false;

    const durationHours = b.duration || 1.0;
    const endTime = new Date(start.getTime() + durationHours * 60 * 60 * 1000);

    // Use the 'now' state variable that updates every minute for accurate time checks
    return now.getTime() > endTime.getTime();
  };

  // Helper: Check if a session has started (current time is past start time)
  // This is used to display "Session Started" status for upcoming sessions
  const hasSessionStarted = (b: BookingRequest): boolean => {
    if (b.status !== 'upcoming') return false;
    const start = parseSessionStart(b.date, b.time);
    if (!start) return false;
    return now.getTime() >= start.getTime();
  };

  const fetchHistory = async () => {
    if (!user?.user_id) {
      setSessions([]);
      return;
    }
    setLoading(true);
    try {
      const tutorRes = await apiClient.get(`/tutors/by-user/${user.user_id}/tutor-id`);
      const fetchedTutorId = tutorRes.data?.tutor_id;

      if (!fetchedTutorId) {
        setSessions([]);
        return;
      }

      setTutorId(fetchedTutorId);

      // Fetch tutor profile to get session rate
      try {
        const profileRes = await apiClient.get(`/tutors/${fetchedTutorId}/profile`);
        setSessionRate(profileRes.data.session_rate_per_hour || null);
      } catch (err) {
        console.warn('Failed to fetch tutor profile for session rate:', err);
      }

      // Fetch booking requests, tutor payments, and payouts
      const [res, tutorPaymentsRes, payoutsRes] = await Promise.all([
        apiClient.get(`/tutors/${fetchedTutorId}/booking-requests`),
        apiClient.get(`/tutors/${fetchedTutorId}/payments`).catch(() => ({ data: [] })),
        apiClient.get(`/tutors/${fetchedTutorId}/payouts`).catch(() => ({ data: [] }))
      ]);

      // Get payment IDs that have payouts (convert to numbers for consistent comparison)
      // Use the same logic as paymentIdsWithPayoutsForCalc to ensure consistency
      const payoutPaymentIds = (payoutsRes.data || []).map((p: any) => {
        // Try multiple possible field names for payment_id (same as EarningsHistory.tsx)
        const pid = p.payment_id || (p.payment as any)?.payment_id || (p.payment as any)?.id;
        const numPid = pid ? Number(pid) : null;
        if (numPid && !isNaN(numPid)) {
          return numPid;
        }
        return null;
      }).filter((pid: any) => pid !== null && !isNaN(pid));

      const paymentIdsWithPayouts = new Set(payoutPaymentIds);

      console.log('[SessionHistory] Payouts data:', payoutsRes.data);
      console.log('[SessionHistory] Payment IDs with payouts:', Array.from(paymentIdsWithPayouts));

      // Get all payments for this tutor (for checking which sessions have payments with payouts)
      // We need to check ALL payments, not just confirmed ones, to see which bookings have payouts
      const allTutorPayments = (tutorPaymentsRes.data || []);

      console.log('[SessionHistory] All tutor payments:', allTutorPayments);
      console.log('[SessionHistory] Payment IDs with payouts:', Array.from(paymentIdsWithPayouts));

      // Create a map of booking_request_id to payment_id for quick lookup
      // Map all payments (regardless of status) to their booking IDs
      const bookingIdToPaymentId = new Map<number, number>();
      allTutorPayments.forEach((p: any) => {
        const paymentId = p.payment_id || p.id;
        const paymentIdNum = paymentId ? Number(paymentId) : null;
        const bookingId = p.booking_request_id;
        if (bookingId && paymentIdNum !== null && !isNaN(paymentIdNum)) {
          const bookingIdNum = Number(bookingId);
          // If multiple payments exist for same booking, keep the one that has a payout (if any)
          if (!bookingIdToPaymentId.has(bookingIdNum) || paymentIdsWithPayouts.has(paymentIdNum)) {
            bookingIdToPaymentId.set(bookingIdNum, paymentIdNum);
          }
        }
      });

      console.log('[SessionHistory] Booking ID to Payment ID map:', Array.from(bookingIdToPaymentId.entries()));

      // Store booking IDs that have payments with payouts (to exclude from upcoming sessions)
      const bookingIdsWithPayouts = new Set<number>();
      bookingIdToPaymentId.forEach((paymentId, bookingId) => {
        const paymentIdNum = Number(paymentId);
        if (paymentIdsWithPayouts.has(paymentIdNum)) {
          const bookingIdNum = Number(bookingId);
          bookingIdsWithPayouts.add(bookingIdNum);
          console.log(`[SessionHistory] Booking ${bookingIdNum} has payment ${paymentIdNum} with payout - will be excluded`);
        }
      });

      console.log('[SessionHistory] Booking IDs with payouts (final):', Array.from(bookingIdsWithPayouts));

      // Filter payments for this tutor with status "confirmed" that don't have payouts
      const tutorPayments = allTutorPayments.filter((p: any) => {
        const paymentId = p.payment_id || p.id;
        const paymentIdNum = paymentId ? Number(paymentId) : null;

        // Only include payments with status "confirmed" that don't have payouts
        return p.status === 'confirmed' &&
          paymentIdNum !== null &&
          !isNaN(paymentIdNum) &&
          !paymentIdsWithPayouts.has(paymentIdNum);
      });

      // Store all tutor payments (not just confirmed without payouts) so we can find payments for expected earnings
      setPayments(allTutorPayments);
      setPayouts(payoutsRes.data || []);
      setBookingIdsWithPayouts(bookingIdsWithPayouts);

      let allBookings = [];
      if (Array.isArray(res.data)) {
        allBookings = res.data;
      } else if (Array.isArray(res.data?.data)) {
        allBookings = res.data.data;
      } else if (res.data?.bookings && Array.isArray(res.data.bookings)) {
        allBookings = res.data.bookings;
      }

      const sessionsWithRatings = allBookings.map((b: any) => {
        // Prefer rating info baked into the booking payload to avoid hitting legacy endpoints
        const ratingSources = [
          { value: b.rating, comment: b.rating_comment ?? b.comment ?? b.tutee_comment },
          { value: b.tutee_rating, comment: b.tutee_comment ?? b.comment },
          { value: b.feedback?.rating, comment: b.feedback?.comment },
          { value: b.review?.rating, comment: b.review?.comment }
        ];

        let rating: number | null = null;
        let ratingComment: string | null = null;
        for (const source of ratingSources) {
          const rawValue = source.value;
          const parsedValue =
            typeof rawValue === 'number'
              ? rawValue
              : typeof rawValue === 'string'
                ? Number(rawValue)
                : null;

          if (parsedValue !== null && !Number.isNaN(parsedValue)) {
            rating = parsedValue;
            ratingComment = source.comment ?? null;
            break;
          }
        }

        return {
          ...b,
          rating,
          rating_comment: ratingComment,
          session_rate_per_hour: b.session_rate_per_hour || b.tutor?.session_rate_per_hour || null
        };
      });

      const historySessions = sessionsWithRatings.filter((b: BookingRequest) => {
        // Show sessions with status "upcoming" (for marking as done)
        // Also show "awaiting_confirmation" sessions (after tutor has marked as done with proof, waiting for tutee confirmation)
        // Also show "completed" sessions (after tutee has confirmed and left feedback)
        // Also show "admin_payment_pending" sessions (after tutee feedback, waiting for admin payment)
        return b.status === 'upcoming' || b.status === 'awaiting_confirmation' || b.status === 'completed' || b.status === 'admin_payment_pending';
      });
      setSessions(historySessions);
    } catch (err) {
      console.error("Failed to fetch session history:", err);
      setSessions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [user, now]);

  // Calculate payment received from payments table (status='confirmed', matched by booking_request_id, not in payouts)
  const calculatePaymentReceived = (session: BookingRequest): number => {
    // Find payment with status='confirmed', matching booking_request_id
    // Match by booking_request_id and student (via user_id from student.user or direct student_id)
    const sessionStudentUserId = session.student?.user_id;

    const payment = payments.find(p => {
      // Must have status='confirmed' and matching booking_request_id
      if (p.status !== 'confirmed' || p.booking_request_id !== session.id) {
        return false;
      }

      // Match by student.user.user_id if available (payment includes student relation)
      const paymentStudentUserId = (p as any).student?.user?.user_id;
      if (paymentStudentUserId && sessionStudentUserId && paymentStudentUserId === sessionStudentUserId) {
        return true;
      }

      // If payment doesn't have student relation loaded, we can't match by student_id
      // So we'll match only by booking_request_id and status (assuming one payment per booking)
      // This is a fallback - ideally payments should include student relations
      return true;
    });

    if (payment && payment.amount) {
      // Deduct 13% platform fee from the payment amount
      return Number(payment.amount) * 0.87;
    }

    // Return 0 if no payment found (don't fallback to calculated amount)
    return 0;
  };

  // Render stars for rating
  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`h-4 w-4 ${i < Math.floor(rating) ? 'text-yellow-400 fill-current' : 'text-slate-300'
          }`}
      />
    ));
  };

  // Get payment IDs that have payouts (same logic as EarningsHistory.tsx)
  // Must be defined before upcomingSessionsWithData
  const paymentIdsWithPayoutsForCalc = useMemo(() => {
    const payoutPaymentIds = payouts
      .map((p: any) => {
        // Try multiple possible field names for payment_id
        const pid = p.payment_id || (p.payment as any)?.payment_id || (p.payment as any)?.id;
        const numPid = pid ? Number(pid) : null;
        if (numPid && !isNaN(numPid)) {
          return numPid;
        }
        return null;
      })
      .filter((pid: any) => pid !== null && !isNaN(pid));

    return new Set(payoutPaymentIds);
  }, [payouts]);

  // Filter payments: only show "confirmed" payments that don't have payouts (same as EarningsHistory.tsx)
  // Must be defined before upcomingSessionsWithData
  const confirmedPaymentsWithoutPayouts = useMemo(() => {
    const confirmedPayments = payments.filter((p: any) => p.status === 'confirmed');

    const filtered = confirmedPayments.filter((p: any) => {
      const paymentId = p.payment_id || p.id;
      const paymentIdNum = paymentId ? Number(paymentId) : null;

      // Exclude if payment ID is invalid
      if (paymentIdNum === null || isNaN(paymentIdNum)) {
        return false;
      }

      const hasPayout = paymentIdsWithPayoutsForCalc.has(paymentIdNum);
      return !hasPayout;
    });

    return filtered;
  }, [payments, paymentIdsWithPayoutsForCalc]);

  // Get upcoming sessions for the table (only show "upcoming" status sessions that don't have payments with payouts)
  const upcomingSessionsWithData = useMemo(() => {
    const upcomingSessions = sessions.filter(s => s.status === 'upcoming');

    // Create a set of booking IDs that have confirmed payments without payouts
    // Sessions should only be shown if they have a payment in confirmedPaymentsWithoutPayouts
    // OR if they don't have any payment yet (will calculate from rate)
    const bookingIdsWithConfirmedPaymentsWithoutPayouts = new Set<number>();
    confirmedPaymentsWithoutPayouts.forEach((p: any) => {
      const bookingId = p.booking_request_id;
      if (bookingId) {
        bookingIdsWithConfirmedPaymentsWithoutPayouts.add(Number(bookingId));
      }
    });

    const filtered = upcomingSessions.filter(s => {
      const sessionId = Number(s.id);

      // Check if this session has a payment that already has a payout
      // If the session ID is in bookingIdsWithPayouts, it means it has a payment with a payout
      const hasPayout = bookingIdsWithPayouts.has(sessionId);

      if (hasPayout) {
        console.log(`[SessionHistory] Excluding upcoming session ${sessionId} - has payment with payout`);
        return false;
      }

      // Also check: if there's a payment for this booking that's NOT in confirmedPaymentsWithoutPayouts,
      // it means it has a payout, so exclude it
      // We already check bookingIdsWithPayouts above, but let's also verify by checking payments directly
      const paymentForThisSession = payments.find((p: any) => {
        const paymentId = p.payment_id || p.id;
        const paymentIdNum = paymentId ? Number(paymentId) : null;
        return p.booking_request_id === sessionId &&
          paymentIdNum !== null &&
          !isNaN(paymentIdNum) &&
          paymentIdsWithPayoutsForCalc.has(paymentIdNum);
      });

      if (paymentForThisSession) {
        console.log(`[SessionHistory] Excluding upcoming session ${sessionId} - payment ${paymentForThisSession.payment_id || paymentForThisSession.id} has payout`);
        return false;
      }

      return true;
    });

    console.log(`[SessionHistory] Total sessions: ${sessions.length}`);
    console.log(`[SessionHistory] Upcoming sessions (before filter): ${upcomingSessions.length}`);
    console.log(`[SessionHistory] Upcoming sessions (after filter): ${filtered.length}`);
    console.log(`[SessionHistory] Booking IDs with payouts:`, Array.from(bookingIdsWithPayouts));
    console.log(`[SessionHistory] Payment IDs with payouts:`, Array.from(paymentIdsWithPayoutsForCalc));
    console.log(`[SessionHistory] Upcoming session IDs (after filter):`, filtered.map(s => s.id));

    return filtered;
  }, [sessions, bookingIdsWithPayouts, confirmedPaymentsWithoutPayouts, payments, paymentIdsWithPayoutsForCalc]);

  const totalUpcomingHours = upcomingSessionsWithData.reduce((sum, s) => {
    const duration = Number(s.duration ?? 0);
    return sum + (Number.isNaN(duration) ? 0 : duration);
  }, 0);

  // Calculate upcoming earnings based on sessions in upcomingSessionsWithData
  // This ensures the total updates when sessions are marked as done and removed from the list
  const totalUpcomingEarnings = useMemo(() => {
    if (!upcomingSessionsWithData || upcomingSessionsWithData.length === 0) {
      return 0;
    }

    return upcomingSessionsWithData.reduce((sum, session) => {
      // Find payment with booking_request_id matching this session
      const payment = payments.find((p: any) => {
        const bookingId = p.booking_request_id || (p.bookingRequest as any)?.id;
        const sessionId = session.id;
        return bookingId === sessionId || bookingId === Number(sessionId) || Number(bookingId) === sessionId;
      });

      // Use actual payment amount * 0.87 if payment exists
      // If no payment exists, calculate from session rate as fallback
      let expectedEarnings = 0;
      if (payment && payment.amount) {
        expectedEarnings = Number(payment.amount) * 0.87;
      } else {
        // Fallback: calculate from session rate if no payment found
        const ratePerHour = session.session_rate_per_hour || sessionRate || 0;
        const duration = Number(session.duration ?? 0);
        expectedEarnings = ratePerHour * duration * 0.87;
      }

      return sum + expectedEarnings;
    }, 0);
  }, [upcomingSessionsWithData, payments, sessionRate]);

  // Helper: Check if a session is eligible for "Mark as done" button
  const isSessionEligibleForMarkAsDone = (r: BookingRequest) => {
    // Only show button for 'upcoming' status sessions (explicitly exclude declined, cancelled, completed)
    if (r.status !== 'upcoming') return false;

    const start = parseSessionStart(r.date, r.time);
    if (!start) return false;

    const durationHours = r.duration || 1.0;
    const end = new Date(start.getTime() + durationHours * 60 * 60 * 1000);

    // Use the 'now' state variable that updates every minute for accurate time checks
    // Show button only if session duration has completed (end time has passed)
    return now >= end;
  };

  const handleMarkDoneSimple = (session: BookingRequest) => {
    // Open the proof upload modal instead of directly marking as done
    setProofTarget(session);
    setProofModalOpen(true);
  };

  const handleMarkDone = async () => {
    if (!proofTarget || !proofFile) {
      toast.error('Please select a proof image to upload.');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', proofFile);
      formData.append('status', 'awaiting_confirmation'); // Set status to awaiting_confirmation after proof upload (waiting for tutee to confirm)

      const res = await apiClient.post(
        `/tutors/booking-requests/${proofTarget.id}/complete`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );

      if (res.data?.success) {
        toast.success('Session proof uploaded. Waiting for tutee confirmation.');
        setProofModalOpen(false);
        setProofTarget(null);
        setProofFile(null);
        await fetchHistory();
      } else {
        throw new Error(res.data?.message || 'Failed to mark session');
      }
    } catch (err: any) {
      console.error('Failed to mark session for confirmation', err);
      toast.error(err?.response?.data?.message || err?.message || 'Failed to mark session');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3 sm:space-y-4 md:space-y-6 pb-6 sm:pb-8 md:pb-10">
      <ToastContainer aria-label="Notification messages" />

      {/* Header */}
      <div className="bg-gradient-to-br from-primary-600 via-primary-700 to-primary-800 rounded-xl sm:rounded-2xl p-4 sm:p-5 md:p-6 text-white shadow-2xl relative overflow-hidden -mx-2 sm:-mx-3 md:mx-0">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 right-0 w-40 h-40 bg-white rounded-full -mr-20 -mt-20 blur-2xl"></div>
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-white rounded-full -ml-16 -mb-16 blur-2xl"></div>
        </div>
        <div className="relative flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold mb-1 drop-shadow-lg flex items-center gap-2 sm:gap-3">
              <History className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 flex-shrink-0" />
              <span className="truncate">Session History</span>
            </h1>
            <p className="text-xs sm:text-sm md:text-base text-white/90 leading-tight">
              View and manage your completed sessions
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <Card className="p-6 sm:p-8 -mx-2 sm:-mx-3 md:mx-0">
          <div className="animate-pulse space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="h-32 bg-slate-100 rounded-lg" />
            ))}
          </div>
        </Card>
      ) : sessions.length === 0 ? (
        <Card className="p-6 sm:p-8 text-center bg-gradient-to-br from-white to-slate-50 rounded-xl sm:rounded-2xl shadow-xl border border-slate-200/50 -mx-2 sm:-mx-3 md:mx-0">
          <div className="p-3 bg-gradient-to-br from-primary-100 to-primary-200 rounded-full w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-4 flex items-center justify-center">
            <History className="h-10 w-10 sm:h-12 sm:w-12 text-primary-600" />
          </div>
          <h3 className="text-lg sm:text-xl font-bold text-slate-900 mb-2">No Upcoming Sessions</h3>
          <p className="text-sm sm:text-base text-slate-600">
            Your upcoming sessions will appear here.
          </p>
        </Card>
      ) : (
        <div className="space-y-3 sm:space-y-4">
          {sessions.map(session => {
            const isUpcoming = session.status === 'upcoming';
            const isAwaitingConfirmation = session.status === 'awaiting_confirmation';
            const isCompleted = session.status === 'completed';
            const isAdminPaymentPending = session.status === 'admin_payment_pending';

            return (
              <Card
                key={session.id}
                className="group relative bg-gradient-to-br from-white to-slate-50 rounded-xl sm:rounded-2xl shadow-xl border-2 border-slate-200/50 hover:border-primary-300 p-4 sm:p-5 md:p-6 -mx-2 sm:-mx-3 md:mx-0 transition-all duration-300 overflow-hidden hover:shadow-2xl"
              >
                {/* Decorative gradient bar */}
                <div className={`absolute top-0 left-0 right-0 h-1 ${isCompleted || isAdminPaymentPending
                    ? 'bg-gradient-to-r from-green-500 to-emerald-500' :
                    isAwaitingConfirmation
                      ? 'bg-gradient-to-r from-yellow-500 to-amber-500' :
                      isUpcoming
                        ? 'bg-gradient-to-r from-blue-500 to-indigo-500' :
                        'bg-gradient-to-r from-primary-500 to-primary-700'
                  }`} />

                <div className="flex flex-col gap-4 sm:gap-5">
                  {/* Header Row */}
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-900 mb-2 sm:mb-3 break-words">
                        {session.subject}
                      </h3>
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs sm:text-sm text-slate-600">
                        <span className="flex items-center gap-1.5 px-2.5 py-1 bg-white rounded-lg border border-slate-200">
                          <User className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary-600" />
                          {session.student?.name || 'Student'}
                        </span>
                        <span className="flex items-center gap-1.5 px-2.5 py-1 bg-white rounded-lg border border-slate-200">
                          <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </Calendar>
                          {new Date(session.date).toLocaleDateString()}
                        </span>
                        <span className="flex items-center gap-1.5 px-2.5 py-1 bg-white rounded-lg border border-slate-200">
                          <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </Clock>
                          {session.time}
                        </span>
                        <span className="flex items-center gap-1.5 px-2.5 py-1 bg-white rounded-lg border border-slate-200">
                          <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </Clock>
                          {session.duration} {session.duration === 1 ? 'hour' : 'hours'}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 flex-shrink-0 w-full sm:w-auto">
                      {isCompleted && (
                        <div className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm md:text-base font-bold flex items-center gap-1.5 sm:gap-2 shadow-md text-green-700 bg-green-50 border-2 border-green-400">
                          <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                          <span className="whitespace-nowrap">Completed</span>
                        </div>
                      )}
                      {isAdminPaymentPending && (
                        <div className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm md:text-base font-bold flex items-center gap-1.5 sm:gap-2 shadow-md text-indigo-700 bg-indigo-50 border-2 border-indigo-400">
                          <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                          <span className="whitespace-nowrap">Payment Pending</span>
                        </div>
                      )}
                      {isAwaitingConfirmation && (
                        <div className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm md:text-base font-bold flex items-center gap-1.5 sm:gap-2 shadow-md text-yellow-700 bg-yellow-50 border-2 border-yellow-400">
                          <Clock className="h-4 w-4 sm:h-5 sm:w-5" />
                          <span className="whitespace-nowrap">Awaiting Confirmation</span>
                        </div>
                      )}
                      {isUpcoming && !isSessionEligibleForMarkAsDone(session) && (
                        <div className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm md:text-base font-bold flex items-center gap-1.5 sm:gap-2 shadow-md border-2 ${hasSessionStarted(session)
                            ? "text-green-700 bg-green-50 border-green-400"
                            : "text-blue-700 bg-blue-50 border-blue-400"
                          }`}>
                          <Clock className="h-4 w-4 sm:h-5 sm:w-5" />
                          <span className={`h-2.5 w-2.5 rounded-full ${hasSessionStarted(session) ? "bg-green-500" : "bg-blue-500"}`} />
                          <span className="whitespace-nowrap">
                            {hasSessionStarted(session) ? "Session Started" : "Upcoming"}
                          </span>
                        </div>
                      )}
                      {isSessionEligibleForMarkAsDone(session) && (
                        <Button
                          onClick={() => handleMarkDoneSimple(session)}
                          disabled={loading}
                          className="bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 active:from-primary-800 active:to-primary-900 text-white rounded-xl px-4 sm:px-5 py-2 sm:py-2.5 shadow-md hover:shadow-lg transition-all text-xs sm:text-sm md:text-base font-semibold flex items-center justify-center gap-2 w-full sm:w-auto touch-manipulation min-h-[44px]"
                          style={{ WebkitTapHighlightColor: 'transparent' }}
                        >
                          <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                          <span>Mark as done</span>
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Session Details */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-3 sm:p-4 bg-gradient-to-r from-primary-50 via-primary-100/50 to-primary-50 rounded-xl border-2 border-primary-200/50 shadow-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-xs sm:text-sm font-semibold text-slate-700">Created:</span>
                      <span className="text-xs sm:text-sm md:text-base font-medium text-slate-900">
                        {new Date(session.created_at).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Tutee Rating */}
                  {session.rating && (
                    <div className="p-3 sm:p-4 bg-gradient-to-br from-yellow-50 via-amber-50/50 to-yellow-50 border-2 border-yellow-200 rounded-xl shadow-sm">
                      <div className="flex items-start gap-2 sm:gap-3">
                        <div className="p-2 bg-gradient-to-br from-yellow-100 to-yellow-200 rounded-lg flex-shrink-0 mt-0.5">
                          <Star className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-600 fill-current" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs sm:text-sm md:text-base font-semibold text-slate-800 mb-1.5 sm:mb-2 flex items-center gap-2">
                            Student Rating
                          </h4>
                          <div className="flex items-center gap-2 mb-2">
                            {renderStars(session.rating)}
                          </div>
                          {session.rating_comment && (
                            <p className="text-xs sm:text-sm md:text-base text-slate-700 leading-relaxed whitespace-pre-wrap break-words italic">
                              "{session.rating_comment}"
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Student Notes */}
                  {session.student_notes && (
                    <div className="p-3 sm:p-4 bg-gradient-to-br from-slate-50 via-primary-50/50 to-slate-50 rounded-xl border-2 border-slate-200/50 shadow-sm">
                      <div className="flex items-start gap-2 sm:gap-3">
                        <div className="p-2 bg-gradient-to-br from-primary-100 to-primary-200 rounded-lg flex-shrink-0 mt-0.5">
                          <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-primary-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs sm:text-sm md:text-base font-semibold text-slate-800 mb-1.5 sm:mb-2 flex items-center gap-2">
                            Student Notes
                          </h4>
                          <p className="text-xs sm:text-sm md:text-base text-slate-700 leading-relaxed whitespace-pre-wrap break-words">
                            {session.student_notes}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Upcoming Sessions Table */}
      {upcomingSessionsWithData.length > 0 && (
        <Card className="p-0 bg-gradient-to-br from-white via-primary-50/10 to-white rounded-xl shadow-xl border-2 border-primary-200/60 overflow-hidden -mx-2 sm:-mx-3 md:mx-0">
          {/* Enhanced Header with Gradient Background */}
          <div className="bg-gradient-to-r from-primary-600 via-primary-700 to-primary-800 px-4 sm:px-5 py-3 sm:py-4 relative overflow-hidden">
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-0 right-0 w-40 h-40 bg-white rounded-full -mr-20 -mt-20 blur-2xl"></div>
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-white rounded-full -ml-16 -mb-16 blur-2xl"></div>
            </div>
            <div className="relative flex items-center gap-3">
              <div className="p-2 bg-white/20 backdrop-blur-sm rounded-lg shadow-lg">
                <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-white drop-shadow-md">
                  Upcoming Sessions
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  <div className="px-2 py-0.5 bg-white/20 backdrop-blur-sm rounded-full border border-white/30">
                    <p className="text-xs sm:text-sm font-semibold text-white">
                      {upcomingSessionsWithData.length} {upcomingSessionsWithData.length === 1 ? 'Session' : 'Sessions'}
                    </p>
                  </div>
                  <div className="px-2 py-0.5 bg-white/20 backdrop-blur-sm rounded-full border border-white/30">
                    <p className="text-xs sm:text-sm font-semibold text-white">
                      {totalUpcomingHours.toFixed(1)} Hours
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Desktop Table View */}
          <div className="hidden lg:block overflow-x-auto">
            <div className="inline-block min-w-full align-middle">
              <div className="overflow-hidden">
                <table className="min-w-full divide-y divide-slate-200/40">
                  <thead className="bg-gradient-to-r from-slate-50 via-primary-50/50 to-slate-50">
                    <tr>
                      <th scope="col" className="px-4 py-2.5 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Subject
                      </th>
                      <th scope="col" className="px-4 py-2.5 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Student
                      </th>
                      <th scope="col" className="px-4 py-2.5 text-center text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Duration
                      </th>
                      <th scope="col" className="px-4 py-2.5 text-right text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Expected Earnings
                      </th>
                      <th scope="col" className="px-4 py-2.5 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Notes
                      </th>
                      <th scope="col" className="px-4 py-2.5 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Date & Time
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-100/50">
                    {upcomingSessionsWithData.map((session, index) => {
                      // Calculate expected earnings from actual payment amount (not from session rate)
                      // Find payment with booking_request_id matching this session from all payments
                      const payment = payments.find((p: any) => {
                        const bookingId = p.booking_request_id || (p.bookingRequest as any)?.id;
                        const sessionId = session.id;
                        const matches = bookingId === sessionId || bookingId === Number(sessionId) || Number(bookingId) === sessionId;

                        if (index === 0) {
                          console.log('[SessionHistory] Payment matching:', {
                            paymentId: p.payment_id || p.id,
                            bookingId,
                            sessionId,
                            matches,
                            paymentAmount: p.amount,
                            allPayments: payments.length
                          });
                        }

                        return matches;
                      });

                      // Use actual payment amount * 0.87 if payment exists
                      // If no payment exists, calculate from session rate as fallback
                      let expectedEarnings = 0;
                      if (payment && payment.amount) {
                        expectedEarnings = Number(payment.amount) * 0.87;
                        if (index === 0) {
                          console.log('[SessionHistory] Using payment amount:', {
                            paymentAmount: payment.amount,
                            expectedEarnings
                          });
                        }
                      } else {
                        // Fallback: calculate from session rate if no payment found
                        const ratePerHour = session.session_rate_per_hour || sessionRate || 0;
                        const duration = Number(session.duration ?? 0);
                        expectedEarnings = ratePerHour * duration * 0.87;
                        if (index === 0) {
                          console.log('[SessionHistory] No payment found, using rate calculation:', {
                            ratePerHour,
                            duration,
                            expectedEarnings
                          });
                        }
                      }

                      const ratePerHour = session.session_rate_per_hour || sessionRate || 0;
                      const duration = Number(session.duration ?? 0);

                      return (
                        <tr
                          key={session.id}
                          className={`group hover:bg-gradient-to-r hover:from-primary-50/80 hover:via-primary-50/40 hover:to-transparent transition-all duration-300 cursor-pointer ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/20'
                            }`}
                        >
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg shadow-sm group-hover:shadow-md transition-shadow">
                                <BookOpen className="h-3.5 w-3.5 text-white" />
                              </div>
                              <span className="text-sm font-bold text-slate-800 group-hover:text-primary-700 transition-colors">
                                {session.subject}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <div className="p-1 bg-gradient-to-br from-primary-100 to-primary-200 rounded-full shadow-sm">
                                <User className="h-3.5 w-3.5 text-primary-700" />
                              </div>
                              <span className="text-sm font-semibold text-slate-700">
                                {session.student?.name || 'Student'}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-center">
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-slate-100 to-slate-50 rounded-lg border border-slate-200 shadow-sm">
                              <Clock className="h-3.5 w-3.5 text-primary-600" />
                              <span className="text-sm font-bold text-slate-800">
                                {session.duration} {session.duration === 1 ? 'hr' : 'hrs'}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-right">
                            <div className="flex flex-col items-end gap-0.5">
                              <div className="px-2.5 py-1 bg-gradient-to-r from-emerald-50 to-green-50 rounded-lg border border-emerald-200/50 shadow-sm">
                                <div className="flex items-center gap-1">
                                  <DollarSign className="h-3.5 w-3.5 text-emerald-700" />
                                  <span className="text-sm font-bold text-emerald-700">
                                    ₱{expectedEarnings.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </span>
                                </div>
                              </div>
                              {ratePerHour > 0 && (
                                <div className="flex flex-col items-end">
                                  <span className="text-[10px] text-slate-500 font-medium">
                                    (₱{ratePerHour.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/hr)
                                  </span>
                                  <span className="text-[9px] text-amber-600 font-semibold">
                                    After 13% fee
                                  </span>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {session.student_notes ? (
                              <div className="max-w-xs">
                                <p className="text-xs text-slate-700 line-clamp-2 break-words bg-gradient-to-r from-slate-50 to-primary-50/30 px-2.5 py-1.5 rounded-lg border border-slate-200/50 shadow-sm">
                                  {session.student_notes}
                                </p>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400 italic font-medium">No notes</span>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-1.5">
                                <Calendar className="h-3.5 w-3.5 text-primary-600" />
                                <span className="text-sm font-semibold text-slate-700">
                                  {new Date(session.date).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric'
                                  })}
                                </span>
                              </div>
                              <span className="text-xs text-slate-500 font-medium ml-5">
                                {session.time}
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-gradient-to-r from-primary-600 via-primary-700 to-primary-800">
                    <tr>
                      <td colSpan={3} className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 bg-white/20 backdrop-blur-sm rounded-lg">
                            <TrendingUp className="h-4 w-4 text-white" />
                          </div>
                          <span className="text-sm font-bold text-white">Total Summary</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex flex-col items-end gap-1">
                          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 backdrop-blur-sm rounded-lg border border-white/30">
                            <DollarSign className="h-4 w-4 text-white" />
                            <span className="text-base font-bold text-white">
                              ₱{totalUpcomingEarnings.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                          <span className="text-[10px] text-white/90 font-semibold">
                            After 13% service fee
                          </span>
                        </div>
                      </td>
                      <td colSpan={2} className="px-4 py-3"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>

          {/* Mobile/Tablet Card View */}
          <div className="lg:hidden space-y-3 sm:space-y-4">
            {upcomingSessionsWithData.map((session, index) => {
              // Calculate expected earnings from actual payment amount (not from session rate)
              // Find payment with booking_request_id matching this session from all payments
              const payment = payments.find((p: any) => {
                const bookingId = p.booking_request_id || (p.bookingRequest as any)?.id;
                return bookingId === session.id || bookingId === Number(session.id);
              });

              // Use actual payment amount * 0.87 if payment exists
              // If no payment exists, calculate from session rate as fallback
              let expectedEarnings = 0;
              if (payment && payment.amount) {
                expectedEarnings = Number(payment.amount) * 0.87;
              } else {
                // Fallback: calculate from session rate if no payment found
                const ratePerHour = session.session_rate_per_hour || sessionRate || 0;
                const duration = Number(session.duration ?? 0);
                expectedEarnings = ratePerHour * duration * 0.87;
              }

              const ratePerHour = session.session_rate_per_hour || sessionRate || 0;
              const duration = Number(session.duration ?? 0);

              return (
                <div
                  key={session.id}
                  className="bg-gradient-to-br from-white via-primary-50/10 to-white rounded-xl border-2 border-primary-200/60 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden group"
                >
                  {/* Enhanced Card Header */}
                  <div className="bg-gradient-to-r from-primary-600 via-primary-700 to-primary-800 px-3 py-2.5 relative overflow-hidden">
                    <div className="absolute inset-0 opacity-10">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-white rounded-full -mr-12 -mt-12 blur-xl"></div>
                    </div>
                    <div className="relative flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-white/20 backdrop-blur-sm rounded-lg shadow-md">
                          <BookOpen className="h-4 w-4 text-white" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-white drop-shadow-md">{session.subject}</h3>
                          <p className="text-[10px] text-white/90 font-medium mt-0.5">{session.student?.name || 'Student'}</p>
                        </div>
                      </div>
                      <div className="px-2 py-1 bg-white/20 backdrop-blur-sm rounded-lg border border-white/30">
                        <span className="text-[10px] font-bold text-white">Upcoming</span>
                      </div>
                    </div>
                  </div>

                  {/* Enhanced Card Body */}
                  <div className="p-3 space-y-2">
                    {/* Student & Date Row */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex items-center gap-2 p-2 bg-gradient-to-br from-slate-50 to-primary-50/30 rounded-lg border border-slate-200/50 shadow-sm">
                        <div className="p-1 bg-gradient-to-br from-primary-100 to-primary-200 rounded-lg">
                          <User className="h-3.5 w-3.5 text-primary-700" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[9px] text-slate-500 font-semibold uppercase tracking-wide">Student</p>
                          <p className="text-xs font-bold text-slate-800 truncate">{session.student?.name || 'Student'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 p-2 bg-gradient-to-br from-slate-50 to-primary-50/30 rounded-lg border border-slate-200/50 shadow-sm">
                        <div className="p-1 bg-gradient-to-br from-primary-100 to-primary-200 rounded-lg">
                          <Calendar className="h-3.5 w-3.5 text-primary-700" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[9px] text-slate-500 font-semibold uppercase tracking-wide">Date</p>
                          <p className="text-xs font-bold text-slate-800">
                            {new Date(session.date).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </p>
                          <p className="text-[9px] text-slate-500 font-medium mt-0.5">{session.time}</p>
                        </div>
                      </div>
                    </div>

                    {/* Duration & Expected Earnings Row */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex items-center gap-2 p-2 bg-gradient-to-br from-slate-50 to-primary-50/30 rounded-lg border border-slate-200/50 shadow-sm">
                        <div className="p-1 bg-gradient-to-br from-primary-100 to-primary-200 rounded-lg">
                          <Clock className="h-3.5 w-3.5 text-primary-700" />
                        </div>
                        <div>
                          <p className="text-[9px] text-slate-500 font-semibold uppercase tracking-wide">Duration</p>
                          <p className="text-xs font-bold text-slate-800">
                            {session.duration} {session.duration === 1 ? 'hr' : 'hrs'}
                          </p>
                        </div>
                      </div>
                      <div className="p-2 bg-gradient-to-br from-emerald-50 via-green-50 to-emerald-50 rounded-lg border-2 border-emerald-200/60 shadow-sm">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <DollarSign className="h-3.5 w-3.5 text-emerald-700" />
                          <p className="text-[9px] text-emerald-700 font-semibold uppercase tracking-wide">Expected Earnings</p>
                        </div>
                        <p className="text-sm font-bold text-emerald-700 mb-0.5">
                          ₱{expectedEarnings.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                        {ratePerHour > 0 && (
                          <div className="space-y-0.5">
                            <p className="text-[8px] text-emerald-600 font-medium">
                              (₱{ratePerHour.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/hr)
                            </p>
                            <p className="text-[8px] text-amber-600 font-semibold">
                              After 13% fee
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Student Notes */}
                    {session.student_notes && (
                      <div className="p-3 bg-gradient-to-br from-primary-50/50 to-slate-50 rounded-lg border border-primary-200/50">
                        <div className="flex items-start gap-2">
                          <FileText className="h-4 w-4 text-primary-600 flex-shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] text-primary-700 font-semibold mb-1 uppercase tracking-wide">Student Notes</p>
                            <p className="text-xs text-slate-700 leading-relaxed break-words">{session.student_notes}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Enhanced Mobile Summary Card */}
            <div className="bg-gradient-to-r from-primary-600 via-primary-700 to-primary-800 rounded-xl p-3.5 shadow-xl border-2 border-primary-400/50 relative overflow-hidden">
              <div className="absolute inset-0 opacity-10">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-full -mr-16 -mt-16 blur-2xl"></div>
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-white rounded-full -ml-12 -mb-12 blur-2xl"></div>
              </div>
              <div className="relative">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1.5 bg-white/20 backdrop-blur-sm rounded-lg">
                    <TrendingUp className="h-4 w-4 text-white" />
                  </div>
                  <h3 className="text-sm font-bold text-white drop-shadow-md">Total Summary</h3>
                </div>
                <div className="bg-white/20 backdrop-blur-sm rounded-lg p-2.5 border border-white/30 shadow-md">
                  <div className="flex items-center gap-1.5 mb-1">
                    <DollarSign className="h-3.5 w-3.5 text-white" />
                    <p className="text-[9px] text-white/90 font-semibold uppercase tracking-wide">Expected Earnings</p>
                  </div>
                  <p className="text-base font-bold text-white mb-0.5">
                    ₱{totalUpcomingEarnings.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <p className="text-[8px] text-white/90 font-semibold">
                    After 13% fee
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Enhanced Info Note */}
          <div className="mt-4 p-3 sm:p-4 bg-gradient-to-br from-primary-50 via-amber-50/40 to-primary-50 border-2 border-primary-200/70 rounded-xl shadow-md">
            <div className="flex items-start gap-2.5">
              <div className="p-1.5 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg shadow-sm flex-shrink-0">
                <Info className="h-4 w-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm text-primary-900 leading-relaxed font-medium">
                  <span className="font-bold text-primary-800">Note:</span> Expected earnings are calculated based on the actual payment amount (if available) or your session rate per hour multiplied by the session duration, with a 13% service fee deduction. Actual payment will be processed after session completion.
                </p>
              </div>
            </div>
          </div>
        </Card>
      )}

      {proofModalOpen && proofTarget && (
        <Modal
          isOpen={true}
          onClose={() => { setProofModalOpen(false); setProofTarget(null); setProofFile(null); }}
          title="Upload Session Proof"
          footer={<>
            <Button
              onClick={handleMarkDone}
              disabled={loading || !proofFile}
              className="bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white shadow-lg hover:shadow-xl"
            >
              {loading ? 'Uploading...' : 'Confirm'}
            </Button>
            <Button
              variant="secondary"
              onClick={() => { setProofModalOpen(false); setProofTarget(null); setProofFile(null); }}
            >
              Cancel
            </Button>
          </>}
        >
          <div className="space-y-4">
            <p className="text-sm sm:text-base text-slate-700">
              Please upload a screenshot or image as proof that the session was conducted.
            </p>
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-800">
                Select Image
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setProofFile(e.target.files ? e.target.files[0] : null)}
                className="w-full text-xs sm:text-sm md:text-base file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs sm:file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100 transition-colors"
              />
              {proofFile && (
                <div className="flex items-center gap-2 p-2.5 sm:p-3 bg-green-50 border border-green-200 rounded-lg">
                  <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 flex-shrink-0" />
                  <span className="text-xs sm:text-sm text-green-700 truncate flex-1">{proofFile.name}</span>
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default SessionHistory;

