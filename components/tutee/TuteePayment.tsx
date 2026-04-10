import React, { useEffect, useState } from 'react';
import { CreditCard, Upload, AlertCircle, CheckCircle2, Ban, History, FileText, Info, RefreshCw } from 'lucide-react';
import apiClient, { getFileUrl } from '../../services/api';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Modal from '../ui/Modal';
import { useAuth } from '../../hooks/useAuth';
import QRCode from 'react-qr-code';
import { decodeQRFromImageUrl, injectAmountIntoPayload } from '../../utils/qrUtils';

interface Payment {
  payment_id: number;
  student_id: number;
  tutor_id: number;
  amount: number;
  status: 'pending' | 'paid' | 'admin_confirmed' | 'confirmed' | 'rejected' | 'refunded';
  subject?: string;
  created_at: string;
  rejection_reason?: string;
  payment_proof_url?: string;
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
  const [admins, setAdmins] = useState<Array<{ user_id: number; name: string; qr_code_url: string; gcash_number?: string }>>([]);
  const [gcashCopied, setGcashCopied] = useState(false);
  const [amountByBooking, setAmountByBooking] = useState<Record<number, string>>({});
  const [initialized, setInitialized] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrModalUrl, setQrModalUrl] = useState<string | null>(null);
  const [qrModalTitle, setQrModalTitle] = useState<string | undefined>(undefined);
  const [reuploadFiles, setReuploadFiles] = useState<Record<number, File | undefined>>({});
  const [reuploadAmounts, setReuploadAmounts] = useState<Record<number, string>>({});
  const [reuploadingPaymentId, setReuploadingPaymentId] = useState<number | null>(null);
  const [expandedProofBookingId, setExpandedProofBookingId] = useState<number | null>(null);
  const [expandedProofPaymentId, setExpandedProofPaymentId] = useState<number | null>(null);
  const [decodedQrPayload, setDecodedQrPayload] = useState<string | null>(null);
  const [useDynamicQR, setUseDynamicQR] = useState<Record<number, boolean>>({});
  const [qrModalPayload, setQrModalPayload] = useState<string | null>(null);
  const [qrCacheBust, setQrCacheBust] = useState<number>(Date.now());
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
        setQrCacheBust(Date.now());
      } catch (e) {
        // ignore
      }
    };
    loadAdmins();
  }, []);

  useEffect(() => {
    if (admins.length > 0 && admins[0].qr_code_url) {
      const url = `${getFileUrl(admins[0].qr_code_url)}?t=${qrCacheBust}`;
      decodeQRFromImageUrl(url).then((payload) => {
        if (payload) {
          console.log('Decoded admin QR payload:', payload);
          setDecodedQrPayload(payload);
        } else {
          console.warn('Failed to decode admin QR image');
        }
      });
    }
  }, [admins, qrCacheBust]);

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
    // If a payment explicitly exists and was refunded/rejected by admin, override the booking status which may be stuck on payment_pending
    if (booking.payment?.status) {
      const pStatus = booking.payment.status.toLowerCase();
      if (pStatus === 'rejected' || pStatus === 'refunded') {
        return pStatus;
      }
    }

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
    return normalized === 'payment_rejected' || normalized === 'rejected' || normalized === 'refunded';
  };

  // Helper function to check if status allows payment submission (case-insensitive) - checks payment status
  const allowsPaymentSubmission = (booking: BookingRequest): boolean => {
    const effectiveStatus = getEffectivePaymentStatus(booking);
    const normalized = (effectiveStatus || '').toLowerCase();
    return normalized === 'awaiting_payment' ||
      normalized === 'pending' ||
      normalized === 'payment_rejected' ||
      normalized === 'rejected' ||
      normalized === 'refunded';
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
            // ONLY include payments with sender='tutee' (or unspecified)
            if (sender && sender !== 'tutee') return false;

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

          // Also check if the legacy payment field has sender='tutee' (or unspecified)
          const legacyPayment = booking.payment;
          const shouldUseLegacyPayment = legacyPayment &&
            (!(legacyPayment as any).sender || (legacyPayment as any).sender === 'tutee');

          // Cross-reference with allPayments for refunded payments that may not be in booking.payments
          // Note: we search allPayments (not userPayments) because refunded payments may not have sender='tutee'
          const refundedFromGlobal = allPayments.find((p: Payment) => {
            if ((p as any).booking_request_id !== booking.id) return false;
            if ((p.status || '').toLowerCase() !== 'refunded') return false;
            // Verify this payment belongs to the current user
            const pStudentId = (p as any).student_id;
            const uStudentId = (user as any).student_id;
            return (pStudentId && uStudentId && pStudentId === uStudentId) ||
              (p as any).student?.user?.user_id === user?.user_id ||
              (pStudentId && !uStudentId && pStudentId === (user as any).id);
          });

          // Refunded payment takes priority since it represents the most recent admin action
          const resolvedPayment = refundedFromGlobal || latestPayment || (shouldUseLegacyPayment ? legacyPayment : null) || null;

          return {
            ...booking,
            payment: resolvedPayment
          };
        })
        .filter((booking: BookingRequest) => {
          // Include bookings that have:
          // 1. Payment-related booking status, OR
          // 2. An associated payment with status: 'pending', 'admin_confirmed', 'confirmed', 'rejected', 'refunded'
          // BUT exclude payments with sender='admin'
          const bookingStatus = (booking.status || '').toLowerCase();

          // Check if payment exists and ONLY include if sender is 'tutee' (if the field exists)
          // Exception: always include refunded payments regardless of sender
          if (booking.payment) {
            const paymentStatus = (booking.payment.status || '').toLowerCase();
            const paymentSender = (booking.payment as any).sender;
            // ONLY exclude payments if sender is explicitly something other than 'tutee'
            // BUT always keep refunded payments (admin may have refunded it)
            if (paymentSender && paymentSender !== 'tutee' && paymentStatus !== 'refunded') {
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

  const handleReuploadProof = async (paymentId: number, bookingId: number) => {
    const file = reuploadFiles[paymentId];
    const adminId = admins.length > 0 ? admins[0].user_id : null;
    const amt = reuploadAmounts[paymentId] || '';
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

    try {
      setReuploadingPaymentId(paymentId);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('bookingId', String(bookingId));
      formData.append('adminId', String(adminId));
      formData.append('amount', amt);

      await apiClient.post('/payments/submit-proof', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      toast.success('Payment proof resubmitted successfully');
      setReuploadFiles(prev => { const p = { ...prev }; delete p[paymentId]; return p; });
      setReuploadAmounts(prev => { const p = { ...prev }; delete p[paymentId]; return p; });
      await fetchBookings(false);
      await fetchPaymentHistory();
    } catch (err: any) {
      console.error('Failed to reupload payment proof:', err);
      toast.error(err.response?.data?.message || 'Failed to resubmit payment proof');
    } finally {
      setReuploadingPaymentId(null);
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
          text: 'Awaiting Payment',
          color: 'text-yellow-700 bg-yellow-50 border-yellow-200',
          dotColor: 'bg-yellow-500'
        };
      case 'refunded':
        return {
          icon: <Ban className="h-5 w-5 text-orange-500" />,
          text: 'Payment Rejected',
          color: 'text-orange-700 bg-orange-50 border-orange-200',
          dotColor: 'bg-orange-500'
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
    <div className="space-y-4 sm:space-y-4 md:space-y-6 pb-6 md:pb-10">
      {/* <ToastContainer aria-label="Notifications" /> */}
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
              Manage your session payments and track payment history
            </p>
          </div>
          <button
            onClick={async () => {
              await fetchBookings(true);
              await fetchPaymentHistory();
            }}
            className="w-full sm:w-auto sm:ml-auto flex-shrink-0 px-4 py-2.5 sm:py-2 text-sm md:text-base font-bold text-sky-700 hover:text-sky-800 active:text-sky-900 bg-white hover:bg-sky-50 active:bg-sky-100 rounded-xl transition-all shadow-md hover:shadow-lg touch-manipulation flex items-center justify-center gap-2"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            <svg className="w-4 h-4 md:w-5 md:h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span className="whitespace-nowrap">Refresh</span>
          </button>
        </div>
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
                    effectiveStatus.toLowerCase() === 'refunded'
                      ? 'bg-gradient-to-r from-orange-400 via-orange-500 to-orange-600' :
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
                            status.color.includes('orange') ? 'border-orange-400' :
                              status.color.includes('green') ? 'border-green-400' :
                                status.color.includes('indigo') ? 'border-indigo-400' :
                                  'border-primary-400'
                          }`}>
                          {status.icon}
                          {status.dotColor && <span className={`h-2.5 w-2.5 md:h-3 md:w-3 rounded-full ${status.dotColor}`} />}
                          <span className="whitespace-nowrap">{status.text}</span>
                        </div>
                        {/* {effectiveStatus.toLowerCase() === 'refunded' && (
                          <div className="px-3 sm:px-4 md:px-5 py-1.5 sm:py-2 md:py-2.5 rounded-xl md:rounded-2xl text-[10px] sm:text-xs md:text-sm font-bold bg-orange-50 text-orange-700 border-2 border-orange-400 shadow-sm md:shadow-md flex items-center gap-1.5">
                            <Ban className="h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5" />
                            <span>Payment Rejected</span>
                          </div>
                        )} */}
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
                    <div className="relative overflow-hidden bg-gradient-to-br from-white via-primary-50/30 to-white rounded-xl md:rounded-3xl border border-slate-200/60 p-5 sm:p-6 md:p-8 lg:p-10 mb-6 md:mb-8 shadow-sm hover:shadow-md transition-shadow duration-300">
                      <div className="absolute top-0 right-0 w-64 h-64 bg-primary-100/40 rounded-full -mr-20 -mt-20 blur-3xl hidden md:block pointer-events-none"></div>
                      <div className="absolute bottom-0 left-0 w-64 h-64 bg-primary-50/50 rounded-full -ml-20 -mb-20 blur-3xl hidden md:block pointer-events-none"></div>

                      <div className="relative z-10">
                        <h4 className="font-extrabold text-xl sm:text-2xl md:text-3xl text-slate-800 mb-6 sm:mb-8 flex items-center gap-3 md:gap-4 tracking-tight">
                          <div className="p-2.5 md:p-3 bg-gradient-to-br from-primary-50 to-primary-100 rounded-xl shadow-sm border border-primary-100/50">
                            <CreditCard className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 text-primary-600" />
                          </div>
                          Payment Instructions
                        </h4>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 md:gap-10">
                          {/* Admin QR Code Section */}
                          <div className="flex flex-col items-center justify-center p-6 sm:p-8 md:p-10 bg-white/60 backdrop-blur-sm rounded-2xl md:rounded-3xl border border-slate-200/50 shadow-sm transition-all duration-300 hover:bg-white">
                            {admins.length > 0 ? (
                              <>
                                <p className="text-sm md:text-base text-slate-600 font-bold mb-5 sm:mb-6 text-center uppercase tracking-wider">Scan this QR code to pay</p>
                                <div className="flex flex-col items-center w-full">
                                  <div className="relative group/qr mb-4">
                                    <div className="absolute -inset-2 bg-gradient-to-r from-primary-200 to-indigo-200 rounded-3xl blur opacity-30 group-hover/qr:opacity-50 transition duration-500"></div>
                                    
                                    {/* QR Code Container */}
                                    <div className="relative bg-white rounded-2xl shadow-sm border border-white p-4 transition-transform duration-300 group-hover/qr:scale-[1.02]">
                                      {useDynamicQR[booking.id] && decodedQrPayload ? (
                                        <div className="h-56 w-56 sm:h-64 sm:w-64 md:h-72 md:w-72 flex items-center justify-center bg-white p-2">
                                          <QRCode
                                            value={injectAmountIntoPayload(
                                              decodedQrPayload,
                                              amountByBooking[booking.id] || calculatedAmount
                                            )}
                                            size={256}
                                            style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                                            viewBox={`0 0 256 256`}
                                            level="M"
                                          />
                                        </div>
                                      ) : admins[0].qr_code_url ? (
                                        <img
                                          src={`${getFileUrl(admins[0].qr_code_url)}?t=${qrCacheBust}`}
                                          alt={`${admins[0].name} QR`}
                                          className="h-56 w-56 sm:h-64 sm:w-64 md:h-72 md:w-72 object-contain"
                                        />
                                      ) : (
                                        <div className="h-56 w-56 sm:h-64 sm:w-64 md:h-72 md:w-72 flex items-center justify-center bg-slate-50 rounded-xl">
                                          <p className="text-sm text-slate-400 text-center px-4">No QR code uploaded yet. Please send payment manually using the GCash number below.</p>
                                        </div>
                                      )}

                                      {/* View larger button */}
                                      <button
                                        onClick={() => {
                                          if (useDynamicQR[booking.id] && decodedQrPayload) {
                                            setQrModalUrl(null);
                                            setQrModalPayload(injectAmountIntoPayload(
                                              decodedQrPayload,
                                              amountByBooking[booking.id] || calculatedAmount
                                            ));
                                          } else {
                                            setQrModalUrl(admins[0].qr_code_url ? `${getFileUrl(admins[0].qr_code_url)}?t=${qrCacheBust}` : null);
                                            setQrModalPayload(null);
                                          }
                                          setQrModalTitle(admins[0].name);
                                          setQrModalOpen(true);
                                        }}
                                        className="absolute -top-3 -right-3 p-3 bg-white text-slate-500 hover:text-primary-600 rounded-xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)] border border-slate-100 hover:border-primary-100 transition-all opacity-0 group-hover/qr:opacity-100 scale-95 group-hover/qr:scale-100"
                                        title="View larger"
                                        style={{ WebkitTapHighlightColor: 'transparent' }}
                                      >
                                        <svg className="h-5 w-5 sm:h-6 sm:w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                                        </svg>
                                      </button>
                                      
                                      {/* Download QR button (Static only) */}
                                      {!useDynamicQR[booking.id] && admins[0].qr_code_url && (
                                        <button
                                          onClick={async () => {
                                            try {
                                              const url = `${getFileUrl(admins[0].qr_code_url)}?t=${qrCacheBust}`;
                                              const response = await fetch(url);
                                              const blob = await response.blob();
                                              const blobUrl = URL.createObjectURL(blob);
                                              const a = document.createElement('a');
                                              a.href = blobUrl;
                                              a.download = `${admins[0].name.replace(/\s+/g, '_')}_GCash_QR.png`;
                                              document.body.appendChild(a);
                                              a.click();
                                              document.body.removeChild(a);
                                              URL.revokeObjectURL(blobUrl);
                                            } catch {
                                              toast.error('Failed to download QR code');
                                            }
                                          }}
                                          className="absolute -top-3 -left-3 p-3 bg-white text-slate-500 hover:text-emerald-600 rounded-xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)] border border-slate-100 hover:border-emerald-200 transition-all opacity-0 group-hover/qr:opacity-100 scale-95 group-hover/qr:scale-100"
                                          title="Download QR code"
                                          style={{ WebkitTapHighlightColor: 'transparent' }}
                                        >
                                          <svg className="h-5 w-5 sm:h-6 sm:w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                          </svg>
                                        </button>
                                      )}
                                    </div>
                                  </div>

                                  {/* QR Toggle Button — only show if base payload was decoded */}
                                  {decodedQrPayload && admins[0].qr_code_url && (
                                    <button
                                      onClick={() => setUseDynamicQR(prev => ({ ...prev, [booking.id]: !prev[booking.id] }))}
                                      className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full text-xs font-bold transition-all border border-slate-200 shadow-sm mb-4"
                                    >
                                      <RefreshCw className={`h-3 w-3 ${useDynamicQR[booking.id] ? 'text-primary-600 animate-spin' : ''}`} style={{ animationDuration: '3s' }} />
                                      <span>{useDynamicQR[booking.id] ? 'Switch to Static QR' : 'Switch to Dynamic QR'}</span>
                                    </button>
                                  )}

                                  {/* Dynamic QR Info tag */}
                                  {useDynamicQR[booking.id] && decodedQrPayload && (
                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-primary-50 text-primary-700 rounded-lg text-[10px] sm:text-xs font-bold uppercase tracking-widest border border-primary-200 mb-2">
                                      <span className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-500"></span>
                                      </span>
                                      Dynamic QR with Amount
                                    </div>
                                  )}
                                </div>
                                {/* GCash Number with copy button */}
                                {admins[0].gcash_number && (
                                  <div className="mt-5 sm:mt-6 flex items-center gap-2 bg-green-50 border-2 border-green-200 rounded-xl px-4 py-2.5 shadow-sm">
                                    <svg className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                    </svg>
                                    <span className="text-sm sm:text-base font-bold text-green-800 tracking-wide">{admins[0].gcash_number}</span>
                                    <button
                                      onClick={() => {
                                        navigator.clipboard.writeText(admins[0].gcash_number!);
                                        setGcashCopied(true);
                                        setTimeout(() => setGcashCopied(false), 2000);
                                      }}
                                      className="ml-1 p-1.5 rounded-lg bg-green-100 hover:bg-green-200 text-green-700 hover:text-green-900 transition-colors"
                                      title="Copy GCash number"
                                      style={{ WebkitTapHighlightColor: 'transparent' }}
                                    >
                                      {gcashCopied ? (
                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                        </svg>
                                      ) : (
                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                        </svg>
                                      )}
                                    </button>
                                    {gcashCopied && <span className="text-xs text-green-600 font-semibold">Copied!</span>}
                                  </div>
                                )}
                                <p className="mt-4 sm:mt-5 text-lg sm:text-xl md:text-2xl font-extrabold text-slate-800 tracking-tight">{admins[0].name}</p>
                                <p className="mt-2 text-xs sm:text-sm text-slate-500 text-center font-medium">Click the icon on the QR code to view larger</p>
                              </>
                            ) : (
                              <div className="text-center py-12">
                                <CreditCard className="h-16 w-16 sm:h-20 sm:w-20 text-slate-200 mx-auto mb-4" />
                                <p className="text-sm sm:text-base text-slate-500 font-medium">Admin QR code not available</p>
                              </div>
                            )}
                          </div>

                          {/* Payment Form Section */}
                          <div className="bg-white/80 backdrop-blur-sm rounded-2xl md:rounded-3xl p-6 sm:p-8 md:p-10 border border-slate-200/60 shadow-sm space-y-6 sm:space-y-8 flex flex-col justify-center transition-all duration-300 hover:bg-white">
                            <div className="group">
                              <label className="text-sm sm:text-base md:text-lg font-bold text-slate-700 mb-3 flex items-center gap-2.5">
                                <span className="bg-slate-100 p-1.5 rounded-lg text-slate-500 group-hover:bg-primary-50 group-hover:text-primary-600 transition-colors"><svg className="h-4 w-4 md:h-5 md:w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></span>
                                Amount to Pay
                              </label>
                              {calculatedAmount > 0 ? (
                                <div className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-slate-800 tracking-tight">
                                  ₱{calculatedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                              ) : (
                                <div className="text-sm sm:text-base text-slate-500 py-2 font-medium bg-slate-50 rounded-xl px-4 border border-slate-100 w-max">
                                  Session rate not set
                                </div>
                              )}
                            </div>

                            <div className="group">
                              <label className="text-sm sm:text-base md:text-lg font-bold text-slate-700 mb-3 flex items-center gap-2.5">
                                <span className="bg-slate-100 p-1.5 rounded-lg text-slate-500 group-hover:bg-primary-50 group-hover:text-primary-600 transition-colors"><svg className="h-4 w-4 md:h-5 md:w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg></span>
                                Amount Paid
                              </label>
                              {/* value={amountByBooking[booking.id] || (calculatedAmount > 0 && !isRejectedStatus(booking) ? calculatedAmount.toFixed(2) : '111')} */}
                              <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                                  <span className="text-slate-400 font-bold sm:text-xl">₱</span>
                                </div>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={
                                    amountByBooking[booking.id] ??
                                    (calculatedAmount > 0 ? calculatedAmount.toFixed(2) : '')
                                  }
                                  onChange={(e) => setAmountByBooking(prev => ({ ...prev, [booking.id]: e.target.value }))}
                                  className="w-full pl-11 pr-5 py-3.5 sm:py-4 bg-slate-50/50 border border-slate-200 rounded-xl md:rounded-2xl text-slate-800 text-lg sm:text-xl font-bold placeholder-slate-300 focus:bg-white focus:ring-4 focus:ring-primary-400/10 focus:border-primary-400 transition-all hover:bg-slate-50"
                                  placeholder="0.00"
                                />
                              </div>
                              {calculatedAmount > 0 && !isRejectedStatus(booking) && (
                                <p className="text-[11px] sm:text-xs text-slate-400 mt-2 font-medium ml-1">Auto-filled based on session rate. You can edit if needed.</p>
                              )}
                              {isRejectedStatus(booking) && (
                                <p className="text-[11px] sm:text-xs text-rose-500 mt-2 font-medium ml-1">Please verify and enter the correct amount paid</p>
                              )}
                            </div>

                            {/* Upload section */}
                            <div className="space-y-4">
                              <label className="text-sm sm:text-base md:text-lg font-bold text-slate-700 mb-1 flex items-center gap-2.5">
                                <span className="bg-slate-100 p-1.5 rounded-lg text-slate-500"><Upload className="h-4 w-4 md:h-5 md:w-5" /></span>
                                Upload Payment Proof
                              </label>

                              <div className="relative w-full">
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => handlePaymentFileChange(e, booking.id)}
                                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                  id={`file-input-${booking.id}`}
                                />
                                <div className={`w-full flex items-center justify-between px-5 py-4 border ${selectedPaymentFiles[booking.id] ? 'border-primary-400 bg-primary-50/20 shadow-[0_0_0_4px_rgba(6,81,237,0.05)]' : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50'} rounded-xl md:rounded-2xl transition-all duration-200`}>
                                  <span className={`text-sm sm:text-base tracking-wide truncate pr-4 font-semibold ${selectedPaymentFiles[booking.id] ? 'text-primary-700' : 'text-slate-400'}`}>
                                    {selectedPaymentFiles[booking.id] ? selectedPaymentFiles[booking.id]?.name : 'Browse for an image file...'}
                                  </span>
                                  <div className={`p-2 rounded-xl shrink-0 ${selectedPaymentFiles[booking.id] ? 'bg-primary-100/50 text-primary-600' : 'bg-slate-200/50 text-slate-400'}`}>
                                    <Upload className="h-5 w-5" />
                                  </div>
                                </div>
                              </div>

                              {/* Amount validation helper */}
                              {amountByBooking[booking.id] && calculatedAmount > 0 && (() => {
                                const amountPaid = Number(amountByBooking[booking.id]);
                                const isValidAmount = !isNaN(amountPaid) && amountPaid >= calculatedAmount;
                                if (!isValidAmount) {
                                  return (
                                    <div className="p-3 bg-rose-50/50 border border-rose-100 rounded-xl">
                                      <p className="text-xs sm:text-sm text-rose-600 font-medium">
                                        ⚠️ Paid amount (₱{amountPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}) is less than required (₱{calculatedAmount}).
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
                                className="w-full mt-2 flex items-center justify-center gap-2 sm:gap-3 px-6 py-4 bg-slate-800 text-white rounded-xl md:rounded-2xl hover:bg-slate-900 active:bg-black disabled:bg-slate-100 disabled:text-slate-400 disabled:border disabled:border-slate-200 disabled:cursor-not-allowed transition-all text-base sm:text-lg font-bold tracking-wide group/btn"
                                style={{ WebkitTapHighlightColor: 'transparent' }}
                              >
                                {uploadingPayment ? (
                                  <>
                                    <svg className="animate-spin h-5 w-5 sm:h-6 sm:w-6" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                    <span>Processing...</span>
                                  </>
                                ) : (
                                  <>
                                    <span>{isRejectedStatus(booking) ? 'Resubmit Proof' : 'Submit Proof'}</span>
                                    <svg className="h-5 w-5 sm:h-6 sm:w-6 shrink-0 transition-transform group-hover/btn:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                                  </>
                                )}
                              </button>

                              {/* Error Reporting array */}
                              {(() => {
                                const amountPaid = amountByBooking[booking.id] ? Number(amountByBooking[booking.id]) : 0;
                                const hasValidAmount = calculatedAmount > 0
                                  ? (!isNaN(amountPaid) && amountPaid >= calculatedAmount)
                                  : (!isNaN(amountPaid) && amountPaid > 0);
                                const missingRequirements = [];

                                if (admins.length === 0) missingRequirements.push('Admin QR code not available');
                                if (!selectedPaymentFiles[booking.id]) missingRequirements.push('Select a payment proof image');
                                if (!amountByBooking[booking.id]) missingRequirements.push('Enter the amount paid');
                                else if (calculatedAmount > 0 && (isNaN(amountPaid) || amountPaid < calculatedAmount)) {
                                  missingRequirements.push(`Amount paid must be at least ₱${calculatedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
                                } else if (calculatedAmount === 0 && (isNaN(amountPaid) || amountPaid <= 0)) {
                                  missingRequirements.push('Enter a valid amount');
                                }

                                return missingRequirements.length > 0 ? (
                                  <div className="pt-2 flex flex-wrap gap-2 text-[11px] sm:text-xs">
                                    {missingRequirements.map((req, idx) => (
                                      <span key={idx} className="bg-slate-100 text-slate-500 px-2.5 py-1.5 rounded-lg font-medium">{req}</span>
                                    ))}
                                  </div>
                                ) : null;
                              })()}
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
                            Your previous payment proof has been rejected. Kindly upload a new proof of payment.
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

                  {/* Show uploaded indication if a file exists and not rejected */}
                  {booking.payment_proof && !isRejectedStatus(booking) && (
                    <div className="w-full mt-4">
                      <button
                        type="button"
                        onClick={() => setExpandedProofBookingId(expandedProofBookingId === booking.id ? null : booking.id)}
                        className="w-full flex items-center justify-between gap-3 bg-gradient-to-r from-green-50 to-emerald-50 hover:from-green-100 hover:to-emerald-100 border-2 border-green-300 rounded-xl p-3 sm:p-4 transition-all duration-200 shadow-sm hover:shadow-md group"
                      >
                        <div className="flex items-center gap-2.5 text-green-700">
                          <div className="p-1.5 bg-green-100 rounded-lg group-hover:bg-green-200 transition-colors">
                            <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                          </div>
                          <p className="text-xs sm:text-sm font-semibold">Your payment proof was uploaded</p>
                        </div>
                        <div className="flex items-center gap-2 text-green-600 font-medium text-xs sm:text-sm">
                          <span className="hidden sm:inline">{expandedProofBookingId === booking.id ? 'Hide' : 'View'}</span>
                          <FileText className="h-4 w-4 sm:h-4 sm:w-4" />
                        </div>
                      </button>
                      {expandedProofBookingId === booking.id && (
                        <div className="mt-3 w-full bg-white rounded-xl border-2 border-green-200 p-3 sm:p-4 shadow-inner">
                          <div className="w-full flex justify-center items-center">
                            <img
                              src={getFileUrl(booking.payment_proof)}
                              alt="Payment proof"
                              className="max-w-full max-h-[60vh] sm:max-h-[70vh] w-auto h-auto object-contain rounded-lg shadow-md"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.alt = 'Failed to load payment proof';
                                target.className = 'w-full p-8 text-center text-red-500 text-sm';
                              }}
                            />
                          </div>
                        </div>
                      )}
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
                                  status.color.includes('orange') ? 'border-orange-400 bg-orange-50' :
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

                            {/* Recently Refunded/Rejected label for confirmed payments with rejection_reason */}
                            {payment.rejection_reason && isConfirmed && (
                              <div className="mt-3 sm:mt-4 p-2.5 sm:p-3 bg-gradient-to-r from-orange-50 via-amber-50 to-orange-50 border-2 border-orange-300 rounded-xl shadow-sm">
                                <div className="flex items-center gap-2">
                                  <div className="p-1 bg-orange-100 rounded-lg flex-shrink-0">
                                    <AlertCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-orange-600" />
                                  </div>
                                  <p className="text-xs sm:text-sm font-bold text-orange-800 uppercase tracking-wide">Recently Refunded/Rejected</p>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        {/* Reupload Proof for Refunded Payments */}
                        {isRefunded && bookingRequest && (
                          <div className="mt-4 p-4 sm:p-5 bg-gradient-to-br from-orange-50 via-amber-50/50 to-orange-50 border-2 border-orange-200 rounded-xl shadow-sm">
                            <div className="flex items-center gap-2.5 mb-4">
                              <div className="p-2 bg-orange-100 rounded-lg">
                                <RefreshCw className="h-4 w-4 sm:h-5 sm:w-5 text-orange-600" />
                              </div>
                              <div>
                                <h4 className="text-sm sm:text-base font-bold text-orange-900">Reupload Payment Proof</h4>
                                <p className="text-[10px] sm:text-xs text-orange-700">This payment was refunded. You can submit a new proof of payment.</p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Compact Action Buttons */}
                        <div className="flex flex-col items-stretch gap-2.5 sm:gap-3 pt-3 md:pt-4 border-t-2 border-slate-300/80">
                          {payment.payment_proof_url && (
                            <div className="w-full">
                              <button
                                type="button"
                                onClick={() => setExpandedProofPaymentId(expandedProofPaymentId === payment.payment_id ? null : payment.payment_id)}
                                className="group/btn w-full flex items-center justify-center gap-2 px-4 sm:px-5 md:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-primary-600 via-primary-700 to-primary-600 hover:from-primary-700 hover:via-primary-800 hover:to-primary-700 text-white rounded-lg md:rounded-xl font-bold text-xs sm:text-sm md:text-base shadow-lg md:shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105 cursor-pointer"
                              >
                                <FileText className="h-4 w-4 sm:h-5 sm:w-5" />
                                <span>{expandedProofPaymentId === payment.payment_id ? 'Hide Proof' : 'View Proof'}</span>
                              </button>
                              {expandedProofPaymentId === payment.payment_id && (
                                <div className="mt-3 flex justify-center bg-white rounded-xl border-2 border-slate-200 p-2 sm:p-3 shadow-inner">
                                  <img
                                    src={getFileUrl(payment.payment_proof_url)}
                                    alt="Payment proof"
                                    className="max-h-[50vh] w-auto object-contain rounded-lg shadow-sm"
                                    onError={(e) => { (e.target as HTMLImageElement).alt = 'Failed to load image'; }}
                                  />
                                </div>
                              )}
                            </div>
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
        <div className="w-full flex flex-col items-center gap-6 p-4">
          {qrModalPayload ? (
            <div className="bg-white p-4 rounded-2xl shadow-lg border border-slate-100">
              <QRCode
                value={qrModalPayload}
                size={400}
                style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                viewBox={`0 0 400 400`}
                level="M"
              />
            </div>
          ) : qrModalUrl ? (
            <div className="bg-white p-2 rounded-2xl shadow-lg border border-slate-100">
              <img
                src={qrModalUrl}
                alt={qrModalTitle || 'QR Image'}
                className="max-h-[70vh] object-contain rounded-xl"
              />
            </div>
          ) : (
            <div className="text-slate-600 py-12 flex flex-col items-center gap-4">
              <Ban className="h-12 w-12 text-slate-300" />
              <p className="font-medium text-lg">No image available</p>
            </div>
          )}

          {admins.length > 0 && (
            <div className="text-center space-y-2">
              <p className="text-2xl font-black text-slate-900">{admins[0].name}</p>
              {admins[0].gcash_number && (
                <p className="text-lg font-bold text-green-700 bg-green-50 px-4 py-1 rounded-full border border-green-200">{admins[0].gcash_number}</p>
              )}
            </div>
          )}
        </div>
      </Modal>
    </div >
  );
};

export default TuteePayment;