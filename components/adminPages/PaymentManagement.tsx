import React, { useEffect, useState } from 'react';
import apiClient, { getFileUrl } from '../../services/api';
import { Payment } from '../../types';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import Card from '../ui/Card';
import { Upload, Eye, DollarSign, Star, CheckCircle2 } from 'lucide-react';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

interface CompletedBooking {
    booking_id: number;
    tutor: {
        tutor_id: number;
        name: string;
        gcash_number: string | null;
        gcash_qr_url: string | null;
        session_rate_per_hour: number;
    };
    student: {
        user_id: number;
        name: string;
    };
    subject: string;
    date: string;
    time: string;
    duration: number;
    session_proof_url: string | null;
    tutee_rating: number | null;
    tutee_comment: string | null;
    amount: number;
    calculated_amount: number;
    payment_status?: string | null;
    payment_id?: number | null;
    payout_status?: string | null;
    release_proof_url?: string | null;
}

const PaymentManagement: React.FC = () => {
    const [payments, setPayments] = useState<Payment[]>([]);
    const [completedBookings, setCompletedBookings] = useState<CompletedBooking[]>([]);
    const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
    const [disputeStatus, setDisputeStatus] = useState<'none' | 'open' | 'under_review' | 'resolved' | 'rejected'>('none');
    const [adminNote, setAdminNote] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [verifyingId, setVerifyingId] = useState<number | null>(null);
    const [selectedPaymentForProof, setSelectedPaymentForProof] = useState<Payment | null>(null);
    const [adminProofFile, setAdminProofFile] = useState<File | null>(null);
    const [uploadingProof, setUploadingProof] = useState(false);
    const [showTutorQrModal, setShowTutorQrModal] = useState<Payment | null>(null);
    const [approveModalPayment, setApproveModalPayment] = useState<Payment | null>(null);
    const [approveProofFile, setApproveProofFile] = useState<File | null>(null);
    const [selectedProofModalPayment, setSelectedProofModalPayment] = useState<Payment | null>(null);
    const [rejectModalPayment, setRejectModalPayment] = useState<Payment | null>(null);
    const [rejectionReason, setRejectionReason] = useState('');
    const [viewProofBooking, setViewProofBooking] = useState<CompletedBooking | null>(null);
    const [viewReleaseProofBooking, setViewReleaseProofBooking] = useState<CompletedBooking | null>(null);
    const [payBooking, setPayBooking] = useState<CompletedBooking | null>(null);
    const [payBookingPayment, setPayBookingPayment] = useState<Payment | null>(null);
    const [processingPayment, setProcessingPayment] = useState(false);
    const [loadingPayment, setLoadingPayment] = useState(false);
    const [adminPaymentReceipt, setAdminPaymentReceipt] = useState<File | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const [paymentsRes, bookingsRes] = await Promise.all([
                    apiClient.get('/payments'),
                    apiClient.get('/payments/waiting-for-payment')
                ]);
                setPayments(paymentsRes.data);
                setCompletedBookings(bookingsRes.data || []);
            } catch (e) {
                setError('Failed to fetch data.');
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const handlePayButtonClick = async (booking: CompletedBooking) => {
        try {
            setLoadingPayment(true);
            setPayBooking(booking);

            // Fetch payment from payments table where booking_request_id matches
            const allPayments = await apiClient.get('/payments');
            const tuteePayment = allPayments.data.find((p: Payment) =>
                (p as any).booking_request_id === booking.booking_id
            );

            setPayBookingPayment(tuteePayment || null);
        } catch (e: any) {
            console.error('Failed to fetch payment:', e);
            toast.error('Failed to load payment information');
        } finally {
            setLoadingPayment(false);
        }
    };

    const handlePayButtonClickFromPayment = async (payment: Payment) => {
        try {
            setLoadingPayment(true);
            const bookingRequestId = (payment as any).booking_request_id;

            if (!bookingRequestId) {
                toast.error('Booking ID not found in payment');
                return;
            }

            // First, try to find the booking in completedBookings
            let booking = completedBookings.find(b => b.booking_id === bookingRequestId);

            // If not found, fetch from waiting-for-payment endpoint (which might have more bookings)
            if (!booking) {
                try {
                    const bookingsRes = await apiClient.get('/payments/waiting-for-payment');
                    const allBookings = bookingsRes.data || [];
                    booking = allBookings.find((b: CompletedBooking) => b.booking_id === bookingRequestId);
                } catch (e) {
                    console.error('Failed to fetch bookings:', e);
                }
            }

            // If still not found, try to construct from payment data or fetch booking directly
            if (!booking) {
                // Try to fetch booking from booking requests endpoint
                try {
                    // Fetch all bookings for the tutor
                    const tutorId = (payment as any).tutor?.tutor_id || (payment as any).tutor_id;
                    if (tutorId) {
                        const bookingsRes = await apiClient.get(`/tutors/${tutorId}/booking-requests`);
                        const allBookings = Array.isArray(bookingsRes.data) ? bookingsRes.data :
                            Array.isArray(bookingsRes.data?.data) ? bookingsRes.data.data : [];
                        const foundBooking = allBookings.find((b: any) => b.id === bookingRequestId || b.booking_id === bookingRequestId);

                        if (foundBooking) {
                            // Construct CompletedBooking from found booking
                            booking = {
                                booking_id: foundBooking.id || foundBooking.booking_id,
                                tutor: {
                                    tutor_id: foundBooking.tutor?.tutor_id || tutorId,
                                    name: foundBooking.tutor?.user?.name || payment.tutor?.user?.name || 'N/A',
                                    gcash_number: foundBooking.tutor?.gcash_number || (payment.tutor as any)?.gcash_number || null,
                                    gcash_qr_url: foundBooking.tutor?.gcash_qr_url || (payment.tutor as any)?.gcash_qr_url || null,
                                    session_rate_per_hour: foundBooking.tutor?.session_rate_per_hour || (payment.tutor as any)?.session_rate_per_hour || 0,
                                },
                                student: {
                                    user_id: foundBooking.student?.user_id || foundBooking.student?.user?.user_id || payment.student?.user?.user_id || 0,
                                    name: foundBooking.student?.user?.name || foundBooking.student?.name || payment.student?.user?.name || 'N/A',
                                },
                                subject: foundBooking.subject || (() => {
                                    const subject = (payment as any).subject;
                                    if (typeof subject === 'string') return subject;
                                    if (subject?.subject_name) return subject.subject_name;
                                    return 'N/A';
                                })(),
                                date: foundBooking.date || '',
                                time: foundBooking.time || '',
                                duration: foundBooking.duration || 0,
                                session_proof_url: foundBooking.session_proof_url || null,
                                tutee_rating: foundBooking.tutee_rating || null,
                                tutee_comment: foundBooking.tutee_comment || null,
                                amount: payment.amount,
                                calculated_amount: payment.amount * 0.87, // After 13% fee
                            };
                        }
                    }
                } catch (e) {
                    console.error('Failed to fetch booking from tutor endpoint:', e);
                }
            }

            if (!booking) {
                toast.error('Booking not found for this payment');
                return;
            }

            setPayBooking(booking);

            // Fetch payment from payments table where booking_request_id matches
            const allPayments = await apiClient.get('/payments');
            const tuteePayment = allPayments.data.find((p: Payment) =>
                (p as any).booking_request_id === bookingRequestId
            );

            setPayBookingPayment(tuteePayment || null);
        } catch (e: any) {
            console.error('Failed to fetch payment:', e);
            toast.error('Failed to load payment information');
        } finally {
            setLoadingPayment(false);
        }
    };

    const handleProcessPayment = async (bookingId: number) => {
        if (!adminPaymentReceipt) {
            toast.error('Please upload a payment receipt image');
            return;
        }

        try {
            setProcessingPayment(true);
            const formData = new FormData();
            formData.append('receipt', adminPaymentReceipt);

            await apiClient.post(`/payments/process-admin-payment/${bookingId}`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });
            toast.success('Payment processed successfully and payout created');
            setPayBooking(null);
            setPayBookingPayment(null);
            setAdminPaymentReceipt(null);
            // Refresh data
            const [paymentsRes, bookingsRes] = await Promise.all([
                apiClient.get('/payments'),
                apiClient.get('/payments/waiting-for-payment')
            ]);
            setPayments(paymentsRes.data);
            setCompletedBookings(bookingsRes.data || []);
        } catch (e: any) {
            toast.error(e?.response?.data?.message || 'Failed to process payment');
            console.error(e);
        } finally {
            setProcessingPayment(false);
        }
    };

    const handleAdminReceiptChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            alert('Please upload an image file');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            alert('File size should be less than 5MB');
            return;
        }
        setAdminPaymentReceipt(file);
    };

    const verify = async (paymentId: number, status: 'confirmed' | 'rejected', adminFile?: File | null, rejectionReasonText?: string) => {
        try {
            setVerifyingId(paymentId);
            const formData = new FormData();
            formData.append('status', status);

            // If approving and an admin proof file is provided, include it
            const adminProofToUse = adminFile ?? (status === 'confirmed' && approveModalPayment?.payment_id === paymentId ? approveProofFile : null);
            if (status === 'confirmed' && adminProofToUse) {
                formData.append('adminProof', adminProofToUse);
            }

            // If rejecting and a rejection reason is provided, include it
            if (status === 'rejected' && rejectionReasonText) {
                formData.append('rejection_reason', rejectionReasonText);
            }

            // Let the browser set the multipart Content-Type (including boundary).
            // Manually setting it can prevent the file from being sent correctly.
            await apiClient.patch(`/payments/${paymentId}/verify`, formData);

            // Show success message
            if (status === 'confirmed') {
                toast.success('Payment confirmed successfully');
            } else if (status === 'rejected') {
                toast.success('Payment rejected');
            }

            // Refresh payments data
            const response = await apiClient.get('/payments');
            setPayments(response.data);

            // Also refresh completed bookings
            try {
                const bookingsRes = await apiClient.get('/payments/waiting-for-payment');
                setCompletedBookings(bookingsRes.data || []);
            } catch (e) {
                // Ignore error, bookings refresh is optional
            }

            setApproveModalPayment(null);
            setApproveProofFile(null);
            setRejectModalPayment(null);
            setRejectionReason('');
            setSelectedProofModalPayment(null);
        } catch (err: any) {
            console.error('Failed to verify payment:', err);
            toast.error(err?.response?.data?.message || 'Failed to verify payment');
        } finally {
            setVerifyingId(null);
        }
    };

    const handleApproveProofChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            alert('Please upload an image file');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            alert('File size should be less than 5MB');
            return;
        }
        setApproveProofFile(file);
    };


    // Early returns must come AFTER all hooks
    if (loading) return <div>Loading payments...</div>;
    if (error) return <div className="text-red-500">{error}</div>;

    const statusColors: { [key: string]: string } = {
        confirmed: 'bg-green-100 text-green-800',
        pending: 'bg-yellow-100 text-yellow-800',
        paid: 'bg-blue-100 text-blue-800',
        rejected: 'bg-red-100 text-red-800',
        refunded: 'bg-blue-100 text-blue-800',
        admin_confirmed: 'bg-blue-100 text-blue-800',
        admin_paid: 'bg-emerald-100 text-emerald-800',
    };

    const pendingCount = payments.filter(p => p.status === 'pending').length;

    // Separate payments: tutee payments (have booking_request_id) with status 'pending', 'paid', or 'confirmed'
    const tuteePayments = payments.filter(p =>
        (p as any).booking_request_id != null && (p.status === 'pending' || p.status === 'paid' || p.status === 'confirmed')
    );

    return (
        <div>
            <ToastContainer aria-label="Notification messages" />
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">Payment Management</h1>
                {pendingCount > 0 && (
                    <div className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800">
                        {pendingCount} pending
                    </div>
                )}
                {completedBookings.length > 0 && (
                    <div className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                        {completedBookings.length} waiting for payment
                    </div>
                )}
            </div>


            {/* Completed Bookings Waiting for Payment */}
            {completedBookings.length > 0 && (
                <Card className="mb-6">
                    <h2 className="text-xl font-bold text-slate-800 mb-4">Completed Sessions Waiting for Payment</h2>
                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tutor</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                                    <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                    <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {completedBookings.map((booking) => (
                                    <tr key={booking.booking_id}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{booking.tutor.name}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{booking.student.name}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            {booking.payout_status === 'released' ? (
                                                <span className="px-3 py-1.5 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 whitespace-nowrap">
                                                    Released
                                                </span>
                                            ) : booking.payment_status === 'paid' ? (
                                                <span className="px-3 py-1.5 text-xs font-semibold rounded-full bg-green-100 text-green-800 whitespace-nowrap">
                                                    Paid
                                                </span>
                                            ) : (
                                                <span className="px-3 py-1.5 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800 whitespace-nowrap">
                                                    Pending Payment
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            <div className="inline-flex items-center justify-center gap-2">
                                                <Button
                                                    onClick={() => setViewProofBooking(booking)}
                                                    variant="secondary"
                                                    className="text-xs whitespace-nowrap"
                                                >
                                                    <Eye className="h-4 w-4 mr-1 inline" />
                                                    View Proof ({booking.subject})
                                                </Button>
                                                {booking.payout_status === 'released' && booking.release_proof_url && (
                                                    <Button
                                                        onClick={() => setViewReleaseProofBooking(booking)}
                                                        variant="secondary"
                                                        className="text-xs whitespace-nowrap"
                                                    >
                                                        <Eye className="h-4 w-4 mr-1 inline" />
                                                        View Release Proof
                                                    </Button>
                                                )}
                                                {booking.payout_status !== 'released' && booking.payment_status !== 'paid' && (
                                                    <Button
                                                        onClick={() => handlePayButtonClick(booking)}
                                                        className="text-xs whitespace-nowrap"
                                                        disabled={loadingPayment}
                                                    >
                                                        <DollarSign className="h-4 w-4 mr-1 inline" />
                                                        {loadingPayment ? 'Loading...' : 'Pay'}
                                                    </Button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Card View */}
                    <div className="md:hidden space-y-3">
                        {completedBookings.map((booking) => (
                            <Card key={booking.booking_id} className="p-4">
                                <div className="space-y-3">
                                    <div className="grid grid-cols-2 gap-3 text-sm">
                                        <div>
                                            <p className="text-slate-500 text-xs mb-1">Tutor</p>
                                            <p className="font-medium text-slate-900 truncate">{booking.tutor.name}</p>
                                        </div>
                                        <div>
                                            <p className="text-slate-500 text-xs mb-1">Student</p>
                                            <p className="font-medium text-slate-900 truncate">{booking.student.name}</p>
                                        </div>
                                    </div>
                                    <div className="text-sm">
                                        <p className="text-slate-500 text-xs mb-1">Status</p>
                                        <div className="flex items-center">
                                            {booking.payout_status === 'released' ? (
                                                <span className="px-3 py-1.5 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 whitespace-nowrap">
                                                    Released
                                                </span>
                                            ) : booking.payment_status === 'paid' ? (
                                                <span className="px-3 py-1.5 text-xs font-semibold rounded-full bg-green-100 text-green-800 whitespace-nowrap">
                                                    Paid
                                                </span>
                                            ) : (
                                                <span className="px-3 py-1.5 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800 whitespace-nowrap">
                                                    Pending Payment
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200">
                                        <Button
                                            onClick={() => {
                                                console.log('View Proof clicked. Booking data:', booking);
                                                console.log('Session proof URL:', booking.session_proof_url);
                                                setViewProofBooking(booking);
                                            }}
                                            variant="secondary"
                                            className="text-xs whitespace-nowrap w-full sm:w-auto"
                                        >
                                            <Eye className="h-4 w-4 mr-1 inline" />
                                            View Proof ({booking.subject})
                                        </Button>
                                        {booking.payout_status === 'released' && booking.release_proof_url && (
                                            <Button
                                                onClick={() => setViewReleaseProofBooking(booking)}
                                                variant="secondary"
                                                className="text-xs whitespace-nowrap w-full sm:w-auto"
                                            >
                                                <Eye className="h-4 w-4 mr-1 inline" />
                                                View Release Proof
                                            </Button>
                                        )}
                                        {booking.payout_status !== 'released' && booking.payment_status !== 'paid' && (
                                            <Button
                                                onClick={() => handlePayButtonClick(booking)}
                                                className="text-xs whitespace-nowrap w-full sm:w-auto"
                                                disabled={loadingPayment}
                                            >
                                                <DollarSign className="h-4 w-4 mr-1 inline" />
                                                {loadingPayment ? 'Loading...' : 'Pay'}
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                </Card>
            )}

            {/* Tutee Payments Table - Pending and Paid Payments */}
            <Card className="mb-6">
                <h2 className="text-xl font-bold text-slate-800 mb-4">Tutee Payments (Pending/Paid/Confirmed)</h2>
                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                {/* <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment ID</th> */}
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tutor</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                                <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {tuteePayments.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-8 text-center text-sm text-slate-500">
                                        No tutee payments found
                                    </td>
                                </tr>
                            ) : (
                                tuteePayments.map((payment) => (
                                    <tr key={payment.payment_id}>
                                        {/* <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">#{payment.payment_id}</td> */}
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{payment.student?.user?.name || 'N/A'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{payment.tutor?.user?.name || 'N/A'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">₱{Number(payment.amount).toFixed(2)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">{new Date(payment.created_at).toLocaleDateString()}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColors[payment.status]}`}>
                                                {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            <div className="inline-flex items-center justify-center gap-2">
                                                {(payment.status === 'pending' || payment.status === 'paid') && (
                                                    <Button
                                                        onClick={() => setSelectedProofModalPayment(payment)}
                                                        disabled={verifyingId === payment.payment_id}
                                                        className="whitespace-nowrap"
                                                    >
                                                        <Eye className="h-4 w-4 mr-1 inline" />
                                                        View Proof
                                                    </Button>
                                                )}
                                                {payment.status === 'confirmed' && (
                                                    <Button
                                                        variant="secondary"
                                                        onClick={() => setSelectedProofModalPayment(payment)}
                                                        className="whitespace-nowrap"
                                                    >
                                                        <Eye className="h-4 w-4 mr-1 inline" />
                                                        View Proof
                                                    </Button>
                                                )}
                                                {payment.status === 'rejected' && (
                                                    <Button variant="secondary" onClick={() => { setSelectedProofModalPayment(payment); }} className="whitespace-nowrap">
                                                        <Eye className="h-4 w-4 mr-1 inline" />
                                                        View Proof
                                                    </Button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden space-y-3">
                    {tuteePayments.length === 0 ? (
                        <div className="text-center py-8 text-sm text-slate-500">
                            No tutee payments found
                        </div>
                    ) : (
                        tuteePayments.map((payment) => (
                            <Card key={payment.payment_id} className="p-4">
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        {/* <div>
                                        <p className="text-xs text-slate-500">Payment ID</p>
                                        <p className="font-semibold text-slate-900">#{payment.payment_id}</p>
                                    </div> */}
                                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${statusColors[payment.status]}`}>
                                            {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3 text-sm">
                                        <div>
                                            <p className="text-slate-500 text-xs mb-1">Student</p>
                                            <p className="font-medium text-slate-900 truncate">{payment.student?.user?.name || 'N/A'}</p>
                                        </div>
                                        <div>
                                            <p className="text-slate-500 text-xs mb-1">Tutor</p>
                                            <p className="font-medium text-slate-900 truncate">{payment.tutor?.user?.name || 'N/A'}</p>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3 text-sm">
                                        <div>
                                            <p className="text-slate-500 text-xs mb-1">Amount</p>
                                            <p className="font-medium text-slate-900">₱{Number(payment.amount).toFixed(2)}</p>
                                        </div>
                                        <div>
                                            <p className="text-slate-500 text-xs mb-1">Date</p>
                                            <p className="font-medium text-slate-900">{new Date(payment.created_at).toLocaleDateString()}</p>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200">
                                        {(payment.status === 'pending' || payment.status === 'paid') && (
                                            <Button
                                                onClick={() => setSelectedProofModalPayment(payment)}
                                                disabled={verifyingId === payment.payment_id}
                                                className="text-xs whitespace-nowrap w-full sm:w-auto"
                                            >
                                                <Eye className="h-4 w-4 mr-1 inline" />
                                                View Proof
                                            </Button>
                                        )}
                                        {payment.status === 'confirmed' && (
                                            <Button
                                                variant="secondary"
                                                onClick={() => setSelectedProofModalPayment(payment)}
                                                className="text-xs whitespace-nowrap w-full sm:w-auto"
                                            >
                                                <Eye className="h-4 w-4 mr-1 inline" />
                                                View Proof
                                            </Button>
                                        )}
                                        {payment.status === 'rejected' && (
                                            <Button
                                                variant="secondary"
                                                onClick={() => { setSelectedProofModalPayment(payment); }}
                                                className="text-xs whitespace-nowrap w-full sm:w-auto"
                                            >
                                                <Eye className="h-4 w-4 mr-1 inline" />
                                                View Proof
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </Card>
                        ))
                    )}
                </div>
            </Card>


            {selectedPayment && (
                <Modal isOpen={true} onClose={() => setSelectedPayment(null)} title={`Payment #${selectedPayment.payment_id} Dispute`}
                    footer={
                        <>
                            <Button variant="secondary" onClick={() => setSelectedPayment(null)}>Close</Button>
                            <Button onClick={async () => { await apiClient.patch(`/payments/${selectedPayment.payment_id}/dispute`, { dispute_status: disputeStatus, admin_note: adminNote }); setSelectedPayment(null); const res = await apiClient.get('/payments'); setPayments(res.data); }}>Save</Button>
                        </>
                    }
                >
                    <div className="space-y-4">
                        <div className="text-sm text-slate-700">
                            <p><strong>Student:</strong> {selectedPayment.student?.user?.name || 'N/A'}</p>
                            <p><strong>Tutor:</strong> {selectedPayment.tutor?.user?.name || 'N/A'}</p>
                            {selectedPayment.dispute_proof_url && (
                                <p className="mt-2">
                                    <strong>Proof:</strong> <a className="text-primary-600 hover:underline" href={selectedPayment.dispute_proof_url} target="_blank" rel="noreferrer">View attachment</a>
                                </p>
                            )}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Dispute Status</label>
                            <select className="mt-1 block w-full border border-slate-300 rounded-md px-3 py-2" value={disputeStatus} onChange={(e) => setDisputeStatus(e.target.value as any)}>
                                <option value="none">None</option>
                                <option value="open">Open</option>
                                <option value="under_review">Under Review</option>
                                <option value="resolved">Resolved</option>
                                <option value="rejected">Rejected</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Admin Note</label>
                            <textarea className="mt-1 block w-full border border-slate-300 rounded-md px-3 py-2" rows={4} value={adminNote} onChange={(e) => setAdminNote(e.target.value)} />
                        </div>
                    </div>
                </Modal>
            )}

            {approveModalPayment && (
                <Modal
                    isOpen={true}
                    onClose={() => { setApproveModalPayment(null); setApproveProofFile(null); }}
                    title={`Approve Payment #${approveModalPayment.payment_id}`}
                    footer={
                        <div className="flex items-center gap-2">
                            <Button variant="secondary" onClick={() => { setApproveModalPayment(null); setApproveProofFile(null); }}>Cancel</Button>
                            <Button
                                onClick={() => verify(approveModalPayment.payment_id, 'confirmed')}
                                disabled={verifyingId === approveModalPayment.payment_id || !approveProofFile}
                            >
                                Confirm Approve
                            </Button>
                        </div>
                    }
                >
                    <div className="space-y-4">
                        <p className="text-sm text-slate-600">
                            Review the tutor's QR, then upload an admin proof screenshot to finalize approval.
                        </p>
                        {(approveModalPayment.tutor as any)?.gcash_qr_url ? (
                            <div className="flex justify-center">
                                <img
                                    src={getFileUrl((approveModalPayment.tutor as any).gcash_qr_url)}
                                    alt="Tutor GCash QR"
                                    className="max-w-full h-auto border border-slate-200 rounded-lg"
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).src = 'https://via.placeholder.com/300?text=QR+Not+Available';
                                    }}
                                />
                            </div>
                        ) : (
                            <p className="text-sm text-slate-500 text-center py-4">Tutor has not uploaded a GCash QR code yet.</p>
                        )}
                        {(approveModalPayment.tutor as any)?.gcash_number && (
                            <p className="text-sm text-slate-600 text-center">
                                <strong>GCash Number:</strong> {(approveModalPayment.tutor as any).gcash_number}
                            </p>
                        )}
                        <div className="pt-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1">Upload Admin Proof</label>
                            <input type="file" accept="image/*" onChange={handleApproveProofChange} />
                            {approveProofFile && (
                                <div className="text-xs text-green-700 mt-1">Selected: {approveProofFile.name}</div>
                            )}
                            {!approveProofFile && (
                                <div className="text-xs text-red-600 mt-1">Proof is required to confirm approval.</div>
                            )}
                        </div>
                    </div>
                </Modal>
            )}

            {/* Reject Payment Modal */}
            {rejectModalPayment && (
                <Modal
                    isOpen={true}
                    onClose={() => { setRejectModalPayment(null); setRejectionReason(''); }}
                    title={`Reject Payment #${rejectModalPayment.payment_id}`}
                    footer={
                        <div className="flex items-center gap-2">
                            <Button variant="secondary" onClick={() => { setRejectModalPayment(null); setRejectionReason(''); }}>Cancel</Button>
                            <Button
                                variant="danger"
                                onClick={() => {
                                    if (!rejectionReason.trim()) {
                                        alert('Please provide a rejection reason');
                                        return;
                                    }
                                    verify(rejectModalPayment.payment_id, 'rejected', null, rejectionReason.trim());
                                }}
                                disabled={verifyingId === rejectModalPayment.payment_id || !rejectionReason.trim()}
                            >
                                Confirm Reject
                            </Button>
                        </div>
                    }
                >
                    <div className="space-y-4">
                        <div className="text-sm text-slate-700">
                            <p><strong>Student:</strong> {rejectModalPayment.student?.user?.name || 'N/A'}</p>
                            <p><strong>Tutor:</strong> {rejectModalPayment.tutor?.user?.name || 'N/A'}</p>
                            <p><strong>Amount:</strong> ₱{Number(rejectModalPayment.amount).toFixed(2)}</p>
                            <p><strong>Subject:</strong> {(() => {
                                const subject = (rejectModalPayment as any).subject;
                                if (typeof subject === 'string') return subject;
                                if (subject?.subject_name) return subject.subject_name;
                                return (rejectModalPayment as any).bookingRequest?.subject || 'N/A';
                            })()}</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Rejection Reason <span className="text-red-500">*</span>
                            </label>
                            <textarea
                                className="w-full border border-slate-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-red-500 focus:border-red-500"
                                rows={4}
                                value={rejectionReason}
                                onChange={(e) => setRejectionReason(e.target.value)}
                                placeholder="Please provide a reason for rejecting this payment (e.g., Payment proof is unclear, Amount mismatch, etc.)"
                            />
                            <p className="text-xs text-slate-500 mt-1">
                                This reason will be shown to the student to help them understand why their payment was rejected.
                            </p>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Student proof modal: lets admin view the tutee-uploaded proof and Approve/Reject from the same modal */}
            {selectedProofModalPayment && (
                <Modal
                    isOpen={true}
                    onClose={() => { setSelectedProofModalPayment(null); }}
                    title={`Payment Proof #${selectedProofModalPayment.payment_id}`}
                    maxWidth="6xl"
                    footer={
                        (selectedProofModalPayment.status === 'pending' || selectedProofModalPayment.status === 'paid') ? (
                            <div className="flex items-center justify-end gap-2 w-full">
                                <Button variant="secondary" onClick={() => setSelectedProofModalPayment(null)}>Cancel</Button>
                                <Button
                                    onClick={async () => {
                                        await verify(selectedProofModalPayment.payment_id, 'confirmed');
                                        setSelectedProofModalPayment(null);
                                    }}
                                    disabled={verifyingId === selectedProofModalPayment.payment_id}
                                >
                                    Confirm
                                </Button>
                                <Button
                                    variant="danger"
                                    onClick={() => {
                                        setRejectModalPayment(selectedProofModalPayment);
                                        setSelectedProofModalPayment(null);
                                    }}
                                >
                                    Reject
                                </Button>
                            </div>
                        ) : (
                            <div className="flex items-center justify-end gap-2 w-full">
                                <Button variant="secondary" onClick={() => setSelectedProofModalPayment(null)}>Close</Button>
                            </div>
                        )
                    }
                >
                    <div className="bg-gradient-to-br from-primary-50 via-white to-primary-50/50 rounded-xl border-2 border-primary-200 p-4 sm:p-5 md:p-6 shadow-lg space-y-6">
                        {/* Payment Details - Enhanced Card Layout */}
                        <div>
                            <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-5">
                                <div className="p-2 sm:p-2.5 bg-primary-100 rounded-lg">
                                    <svg className="h-5 w-5 sm:h-6 sm:w-6 text-primary-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                </div>
                                <h3 className="text-lg sm:text-xl md:text-2xl font-extrabold text-slate-900">Payment Details</h3>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                <div className="flex items-start gap-3 p-3 bg-white rounded-lg border border-primary-200 shadow-sm">
                                    <div className="p-1.5 bg-primary-100 rounded-lg flex-shrink-0">
                                        <svg className="h-4 w-4 sm:h-5 sm:w-5 text-primary-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                        </svg>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm sm:text-base text-slate-500 font-bold mb-1 uppercase tracking-wide">Student</p>
                                        <p className="text-base sm:text-lg font-extrabold text-slate-900 break-words">{selectedProofModalPayment.student?.user?.name || 'N/A'}</p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3 p-3 bg-white rounded-lg border border-primary-200 shadow-sm">
                                    <div className="p-1.5 bg-primary-100 rounded-lg flex-shrink-0">
                                        <svg className="h-4 w-4 sm:h-5 sm:w-5 text-primary-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                        </svg>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm sm:text-base text-slate-500 font-bold mb-1 uppercase tracking-wide">Tutor</p>
                                        <p className="text-base sm:text-lg font-extrabold text-slate-900 break-words">{selectedProofModalPayment.tutor?.user?.name || 'N/A'}</p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3 p-3 bg-white rounded-lg border border-primary-200 shadow-sm">
                                    <div className="p-1.5 bg-indigo-100 rounded-lg flex-shrink-0">
                                        <svg className="h-4 w-4 sm:h-5 sm:w-5 text-indigo-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                        </svg>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm sm:text-base text-slate-500 font-bold mb-1 uppercase tracking-wide">Subject</p>
                                        <p className="text-base sm:text-lg font-extrabold text-slate-900 break-words">
                                            {(() => {
                                                const subject = (selectedProofModalPayment as any).subject;
                                                if (typeof subject === 'string') return subject;
                                                if (subject?.subject_name) return subject.subject_name;
                                                return (selectedProofModalPayment as any).bookingRequest?.subject || 'N/A';
                                            })()}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3 p-3 bg-white rounded-lg border border-primary-200 shadow-sm">
                                    <div className="p-1.5 bg-primary-100 rounded-lg flex-shrink-0">
                                        <svg className="h-4 w-4 sm:h-5 sm:w-5 text-primary-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm sm:text-base text-slate-500 font-bold mb-1 uppercase tracking-wide">Duration</p>
                                        <p className="text-base sm:text-lg font-extrabold text-slate-900">
                                            {(selectedProofModalPayment as any).bookingRequest?.duration
                                                ? `${(selectedProofModalPayment as any).bookingRequest.duration} ${(selectedProofModalPayment as any).bookingRequest.duration === 1 ? 'hour' : 'hours'}`
                                                : 'N/A'}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3 p-3 bg-gradient-to-br from-primary-100 to-primary-200 rounded-lg border-2 border-primary-300 shadow-md sm:col-span-2">
                                    <div className="p-1.5 bg-primary-600 rounded-lg flex-shrink-0">
                                        <svg className="h-4 w-4 sm:h-5 sm:w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm sm:text-base text-primary-800 font-bold mb-1 uppercase tracking-wide">Amount</p>
                                        <p className="text-xl sm:text-2xl md:text-3xl font-black text-primary-900">
                                            ₱{Number(selectedProofModalPayment.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3 p-3 bg-white rounded-lg border border-primary-200 shadow-sm sm:col-span-2">
                                    <div className="p-1.5 bg-slate-100 rounded-lg flex-shrink-0">
                                        <svg className="h-4 w-4 sm:h-5 sm:w-5 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </div>
                                    <div className="min-w-0 flex-1 flex items-center gap-3">
                                        <div>
                                            <p className="text-sm sm:text-base text-slate-500 font-bold mb-1 uppercase tracking-wide">Status</p>
                                            <span className={`inline-flex items-center px-3 sm:px-4 py-1.5 sm:py-2 text-sm sm:text-base font-extrabold rounded-lg border-2 ${statusColors[selectedProofModalPayment.status]} ${selectedProofModalPayment.status === 'confirmed' ? 'border-green-400' :
                                                    selectedProofModalPayment.status === 'pending' ? 'border-yellow-400' :
                                                        selectedProofModalPayment.status === 'rejected' ? 'border-red-400' :
                                                            'border-blue-400'
                                                }`}>
                                                {selectedProofModalPayment.status.charAt(0).toUpperCase() + selectedProofModalPayment.status.slice(1)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Payment Proof Image - Enhanced Display */}
                        <div>
                            <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                                <div className="p-2 sm:p-2.5 bg-primary-100 rounded-lg">
                                    <svg className="h-5 w-5 sm:h-6 sm:w-6 text-primary-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                </div>
                                <h3 className="text-lg sm:text-xl md:text-2xl font-extrabold text-slate-900">
                                    {selectedProofModalPayment.status === 'confirmed' && (selectedProofModalPayment as any).admin_payment_proof_url
                                        ? 'Admin Payment Proof'
                                        : 'Payment Proof'}
                                </h3>
                            </div>
                            <div className="flex justify-center bg-white rounded-lg border-2 border-primary-200 p-3 sm:p-4 md:p-5 shadow-inner">
                                <img
                                    src={getFileUrl(
                                        selectedProofModalPayment.status === 'confirmed' && (selectedProofModalPayment as any).admin_payment_proof_url
                                            ? (selectedProofModalPayment as any).admin_payment_proof_url
                                            : (selectedProofModalPayment as any).dispute_proof_url || (selectedProofModalPayment as any).payment_proof_url
                                    )}
                                    alt="Payment proof"
                                    className="max-h-[60vh] w-auto object-contain rounded-lg shadow-md"
                                    onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400?text=No+Image'; }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Rejection Reason - Enhanced Display (Full Width Below) */}
                    {selectedProofModalPayment.status === 'rejected' && (selectedProofModalPayment as any).rejection_reason && (
                        <div className="mt-4 sm:mt-5 md:mt-6 bg-gradient-to-br from-red-50 via-rose-50 to-red-50 rounded-xl border-2 border-red-300 p-4 sm:p-5 md:p-6 shadow-lg">
                            <div className="flex items-start gap-3 sm:gap-4">
                                <div className="p-2 sm:p-2.5 bg-red-100 rounded-lg flex-shrink-0">
                                    <svg className="h-5 w-5 sm:h-6 sm:w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="text-sm sm:text-base md:text-lg font-extrabold text-red-900 mb-2 uppercase tracking-wide">Rejection Reason</h4>
                                    <p className="text-sm sm:text-base text-red-800 leading-relaxed whitespace-pre-wrap break-words font-medium">
                                        {(selectedProofModalPayment as any).rejection_reason}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </Modal>
            )}

            {/* View Release Proof Modal for Released Payouts */}
            {viewReleaseProofBooking && (
                <Modal
                    isOpen={true}
                    onClose={() => setViewReleaseProofBooking(null)}
                    title={`Release Proof - ${viewReleaseProofBooking.subject}`}
                    maxWidth="4xl"
                    footer={
                        <Button variant="secondary" onClick={() => setViewReleaseProofBooking(null)}>
                            Close
                        </Button>
                    }
                >
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <p className="text-slate-500 font-medium mb-1">Tutor</p>
                                <p className="font-semibold text-slate-900">{viewReleaseProofBooking.tutor.name}</p>
                            </div>
                            <div>
                                <p className="text-slate-500 font-medium mb-1">Student</p>
                                <p className="font-semibold text-slate-900">{viewReleaseProofBooking.student.name}</p>
                            </div>
                            <div>
                                <p className="text-slate-500 font-medium mb-1">Date</p>
                                <p className="font-semibold text-slate-900">{new Date(viewReleaseProofBooking.date).toLocaleDateString()}</p>
                            </div>
                            <div>
                                <p className="text-slate-500 font-medium mb-1">Amount Released</p>
                                <p className="font-semibold text-slate-900">₱{viewReleaseProofBooking.calculated_amount.toFixed(2)}</p>
                            </div>
                        </div>

                        {/* Release Proof Image */}
                        {viewReleaseProofBooking.release_proof_url && (
                            <div>
                                <h3 className="text-lg font-semibold text-slate-800 mb-2">Admin Payment Receipt (Release Proof)</h3>
                                <div className="flex justify-center bg-white rounded-lg border-2 border-slate-200 p-4">
                                    <img
                                        src={getFileUrl(viewReleaseProofBooking.release_proof_url)}
                                        alt="Release proof"
                                        className="max-h-[400px] w-auto object-contain rounded-lg shadow-md"
                                        onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400?text=No+Image'; }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </Modal>
            )}

            {/* View Proof Modal for Completed Bookings */}
            {viewProofBooking && (
                <Modal
                    isOpen={true}
                    onClose={() => setViewProofBooking(null)}
                    title={`Session Proof - ${viewProofBooking.subject}`}
                    maxWidth="4xl"
                    footer={
                        <Button variant="secondary" onClick={() => setViewProofBooking(null)}>
                            Close
                        </Button>
                    }
                >
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <p className="text-slate-500 font-medium mb-1">Tutor</p>
                                <p className="font-semibold text-slate-900">{viewProofBooking.tutor.name}</p>
                            </div>
                            <div>
                                <p className="text-slate-500 font-medium mb-1">Student</p>
                                <p className="font-semibold text-slate-900">{viewProofBooking.student.name}</p>
                            </div>
                            <div>
                                <p className="text-slate-500 font-medium mb-1">Date</p>
                                <p className="font-semibold text-slate-900">{new Date(viewProofBooking.date).toLocaleDateString()}</p>
                            </div>
                            <div>
                                <p className="text-slate-500 font-medium mb-1">Duration</p>
                                <p className="font-semibold text-slate-900">{viewProofBooking.duration} {viewProofBooking.duration === 1 ? 'hour' : 'hours'}</p>
                            </div>
                        </div>

                        {/* Session Proof Image */}
                        {viewProofBooking.session_proof_url && (
                            <div>
                                <h3 className="text-lg font-semibold text-slate-800 mb-2">Tutor's Session Proof</h3>
                                <div className="flex justify-center bg-white rounded-lg border-2 border-slate-200 p-4">
                                    <img
                                        src={getFileUrl(viewProofBooking.session_proof_url)}
                                        alt="Session proof"
                                        className="max-h-[400px] w-auto object-contain rounded-lg shadow-md"
                                        onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400?text=No+Image'; }}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Tutee Rating and Comment */}
                        {(viewProofBooking.tutee_rating || viewProofBooking.tutee_comment) && (
                            <div className="bg-gradient-to-br from-primary-50 to-primary-100 rounded-lg border-2 border-primary-200 p-4">
                                <h3 className="text-lg font-semibold text-slate-800 mb-3 flex items-center gap-2">
                                    <Star className="h-5 w-5 text-yellow-500 fill-current" />
                                    Student Feedback
                                </h3>
                                {viewProofBooking.tutee_rating && (
                                    <div className="mb-3">
                                        <p className="text-slate-600 font-medium mb-1">Rating</p>
                                        <div className="flex items-center gap-1">
                                            {Array.from({ length: 5 }, (_, i) => (
                                                <Star
                                                    key={i}
                                                    className={`h-5 w-5 ${i < Math.floor(viewProofBooking.tutee_rating!)
                                                            ? 'text-yellow-400 fill-current'
                                                            : 'text-slate-300'
                                                        }`}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {viewProofBooking.tutee_comment && (
                                    <div>
                                        <p className="text-slate-600 font-medium mb-1">Comment</p>
                                        <p className="text-slate-800 bg-white rounded-lg p-3 border border-primary-200">
                                            {viewProofBooking.tutee_comment}
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </Modal>
            )}

            {/* Pay Modal for Completed Bookings */}
            {payBooking && (
                <Modal
                    isOpen={true}
                    onClose={() => {
                        setPayBooking(null);
                        setPayBookingPayment(null);
                        setAdminPaymentReceipt(null);
                    }}
                    title={`Pay Tutor - ${payBooking.subject}`}
                    maxWidth="2xl"
                    footer={
                        <div className="flex items-center gap-2">
                            <Button variant="secondary" onClick={() => {
                                setPayBooking(null);
                                setPayBookingPayment(null);
                                setAdminPaymentReceipt(null);
                            }}>
                                Cancel
                            </Button>
                            <Button
                                onClick={() => handleProcessPayment(payBooking.booking_id)}
                                disabled={processingPayment || !payBookingPayment || !adminPaymentReceipt}
                            >
                                {processingPayment ? 'Processing Payment...' : 'Pay Tutor'}
                            </Button>
                        </div>
                    }
                >
                    <div className="space-y-4">
                        {loadingPayment ? (
                            <div className="text-center py-8">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
                                <p className="text-slate-600">Loading payment information...</p>
                            </div>
                        ) : payBookingPayment ? (
                            <>
                                <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 mb-4">
                                    <div className="flex items-start gap-3">
                                        <div className="p-2 bg-blue-100 rounded-lg flex-shrink-0">
                                            <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-blue-900 mb-1">Payment Information</h4>
                                            <p className="text-sm text-blue-800">
                                                The tutee has already paid the full amount. You need to pay the tutor the net amount (after 13% platform fee deduction).
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                                    <div>
                                        <p className="text-slate-500 font-medium mb-1">Tutor</p>
                                        <p className="font-semibold text-slate-900">{payBooking.tutor.name}</p>
                                    </div>
                                    <div>
                                        <p className="text-slate-500 font-medium mb-1">Student</p>
                                        <p className="font-semibold text-slate-900">{payBooking.student.name}</p>
                                    </div>
                                </div>

                                {/* Tutor GCash QR Code */}
                                {payBooking.tutor.gcash_qr_url && (
                                    <div>
                                        <h3 className="text-lg font-semibold text-slate-800 mb-2">Tutor's GCash QR Code</h3>
                                        <div className="flex justify-center bg-white rounded-lg border-2 border-slate-200 p-4">
                                            <img
                                                src={getFileUrl(payBooking.tutor.gcash_qr_url)}
                                                alt="GCash QR Code"
                                                className="max-h-[300px] w-auto object-contain rounded-lg shadow-md"
                                                onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/300?text=QR+Not+Available'; }}
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* GCash Number */}
                                {payBooking.tutor.gcash_number && (
                                    <div className="bg-primary-50 rounded-lg border-2 border-primary-200 p-4">
                                        <p className="text-slate-600 font-medium mb-1">GCash Number</p>
                                        <p className="text-2xl font-bold text-primary-900">{payBooking.tutor.gcash_number}</p>
                                    </div>
                                )}

                                {/* Payment Flow: Tutee → Admin → Tutor */}
                                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border-2 border-blue-200 p-4 mb-4">
                                    <h3 className="text-lg font-semibold text-slate-800 mb-3 flex items-center gap-2">
                                        <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                        </svg>
                                        Payment Flow
                                    </h3>
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-blue-200">
                                            <div className="flex items-center gap-2">
                                                <div className="p-1.5 bg-green-100 rounded-lg">
                                                    <svg className="h-4 w-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                </div>
                                                <span className="text-slate-700 font-medium">Tutee Paid to Admin:</span>
                                            </div>
                                            <span className="font-bold text-green-700">₱{Number(payBookingPayment.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                        </div>
                                        <div className="flex items-center justify-center text-blue-600">
                                            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                                            </svg>
                                        </div>
                                        <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-blue-200">
                                            <div className="flex items-center gap-2">
                                                <div className="p-1.5 bg-red-100 rounded-lg">
                                                    <svg className="h-4 w-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                </div>
                                                <span className="text-slate-700 font-medium">Platform Fee (13%):</span>
                                            </div>
                                            <span className="font-bold text-red-600">-₱{(Number(payBookingPayment.amount) * 0.13).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                        </div>
                                        <div className="flex items-center justify-center text-blue-600">
                                            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                                            </svg>
                                        </div>
                                        <div className="flex items-center justify-between p-4 bg-gradient-to-r from-green-100 to-emerald-100 rounded-lg border-2 border-green-400">
                                            <div className="flex items-center gap-2">
                                                <div className="p-2 bg-green-600 rounded-lg">
                                                    <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                </div>
                                                <span className="text-lg font-bold text-slate-900">Admin Pays to Tutor:</span>
                                            </div>
                                            <span className="text-2xl font-black text-green-700">₱{(Number(payBookingPayment.amount) * 0.87).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Admin Payment Receipt Upload */}
                                <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-lg border-2 border-amber-200 p-4 mb-4">
                                    <h3 className="text-lg font-semibold text-slate-800 mb-3 flex items-center gap-2">
                                        <Upload className="h-5 w-5 text-amber-600" />
                                        Upload Payment Receipt
                                    </h3>
                                    <div className="space-y-3">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                                Payment Receipt (Proof of Payment to Tutor) <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={handleAdminReceiptChange}
                                                className="w-full text-sm file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-amber-50 file:text-amber-700 hover:file:bg-amber-100 transition-colors"
                                            />
                                            {adminPaymentReceipt && (
                                                <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                                                    <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                                                    <span className="text-sm text-green-700 truncate flex-1">{adminPaymentReceipt.name}</span>
                                                    <button
                                                        onClick={() => setAdminPaymentReceipt(null)}
                                                        className="text-red-600 hover:text-red-700 text-sm font-medium flex-shrink-0"
                                                        aria-label="Remove file"
                                                    >
                                                        Remove
                                                    </button>
                                                </div>
                                            )}
                                            {!adminPaymentReceipt && (
                                                <p className="text-xs text-amber-600 mt-1">
                                                    Please upload a screenshot of your payment receipt to the tutor (max 5MB, JPG/PNG).
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="text-center py-8">
                                <p className="text-red-600 font-semibold mb-2">Payment Not Found</p>
                                <p className="text-slate-600 text-sm">No payment found for this booking.</p>
                            </div>
                        )}
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default PaymentManagement;
