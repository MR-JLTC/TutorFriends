import React, { useState, useEffect, useMemo } from 'react';
import apiClient, { getFileUrl } from '../../services/api';
import Button from '../ui/Button';
import Card from '../ui/Card';
import { useAuth } from '../../hooks/useAuth';
import Modal from '../ui/Modal';
import { DollarSign, TrendingUp, Clock, CheckCircle, Star, Calendar, X, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../ui/Toast';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface Session {
  id: number;
  student_name: string;
  subject: string;
  date: string;
  duration: number;
  hourly_rate: number;
  total_amount: number;
  status: 'completed' | 'pending' | 'cancelled';
  payment_status: 'pending' | 'approved' | 'paid';
  created_at: string;
}

interface Payment {
  id: number;
  payment_id: number;
  session_id?: number;
  amount: number;
  subject?: string | null;
  status: 'pending' | 'paid' | 'admin_confirmed' | 'confirmed' | 'rejected' | 'refunded';
  payment_date?: string;
  created_at: string;
  student_name?: string;
  student_id?: number;
  tutor_id?: number;
  dispute_status?: string;
  dispute_proof_url?: string;
  admin_note?: string;
  admin_payment_proof_url?: string;
}

interface EarningsStats {
  total_earnings: number;
  pending_earnings: number;
  completed_sessions: number;
  average_rating: number;
  total_hours: number;
}

interface BookingRequest {
  id: number;
  subject: string;
  tutee_rating?: number;
  status: string;
}

interface SubjectRating {
  subject: string;
  averageRating: number;
  totalRatings: number;
}

