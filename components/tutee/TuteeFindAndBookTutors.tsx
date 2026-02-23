import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, FileText, X, Info, ExternalLink } from 'lucide-react';
import apiClient, { getFileUrl } from '../../services/api';
import Modal from '../ui/Modal';
import { toast } from 'react-toastify';
// import 'react-toastify/dist/ReactToastify.css'; // Moves to App.tsx

interface BookingFormData {
  subject: string;
  date: string;
  time: string;
  duration: number;
  student_notes?: string;
}

type TutorListItem = {
  user_id: number;
  name: string;
  email: string;
  profile_image_url?: string | null;
  university_id?: number | null;
  course_id?: number | null;
  university_name?: string | null;
  university?: {
    university_id?: number;
    name?: string;
    university_name?: string;
    display_name?: string;
    acronym?: string;
    [key: string]: any;
  } | null;
  course?: {
    course_id?: number;
    course_name?: string;
    name?: string;
    acronym?: string;
    [key: string]: any;
  } | null;
  role?: string;
  created_at?: string;
  tutor_profile?: {
    tutor_id: number;
    status?: string;
    rating?: number;
    total_reviews?: number;
    activity_status?: 'online' | 'offline';
    university_id?: number | null;
    course_id?: number | null;
    university?: {
      university_id?: number;
      name?: string;
      university_name?: string;
      display_name?: string;
      acronym?: string;
      [key: string]: any;
    } | null;
    course?: {
      course_id?: number;
      course_name?: string;
      name?: string;
      acronym?: string;
      [key: string]: any;
    } | null;
  } | null;
  profile?: {
    session_rate_per_hour?: number | null;
    subjects?: string[];
    university?: {
      university_id?: number;
      name?: string;
      university_name?: string;
      display_name?: string;
      acronym?: string;
      [key: string]: any;
    } | null;
    course?: {
      course_id?: number;
      course_name?: string;
      name?: string;
      acronym?: string;
      [key: string]: any;
    } | null;
    [key: string]: any;
  };
};

