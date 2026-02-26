import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  GraduationCap,
  Search,
  CreditCard,
  Star,
  User,
  Edit2,
  Bell,
  Info
} from 'lucide-react';
import { logoBase64 } from '../../assets/logo';
import { useAuth } from '../../hooks/useAuth';
import { User as UserType } from '../../types';
import { useNotifications } from '../../context/NotificationContext';
import NotificationBadge from '../ui/NotificationBadge';
import apiClient, { getFileUrl } from '../../services/api';
import { useToast } from '../ui/Toast';
import { updateRoleUser } from '../../utils/authRole';

const tuteeNavLinks = [
  {
    to: '/tutee-dashboard/become-tutor',
    icon: GraduationCap,
    label: 'Become a Tutor',
    description: 'Apply to become a tutor by selecting subjects and uploading supporting documents like transcripts.',
  },
  {
    to: '/tutee-dashboard/find-tutors',
    icon: Search,
    label: 'Find & Book Tutors',
    description: 'Browse tutors filtered by your course subjects, view their profiles, ratings, and availability to book a session.',
  },
  {
    to: '/tutee-dashboard/my-bookings',
    icon: Bell,
    label: 'My Bookings',
    description: 'View and manage your tutoring session bookings.',
  },
  {
    to: '/tutee-dashboard/upcoming-sessions',
    icon: User, // reuse simple icon; consider replacing with Calendar where available
    label: 'Upcoming Sessions',
    description: 'See your scheduled sessions in the next 30 days.',
    showUpcoming: true,
  },
  {
    to: '/tutee-dashboard/messages',
    icon: User, // TODO: Import MessageSquare if available or use generic
    label: 'Messages',
    description: 'Chat with your tutors in real-time.',
  },
  {
    to: '/tutee-dashboard/payment',
    icon: CreditCard,
    label: 'Payment',
    description: 'View tutor payment information, upload proof of payment via GCash, and wait for tutor approval.',
    showNotification: true, // This will be used to conditionally show the notification dot
  },
  {
    to: '/tutee-dashboard/after-session',
    icon: Star,
    label: 'After Session',
    description: 'Leave feedback and rating for completed sessions to help future students make informed decisions.',
  },
];

