import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  FileText,
  User,
  Calendar,
  MessageSquare,
  DollarSign,
  CheckCircle,
  Lock,
  X,
  Clock
} from 'lucide-react';
import { logoBase64 } from '../../assets/logo';
import { useVerification } from '../../context/VerificationContext';
import apiClient from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { useNotifications } from '../../context/NotificationContext';

const tutorNavLinks = [
  {
    to: '/tutor-dashboard/profile',
    icon: User,
    label: 'Profile Setup',
    description: 'Complete your tutor profile with bio, subjects, profile photo, and GCash payment details for students to see.',
    requiresApproval: false,
    isFirstStep: false
  },
  {
    to: '/tutor-dashboard/application',
    icon: FileText,
    label: 'Application & Verification',
    description: 'Submit your credentials, certificates, and supporting documents for admin review and approval to start tutoring.',
    requiresApproval: false,
    isFirstStep: true
  },
  {
    to: '/tutor-dashboard/availability',
    icon: Calendar,
    label: 'Availability Scheduling',
    description: 'Set your weekly schedule and time slots when you\'re available for tutoring sessions.',
    requiresApproval: true,
    isFirstStep: false
  },
  {
    to: '/tutor-dashboard/messages',
    icon: MessageSquare,
    label: 'Messages',
    description: 'Chat with your students in real-time.',
    requiresApproval: true,
    isFirstStep: false
  },
  {
    to: '/tutor-dashboard/sessions',
    icon: MessageSquare,
    label: 'Booking',
    description: 'Manage incoming booking requests, accept or decline sessions, and communicate with students.',
    requiresApproval: true,
    isFirstStep: false
  },
  // {
  //   // Make this route consistent with other tutor dashboard links so it highlights/behaves like the rest
  //   to: '/tutor-dashboard/upcoming-sessions',
  //   icon: Calendar,
  //   label: 'Upcoming Sessions',
  //   description: 'View and manage your upcoming scheduled sessions in one place.',
  //   requiresApproval: true,
  //   isFirstStep: false
  // },
  {
    to: '/tutor-dashboard/session-history',
    icon: CheckCircle,
    label: 'Session History',
    description: 'View your completed tutoring sessions and history.',
    requiresApproval: true,
    isFirstStep: false
  },
  {
    to: '/tutor-dashboard/earnings',
    icon: DollarSign,
    label: 'Earnings & History',
    description: 'View your payment history, track completed sessions, and monitor your tutoring income.',
    requiresApproval: true,
    isFirstStep: false
  },
];

