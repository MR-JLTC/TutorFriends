import React, { useEffect, useState } from 'react';
import { CreditCard, Upload, AlertCircle, CheckCircle2, Ban, History, FileText, Info } from 'lucide-react';
import apiClient, { getFileUrl } from '../../services/api';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Modal from '../ui/Modal';
import { useAuth } from '../../hooks/useAuth';

interface Payment {
  payment_id: number;
  student_id: number;
  tutor_id: number;
  amount: number;
  status: 'pending' | 'paid' | 'admin_confirmed' | 'confirmed' | 'rejected' | 'refunded';
  subject?: string;
  created_at: string;
  rejection_reason?: string;
}

interface BookingRequest {
  id: number;
  subject: string;
  date: string;
  time: string;
  duration: number;
  status: string;
  payment_proof?: string;
  tutor: {
    tutor_id: number;
    session_rate_per_hour?: number;
    gcash_number?: string;
    gcash_qr_url?: string;
    user: {
      name: string;
      email: string;
    };
  };
  amount?: number;
  payment?: Payment; // Payment entity associated with this booking (from payments relation)
  payments?: Payment[]; // Array of payments associated with this booking (from backend relation)
}

interface PaymentHistory extends Payment {
  tutor?: {
    tutor_id: number;
    user: {
      name: string;
      email: string;
    };
    session_rate_per_hour?: number;
  };
  student?: {
    user: {
      name: string;
      email: string;
    };
  };
  payment_proof?: string;
  admin_proof?: string;
}