const TuteeSidebar: React.FC = () => {
  const { user } = useAuth();
  const { notify } = useToast();
  const { notifications } = useNotifications();
  const location = useLocation();
  const [hasPendingPayments, setHasPendingPayments] = useState(false);
  const [upcomingCount, setUpcomingCount] = useState<number>(0);
  const [pendingBookingsCount, setPendingBookingsCount] = useState<number>(0);
  const [hasCompletedSessionsForFeedback, setHasCompletedSessionsForFeedback] = useState<boolean>(false);
  const [hasBecomeTutorUpdate, setHasBecomeTutorUpdate] = useState<boolean>(false);
  const [viewedPages, setViewedPages] = useState<Set<string>>(new Set());

  //OLD CODE HERE, BUG IS THE RED DOT IS STILL VISIBLE EVEN
  //AFTER THE PAYMENT IS CONFIRMED, THE RED DOT SHOULD BE HIDDEN
  // useEffect(() => {
  //   const checkPendingPayments = async () => {
  //     try {
  //       // Fetch both bookings and payments to check payment status
  //       const [bookingsResponse, paymentsResponse] = await Promise.all([
  //         apiClient.get('/users/me/bookings'),
  //         apiClient.get('/payments').catch(() => ({ data: [] })) // Don't fail if payments endpoint fails
  //       ]);

  //       // If the server returned an unexpected shape, clear pending flag
  //       if (!Array.isArray(bookingsResponse.data)) {
  //         console.warn('checkPendingPayments: unexpected bookings response, clearing pending flag', bookingsResponse.data);
  //         setHasPendingPayments(false);
  //         return;
  //       }

  //       const allBookings = bookingsResponse.data || [];
  //       const allPayments = paymentsResponse.data || [];

  //       // Filter payments for current user (student)
  //       const userPayments = allPayments.filter((p: any) => {
  //         if (user?.user_id) {
  //           return (p as any).student?.user?.user_id === user.user_id ||
  //                  (p as any).student_id === (user as any).student_id;
  //         }
  //         return false;
  //       });

  //       // Check for bookings that need payment (awaiting payment, payment pending, payment rejected)
  //       const relevantBookings = allBookings.filter((booking: any) => {
  //         const status = (booking?.status || '').toString().toLowerCase().trim();
  //         return (
  //           status === 'awaiting_payment' ||
  //           status === 'payment_pending' ||
  //           status === 'payment_rejected'
  //         );
  //       });

  //       // Check if any relevant booking has a payment that needs attention
  //       // Hide dot if payment status is 'admin_confirmed' or 'confirmed'
  //       let shouldShowDot = false;

  //       // Check each relevant booking - need to check ALL bookings before deciding
  //       for (const booking of relevantBookings) {
  //         // Find matching payment for this booking
  //         const matchingPayment = userPayments.find((p: any) => {
  //           return p.tutor_id === booking.tutor?.tutor_id &&
  //                  (p.subject === booking.subject || !p.subject);
  //         });

  //         if (matchingPayment) {
  //           // Payment exists - check its status
  //           const paymentStatus = (matchingPayment.status || '').toLowerCase().trim();

  //           // Debug logging (can be removed in production)
  //           console.log('[TuteeSidebar] Booking:', booking.id, 'Payment status:', paymentStatus, 'Payment ID:', matchingPayment.payment_id);

  //           // ❌ Hide dot for these statuses - payment is confirmed, no action needed
  //           if (paymentStatus === 'admin_confirmed' || paymentStatus === 'confirmed') {
  //             // This booking is confirmed, continue checking other bookings
  //             continue;
  //           }

  //           // ✅ Show dot for pending / rejected - payment needs attention
  //           if (paymentStatus === 'pending' || paymentStatus === 'rejected') {
  //             console.log('[TuteeSidebar] Found pending/rejected payment, showing dot');
  //             shouldShowDot = true;
  //             break; // Found one that needs attention, show dot immediately
  //           }

  //           // Unknown status - treat as needing attention to be safe
  //           console.log('[TuteeSidebar] Unknown payment status:', paymentStatus, 'showing dot to be safe');
  //           shouldShowDot = true;
  //           break;
  //         } else {
  //           // No payment entity exists yet - booking still needs payment
  //           console.log('[TuteeSidebar] No payment found for booking:', booking.id, 'showing dot');
  //           shouldShowDot = true;
  //           break; // Found one that needs attention, show dot immediately
  //         }
  //       }

  //       // Debug: log final decision
  //       if (relevantBookings.length > 0) {
  //         console.log('[TuteeSidebar] Relevant bookings:', relevantBookings.length, 'Should show dot:', shouldShowDot);
  //       }

  //       // Also check standalone payments (not necessarily linked to bookings yet)
  //       // Only show dot if they are pending or rejected, NOT if admin_confirmed or confirmed
  //       if (!shouldShowDot) {
  //         const standalonePendingPayments = userPayments.filter((p: any) => {
  //           const paymentStatus = (p.status || '').toLowerCase();
  //           // Only show dot for pending or rejected, NOT for admin_confirmed or confirmed
  //           return paymentStatus === 'pending' || paymentStatus === 'rejected';
  //         });

  //         if (standalonePendingPayments.length > 0) {
  //           shouldShowDot = true;
  //         }
  //       }

  //       setHasPendingPayments(shouldShowDot);
  //     } catch (error) {
  //       // On error we should not leave the badge stuck — clear it so the UI doesn't mislead the user
  //       console.error('Failed to check pending payments:', error);
  //       setHasPendingPayments(false);
  //     }
  //   };

  //   checkPendingPayments();
  //   // Check more frequently so the badge clears quickly after actions and also when the window regains focus
  //   const interval = setInterval(checkPendingPayments, 10000);
  //   const onFocus = () => checkPendingPayments();
  //   window.addEventListener('focus', onFocus);
  //   return () => {
  //     clearInterval(interval);
  //     window.removeEventListener('focus', onFocus);
  //   };
  // }, [user?.user_id]);

  useEffect(() => {
    const checkPendingPayments = async () => {
      // Don't check payments if user is not logged in or doesn't have an ID
      if (!user?.user_id) {
        setHasPendingPayments(false);
        return;
      }
      try {
        const [bookingsResponse, paymentsResponse] = await Promise.all([
          apiClient.get('/users/me/bookings'),
          apiClient.get('/payments').catch(() => ({ data: [] }))
        ]);

        if (!Array.isArray(bookingsResponse.data)) {
          console.warn('checkPendingPayments: unexpected bookings response, clearing pending flag', bookingsResponse.data); // Re-adding some logging if useful, or keeping it clean
          setHasPendingPayments(false);
          return;
        }

        const allBookings = bookingsResponse.data || [];
        const allPayments = paymentsResponse.data || [];

        // Filter payments for current user
        const userPayments = allPayments.filter((p: any) => {
          if (!user?.user_id) return false;
          return (
            p.student?.user?.user_id === user.user_id
          );
        });

        // Bookings that require payment attention
        const relevantBookings = allBookings.filter((booking: any) => {
          const status = (booking?.status || '').toLowerCase().trim();
          return (
            status === 'awaiting_payment' ||
            status === 'payment_pending' ||
            status === 'payment_rejected'
          );
        });

        let shouldShowDot = false;

        for (const booking of relevantBookings) {
          // Match payment by booking_id
          const matchingPayment = userPayments.find((p: any) => p.booking_id === booking.id);

          if (!matchingPayment) {
            // No payment yet → show dot
            shouldShowDot = true;
            break;
          }

          const paymentStatus = (matchingPayment.status || '').toLowerCase().trim();

          // Only show dot for 'pending' or 'rejected'
          if (paymentStatus === 'pending' || paymentStatus === 'rejected') {
            shouldShowDot = true;
            break;
          }

          // 'confirmed', 'admin_confirmed', 'refunded' → no dot
        }

        setHasPendingPayments(shouldShowDot);

      } catch (err) {
        console.error('Failed to check pending payments', err);
        setHasPendingPayments(false);
      }
    };

    // Strict guard: if no user, don't even start the interval
    if (!user?.user_id) {
      setHasPendingPayments(false);
      return;
    }

    checkPendingPayments();
    const interval = setInterval(checkPendingPayments, 8000);
    const onFocus = () => checkPendingPayments();

    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [user?.user_id]);



  // Fetch booking data and check for new items
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!user?.user_id) {
        if (mounted) {
          setUpcomingCount(0);
          setPendingBookingsCount(0);
          setHasCompletedSessionsForFeedback(false);
        }
        return;
      }
      try {
        // Fetch bookings
        const bookingsRes = await apiClient.get('/users/me/bookings');
        const allBookings = Array.isArray(bookingsRes.data) ? bookingsRes.data : [];

        // Parse session start time helper
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

        const now = new Date();

        // Count upcoming sessions - only future sessions (matching UpcomingSessionsPage logic)
        const upcoming = allBookings.filter((b: any) => {
          if (!['upcoming', 'confirmed'].includes(b.status)) return false;
          const start = parseSessionStart(b.date, b.time);
          return start && start > now;
        });
        if (mounted) setUpcomingCount(upcoming.length);

        // Count pending bookings (awaiting tutor response) - matching TuteeMyBookings filter logic
        // TuteeMyBookings filters out 'upcoming' and 'completed', so we count the rest
        const pending = allBookings.filter((b: any) => {
          const status = (b.status || '').toLowerCase();
          return status !== 'upcoming' && status !== 'completed';
        });
        if (mounted) setPendingBookingsCount(pending.length);

        // Check for completed sessions that might need feedback
        const completedForFeedback = allBookings.filter((b: any) =>
          b.status === 'completed' && !b.tutee_rating
        );
        if (mounted) setHasCompletedSessionsForFeedback(completedForFeedback.length > 0);
      } catch (err) {
        console.error('Failed to load booking data (tutee):', err);
        if (mounted) {
          setUpcomingCount(0);
          setPendingBookingsCount(0);
          setHasCompletedSessionsForFeedback(false);
        }
      }
    };
    load();
    // Update count every 30 seconds to reflect changes quickly
    const interval = setInterval(load, 30000);
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => {
      mounted = false;
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [user?.user_id]);

  // Check for become tutor application updates
  useEffect(() => {
    let mounted = true;
    const checkTutorApplication = async () => {
      if (!user?.user_id) {
        if (mounted) setHasBecomeTutorUpdate(false);
        return;
      }

      try {
        // First check if user has a tutor profile/application
        let hasTutorProfile = false;
        try {
          const tutorRes = await apiClient.get(`/tutors/by-user/${user.user_id}/tutor-id`);
          if (tutorRes.data?.tutor_id) {
            hasTutorProfile = true;
          }
        } catch (err: any) {
          // 404 means no tutor profile exists yet - this is fine
          if (err.response?.status !== 404) {
            console.error('Error checking tutor profile:', err);
          }
        }

        // Only show dot if user has a tutor profile AND there are relevant unread notifications
        if (hasTutorProfile) {
          const tutorNotifications = notifications.filter(
            (n: any) =>
              !n.is_read &&
              (n.message?.toLowerCase().includes('tutor') ||
                n.message?.toLowerCase().includes('application') ||
                n.message?.toLowerCase().includes('approved') ||
                n.message?.toLowerCase().includes('rejected'))
          );
          if (mounted) setHasBecomeTutorUpdate(tutorNotifications.length > 0);
        } else {
          // No tutor profile yet, don't show dot
          if (mounted) setHasBecomeTutorUpdate(false);
        }
      } catch (err) {
        console.error('Failed to check tutor application status:', err);
        if (mounted) setHasBecomeTutorUpdate(false);
      }
    };

    checkTutorApplication();
    // Re-check when notifications change
    const interval = setInterval(checkTutorApplication, 10000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [notifications, user?.user_id]);

  // Mark page as viewed when user navigates to it
  useEffect(() => {
    const currentPath = location.pathname;
    // Check if current path matches any sidebar route
    tuteeNavLinks.forEach(({ to }) => {
      if (currentPath === to || currentPath.startsWith(to + '/')) {
        setViewedPages(prev => new Set(prev).add(to));
      }
    });
  }, [location.pathname]);

  const { unreadCount, hasUpcomingSessions } = useNotifications();
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [showTooltip, setShowTooltip] = useState<string | null>(null);
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleMouseEnter = (to: string) => {
    setHoveredItem(to);
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    const id = setTimeout(() => {
      setShowTooltip(to);
    }, 500);
    setTimeoutId(id);
  };

  const handleMouseLeave = () => {
    setHoveredItem(null);
    setShowTooltip(null);
    if (timeoutId) {
      clearTimeout(timeoutId);
      setTimeoutId(null);
    }
  };

  useEffect(() => {
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [timeoutId]);

  const handleProfileImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      notify('Please select a valid image file.', 'error');
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await apiClient.post(`/users/${user?.user_id}/profile-image`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      // Update local storage with new profile image URL
      const updatedUser = { ...user, profile_image_url: response.data.profile_image_url };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      updateRoleUser(updatedUser as any);

      // Trigger re-render by reloading the page
      window.location.reload();

      notify('Profile image updated successfully!', 'success');
    } catch (error) {
      console.error('Failed to upload profile image:', error);
      notify('Failed to upload profile image. Please try again.', 'error');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  return (
    <aside className="w-full md:w-64 h-full bg-white flex flex-col border-r border-slate-200">
      {/* Header Container */}
      <div className="hidden md:flex px-5 py-6 border-b border-slate-100 items-center justify-between shrink-0">
        <div className="flex items-center space-x-3.5">
          <img
            src={logoBase64}
            alt="TutorFriends Logo"
            className="h-10 md:h-12 w-auto object-contain transition-transform duration-300 hover:scale-105"
          />
          <div className="flex flex-col justify-center min-w-0">
            <h1 className="text-[17px] md:text-lg font-bold text-slate-800 tracking-tight leading-tight truncate">TutorFriends</h1>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mt-0.5 truncate">Student Menu</p>
          </div>
        </div>
      </div>

      {/* Navigation Container */}
      <nav className="flex-1 px-3 py-5 space-y-1.5 overflow-y-auto md:overflow-visible custom-scrollbar">
        {tuteeNavLinks.map(({ to, icon: Icon, label, description, showNotification, showUpcoming }) => {
          return (
            <div key={to} className="relative group/nav-item">
              <NavLink
                to={to}
                className={({ isActive }) =>
                  `block px-3.5 py-3 rounded-xl transition-all duration-200 ${isActive
                    ? 'bg-blue-50/80 text-blue-700 font-medium'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`
                }
                onMouseEnter={() => handleMouseEnter(to)}
                onMouseLeave={handleMouseLeave}
                onClick={() => {
                  setViewedPages(prev => new Set(prev).add(to));
                  setShowTooltip(null);
                }}
              >
                {({ isActive }) => (
                  <div className="flex flex-col w-full">
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center space-x-3.5 min-w-0">
                        <Icon
                          className={`h-5 w-5 flex-shrink-0 transition-all duration-200 ${isActive ? 'text-blue-600' : 'text-slate-400 group-hover/nav-item:text-slate-600'
                            }`}
                        />
                        <span className="text-[14px] font-semibold tracking-tight truncate">{label}</span>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                        {/* My Bookings Badges */}
                        {to === '/tutee-dashboard/my-bookings' && !viewedPages.has(to) && (
                          <div className="flex gap-1.5 items-center">
                            {pendingBookingsCount > 0 && (
                              <div className="h-2 w-2 rounded-full bg-orange-500"></div>
                            )}
                            {notifications.some(
                              (n: any) => !n.is_read && (
                                n.type === 'booking_update' ||
                                n.message?.toLowerCase().includes('booking') ||
                                n.message?.toLowerCase().includes('accepted') ||
                                n.message?.toLowerCase().includes('declined')
                              )
                            ) && (
                                <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                              )}
                          </div>
                        )}

                        {/* Payment Badge */}
                        {to === '/tutee-dashboard/payment' &&
                          !viewedPages.has(to) &&
                          hasPendingPayments && (
                            <div className="h-2 w-2 rounded-full bg-red-500"></div>
                          )}

                        {/* After Session Badge */}
                        {to === '/tutee-dashboard/after-session' &&
                          !viewedPages.has(to) &&
                          hasCompletedSessionsForFeedback && (
                            <div className="h-2 w-2 rounded-full bg-purple-500"></div>
                          )}

                        {/* Become a Tutor Badge */}
                        {to === '/tutee-dashboard/become-tutor' &&
                          !viewedPages.has(to) &&
                          hasBecomeTutorUpdate && (
                            <div className="h-2 w-2 rounded-full bg-green-500"></div>
                          )}

                        {/* Upcoming Sessions Number Badge */}
                        {showUpcoming && upcomingCount > 0 && (
                          <span className="inline-flex items-center justify-center min-w-[20px] h-[20px] px-1.5 rounded-full text-[11px] font-bold bg-blue-600 text-white">
                            {upcomingCount > 99 ? '99+' : upcomingCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </NavLink>

              {/* Hover tooltip - Desktop */}
              {showTooltip === to && (
                <div className="hidden md:block absolute left-full top-1/2 transform -translate-y-1/2 ml-4 z-[100] animate-in fade-in-0 zoom-in-95 duration-200 pointer-events-none">
                  <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-xl w-72 backdrop-blur-sm">
                    <div className="relative">
                      {/* Content */}
                      <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0 mt-0.5">
                          <Info className="w-4 h-4 text-blue-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            {showNotification && hasPendingPayments && (
                              <div className="h-1.5 w-1.5 rounded-full bg-red-500 absolute top-0 right-0"></div>
                            )}
                          </div>
                          <p className="text-sm text-slate-600 leading-relaxed font-normal">{description}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Mobile Inline Description */}
              {showTooltip === to && (
                <div className="md:hidden mt-2 mb-1 px-3 py-2.5 bg-slate-50 border border-slate-100 rounded-xl animate-in slide-in-from-top-2 duration-200">
                  <p className="text-xs text-slate-600 leading-relaxed">{description}</p>
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Profile Container */}
      <div className="px-3 pt-4 pb-6 md:pb-4 border-t border-slate-100 shrink-0 bg-white">
        <NavLink
          to="/tutee-dashboard/profile"
          className="flex items-center space-x-3.5 p-2.5 rounded-xl transition-colors duration-200 hover:bg-slate-50 border border-transparent hover:border-slate-100"
        >
          <div className="relative shrink-0">
            {user?.profile_image_url ? (
              <img
                src={getFileUrl(user.profile_image_url)}
                alt={user.name}
                className="h-[42px] w-[42px] rounded-full object-cover shadow-sm ring-1 ring-slate-200"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                }}
              />
            ) : (
              <div className="h-[42px] w-[42px] rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm ring-1 ring-blue-200/50">
                {user?.name?.charAt(0).toUpperCase() || 'U'}
              </div>
            )}
            {/* Online Indicator Box */}
            <div className="absolute bottom-0 right-0 h-3 w-3 bg-green-500 border-[2px] border-white rounded-full"></div>
          </div>
          <div className="flex-1 min-w-0 overflow-hidden">
            <p className="text-[14px] font-semibold text-slate-800 truncate tracking-tight">{user?.name}</p>
            <p className="text-[12px] text-slate-500 truncate mt-0.5">{user?.email}</p>
          </div>
        </NavLink>
      </div>
    </aside>
  );
};

export default TuteeSidebar;