const TutorSidebar: React.FC = () => {
  const { isVerified, applicationStatus, isLoading } = useVerification();
  const { user } = useAuth();
  const { notifications, unreadCount } = useNotifications();
  const location = useLocation();
  const [upcomingCount, setUpcomingCount] = useState<number>(0);
  const [pendingBookingsCount, setPendingBookingsCount] = useState<number>(0);
  const [unreviewedPaymentsCount, setUnreviewedPaymentsCount] = useState<number>(0);
  const [hasApplicationUpdate, setHasApplicationUpdate] = useState<boolean>(false);
  const [viewedPages, setViewedPages] = useState<Set<string>>(new Set());
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [showTooltip, setShowTooltip] = useState<string | null>(null);
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);

  const handleMouseEnter = (to: string) => {
    setHoveredItem(to);
    // Clear any existing timeout
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    // Add a small delay before showing tooltip
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

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [timeoutId]);

  // Fetch booking data and check for new items
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!user?.user_id) {
        if (mounted) {
          setUpcomingCount(0);
          setPendingBookingsCount(0);
          setUnreviewedPaymentsCount(0);
        }
        return;
      }
      try {
        // Get tutor ID first
        const tutorRes = await apiClient.get(`/tutors/by-user/${user.user_id}/tutor-id`);
        const tutorId = tutorRes.data?.tutor_id;

        if (!tutorId) {
          if (mounted) {
            setUpcomingCount(0);
            setPendingBookingsCount(0);
            setUnreviewedPaymentsCount(0);
          }
          return;
        }

        // Fetch booking requests
        const bookingsRes = await apiClient.get(`/tutors/${tutorId}/booking-requests`);
        const allBookings = Array.isArray(bookingsRes.data)
          ? bookingsRes.data
          : Array.isArray(bookingsRes.data?.data)
            ? bookingsRes.data.data
            : [];

        // Count upcoming sessions
        const upcoming = allBookings.filter((b: any) => ['upcoming', 'confirmed'].includes(b.status));
        if (mounted) setUpcomingCount(upcoming.length);

        // Count pending bookings (need tutor action)
        const pending = allBookings.filter((b: any) => b.status === 'pending');
        if (mounted) setPendingBookingsCount(pending.length);

        // Count unreviewed payment proofs
        const unreviewedPayments = allBookings.filter(
          (b: any) => b.status === 'awaiting_payment' && !!b.payment_proof
        );
        if (mounted) setUnreviewedPaymentsCount(unreviewedPayments.length);
      } catch (err) {
        console.error('Failed to load booking data:', err);
        if (mounted) {
          setUpcomingCount(0);
          setPendingBookingsCount(0);
          setUnreviewedPaymentsCount(0);
        }
      }
    };
    load();
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => {
      mounted = false;
      window.removeEventListener('focus', onFocus);
    };
  }, [user?.user_id]);

  // Check for application status updates (rejected status means needs attention)
  useEffect(() => {
    if (applicationStatus === 'rejected') {
      setHasApplicationUpdate(true);
    } else if (applicationStatus === 'approved' || applicationStatus === 'pending') {
      // Check if there are unread notifications about application
      const applicationNotifications = notifications.filter(
        (n: any) =>
          !n.is_read &&
          (n.message?.toLowerCase().includes('application') ||
            n.message?.toLowerCase().includes('verification') ||
            n.message?.toLowerCase().includes('rejected') ||
            n.message?.toLowerCase().includes('approved'))
      );
      setHasApplicationUpdate(applicationNotifications.length > 0);
    } else {
      setHasApplicationUpdate(false);
    }
  }, [applicationStatus, notifications]);

  // Mark page as viewed when user navigates to it
  useEffect(() => {
    const currentPath = location.pathname;
    // Check if current path matches any sidebar route
    tutorNavLinks.forEach(({ to }) => {
      if (currentPath === to || currentPath.startsWith(to + '/')) {
        setViewedPages(prev => new Set(prev).add(to));
      }
    });
  }, [location.pathname]);


  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
      <div className="px-4 py-4 border-b border-slate-200">
        <div className="flex items-center space-x-3">
          <img src={logoBase64} alt="TutorFriends Logo" className="h-14 w-auto object-contain" />
          <div>
            <h1 className="text-lg font-bold text-slate-800">TutorFriends</h1>
            <p className="text-xs text-slate-600 font-medium">Connecting Minds, Building Futures</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto md:overflow-visible custom-scrollbar">
        {tutorNavLinks.map(({ to, icon: Icon, label, description, requiresApproval, isFirstStep }) => {
          const isLocked = requiresApproval && !isVerified;

          return (
            <div key={to} className="relative">
              {isLocked ? (
                <div className="block p-3 rounded-lg transition-all duration-200 group cursor-not-allowed opacity-50">
                  <div className="flex items-center space-x-3">
                    <Lock className="h-5 w-5 text-slate-400" />
                    <span className="font-medium text-sm text-slate-400">{label}</span>
                    <Lock className="h-4 w-4 text-slate-400 ml-auto" />
                  </div>
                </div>
              ) : (
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
                  <div className="flex items-center space-x-3">
                    <Icon className={`h-5 w-5 ${hoveredItem === to ? 'text-blue-600' : 'text-slate-500'}`} />
                    <span className="font-medium text-sm">{label}</span>

                    {/* Color dot indicators for new data */}
                    {!isLocked && (
                      <div className="ml-auto flex items-center gap-2">
                        {/* Booking - Show dot if there are pending bookings or unreviewed payments AND page not viewed */}
                        {to === '/tutor-dashboard/sessions' &&
                          !viewedPages.has(to) &&
                          (pendingBookingsCount > 0 || unreviewedPaymentsCount > 0) && (
                            <div className="relative">
                              <div className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse"></div>
                            </div>
                          )}

                        {/* Application - Show dot if rejected or has unread application notifications AND page not viewed */}
                        {to === '/tutor-dashboard/application' &&
                          !viewedPages.has(to) &&
                          hasApplicationUpdate && (
                            <div className="relative">
                              <div className="h-2.5 w-2.5 rounded-full bg-orange-500 animate-pulse"></div>
                            </div>
                          )}

                        {/* Earnings - Show dot if there are unread payment-related notifications AND page not viewed */}
                        {to === '/tutor-dashboard/earnings' &&
                          !viewedPages.has(to) &&
                          notifications.some(
                            (n: any) => !n.is_read && (
                              n.type === 'payment' ||
                              n.message?.toLowerCase().includes('payment') ||
                              n.message?.toLowerCase().includes('earnings')
                            )
                          ) && (
                            <div className="relative">
                              <div className="h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse"></div>
                            </div>
                          )}

                        {/* Session History - Show dot if there are sessions awaiting confirmation AND page not viewed */}
                        {to === '/tutor-dashboard/session-history' &&
                          !viewedPages.has(to) &&
                          notifications.some(
                            (n: any) => !n.is_read && (
                              n.message?.toLowerCase().includes('session') ||
                              n.message?.toLowerCase().includes('completed') ||
                              n.message?.toLowerCase().includes('confirmation')
                            )
                          ) && (
                            <div className="relative">
                              <div className="h-2.5 w-2.5 rounded-full bg-blue-500 animate-pulse"></div>
                            </div>
                          )}

                        {/* Numeric badge for Upcoming Sessions */}
                        {to === '/tutor-dashboard/upcoming-sessions' && upcomingCount > 0 && (
                          <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-600 text-white">
                            {upcomingCount > 99 ? '99+' : upcomingCount}
                          </span>
                        )}

                        {/* Application status icon */}
                        {isFirstStep && (
                          <>
                            {applicationStatus === 'approved' ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : (
                              <Clock className="h-4 w-4 text-yellow-500" />
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </NavLink>
              )}

              {/* Hover tooltip - Desktop */}
              {showTooltip === to && (
                <div className="hidden md:block absolute left-full top-1/2 transform -translate-y-1/2 ml-4 z-50 animate-in fade-in-0 zoom-in-95 duration-200">
                  <div className="bg-white border border-slate-200 rounded-2xl px-5 py-4 shadow-2xl w-80">
                    <div className="relative">
                      {/* Arrow */}
                      {/* <div className="absolute left-0 top-1/2 transform -translate-y-1/2 -translate-x-2">
                        <div className="w-4 h-4 bg-white border-l-2 border-t-2 border-slate-200 rotate-45"></div>
                      </div> */}

                      {/* Content */}
                      <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0 mt-1">
                          <div className="w-3 h-3 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full shadow-sm"></div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-base font-semibold text-slate-800 mb-2 leading-tight">{label}</h4>
                          <p className="text-sm text-slate-600 leading-relaxed">{description}</p>
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

      {/* Status indicators */}
      <div className="px-4 py-3 border-t border-slate-200">
        <div className="flex items-center space-x-2 text-sm">
          {applicationStatus === 'approved' ? (
            <CheckCircle className="h-4 w-4 text-green-500" />
          ) : (
            <X className="h-4 w-4 text-red-500" />
          )}
          <span className="text-slate-600">Tutor Account</span>
        </div>
      </div>
    </aside>
  );
};

export default TutorSidebar;