const TuteePayment: React.FC = () => {
  const [bookings, setBookings] = useState<BookingRequest[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // per-booking UI state to avoid cross-booking interference
  const [selectedPaymentFiles, setSelectedPaymentFiles] = useState<Record<number, File | undefined>>({});
  const [uploadingPayment, setUploadingPayment] = useState(false);
  const [admins, setAdmins] = useState<Array<{ user_id: number; name: string; qr_code_url: string }>>([]);
  const [amountByBooking, setAmountByBooking] = useState<Record<number, string>>({});
  const [initialized, setInitialized] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrModalUrl, setQrModalUrl] = useState<string | null>(null);
  const [qrModalTitle, setQrModalTitle] = useState<string | undefined>(undefined);
  const { user } = useAuth();

  useEffect(() => {
    const initial = async () => {
      await fetchBookings(true);
      setInitialized(true);
    };
    initial();
    // Refresh frequently to reflect approvals quickly
    const interval = setInterval(() => {
      if (!uploadingPayment) {
        fetchBookings(false);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [uploadingPayment]);

  useEffect(() => {
    const loadAdmins = async () => {
      try {
        const res = await apiClient.get('/users/admins-with-qr');
        setAdmins(res.data?.data || []);
      } catch (e) {
        // ignore
      }
    };
    loadAdmins();
  }, []);

  // Fetch payment history (all payments for the user)
  const fetchPaymentHistory = async () => {
    try {
      const response = await apiClient.get('/payments');
      const allPayments = response.data || [];

      // Filter payments for current user (student)
      // ONLY include payments where:
      // 1. The payment is associated with the current user (student) by student_id or user_id, AND
      // 2. The payment has status 'confirmed', 'disputed', or 'refunded'
      const userPayments = allPayments.filter((p: PaymentHistory) => {
        if (!user?.user_id) return false;

        // Get payment's student_id
        const paymentStudentId = (p as any).student_id;

        // Get user's student_id (if available)
        const userStudentId = (user as any).student_id;

        // Check if payment is associated with current user by:
        // 1. student_id match (if both exist)
        // 2. student.user.user_id match
        const isUserPayment =
          (paymentStudentId && userStudentId && paymentStudentId === userStudentId) ||
          (p as any).student?.user?.user_id === user.user_id ||
          (paymentStudentId && !userStudentId && paymentStudentId === (user as any).id);

        // ONLY include payments with status 'confirmed', 'disputed', or 'refunded'
        const paymentStatus = (p.status || '').toLowerCase();
        const hasValidStatus = paymentStatus === 'confirmed' ||
          paymentStatus === 'disputed' ||
          paymentStatus === 'refunded';

        return isUserPayment && hasValidStatus;
      });

      // Sort by created_at descending (newest first)
      userPayments.sort((a: PaymentHistory, b: PaymentHistory) => {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      setPaymentHistory(userPayments);
    } catch (err) {
      console.error('Failed to fetch payment history:', err);
      // Don't show error toast for history, just log it
    }
  };

  useEffect(() => {
    if (user?.user_id) {
      fetchPaymentHistory();
    }
  }, [user?.user_id]);

  // Get the effective payment status for a booking (prefer payment.status over booking.status)
  const getEffectivePaymentStatus = (booking: BookingRequest): string => {
    // Check booking status first - if it's payment_pending, always return that to show "Awaiting Payment Confirmation"
    const bookingStatus = (booking.status || '').toLowerCase();
    if (bookingStatus === 'payment_pending') {
      return 'payment_pending';
    }
    // Exclude admin_payment_pending status (admin needs to pay, not tutee)
    if (bookingStatus === 'admin_payment_pending') {
      return ''; // Return empty to exclude from display
    }
    // If there's a payment entity, use its status
    if (booking.payment?.status) {
      return booking.payment.status;
    }
    // Otherwise, use booking status and map it to payment status equivalents
    const statusMap: Record<string, string> = {
      'awaiting_payment': 'pending',
      'payment_rejected': 'rejected',
      'payment_approved': 'confirmed',
      'pending': 'pending'
    };
    // If booking has plain 'rejected' status but no attached payment, treat it as unknown
    if (bookingStatus === 'rejected' && !booking.payment) {
      return '';
    }

    return statusMap[bookingStatus] || bookingStatus;
  };

  // Helper function to check if status is rejected (case-insensitive) - checks payment status
  const isRejectedStatus = (booking: BookingRequest): boolean => {
    const effectiveStatus = getEffectivePaymentStatus(booking);
    const normalized = (effectiveStatus || '').toLowerCase();
    return normalized === 'payment_rejected' || normalized === 'rejected';
  };

  // Helper function to check if status allows payment submission (case-insensitive) - checks payment status
  const allowsPaymentSubmission = (booking: BookingRequest): boolean => {
    const effectiveStatus = getEffectivePaymentStatus(booking);
    const normalized = (effectiveStatus || '').toLowerCase();
    return normalized === 'awaiting_payment' ||
      normalized === 'pending' ||
      normalized === 'payment_rejected' ||
      normalized === 'rejected';
  };

  // Auto-fill amounts based on session rates (but not for rejected payments - user needs to re-enter)
  useEffect(() => {
    const updates: Record<number, string> = {};
    bookings.forEach((booking) => {
      const calculatedAmount = calculateAmount(booking);
      const currentAmount = amountByBooking[booking.id];
      const isRejected = isRejectedStatus(booking);
      // Auto-fill only if: amount is calculated, no current amount set, and NOT rejected
      // For rejected payments, don't auto-fill so user can enter the correct amount
      const shouldAutoFill = calculatedAmount > 0 && !currentAmount && !isRejected;

      if (shouldAutoFill) {
        updates[booking.id] = calculatedAmount.toFixed(2);
      }
    });

    if (Object.keys(updates).length > 0) {
      setAmountByBooking(prev => ({ ...prev, ...updates }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookings]);

  const fetchBookings = async (isInitial: boolean = false) => {
    try {
      if (isInitial) setLoading(true);

      // Fetch bookings which now include payments via the booking_request_id relationship
      const bookingsResponse = await apiClient.get('/users/me/bookings');
      const allBookings = bookingsResponse.data || [];

      // Also fetch all payments for payment history
      const paymentsResponse = await apiClient.get('/payments').catch(() => ({ data: [] }));
      const allPayments = paymentsResponse.data || [];

      // Filter payments for current user (student) for payment history
      // ONLY include payments where:
      // 1. The payment is associated with the current user (student) by student_id or user_id, AND
      // 2. The payment has sender='tutee' (exclude all other sender values)
      const userPayments = allPayments.filter((p: Payment) => {
        if (!user?.user_id) return false;

        // Get payment's student_id
        const paymentStudentId = (p as any).student_id;

        // Get user's student_id (if available)
        const userStudentId = (user as any).student_id;

        // Check if payment is associated with current user by:
        // 1. student_id match (if both exist)
        // 2. student.user.user_id match
        const isUserPayment =
          (paymentStudentId && userStudentId && paymentStudentId === userStudentId) ||
          (p as any).student?.user?.user_id === user.user_id ||
          (paymentStudentId && !userStudentId && paymentStudentId === (user as any).id);

        // ONLY include payments with sender='tutee' (exclude all others)
        const isTuteeSender = (p as any).sender === 'tutee';

        return isUserPayment && isTuteeSender;
      });
      setPayments(userPayments);

      // Process bookings: use payments from the backend relationship (payments array)
      // The backend now includes payments via the booking_request_id foreign key
      const relevantBookings = allBookings
        .map((booking: BookingRequest) => {
          // Get the most recent payment for this booking from the payments array
          // Payments are already linked via booking_request_id in the database
          // Filter out payments with sender='admin' - only include 'tutee' payments
          // Also filter by student_id to ensure payments belong to current user
          const bookingPayments = (booking.payments || []).filter((p: Payment) => {
            if (!user?.user_id) return false;

            const sender = (p as any).sender;
            // ONLY include payments with sender='tutee'
            if (sender !== 'tutee') return false;

            // Get payment's student_id
            const paymentStudentId = (p as any).student_id;

            // Get user's student_id (if available)
            const userStudentId = (user as any).student_id;

            // Check if payment is associated with current user by:
            // 1. student_id match (if both exist)
            // 2. student.user.user_id match
            const isUserPayment =
              (paymentStudentId && userStudentId && paymentStudentId === userStudentId) ||
              (p as any).student?.user?.user_id === user.user_id ||
              (paymentStudentId && !userStudentId && paymentStudentId === (user as any).id);

            return isUserPayment;
          });

          const latestPayment = bookingPayments.length > 0
            ? bookingPayments.sort((a: Payment, b: Payment) =>
              new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            )[0]
            : null;

          // Also check if the legacy payment field has sender='tutee' (only use if it's tutee)
          const legacyPayment = booking.payment;
          const shouldUseLegacyPayment = legacyPayment &&
            (legacyPayment as any).sender === 'tutee';

          return {
            ...booking,
            payment: latestPayment || (shouldUseLegacyPayment ? legacyPayment : null) // Use latest from payments array, fallback to legacy payment field (only if sender='tutee')
          };
        })
        .filter((booking: BookingRequest) => {
          // Include bookings that have:
          // 1. Payment-related booking status, OR
          // 2. An associated payment with status: 'pending', 'admin_confirmed', 'confirmed', 'rejected', 'refunded'
          // BUT exclude payments with sender='admin'
          const bookingStatus = (booking.status || '').toLowerCase();

          // Check if payment exists and ONLY include if sender is 'tutee'
          if (booking.payment) {
            const paymentSender = (booking.payment as any).sender;
            // ONLY include payments with sender='tutee' (exclude all others)
            if (paymentSender !== 'tutee') {
              return false;
            }
          }

          const hasPaymentStatus = booking.payment &&
            ['pending', 'paid', 'admin_confirmed', 'confirmed', 'rejected', 'refunded'].includes(
              (booking.payment.status || '').toLowerCase()
            );

          // Exclude admin_payment_pending status (admin needs to pay, not tutee)
          if (bookingStatus === 'admin_payment_pending') {
            return false;
          }

          const hasBookingPaymentStatus =
            bookingStatus === 'awaiting_payment' ||
            bookingStatus === 'payment_pending' ||
            bookingStatus === 'payment_rejected' ||
            bookingStatus === 'pending' ||
            bookingStatus === 'paid' ||
            bookingStatus === 'admin_confirmed' ||
            bookingStatus === 'confirmed' ||
            bookingStatus === 'refunded' ||
            bookingStatus === 'payment_approved';

          return hasBookingPaymentStatus || hasPaymentStatus;
        });

      // Log for debugging
      if (relevantBookings.length > 0) {
        console.log('Payment bookings with statuses:', relevantBookings.map((b: { id: any; status: any; payment: { status: any; payment_id: any; booking_request_id: any; }; }) => ({
          id: b.id,
          bookingStatus: b.status,
          paymentStatus: b.payment?.status,
          paymentId: b.payment?.payment_id,
          bookingRequestId: b.payment?.booking_request_id
        })));
      }

      setBookings(relevantBookings);
      setError(null);
    } catch (err: any) {
      console.error('Failed to fetch bookings:', err);
      setError(err.response?.data?.message || 'Failed to load bookings');
      toast.error('Failed to load bookings. Please try again.');
    } finally {
      if (isInitial) setLoading(false);
    }
  };

  const handlePaymentFileChange = (e: React.ChangeEvent<HTMLInputElement>, bookingId: number) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error('Please upload an image file');
        return;
      }
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast.error('File size should be less than 5MB');
        return;
      }
      setSelectedPaymentFiles(prev => ({ ...prev, [bookingId]: file }));
    }
  };

  const handleUploadPayment = async (bookingId: number) => {
    const file = selectedPaymentFiles[bookingId];
    // Use the first admin automatically since there's only one
    const adminId = admins.length > 0 ? admins[0].user_id : null;
    const amt = amountByBooking[bookingId] || '';
    const booking = bookings.find(b => b.id === bookingId);
    const calculatedAmount = booking ? calculateAmount(booking) : 0;
    const amountPaid = Number(amt);

    if (!file) {
      toast.error('Please select a payment proof image first');
      return;
    }
    if (!adminId) {
      toast.error('Admin QR code not available. Please try again later.');
      return;
    }
    if (!amt || isNaN(amountPaid) || amountPaid <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    if (calculatedAmount > 0 && amountPaid < calculatedAmount) {
      toast.error(`Amount paid (₱${amountPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}) must be at least ₱${calculatedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (amount to pay). You can pay more if needed.`);
      return;
    }

    try {
      setUploadingPayment(true);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('bookingId', String(bookingId));
      formData.append('adminId', String(adminId));
      formData.append('amount', amt);

      await apiClient.post(`/payments/submit-proof`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      toast.success('Payment submitted for verification');
      setSelectedPaymentFiles(prev => { const p = { ...prev }; delete p[bookingId]; return p; });
      setAmountByBooking(prev => { const p = { ...prev }; delete p[bookingId]; return p; });
      // Immediate fetch to reflect 'payment_pending' without flicker
      await fetchBookings(false);
      // Also refresh payment history
      await fetchPaymentHistory();
    } catch (err: any) {
      console.error('Failed to upload payment:', err);
      toast.error(err.response?.data?.message || 'Failed to submit payment');
    } finally {
      setUploadingPayment(false);
    }
  };

  const getStatusDisplay = (status: string) => {
    const normalizedStatus = (status || '').toLowerCase();
    switch (normalizedStatus) {
      case 'pending':
        return {
          icon: <AlertCircle className="h-5 w-5 text-yellow-500" />,
          text: 'Pending Payment',
          color: 'text-yellow-700 bg-yellow-50 border-yellow-200',
          dotColor: 'bg-yellow-500'
        };
      case 'paid':
        return {
          icon: <CheckCircle2 className="h-5 w-5 text-blue-500" />,
          text: 'Paid',
          color: 'text-blue-700 bg-blue-50 border-blue-200',
          dotColor: 'bg-blue-500'
        };
      case 'admin_confirmed':
        return {
          icon: <CheckCircle2 className="h-5 w-5 text-indigo-500" />,
          text: 'Admin Confirmed',
          color: 'text-indigo-700 bg-indigo-50 border-indigo-200',
          dotColor: 'bg-indigo-500'
        };
      case 'confirmed':
        return {
          icon: <CheckCircle2 className="h-5 w-5 text-green-500" />,
          text: 'Paid',
          color: 'text-green-700 bg-green-50 border-green-200',
          dotColor: 'bg-green-500'
        };
      case 'disputed':
        return {
          icon: <AlertCircle className="h-5 w-5 text-purple-500" />,
          text: 'Disputed',
          color: 'text-purple-700 bg-purple-50 border-purple-200',
          dotColor: 'bg-purple-500'
        };
      case 'rejected':
        return {
          icon: <Ban className="h-5 w-5 text-red-500" />,
          text: 'Payment Rejected',
          color: 'text-red-700 bg-red-50 border-red-200',
          dotColor: 'bg-red-500'
        };
      case 'refunded':
        return {
          icon: <Ban className="h-5 w-5 text-orange-500" />,
          text: 'Refunded',
          color: 'text-orange-700 bg-orange-50 border-orange-200',
          dotColor: 'bg-orange-500'
        };
      // Legacy booking status mappings (for backwards compatibility)
      case 'awaiting_payment':
        return {
          icon: <AlertCircle className="h-5 w-5 text-yellow-500" />,
          text: 'Awaiting Payment',
          color: 'text-yellow-700 bg-yellow-50 border-yellow-200',
          dotColor: 'bg-yellow-500'
        };
      case 'payment_pending':
        return {
          icon: <CheckCircle2 className="h-5 w-5 text-blue-500" />,
          text: 'Awaiting Payment Confirmation',
          color: 'text-blue-700 bg-blue-50 border-blue-200',
          dotColor: 'bg-blue-500'
        };
      case 'admin_payment_pending':
        return {
          icon: <CheckCircle2 className="h-5 w-5 text-indigo-500" />,
          text: 'Admin Payment Pending',
          color: 'text-indigo-700 bg-indigo-50 border-indigo-200',
          dotColor: 'bg-indigo-500'
        };
      case 'payment_rejected':
        return {
          icon: <Ban className="h-5 w-5 text-red-500" />,
          text: 'Payment Rejected',
          color: 'text-red-700 bg-red-50 border-red-200',
          dotColor: 'bg-red-500'
        };
      case 'payment_approved':
        return {
          icon: <CheckCircle2 className="h-5 w-5 text-green-500" />,
          text: 'Payment Approved',
          color: 'text-green-700 bg-green-50 border-green-200',
          dotColor: 'bg-green-500'
        };
      default:
        // Log unknown status for debugging
        console.warn('Unknown payment status:', status);
        return {
          icon: <AlertCircle className="h-5 w-5 text-slate-500" />,
          text: status || 'Unknown',
          color: 'text-slate-700 bg-slate-50 border-slate-200',
          dotColor: 'bg-slate-500'
        };
    }
  };

  // Calculate amount based on session rate and duration
  const calculateAmount = (booking: BookingRequest): number => {
    const sessionRate = booking.tutor?.session_rate_per_hour || 0;
    const duration = booking.duration || 0;
    return sessionRate * duration;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-3">
          <CreditCard className="h-8 w-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-slate-800">Payment</h1>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="animate-pulse space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="h-32 bg-slate-100 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-4 md:space-y-6 pb-6 md:pb-10">
      <ToastContainer aria-label="Notifications" />
      {/* Header */}
      {/* <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl sm:rounded-2xl p-3 sm:p-4 md:p-6 text-white shadow-lg -mx-2 sm:-mx-3 md:mx-0">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 sm:gap-3 md:gap-0">
          <div className="flex items-center gap-2 sm:gap-3">
            <CreditCard className="h-5 w-5 sm:h-6 sm:w-6 md:h-8 md:w-8 flex-shrink-0" />
            <div>
              <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-white">Payment Management</h1>
              <p className="text-xs sm:text-sm md:text-base text-blue-100/90 mt-0.5 sm:mt-1">
                Manage your session payments and track payment history
              </p>
            </div>
          </div>
          <button
            onClick={async () => {
              await fetchBookings(true);
              await fetchPaymentHistory();
            }}
            className="mt-2 sm:mt-0 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-blue-600 hover:text-blue-700 active:text-blue-800 bg-white hover:bg-blue-50 active:bg-blue-100 rounded-lg sm:rounded-xl transition-all shadow-md hover:shadow-lg w-full sm:w-auto touch-manipulation flex items-center justify-center gap-2"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            <svg className="w-3.5 h-3.5 sm:w-4 sm:w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Refresh</span>
          </button>
        </div>
      </div> */}
      <div className="bg-sky-600 rounded-2xl md:rounded-3xl px-4 py-3 md:px-5 md:py-4 shadow-sm border border-sky-500 flex items-center gap-4">
        <div className="flex items-center justify-center shrink-0">
          <Info className="h-8 w-8 text-white" />
        </div>
        <p className="text-lg md:text-xl font-bold text-white tracking-tight">
          Manage your session payments and track payment history
        </p>
        <button
          onClick={async () => {
            await fetchBookings(true);
            await fetchPaymentHistory();
          }}
          className="mt-2 sm:mt-0 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-blue-600 hover:text-blue-700 active:text-blue-800 bg-white hover:bg-blue-50 active:bg-blue-100 rounded-lg sm:rounded-xl transition-all shadow-md hover:shadow-lg w-full sm:w-auto touch-manipulation flex items-center justify-center gap-2"
          style={{ WebkitTapHighlightColor: 'transparent' }}
        >
          <svg className="w-3.5 h-3.5 sm:w-4 sm:w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span>Refresh</span>
        </button>
      </div>
      {
        error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 sm:p-4 text-red-700 -mx-2 sm:-mx-3 md:mx-0">
            <p className="text-xs sm:text-sm">{error}</p>
          </div>
        ) : bookings.length === 0 ? (
          <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-slate-200 p-6 sm:p-8 text-center -mx-2 sm:-mx-3 md:mx-0">
            <CreditCard className="h-10 w-10 sm:h-12 sm:w-12 text-slate-400 mx-auto mb-3 sm:mb-4" />
            <h3 className="text-base sm:text-lg font-medium text-slate-900 mb-1">No Pending Payments</h3>
            <p className="text-xs sm:text-sm md:text-base text-slate-600">
              When you have bookings that require payment, they will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-4 sm:space-y-5 md:space-y-6 lg:space-y-8">
            {bookings.map((booking) => {
              // Use payment status if available, otherwise use booking status
              const effectiveStatus = getEffectivePaymentStatus(booking);
              const status = getStatusDisplay(effectiveStatus);
              const calculatedAmount = calculateAmount(booking);
              const sessionRate = booking.tutor?.session_rate_per_hour || 0;

              return (
                <div key={booking.id} className="group relative bg-gradient-to-br from-white via-primary-50/20 to-primary-100/10 rounded-xl sm:rounded-2xl md:rounded-3xl shadow-lg md:shadow-xl border-2 border-slate-200/80 hover:border-primary-400 hover:shadow-2xl p-4 sm:p-5 md:p-7 lg:p-8 -mx-2 sm:-mx-3 md:mx-0 transition-all duration-300 overflow-hidden">
                  {/* Decorative gradient bar based on status */}
                  <div className={`absolute top-0 left-0 right-0 h-1 md:h-1.5 ${effectiveStatus.toLowerCase() === 'confirmed' || effectiveStatus.toLowerCase() === 'admin_confirmed'
                    ? 'bg-gradient-to-r from-green-500 via-emerald-500 to-green-600' :
                    isRejectedStatus(booking)
                      ? 'bg-gradient-to-r from-red-500 via-rose-500 to-red-600' :
                      effectiveStatus.toLowerCase() === 'pending'
                        ? 'bg-gradient-to-r from-yellow-500 via-amber-500 to-yellow-600' :
                        'bg-gradient-to-r from-primary-500 via-primary-600 to-primary-700'
                    }`} />

                  <div className="flex flex-col gap-4 sm:gap-5 md:gap-6 mb-4 sm:mb-5 md:mb-6">
                    {/* Header Section - Enhanced for Desktop */}
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 sm:gap-4 md:gap-5">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-extrabold text-slate-900 mb-2 sm:mb-3 md:mb-4 break-words leading-tight">
                          {booking.subject}
                        </h3>
                        <p className="text-sm sm:text-base md:text-lg text-slate-700 mb-3 md:mb-4 font-semibold">
                          with <span className="text-primary-700">{booking.tutor.user.name}</span>
                        </p>
                        <div className="flex flex-wrap items-center gap-2 sm:gap-3 md:gap-4">
                          <span className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 md:px-4 py-1.5 sm:py-2 bg-white rounded-lg md:rounded-xl border border-slate-200 md:border-2 shadow-sm md:shadow-md hover:shadow-lg transition-shadow">
                            <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5 text-primary-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span className="text-xs sm:text-sm md:text-base font-semibold text-slate-800">{new Date(booking.date).toLocaleDateString()}</span>
                          </span>
                          <span className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 md:px-4 py-1.5 sm:py-2 bg-white rounded-lg md:rounded-xl border border-slate-200 md:border-2 shadow-sm md:shadow-md hover:shadow-lg transition-shadow">
                            <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5 text-primary-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-xs sm:text-sm md:text-base font-semibold text-slate-800">{booking.time}</span>
                          </span>
                          <span className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 md:px-4 py-1.5 sm:py-2 bg-white rounded-lg md:rounded-xl border border-slate-200 md:border-2 shadow-sm md:shadow-md hover:shadow-lg transition-shadow">
                            <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5 text-primary-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-xs sm:text-sm md:text-base font-semibold text-slate-800">{booking.duration} {booking.duration === 1 ? 'hour' : 'hours'}</span>
                          </span>
                        </div>
                      </div>
                      {/* Status Badge - Enhanced for Desktop */}
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3 flex-shrink-0 w-full md:w-auto">
                        <div className={`px-3 sm:px-4 md:px-5 py-1.5 sm:py-2 md:py-2.5 rounded-xl md:rounded-2xl text-xs sm:text-sm md:text-base font-bold flex items-center gap-1.5 sm:gap-2 shadow-md md:shadow-lg ${status.color} border-2 ${status.color.includes('yellow') ? 'border-yellow-400' :
                          status.color.includes('red') ? 'border-red-400' :
                            status.color.includes('green') ? 'border-green-400' :
                              status.color.includes('indigo') ? 'border-indigo-400' :
                                'border-primary-400'
                          }`}>
                          {status.icon}
                          {status.dotColor && <span className={`h-2.5 w-2.5 md:h-3 md:w-3 rounded-full ${status.dotColor}`} />}
                          <span className="whitespace-nowrap">{status.text}</span>
                        </div>
                        {booking.payment_proof && !isRejectedStatus(booking) && (
                          <div className="px-3 sm:px-4 md:px-5 py-1.5 sm:py-2 md:py-2.5 rounded-xl md:rounded-2xl text-[10px] sm:text-xs md:text-sm font-bold bg-green-50 text-green-700 border-2 border-green-400 shadow-sm md:shadow-md flex items-center gap-1.5">
                            <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5" />
                            <span>Proof uploaded</span>
                          </div>
                        )}
                      </div>
                    </div>
                    {sessionRate > 0 && (
                      <div className="relative overflow-hidden bg-gradient-to-br from-primary-50 via-primary-100/50 to-primary-50 rounded-xl md:rounded-2xl border-2 border-primary-200/80 shadow-md md:shadow-lg p-4 sm:p-5 md:p-6">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-primary-200/20 rounded-full -mr-16 -mt-16 blur-2xl hidden md:block"></div>
                        <div className="relative flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 md:gap-6">
                          <div className="flex items-center gap-3 md:gap-4">
                            <div className="p-2 md:p-3 bg-primary-100 rounded-lg md:rounded-xl shadow-sm">
                              <svg className="h-5 w-5 md:h-6 md:w-6 text-primary-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </div>
                            <div>
                              <span className="text-xs sm:text-sm md:text-base font-bold text-slate-600 block mb-0.5 md:mb-1 uppercase tracking-wide">Session Rate</span>
                              <span className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-extrabold text-slate-900">₱{sessionRate.toLocaleString()}/hour</span>
                            </div>
                          </div>
                          {calculatedAmount > 0 && (
                            <>
                              <div className="hidden sm:block w-px h-8 md:h-10 bg-primary-300"></div>
                              <div className="flex items-center gap-3 md:gap-4">
                                <div className="p-2 md:p-3 bg-primary-200 rounded-lg md:rounded-xl shadow-sm">
                                  <svg className="h-5 w-5 md:h-6 md:w-6 text-primary-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                  </svg>
                                </div>
                                <div>
                                  <span className="text-xs sm:text-sm md:text-base font-bold text-slate-600 block mb-0.5 md:mb-1 uppercase tracking-wide">Total Amount</span>
                                  <span className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-extrabold bg-gradient-to-r from-primary-600 via-primary-700 to-primary-600 bg-clip-text text-transparent">₱{calculatedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Only show payment instructions for statuses that allow payment submission */}
                  {allowsPaymentSubmission(booking) && (
                    <div className="relative overflow-hidden bg-gradient-to-br from-primary-50/80 via-primary-100/60 to-primary-50/80 rounded-xl md:rounded-2xl border-2 border-primary-200/80 p-4 sm:p-5 md:p-7 lg:p-8 mb-4 md:mb-6 shadow-lg md:shadow-xl">
                      <div className="absolute top-0 right-0 w-40 h-40 bg-primary-200/20 rounded-full -mr-20 -mt-20 blur-3xl hidden md:block"></div>
                      <div className="relative">
                        <h4 className="font-extrabold text-base sm:text-lg md:text-2xl lg:text-3xl text-slate-900 mb-4 sm:mb-5 md:mb-6 flex items-center gap-2 md:gap-3">
                          <div className="p-2 md:p-3 bg-primary-100 rounded-xl md:rounded-2xl shadow-md border-2 border-primary-200">
                            <CreditCard className="h-5 w-5 sm:h-6 sm:w-6 md:h-7 md:w-7 text-primary-700" />
                          </div>
                          Payment Instructions
                        </h4>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 md:gap-6 lg:gap-8">
                          {/* Admin QR Code Section */}
                          <div className="flex flex-col items-center justify-center p-4 sm:p-5 md:p-6 lg:p-8 bg-white rounded-xl md:rounded-2xl border-2 border-primary-200 shadow-md md:shadow-lg">
                            {admins.length > 0 ? (
                              <>
                                <p className="text-sm sm:text-base md:text-lg text-slate-700 font-bold mb-3 sm:mb-4 md:mb-5 text-center">Scan this QR code to pay:</p>
                                <div className="relative">
                                  <img
                                    src={getFileUrl(admins[0].qr_code_url)}
                                    alt={`${admins[0].name} QR`}
                                    className="h-48 w-48 sm:h-56 sm:w-56 md:h-64 md:w-64 lg:h-72 lg:w-72 object-contain bg-white rounded-xl md:rounded-2xl shadow-lg border-2 border-primary-100 p-2"
                                  />
                                  <button
                                    onClick={() => {
                                      setQrModalUrl(getFileUrl(admins[0].qr_code_url));
                                      setQrModalTitle(admins[0].name);
                                      setQrModalOpen(true);
                                    }}
                                    className="absolute top-2 right-2 p-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg shadow-md hover:shadow-lg transition-all"
                                    title="View larger"
                                    style={{ WebkitTapHighlightColor: 'transparent' }}
                                  >
                                    <svg className="h-4 w-4 sm:h-5 sm:w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                                    </svg>
                                  </button>
                                </div>
                                <p className="mt-4 sm:mt-5 md:mt-6 text-base sm:text-lg md:text-xl font-bold text-slate-900">{admins[0].name}</p>
                                <p className="mt-2 text-xs sm:text-sm text-slate-600 text-center">Click the icon on the QR code to view larger</p>
                              </>
                            ) : (
                              <div className="text-center py-8">
                                <CreditCard className="h-12 w-12 sm:h-16 sm:w-16 text-slate-400 mx-auto mb-3" />
                                <p className="text-sm sm:text-base text-slate-500">Admin QR code not available</p>
                              </div>
                            )}
                          </div>

                          {/* Payment Form Section */}
                          <div className="bg-white rounded-xl md:rounded-2xl p-4 sm:p-5 md:p-6 border-2 border-slate-200/80 shadow-md md:shadow-lg space-y-4 sm:space-y-5 md:space-y-6">
                            <div>
                              <label className="block text-sm sm:text-base md:text-lg font-extrabold text-slate-900 mb-2 sm:mb-3 flex items-center gap-2">
                                <svg className="h-4 w-4 md:h-5 md:w-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Amount to Pay
                              </label>
                              {calculatedAmount > 0 ? (
                                <div className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-slate-900 bg-gradient-to-br from-primary-50 to-primary-100 rounded-xl md:rounded-2xl px-4 sm:px-5 md:px-6 py-3 sm:py-4 md:py-5 border-2 border-primary-200 shadow-lg">
                                  ₱{calculatedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                              ) : (
                                <div className="text-sm sm:text-base text-slate-600 bg-slate-50 rounded-xl md:rounded-2xl px-4 sm:px-5 py-3 sm:py-4 border-2 border-slate-200 font-semibold">
                                  Session rate not set
                                </div>
                              )}
                            </div>

                            <div>
                              <label className="block text-sm sm:text-base md:text-lg font-extrabold text-slate-900 mb-2 sm:mb-3 flex items-center gap-2">
                                <svg className="h-4 w-4 md:h-5 md:w-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                                Amount Paid
                              </label>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={amountByBooking[booking.id] || (calculatedAmount > 0 && !isRejectedStatus(booking) ? calculatedAmount.toFixed(2) : '')}
                                onChange={(e) => setAmountByBooking(prev => ({ ...prev, [booking.id]: e.target.value }))}
                                className="w-full border-2 border-slate-300 rounded-xl md:rounded-2xl px-4 sm:px-5 md:px-6 py-3 sm:py-3.5 md:py-4 text-sm sm:text-base md:text-lg font-semibold focus:ring-4 focus:ring-primary-200 focus:border-primary-500 transition-all shadow-sm hover:shadow-md"
                                placeholder="0.00"
                              />
                              {calculatedAmount > 0 && !isRejectedStatus(booking) && (
                                <p className="text-[10px] sm:text-xs text-slate-500 mt-1.5">Amount auto-filled based on session rate. You can enter a higher amount if needed.</p>
                              )}
                              {isRejectedStatus(booking) && (
                                <p className="text-[10px] sm:text-xs text-amber-600 mt-1.5 font-medium">Please enter the amount you paid</p>
                              )}
                            </div>

                            {/* Upload section - always show for statuses that allow payment submission */}
                            <div className="space-y-2 sm:space-y-3">
                              <label className="block text-xs sm:text-sm md:text-base font-semibold text-slate-800">Upload Payment Proof</label>
                              <div className="relative">
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => handlePaymentFileChange(e, booking.id)}
                                  className="w-full text-xs sm:text-sm md:text-base file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs sm:file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 transition-colors"
                                  id={`file-input-${booking.id}`}
                                />
                              </div>
                              {selectedPaymentFiles[booking.id] && (
                                <div className="flex items-center gap-2 p-2 sm:p-2.5 bg-green-50 border border-green-200 rounded-lg">
                                  <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 flex-shrink-0" />
                                  <span className="text-[10px] sm:text-xs md:text-sm text-green-700 truncate flex-1">{selectedPaymentFiles[booking.id]?.name}</span>
                                  <button
                                    onClick={() => setSelectedPaymentFiles(prev => { const p = { ...prev }; delete p[booking.id]; return p; })}
                                    className="text-red-600 hover:text-red-700 text-xs sm:text-sm font-medium flex-shrink-0"
                                    aria-label="Remove file"
                                  >
                                    Remove
                                  </button>
                                </div>
                              )}

                              {/* Amount validation helper */}
                              {amountByBooking[booking.id] && calculatedAmount > 0 && (() => {
                                const amountPaid = Number(amountByBooking[booking.id]);
                                const isValidAmount = !isNaN(amountPaid) && amountPaid >= calculatedAmount;
                                if (!isValidAmount) {
                                  return (
                                    <div className="p-2 sm:p-2.5 bg-amber-50 border border-amber-300 rounded-lg">
                                      <p className="text-[10px] sm:text-xs text-amber-800 font-medium">
                                        ⚠️ Amount paid (₱{amountPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}) must be at least ₱{calculatedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (amount to pay). You can pay more if needed.
                                      </p>
                                    </div>
                                  );
                                }
                                if (amountPaid > calculatedAmount) {
                                  return (
                                    <div className="p-2 sm:p-2.5 bg-blue-50 border border-blue-300 rounded-lg">
                                      <p className="text-[10px] sm:text-xs text-blue-800 font-medium">
                                        ✓ Amount paid (₱{amountPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}) is greater than the required amount. This is acceptable.
                                      </p>
                                    </div>
                                  );
                                }
                                return null;
                              })()}

                              <button
                                onClick={() => handleUploadPayment(booking.id)}
                                disabled={(() => {
                                  const amountPaid = amountByBooking[booking.id] ? Number(amountByBooking[booking.id]) : 0;
                                  const hasValidAmount = calculatedAmount > 0
                                    ? (!isNaN(amountPaid) && amountPaid >= calculatedAmount)
                                    : (!isNaN(amountPaid) && amountPaid > 0);

                                  return !selectedPaymentFiles[booking.id] ||
                                    uploadingPayment ||
                                    admins.length === 0 ||
                                    !amountByBooking[booking.id] ||
                                    !hasValidAmount;
                                })()}
                                className="w-full flex items-center justify-center gap-2 sm:gap-3 px-4 sm:px-5 md:px-6 py-3 sm:py-3.5 md:py-4 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl md:rounded-2xl hover:from-primary-700 hover:to-primary-800 active:from-primary-800 active:to-primary-900 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all shadow-lg md:shadow-xl hover:shadow-2xl disabled:shadow-none text-sm sm:text-base md:text-lg font-extrabold touch-manipulation transform hover:scale-[1.02] disabled:transform-none"
                                style={{ WebkitTapHighlightColor: 'transparent' }}
                              >
                                {uploadingPayment ? (
                                  <>
                                    <svg className="animate-spin h-4 w-4 sm:h-5 sm:w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    <span>Submitting...</span>
                                  </>
                                ) : (
                                  <>
                                    <Upload className="h-4 w-4 sm:h-5 sm:w-5" />
                                    <span>{isRejectedStatus(booking) ? 'Resubmit Payment Proof' : 'Submit Payment Proof'}</span>
                                  </>
                                )}
                              </button>
                              {(() => {
                                const amountPaid = amountByBooking[booking.id] ? Number(amountByBooking[booking.id]) : 0;
                                const hasValidAmount = calculatedAmount > 0
                                  ? (!isNaN(amountPaid) && amountPaid >= calculatedAmount)
                                  : (!isNaN(amountPaid) && amountPaid > 0);
                                const missingRequirements = [];

                                if (admins.length === 0) missingRequirements.push('Admin QR code not available');
                                if (!selectedPaymentFiles[booking.id]) missingRequirements.push('Please select a payment proof image');
                                if (!amountByBooking[booking.id]) missingRequirements.push('Please enter the amount paid');
                                else if (calculatedAmount > 0 && (isNaN(amountPaid) || amountPaid < calculatedAmount)) {
                                  missingRequirements.push(`Amount paid must be at least ₱${calculatedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
                                } else if (calculatedAmount === 0 && (isNaN(amountPaid) || amountPaid <= 0)) {
                                  missingRequirements.push('Please enter a valid amount');
                                }

                                return missingRequirements.length > 0 ? (
                                  <div className="text-[10px] sm:text-xs text-slate-500 space-y-0.5">
                                    {missingRequirements.map((req, idx) => (
                                      <p key={idx}>• {req}</p>
                                    ))}
                                  </div>
                                ) : null;
                              })()}
                              <p className="text-[10px] sm:text-xs text-slate-500 leading-relaxed">
                                Upload a screenshot of your payment to the admin QR code above (max 5MB, JPG/PNG).
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Status-specific messages - using payment status */}
                  {isRejectedStatus(booking) && (
                    <div className="bg-red-50 border-2 border-red-300 rounded-lg sm:rounded-xl p-3 sm:p-4 md:p-5 mb-4">
                      <div className="flex items-start gap-2 sm:gap-3">
                        <Ban className="h-5 w-5 sm:h-6 sm:w-6 text-red-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-sm sm:text-base md:text-lg text-red-900 mb-1.5 sm:mb-2">Payment Rejected</h4>
                          <p className="text-xs sm:text-sm md:text-base text-red-700 leading-relaxed mb-2 sm:mb-3">
                            Your previous payment proof was rejected. Please select an admin QR code, enter the amount paid, and upload a new proof of payment.
                          </p>
                          {booking.payment?.rejection_reason && (
                            <div className="mt-2 sm:mt-3 p-2.5 sm:p-3 bg-red-100 border border-red-300 rounded-lg">
                              <p className="text-xs sm:text-sm font-semibold text-red-900 mb-1">Rejection Reason:</p>
                              <p className="text-xs sm:text-sm text-red-800 leading-relaxed whitespace-pre-wrap break-words">
                                {booking.payment.rejection_reason}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {effectiveStatus.toLowerCase() === 'pending' && booking.payment_proof && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4 mb-4">
                      <div className="flex items-center text-blue-700">
                        <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 mr-2 flex-shrink-0" />
                        <p className="text-xs sm:text-sm">Your payment has been submitted and is being reviewed by the admin.</p>
                      </div>
                    </div>
                  )}

                  {effectiveStatus.toLowerCase() === 'paid' && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4 mb-4">
                      <div className="flex items-center text-blue-700">
                        <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 mr-2 flex-shrink-0" />
                        <p className="text-xs sm:text-sm">Your payment has been recorded. Waiting for admin confirmation.</p>
                      </div>
                    </div>
                  )}

                  {effectiveStatus.toLowerCase() === 'admin_confirmed' && (
                    <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 sm:p-4 mb-4">
                      <div className="flex items-center text-indigo-700">
                        <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 mr-2 flex-shrink-0" />
                        <p className="text-xs sm:text-sm">Your payment has been confirmed by the admin. Waiting for tutor confirmation.</p>
                      </div>
                    </div>
                  )}

                  {effectiveStatus.toLowerCase() === 'confirmed' && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 sm:p-4 mb-4">
                      <div className="flex items-center text-green-700">
                        <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 mr-2 flex-shrink-0" />
                        <p className="text-xs sm:text-sm">Your payment has been confirmed. The session is now confirmed.</p>
                      </div>
                    </div>
                  )}

                  {effectiveStatus.toLowerCase() === 'refunded' && (
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 sm:p-4 mb-4">
                      <div className="flex items-center text-orange-700">
                        <Ban className="h-4 w-4 sm:h-5 sm:w-5 mr-2 flex-shrink-0" />
                        <p className="text-xs sm:text-sm">Your payment has been refunded.</p>
                      </div>
                    </div>
                  )}

                  {/* Show uploaded indication if a file exists */}
                  {booking.payment_proof && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 sm:p-4 mt-4">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                        <div className="flex items-center text-green-700">
                          <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 mr-2 flex-shrink-0" />
                          <p className="text-xs sm:text-sm">Your payment proof was uploaded.</p>
                        </div>
                        <a
                          href={getFileUrl(booking.payment_proof)}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs sm:text-sm text-green-700 hover:text-green-800 underline"
                        >
                          View upload
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      }

      {/* Payment History Section */}
      {
        paymentHistory.length > 0 && (
          <div className="bg-white rounded-xl sm:rounded-2xl md:rounded-3xl shadow-xl md:shadow-2xl border-2 border-slate-200/80 overflow-hidden -mx-2 sm:-mx-3 md:mx-0">
            {/* Enhanced Header for Desktop */}
            <div className="relative bg-gradient-to-r from-primary-600 via-primary-700 to-primary-800 p-4 sm:p-5 md:p-6 lg:p-6 text-white shadow-xl md:shadow-2xl overflow-hidden">
              <div className="absolute inset-0 opacity-10 hidden md:block">
                <div className="absolute top-0 right-0 w-48 h-48 bg-white rounded-full -mr-24 -mt-24 blur-3xl"></div>
                <div className="absolute bottom-0 left-0 w-36 h-36 bg-white rounded-full -ml-18 -mb-18 blur-3xl"></div>
              </div>
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="p-2 sm:p-2.5 md:p-2.5 bg-white/20 backdrop-blur-sm rounded-xl shadow-lg border border-white/20">
                    <History className="h-5 w-5 sm:h-6 sm:w-6 md:h-7 md:w-7" />
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl md:text-2xl lg:text-3xl font-extrabold mb-0.5 md:mb-1 tracking-tight">Payment History</h2>
                    <p className="text-xs sm:text-sm text-white/90 font-medium">{paymentHistory.length} {paymentHistory.length === 1 ? 'payment' : 'payments'} recorded</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Payment Cards - Compact Grid Layout for Desktop */}
            <div className="p-4 sm:p-5 md:p-6 lg:p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 md:gap-5 lg:gap-6">
                {paymentHistory.map((payment, index) => {
                  // Check if payment is linked to a booking with payment_pending status
                  // Try to find booking in the full bookings list if not directly attached
                  let bookingRequest = (payment as any).bookingRequest || (payment as any).booking_request;

                  if (!bookingRequest) {
                    // Fallback: try to find the booking in the loaded bookings list that matches this payment
                    bookingRequest = bookings.find(b =>
                      b.payment?.payment_id === payment.payment_id ||
                      (b.payments && b.payments.some(p => p.payment_id === payment.payment_id))
                    );
                  }

                  const bookingStatus = bookingRequest?.status || '';
                  // For payment history, use the payment status directly (already filtered to confirmed/disputed/refunded)
                  // If status is 'confirmed', display it as 'paid' in the UI
                  const paymentStatus = (payment.status || '').toLowerCase();
                  // If booking is pending, show 'Pending Payment' (mapped from 'pending') instead of 'Paid'
                  // This overrides the 'confirmed' payment status for display purposes
                  let displayStatus = paymentStatus;
                  if (bookingStatus.toLowerCase() === 'pending') {
                    displayStatus = 'pending';
                  } else if (bookingStatus.toLowerCase() === 'awaiting_payment') {
                    displayStatus = 'awaiting_payment';
                  } else if (paymentStatus === 'confirmed') {
                    displayStatus = 'paid';
                  }
                  const status = getStatusDisplay(displayStatus);
                  const tutorName = payment.tutor?.user?.name || 'Unknown Tutor';
                  const paymentDate = new Date(payment.created_at);
                  const isConfirmed = paymentStatus === 'confirmed';
                  const isRejected = paymentStatus === 'rejected';
                  const isDisputed = paymentStatus === 'disputed';
                  const isRefunded = paymentStatus === 'refunded';

                  // Get session rate and duration for calculation
                  const sessionRate = payment.tutor?.session_rate_per_hour ||
                    bookingRequest?.tutor?.session_rate_per_hour ||
                    (payment as any).tutor?.session_rate_per_hour || 0;
                  const duration = bookingRequest?.duration || (payment as any).duration || 0;
                  const totalAmountToPay = sessionRate * duration;
                  const amountPaid = Number(payment.amount) || 0;

                  return (
                    <div
                      key={payment.payment_id}
                      className="group relative bg-gradient-to-br from-white via-primary-50/40 to-primary-100/30 rounded-xl sm:rounded-2xl border-2 border-slate-200/90 hover:border-primary-400/80 shadow-lg md:shadow-xl hover:shadow-2xl transition-all duration-300 overflow-hidden transform hover:-translate-y-0.5"
                    >
                      {/* Enhanced Decorative gradient bar */}
                      <div className={`absolute top-0 left-0 right-0 h-1.5 md:h-2 ${isConfirmed ? 'bg-gradient-to-r from-green-400 via-emerald-500 to-green-600 shadow-md shadow-green-500/50' :
                        isDisputed ? 'bg-gradient-to-r from-purple-400 via-purple-500 to-purple-600 shadow-md shadow-purple-500/50' :
                          isRefunded ? 'bg-gradient-to-r from-orange-400 via-orange-500 to-orange-600 shadow-md shadow-orange-500/50' :
                            isRejected ? 'bg-gradient-to-r from-red-400 via-rose-500 to-red-600 shadow-md shadow-red-500/50' :
                              'bg-gradient-to-r from-primary-500 via-primary-600 to-primary-700 shadow-md shadow-primary-500/50'
                        }`} />

                      {/* Decorative background elements - smaller on desktop */}
                      <div className="absolute top-0 right-0 w-24 h-24 bg-primary-200/10 rounded-full -mr-12 -mt-12 blur-2xl hidden md:block"></div>
                      <div className="absolute bottom-0 left-0 w-20 h-20 bg-primary-300/10 rounded-full -ml-10 -mb-10 blur-2xl hidden md:block"></div>

                      <div className="relative p-4 sm:p-5 md:p-5 lg:p-6">
                        {/* Header Row - Compact */}
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4 mb-3 sm:mb-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 mb-3">
                              <div className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg md:rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-md ${status.color} border-2 ${status.color.includes('yellow') ? 'border-yellow-400 bg-yellow-50' :
                                status.color.includes('red') ? 'border-red-400 bg-red-50' :
                                  status.color.includes('green') ? 'border-green-400 bg-green-50' :
                                    status.color.includes('indigo') ? 'border-indigo-400 bg-indigo-50' :
                                      'border-primary-400 bg-primary-50'
                                }`}>
                                {status.icon}
                                {status.dotColor && <span className={`h-2.5 w-2.5 rounded-full ${status.dotColor}`} />}
                                <span className="whitespace-nowrap">{status.text}</span>
                              </div>
                              {/* <div className="px-2.5 sm:px-3 py-1 sm:py-1.5 bg-gradient-to-r from-slate-100 to-slate-200 text-slate-700 rounded-lg text-xs sm:text-sm font-semibold shadow-sm border border-slate-300">
                            #{payment.payment_id}
                          </div> */}
                            </div>

                            {/* Amount Paid - Compact Display for Desktop */}
                            <div className="mb-3 sm:mb-4">
                              <div className="relative overflow-hidden inline-flex flex-col sm:flex-row sm:items-baseline gap-1.5 sm:gap-3 bg-gradient-to-br from-green-50 via-emerald-50/70 to-green-50 px-4 sm:px-5 md:px-5 lg:px-6 py-2.5 sm:py-3 md:py-3 lg:py-3.5 rounded-xl md:rounded-2xl border-2 border-green-300/80 shadow-lg md:shadow-xl w-full sm:w-auto">
                                <div className="absolute top-0 right-0 w-20 h-20 bg-green-200/30 rounded-full -mr-10 -mt-10 blur-2xl hidden md:block"></div>
                                <span className="text-xs sm:text-sm text-slate-700 font-bold relative uppercase tracking-wide">Amount Paid</span>
                                <span className="text-2xl sm:text-3xl md:text-3xl lg:text-4xl font-black bg-gradient-to-r from-green-600 via-emerald-700 to-green-800 bg-clip-text text-transparent relative leading-tight">
                                  ₱{amountPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              </div>
                            </div>

                            {/* Compact Details Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5 mb-3 sm:mb-4">
                              {/* Session Rate */}
                              {sessionRate > 0 && (
                                <div className="group/item flex items-start gap-2.5 sm:gap-3 p-2.5 sm:p-3 bg-white/80 backdrop-blur-sm rounded-lg md:rounded-xl border-2 border-slate-200 shadow-sm hover:shadow-md hover:border-primary-300 transition-all duration-200">
                                  <div className="p-1.5 sm:p-2 bg-gradient-to-br from-blue-100 to-blue-200 rounded-lg shadow-sm flex-shrink-0">
                                    <svg className="h-4 w-4 sm:h-5 sm:w-5 text-blue-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-[10px] sm:text-xs text-slate-500 font-bold mb-0.5 uppercase tracking-wide">Session Rate</p>
                                    <p className="text-sm sm:text-base md:text-base font-bold text-slate-900">₱{sessionRate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/hour</p>
                                  </div>
                                </div>
                              )}

                              {/* Total Amount to Pay */}
                              {totalAmountToPay > 0 && (
                                <div className="group/item flex items-start gap-2.5 sm:gap-3 p-2.5 sm:p-3 bg-white/80 backdrop-blur-sm rounded-lg md:rounded-xl border-2 border-slate-200 shadow-sm hover:shadow-md hover:border-primary-300 transition-all duration-200">
                                  <div className="p-1.5 sm:p-2 bg-gradient-to-br from-amber-100 to-amber-200 rounded-lg shadow-sm flex-shrink-0">
                                    <svg className="h-4 w-4 sm:h-5 sm:w-5 text-amber-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                    </svg>
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-[10px] sm:text-xs text-slate-500 font-bold mb-0.5 uppercase tracking-wide">Total Amount to Pay</p>
                                    <p className="text-sm sm:text-base md:text-base font-bold text-slate-900">₱{totalAmountToPay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                    {duration > 0 && (
                                      <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5">({duration} {duration === 1 ? 'hour' : 'hours'})</p>
                                    )}
                                  </div>
                                </div>
                              )}
                              <div className="group/item flex items-start gap-2.5 sm:gap-3 p-2.5 sm:p-3 bg-white/80 backdrop-blur-sm rounded-lg md:rounded-xl border-2 border-slate-200 shadow-sm hover:shadow-md hover:border-primary-300 transition-all duration-200">
                                <div className="p-1.5 sm:p-2 bg-gradient-to-br from-primary-100 to-primary-200 rounded-lg shadow-sm flex-shrink-0">
                                  <svg className="h-4 w-4 sm:h-5 sm:w-5 text-primary-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                  </svg>
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-[10px] sm:text-xs text-slate-500 font-bold mb-0.5 uppercase tracking-wide">Tutor</p>
                                  <p className="text-sm sm:text-base md:text-base font-bold text-slate-900 break-words">{tutorName}</p>
                                </div>
                              </div>

                              {(() => {
                                // Get subject name - handle both string and object formats
                                const subject = (payment as any).subject;
                                let subjectName: string | null = null;

                                if (typeof subject === 'string') {
                                  subjectName = subject;
                                } else if (subject?.subject_name) {
                                  subjectName = subject.subject_name;
                                } else if (bookingRequest?.subject) {
                                  subjectName = bookingRequest.subject;
                                }

                                return subjectName ? (
                                  <div className="group/item flex items-start gap-2.5 sm:gap-3 p-2.5 sm:p-3 bg-white/80 backdrop-blur-sm rounded-lg md:rounded-xl border-2 border-slate-200 shadow-sm hover:shadow-md hover:border-primary-300 transition-all duration-200">
                                    <div className="p-1.5 sm:p-2 bg-gradient-to-br from-indigo-100 to-indigo-200 rounded-lg shadow-sm flex-shrink-0">
                                      <svg className="h-4 w-4 sm:h-5 sm:w-5 text-indigo-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                      </svg>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="text-[10px] sm:text-xs text-slate-500 font-bold mb-0.5 uppercase tracking-wide">Subject</p>
                                      <p className="text-sm sm:text-base md:text-base font-bold text-slate-900 break-words">{subjectName}</p>
                                    </div>
                                  </div>
                                ) : null;
                              })()}

                              <div className="group/item flex items-start gap-2.5 sm:gap-3 p-2.5 sm:p-3 bg-white/80 backdrop-blur-sm rounded-lg md:rounded-xl border-2 border-slate-200 shadow-sm hover:shadow-md hover:border-primary-300 transition-all duration-200 sm:col-span-2">
                                <div className="p-1.5 sm:p-2 bg-gradient-to-br from-purple-100 to-purple-200 rounded-lg shadow-sm flex-shrink-0">
                                  <svg className="h-4 w-4 sm:h-5 sm:w-5 text-purple-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-[10px] sm:text-xs text-slate-500 font-bold mb-0.5 uppercase tracking-wide">Session Scheduled</p>
                                  <p className="text-sm sm:text-base md:text-base font-bold text-slate-900">
                                    {bookingRequest?.date ? new Date(bookingRequest.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Date not set'}
                                    {bookingRequest?.time && <span className="text-slate-600 font-medium ml-2 text-xs sm:text-sm">at {bookingRequest.time}</span>}
                                  </p>
                                </div>
                              </div>

                              <div className="group/item flex items-start gap-2.5 sm:gap-3 p-2.5 sm:p-3 bg-white/80 backdrop-blur-sm rounded-lg md:rounded-xl border-2 border-slate-200 shadow-sm hover:shadow-md hover:border-primary-300 transition-all duration-200 sm:col-span-2">
                                <div className="p-1.5 sm:p-2 bg-gradient-to-br from-primary-100 to-primary-200 rounded-lg shadow-sm flex-shrink-0">
                                  <svg className="h-4 w-4 sm:h-5 sm:w-5 text-primary-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-[10px] sm:text-xs text-slate-500 font-bold mb-0.5 uppercase tracking-wide">Payment Date</p>
                                  <p className="text-sm sm:text-base md:text-base font-bold text-slate-900">
                                    {paymentDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                                    <span className="text-slate-600 font-medium ml-2 text-xs sm:text-sm">at {paymentDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                                  </p>
                                </div>
                              </div>
                            </div>

                            {/* Compact Rejection Reason */}
                            {payment.rejection_reason && (
                              <div className="mt-3 sm:mt-4 p-3 sm:p-4 bg-gradient-to-br from-red-50 via-rose-50 to-red-50 border-2 border-red-300 rounded-xl shadow-md">
                                <div className="flex items-start gap-2.5 sm:gap-3">
                                  <div className="p-1.5 bg-red-100 rounded-lg flex-shrink-0">
                                    <Ban className="h-4 w-4 sm:h-5 sm:w-5 text-red-600" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs sm:text-sm font-bold text-red-900 mb-1.5 uppercase tracking-wide">Rejection Reason</p>
                                    <p className="text-xs sm:text-sm text-red-800 leading-relaxed whitespace-pre-wrap break-words font-medium">
                                      {payment.rejection_reason}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Compact Action Buttons */}
                        <div className="flex flex-col sm:flex-row items-stretch gap-2.5 sm:gap-3 pt-3 md:pt-4 border-t-2 border-slate-300/80">
                          {payment.payment_proof && (
                            <a
                              href={getFileUrl(payment.payment_proof)}
                              target="_blank"
                              rel="noreferrer"
                              className="group/btn flex items-center justify-center gap-2 px-4 sm:px-5 md:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-primary-600 via-primary-700 to-primary-600 hover:from-primary-700 hover:via-primary-800 hover:to-primary-700 text-white rounded-lg md:rounded-xl font-bold text-xs sm:text-sm md:text-base shadow-lg md:shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105"
                            >
                              <FileText className="h-4 w-4 sm:h-5 sm:w-5" />
                              <span>View Proof</span>
                              <svg className="h-4 w-4 sm:h-5 sm:w-5 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                            </a>
                          )}
                          {payment.admin_proof && (
                            <a
                              href={getFileUrl(payment.admin_proof)}
                              target="_blank"
                              rel="noreferrer"
                              className="group/btn flex items-center justify-center gap-2 px-4 sm:px-5 md:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-primary-700 via-primary-600 to-primary-700 hover:from-primary-800 hover:via-primary-700 hover:to-primary-800 text-white rounded-lg md:rounded-xl font-bold text-xs sm:text-sm md:text-base shadow-lg md:shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105"
                            >
                              <FileText className="h-4 w-4 sm:h-5 sm:w-5" />
                              <span>Admin Proof</span>
                              <svg className="h-4 w-4 sm:h-5 sm:w-5 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )
      }

      {/* QR Modal (reusable site Modal) - outside the bookings loop */}
      <Modal isOpen={qrModalOpen} onClose={() => setQrModalOpen(false)} title={qrModalTitle || 'QR'}>
        {qrModalUrl ? (
          <div className="w-full flex justify-center">
            <img src={qrModalUrl} alt={qrModalTitle || 'QR Image'} className="max-h-[70vh] object-contain" />
          </div>
        ) : (
          <div className="text-slate-600">No image available</div>
        )}
      </Modal>
    </div >
  );
};

export default TuteePayment;