const EarningsHistory: React.FC = () => {
  const { user } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();
  const [tutorId, setTutorId] = useState<number | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [bookingRequests, setBookingRequests] = useState<BookingRequest[]>([]);
  const [stats, setStats] = useState<EarningsStats>({
    total_earnings: 0,
    pending_earnings: 0,
    completed_sessions: 0,
    average_rating: 0,
    total_hours: 0
  });
  const [loading, setLoading] = useState(false);
  const [proofModalOpen, setProofModalOpen] = useState(false);
  const [proofModalUrl, setProofModalUrl] = useState<string | null>(null);
  const [proofModalTitle, setProofModalTitle] = useState<string>('');
  const [viewedProofByPayment, setViewedProofByPayment] = useState<Record<number, boolean>>({});
  const [hiddenConfirm, setHiddenConfirm] = useState<Record<number, boolean>>({});
  const [filter, setFilter] = useState<'all' | 'completed' | 'pending'>('all');
  const [paymentsFilter, setPaymentsFilter] = useState<'all' | 'pending' | 'approved'>('all');
  const [initialized, setInitialized] = useState(false);
  const [monthsFilter, setMonthsFilter] = useState<number>(6);

  useEffect(() => {
    if (user?.user_id) {
      // Fetch the actual tutor_id instead of using user_id
      const fetchTutorId = async () => {
        try {
          const response = await apiClient.get(`/tutors/by-user/${user.user_id}/tutor-id`);
          const actualTutorId = response.data.tutor_id;
          if (actualTutorId) {
            setTutorId(actualTutorId);
          } else {
            // Fallback to user_id if the endpoint fails (backend accepts user_id too)
            setTutorId(user.user_id);
          }
        } catch (error: any) {
          console.error('Failed to fetch tutor ID:', error);
          // Fallback to user_id if the endpoint fails (backend accepts user_id too)
          setTutorId(user.user_id);
        }
      };
      fetchTutorId();
    }
  }, [user]);

  useEffect(() => {
    if (tutorId) {
      const init = async () => {
        await fetchEarningsData(true);
        setInitialized(true);
      };
      init();
      // Background refresh every 10s to reflect approvals automatically
      const interval = setInterval(() => {
        fetchEarningsData(false);
      }, 10000);
      // Refresh when the window regains focus
      const onFocus = () => fetchEarningsData(false);
      window.addEventListener('focus', onFocus);
      return () => {
        clearInterval(interval);
        window.removeEventListener('focus', onFocus);
      };
    }
  }, [tutorId]);

  const fetchEarningsData = async (isInitial: boolean = false) => {
    if (!tutorId) return;
    try {
      if (isInitial) setLoading(true);
      const [sessionsRes, paymentsRes, payoutsRes, statsRes, bookingsRes] = await Promise.all([
        apiClient.get(`/tutors/${tutorId}/sessions`),
        apiClient.get(`/tutors/${tutorId}/payments`),
        apiClient.get(`/tutors/${tutorId}/payouts`),
        apiClient.get(`/tutors/${tutorId}/earnings-stats`),
        apiClient.get(`/tutors/${tutorId}/booking-requests`)
      ]);

      setSessions(sessionsRes.data);
      console.log('[EarningsHistory] Raw Payments Data:', paymentsRes.data);
      console.log('[EarningsHistory] Raw Payouts Data:', payoutsRes.data);
      setPayments(paymentsRes.data);
      setPayouts(payoutsRes.data || []);
      setStats(statsRes.data);
      setBookingRequests(bookingsRes.data || []);
    } catch (error) {
      console.error('Failed to fetch earnings data:', error);
    } finally {
      if (isInitial) setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-50 border-green-200';
      case 'pending': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'cancelled': return 'text-red-600 bg-red-50 border-red-200';
      case 'approved': return 'text-primary-600 bg-primary-50 border-primary-200';
      case 'confirmed': return 'text-green-600 bg-green-50 border-green-200';
      case 'admin_confirmed': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'admin_paid': return 'text-emerald-600 bg-emerald-50 border-emerald-200';
      case 'rejected': return 'text-red-600 bg-red-50 border-red-200';
      case 'refunded': return 'text-purple-600 bg-purple-50 border-purple-200';
      case 'paid': return 'text-green-600 bg-green-50 border-green-200';
      default: return 'text-slate-600 bg-slate-50 border-slate-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4" />;
      case 'pending': return <Clock className="h-4 w-4" />;
      case 'cancelled': return <X className="h-4 w-4" />;
      case 'approved': return <CheckCircle className="h-4 w-4" />;
      case 'confirmed': return <CheckCircle className="h-4 w-4" />;
      case 'admin_confirmed': return <CheckCircle className="h-4 w-4" />;
      case 'admin_paid': return <DollarSign className="h-4 w-4" />;
      case 'rejected': return <X className="h-4 w-4" />;
      case 'refunded': return <DollarSign className="h-4 w-4" />;
      case 'paid': return <DollarSign className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const filteredSessions = sessions.filter(session => {
    if (filter === 'all') return true;
    return session.status === filter;
  });

  // Get payment IDs that have payouts (convert to numbers for consistent comparison)
  // Include all payouts regardless of status - if a payout exists, the payment has been processed
  const paymentIdsWithPayouts = useMemo(() => {
    const payoutPaymentIds = payouts
      .map(p => {
        // Try multiple possible field names for payment_id
        const pid = p.payment_id || (p.payment as any)?.payment_id || (p.payment as any)?.id;
        const numPid = pid ? Number(pid) : null;
        if (numPid && !isNaN(numPid)) {
          return numPid;
        }
        return null;
      })
      .filter((pid: any) => pid !== null && !isNaN(pid));

    // Debug logging
    if (payouts.length > 0) {
      console.log('[EarningsHistory] Payouts:', payouts);
      console.log('[EarningsHistory] Payment IDs from payouts:', payoutPaymentIds);
    }

    return new Set(payoutPaymentIds);
  }, [payouts]);

  // Filter payments: only show "confirmed" payments that don't have payouts
  const confirmedPaymentsWithoutPayouts = useMemo(() => {
    const confirmedPayments = payments.filter(p => p.status === 'confirmed');

    const filtered = confirmedPayments.filter(p => {
      const paymentId = p.payment_id || p.id;
      const paymentIdNum = paymentId ? Number(paymentId) : null;

      // Exclude if payment ID is invalid
      if (paymentIdNum === null || isNaN(paymentIdNum)) {
        console.warn('[EarningsHistory] Payment with invalid ID:', p);
        return false;
      }

      const hasPayout = paymentIdsWithPayouts.has(paymentIdNum);

      // Debug logging for payments with payouts
      if (hasPayout) {
        console.log(`[EarningsHistory] Excluding payment ${paymentIdNum} - has payout`);
      }

      return !hasPayout;
    });

    // Debug logging
    console.log(`[EarningsHistory] Total payments: ${payments.length}`);
    console.log(`[EarningsHistory] Confirmed payments: ${confirmedPayments.length}`);
    console.log(`[EarningsHistory] Confirmed without payouts: ${filtered.length}`);
    console.log(`[EarningsHistory] Payment IDs with payouts:`, Array.from(paymentIdsWithPayouts));

    return filtered;
  }, [payments, paymentIdsWithPayouts]);

  const pendingPaymentsCount = payments.filter(p => p.status === 'pending').length;
  const approvedPaymentsCount = confirmedPaymentsWithoutPayouts.length;
  const filteredPayments = useMemo(() => {
    if (paymentsFilter === 'all') {
      return confirmedPaymentsWithoutPayouts;
    }
    if (paymentsFilter === 'approved') {
      return confirmedPaymentsWithoutPayouts;
    }
    return payments.filter(p => p.status === paymentsFilter);
  }, [paymentsFilter, confirmedPaymentsWithoutPayouts, payments]);

  // Filter payments with status "confirmed" that don't have payouts (for calculations)
  const confirmedPaymentsWithoutPayoutsForCalc = useMemo(() => {
    return payments.filter(p => {
      const paymentId = p.payment_id || p.id;
      const paymentIdNum = paymentId ? Number(paymentId) : null;
      return p.status === 'confirmed' &&
        paymentIdNum !== null &&
        !paymentIdsWithPayouts.has(paymentIdNum);
    });
  }, [payments, paymentIdsWithPayouts]);

  // Prepare chart data for payouts over time
  const chartData = useMemo(() => {
    const lastNMonths = Array.from({ length: monthsFilter }, (_, i) => {
      const date = new Date();
      date.setMonth(date.getMonth() - (monthsFilter - 1 - i));
      return {
        month: date.toLocaleDateString('en-US', { month: 'short' }),
        monthIndex: date.getMonth(),
        year: date.getFullYear()
      };
    });

    return lastNMonths.map(({ month, monthIndex, year }) => {
      // Filter payouts by date
      const monthPayouts = payouts.filter(p => {
        if (!p.created_at) return false;
        const payoutDate = new Date(p.created_at);
        return payoutDate.getMonth() === monthIndex &&
          payoutDate.getFullYear() === year;
      });

      // Calculate totals from payouts
      // amount_released is already 87% of the original payment
      // So gross = amount_released / 0.87
      // Service fee = gross * 0.13 = (amount_released / 0.87) * 0.13
      const totalAmountReleased = monthPayouts.reduce((sum, p) => sum + Number(p.amount_released || 0), 0);
      const grossAmount = totalAmountReleased / 0.87; // Convert back to gross (original payment amount)
      const netEarnings = totalAmountReleased; // Already net (87% of original)
      const serviceFee = grossAmount * 0.13; // 13% of gross

      return {
        month,
        'Gross Amount': Number(grossAmount.toFixed(2)),
        'Net Earnings': Number(netEarnings.toFixed(2)),
        'Service Fee': Number(serviceFee.toFixed(2))
      };
    });
  }, [payouts, monthsFilter]);

  // Calculate total earnings from payouts with status 'released'
  const totalAdminEarnings = useMemo(() => {
    return payouts
      .filter(p => p.status === 'released')
      .reduce((sum, p) => sum + Number(p.amount_released || 0), 0);
  }, [payouts]);

  // Calculate upcoming earnings: Sum of 87% (after 13% deduction) of each confirmed payment without payout
  const upcomingEarnings = useMemo(() => {
    if (!confirmedPaymentsWithoutPayoutsForCalc || confirmedPaymentsWithoutPayoutsForCalc.length === 0) {
      return 0;
    }

    return confirmedPaymentsWithoutPayoutsForCalc.reduce((sum, p) => {
      const amount = Number(p.amount) || 0;
      const netAmount = amount * 0.87; // After 13% service fee
      return sum + netAmount;
    }, 0);
  }, [confirmedPaymentsWithoutPayoutsForCalc]);

  // Calculate service fee: Sum of 13% of each confirmed payment without payout
  const totalServiceFee = useMemo(() => {
    if (!confirmedPaymentsWithoutPayoutsForCalc || confirmedPaymentsWithoutPayoutsForCalc.length === 0) {
      return 0;
    }

    return confirmedPaymentsWithoutPayoutsForCalc.reduce((sum, p) => {
      const amount = Number(p.amount) || 0;
      const serviceFee = amount * 0.13; // 13% service fee
      return sum + serviceFee;
    }, 0);
  }, [confirmedPaymentsWithoutPayoutsForCalc]);

  // Calculate gross income: Sum of all confirmed payments without payout (gross amount)
  const grossIncome = useMemo(() => {
    if (!confirmedPaymentsWithoutPayoutsForCalc || confirmedPaymentsWithoutPayoutsForCalc.length === 0) {
      return 0;
    }

    return confirmedPaymentsWithoutPayoutsForCalc.reduce((sum, p) => {
      const amount = Number(p.amount) || 0;
      return sum + amount;
    }, 0);
  }, [confirmedPaymentsWithoutPayoutsForCalc]);

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`h-4 w-4 ${i < Math.floor(rating) ? 'text-yellow-400 fill-current' : 'text-slate-300'
          }`}
      />
    ));
  };

  // Calculate exact count of completed sessions from booking requests
  const exactCompletedSessions = useMemo(() => {
    return bookingRequests.filter(booking =>
      booking.status && booking.status.toLowerCase() === 'completed'
    ).length;
  }, [bookingRequests]);

  // Calculate average rating per subject
  const subjectRatings = useMemo(() => {
    const ratingsBySubject: Record<string, number[]> = {};

    bookingRequests.forEach(booking => {
      if (booking.tutee_rating && booking.tutee_rating > 0 && booking.subject) {
        if (!ratingsBySubject[booking.subject]) {
          ratingsBySubject[booking.subject] = [];
        }
        ratingsBySubject[booking.subject].push(Number(booking.tutee_rating));
      }
    });

    const subjectRatingList: SubjectRating[] = Object.entries(ratingsBySubject).map(([subject, ratings]) => {
      const sum = ratings.reduce((acc, rating) => acc + rating, 0);
      const average = sum / ratings.length;
      return {
        subject,
        averageRating: average,
        totalRatings: ratings.length
      };
    });

    return subjectRatingList.sort((a, b) => b.averageRating - a.averageRating);
  }, [bookingRequests]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading earnings data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4 md:space-y-6 pb-6 sm:pb-8 md:pb-10">
      <div className="bg-gradient-to-br from-primary-600 via-primary-700 to-primary-800 rounded-xl sm:rounded-2xl p-4 sm:p-5 md:p-6 text-white shadow-2xl relative overflow-hidden -mx-2 sm:-mx-3 md:mx-0">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 right-0 w-40 h-40 bg-white rounded-full -mr-20 -mt-20 blur-2xl"></div>
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-white rounded-full -ml-16 -mb-16 blur-2xl"></div>
        </div>
        <div className="relative flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold mb-1 drop-shadow-lg flex items-center gap-2 sm:gap-3">
              <DollarSign className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 flex-shrink-0" />
              <span className="truncate">Earnings & History</span>
            </h1>
            <p className="text-xs sm:text-sm md:text-base text-white/90 leading-tight">Track your completed sessions and earnings</p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <Card className="p-4 sm:p-5 md:p-6 bg-gradient-to-br from-white to-slate-50 rounded-xl sm:rounded-2xl shadow-xl border border-slate-200/50 hover:shadow-2xl transition-all duration-300 -mx-2 sm:-mx-3 md:mx-0">
          <div className="flex items-center">
            <div className="p-2.5 sm:p-3 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl mr-3 flex-shrink-0 shadow-lg">
              <DollarSign className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm font-semibold text-slate-600 uppercase tracking-wide">Total Earnings</p>
              <p className="text-xl sm:text-2xl md:text-3xl font-bold text-primary-700 truncate">
                ₱{totalAdminEarnings.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4 sm:p-5 md:p-6 bg-gradient-to-br from-white to-slate-50 rounded-xl sm:rounded-2xl shadow-xl border border-slate-200/50 hover:shadow-2xl transition-all duration-300 -mx-2 sm:-mx-3 md:mx-0">
          <div className="flex items-center">
            <div className="p-2.5 sm:p-3 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl mr-3 flex-shrink-0 shadow-lg">
              <CheckCircle className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm font-semibold text-slate-600 uppercase tracking-wide">Completed Sessions</p>
              <p className="text-xl sm:text-2xl md:text-3xl font-bold text-primary-700">{exactCompletedSessions}</p>
            </div>
          </div>
        </Card>

      </div>

      {/* Average Rating per Subject */}
      {subjectRatings.length > 0 && (
        <Card className="p-4 sm:p-5 md:p-6 bg-gradient-to-br from-white to-slate-50 rounded-xl sm:rounded-2xl shadow-xl border border-slate-200/50 hover:shadow-2xl transition-all duration-300 -mx-2 sm:-mx-3 md:mx-0">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl shadow-lg">
              <Star className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
            </div>
            <h2 className="text-lg sm:text-xl md:text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">Average Rating per Subject</h2>
          </div>
          <div className="space-y-3 sm:space-y-4">
            {subjectRatings.map((subjectRating) => (
              <div key={subjectRating.subject} className="flex items-center justify-between p-3 sm:p-4 bg-slate-50 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-sm sm:text-base font-semibold text-slate-900 mb-1 truncate">{subjectRating.subject}</p>
                  <p className="text-xs sm:text-sm text-slate-600">
                    {subjectRating.totalRatings} {subjectRating.totalRatings === 1 ? 'rating' : 'ratings'}
                  </p>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 ml-4">
                  <div className="flex items-center gap-1">
                    {renderStars(subjectRating.averageRating)}
                  </div>
                  <span className="text-base sm:text-lg md:text-xl font-bold text-primary-700 min-w-[3rem] text-right">
                    {subjectRating.averageRating.toFixed(1)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Additional Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        <Card className="p-4 sm:p-5 md:p-6 bg-gradient-to-br from-white to-slate-50 rounded-xl sm:rounded-2xl shadow-xl border border-slate-200/50 hover:shadow-2xl transition-all duration-300 -mx-2 sm:-mx-3 md:mx-0">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl shadow-lg">
              <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
            </div>
            <h2 className="text-lg sm:text-xl md:text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">Performance Overview</h2>
          </div>
          <div className="space-y-3 sm:space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-[10px] sm:text-xs md:text-sm text-slate-600">Total Hours Tutored</span>
              <span className="text-xs sm:text-sm md:text-base font-semibold text-slate-800">{stats.total_hours} hours</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[10px] sm:text-xs md:text-sm text-slate-600">Average Session Duration</span>
              <span className="text-xs sm:text-sm md:text-base font-semibold text-slate-800">
                {exactCompletedSessions > 0
                  ? (stats.total_hours / exactCompletedSessions).toFixed(1)
                  : '0'
                } hours
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[10px] sm:text-xs md:text-sm text-slate-600">Average Hourly Rate</span>
              <span className="text-xs sm:text-sm md:text-base font-semibold text-slate-800">
                ₱{stats.total_hours > 0
                  ? (stats.total_earnings / stats.total_hours).toFixed(0)
                  : '0'
                }
              </span>
            </div>
          </div>
        </Card>

        <Card className="p-4 sm:p-5 md:p-6 bg-gradient-to-br from-white to-slate-50 rounded-xl sm:rounded-2xl shadow-xl border border-slate-200/50 hover:shadow-2xl transition-all duration-300 -mx-2 sm:-mx-3 md:mx-0">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl shadow-lg">
              <Calendar className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
            </div>
            <h2 className="text-lg sm:text-xl md:text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">Upcoming Payouts</h2>
          </div>

          {/* Service Fee Information */}
          <div className="mb-4 p-3 sm:p-4 bg-gradient-to-r from-amber-50 via-yellow-50 to-amber-50 rounded-xl border-2 border-amber-200 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-100 rounded-lg flex-shrink-0">
                <Info className="h-4 w-4 sm:h-5 sm:w-5 text-amber-700" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-xs sm:text-sm font-bold text-amber-900 mb-1.5">Service Fee Information</h3>
                <p className="text-[10px] sm:text-xs text-amber-800 mb-2">
                  A <span className="font-bold">13% service fee</span> will be deducted from each payment you receive through TutorLink platform.
                </p>
                <div className="grid grid-cols-3 gap-2 sm:gap-3 text-[10px] sm:text-xs">
                  <div className="bg-white/60 rounded-lg p-2">
                    <p className="text-amber-700 font-medium">Gross Income</p>
                    <p className="text-amber-900 font-bold text-sm sm:text-base">₱{grossIncome.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                  <div className="bg-white/60 rounded-lg p-2">
                    <p className="text-amber-700 font-medium">Service Fee (13%)</p>
                    <p className="text-amber-900 font-bold text-sm sm:text-base">₱{totalServiceFee.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                  <div className="bg-white/60 rounded-lg p-2">
                    <p className="text-amber-700 font-medium">Upcoming Earnings</p>
                    <p className="text-amber-900 font-bold text-sm sm:text-base">₱{upcomingEarnings.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                </div>
                <div className="mt-2 pt-2 border-t border-amber-200 bg-white/60 rounded-lg p-2">
                  <p className="text-[10px] sm:text-xs text-amber-700">
                    Upcoming Earnings are calculated as <span className="font-bold">87%</span> of each confirmed payment. The system admin receives the tutee’s payment first and will transfer your earnings after you complete the tutoring session.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Payment Statistics */}
          {/* <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-4">
            <span className="text-[10px] sm:text-xs md:text-sm px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full bg-yellow-50 text-yellow-700 border border-yellow-200">Pending: {pendingPaymentsCount}</span>
            <span className="text-[10px] sm:text-xs md:text-sm px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full bg-primary-50 text-primary-700 border border-primary-200">Approved: {approvedPaymentsCount}</span>
          </div> */}
        </Card>
      </div>

      {/* Payment Trends */}
      <Card className="p-4 sm:p-5 md:p-6 bg-gradient-to-br from-white to-slate-50 rounded-xl sm:rounded-2xl shadow-xl border border-slate-200/50 hover:shadow-2xl transition-all duration-300 -mx-2 sm:-mx-3 md:mx-0">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3">
          <h3 className="text-xs sm:text-sm font-semibold text-slate-700">Payment Trends</h3>
          <div className="flex items-center gap-2">
            <label htmlFor="months-filter" className="text-xs sm:text-sm text-slate-600 font-medium">Display:</label>
            <select
              id="months-filter"
              value={monthsFilter}
              onChange={(e) => setMonthsFilter(Number(e.target.value))}
              className="px-3 py-1.5 text-xs sm:text-sm border border-slate-300 rounded-lg bg-white text-slate-700 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
            >
              <option value={3}>Last 3 Months</option>
              <option value={6}>Last 6 Months</option>
              <option value={12}>Last 12 Months</option>
            </select>
          </div>
        </div>
        <div className="bg-white rounded-lg p-3 sm:p-4 border border-slate-200">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: '#64748b' }}
                stroke="#cbd5e1"
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#64748b' }}
                stroke="#cbd5e1"
                tickFormatter={(value) => `₱${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip
                formatter={(value: number) => [`₱${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, '']}
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  fontSize: '12px'
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                iconType="rect"
              />
              <Bar dataKey="Gross Amount" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Net Earnings" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Service Fee" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Payment History */}
      <Card className="p-4 sm:p-5 md:p-6 bg-gradient-to-br from-white to-slate-50 rounded-xl sm:rounded-2xl shadow-xl border border-slate-200/50 hover:shadow-2xl transition-all duration-300 -mx-2 sm:-mx-3 md:mx-0">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0 mb-3">
          <h3 className="text-sm sm:text-base font-semibold text-slate-800">Payment History</h3>
          <div className="flex flex-wrap gap-1 sm:gap-1.5">
            {[
              { key: 'all', label: 'All' },
              { key: 'pending', label: 'Pending' },
              { key: 'approved', label: 'Approved' }
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setPaymentsFilter(tab.key as any)}
                className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-md hover:shadow-lg touch-manipulation ${paymentsFilter === tab.key
                    ? 'bg-gradient-to-r from-primary-600 to-primary-700 text-white'
                    : 'text-slate-600 hover:text-slate-800 bg-white border-2 border-slate-200 hover:border-primary-300'
                  }`}
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-2 sm:space-y-3 max-h-96 overflow-auto">
          {filteredPayments.map(payment => (
            <div key={payment.id || payment.payment_id} className="flex items-center justify-between p-2 sm:p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 md:gap-3 mb-1">
                  <span className="text-xs sm:text-sm md:text-base font-medium text-slate-800 break-words">
                    {payment.student_name || 'Unknown Student'}
                  </span>
                  <span className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium border flex-shrink-0 ${getStatusColor(payment.status)}`}>
                    <div className="flex items-center space-x-0.5 sm:space-x-1">
                      {getStatusIcon(payment.status)}
                      <span className="whitespace-nowrap">{payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}</span>
                    </div>
                  </span>
                </div>
                <div className="text-xs text-slate-500">
                  Payment ID: #{payment.payment_id || payment.id} • {new Date(payment.created_at).toLocaleDateString()}
                  {payment.subject && (
                    <span className="ml-2">• Subject: {payment.subject}</span>
                  )}
                  {(payment.status === 'confirmed' || payment.status === 'admin_confirmed' || payment.status === 'admin_paid') && payment.admin_note && (
                    <span className="ml-2 text-green-600">✓ Approved by Admin</span>
                  )}

                  {payment.admin_payment_proof_url && (
                    <div className="inline-flex items-center space-x-2 ml-2 mt-1">
                      <Button
                        variant="secondary"
                        disabled={!payment.admin_payment_proof_url}
                        onClick={() => {
                          if (!payment.admin_payment_proof_url) return;
                          const srcPath = payment.admin_payment_proof_url as string;
                          const url = getFileUrl(srcPath);
                          setProofModalUrl(url);
                          setProofModalTitle('Admin payment proof');
                          setProofModalOpen(true);
                          setViewedProofByPayment(prev => ({ ...prev, [payment.payment_id]: true }));
                        }}
                        className="text-[10px] sm:text-xs py-1 px-2"
                      >
                        View admin proof
                      </Button>

                      {(() => {
                        const pid = payment.payment_id || payment.id;
                        if (hiddenConfirm[pid]) return null;
                        return (
                          <Button
                            className="ml-1 text-[10px] sm:text-xs py-1 px-2"
                            onClick={async () => {
                              try {
                                await apiClient.patch(`/payments/${payment.payment_id}/confirm`);
                                notify('Payment confirmed. Booking updated to Upcoming.', 'success', {
                                  label: 'Hide Confirm',
                                  onClick: () => setHiddenConfirm(prev => ({ ...prev, [pid]: true }))
                                });
                                await fetchEarningsData(false);
                              } catch (e) {
                                console.error('Failed to confirm payment', e);
                                notify('Failed to confirm payment. Please try again.', 'error');
                              }
                            }}
                            variant="primary"
                            disabled={
                              payment.status === 'confirmed' ||
                              payment.status === 'admin_confirmed' ||
                              payment.status === 'admin_paid' ||
                              payment.status === 'rejected' ||
                              payment.status === 'refunded' ||
                              !payment.admin_payment_proof_url ||
                              !viewedProofByPayment[payment.payment_id]
                            }
                            title={
                              payment.status === 'confirmed' || payment.status === 'admin_confirmed' || payment.status === 'admin_paid'
                                ? 'Already confirmed'
                                : !payment.admin_payment_proof_url
                                  ? 'Waiting for admin to upload proof'
                                  : !viewedProofByPayment[payment.payment_id]
                                    ? 'Open the admin proof to enable Confirm'
                                    : 'Confirm payment (mark as received)'
                            }
                          >
                            Confirm
                          </Button>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </div>
              <div className="ml-4 text-right">
                <span className="text-xs text-slate-600 block mb-0.5">Gross Amount</span>
                <span className="font-semibold text-slate-800 block">
                  ₱{Number(payment.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                {(payment.status === 'confirmed' || payment.status === 'admin_confirmed' || payment.status === 'admin_paid') && (
                  <>
                    <span className="text-xs text-slate-600 block mt-1.5 mb-0.5">Net Amount</span>
                    <span className="text-[10px] text-slate-500 block">
                      ₱{(Number(payment.amount) * 0.87).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </>
                )}
              </div>
            </div>
          ))}
          {filteredPayments.length === 0 && (
            <p className="text-slate-500 text-center py-4">No payments found</p>
          )}
        </div>
      </Card>

      {/* Session History
      <Card className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 mb-4 sm:mb-6">
          <h2 className="text-lg sm:text-xl font-semibold">Session History</h2>
          <div className="flex flex-wrap gap-1 w-full sm:w-auto">
            {[
              { key: 'all', label: 'All Sessions' },
              { key: 'completed', label: 'Completed' },
              { key: 'pending', label: 'Pending' }
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key as any)}
                className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                  filter === tab.key
                    ? 'bg-primary-100 text-primary-700'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {filteredSessions.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 text-slate-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">No sessions found</h3>
              <p className="text-slate-500">
                {filter === 'all' 
                  ? "You haven't completed any sessions yet."
                  : `No ${filter} sessions found.`
                }
              </p>
            </div>
          ) : (
            filteredSessions.map(session => (
              <div key={session.id} className="border border-slate-200 rounded-lg p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-lg font-semibold text-slate-800">
                        {session.student_name}
                      </h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(session.status)}`}>
                        <div className="flex items-center space-x-1">
                          {getStatusIcon(session.status)}
                          <span>{session.status.charAt(0).toUpperCase() + session.status.slice(1)}</span>
                        </div>
                      </span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(session.payment_status)}`}>
                        <div className="flex items-center space-x-1">
                          {getStatusIcon(session.payment_status)}
                          <span>{session.payment_status.charAt(0).toUpperCase() + session.payment_status.slice(1)}</span>
                        </div>
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 text-xs sm:text-sm text-slate-600">
                      <div>
                        <p><strong>Subject:</strong> {session.subject}</p>
                        <p><strong>Date:</strong> {new Date(session.date).toLocaleDateString()}</p>
                      </div>
                      <div>
                        <p><strong>Duration:</strong> {session.duration} hours</p>
                        <p><strong>Rate:</strong> ₱{session.hourly_rate}/hour</p>
                      </div>
                      <div>
                        <p><strong>Total Amount:</strong> ₱{session.total_amount.toLocaleString()}</p>
                        <p><strong>Session ID:</strong> #{session.id}</p>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                  <div className="text-xs text-slate-500">
                    Session created on {new Date(session.created_at).toLocaleDateString()}
                  </div>
                  <div className="text-lg font-semibold text-slate-800">
                    ₱{session.total_amount.toLocaleString()}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </Card> */}
      {proofModalOpen && proofModalUrl && (
        <Modal isOpen={proofModalOpen} onClose={() => setProofModalOpen(false)} title={proofModalTitle}>
          <div className="flex justify-center">
            <img src={proofModalUrl} alt={proofModalTitle} className="max-w-full h-auto rounded" />
          </div>
        </Modal>
      )}
    </div>
  );
};

export default EarningsHistory;