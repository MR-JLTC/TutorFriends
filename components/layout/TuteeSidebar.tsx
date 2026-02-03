import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  GraduationCap,
  Search,
  CreditCard,
  Star,
  User,
  Edit2,
  Bell
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
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
      <div className="px-4 py-4 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <img src={logoBase64} alt="TutorFriends Logo" className="h-14 w-auto object-contain" />
            <div>
              <h1 className="text-lg font-bold text-slate-800">TutorFriends</h1>
              <p className="text-xs text-slate-600 font-medium">Student Dashboard</p>
            </div>
          </div>
          {/* Removed notification bell and badge from tutee sidebar as requested */}
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {tuteeNavLinks.map(({ to, icon: Icon, label, description, showNotification, showUpcoming }) => {
          return (
            <div key={to} className="relative">
              <NavLink
                to={to}
                className={({ isActive }) =>
                  `block p-3 rounded-lg transition-all duration-200 group ${isActive
                    ? 'bg-blue-50 text-blue-700 shadow-sm'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`
                }
                onMouseEnter={() => handleMouseEnter(to)}
                onMouseLeave={handleMouseLeave}
                onClick={() => {
                  setViewedPages(prev => new Set(prev).add(to));
                }}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center space-x-3">
                    <Icon className={`h-5 w-5 ${hoveredItem === to ? 'text-blue-600' : 'text-slate-500'}`} />
                    <span className="font-medium text-sm">{label}</span>
                  </div>

                  <div className="ml-auto flex items-center gap-2">
                    {/* My Bookings - Show dot if there are pending bookings or booking updates AND page not viewed */}
                    {to === '/tutee-dashboard/my-bookings' && !viewedPages.has(to) && (
                      <>
                        {pendingBookingsCount > 0 && (
                          <div className="h-2.5 w-2.5 rounded-full bg-orange-500 animate-pulse"></div>
                        )}
                        {notifications.some(
                          (n: any) => !n.is_read && (
                            n.type === 'booking_update' ||
                            n.message?.toLowerCase().includes('booking') ||
                            n.message?.toLowerCase().includes('accepted') ||
                            n.message?.toLowerCase().includes('declined')
                          )
                        ) && (
                            <div className="h-2.5 w-2.5 rounded-full bg-blue-500 animate-pulse"></div>
                          )}
                      </>
                    )}

                    {/* Payment - Show dot if there are pending payments AND page not viewed */}
                    {to === '/tutee-dashboard/payment' &&
                      !viewedPages.has(to) &&
                      hasPendingPayments && (
                        <div className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse"></div>
                      )}

                    {/* After Session - Show dot if there are completed sessions needing feedback AND page not viewed */}
                    {to === '/tutee-dashboard/after-session' &&
                      !viewedPages.has(to) &&
                      hasCompletedSessionsForFeedback && (
                        <div className="h-2.5 w-2.5 rounded-full bg-purple-500 animate-pulse"></div>
                      )}

                    {/* Become a Tutor - Show dot if there are application updates AND page not viewed */}
                    {to === '/tutee-dashboard/become-tutor' &&
                      !viewedPages.has(to) &&
                      hasBecomeTutorUpdate && (
                        <div className="h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse"></div>
                      )}

                    {/* Upcoming Sessions - Show numeric badge */}
                    {showUpcoming && upcomingCount > 0 && (
                      <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-600 text-white">
                        {upcomingCount > 99 ? '99+' : upcomingCount}
                      </span>
                    )}
                  </div>
                </div>
              </NavLink>

              {/* Hover tooltip */}
              {showTooltip === to && (
                <div className="absolute left-full top-1/2 transform -translate-y-1/2 ml-4 z-50 animate-in fade-in-0 zoom-in-95 duration-200">
                  <div className="bg-white border border-slate-200 rounded-2xl px-5 py-4 shadow-2xl w-80">
                    <div className="relative">
                      {/* Arrow */}
                      <div className="absolute left-0 top-1/2 transform -translate-y-1/2 -translate-x-2">
                        <div className="w-4 h-4 bg-white border-l-2 border-t-2 border-slate-200 rotate-45"></div>
                      </div>

                      {/* Content */}
                      <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0 mt-1">
                          <div className="w-3 h-3 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full shadow-sm"></div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <h4 className="text-base font-semibold text-slate-800 mb-2 leading-tight">{label}</h4>
                            {showNotification && hasPendingPayments && (
                              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                            )}
                          </div>
                          <p className="text-sm text-slate-600 leading-relaxed">{description}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Profile Section - clickable to open profile page for viewing/editing */}
      <div className="px-4 py-4 border-t border-slate-200">
        <NavLink to="/tutee-dashboard/profile" className="flex items-center space-x-3 group hover:bg-slate-50 p-2 rounded-md">
          <div className="relative">
            {user?.profile_image_url ? (
              <img
                src={getFileUrl(user.profile_image_url)}
                alt={user.name}
                className="h-12 w-12 rounded-full object-cover border-2 border-slate-200"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                }}
              />
            ) : (
              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold text-lg border-2 border-slate-200">
                {user?.name?.charAt(0).toUpperCase() || 'U'}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-800 truncate">{user?.name}</p>
            <p className="text-xs text-slate-600 truncate">{user?.email}</p>
          </div>
        </NavLink>
      </div>
    </aside>
  );
};

export default TuteeSidebar;