const TuteeFindAndBookTutors: React.FC = () => {
  const [tutors, setTutors] = useState<TutorListItem[]>([]);
  // searchQuery is the committed query applied to filter results
  const [searchQuery, setSearchQuery] = useState('');
  // searchDraft is the live input value; pressing Enter commits it to searchQuery
  const [searchDraft, setSearchDraft] = useState('');

  // Apply a debounced live-search: when the user types, apply the draft after a short delay
  // This preserves Enter-to-commit while still showing live results during typing.
  useEffect(() => {
    const id = setTimeout(() => {
      // only update if different to avoid extra renders
      const q = (searchDraft || '').trim();
      if (q !== searchQuery) setSearchQuery(q);
    }, 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchDraft]);
  const [filterOption, setFilterOption] = useState<'all' | 'has_subjects' | 'top_rated' | 'with_reviews' | 'newest'>('all');
  const [priceFilter, setPriceFilter] = useState<'all' | 'under_300' | '300_500' | '500_700' | '700_plus'>('all');
  const [ratingFilter, setRatingFilter] = useState<'all' | '4_plus' | '3' | '2' | '1' | 'no_rate'>('all');
  const [universityFilter, setUniversityFilter] = useState<number | 'all'>('all');
  const [courseFilter, setCourseFilter] = useState<number | 'all'>('all');
  const [universities, setUniversities] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTutorProfile, setSelectedTutorProfile] = useState<any | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const navigate = useNavigate();
  const [messageLoading, setMessageLoading] = useState(false);

  const handleMessageTutor = async () => {
    if (!selectedTutorProfile?.user?.user_id) return;

    try {
      setMessageLoading(true);
      // Create or get existing conversation
      await apiClient.post('/chat/conversations', {
        targetUserId: selectedTutorProfile.user.user_id
      });

      // Navigate to messages page
      navigate('/tutee-dashboard/messages');
    } catch (error) {
      console.error('Failed to start conversation:', error);
      toast.error('Failed to start conversation. Please try again.');
    } finally {
      setMessageLoading(false);
    }
  };

  // Fetch universities and courses
  useEffect(() => {
    const fetchUniversitiesAndCourses = async () => {
      try {
        const [uniRes, courseRes] = await Promise.all([
          apiClient.get('/universities').catch(() => ({ data: [] })),
          apiClient.get('/courses').catch(() => ({ data: [] }))
        ]);
        const activeUniversities = (uniRes.data || []).filter((uni: any) => !uni.status || uni.status === 'active');
        setUniversities(activeUniversities);
        const normalizedCourses = (Array.isArray(courseRes.data) ? courseRes.data : []).map((c: any) => ({
          ...c,
          university_id: c?.university_id ?? c?.university?.university_id ?? c?.universityId ?? null,
        }));
        setCourses(normalizedCourses);
      } catch (err) {
        console.error('Failed to fetch universities/courses:', err);
        setUniversities([]);
        setCourses([]);
      }
    };
    fetchUniversitiesAndCourses();
  }, []);

  // Reset course filter when university filter changes
  useEffect(() => {
    if (universityFilter === 'all') {
      setCourseFilter('all');
    }
  }, [universityFilter]);

  useEffect(() => {
    const fetchTutors = async () => {
      try {
        setLoading(true);
        const res = await apiClient.get('/users');
        // backend maps tutor role to 'tutor' and student to 'student'
        const all: TutorListItem[] = res.data || [];
        // Only show users that are tutors and have been approved
        const tutorsOnly = all.filter(u => u.tutor_profile && (u.tutor_profile.status || '').toLowerCase() === 'approved');
        // Sort by creation date first (will be re-sorted after ratings are calculated)
        const sortedTutors = tutorsOnly.sort((a, b) => {
          const dateA = new Date(a.created_at || 0).getTime();
          const dateB = new Date(b.created_at || 0).getTime();
          return dateA - dateB;
        });
        // Enrich each tutor with their public profile (which contains subjects) and fetch ratings
        try {
          const enriched = await Promise.all(sortedTutors.map(async (u) => {
            const tutorId = (u as any).tutor_profile?.tutor_id;
            if (!tutorId) return u;
            try {
              const [profileRes, bookingsRes] = await Promise.all([
                apiClient.get(`/tutors/${tutorId}/profile`),
                apiClient.get(`/tutors/${tutorId}/booking-requests`).catch(() => ({ data: [] })),
              ]);

              // Calculate rating from booking requests
              let bookings: any[] = [];
              if (Array.isArray(bookingsRes.data)) {
                bookings = bookingsRes.data;
              } else if (Array.isArray(bookingsRes.data?.data)) {
                bookings = bookingsRes.data.data;
              } else if (Array.isArray(bookingsRes.data?.bookings)) {
                bookings = bookingsRes.data.bookings;
              }

              // Calculate average rating from all ratings
              const ratings: number[] = [];
              bookings.forEach((booking: any) => {
                if (booking.tutee_rating && booking.tutee_rating > 0) {
                  ratings.push(Number(booking.tutee_rating));
                }
              });

              let averageRating = 0;
              let totalRatings = 0;
              if (ratings.length > 0) {
                const sum = ratings.reduce((acc, rating) => acc + rating, 0);
                averageRating = sum / ratings.length;
                totalRatings = ratings.length;
              }

              return { ...u, profile: profileRes.data, calculatedRating: averageRating, calculatedTotalRatings: totalRatings };
            } catch (err) {
              // If profile fetch fails, return the original item without profile
              console.warn('Failed to fetch tutor profile for', tutorId, err);
              return u;
            }
          }));
          setTutors(enriched as TutorListItem[]);

          // Extract online status from tutor profiles and store ratings
          const onlineStatusMap: Record<number, boolean> = {};
          const ratingsMap: Record<number, { average: number; totalRatings: number }> = {};
          enriched.forEach(tutor => {
            if (tutor.user_id && tutor.tutor_profile) {
              // Get online status from tutor_profile (from API response)
              const onlineStatus = tutor.tutor_profile.activity_status;
              onlineStatusMap[tutor.user_id] = onlineStatus === 'online';

              // Store calculated ratings
              if ((tutor as any).calculatedRating !== undefined) {
                ratingsMap[tutor.user_id] = {
                  average: (tutor as any).calculatedRating,
                  totalRatings: (tutor as any).calculatedTotalRatings || 0
                };
              }
            }
          });
          setTutorOnlineStatus(onlineStatusMap);
          setTutorRatings(ratingsMap);

          // Re-sort tutors by calculated ratings
          const sortedByRating = [...enriched].sort((a, b) => {
            const ratingA = ratingsMap[a.user_id]?.average || 0;
            const ratingB = ratingsMap[b.user_id]?.average || 0;
            if (ratingB !== ratingA) {
              return ratingB - ratingA;
            }
            // If ratings are equal, sort by creation date (oldest first)
            const dateA = new Date(a.created_at || 0).getTime();
            const dateB = new Date(b.created_at || 0).getTime();
            return dateA - dateB;
          });
          setTutors(sortedByRating as TutorListItem[]);
        } catch (err) {
          // If enrichment fails for any reason, fall back to the basic list
          console.warn('Failed to enrich tutors with profile data', err);
          setTutors(sortedTutors);
        }
      } catch (err) {
        console.error('Failed to fetch tutors', err);
        setError('Failed to load tutors. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    fetchTutors();
  }, []);

  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingMessage, setBookingMessage] = useState<string | null>(null);
  const [bookingForm, setBookingForm] = useState<{ subject: string; date: string; time: string; duration: number; student_notes?: string }>({ subject: '', date: '', time: '', duration: 1 });
  const [bookingErrors, setBookingErrors] = useState<{ subject?: string; date?: string; time?: string; duration?: string; student_notes?: string }>({});
  // Controls whether the booking input fields are visible inside the profile modal
  const [showBookingForm, setShowBookingForm] = useState(false);

  const [myBookings, setMyBookings] = useState<any[]>([]);
  const [myBookingsLoading, setMyBookingsLoading] = useState(false);
  const [myBookingsError, setMyBookingsError] = useState<string | null>(null);
  const [showMyBookings, setShowMyBookings] = useState(false);
  const [bookingErrorModalOpen, setBookingErrorModalOpen] = useState(false);
  const [bookingErrorModalMessage, setBookingErrorModalMessage] = useState<string | null>(null);

  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [cancelConfirmationOpen, setCancelConfirmationOpen] = useState(false);
  const [availableTimeSlots, setAvailableTimeSlots] = useState<string[]>([]);
  const [allowedDurations, setAllowedDurations] = useState<number[]>([]); // Store in hours (0.5 increments: 1, 1.5, 2, 2.5, etc.)
  const [maxAllowedMinutes, setMaxAllowedMinutes] = useState<number>(0);
  const [existingBookings, setExistingBookings] = useState<any[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [tutorOnlineStatus, setTutorOnlineStatus] = useState<Record<number, boolean>>({});
  const [tutorBookingRequests, setTutorBookingRequests] = useState<any[]>([]);
  const [tutorDocuments, setTutorDocuments] = useState<any[]>([]);
  const [tutorRatings, setTutorRatings] = useState<Record<number, { average: number; totalRatings: number }>>({});

  // Document Viewer State
  const [documentViewerOpen, setDocumentViewerOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<{ url: string; type: string; name: string } | null>(null);

  // Fetch existing bookings for the tutor on the selected date
  useEffect(() => {
    const fetchExistingBookings = async () => {
      if (!bookingForm.date || !selectedTutorProfile?.user?.tutor_profile?.tutor_id) {
        setExistingBookings([]);
        return;
      }

      try {
        setLoadingBookings(true);
        // Fetch tutor's bookings using the booking-requests endpoint
        const tutorId = selectedTutorProfile.user.tutor_profile.tutor_id;
        const response = await apiClient.get(`/tutors/${tutorId}/booking-requests`);

        // Extract bookings from response (handle different response formats)
        let allBookings: any[] = [];
        if (Array.isArray(response.data)) {
          allBookings = response.data;
        } else if (Array.isArray(response.data?.data)) {
          allBookings = response.data.data;
        } else if (response.data?.bookings && Array.isArray(response.data.bookings)) {
          allBookings = response.data.bookings;
        }

        // Filter bookings for the exact date and active statuses
        const bookingsForDate = allBookings.filter((booking: any) => {
          const bookingDate = new Date(booking.date).toISOString().split('T')[0];
          const status = (booking.status || '').toLowerCase();
          // Include bookings that are still active (not cancelled or completed)
          const activeStatuses = ['pending', 'upcoming', 'confirmed'];
          return bookingDate === bookingForm.date && activeStatuses.includes(status);
        });

        setExistingBookings(bookingsForDate);
      } catch (error) {
        console.error('Failed to fetch existing bookings:', error);
        // If endpoint doesn't exist or fails, continue with empty bookings
        setExistingBookings([]);
      } finally {
        setLoadingBookings(false);
      }
    };

    fetchExistingBookings();
  }, [bookingForm.date, selectedTutorProfile?.user?.tutor_profile?.tutor_id]);

  // Helper function to check if a time slot conflicts with existing bookings
  const isTimeSlotAvailable = (startTime: string, durationInHours: number, existingBookings: any[]): boolean => {
    const parseTimeToMinutes = (time: string): number => {
      const [h, m] = time.split(':').map(Number);
      return h * 60 + m;
    };

    const slotStart = parseTimeToMinutes(startTime);
    const totalDurationMinutes = durationInHours * 60;
    const slotEnd = slotStart + totalDurationMinutes;

    // Check if this slot overlaps with any existing booking
    for (const booking of existingBookings) {
      const bookingStart = parseTimeToMinutes(booking.time);
      // Convert booking duration to minutes (assuming it's stored as hours in the booking)
      const bookingDurationMinutes = (booking.duration || 0) * 60;
      const bookingEnd = bookingStart + bookingDurationMinutes;

      // Check for overlap: slot starts before booking ends AND slot ends after booking starts
      if (slotStart < bookingEnd && slotEnd > bookingStart) {
        return false; // Conflict found
      }
    }

    return true; // No conflicts
  };

  // Add useEffect for managing available time slots (now considers existing bookings and duration)
  useEffect(() => {
    if (bookingForm.date && selectedTutorProfile?.availability) {
      const date = new Date(bookingForm.date);
      const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' });
      // Get all blocks for the selected day
      const dayAvailabilityBlocks = selectedTutorProfile.availability.filter(
        (a: any) => a.day_of_week.toLowerCase() === dayOfWeek.toLowerCase()
      );

      if (dayAvailabilityBlocks.length > 0) {
        // Generate slots from ALL blocks for the selected day
        const allSlotsFromAllBlocks: string[] = [];

        dayAvailabilityBlocks.forEach((block: any) => {
          const blockSlots = generateTimeSlots(block.start_time, block.end_time);
          allSlotsFromAllBlocks.push(...blockSlots);
        });

        // Remove duplicates and sort
        const uniqueSlots = Array.from(new Set(allSlotsFromAllBlocks)).sort();

        // Filter slots based on:
        // 1. If duration is selected, the slot must have enough time for the selected duration
        // 2. The slot must not conflict with existing bookings (if duration is selected)
        const slots = uniqueSlots.filter(slot => {
          const slotStart = (() => {
            const [h, m] = slot.split(':').map(Number);
            return h * 60 + m;
          })();

          // If duration is selected, check if this slot can accommodate it
          const totalDurationMinutes = bookingForm.duration * 60;
          if (bookingForm.duration > 0) {
            // Check if this slot fits within any block and has enough time for the duration
            const slotEnd = slotStart + totalDurationMinutes;
            const fitsInAnyBlock = dayAvailabilityBlocks.some((block: any) => {
              const blockStart = (() => {
                const [h, m] = block.start_time.split(':').map(Number);
                return h * 60 + m;
              })();
              const blockEnd = (() => {
                const [h, m] = block.end_time.split(':').map(Number);
                return h * 60 + m;
              })();

              // Slot must start within the block and end before or at the block end
              return slotStart >= blockStart && slotEnd <= blockEnd;
            });

            if (!fitsInAnyBlock) {
              return false; // Not enough time in any block
            }

            // Check if this slot conflicts with existing bookings
            return isTimeSlotAvailable(slot, bookingForm.duration, existingBookings);
          }

          // If no duration selected, show all slots (they'll be filtered when duration is selected)
          return true;
        });

        const sortedSlots = slots.sort();
        setAvailableTimeSlots(sortedSlots);
        if (bookingForm.time && !sortedSlots.includes(bookingForm.time)) {
          setBookingForm(prev => ({ ...prev, time: '' }));
        }
      } else {
        setAvailableTimeSlots([]);
        setBookingForm(prev => ({ ...prev, time: '' }));
      }
    } else {
      // If no date selected, clear time slots
      setAvailableTimeSlots([]);
      if (bookingForm.time) {
        setBookingForm(prev => ({ ...prev, time: '' }));
      }
    }
  }, [bookingForm.date, bookingForm.duration, selectedTutorProfile?.availability, bookingForm.time, existingBookings]);

  // Recompute allowed durations whenever the selected time or date or availability changes
  // Now also considers existing bookings
  useEffect(() => {
    const computeAllowedDurations = () => {
      setAllowedDurations([]);
      if (!selectedTutorProfile?.availability || !bookingForm.date) return;

      const date = new Date(bookingForm.date);
      const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' });
      const dayAvailabilityBlocks = selectedTutorProfile.availability.filter(
        (a: any) => a.day_of_week.toLowerCase() === dayOfWeek.toLowerCase()
      );

      if (dayAvailabilityBlocks.length === 0) return;

      const parseTimeToMinutes = (time: string): number => {
        const [h, m] = time.split(':').map(Number);
        return h * 60 + m;
      };

      let maxMinutes = 0;

      if (bookingForm.time) {
        // Find the block that contains the selected time
        const selectedTimeMinutes = parseTimeToMinutes(bookingForm.time);
        const relevantBlock = dayAvailabilityBlocks.find((block: any) => {
          const blockStart = parseTimeToMinutes(block.start_time);
          const blockEnd = parseTimeToMinutes(block.end_time);
          return selectedTimeMinutes >= blockStart && selectedTimeMinutes < blockEnd;
        });

        if (relevantBlock) {
          const blockEnd = parseTimeToMinutes(relevantBlock.end_time);
          maxMinutes = blockEnd - selectedTimeMinutes;

          // Check existing bookings to find the earliest conflict
          for (const booking of existingBookings) {
            const bookingStart = parseTimeToMinutes(booking.time);
            const bookingEnd = bookingStart + (booking.duration * 60);

            // If booking starts after selected time, it limits available duration
            if (bookingStart > selectedTimeMinutes && bookingStart < blockEnd) {
              const availableUntilBooking = bookingStart - selectedTimeMinutes;
              if (availableUntilBooking < maxMinutes) {
                maxMinutes = availableUntilBooking;
              }
            }
          }
        }
      } else {
        // If no time is selected, find the longest available period considering bookings
        dayAvailabilityBlocks.forEach((block: any) => {
          const blockStart = parseTimeToMinutes(block.start_time);
          const blockEnd = parseTimeToMinutes(block.end_time);
          const blockMinutes = blockEnd - blockStart;

          // Find the longest continuous period in this block (considering bookings)
          let longestPeriod = blockMinutes;

          // Check if any booking affects this block
          for (const booking of existingBookings) {
            const bookingStart = parseTimeToMinutes(booking.time);
            const bookingEnd = bookingStart + (booking.duration * 60);

            // If booking overlaps with this block, calculate available periods
            if (bookingStart < blockEnd && bookingEnd > blockStart) {
              // Period before booking
              const periodBefore = bookingStart > blockStart ? bookingStart - blockStart : 0;
              // Period after booking
              const periodAfter = bookingEnd < blockEnd ? blockEnd - bookingEnd : 0;

              const maxPeriod = Math.max(periodBefore, periodAfter);
              if (maxPeriod < longestPeriod) {
                longestPeriod = maxPeriod;
              }
            }
          }

          if (longestPeriod > maxMinutes) {
            maxMinutes = longestPeriod;
          }
        });
      }

      // Store max allowed minutes for validation
      setMaxAllowedMinutes(maxMinutes);

      // Generate allowed durations in hours with 0.5 increments (30-minute increments)
      const candidates: number[] = [];
      const minDurationHours = 0.5; // Minimum 30 minutes (0.5 hours)
      const maxDurationHours = maxMinutes / 60;
      const step = 0.5; // 30-minute increments (0.5 hours)

      for (let hours = minDurationHours; hours <= maxDurationHours; hours += step) {
        candidates.push(hours);
      }

      setAllowedDurations(candidates);

      // If current duration exceeds max, reset to a valid value
      const currentDurationHours = bookingForm.duration || 0;
      if (maxMinutes > 0 && (currentDurationHours * 60 > maxMinutes || currentDurationHours < minDurationHours)) {
        // Set to minimum duration if available
        const validDuration = Math.max(minDurationHours, Math.min(maxDurationHours, currentDurationHours));
        setBookingForm(prev => ({ ...prev, duration: validDuration }));
      }
    };

    computeAllowedDurations();
  }, [bookingForm.time, bookingForm.date, selectedTutorProfile?.availability, existingBookings]);

  // When the booking form is shown, proactively mark required fields as errors so
  // the user sees which fields need input even before pressing Submit.
  useEffect(() => {
    if (!showBookingForm) return;
    const errs: any = {};
    if (!bookingForm.subject) errs.subject = 'Subject is required';
    if (!bookingForm.date) errs.date = 'Date is required';
    if (!bookingForm.time) errs.time = 'Time is required';
    // For duration, only show an error if a duration has been selected but it
    // doesn't fit within allowed durations. Do not proactively show 'required' here.
    const totalMinutes = bookingForm.duration * 60;
    if (bookingForm.duration > 0 && maxAllowedMinutes > 0 && totalMinutes > maxAllowedMinutes) {
      errs.duration = 'Selected duration does not fit within the tutor\'s availability for the chosen date/time';
    }

    setBookingErrors(prev => ({ ...prev, ...errs }));
    // Only run when the form is revealed or when availability-derived allowedDurations change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showBookingForm, allowedDurations]);

  // Keep the duration error in sync: if the user selects a duration that exceeds availability
  // add the error; otherwise remove it.
  useEffect(() => {
    if (!showBookingForm) return;
    setBookingErrors(prev => {
      const p = { ...prev } as any;
      const totalMinutes = bookingForm.duration * 60;
      if (bookingForm.duration > 0) {
        if (maxAllowedMinutes > 0 && totalMinutes > maxAllowedMinutes) {
          p.duration = 'Selected duration does not fit within the tutor\'s availability for the chosen date/time';
        } else {
          delete p.duration;
        }
      } else {
        // If no duration selected, don't show a duration error here (we avoid proactive required)
        delete p.duration;
      }
      return p;
    });
  }, [bookingForm.duration, maxAllowedMinutes, showBookingForm]);

  const generateTimeSlots = (startTime: string, endTime: string): string[] => {
    const slots: string[] = [];

    const parseToMinutes = (t: string) => {
      if (!t) return NaN;
      const parts = t.split(':');
      const h = parseInt(parts[0], 10) || 0;
      const m = parseInt(parts[1], 10) || 0;
      return h * 60 + m;
    };

    const formatFromMinutes = (mins: number) => {
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };

    const startMin = parseToMinutes(startTime);
    const endMin = parseToMinutes(endTime);
    if (isNaN(startMin) || isNaN(endMin)) {
      console.error('Invalid time format:', { startTime, endTime });
      return slots;
    }
    if (endMin <= startMin) {
      console.error('End time must be after start time:', { startTime, endTime });
      return slots;
    }

    const now = new Date();
    const isToday = bookingForm.date === now.toISOString().split('T')[0];
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    try {
      // Generate slots in 30-minute intervals, including up to the end time
      // Use <= instead of < to include the end time (e.g., 17:00 if availability ends at 17:00)
      for (let m = startMin; m <= endMin; m += 30) {
        // For today's slots, only include future times (with 30 min buffer)
        if (!isToday || (m > currentMinutes + 30)) {
          slots.push(formatFromMinutes(m));
        }
      }
    } catch (error) {
      console.error('Error generating time slots:', error);
    }

    return slots;
  };

  // Given a weekday name like 'Monday', return the next calendar date (YYYY-MM-DD)
  const nextDateForWeekday = (
    weekdayName: string,
    slots: Array<{ start_time: string; end_time: string }> = [],
    fromDate = new Date()
  ): string => {
    const names = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const target = names.indexOf(String(weekdayName).toLowerCase());
    if (target === -1) return '';

    const baseDate = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
    const todayIndex = baseDate.getDay();

    if (target === todayIndex && slots.length > 0) {
      const nowMinutes = fromDate.getHours() * 60 + fromDate.getMinutes();
      const hasUpcomingSlot = slots.some(slot => {
        const [startHour, startMinute] = (slot.start_time || '00:00').split(':').map(Number);
        const slotStartMinutes = startHour * 60 + (startMinute || 0);
        return slotStartMinutes > nowMinutes;
      });
      if (hasUpcomingSlot) {
        return baseDate.toISOString().split('T')[0];
      }
    }

    let delta = target - todayIndex;
    if (delta <= 0) delta += 7;
    const result = new Date(baseDate.getTime() + delta * 24 * 60 * 60 * 1000);
    return result.toISOString().split('T')[0];
  };

  // Calculate average rating per subject for the selected tutor
  const subjectRatings = useMemo(() => {
    if (!tutorBookingRequests || tutorBookingRequests.length === 0) {
      return {};
    }

    const ratingsBySubject: Record<string, number[]> = {};

    tutorBookingRequests.forEach((booking: any) => {
      if (booking.tutee_rating && booking.tutee_rating > 0 && booking.subject) {
        const subject = String(booking.subject).trim();
        if (!ratingsBySubject[subject]) {
          ratingsBySubject[subject] = [];
        }
        ratingsBySubject[subject].push(Number(booking.tutee_rating));
      }
    });

    const averages: Record<string, { average: number; count: number }> = {};
    Object.entries(ratingsBySubject).forEach(([subject, ratings]) => {
      const sum = ratings.reduce((acc, rating) => acc + rating, 0);
      const average = sum / ratings.length;
      averages[subject] = {
        average: average,
        count: ratings.length
      };
    });

    return averages;
  }, [tutorBookingRequests]);

  // Calculate overall average rating from subject averages
  const overallAverageRating = useMemo(() => {
    const subjectRatingValues = Object.values(subjectRatings);
    if (subjectRatingValues.length === 0) {
      return null;
    }

    // Calculate weighted average based on number of ratings per subject
    let totalWeightedSum = 0;
    let totalRatings = 0;

    subjectRatingValues.forEach(({ average, count }) => {
      totalWeightedSum += average * count;
      totalRatings += count;
    });

    return totalRatings > 0 ? totalWeightedSum / totalRatings : null;
  }, [subjectRatings]);

  // Filter and search tutors client-side by name, subject, or university
  const filteredTutors = useMemo(() => {
    const q = (searchQuery || '').trim().toLowerCase();
    let list = tutors.slice();

    if (q) {
      list = list.filter(t => {
        const name = (t.name || '').toLowerCase();
        if (name.includes(q)) return true;

        // check subjects if profile is available on this list item
        const subjects: string[] = (t as any).profile?.subjects || (t as any).tutor_profile?.subjects || [];
        if (Array.isArray(subjects)) {
          for (const s of subjects) {
            if (String(s).toLowerCase().includes(q)) return true;
          }
        }

        // check university name (full name)
        const universityName = (t.university_name || '').toLowerCase();
        if (universityName.includes(q)) return true;

        // check university from multiple possible locations (user, profile, tutor_profile)
        const university = (t as any).university || (t as any).profile?.university || (t as any).tutor_profile?.university;
        if (university) {
          const uniName = (university.name || university.university_name || university.display_name || '').toLowerCase();
          const uniAcronym = (university.acronym || '').toLowerCase();
          // Check if query matches full name or acronym (exact match or contains)
          if (uniName.includes(q) || uniAcronym.includes(q)) return true;
        }

        return false;
      });
    }

    // Apply price filter
    if (priceFilter !== 'all') {
      list = list.filter(t => {
        const rate = t.profile?.session_rate_per_hour;
        if (!rate) return false; // Exclude tutors without pricing
        const price = Number(rate);
        switch (priceFilter) {
          case 'under_300':
            return price < 300;
          case '300_500':
            return price >= 300 && price < 500;
          case '500_700':
            return price >= 500 && price < 700;
          case '700_plus':
            return price >= 700;
          default:
            return true;
        }
      });
    }

    // Apply rating filter
    if (ratingFilter !== 'all') {
      list = list.filter(t => {
        const rating = tutorRatings[t.user_id]?.average || 0;
        const hasRatings = tutorRatings[t.user_id]?.totalRatings > 0;
        switch (ratingFilter) {
          case '4_plus':
            return rating >= 4;
          case '3':
            return rating >= 3 && rating < 4;
          case '2':
            return rating >= 2 && rating < 3;
          case '1':
            return rating >= 1 && rating < 2;
          case 'no_rate':
            return !hasRatings || rating === 0;
          default:
            return true;
        }
      });
    }

    // Apply university filter
    if (universityFilter !== 'all') {
      list = list.filter(t => {
        const tutorUniversityId = t.university_id ||
          t.university?.university_id ||
          t.profile?.university?.university_id ||
          t.tutor_profile?.university_id ||
          (t as any).tutor_profile?.university?.university_id;
        return tutorUniversityId === universityFilter;
      });
    }

    // Apply course filter
    if (courseFilter !== 'all') {
      list = list.filter(t => {
        const tutorCourseId = t.course_id ||
          t.course?.course_id ||
          t.profile?.course?.course_id ||
          t.tutor_profile?.course_id ||
          (t as any).tutor_profile?.course?.course_id;
        return tutorCourseId === courseFilter;
      });
    }

    // Apply filter option
    if (filterOption === 'has_subjects') {
      list = list.filter(t => {
        const subjects: string[] = (t as any).profile?.subjects || (t as any).tutor_profile?.subjects || [];
        return Array.isArray(subjects) && subjects.length > 0;
      });
    } else if (filterOption === 'top_rated') {
      list = list.sort((a, b) => (tutorRatings[b.user_id]?.average || 0) - (tutorRatings[a.user_id]?.average || 0));
    } else if (filterOption === 'with_reviews') {
      list = list.filter(t => (tutorRatings[t.user_id]?.totalRatings || 0) > 0).sort((a, b) => (tutorRatings[b.user_id]?.average || 0) - (tutorRatings[a.user_id]?.average || 0));
    } else if (filterOption === 'newest') {
      list = list.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    }

    return list;
  }, [tutors, searchQuery, filterOption, priceFilter, ratingFilter, universityFilter, courseFilter, tutorRatings]);

  const handleBook = () => {
    const isValid = validateBookingForm();
    if (isValid) {
      setConfirmationOpen(true);
    }
  };

  const handleCancelBooking = () => {
    setCancelConfirmationOpen(true);
  };

  const handleConfirmBooking = async () => {
    if (!selectedTutorProfile?.user?.tutor_profile) {
      console.error('handleConfirmBooking: No tutor profile found');
      toast.error('Tutor profile not found. Please try again.');
      return;
    }

    setBookingLoading(true);
    try {
      const tutorId = selectedTutorProfile.user.tutor_profile.tutor_id;
      console.log('Creating booking request:', {
        tutorId,
        bookingForm,
        tutorName: selectedTutorProfile.user.name
      });

      const response = await apiClient.post(`/tutors/${tutorId}/booking-requests`, bookingForm);

      console.log('Booking request response:', response.data);

      // Show success toast at center
      toast.success('Booking request submitted successfully!', {
        position: 'top-center',
        autoClose: 3000,
      });

      // Close modals after a brief delay to show toast
      setTimeout(() => {
        setIsProfileOpen(false);
        setConfirmationOpen(false);
        setBookingForm({
          subject: '',
          date: '',
          time: '',
          duration: 1,
          student_notes: ''
        });
      }, 100);
    } catch (err: any) {
      console.error('Booking request failed:', {
        error: err,
        response: err?.response,
        data: err?.response?.data,
        status: err?.response?.status,
        message: err?.message
      });

      const serverMsg = err?.response?.data?.message || err?.message || 'Failed to send booking request. Please try again later.';
      setBookingErrorModalMessage(serverMsg);
      setBookingErrorModalOpen(true);
      toast.error(serverMsg, {
        position: 'top-center',
      });
    } finally {
      setBookingLoading(false);
    }
  };

  const openProfile = async (tutorUser: TutorListItem) => {
    if (!tutorUser.tutor_profile) return;
    setProfileLoading(true);
    setIsProfileOpen(true);
    try {
      const tutorId = tutorUser.tutor_profile.tutor_id;
      const [profileRes, availRes, bookingsRes, documentsRes] = await Promise.all([
        apiClient.get(`/tutors/${tutorId}/profile`),
        apiClient.get(`/tutors/${tutorId}/availability`),
        apiClient.get(`/tutors/${tutorId}/booking-requests`).catch(() => ({ data: [] })),
        apiClient.get(`/tutors/${tutorId}/documents`).catch(() => ({ data: [] })),
      ]);
      setSelectedTutorProfile({
        user: tutorUser,
        profile: profileRes.data,
        availability: availRes.data,
      });
      // Extract booking requests from response
      let bookings: any[] = [];
      if (Array.isArray(bookingsRes.data)) {
        bookings = bookingsRes.data;
      } else if (Array.isArray(bookingsRes.data?.data)) {
        bookings = bookingsRes.data.data;
      } else if (Array.isArray(bookingsRes.data?.bookings)) {
        bookings = bookingsRes.data.bookings;
      }
      setTutorBookingRequests(bookings);

      // Extract documents from response - ensure we get all documents
      let documents: any[] = [];
      if (Array.isArray(documentsRes.data)) {
        documents = documentsRes.data;
      } else if (Array.isArray(documentsRes.data?.data)) {
        documents = documentsRes.data.data;
      } else if (documentsRes.data && typeof documentsRes.data === 'object') {
        // Try to extract documents from nested structure
        const data = documentsRes.data;
        if (data.documents && Array.isArray(data.documents)) {
          documents = data.documents;
        } else if (data.docs && Array.isArray(data.docs)) {
          documents = data.docs;
        }
      }
      console.log('Fetched tutor documents:', documents);
      setTutorDocuments(documents);
    } catch (err) {
      console.error('Failed to load tutor profile', err);
      setSelectedTutorProfile({ user: tutorUser, profile: null, availability: [] });
      setTutorBookingRequests([]);
      setTutorDocuments([]);
    } finally {
      setProfileLoading(false);
    }
  };

  const validateBookingForm = () => {
    const errors: any = {};

    // Subject validation — must be one of the tutor's approved subjects
    const tutorSubjects: string[] = (selectedTutorProfile?.profile?.subjects || []).map((s: any) => String(s).trim());
    if (!bookingForm.subject) {
      errors.subject = 'Subject is required';
    } else if (!tutorSubjects.includes(String(bookingForm.subject).trim())) {
      errors.subject = 'Please select a subject from the tutor\'s approved subjects';
    }

    // Date validation
    if (!bookingForm.date) {
      errors.date = 'Date is required';
    } else {
      const selectedDate = new Date(bookingForm.date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (isNaN(selectedDate.getTime())) {
        errors.date = 'Invalid date format';
      } else if (selectedDate < today) {
        errors.date = 'Cannot book sessions in the past';
      } else if (selectedDate > new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000)) {
        errors.date = 'Cannot book more than 90 days in advance';
      }
    }

    // Time validation
    if (!bookingForm.time) {
      errors.time = 'Time is required';
    } else if (!availableTimeSlots.includes(bookingForm.time)) {
      errors.time = 'Selected time is not available';
    }

    // Duration validation — must fit within available time
    if (!bookingForm.duration || bookingForm.duration === 0) {
      errors.duration = 'Duration is required';
    } else if (bookingForm.duration < 0.5) {
      errors.duration = 'Minimum duration is 30 minutes (0.5 hours)';
    } else if (maxAllowedMinutes > 0 && bookingForm.duration * 60 > maxAllowedMinutes) {
      errors.duration = 'Selected duration does not fit within the tutor\'s availability for the chosen date/time';
    }

    // Notes validation (optional)
    if (bookingForm.student_notes && bookingForm.student_notes.length > 500) {
      errors.student_notes = 'Notes cannot exceed 500 characters';
    }

    setBookingErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const fetchMyBookings = async () => {
    try {
      setMyBookingsLoading(true);
      setMyBookingsError(null);
      const res = await apiClient.get('/users/me/bookings');
      setMyBookings(res.data || []);
      setShowMyBookings(true);
    } catch (err) {
      console.error('Failed to fetch my bookings', err);
      setMyBookingsError('Failed to load your bookings.');
    } finally {
      setMyBookingsLoading(false);
    }
  };

  return (
    // <div className="relative min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 text-slate-800 overflow-hidden">
    <div className="space-y-4 max-w-5xl mx-auto pb-10 bg-gradient-to-br from-slate-50 via-white to-slate-100 text-slate-800 overflow-hidden">
      {/* <div className="absolute -top-24 -left-10 h-72 w-72 bg-sky-100 blur-3xl opacity-70 pointer-events-none" />
      <div className="absolute top-32 -right-16 h-80 w-80 bg-indigo-100 blur-[120px] opacity-70 pointer-events-none" /> */}
      <div className="relative max-w-6xl mx-auto px-2 sm:px-4 lg:px-0 pt-1 sm:pt-1.5 md:pt-2 pb-4 sm:pb-6 md:pb-10 space-y-3 sm:space-y-4 md:space-y-6">
        {/* <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl sm:rounded-2xl p-3 sm:p-4 md:p-6 text-white shadow-lg -mx-2 sm:-mx-3 md:mx-0">
          <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
            <Search className="h-5 w-5 sm:h-6 sm:w-6 md:h-8 md:w-8 flex-shrink-0" />
            <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-white">Find & Book Tutors</h1>
          </div>
          <p className="text-xs sm:text-sm md:text-base lg:text-lg text-blue-100/90 leading-relaxed">
            Discover verified tutors, explore profiles, and secure your ideal session.
          </p>
        </div> */}
        <div className="bg-sky-600 rounded-2xl md:rounded-3xl px-4 py-3 md:px-5 md:py-4 shadow-sm border border-sky-500 flex items-center gap-4">
          <div className="flex items-center justify-center shrink-0">
            <Info className="h-8 w-8 text-white" />
          </div>
          <p className="text-lg md:text-xl font-bold text-white tracking-tight">
            Discover verified tutors, explore profiles, and secure your ideal session.
          </p>
        </div>

        {/* Search and Filters */}
        <div className="bg-white/80 backdrop-blur-sm border border-slate-100 shadow-sm rounded-2xl p-3 sm:p-4 md:p-5 space-y-3 sm:space-y-4">
          {/* First Row: Search Input and Other Filters */}
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3 sm:gap-4">
            <div className="w-full md:w-2/3">
              <label htmlFor="tutor-search" className="block text-sm font-semibold text-slate-700 mb-2">
                Search by name, subject, or university
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 sm:h-5 sm:w-5 text-slate-400" />
                </div>
                <input
                  id="tutor-search"
                  placeholder="Search For..."
                  value={searchDraft}
                  onChange={e => setSearchDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      setSearchQuery(searchDraft.trim());
                    }
                  }}
                  className="w-full bg-white border border-slate-200 rounded-2xl pl-10 pr-12 py-2 sm:py-2.5 text-sm md:text-base shadow-sm focus:border-sky-400 focus:ring-2 focus:ring-sky-300 transition duration-150 placeholder:text-slate-400 h-[42px] sm:h-[44px]"
                />
                {searchDraft ? (
                  <button
                    type="button"
                    aria-label="Clear search"
                    onClick={() => { setSearchDraft(''); setSearchQuery(''); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center justify-center h-8 w-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition touch-manipulation"
                    style={{ WebkitTapHighlightColor: 'transparent' }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 sm:h-4 sm:w-4">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                ) : (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] sm:text-xs text-slate-400 hidden sm:block">Press Enter</div>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3 w-full md:w-auto">
              <div className="w-full sm:w-auto">
                <label htmlFor="filter-sort" className="block text-sm font-semibold text-slate-700 mb-2">
                  Sort
                </label>
                <select
                  id="filter-sort"
                  value={filterOption}
                  onChange={e => setFilterOption(e.target.value as any)}
                  className="border border-slate-200 rounded-2xl px-3 py-2 sm:py-2.5 text-sm md:text-base focus:border-sky-400 focus:ring-2 focus:ring-sky-300 bg-white shadow-sm w-full sm:w-48 transition duration-150 h-[42px] sm:h-[44px]"
                >
                  <option value="all">All</option>
                  <option value="has_subjects">Has subjects</option>
                  <option value="top_rated">Top rated</option>
                  <option value="with_reviews">With reviews</option>
                  <option value="newest">Newest</option>
                </select>
              </div>
              <div className="w-full sm:w-auto">
                <label htmlFor="filter-price" className="block text-sm font-semibold text-slate-700 mb-2">
                  Price
                </label>
                <select
                  id="filter-price"
                  value={priceFilter}
                  onChange={e => setPriceFilter(e.target.value as any)}
                  className="border border-slate-200 rounded-2xl px-3 py-2 sm:py-2.5 text-sm md:text-base focus:border-sky-400 focus:ring-2 focus:ring-sky-300 bg-white shadow-sm w-full sm:w-40 transition duration-150 h-[42px] sm:h-[44px]"
                >
                  <option value="all">All prices</option>
                  <option value="under_300">Under ₱300/hr</option>
                  <option value="300_500">₱300-₱500/hr</option>
                  <option value="500_700">₱500-₱700/hr</option>
                  <option value="700_plus">₱700+/hr</option>
                </select>
              </div>
              <div className="w-full sm:w-auto">
                <label htmlFor="filter-rating" className="block text-sm font-semibold text-slate-700 mb-2">
                  Rating
                </label>
                <select
                  id="filter-rating"
                  value={ratingFilter}
                  onChange={e => setRatingFilter(e.target.value as any)}
                  className="border border-slate-200 rounded-2xl px-3 py-2 sm:py-2.5 text-sm md:text-base focus:border-sky-400 focus:ring-2 focus:ring-sky-300 bg-white shadow-sm w-full sm:w-36 transition duration-150 h-[42px] sm:h-[44px]"
                >
                  <option value="all">All ratings</option>
                  <option value="4_plus">4+ ⭐</option>
                  <option value="3">3 ⭐</option>
                  <option value="2">2 ⭐</option>
                  <option value="1">1 ⭐</option>
                  <option value="no_rate">No rate</option>
                </select>
              </div>
            </div>
          </div>

          {/* Second Row: University and Course Filters */}
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3 w-full">
            <div className="w-full sm:w-auto">
              <label htmlFor="filter-university" className="block text-sm font-semibold text-slate-700 mb-2">
                University
              </label>
              <select
                id="filter-university"
                value={universityFilter}
                onChange={e => setUniversityFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                className="border border-slate-200 rounded-2xl px-3 py-2 sm:py-2.5 text-sm md:text-base focus:border-sky-400 focus:ring-2 focus:ring-sky-300 bg-white shadow-sm w-full sm:w-80 md:w-96 lg:w-[28rem] transition duration-150 h-[42px] sm:h-[44px]"
              >
                <option value="all">All universities</option>
                {universities.map(uni => (
                  <option key={uni.university_id} value={uni.university_id}>
                    {uni.acronym ? `${uni.acronym} - ${uni.name || uni.university_name || uni.display_name}` : (uni.name || uni.university_name || uni.display_name)}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-full sm:w-auto">
              <label htmlFor="filter-course" className="block text-sm font-semibold text-slate-700 mb-2">
                Course
              </label>
              <select
                id="filter-course"
                value={courseFilter}
                onChange={e => setCourseFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                disabled={universityFilter === 'all'}
                className="border border-slate-200 rounded-2xl px-3 py-2 sm:py-2.5 text-sm md:text-base focus:border-sky-400 focus:ring-2 focus:ring-sky-300 bg-white shadow-sm w-full sm:w-80 md:w-96 lg:w-[28rem] transition duration-150 h-[42px] sm:h-[44px] disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed"
              >
                <option value="all">
                  {universityFilter === 'all' ? 'Select university first' : 'All courses'}
                </option>
                {universityFilter !== 'all' && courses
                  .filter(c => c.university_id === universityFilter)
                  .map(course => (
                    <option key={course.course_id || course.id} value={course.course_id || course.id}>
                      {course.acronym ? `${course.acronym} - ${course.course_name || course.name}` : (course.course_name || course.name)}
                    </option>
                  ))}
              </select>
            </div>
          </div>
        </div>

        {/* My Bookings */}
        {showMyBookings && (
          <div className="bg-white/90 backdrop-blur rounded-2xl shadow-lg border border-slate-100 p-4 sm:p-5 md:p-6">
            <div className="flex items-center justify-between gap-2 mb-4">
              <h2 className="text-lg sm:text-xl font-semibold text-slate-900">My Bookings</h2>
              <span className="text-xs sm:text-sm text-slate-500">{myBookings.length} total</span>
            </div>
            {myBookingsLoading ? (
              <div className="text-xs sm:text-sm md:text-base text-slate-600">Loading your bookings...</div>
            ) : myBookingsError ? (
              <div className="text-xs sm:text-sm md:text-base text-red-500">{myBookingsError}</div>
            ) : myBookings.length === 0 ? (
              <div className="text-xs sm:text-sm md:text-base text-slate-600">You have no bookings yet.</div>
            ) : (
              <div className="mt-2 sm:mt-3 space-y-2 sm:space-y-3">
                {myBookings.map(b => (
                  <div key={b.id} className="border border-slate-200 rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:border-sky-200 hover:shadow-md transition">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-xs sm:text-sm md:text-base text-slate-800 break-words">{b.subject} with {b.tutor?.user?.name || 'Tutor'}</div>
                      <div className="text-[10px] sm:text-xs md:text-sm text-slate-600 mt-1">{new Date(b.date).toLocaleDateString()} · {b.time} · {b.duration}h</div>
                      {b.student_notes && <div className="text-[10px] sm:text-xs md:text-sm text-slate-500 mt-1 break-words">Notes: {b.student_notes}</div>}
                    </div>
                    <div className="text-xs sm:text-sm md:text-base font-semibold px-3 py-1 rounded-full bg-sky-50 text-sky-700 whitespace-nowrap capitalize">{b.status}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}


        <div>
          {loading ? (
            <div className="text-slate-600">Loading tutors...</div>
          ) : error ? (
            <div className="text-red-500">{error}</div>
          ) : tutors.length === 0 ? (
            <div className="text-slate-600">No tutors found.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
              {filteredTutors.map(t => {
                const profileSubjects: string[] = (t as any).profile?.subjects || (t as any).tutor_profile?.subjects || [];
                return (
                  <div key={t.user_id} className="group relative bg-white border border-slate-200 rounded-2xl p-4 sm:p-4 shadow-sm hover:shadow-xl hover:border-sky-200 transition-all duration-200 flex flex-col h-full">
                    <div className="absolute inset-x-0 top-0 h-1 rounded-t-2xl bg-gradient-to-r from-sky-400 via-indigo-400 to-sky-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                    {/* Mobile: Centered Layout */}
                    <div className="flex flex-col items-center text-center sm:hidden flex-1">
                      {/* Profile Picture */}
                      <div className="relative mb-3">
                        <div className="h-20 w-20 rounded-full ring-4 ring-sky-100 shadow-lg overflow-hidden bg-gradient-to-br from-sky-50 to-indigo-50">
                          <img
                            src={getFileUrl(t.profile_image_url || '')}
                            alt={t.name}
                            className="w-full h-full object-cover"
                            onError={(e) => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(t.name)}`; }}
                          />
                        </div>
                        {tutorOnlineStatus[t.user_id] && (
                          <div className="absolute -bottom-1 -right-1 h-5 w-5 bg-green-500 rounded-full border-2 border-white shadow-md"></div>
                        )}
                      </div>

                      {/* Name */}
                      <h3 className="font-bold text-base text-slate-800 mb-1">{t.name}</h3>

                      {/* University */}
                      <div className="flex items-center justify-center gap-1.5 mb-3">
                        <svg className="w-3.5 h-3.5 text-sky-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0v-5.5a2.5 2.5 0 015 0V21m-5 0h5m-5 0v-5.5a2.5 2.5 0 015 0V21" />
                        </svg>
                        <span className="text-xs text-slate-600">{t.university_name || 'N/A'}</span>
                      </div>

                      {/* Ratings */}
                      <div className="flex items-center justify-center gap-1.5 mb-3">
                        {(() => {
                          const tutorRating = tutorRatings[t.user_id];
                          const rating = tutorRating?.average || 0;
                          const totalRatings = tutorRating?.totalRatings || 0;
                          return (
                            <>
                              <div className="flex items-center">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <svg
                                    key={star}
                                    className={`w-4 h-4 ${star <= Math.floor(rating) ? 'text-yellow-400 fill-current' : 'text-gray-300'}`}
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                  >
                                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                  </svg>
                                ))}
                              </div>
                              <span className="text-xs font-semibold text-slate-700">
                                {rating > 0 ? rating.toFixed(1) : 'No ratings'}
                                {totalRatings > 0 ? ` (${totalRatings})` : ''}
                              </span>
                            </>
                          );
                        })()}
                      </div>

                      {/* Subjects */}
                      {profileSubjects.length > 0 && (
                        <div className="flex flex-wrap items-center justify-center gap-1.5 mb-3">
                          {profileSubjects.slice(0, 3).map((subject: string, idx: number) => (
                            <span key={idx} className="text-xs text-sky-700 bg-gradient-to-r from-sky-50 to-indigo-50 border border-sky-200 px-3 py-1 rounded-full font-medium shadow-sm">
                              {subject}
                            </span>
                          ))}
                          {profileSubjects.length > 3 && (
                            <span className="text-xs text-indigo-700 bg-gradient-to-r from-indigo-50 to-sky-50 border border-indigo-200 px-3 py-1 rounded-full font-semibold shadow-sm">
                              +{profileSubjects.length - 3}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Session Rate */}
                      {t.profile?.session_rate_per_hour ? (
                        <div className="flex items-center justify-center gap-2 mb-3 px-4 py-2 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl border border-emerald-200">
                          <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="text-sm font-bold text-emerald-700">
                            ₱{Number(t.profile.session_rate_per_hour).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}/hr
                          </span>
                        </div>
                      ) : (
                        <div className="text-xs text-slate-400 italic mb-3">Price not set</div>
                      )}
                    </div>

                    {/* Desktop: Original Layout */}
                    <div className="hidden sm:flex items-start gap-3 flex-1">
                      <div className="relative flex-shrink-0">
                        <img
                          src={getFileUrl(t.profile_image_url || '')}
                          alt={t.name}
                          className="h-16 w-16 rounded-full object-cover flex-shrink-0 ring-4 ring-slate-50 shadow-md"
                          onError={(e) => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(t.name)}`; }}
                        />
                        {tutorOnlineStatus[t.user_id] && (
                          <div className="absolute -bottom-0.5 -right-0.5 h-4 w-4 bg-green-500 rounded-full border-2 border-white shadow-md"></div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-xs sm:text-sm md:text-base text-slate-800 truncate">{t.name}</div>
                        <div className="text-[10px] sm:text-xs md:text-sm text-slate-500 truncate">{t.university_name || 'N/A'}</div>
                        <div className="mt-2 space-y-2">
                          {/* Ratings */}
                          <div className="flex items-center gap-1">
                            {(() => {
                              const tutorRating = tutorRatings[t.user_id];
                              const rating = tutorRating?.average || 0;
                              const totalRatings = tutorRating?.totalRatings || 0;
                              return (
                                <>
                                  <div className="flex items-center flex-shrink-0">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                      <svg
                                        key={star}
                                        className={`w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 ${star <= Math.floor(rating) ? 'text-yellow-400 fill-current' : 'text-gray-300'}`}
                                        fill="currentColor"
                                        viewBox="0 0 20 20"
                                      >
                                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                      </svg>
                                    ))}
                                  </div>
                                  <span className="text-[10px] sm:text-xs md:text-sm text-slate-600 truncate">
                                    {rating > 0 ? rating.toFixed(1) : 'No ratings'}
                                    {totalRatings > 0 ? ` (${totalRatings})` : ''}
                                  </span>
                                </>
                              );
                            })()}
                          </div>
                          {/* Subjects - below ratings */}
                          {profileSubjects.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1">
                              {profileSubjects.slice(0, 3).map((subject: string, idx: number) => (
                                <span key={idx} className="text-[10px] sm:text-xs text-sky-700 bg-sky-50 border border-sky-100 px-2 py-0.5 rounded-full whitespace-nowrap">
                                  {subject}
                                </span>
                              ))}
                              {profileSubjects.length > 3 && (
                                <span className="text-[10px] sm:text-xs text-sky-600 bg-sky-100 border border-sky-200 px-2 py-0.5 rounded-full font-medium">
                                  +{profileSubjects.length - 3}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        {/* Price display - ensure consistent height */}
                        <div className="mt-2 min-h-[20px] sm:min-h-[24px] flex items-center">
                          {t.profile?.session_rate_per_hour ? (
                            <div className="flex items-center gap-1.5">
                              <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span className="text-xs sm:text-sm md:text-base font-semibold text-emerald-700">
                                ₱{Number(t.profile.session_rate_per_hour).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}/hr
                              </span>
                            </div>
                          ) : (
                            <div className="text-[10px] sm:text-xs text-slate-400 italic">Price not set</div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center sm:items-start sm:justify-between gap-3 flex-shrink-0">
                      <div className="inline-flex items-center gap-2 text-xs sm:text-[11px] md:text-sm text-slate-600">
                        <span className="h-2 w-2 rounded-full bg-emerald-400" />
                        <span className="font-medium capitalize">{t.tutor_profile?.status || 'pending'}</span>
                      </div>
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <button
                          onClick={() => openProfile(t)}
                          className="px-4 sm:px-4 py-2.5 bg-gradient-to-r from-sky-600 to-indigo-600 text-white rounded-xl text-sm md:text-base font-semibold hover:shadow-lg transition-all w-full sm:w-auto touch-manipulation shadow-md hover:shadow-xl"
                          style={{ WebkitTapHighlightColor: 'transparent' }}
                        >
                          View Profile
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Profile Modal */}
        {isProfileOpen && (
          <Modal
            isOpen={true}
            onClose={() => { setIsProfileOpen(false); setShowBookingForm(false); setBookingForm({ subject: '', date: '', time: '', duration: 1, student_notes: '' }); }}
            title={""}
            maxWidth={showBookingForm ? "7xl" : "5xl"}
            className={`${showBookingForm ? 'w-full h-full sm:h-[90vh] flex flex-col' : 'md:max-w-[90vw] lg:max-w-5xl'}`}
            contentClassName={`${showBookingForm ? 'flex-1 overflow-y-auto' : ''}`}
            footer={
              <>
                {!showBookingForm ? (
                  <>
                    <button
                      onClick={() => setShowBookingForm(true)}
                      className="ml-2 px-6 py-2.5 rounded-lg text-white bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 font-medium shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Book Session
                    </button>
                    <button
                      onClick={handleMessageTutor}
                      disabled={messageLoading}
                      className="ml-2 px-6 py-2.5 rounded-lg text-white bg-gradient-to-r from-blue-500 to-sky-500 hover:from-blue-600 hover:to-sky-600 font-medium shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2"
                    >
                      {messageLoading ? (
                        <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                        </svg>
                      )}
                      Message
                    </button>
                    <button
                      onClick={() => { setIsProfileOpen(false); setShowBookingForm(false); setBookingForm({ subject: '', date: '', time: '', duration: 1, student_notes: '' }); }}
                      className="px-6 py-2.5 border-2 border-slate-300 rounded-lg hover:bg-slate-50 font-medium transition-colors"
                    >
                      Close
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        const ok = validateBookingForm();
                        if (!ok) {
                          toast.error('Please fix booking errors before submitting');
                          return;
                        }
                        setConfirmationOpen(true);
                      }}
                      disabled={bookingLoading}
                      className={`ml-2 px-6 py-2.5 rounded-lg text-white font-medium shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2 ${bookingLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700'}`}
                    >
                      {bookingLoading ? (
                        <>
                          <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Submitting…
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Submit Booking
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => { setShowBookingForm(false); setBookingForm({ subject: '', date: '', time: '', duration: 1, student_notes: '' }); }}
                      className="px-6 py-2.5 border-2 border-slate-300 rounded-lg hover:bg-slate-50 font-medium transition-colors"
                    >
                      Cancel
                    </button>
                  </>
                )}
              </>
            }
          >
            {profileLoading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <svg className="animate-spin h-12 w-12 text-indigo-600 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <div className="text-slate-600 font-medium">Loading profile...</div>
              </div>
            ) : (
              <div className={`${showBookingForm ? 'p-0 sm:p-0 lg:p-0' : 'p-4 sm:p-6 lg:p-6'}`}>
                <div className={`${showBookingForm ? 'px-4 sm:px-6 lg:px-6 py-4' : ''}`}>
                  <div className="space-y-4 sm:space-y-5 md:space-y-6 lg:space-y-6">
                    {/* Enhanced Header Section */}
                    <div className="relative rounded-xl sm:rounded-2xl lg:rounded-2xl overflow-hidden shadow-2xl">
                      <div className="bg-gradient-to-br from-sky-600 via-indigo-600 to-indigo-700 p-4 sm:p-6 md:p-7 lg:p-8 text-white relative overflow-hidden">
                        {/* Enhanced decorative background pattern */}
                        <div className="absolute inset-0 opacity-10">
                          <div className="absolute top-0 right-0 w-32 h-32 sm:w-48 sm:h-48 md:w-56 md:h-56 lg:w-64 lg:h-64 bg-white rounded-full -mr-16 sm:-mr-24 md:-mr-28 lg:-mr-32 -mt-16 sm:-mt-24 md:-mt-28 lg:-mt-32"></div>
                          <div className="absolute bottom-0 left-0 w-24 h-24 sm:w-36 sm:h-36 md:w-44 md:h-44 lg:w-52 lg:h-52 bg-white rounded-full -ml-12 sm:-ml-18 md:-ml-22 lg:-ml-26 -mb-12 sm:-mb-18 md:-mb-22 lg:-mb-26"></div>
                          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-40 h-40 sm:w-56 sm:h-56 md:w-72 md:h-72 lg:w-80 lg:h-80 bg-white rounded-full opacity-5"></div>
                        </div>

                        <div className="relative flex flex-col items-center gap-3 sm:gap-4 md:gap-5 lg:gap-6">
                          <div className="relative flex-shrink-0">
                            <div className="h-24 w-24 sm:h-28 sm:w-28 md:h-30 md:w-30 lg:h-32 lg:w-32 rounded-full ring-2 sm:ring-3 md:ring-4 ring-white/30 shadow-2xl overflow-hidden bg-white/10 backdrop-blur-sm">
                              <img
                                src={getFileUrl(selectedTutorProfile?.user?.profile_image_url || '')}
                                alt={selectedTutorProfile?.user?.name}
                                className="w-full h-full object-cover"
                                onError={(e) => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedTutorProfile?.user?.name || 'Tutor')}`; }}
                              />
                            </div>
                            {tutorOnlineStatus[selectedTutorProfile?.user?.user_id] && (
                              <div className="absolute -bottom-1 -right-1 sm:-bottom-1.5 sm:-right-1.5 md:-bottom-2 md:-right-2 h-5 w-5 sm:h-6 sm:w-6 md:h-7 md:w-7 bg-green-500 rounded-full border-2 sm:border-3 md:border-4 border-white shadow-lg"></div>
                            )}
                            {selectedTutorProfile?.profile?.is_verified && (
                              <div className={`absolute ${tutorOnlineStatus[selectedTutorProfile?.user?.user_id] ? '-bottom-1 -left-1 sm:-bottom-1.5 sm:-left-1.5 md:-bottom-2 md:-left-2' : '-bottom-1 -right-1 sm:-bottom-1.5 sm:-right-1.5 md:-bottom-2 md:-right-2'} bg-green-500 rounded-full p-1 sm:p-1.5 md:p-1.5 ring-2 sm:ring-3 md:ring-4 ring-white shadow-lg`}>
                                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col items-center w-full">
                            <h2 className="text-xl sm:text-2xl md:text-2xl lg:text-3xl font-bold leading-tight mb-2 text-center">{selectedTutorProfile?.user?.name}</h2>
                            <div className="flex items-center justify-center gap-1.5 sm:gap-2 text-white/90 mb-3 sm:mb-4">
                              <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0v-5.5a2.5 2.5 0 015 0V21m-5 0h5m-5 0v-5.5a2.5 2.5 0 015 0V21" />
                              </svg>
                              <span className="text-xs sm:text-sm font-medium">{selectedTutorProfile?.user?.university_name || 'N/A'}</span>
                            </div>
                            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
                              {overallAverageRating !== null && (
                                <div className="inline-flex items-center bg-white/20 backdrop-blur-sm text-white text-xs sm:text-sm rounded-full px-2.5 sm:px-3 md:px-4 py-1.5 sm:py-2 shadow-lg border border-white/20">
                                  <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-1.5 sm:mr-2 text-yellow-300 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                  </svg>
                                  <span className="font-bold text-sm sm:text-base md:text-lg">{overallAverageRating.toFixed(1)}</span>
                                  <span className="text-[10px] sm:text-xs opacity-90 ml-1.5 sm:ml-2">
                                    ({Object.values(subjectRatings).reduce((sum, sr) => sum + sr.count, 0)} {Object.values(subjectRatings).reduce((sum, sr) => sum + sr.count, 0) === 1 ? 'rating' : 'ratings'})
                                  </span>
                                </div>
                              )}
                              {selectedTutorProfile?.profile?.session_rate_per_hour && (
                                <div className="inline-flex items-center bg-white/20 backdrop-blur-sm text-white text-xs sm:text-sm rounded-full px-2.5 sm:px-3 md:px-4 py-1.5 sm:py-2 shadow-lg border border-white/20">
                                  <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-1.5 sm:mr-2 text-emerald-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  <span className="font-bold text-sm sm:text-base md:text-lg">
                                    ₱{Number(selectedTutorProfile.profile.session_rate_per_hour).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}/hr
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Content Sections - About and Subjects side by side, Availability below */}
                    {!showBookingForm && (
                      <div className="space-y-4 sm:space-y-5 md:space-y-5 lg:space-y-6">
                        {/* First Row: About and Subjects side by side */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 md:gap-5 lg:gap-6">
                          {/* About Section */}
                          <div className="bg-white rounded-lg sm:rounded-xl lg:rounded-xl p-4 sm:p-5 md:p-5 lg:p-6 shadow-lg border border-slate-200 hover:shadow-xl transition-shadow duration-300">
                            <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-3.5 md:mb-4">
                              <div className="p-2 sm:p-2.5 bg-gradient-to-br from-sky-100 to-sky-200 rounded-xl flex-shrink-0 shadow-md">
                                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                              </div>
                              <h3 className="text-lg sm:text-xl md:text-xl lg:text-xl font-bold text-slate-800">About</h3>
                            </div>
                            <p className="text-sm sm:text-base text-slate-700 leading-relaxed break-words">{selectedTutorProfile?.profile?.bio || 'No bio provided.'}</p>
                          </div>

                          {/* Subjects Section */}
                          <div className="bg-white rounded-lg sm:rounded-xl lg:rounded-xl p-4 sm:p-5 md:p-5 lg:p-6 shadow-lg border border-slate-200 hover:shadow-xl transition-shadow duration-300">
                            <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4 md:mb-4">
                              <div className="p-2 sm:p-2.5 bg-gradient-to-br from-indigo-100 to-indigo-200 rounded-xl flex-shrink-0 shadow-md">
                                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                </svg>
                              </div>
                              <div className="flex-1">
                                <h3 className="text-lg sm:text-xl md:text-xl lg:text-xl font-bold text-slate-800">Subjects</h3>
                                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                                  {(selectedTutorProfile?.profile?.subjects || []).length} {((selectedTutorProfile?.profile?.subjects || []).length === 1) ? 'subject' : 'subjects'} available
                                </p>
                              </div>
                            </div>
                            {(selectedTutorProfile?.profile?.subjects || []).length === 0 ? (
                              <div className="text-center py-6 sm:py-8 lg:py-10">
                                <svg className="w-14 h-14 sm:w-18 sm:h-18 lg:w-20 lg:h-20 text-slate-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                </svg>
                                <p className="text-sm sm:text-base text-slate-500">No subjects listed</p>
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                                {(selectedTutorProfile?.profile?.subjects || []).map((s: string, i: number) => {
                                  const subjectRating = subjectRatings[s];
                                  return (
                                    <button
                                      key={i}
                                      onClick={() => {
                                        setSearchDraft(String(s));
                                        setSearchQuery(String(s));
                                        setIsProfileOpen(false);
                                      }}
                                      className="group relative px-3 sm:px-4 md:px-4 py-2.5 sm:py-3 md:py-3 bg-gradient-to-r from-sky-100 to-indigo-100 text-sky-800 rounded-lg hover:from-sky-200 hover:to-indigo-200 active:from-sky-300 active:to-indigo-300 transition-all duration-200 font-medium text-sm sm:text-sm shadow-md hover:shadow-lg border-2 border-sky-200 hover:border-sky-400 touch-manipulation text-left w-full overflow-visible"
                                      style={{ WebkitTapHighlightColor: 'transparent' }}
                                    >
                                      <div className="relative z-10 flex flex-col gap-1.5 min-w-0 w-full">
                                        <span className="block break-words font-semibold w-full">{s}</span>
                                        {/* Ratings Section */}
                                        {subjectRating && subjectRating.count > 0 ? (
                                          <div className="flex items-center gap-1.5 flex-wrap min-w-0 w-full">
                                            <div className="flex items-center flex-shrink-0">
                                              {[1, 2, 3, 4, 5].map((star) => (
                                                <svg
                                                  key={star}
                                                  className={`w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0 ${star <= Math.floor(subjectRating.average) ? 'text-yellow-400 fill-current' : 'text-slate-300'}`}
                                                  fill="currentColor"
                                                  viewBox="0 0 20 20"
                                                >
                                                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                                </svg>
                                              ))}
                                            </div>
                                            <span className="text-xs font-bold text-slate-700 whitespace-nowrap flex-shrink-0">
                                              {subjectRating.average.toFixed(1)}
                                            </span>
                                            <span className="text-[10px] sm:text-xs text-slate-500 whitespace-nowrap flex-shrink-0">
                                              ({subjectRating.count} {subjectRating.count === 1 ? 'rating' : 'ratings'})
                                            </span>
                                          </div>
                                        ) : (
                                          <span className="text-[10px] sm:text-xs text-slate-500 italic">No ratings yet</span>
                                        )}

                                        {/* Supporting Documents for this Subject */}
                                        {(() => {
                                          const docsForSubject = tutorDocuments.filter((doc: any) => {
                                            if (!doc.document_tag) return false;
                                            try {
                                              const tags = JSON.parse(doc.document_tag);
                                              return Array.isArray(tags) && tags.includes(s);
                                            } catch (e) {
                                              return String(doc.document_tag) === s;
                                            }
                                          });

                                          if (docsForSubject.length === 0) return null;

                                          return (
                                            <div className="mt-1 pt-2 border-t border-sky-200/50 flex flex-wrap gap-1.5" onClick={(e) => e.stopPropagation()}>
                                              {docsForSubject.map((doc: any, docIdx: number) => (
                                                <button
                                                  key={doc.document_id || docIdx}
                                                  onClick={() => {
                                                    if (doc.file_url) {
                                                      setSelectedDocument({
                                                        url: getFileUrl(doc.file_url),
                                                        type: doc.file_type || 'image/jpeg',
                                                        name: doc.file_name || `Document ${docIdx + 1}`
                                                      });
                                                      setDocumentViewerOpen(true);
                                                    }
                                                  }}
                                                  className="inline-flex items-center gap-1.5 px-2 py-1 bg-white/60 hover:bg-white text-emerald-700 text-[10px] sm:text-[11px] font-medium rounded border border-emerald-200 hover:border-emerald-300 transition-colors shadow-sm"
                                                  title={`View ${doc.file_name || 'Document'}`}
                                                >
                                                  <FileText className="w-3 h-3" />
                                                  <span className="max-w-[80px] truncate">{doc.file_name || 'Document'}</span>
                                                </button>
                                              ))}
                                            </div>
                                          );
                                        })()}
                                      </div>
                                      <div className="absolute inset-0 bg-gradient-to-r from-sky-600 to-indigo-600 rounded-lg opacity-0 group-hover:opacity-10 transition-opacity"></div>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Second Row: Availability Section (full width) */}
                        <div className="bg-gradient-to-br from-sky-50 via-indigo-50 to-sky-50 rounded-lg sm:rounded-xl lg:rounded-xl p-4 sm:p-5 md:p-5 lg:p-6 shadow-lg border-2 border-sky-200 hover:shadow-xl transition-shadow duration-300">
                          <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4 md:mb-4">
                            <div className="p-2 sm:p-2.5 bg-gradient-to-br from-sky-200 to-indigo-200 rounded-xl flex-shrink-0 shadow-md">
                              <svg className="w-5 h-5 sm:w-6 sm:h-6 text-sky-700 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </div>
                            <h4 className="font-bold text-indigo-900 text-lg sm:text-xl md:text-xl lg:text-xl">Availability</h4>
                          </div>
                          {(selectedTutorProfile?.availability || []).length === 0 ? (
                            <div className="text-center py-6 sm:py-8 lg:py-10">
                              <div className="inline-flex items-center justify-center w-14 h-14 sm:w-18 sm:h-18 lg:w-20 lg:h-20 bg-slate-100 rounded-full mb-3">
                                <svg className="w-7 h-7 sm:w-9 sm:h-9 lg:w-10 lg:h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </div>
                              <div className="text-sm sm:text-base text-slate-600 font-medium">No availability provided.</div>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
                              {(() => {
                                // Group availability by day_of_week
                                const groupedByDay: Record<string, any[]> = {};
                                (selectedTutorProfile?.availability || []).forEach((a: any) => {
                                  const dayName = a.day_of_week || '';
                                  if (!groupedByDay[dayName]) {
                                    groupedByDay[dayName] = [];
                                  }
                                  groupedByDay[dayName].push(a);
                                });

                                const dayColors: Record<string, { bg: string; border: string; text: string; icon: string }> = {
                                  'Monday': { bg: 'bg-sky-100', border: 'border-sky-300', text: 'text-sky-800', icon: '📅' },
                                  'Tuesday': { bg: 'bg-sky-200', border: 'border-sky-400', text: 'text-sky-900', icon: '📆' },
                                  'Wednesday': { bg: 'bg-indigo-100', border: 'border-indigo-300', text: 'text-indigo-800', icon: '📋' },
                                  'Thursday': { bg: 'bg-indigo-200', border: 'border-indigo-400', text: 'text-indigo-900', icon: '📝' },
                                  'Friday': { bg: 'bg-sky-50', border: 'border-sky-200', text: 'text-sky-700', icon: '📌' },
                                  'Saturday': { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700', icon: '📊' },
                                  'Sunday': { bg: 'bg-sky-300', border: 'border-sky-500', text: 'text-sky-900', icon: '📑' },
                                };

                                // Order days by weekday order
                                const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
                                const sortedDays = Object.keys(groupedByDay).sort((a, b) => {
                                  const indexA = dayOrder.indexOf(a);
                                  const indexB = dayOrder.indexOf(b);
                                  return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
                                });

                                return sortedDays.map((dayName) => {
                                  const slots = groupedByDay[dayName];
                                  const colors = dayColors[dayName] || { bg: 'bg-slate-100', border: 'border-slate-300', text: 'text-slate-800', icon: '📅' };
                                  const nextDate = nextDateForWeekday(dayName, slots);
                                  const isUpcoming = nextDate && new Date(nextDate) >= new Date(new Date().toISOString().split('T')[0]);

                                  // Calculate total hours for all slots in this day
                                  const totalHours = slots.reduce((total, slot) => {
                                    const start = new Date(`1970-01-01T${slot.start_time}`);
                                    const end = new Date(`1970-01-01T${slot.end_time}`);
                                    const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
                                    return total + hours;
                                  }, 0);

                                  return (
                                    <div
                                      key={dayName}
                                      className={`${colors.bg} ${colors.border} border-2 rounded-lg p-3 sm:p-3.5 transition-all duration-200 hover:shadow-lg hover:scale-[1.01]`}
                                    >
                                      <div className="flex items-center justify-between mb-2 sm:mb-2.5 gap-2">
                                        <div className="flex items-center gap-2 sm:gap-2.5">
                                          <span className="text-base sm:text-lg">{colors.icon}</span>
                                          <div className={`font-bold ${colors.text} text-sm sm:text-base uppercase tracking-wide`}>
                                            {dayName.substring(0, 3)}
                                          </div>
                                        </div>
                                        {isUpcoming && (
                                          <span className="text-xs sm:text-sm bg-white/80 text-slate-700 px-2 sm:px-2.5 py-1 sm:py-1 rounded-full font-semibold whitespace-nowrap shadow-sm">
                                            Next: {new Date(nextDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                          </span>
                                        )}
                                      </div>
                                      <div className="space-y-2 sm:space-y-2.5">
                                        {slots.map((slot, slotIndex) => (
                                          <div key={slot.availability_id || slotIndex} className="flex items-center gap-2 sm:gap-2.5">
                                            <svg className={`w-4 h-4 sm:w-5 sm:h-5 ${colors.text} flex-shrink-0`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            <div className={`${colors.text} font-bold text-sm sm:text-base`}>
                                              {slot.start_time?.substring(0, 5) || slot.start_time} - {slot.end_time?.substring(0, 5) || slot.end_time}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                      <div className="pt-2 sm:pt-2.5 border-t-2 border-white/60 mt-2 sm:mt-2.5">
                                        <div className="flex items-center gap-1.5 sm:gap-2">
                                          <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                                          </svg>
                                          <span className="text-xs sm:text-sm text-slate-700 font-medium">
                                            {totalHours.toFixed(1)}h total available
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                });
                              })()}
                            </div>
                          )}
                        </div>

                        {/* Third Row: Supporting Documents Section (full width) */}
                        <div className="bg-white rounded-lg sm:rounded-xl lg:rounded-xl p-4 sm:p-5 md:p-5 lg:p-6 shadow-lg border border-slate-200 hover:shadow-xl transition-shadow duration-300">
                          <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4 md:mb-4">
                            <div className="p-2 sm:p-2.5 bg-gradient-to-br from-emerald-100 to-emerald-200 rounded-xl flex-shrink-0 shadow-md">
                              <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600" />
                            </div>
                            <div className="flex-1">
                              <h3 className="text-lg sm:text-xl md:text-xl lg:text-xl font-bold text-slate-800">Supporting Documents</h3>
                              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                                Verified documents to ensure tutor reliability
                              </p>
                            </div>
                          </div>
                          {tutorDocuments.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                              {tutorDocuments.map((doc: any, index: number) => {
                                const isImage = (doc.file_type || '').startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(doc.file_name || '');
                                return (
                                  <div
                                    key={doc.document_id || doc.id || index}
                                    onClick={() => {
                                      if (doc.file_url) {
                                        setSelectedDocument({
                                          url: getFileUrl(doc.file_url),
                                          type: doc.file_type || 'image/jpeg',
                                          name: doc.file_name || `Document ${index + 1}`
                                        });
                                        setDocumentViewerOpen(true);
                                      }
                                    }}
                                    className="group relative cursor-pointer bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-emerald-200 transition-all duration-300 overflow-hidden flex flex-col h-56 sm:h-64"
                                  >
                                    {/* Preview/Thumbnail Area */}
                                    <div className="flex-1 min-h-0 relative bg-slate-50 flex items-center justify-center overflow-hidden group-hover:bg-slate-100 transition-colors">
                                      {isImage && doc.file_url ? (
                                        <div className="absolute inset-0">
                                          <img
                                            src={getFileUrl(doc.file_url)}
                                            alt={doc.file_name}
                                            className="w-full h-full object-cover opacity-95 group-hover:opacity-100 group-hover:scale-105 transition-transform duration-700"
                                            loading="lazy"
                                          />
                                          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                                        </div>
                                      ) : (
                                        <div className="relative z-10 p-4 bg-white rounded-2xl shadow-sm group-hover:scale-110 transition-transform duration-300 ring-1 ring-slate-100">
                                          <FileText className={`w-10 h-10 sm:w-12 sm:h-12 ${doc.file_type === 'application/pdf' ? 'text-red-500' : 'text-emerald-500'}`} />
                                        </div>
                                      )}

                                      {/* Hover Overlay */}
                                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 z-20 bg-slate-900/20 backdrop-blur-[2px]">
                                        <div className="bg-white text-slate-800 p-3 rounded-full shadow-lg transform scale-75 group-hover:scale-100 transition-all duration-300">
                                          <Search className="w-5 h-5" />
                                        </div>
                                      </div>
                                    </div>

                                    {/* Footer Details */}
                                    <div className="flex-shrink-0 p-4 bg-white border-t border-slate-100 relative z-30">
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0 flex-1">
                                          <h4 className="text-sm font-bold text-slate-800 truncate leading-tight mb-1" title={doc.file_name}>
                                            {doc.file_name || `Document ${index + 1}`}
                                          </h4>
                                          <div className="flex items-center gap-2">
                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-500">
                                              {doc.file_type?.split('/')[1] || 'FILE'}
                                            </span>
                                            {/* <span className="text-[10px] text-slate-400">• 2.4 MB</span> */}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="text-center py-8 sm:py-12">
                              <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 bg-slate-50 rounded-full mb-4 ring-8 ring-slate-50/50">
                                <FileText className="w-8 h-8 sm:w-10 sm:h-10 text-slate-300" />
                              </div>
                              <h4 className="text-base sm:text-lg font-semibold text-slate-700 mb-1">No documents available</h4>
                              <p className="text-sm text-slate-500">This tutor hasn't uploaded any verified documents yet.</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Booking Form (hidden initially; revealed when the user clicks Book) */}
                    {showBookingForm && (
                      <div className="w-full overflow-hidden rounded-3xl border-2 border-sky-200/50 shadow-2xl bg-gradient-to-br from-white via-sky-50/30 to-indigo-50/20 backdrop-blur-sm flex flex-col h-full max-h-none">
                        {/* Enhanced Header */}
                        <div className="relative bg-gradient-to-r from-sky-600 via-indigo-600 to-indigo-700 px-4 sm:px-8 py-5 sm:py-6 text-white overflow-hidden">
                          {/* Decorative background elements */}
                          <div className="absolute inset-0 opacity-10">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full -mr-32 -mt-32"></div>
                            <div className="absolute bottom-0 left-0 w-48 h-48 bg-white rounded-full -ml-24 -mb-24"></div>
                          </div>
                          <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div className="flex items-center gap-4">
                              <div className="p-3 bg-white/20 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                              </div>
                              <div>
                                <h3 className="text-2xl sm:text-3xl font-bold leading-tight mb-1">Book a Session</h3>
                                <p className="text-sm sm:text-base text-white/90">Choose your subject, schedule, and leave notes for your tutor.</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="inline-flex items-center gap-2 rounded-full bg-white/20 backdrop-blur-sm px-4 py-2 border border-white/20 shadow-md">
                                <span className="h-2.5 w-2.5 rounded-full bg-emerald-300 animate-pulse" />
                                <span className="text-sm font-semibold">Step 1 · Details</span>
                              </span>
                              <span className="hidden sm:inline-flex items-center gap-2 text-sm text-white/80">
                                <span className="h-1 w-1 rounded-full bg-white/60" />
                                Step 2 · Review & Confirm
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="px-3 sm:px-6 lg:px-8 py-4 sm:py-8 lg:py-10 flex-1 overflow-y-auto">
                          <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)] lg:gap-6 lg:items-stretch">
                            {/* Unified Booking Form Container */}
                            <div className="flex-1 order-2 lg:order-1">
                              <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200/80 sm:border-2 sm:border-slate-200/60 shadow-lg sm:shadow-xl overflow-hidden flex flex-col h-full">
                                {/* Form Header */}
                                <div className="bg-gradient-to-r from-sky-50 via-indigo-50 to-sky-50 border-b border-slate-200/80 sm:border-b-2 sm:border-slate-200/60 px-4 sm:px-6 py-3 sm:py-4">
                                  <div className="flex items-center gap-2 sm:gap-3">
                                    <div className="inline-flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg sm:rounded-xl bg-gradient-to-br from-sky-500 to-indigo-500 text-white font-bold text-sm sm:text-base shadow-md flex-shrink-0">
                                      <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                      </svg>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <h4 className="text-base sm:text-lg font-bold text-slate-800">Booking Details</h4>
                                      <p className="text-[10px] sm:text-xs text-slate-600 hidden sm:block">Fill in the information below to book your session</p>
                                    </div>
                                  </div>
                                </div>

                                {/* Form Content */}
                                <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 flex-1">
                                  {/* Subject Selection */}
                                  <div className="space-y-2 sm:space-y-3">
                                    <div className="flex items-center justify-between gap-2">
                                      <label className="text-sm font-bold text-slate-700 flex items-center gap-1.5 sm:gap-2">
                                        <span className="inline-flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-md bg-sky-100 text-sky-700 text-[10px] sm:text-xs font-bold flex-shrink-0">1</span>
                                        <span className="text-xs sm:text-sm">Subject Selection</span>
                                      </label>
                                      <button
                                        type="button"
                                        className="px-2 sm:px-3 py-1 rounded-lg border border-sky-300 bg-sky-50 text-sky-700 hover:bg-sky-100 hover:border-sky-400 text-[10px] sm:text-xs font-medium transition-all flex-shrink-0"
                                        onClick={() => {
                                          if ((selectedTutorProfile?.profile?.subjects || []).length > 0) {
                                            setSearchDraft(selectedTutorProfile.profile.subjects[0]);
                                            setSearchQuery(selectedTutorProfile.profile.subjects[0]);
                                          }
                                        }}
                                      >
                                        View
                                      </button>
                                    </div>
                                    <div className="relative">
                                      <div className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                                        <svg className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                        </svg>
                                      </div>
                                      <select
                                        className={`w-full border-2 ${bookingErrors.subject ? 'border-red-400 bg-red-50' : 'border-slate-300 bg-white hover:border-sky-400'} pl-10 sm:pl-12 pr-3 sm:pr-4 py-2.5 sm:py-3 rounded-lg sm:rounded-xl focus:ring-4 focus:ring-sky-200 focus:border-sky-500 transition-all text-sm sm:text-base font-medium text-slate-700`}
                                        value={bookingForm.subject}
                                        onChange={(e) => {
                                          const value = e.target.value;
                                          setBookingForm(prev => ({ ...prev, subject: value }));
                                          setBookingErrors(prev => { const p = { ...prev }; delete (p as any).subject; return p; });
                                        }}
                                      >
                                        <option value="">Select a subject</option>
                                        {(selectedTutorProfile?.profile?.subjects || []).map((s: string, i: number) => (
                                          <option key={i} value={s}>{s}</option>
                                        ))}
                                      </select>
                                    </div>
                                    {bookingErrors.subject && (
                                      <div className="p-3 bg-red-50 border-l-4 border-red-500 rounded-lg flex items-start gap-2">
                                        <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                        </svg>
                                        <p className="text-sm text-red-700 font-medium">{bookingErrors.subject}</p>
                                      </div>
                                    )}
                                  </div>

                                  {/* Divider */}
                                  <div className="border-t border-slate-200"></div>

                                  {/* Schedule & Duration */}
                                  <div className="space-y-3 sm:space-y-4">
                                    <label className="text-sm font-bold text-slate-700 flex items-center gap-1.5 sm:gap-2">
                                      <span className="inline-flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-md bg-indigo-100 text-indigo-700 text-[10px] sm:text-xs font-bold flex-shrink-0">2</span>
                                      <span className="text-xs sm:text-sm">Schedule & Duration</span>
                                    </label>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                                      <div className="space-y-2">
                                        <label className="block text-sm font-semibold text-slate-700 flex items-center gap-2">
                                          <svg className="w-4 h-4 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                          </svg>
                                          Date
                                        </label>
                                        <div className="relative">
                                          <div className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                                            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                            </svg>
                                          </div>
                                          <input
                                            type="date"
                                            className={`w-full border-2 ${bookingErrors.date ? 'border-red-400 bg-red-50' : 'border-slate-300 bg-white hover:border-sky-400'} pl-10 sm:pl-12 pr-3 sm:pr-4 py-2.5 sm:py-3.5 rounded-lg sm:rounded-xl focus:ring-4 focus:ring-sky-200 focus:border-sky-500 transition-all text-sm sm:text-base font-medium text-slate-700`}
                                            value={bookingForm.date}
                                            onChange={(e) => {
                                              const value = e.target.value;
                                              setBookingForm(prev => ({ ...prev, date: value }));
                                              setBookingErrors(prev => { const p = { ...prev }; delete (p as any).date; delete (p as any).time; return p; });
                                            }}
                                            min={new Date().toISOString().split('T')[0]}
                                          />
                                        </div>
                                        {bookingErrors.date && (
                                          <div className="p-2.5 bg-red-50 border-l-4 border-red-500 rounded-lg flex items-start gap-2">
                                            <svg className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                            </svg>
                                            <p className="text-xs text-red-700 font-medium">{bookingErrors.date}</p>
                                          </div>
                                        )}
                                        {bookingForm.date && !availableTimeSlots.length && !bookingErrors.date && (
                                          <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg flex items-center gap-2">
                                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                            </svg>
                                            No available times on this date
                                          </div>
                                        )}
                                      </div>

                                      <div className="space-y-2">
                                        <label className="block text-sm font-semibold text-slate-700 flex items-center gap-2">
                                          <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                          </svg>
                                          Time
                                          {availableTimeSlots.length > 0 && (
                                            <span className="text-xs font-normal text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                                              {availableTimeSlots.length} slots
                                            </span>
                                          )}
                                          {loadingBookings && (
                                            <span className="text-xs font-normal text-slate-400 ml-2 flex items-center gap-1">
                                              <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                              </svg>
                                              Checking...
                                            </span>
                                          )}
                                        </label>
                                        {/* Show the block's start/end time for the block containing the selected time, or all blocks if no time selected */}
                                        {bookingForm.date && selectedTutorProfile?.availability && (() => {
                                          const date = new Date(bookingForm.date);
                                          const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' });
                                          const dayBlocks = selectedTutorProfile.availability.filter(
                                            (a: any) => a.day_of_week.toLowerCase() === dayOfWeek.toLowerCase()
                                          );
                                          if (dayBlocks.length > 0) {
                                            if (bookingForm.time) {
                                              const selectedMin = (() => {
                                                const [h, m] = bookingForm.time.split(':').map(Number);
                                                return h * 60 + m;
                                              })();
                                              const block = dayBlocks.find((b: any) => {
                                                const startMin = Number(b.start_time.split(':')[0]) * 60 + Number(b.start_time.split(':')[1]);
                                                const endMin = Number(b.end_time.split(':')[0]) * 60 + Number(b.end_time.split(':')[1]);
                                                return selectedMin >= startMin && selectedMin < endMin;
                                              });
                                              if (block) {
                                                return (
                                                  <div className="text-xs text-slate-600 mb-1">
                                                    <span className="font-semibold">Available:</span> {block.start_time} - {block.end_time}
                                                  </div>
                                                );
                                              }
                                            }
                                            // If no time selected, show all blocks
                                            return dayBlocks.map((block: any, idx: number) => (
                                              <div key={idx} className="text-xs text-slate-600 mb-1">
                                                <span className="font-semibold">Available:</span> {block.start_time} - {block.end_time}
                                              </div>
                                            ));
                                          }
                                          return null;
                                        })()}
                                        <div className="relative">
                                          <div className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                                            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                          </div>
                                          <select
                                            className={`w-full border-2 ${bookingErrors.time ? 'border-red-400 bg-red-50' : 'border-slate-300 bg-white hover:border-indigo-400'} ${!bookingForm.date ? 'bg-slate-100 cursor-not-allowed opacity-60' : ''} pl-10 sm:pl-12 pr-3 sm:pr-4 py-2.5 sm:py-3.5 rounded-lg sm:rounded-xl focus:ring-4 focus:ring-indigo-200 focus:border-indigo-500 transition-all text-sm sm:text-base font-medium text-slate-700`}
                                            value={bookingForm.time}
                                            onChange={(e) => {
                                              const value = e.target.value;
                                              setBookingForm(prev => ({ ...prev, time: value }));
                                              setBookingErrors(prev => { const p = { ...prev }; delete (p as any).time; return p; });
                                            }}
                                            disabled={!bookingForm.date}
                                          >
                                            <option value="">Select time</option>
                                            {/* Show all available time slots from all blocks */}
                                            {availableTimeSlots.map(time => (
                                              <option key={time} value={time}>{time}</option>
                                            ))}
                                          </select>
                                        </div>
                                        {bookingErrors.time && (
                                          <p className="text-sm text-red-600 flex items-center gap-1.5">
                                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                            </svg>
                                            {bookingErrors.time}
                                          </p>
                                        )}
                                        {!bookingForm.date && (
                                          <p className="text-xs text-slate-500">Please select a date first</p>
                                        )}
                                        {bookingForm.date && (!bookingForm.duration || bookingForm.duration === 0) && availableTimeSlots.length > 0 && (
                                          <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg flex items-center gap-2">
                                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                                              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                            </svg>
                                            Select a duration to filter available times for your session length
                                          </p>
                                        )}
                                        {bookingForm.date && bookingForm.duration > 0 && availableTimeSlots.length === 0 && !loadingBookings && (
                                          <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg flex items-center gap-2">
                                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                            </svg>
                                            No available time slots for this duration on the selected date (may be fully booked)
                                          </p>
                                        )}
                                        {bookingForm.date && availableTimeSlots.length === 0 && !loadingBookings && (!bookingForm.duration || bookingForm.duration === 0) && (
                                          <p className="text-xs text-slate-500">No available time slots for this date</p>
                                        )}
                                      </div>

                                      <div className="space-y-2 md:col-span-2">
                                        <label className="block text-sm font-semibold text-slate-700 flex items-center gap-2">
                                          <svg className="w-4 h-4 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                          </svg>
                                          Duration
                                          {!bookingForm.date && <span className="text-xs font-normal text-slate-400">(Select date first)</span>}
                                        </label>
                                        <div className="relative">
                                          <div className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                                            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                          </div>
                                          <select
                                            className={`w-full border-2 ${bookingErrors.duration ? 'border-red-400 bg-red-50' : 'border-slate-300 bg-white hover:border-sky-400'} ${!bookingForm.date || allowedDurations.length === 0 ? 'bg-slate-100 cursor-not-allowed opacity-60' : ''} pl-10 sm:pl-12 pr-3 sm:pr-4 py-2.5 sm:py-3.5 rounded-lg sm:rounded-xl focus:ring-4 focus:ring-sky-200 focus:border-sky-500 transition-all text-sm sm:text-base font-medium text-slate-700`}
                                            value={bookingForm.duration}
                                            onChange={(e) => {
                                              const value = parseFloat(e.target.value) || 0;
                                              if (!isNaN(value)) {
                                                setBookingForm(prev => ({ ...prev, duration: value, time: '' })); // Clear time when duration changes
                                              }
                                              setBookingErrors(prev => { const p = { ...prev }; delete (p as any).duration; return p; });
                                            }}
                                            disabled={!bookingForm.date || allowedDurations.length === 0}
                                          >
                                            <option value={0}>{!bookingForm.date ? 'Select date first' : allowedDurations.length === 0 ? 'No available durations' : 'Select duration'}</option>
                                            {allowedDurations.map(d => (
                                              <option key={d} value={d}>
                                                {d % 1 === 0 ? `${d}hr${d !== 1 ? 's' : ''}` : `${d}hr`}
                                              </option>
                                            ))}
                                          </select>
                                        </div>
                                        {bookingErrors.duration && (
                                          <div className="p-2.5 bg-red-50 border-l-4 border-red-500 rounded-lg flex items-start gap-2">
                                            <svg className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                            </svg>
                                            <p className="text-xs text-red-700 font-medium">{bookingErrors.duration}</p>
                                          </div>
                                        )}
                                        {maxAllowedMinutes > 0 && (
                                          <div className="text-xs text-slate-600 bg-gradient-to-r from-sky-50 to-indigo-50 border border-sky-200 px-4 py-3 rounded-lg">
                                            <div className="flex items-start gap-2">
                                              <svg className="w-4 h-4 text-sky-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                              </svg>
                                              <span className="font-medium">
                                                Maximum available: {Math.floor(maxAllowedMinutes / 60)}h {maxAllowedMinutes % 60}m
                                              </span>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Divider */}
                                  <div className="border-t border-slate-200"></div>

                                  {/* Notes & Requests */}
                                  <div className="space-y-2 sm:space-y-3">
                                    <label className="text-sm font-bold text-slate-700 flex items-center gap-1.5 sm:gap-2">
                                      <span className="inline-flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-md bg-sky-100 text-sky-700 text-[10px] sm:text-xs font-bold flex-shrink-0">3</span>
                                      <span className="text-xs sm:text-sm">Notes & Requests</span>
                                    </label>
                                    <textarea
                                      className="w-full border-2 border-slate-300 bg-white hover:border-sky-400 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg sm:rounded-xl focus:ring-4 focus:ring-sky-200 focus:border-sky-500 transition-all resize-none min-h-[100px] sm:min-h-[120px] text-sm sm:text-base font-medium text-slate-700 placeholder:text-slate-400"
                                      placeholder="Share learning goals or special instructions for the tutor..."
                                      value={bookingForm.student_notes}
                                      onChange={(e) => {
                                        const value = e.target.value;
                                        setBookingForm(prev => ({ ...prev, student_notes: value }));
                                        setBookingErrors(prev => { const p = { ...prev }; delete (p as any).student_notes; return p; });
                                      }}
                                    />
                                    {bookingErrors.student_notes && (
                                      <div className="p-3 bg-red-50 border-l-4 border-red-500 rounded-lg flex items-start gap-2">
                                        <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                        </svg>
                                        <p className="text-sm text-red-700 font-medium">{bookingErrors.student_notes}</p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Booking Summary Sidebar */}
                            <aside className="w-full order-1 lg:order-2 lg:sticky lg:top-6 bg-white border border-slate-200/80 sm:border-2 sm:border-slate-200/60 rounded-xl sm:rounded-2xl p-4 sm:p-5 lg:p-6 space-y-4 sm:space-y-5 shadow-lg sm:shadow-xl flex flex-col">
                              {/* Tutor Info Card */}
                              <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-sky-50 via-indigo-50 to-sky-50 p-4 border border-sky-200/50">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-sky-200/20 rounded-full -mr-16 -mt-16"></div>
                                <div className="relative flex items-center gap-4">
                                  <div className="relative flex-shrink-0">
                                    <img
                                      src={getFileUrl(selectedTutorProfile?.user?.profile_image_url || '')}
                                      onError={(e) => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedTutorProfile?.user?.name || 'Tutor')}`; }}
                                      alt={selectedTutorProfile?.user?.name}
                                      className="h-16 w-16 rounded-full object-cover border-4 border-white shadow-lg ring-2 ring-sky-200"
                                    />
                                    {tutorOnlineStatus[selectedTutorProfile?.user?.user_id] && (
                                      <div className="absolute -bottom-1 -right-1 h-5 w-5 bg-green-500 rounded-full border-2 border-white shadow-md"></div>
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Tutoring with</p>
                                    <p className="text-lg font-bold text-slate-900 truncate">{selectedTutorProfile?.user?.name}</p>
                                    <p className="text-xs text-slate-600 truncate">{selectedTutorProfile?.user?.university_name}</p>
                                  </div>
                                </div>
                              </div>

                              {/* Booking Details */}
                              <div className="space-y-3">
                                <h5 className="text-sm font-bold text-slate-800 uppercase tracking-wide flex items-center gap-2">
                                  <div className="h-1 w-8 bg-gradient-to-r from-sky-500 to-indigo-500 rounded-full"></div>
                                  Booking Summary
                                </h5>
                                {[
                                  { label: 'Subject', value: bookingForm.subject || 'Select subject', icon: '📚' },
                                  { label: 'Date', value: bookingForm.date ? new Date(bookingForm.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : 'Select date', icon: '📅' },
                                  { label: 'Time', value: bookingForm.time || 'Select time', icon: '🕐' },
                                  { label: 'Duration', value: bookingForm.duration ? `${bookingForm.duration}${bookingForm.duration % 1 === 0 ? 'hr' + (bookingForm.duration !== 1 ? 's' : '') : 'hr'}` : 'Select duration', icon: '⏱️' },
                                ].map((item) => (
                                  <div key={item.label} className="flex items-center justify-between rounded-xl bg-gradient-to-r from-slate-50 to-sky-50/30 px-4 py-3 border border-slate-200/60 hover:border-sky-300 transition-colors">
                                    <div className="flex items-center gap-3">
                                      <span className="text-lg">{item.icon}</span>
                                      <span className="text-sm font-semibold text-slate-600">{item.label}</span>
                                    </div>
                                    <span className="font-bold text-slate-900 text-right truncate max-w-[55%]">{item.value}</span>
                                  </div>
                                ))}
                                {bookingForm.student_notes && (
                                  <div className="rounded-xl bg-gradient-to-br from-indigo-50/50 to-sky-50/50 px-4 py-4 border border-indigo-200/60">
                                    <div className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-2">
                                      <span>💬</span>
                                      Notes
                                    </div>
                                    <div className="text-base font-bold text-slate-900 break-words whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">{bookingForm.student_notes}</div>
                                  </div>
                                )}
                                {selectedTutorProfile?.profile?.session_rate_per_hour && bookingForm.duration > 0 && (() => {
                                  const totalCost = Number(selectedTutorProfile.profile.session_rate_per_hour) * bookingForm.duration;
                                  const durationDisplay = `${bookingForm.duration}${bookingForm.duration % 1 === 0 ? 'hr' + (bookingForm.duration !== 1 ? 's' : '') : 'hr'}`;
                                  return (
                                    <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 p-4 border-2 border-emerald-400 shadow-lg">
                                      <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent"></div>
                                      <div className="relative flex items-center justify-between">
                                        <span className="text-white font-bold text-sm">Estimated Cost</span>
                                        <span className="font-black text-white text-xl">
                                          ₱{totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                      </div>
                                      <div className="relative mt-1 text-xs text-white/90">
                                        ₱{Number(selectedTutorProfile.profile.session_rate_per_hour).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}/hr × {durationDisplay}
                                      </div>
                                    </div>
                                  );
                                })()}
                              </div>
                            </aside>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </Modal>
        )}

        {/* Booking Confirmation Modal */}
        {confirmationOpen && (
          <Modal
            isOpen={true}
            onClose={() => setConfirmationOpen(false)}
            title="Confirm Booking"
            footer={
              <>
                <button
                  onClick={handleConfirmBooking}
                  disabled={bookingLoading}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 shadow-md"
                >
                  {bookingLoading ? 'Booking...' : 'Confirm'}
                </button>
                <button
                  onClick={() => setConfirmationOpen(false)}
                  className="px-4 py-2 border rounded-md hover:bg-gray-100 ml-2"
                >
                  Back
                </button>
              </>
            }
          >
            <div className="space-y-4">
              <div className="rounded-lg overflow-hidden shadow-sm">
                <div className="bg-gradient-to-r from-sky-600 to-indigo-600 p-4 text-white flex items-center gap-4">
                  <div className="h-14 w-14 rounded-full overflow-hidden flex-shrink-0">
                    <img src={getFileUrl(selectedTutorProfile?.user?.profile_image_url || '')} alt={selectedTutorProfile?.user?.name} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedTutorProfile?.user?.name || 'Tutor')}`; }} />
                  </div>
                  <div>
                    <div className="font-semibold text-lg">{selectedTutorProfile?.user?.name}</div>
                    <div className="text-sm opacity-90">{selectedTutorProfile?.user?.university_name || ''}</div>
                  </div>
                  <div className="ml-auto text-sm inline-flex items-center bg-white/20 px-2 py-1 rounded text-white">
                    {overallAverageRating !== null ? `${overallAverageRating.toFixed(1)} ★` : '—'}
                  </div>
                </div>
                <div className="p-4 bg-white">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="text-sm">
                      <div className="font-medium">Subject</div>
                      <div className="text-slate-700">{bookingForm.subject || '—'}</div>
                    </div>
                    <div className="text-sm">
                      <div className="font-medium">When</div>
                      <div className="text-slate-700">{bookingForm.date ? new Date(bookingForm.date).toLocaleDateString() : '—'} · {bookingForm.time || '—'}</div>
                    </div>
                    <div className="text-sm">
                      <div className="font-medium">Duration</div>
                      <div className="text-slate-700">
                        {bookingForm.duration
                          ? `${bookingForm.duration}${bookingForm.duration % 1 === 0 ? 'hr' + (bookingForm.duration !== 1 ? 's' : '') : 'hr'}`
                          : '—'}
                      </div>
                    </div>
                    <div className="text-sm">
                      <div className="font-medium">Notes</div>
                      <div className="text-slate-700">{bookingForm.student_notes || 'No notes'}</div>
                    </div>
                  </div>
                  {/* <div className="mt-3 text-xs text-slate-500">A confirmation will be sent to your email when the tutor accepts.</div> */}
                </div>
              </div>
            </div>
          </Modal>
        )}

        {/* Cancel Confirmation Modal */}
        {cancelConfirmationOpen && (
          <Modal
            isOpen={true}
            onClose={() => setCancelConfirmationOpen(false)}
            title="Cancel Booking"
            footer={
              <>
                <button
                  onClick={() => {
                    setIsProfileOpen(false);
                    setCancelConfirmationOpen(false);
                    setBookingForm({ subject: '', date: '', time: '', duration: 1, student_notes: '' });
                  }}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                >
                  Yes, Cancel
                </button>
                <button
                  onClick={() => setCancelConfirmationOpen(false)}
                  className="px-4 py-2 border rounded-md hover:bg-gray-100"
                >
                  No, Keep Editing
                </button>
              </>
            }
          >
            <p className="text-slate-700">
              Are you sure you want to cancel this booking? Any information you've entered will be lost.
            </p>
          </Modal>
        )}

        {/* Error Modal */}
        {bookingErrorModalOpen && (
          <Modal
            isOpen={true}
            onClose={() => setBookingErrorModalOpen(false)}
            title="Booking Error"
            footer={
              <button
                className="px-4 py-2 bg-blue-600 text-white rounded-md"
                onClick={() => setBookingErrorModalOpen(false)}
              >
                Got it
              </button>
            }
          >
            <div className="py-2 text-slate-700">{bookingErrorModalMessage}</div>
          </Modal>
        )}

        {/* Document Viewer Modal */}
        {documentViewerOpen && selectedDocument && (
          <Modal
            isOpen={true}
            onClose={() => setDocumentViewerOpen(false)}
            title={selectedDocument.name}
            maxWidth="7xl"
            className="w-full h-full sm:h-[90vh] sm:max-w-7xl flex flex-col p-0 sm:rounded-2xl overflow-hidden bg-white"
            contentClassName="flex-1 overflow-hidden p-0 bg-slate-50 flex flex-col relative"
            footer={null} // We rely on the custom close button and potential overlay controls
          >
            {/* Header / Controls Overlay */}
            <div className="absolute top-0 left-0 right-0 z-50 p-4 flex items-center justify-between pointer-events-none">
              <div className="bg-white/80 backdrop-blur-md text-slate-800 px-4 py-2 rounded-full border border-slate-200 shadow-sm pointer-events-auto max-w-[70%] truncate">
                <span className="font-bold text-sm sm:text-base truncate">{selectedDocument.name}</span>
              </div>
              <div className="flex items-center gap-2 pointer-events-auto">
                <button
                  onClick={() => window.open(selectedDocument.url, '_blank')}
                  className="p-2.5 bg-white/80 hover:bg-white backdrop-blur-md text-slate-600 hover:text-indigo-600 rounded-full border border-slate-200 shadow-sm hover:shadow-md transition-all duration-200"
                  title="Open in new tab"
                >
                  <ExternalLink className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setDocumentViewerOpen(false)}
                  className="p-2.5 bg-white/80 hover:bg-white backdrop-blur-md text-slate-600 hover:text-red-600 rounded-full border border-slate-200 shadow-sm hover:shadow-md transition-all duration-200 group"
                  title="Close viewer"
                >
                  <X className="w-5 h-5 group-hover:rotate-90 transition-transform duration-200" />
                </button>
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 w-full h-full flex items-center justify-center p-0 sm:p-4 overflow-auto">
              {selectedDocument.type.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(selectedDocument.url) ? (
                <img
                  src={selectedDocument.url}
                  alt={selectedDocument.name}
                  className="max-w-full max-h-full object-contain shadow-lg rounded-lg"
                />
              ) : (
                <iframe
                  src={selectedDocument.url}
                  title={selectedDocument.name}
                  className="w-full h-full bg-white rounded-none sm:rounded-lg shadow-lg border border-slate-200"
                />
              )}
            </div>
          </Modal>
        )}

        {/* Toast Container */}


      </div>
    </div>
  );
};

export default TuteeFindAndBookTutors;
