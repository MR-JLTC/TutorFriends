import React, { useState, useEffect, useMemo } from 'react';
import apiClient from '../../services/api';
import Button from '../ui/Button';
import Card from '../ui/Card';
import { useAuth } from '../../hooks/useAuth';
import { Calendar, Edit, Save, Filter, X, Plus, Clock, Info } from 'lucide-react';

interface DayAvailability {
  selectedSlots: Set<string>; // Set of time slots like "09:00", "09:30", etc.
}

const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// Generate 30-minute time slots from 00:00 to 23:30
const generateTimeSlots = (): string[] => {
  const slots: string[] = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const timeString = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      slots.push(timeString);
    }
  }
  return slots;
};

const TIME_SLOTS = generateTimeSlots();

// Helper function to convert time string to minutes for comparison
// Handles both HH:MM and HH:MM:SS formats
const timeToMinutes = (time: string): number => {
  if (!time) return 0;
  // Remove seconds if present (format: HH:MM:SS -> HH:MM)
  const timeParts = time.split(':');
  const hours = parseInt(timeParts[0], 10) || 0;
  const minutes = parseInt(timeParts[1], 10) || 0;
  return hours * 60 + minutes;
};

// Normalize time format from API (HH:MM:SS -> HH:MM)
const normalizeTime = (time: string): string => {
  if (!time) return '';
  const parts = time.split(':');
  return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
};

// Helper function to check if a time slot falls within a range
// A slot represents a 30-minute period starting at that time
// A slot is included if it starts at or after startTime AND starts before endTime
// Example: Range 9:00-11:00 includes slots 9:00, 9:30, 10:00, 10:30 (4 slots)
// The 11:00 slot is NOT included because it represents 11:00-11:30 which goes beyond 11:00
const isTimeInRange = (timeSlot: string, startTime: string, endTime: string): boolean => {
  const slotMinutes = timeToMinutes(timeSlot);
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);
  return slotMinutes >= startMinutes && slotMinutes < endMinutes;
};

// Convert time ranges to selected slots
const rangesToSlots = (ranges: { start_time: string; end_time: string }[]): Set<string> => {
  const slots = new Set<string>();
  ranges.forEach(range => {
    TIME_SLOTS.forEach(slot => {
      if (isTimeInRange(slot, range.start_time, range.end_time)) {
        slots.add(slot);
      }
    });
  });
  return slots;
};

// Convert consecutive selected slots back to ranges
// Important: Each slot represents a 30-minute period starting at that time
// The end_time should be exactly 30 minutes after the last slot's start time
// This ensures: Range 13:00-16:00 → slots [13:00, 13:30, 14:00, 14:30, 15:00, 15:30] → range 13:00-16:00 ✓
// Example: Slots 13:00, 13:30, 14:00, 14:30, 15:00, 15:30 → range 13:00-16:00 (15:30 + 30min = 16:00)
const slotsToRanges = (selectedSlots: Set<string>): { start_time: string; end_time: string }[] => {
  if (selectedSlots.size === 0) return [];

  const sortedSlots = Array.from(selectedSlots).sort((a, b) => timeToMinutes(a) - timeToMinutes(b));
  const ranges: { start_time: string; end_time: string }[] = [];

  let rangeStart: string | null = null;
  let rangeEnd: string | null = null;

  sortedSlots.forEach((slot, index) => {
    if (rangeStart === null) {
      rangeStart = slot;
      rangeEnd = slot;
    } else {
      const currentMinutes = timeToMinutes(slot);
      const prevMinutes = timeToMinutes(sortedSlots[index - 1]);

      // If this slot is exactly 30 minutes after the previous one, continue the range
      if (currentMinutes - prevMinutes === 30) {
        rangeEnd = slot;
      } else {
        // Gap detected - end current range and start a new one
        if (rangeStart && rangeEnd) {
          // Calculate end time as 30 minutes after the last slot's start time
          // This maintains round-trip consistency with rangesToSlots
          const endMinutes = timeToMinutes(rangeEnd) + 30;
          const endHours = Math.floor(endMinutes / 60);
          const endMins = endMinutes % 60;
          ranges.push({
            start_time: rangeStart,
            end_time: `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`
          });
        }
        rangeStart = slot;
        rangeEnd = slot;
      }
    }
  });

  // Add the last range - end time is 30 minutes after the last slot's start time
  if (rangeStart && rangeEnd) {
    const endMinutes = timeToMinutes(rangeEnd) + 30;
    const endHours = Math.floor(endMinutes / 60);
    const endMins = endMinutes % 60;
    ranges.push({
      start_time: rangeStart,
      end_time: `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`
    });
  }

  // Post-process: Fix the illogical issue where selecting 1pm-4pm becomes 1pm-4:30pm
  // The key insight: A range like 13:00-16:00 should produce slots [13:00, ..., 15:30]
  // If the user has selected those slots, the range should be 13:00-16:00, not 13:00-16:30
  // We check if the last slot in the consecutive sequence, when used to calculate end_time,
  // would produce the same slots when converted back. If not, we exclude it.
  return ranges.map(range => {
    const rangeStartMin = timeToMinutes(range.start_time);

    // Find consecutive slots starting from rangeStartMin
    const consecutiveSlots: string[] = [];
    let startIndex = sortedSlots.findIndex(slot => timeToMinutes(slot) === rangeStartMin);

    if (startIndex === -1) return range;

    // Build consecutive sequence
    for (let i = startIndex; i < sortedSlots.length; i++) {
      const slot = sortedSlots[i];
      const slotMin = timeToMinutes(slot);

      if (i === startIndex) {
        consecutiveSlots.push(slot);
      } else {
        const prevSlotMin = timeToMinutes(sortedSlots[i - 1]);
        if (slotMin === prevSlotMin + 30) {
          consecutiveSlots.push(slot);
        } else {
          break;
        }
      }
    }

    if (consecutiveSlots.length === 0) return range;

    // Try each possible ending slot, starting from the last one
    // We want to find the longest sequence that, when converted to a range and back, produces the same slots
    for (let endIdx = consecutiveSlots.length - 1; endIdx >= 0; endIdx--) {
      const testSlots = consecutiveSlots.slice(0, endIdx + 1);
      const lastSlot = testSlots[testSlots.length - 1];
      const lastSlotMin = timeToMinutes(lastSlot);
      const testEndMin = lastSlotMin + 30;

      // Create a test range using these slots
      const testRange = {
        start_time: range.start_time,
        end_time: `${String(Math.floor(testEndMin / 60)).padStart(2, '0')}:${String(testEndMin % 60).padStart(2, '0')}`
      };

      // Convert the test range back to slots
      const reconvertedSlots = rangesToSlots([testRange]);
      const reconvertedArray = Array.from(reconvertedSlots).sort();
      const testSlotsArray = testSlots.sort();

      // If they match, this is the correct range
      if (JSON.stringify(reconvertedArray) === JSON.stringify(testSlotsArray)) {
        // This is the correct end time
        if (timeToMinutes(range.end_time) !== testEndMin) {
          const correctedEndHours = Math.floor(testEndMin / 60);
          const correctedEndMins = testEndMin % 60;

          return {
            start_time: range.start_time,
            end_time: `${String(correctedEndHours).padStart(2, '0')}:${String(correctedEndMins).padStart(2, '0')}`
          };
        }
        return range;
      }
    }

    // Fallback: use the consecutive slots without the last one if it causes issues
    if (consecutiveSlots.length > 1) {
      const safeSlots = consecutiveSlots.slice(0, -1);
      const lastSlot = safeSlots[safeSlots.length - 1];
      const lastSlotMin = timeToMinutes(lastSlot);
      const correctEndMin = lastSlotMin + 30;
      const correctedEndHours = Math.floor(correctEndMin / 60);
      const correctedEndMins = correctEndMin % 60;

      return {
        start_time: range.start_time,
        end_time: `${String(correctedEndHours).padStart(2, '0')}:${String(correctedEndMins).padStart(2, '0')}`
      };
    }

    return range;
  });
};

// Enhanced Time Range Picker Component for easy time selection
const TimeRangePicker: React.FC<{ day: string; onAddRange: (startTime: string, endTime: string) => void }> = ({ day, onAddRange }) => {
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [showPicker, setShowPicker] = useState(false);

  const handleAdd = () => {
    if (startTime && endTime && timeToMinutes(startTime) < timeToMinutes(endTime)) {
      onAddRange(startTime, endTime);
      setShowPicker(false);
      // Reset to defaults for next use
      setStartTime('09:00');
      setEndTime('17:00');
    }
  };

  if (!showPicker) {
    return (
      <button
        type="button"
        onClick={() => setShowPicker(true)}
        className="flex items-center justify-center gap-2 w-full px-6 py-3.5 bg-gradient-to-r from-primary-600 to-primary-700 text-white text-sm font-bold rounded-xl hover:from-primary-700 hover:to-primary-800 transition-all shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
      >
        <Plus className="h-5 w-5" />
        <span>Add Time Range</span>
      </button>
    );
  }

  return (
    <div className="space-y-4 p-3 sm:p-4 md:p-5 bg-white rounded-xl border-2 border-primary-300 shadow-lg">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <div className="space-y-2">
          <label className="block text-xs sm:text-sm font-bold text-primary-700 uppercase tracking-wide">Start Time</label>
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="w-full px-3 sm:px-4 md:px-5 py-2.5 sm:py-3 md:py-3.5 text-sm sm:text-base border-2 border-primary-300 rounded-xl bg-primary-50 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-semibold text-slate-800 shadow-sm transition-all min-w-0"
            style={{ minWidth: '140px' }}
          />
        </div>
        <div className="space-y-2">
          <label className="block text-xs sm:text-sm font-bold text-primary-700 uppercase tracking-wide">End Time</label>
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="w-full px-3 sm:px-4 md:px-5 py-2.5 sm:py-3 md:py-3.5 text-sm sm:text-base border-2 border-primary-300 rounded-xl bg-primary-50 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-semibold text-slate-800 shadow-sm transition-all min-w-0"
            style={{ minWidth: '140px' }}
          />
        </div>
      </div>
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 pt-2">
        <button
          type="button"
          onClick={handleAdd}
          className="flex-1 px-4 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-primary-600 to-primary-700 text-white text-xs sm:text-sm font-bold rounded-xl hover:from-primary-700 hover:to-primary-800 transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 min-h-[44px]"
        >
          <Plus className="h-4 w-4 flex-shrink-0" />
          <span className="whitespace-nowrap">Add Time Range</span>
        </button>
        <button
          type="button"
          onClick={() => setShowPicker(false)}
          className="px-4 sm:px-6 py-2.5 sm:py-3 bg-slate-100 text-slate-700 text-xs sm:text-sm font-semibold rounded-xl hover:bg-slate-200 transition-all shadow-sm border border-slate-300 min-h-[44px] sm:w-auto w-full"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

const AvailabilityScheduling: React.FC = () => {
  const { user } = useAuth();
  const [tutorId, setTutorId] = useState<number | null>(null);
  const [availability, setAvailability] = useState<Record<string, DayAvailability>>(
    daysOfWeek.reduce((acc, day) => {
      acc[day] = { selectedSlots: new Set<string>() };
      return acc;
    }, {} as Record<string, DayAvailability>)
  );
  const [isEditing, setIsEditing] = useState(false);
  const [filterStartHour, setFilterStartHour] = useState<number>(0);
  const [filterEndHour, setFilterEndHour] = useState<number>(23);
  const [showFilter, setShowFilter] = useState(false);
  const [displayMode, setDisplayMode] = useState<'30min' | 'hourly'>('30min');
  const [editingRange, setEditingRange] = useState<{ day: string; index: number } | null>(null);
  const [editStartTime, setEditStartTime] = useState<string>('');
  const [editEndTime, setEditEndTime] = useState<string>('');
  // Remember last selection per day to restore after deselect/select
  const [lastDaySelection, setLastDaySelection] = useState<Record<string, Set<string>>>({});

  // Set tutorId from logged-in user - fetch actual tutor_id instead of using user_id
  useEffect(() => {
    if (user?.user_id) {
      // Fetch the actual tutor_id instead of using user_id
      const fetchTutorId = async () => {
        try {
          const response = await apiClient.get(`/tutors/by-user/${user.user_id}/tutor-id`);
          const actualTutorId = response.data.tutor_id;
          console.log('Fetched tutor_id:', actualTutorId, 'for user_id:', user.user_id);
          setTutorId(actualTutorId);
        } catch (error: any) {
          console.error('Failed to fetch tutor ID:', error);
          // Fallback to user_id if the endpoint fails (some endpoints accept user_id)
          setTutorId(user.user_id);
        }
      };
      fetchTutorId();
    }
  }, [user]);

  // After tutorId is set/changes, fetch current availability
  useEffect(() => {
    if (!tutorId) return;
    const loadAvailability = async () => {
      try {
        const response = await apiClient.get(`/tutors/${tutorId}/availability`);
        const slots = response.data;

        const newAvailability: Record<string, DayAvailability> = daysOfWeek.reduce((acc, day) => {
          acc[day] = { selectedSlots: new Set<string>() };
          return acc;
        }, {} as Record<string, DayAvailability>);

        // Group slots by day and normalize time formats
        const slotsByDay: Record<string, { start_time: string; end_time: string }[]> = {};
        slots.forEach((slot: any) => {
          if (!slotsByDay[slot.day_of_week]) {
            slotsByDay[slot.day_of_week] = [];
          }
          // Normalize time formats (HH:MM:SS -> HH:MM)
          slotsByDay[slot.day_of_week].push({
            start_time: normalizeTime(slot.start_time),
            end_time: normalizeTime(slot.end_time)
          });
        });

        // Convert ranges to selected slots for each day
        Object.entries(slotsByDay).forEach(([day, ranges]) => {
          newAvailability[day].selectedSlots = rangesToSlots(ranges);
        });

        setAvailability(newAvailability);
      } catch (error) {
        console.error('Failed to fetch availability:', error);
      }
    };

    loadAvailability();
  }, [tutorId]);

  const fetchCurrentAvailability = async () => {
    if (!tutorId) return;
    try {
      const response = await apiClient.get(`/tutors/${tutorId}/availability`);
      const slots = response.data;

      const newAvailability: Record<string, DayAvailability> = daysOfWeek.reduce((acc, day) => {
        acc[day] = { selectedSlots: new Set<string>() };
        return acc;
      }, {} as Record<string, DayAvailability>);

      // Group slots by day and normalize time formats
      const slotsByDay: Record<string, { start_time: string; end_time: string }[]> = {};
      slots.forEach((slot: any) => {
        if (!slotsByDay[slot.day_of_week]) {
          slotsByDay[slot.day_of_week] = [];
        }
        // Normalize time formats (HH:MM:SS -> HH:MM)
        slotsByDay[slot.day_of_week].push({
          start_time: normalizeTime(slot.start_time),
          end_time: normalizeTime(slot.end_time)
        });
      });

      // Convert ranges to selected slots for each day
      Object.entries(slotsByDay).forEach(([day, ranges]) => {
        newAvailability[day].selectedSlots = rangesToSlots(ranges);
      });

      setAvailability(newAvailability);
    } catch (error) {
      console.error('Failed to fetch availability:', error);
    }
  };

  const handleSlotToggle = (day: string, timeSlot: string) => {
    setAvailability(prev => {
      const newSelectedSlots = new Set(prev[day].selectedSlots);

      if (displayMode === 'hourly') {
        // When in hourly mode, toggle both :00 and :30 slots for that hour
        const [hours] = timeSlot.split(':');
        const hourSlot = `${hours}:00`;
        const halfHourSlot = `${hours}:30`;

        const hourSelected = newSelectedSlots.has(hourSlot);
        const halfHourSelected = newSelectedSlots.has(halfHourSlot);

        if (hourSelected && halfHourSelected) {
          // Both selected, deselect both
          newSelectedSlots.delete(hourSlot);
          newSelectedSlots.delete(halfHourSlot);
        } else {
          // At least one not selected, select both
          newSelectedSlots.add(hourSlot);
          newSelectedSlots.add(halfHourSlot);
        }
      } else {
        // Normal 30-minute mode: toggle single slot
        if (newSelectedSlots.has(timeSlot)) {
          newSelectedSlots.delete(timeSlot);
        } else {
          newSelectedSlots.add(timeSlot);
        }
      }

      return {
        ...prev,
        [day]: { selectedSlots: newSelectedSlots }
      };
    });
  };

  const handleDayToggle = (day: string, filterOnly: boolean = false) => {
    setAvailability(prev => {
      const currentSlots = prev[day].selectedSlots;
      const hasAnySelected = currentSlots.size > 0;

      // Determine if a filter is active (hour range or hourly mode)
      const isFilterActive = filterStartHour !== 0 || filterEndHour !== 23 || displayMode !== '30min';
      // While editing, prefer toggling only displayed slots and allow clearing the whole day when unchecking
      const shouldToggleDisplayedOnly = filterOnly || isEditing || isFilterActive;

      if (shouldToggleDisplayedOnly) {
        // If user is unchecking the day (it has any selected), clear everything for that day
        if (!filterOnly && isEditing && hasAnySelected) {
          // Save current selection to restore on next select
          setLastDaySelection(prevMemo => ({
            ...prevMemo,
            [day]: new Set(currentSlots)
          }));
          return {
            ...prev,
            [day]: { selectedSlots: new Set<string>() }
          };
        }

        // If user is selecting the day (no selection currently), try restoring last saved selection first
        if (!hasAnySelected && !filterOnly && isEditing) {
          const saved = lastDaySelection[day];
          if (saved && saved.size > 0) {
            // Restore and clear saved snapshot
            setLastDaySelection(prevMemo => ({ ...prevMemo, [day]: new Set<string>() }));
            return {
              ...prev,
              [day]: { selectedSlots: new Set(saved) }
            };
          }
        }

        // Otherwise, toggle only displayed slots (respects display mode and filters)
        const newSelectedSlots = new Set(currentSlots);

        if (displayMode === 'hourly') {
          // Check if all displayed hourly slots are fully selected
          const allSelected = displaySlots.every(slot => {
            const [hours] = slot.split(':');
            return currentSlots.has(`${hours}:00`) && currentSlots.has(`${hours}:30`);
          });

          if (allSelected) {
            // Deselect all displayed hourly slots (both :00 and :30)
            displaySlots.forEach(slot => {
              const [hours] = slot.split(':');
              newSelectedSlots.delete(`${hours}:00`);
              newSelectedSlots.delete(`${hours}:30`);
            });
          } else {
            // Select all displayed hourly slots (both :00 and :30)
            displaySlots.forEach(slot => {
              const [hours] = slot.split(':');
              newSelectedSlots.add(`${hours}:00`);
              newSelectedSlots.add(`${hours}:30`);
            });
          }
        } else {
          // 30-minute mode
          const allSelected = displaySlots.every(slot => currentSlots.has(slot));
          if (allSelected) {
            // Deselect all displayed slots
            displaySlots.forEach(slot => newSelectedSlots.delete(slot));
          } else {
            // Select all displayed slots
            displaySlots.forEach(slot => newSelectedSlots.add(slot));
          }
        }

        return {
          ...prev,
          [day]: { selectedSlots: newSelectedSlots }
        };
      } else {
        // No filter active and not editing: toggle all slots for the day
        const allSelected = TIME_SLOTS.every(slot => currentSlots.has(slot));
        if (allSelected) {
          // Deselect all
          return {
            ...prev,
            [day]: { selectedSlots: new Set<string>() }
          };
        } else {
          // Select all
          return {
            ...prev,
            [day]: { selectedSlots: new Set(TIME_SLOTS) }
          };
        }
      }
    });
  };

  // Filter slots based on hour range
  const filteredSlots = useMemo(() => {
    return TIME_SLOTS.filter(slot => {
      const [hours] = slot.split(':');
      const hour = parseInt(hours, 10);
      return hour >= filterStartHour && hour <= filterEndHour;
    });
  }, [filterStartHour, filterEndHour]);

  // Filter slots by display mode (30min or hourly)
  const displaySlots = useMemo(() => {
    if (displayMode === 'hourly') {
      // Only show hourly slots (00 minutes) within the hour range
      // For 9am-11am, should show only 9:00 and 10:00 (2 slots), not 9:00, 9:30, 10:00, 10:30
      return TIME_SLOTS.filter(slot => {
        const [hours, minutes] = slot.split(':');
        const hour = parseInt(hours, 10);
        return minutes === '00' && hour >= filterStartHour && hour < filterEndHour;
      });
    }
    // Show all 30-minute slots within the filtered range
    return filteredSlots;
  }, [filteredSlots, displayMode, filterStartHour, filterEndHour]);

  // Apply preset filters
  const applyPresetFilter = (preset: string) => {
    switch (preset) {
      case 'morning':
        setFilterStartHour(6);
        setFilterEndHour(11);
        break;
      case 'afternoon':
        setFilterStartHour(12);
        setFilterEndHour(17);
        break;
      case 'evening':
        setFilterStartHour(18);
        setFilterEndHour(23);
        break;
      case 'business':
        setFilterStartHour(9);
        setFilterEndHour(17);
        break;
      case 'all':
      default:
        setFilterStartHour(0);
        setFilterEndHour(23);
        break;
    }
  };

  const saveAvailability = async () => {
    if (!tutorId) {
      alert('Tutor not found.');
      return;
    }

    try {
      const allSlots: { day_of_week: string; start_time: string; end_time: string }[] = [];

      Object.entries(availability).forEach(([day, dayAvail]) => {
        const dayAvailability = dayAvail as DayAvailability;
        if (dayAvailability.selectedSlots.size > 0) {
          const ranges = slotsToRanges(dayAvailability.selectedSlots);

          // Verify round-trip consistency for each range
          ranges.forEach(range => {
            // Convert the range back to slots to verify consistency
            const reconvertedSlots = rangesToSlots([range]);
            const originalSlotsArray = Array.from(dayAvailability.selectedSlots).sort();

            // Filter original slots to only those that should be in this range
            // (since we might have multiple ranges, we need to check which slots belong to this range)
            const rangeStartMin = timeToMinutes(range.start_time);
            const rangeEndMin = timeToMinutes(range.end_time);
            const slotsInThisRange = originalSlotsArray.filter(slot => {
              const slotMin = timeToMinutes(slot);
              return slotMin >= rangeStartMin && slotMin < rangeEndMin;
            });

            const reconvertedArray = Array.from(reconvertedSlots).sort();

            // Check if they match (only for slots within this range)
            if (JSON.stringify(slotsInThisRange) !== JSON.stringify(reconvertedArray)) {
              console.warn(`Range conversion mismatch for ${day}:`, {
                range: `${range.start_time}-${range.end_time}`,
                originalSlotsInRange: slotsInThisRange,
                reconvertedSlots: reconvertedArray
              });

              // Adjust the end_time to match the original slots
              // Find the maximum slot that should be included
              if (slotsInThisRange.length > 0) {
                const lastSlot = slotsInThisRange[slotsInThisRange.length - 1];
                const lastSlotMin = timeToMinutes(lastSlot);
                // The end_time should be 30 minutes after the last slot
                const correctedEndMin = lastSlotMin + 30;
                const correctedEndHours = Math.floor(correctedEndMin / 60);
                const correctedEndMins = correctedEndMin % 60;

                range.end_time = `${String(correctedEndHours).padStart(2, '0')}:${String(correctedEndMins).padStart(2, '0')}`;
              }
            }

            allSlots.push({
              day_of_week: day,
              start_time: range.start_time,
              end_time: range.end_time
            });
          });
        }
      });

      await apiClient.post(`/tutors/${tutorId}/availability`, { slots: allSlots });
      setIsEditing(false);
      // Refresh availability to ensure consistency
      await fetchCurrentAvailability();
      alert('Availability updated successfully!');
    } catch (error) {
      console.error('Failed to save availability:', error);
      alert('Failed to save availability. Please try again.');
    }
  };

  // Change request helpers removed

  return (
    <div className="space-y-3 sm:space-y-4 md:space-y-6 pb-4 sm:pb-6 md:pb-8">
      {/* Enhanced Header */}
      <div className="bg-gradient-to-br from-primary-600 via-primary-700 to-primary-800 rounded-lg sm:rounded-xl p-3 sm:p-4 md:p-5 text-white shadow-lg relative overflow-hidden -mx-2 sm:-mx-3 md:mx-0">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-full -mr-16 -mt-16 blur-xl"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white rounded-full -ml-12 -mb-12 blur-xl"></div>
        </div>
        <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 sm:gap-3">
          <div className="min-w-0 flex-1 flex items-center gap-2 sm:gap-2.5 bg-white/10 p-2 sm:p-2.5 rounded-lg backdrop-blur-md border border-white/20 shadow-inner">
            <div className="p-1 sm:p-1.5 bg-white/20 rounded-md shadow-sm shrink-0">
              <Info className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white drop-shadow-md" />
            </div>
            <p className="text-xs sm:text-sm md:text-base text-white font-medium leading-snug tracking-wide text-shadow-sm">
              Manage your weekly availability and update your schedule anytime</p>
          </div>
          <div className="flex w-full sm:w-auto mt-2 sm:mt-0">
            {isEditing ? (
              <button
                onClick={saveAvailability}
                className="flex items-center justify-center space-x-1.5 bg-white/95 backdrop-blur-sm text-primary-600 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-semibold hover:bg-white transition-all shadow-md hover:shadow-lg text-[11px] sm:text-xs md:text-sm w-full sm:w-auto touch-manipulation"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                <Save className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                <span>Save Changes</span>
              </button>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center justify-center space-x-1.5 bg-white/95 backdrop-blur-sm text-primary-600 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-semibold hover:bg-white transition-all shadow-md hover:shadow-lg text-[11px] sm:text-xs md:text-sm w-full sm:w-auto touch-manipulation"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                <Edit className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                <span>Edit Schedule</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Current Schedule */}
      <Card className="p-0 overflow-hidden shadow-xl border-0 -mx-2 sm:-mx-3 md:mx-0">
        <div className="bg-gradient-to-br from-primary-50 via-primary-100/50 to-primary-50 border-b-2 border-primary-200/50 px-4 sm:px-5 md:px-6 lg:px-8 py-4 sm:py-5 md:py-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl shadow-lg">
                <Calendar className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
              <h2 className="text-lg sm:text-xl md:text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">Weekly Schedule</h2>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
              <button
                onClick={() => setShowFilter(!showFilter)}
                className={`flex items-center justify-center space-x-2 px-3 sm:px-4 py-2 rounded-xl font-semibold transition-all text-xs sm:text-sm shadow-lg hover:shadow-xl touch-manipulation ${showFilter
                  ? 'bg-gradient-to-r from-primary-600 to-primary-700 text-white'
                  : 'bg-white text-primary-700 border-2 border-primary-300 hover:bg-primary-50'
                  }`}
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                <Filter className="h-4 w-4" />
                <span>Filter</span>
              </button>
              {isEditing && (
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-3 sm:px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200 transition-all shadow-md hover:shadow-lg text-xs sm:text-sm flex-1 sm:flex-none touch-manipulation"
                  style={{ WebkitTapHighlightColor: 'transparent' }}
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="p-3 sm:p-4 md:p-6 lg:p-8">
          {/* Filter Controls - Always visible when filter is open */}
          {showFilter && (
            <div className="mb-4 sm:mb-6 md:mb-8 p-4 sm:p-5 md:p-6 bg-gradient-to-br from-primary-50 via-primary-100/50 to-primary-50 rounded-xl sm:rounded-2xl border-2 border-primary-200/50 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <div className="p-2 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl shadow-lg">
                    <Filter className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                  </div>
                  <h3 className="text-sm sm:text-base md:text-lg font-bold text-slate-800">Filter & View Options</h3>
                </div>
                <button
                  onClick={() => setShowFilter(false)}
                  className="text-slate-500 hover:text-slate-700 hover:bg-slate-100 p-2 rounded-full transition-all flex-shrink-0 touch-manipulation"
                  title="Close filter"
                  style={{ WebkitTapHighlightColor: 'transparent' }}
                >
                  <X className="h-4 w-4 sm:h-5 sm:w-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 md:gap-5">
                {/* Left Column: Time Range Filter */}
                <div className="space-y-3 sm:space-y-4">
                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-2 sm:mb-3">Time Range</label>

                    {/* Preset Filters */}
                    <div className="mb-3 sm:mb-4">
                      <label className="block text-[10px] sm:text-xs font-medium text-slate-600 mb-1.5 sm:mb-2">Quick Filters:</label>
                      <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                        <button
                          onClick={() => applyPresetFilter('all')}
                          className={`px-3 sm:px-4 py-2 text-xs sm:text-sm rounded-xl font-semibold transition-all shadow-md hover:shadow-lg touch-manipulation ${filterStartHour === 0 && filterEndHour === 23
                            ? 'bg-gradient-to-r from-primary-600 to-primary-700 text-white'
                            : 'bg-white text-slate-700 border-2 border-primary-300 hover:bg-primary-50'
                            }`}
                          style={{ WebkitTapHighlightColor: 'transparent' }}
                        >
                          All Day
                        </button>
                        <button
                          onClick={() => applyPresetFilter('business')}
                          className={`px-3 sm:px-4 py-2 text-xs sm:text-sm rounded-xl font-semibold transition-all shadow-md hover:shadow-lg touch-manipulation ${filterStartHour === 9 && filterEndHour === 17
                            ? 'bg-gradient-to-r from-primary-600 to-primary-700 text-white'
                            : 'bg-white text-slate-700 border-2 border-primary-300 hover:bg-primary-50'
                            }`}
                          style={{ WebkitTapHighlightColor: 'transparent' }}
                        >
                          Business Hours
                        </button>
                        <button
                          onClick={() => applyPresetFilter('morning')}
                          className={`px-3 sm:px-4 py-2 text-xs sm:text-sm rounded-xl font-semibold transition-all shadow-md hover:shadow-lg touch-manipulation ${filterStartHour === 6 && filterEndHour === 11
                            ? 'bg-gradient-to-r from-primary-600 to-primary-700 text-white'
                            : 'bg-white text-slate-700 border-2 border-primary-300 hover:bg-primary-50'
                            }`}
                          style={{ WebkitTapHighlightColor: 'transparent' }}
                        >
                          Morning
                        </button>
                        <button
                          onClick={() => applyPresetFilter('afternoon')}
                          className={`px-3 sm:px-4 py-2 text-xs sm:text-sm rounded-xl font-semibold transition-all shadow-md hover:shadow-lg touch-manipulation ${filterStartHour === 12 && filterEndHour === 17
                            ? 'bg-gradient-to-r from-primary-600 to-primary-700 text-white'
                            : 'bg-white text-slate-700 border-2 border-primary-300 hover:bg-primary-50'
                            }`}
                          style={{ WebkitTapHighlightColor: 'transparent' }}
                        >
                          Afternoon
                        </button>
                        <button
                          onClick={() => applyPresetFilter('evening')}
                          className={`px-3 sm:px-4 py-2 text-xs sm:text-sm rounded-xl font-semibold transition-all shadow-md hover:shadow-lg md:col-span-2 touch-manipulation ${filterStartHour === 18 && filterEndHour === 23
                            ? 'bg-gradient-to-r from-primary-600 to-primary-700 text-white'
                            : 'bg-white text-slate-700 border-2 border-primary-300 hover:bg-primary-50'
                            }`}
                          style={{ WebkitTapHighlightColor: 'transparent' }}
                        >
                          Evening
                        </button>
                      </div>
                    </div>

                    {/* Custom Hour Range */}
                    <div>
                      <label className="block text-[10px] sm:text-xs font-medium text-slate-600 mb-1.5 sm:mb-2">Custom Range:</label>
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className="flex-1">
                          <label className="block text-[10px] sm:text-xs text-slate-500 mb-1 sm:mb-1.5">From</label>
                          <select
                            value={filterStartHour}
                            onChange={(e) => setFilterStartHour(parseInt(e.target.value, 10))}
                            className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 shadow-sm"
                          >
                            {Array.from({ length: 24 }, (_, i) => (
                              <option key={i} value={i}>
                                {String(i).padStart(2, '0')}:00 {i >= 12 ? 'PM' : 'AM'}
                              </option>
                            ))}
                          </select>
                        </div>
                        <span className="pt-5 sm:pt-7 text-slate-500 font-medium text-xs sm:text-sm">to</span>
                        <div className="flex-1">
                          <label className="block text-[10px] sm:text-xs text-slate-500 mb-1 sm:mb-1.5">To</label>
                          <select
                            value={filterEndHour}
                            onChange={(e) => setFilterEndHour(parseInt(e.target.value, 10))}
                            className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 shadow-sm"
                          >
                            {Array.from({ length: 24 }, (_, i) => (
                              <option key={i} value={i}>
                                {String(i).padStart(2, '0')}:00 {i >= 12 ? 'PM' : 'AM'}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column: Display Mode */}
                <div className="space-y-3 sm:space-y-4">
                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-2 sm:mb-3">Display Mode</label>

                    {/* Display Mode Toggle */}
                    <div className="space-y-2 sm:space-y-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => setDisplayMode('30min')}
                          className={`flex-1 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl font-semibold transition-all shadow-md hover:shadow-lg text-xs sm:text-sm touch-manipulation ${displayMode === '30min'
                            ? 'bg-gradient-to-r from-primary-600 to-primary-700 text-white'
                            : 'bg-white text-slate-700 border-2 border-primary-300 hover:bg-primary-50'
                            }`}
                          style={{ WebkitTapHighlightColor: 'transparent' }}
                        >
                          30-Minute View
                        </button>
                        <button
                          onClick={() => setDisplayMode('hourly')}
                          className={`flex-1 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl font-semibold transition-all shadow-md hover:shadow-lg text-xs sm:text-sm touch-manipulation ${displayMode === 'hourly'
                            ? 'bg-gradient-to-r from-primary-600 to-primary-700 text-white'
                            : 'bg-white text-slate-700 border-2 border-primary-300 hover:bg-primary-50'
                            }`}
                          style={{ WebkitTapHighlightColor: 'transparent' }}
                        >
                          Hourly View
                        </button>
                      </div>

                      <div className="p-2 sm:p-3 bg-white rounded-lg border border-slate-200">
                        <p className="text-[10px] sm:text-xs text-slate-600 leading-relaxed">
                          {displayMode === 'hourly'
                            ? '✨ Hourly view shows only hour markers. Clicking an hour selects/deselects both 30-minute slots for that hour.'
                            : '✨ 30-minute view shows all time slots. Click to select individual 30-minute intervals.'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Filter Summary */}
              <div className="mt-3 sm:mt-4 md:mt-5 pt-3 sm:pt-4 border-t border-slate-200">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
                  <div className="text-[10px] sm:text-xs text-slate-600">
                    <span className="font-medium">Showing:</span>{' '}
                    <span className="text-primary-600 font-semibold">{displaySlots.length}</span>{' '}
                    {displaySlots.length === 1 ? 'slot' : 'slots'}
                    {' '}({filterStartHour.toString().padStart(2, '0')}:00 - {displayMode === 'hourly' ? `${(filterEndHour - 1).toString().padStart(2, '0')}:59` : `${filterEndHour.toString().padStart(2, '0')}:59`})
                  </div>
                  <button
                    onClick={() => {
                      setFilterStartHour(0);
                      setFilterEndHour(23);
                      setDisplayMode('30min');
                    }}
                    className="text-[10px] sm:text-xs text-primary-600 hover:text-primary-700 active:text-primary-800 font-medium hover:underline touch-manipulation"
                    style={{ WebkitTapHighlightColor: 'transparent' }}
                  >
                    Reset All Filters
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3 sm:space-y-4 md:space-y-6">
            {daysOfWeek.map(day => {
              const selectedSlots = availability[day].selectedSlots;
              const hasAnySelected = selectedSlots.size > 0;

              // Calculate selected slots count based on display mode
              // This should match what's displayed in the filter (hours or 30-min slots)
              let selectedCountInFilter = 0;
              let selectedCountTotal = 0;

              if (displayMode === 'hourly') {
                // In hourly mode: count how many hours are selected (each hour is one "slot" in hourly view)
                // displaySlots already contains only hourly slots (:00) in the filtered range
                selectedCountInFilter = displaySlots.filter(slot => {
                  const [hours] = slot.split(':');
                  const hourSlot = `${hours}:00`;
                  const halfHourSlot = `${hours}:30`;
                  // Count as selected if both :00 and :30 slots are selected
                  return selectedSlots.has(hourSlot) && selectedSlots.has(halfHourSlot);
                }).length;

                // Total hours selected across all time
                const allHourSlots = TIME_SLOTS.filter(slot => {
                  const [, minutes] = slot.split(':');
                  return minutes === '00';
                });
                selectedCountTotal = allHourSlots.filter(slot => {
                  const [hours] = slot.split(':');
                  const hourSlot = `${hours}:00`;
                  const halfHourSlot = `${hours}:30`;
                  return selectedSlots.has(hourSlot) && selectedSlots.has(halfHourSlot);
                }).length;
              } else {
                // In 30-minute mode: count individual slots
                // displaySlots contains all 30-minute slots in the filtered range
                selectedCountInFilter = displaySlots.filter(slot => selectedSlots.has(slot)).length;
                // Total slots selected
                selectedCountTotal = selectedSlots.size;
              }

              // Check if filter is active (not showing all slots)
              const isFilterActive = filterStartHour !== 0 || filterEndHour !== 23 || displayMode !== '30min';

              return (
                <div
                  key={day}
                  className={`border rounded-lg transition-all ${hasAnySelected
                    ? 'bg-green-50 border-green-200'
                    : 'bg-slate-50 border-slate-200'
                    }`}
                >
                  <div className="border-b border-slate-200 bg-white hover:bg-slate-50 transition-colors">
                    {/* Day Header */}
                    <div className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 md:py-5 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
                      <div className="flex items-center justify-between gap-2 sm:gap-4">
                        <div className="flex items-center space-x-2 sm:space-x-3 md:space-x-4 min-w-0 flex-1">
                          <input
                            type="checkbox"
                            className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 rounded-lg border-slate-300 text-primary-600 focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 cursor-pointer flex-shrink-0 touch-manipulation"
                            checked={hasAnySelected}
                            onChange={() => handleDayToggle(day)}
                            disabled={!isEditing}
                            style={{ WebkitTapHighlightColor: 'transparent' }}
                          />
                          <div className="min-w-0 flex-1">
                            <span className="font-bold text-base sm:text-lg md:text-xl text-slate-800 block truncate">{day}</span>
                            {hasAnySelected && (
                              <span className="mt-1 sm:mt-0 sm:ml-2 sm:inline-block text-xs sm:text-sm font-medium text-green-700 bg-green-100 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full inline-flex items-center">
                                <Calendar className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-1 flex-shrink-0" />
                                <span className="whitespace-nowrap">{(() => {
                                  const ranges = slotsToRanges(selectedSlots);
                                  const totalHours = ranges.reduce((total, range) => {
                                    return total + (timeToMinutes(range.end_time) - timeToMinutes(range.start_time)) / 60;
                                  }, 0);
                                  return `${totalHours.toFixed(1)} hours`;
                                })()}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Easy Time Range Management */}
                    {isEditing && (
                      <div className="px-3 sm:px-4 md:px-6 pb-4 sm:pb-5 md:pb-6 space-y-4 sm:space-y-5 md:space-y-6">
                        {/* Add New Time Range - Enhanced Design */}
                        <div className="bg-gradient-to-br from-primary-50 via-primary-100/50 to-purple-50 border-2 border-primary-300 rounded-xl sm:rounded-2xl p-3 sm:p-4 md:p-6 shadow-xl hover:shadow-2xl transition-all">
                          <div className="flex items-start gap-2 sm:gap-3 md:gap-4 mb-3 sm:mb-4 md:mb-5">
                            <div className="flex-1 min-w-0">
                              <h3 className="font-bold text-base sm:text-lg md:text-xl text-slate-800 mb-1">Add Available Time</h3>
                              <p className="text-xs sm:text-sm text-slate-600">
                                Select your start and end times below. The system will automatically convert it to 30-minute slots.
                              </p>
                            </div>
                          </div>
                          <TimeRangePicker
                            day={day}
                            onAddRange={(startTime: string, endTime: string) => {
                              const newSlots = rangesToSlots([{ start_time: startTime, end_time: endTime }]);
                              setAvailability(prev => {
                                const currentSlots = new Set(prev[day].selectedSlots);
                                newSlots.forEach(slot => currentSlots.add(slot));
                                return {
                                  ...prev,
                                  [day]: { selectedSlots: currentSlots }
                                };
                              });
                            }}
                          />
                        </div>

                        {/* Existing Time Ranges - Enhanced Design */}
                        {hasAnySelected && (() => {
                          const ranges = slotsToRanges(selectedSlots);
                          const isEditingThisDay = editingRange?.day === day;
                          const isFilterActive = filterStartHour !== 0 || filterEndHour !== 23 || displayMode !== '30min';

                          // Apply hour filter to ranges only when filter is active
                          const filteredRanges = isFilterActive
                            ? ranges.filter(range => {
                              const startHour = parseInt(range.start_time.split(':')[0], 10);
                              const endHour = parseInt(range.end_time.split(':')[0], 10);
                              return startHour >= filterStartHour && endHour <= filterEndHour + 1;
                            })
                            : ranges;

                          const startEdit = (idx: number, range: { start_time: string; end_time: string }) => {
                            setEditingRange({ day, index: idx });
                            setEditStartTime(range.start_time);
                            setEditEndTime(range.end_time);
                          };

                          const saveEdit = (idx: number) => {
                            if (editStartTime && editEndTime && timeToMinutes(editStartTime) < timeToMinutes(editEndTime)) {
                              const originalRange = filteredRanges[idx];
                              const fullIndex = ranges.findIndex(r => r.start_time === originalRange.start_time && r.end_time === originalRange.end_time);
                              if (fullIndex === -1) return;

                              const oldRange = ranges[fullIndex];
                              const oldSlots = rangesToSlots([oldRange]);
                              const newSlots = rangesToSlots([{ start_time: editStartTime, end_time: editEndTime }]);

                              setAvailability(prev => {
                                const currentSlots = new Set(prev[day].selectedSlots);
                                oldSlots.forEach(slot => currentSlots.delete(slot));
                                newSlots.forEach(slot => currentSlots.add(slot));
                                return {
                                  ...prev,
                                  [day]: { selectedSlots: currentSlots }
                                };
                              });

                              setEditingRange(null);
                              setEditStartTime('');
                              setEditEndTime('');
                            }
                          };

                          const cancelEdit = () => {
                            setEditingRange(null);
                            setEditStartTime('');
                            setEditEndTime('');
                          };

                          return (
                            <div className="space-y-3 sm:space-y-4">
                              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0 pb-2 sm:pb-3 border-b-2 border-slate-200">
                                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                                  <div className="p-1.5 sm:p-2 bg-green-100 rounded-lg flex-shrink-0">
                                    <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <h3 className="text-sm sm:text-base md:text-lg font-bold text-slate-800">Your Available Times</h3>
                                    <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5">Click Edit to modify or Remove to delete</p>
                                  </div>
                                </div>
                                <span className="text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-green-500 to-emerald-500 px-2.5 sm:px-3 md:px-4 py-1 sm:py-1.5 rounded-full shadow-md whitespace-nowrap">
                                  {filteredRanges.length} {filteredRanges.length === 1 ? 'range' : 'ranges'}
                                </span>
                              </div>
                              {filteredRanges.length === 0 ? (
                                <div className="text-center py-2.5 sm:py-3 text-slate-500 text-xs sm:text-sm bg-slate-50 rounded-lg border border-slate-200">
                                  No availability in the filtered range
                                </div>
                              ) : (
                                <div className="space-y-2.5 sm:space-y-3 max-h-64 sm:max-h-72 overflow-y-auto pr-1 sm:pr-2 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100">
                                  {filteredRanges.map((range, idx) => {
                                    const startHour = parseInt(range.start_time.split(':')[0], 10);
                                    const startMin = parseInt(range.start_time.split(':')[1], 10);
                                    const endHour = parseInt(range.end_time.split(':')[0], 10);
                                    const endMin = parseInt(range.end_time.split(':')[1], 10);

                                    const formatTime = (hour: number, min: number) => {
                                      const period = hour >= 12 ? 'PM' : 'AM';
                                      const displayHour = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);
                                      return `${displayHour}:${String(min).padStart(2, '0')} ${period}`;
                                    };

                                    const isEditing = isEditingThisDay && editingRange?.index === idx;
                                    const duration = (timeToMinutes(range.end_time) - timeToMinutes(range.start_time)) / 60;

                                    return (
                                      <div
                                        key={`${range.start_time}-${range.end_time}-${idx}`}
                                        className={`rounded-xl sm:rounded-2xl transition-all duration-200 ${isEditing
                                          ? 'bg-gradient-to-r from-primary-50 via-primary-100/50 to-primary-50 border-2 border-primary-400 shadow-xl p-3 sm:p-4 md:p-5'
                                          : 'bg-gradient-to-r from-green-50 via-emerald-50 to-green-50 border-2 border-green-200 hover:border-green-400 hover:shadow-lg p-3 sm:p-4 md:p-5 group'
                                          }`}
                                      >
                                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
                                          {isEditing ? (
                                            // Edit Mode - Premium Design
                                            <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                              <div className="space-y-1.5 sm:space-y-2">
                                                <label className="block text-[10px] sm:text-xs font-bold text-primary-700 uppercase tracking-wide flex items-center gap-1">
                                                  <Calendar className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                                                  Start Time
                                                </label>
                                                <input
                                                  type="time"
                                                  value={editStartTime}
                                                  onChange={(e) => setEditStartTime(e.target.value)}
                                                  className="w-full px-3 sm:px-4 md:px-5 py-2.5 sm:py-2.5 md:py-3 text-sm sm:text-sm md:text-base border-2 border-primary-400 rounded-lg sm:rounded-xl bg-white focus:ring-2 sm:focus:ring-4 focus:ring-primary-200 focus:border-primary-600 font-bold text-slate-800 shadow-lg transition-all min-w-0"
                                                  style={{ minWidth: '140px' }}
                                                />
                                              </div>
                                              <div className="space-y-1.5 sm:space-y-2">
                                                <label className="block text-[10px] sm:text-xs font-bold text-primary-700 uppercase tracking-wide flex items-center gap-1">
                                                  <Clock className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                                                  End Time
                                                </label>
                                                <input
                                                  type="time"
                                                  value={editEndTime}
                                                  onChange={(e) => setEditEndTime(e.target.value)}
                                                  className="w-full px-3 sm:px-4 md:px-5 py-2.5 sm:py-2.5 md:py-3 text-sm sm:text-sm md:text-base border-2 border-primary-400 rounded-lg sm:rounded-xl bg-white focus:ring-2 sm:focus:ring-4 focus:ring-primary-200 focus:border-primary-600 font-bold text-slate-800 shadow-lg transition-all min-w-0"
                                                  style={{ minWidth: '140px' }}
                                                />
                                              </div>
                                            </div>
                                          ) : (
                                            // View Mode - Premium Design
                                            <div className="flex items-center gap-2 sm:gap-3 md:gap-4 flex-1 min-w-0">
                                              <div className="flex items-center gap-2 sm:gap-3 md:gap-4 min-w-0 flex-1">
                                                <div className="relative flex-shrink-0">
                                                  <div className="w-3 h-3 sm:w-4 sm:h-4 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full shadow-lg"></div>
                                                  <div className="absolute inset-0 w-3 h-3 sm:w-4 sm:h-4 bg-green-400 rounded-full animate-ping opacity-75"></div>
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                  <div className="flex flex-wrap items-baseline gap-1 sm:gap-2 mb-1">
                                                    <span className="font-black text-base sm:text-lg md:text-2xl text-slate-800 whitespace-nowrap">
                                                      {formatTime(startHour, startMin)}
                                                    </span>
                                                    <span className="text-sm sm:text-lg md:text-xl text-slate-400 font-light">→</span>
                                                    <span className="font-black text-base sm:text-lg md:text-2xl text-slate-800 whitespace-nowrap">
                                                      {formatTime(endHour, endMin)}
                                                    </span>
                                                  </div>
                                                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                                                    <span className="text-[10px] sm:text-xs font-semibold text-slate-500 bg-white px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md border border-slate-200 whitespace-nowrap">
                                                      {range.start_time} - {range.end_time}
                                                    </span>
                                                    <span className="text-[10px] sm:text-xs font-bold text-white bg-gradient-to-r from-green-500 to-emerald-600 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full shadow-md whitespace-nowrap">
                                                      {duration.toFixed(1)} hours
                                                    </span>
                                                  </div>
                                                </div>
                                              </div>
                                            </div>
                                          )}
                                          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 w-full sm:w-auto">
                                            {isEditing ? (
                                              <>
                                                <button
                                                  type="button"
                                                  onClick={() => saveEdit(idx)}
                                                  className="px-3 sm:px-4 md:px-6 py-2 sm:py-2.5 md:py-3 text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-primary-600 to-primary-700 rounded-lg sm:rounded-xl hover:from-primary-700 hover:to-primary-800 active:from-primary-800 active:to-primary-900 transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-1.5 sm:gap-2 flex-1 sm:flex-none touch-manipulation"
                                                  title="Save changes"
                                                  style={{ WebkitTapHighlightColor: 'transparent' }}
                                                >
                                                  <Save className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                                  <span>Save</span>
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={cancelEdit}
                                                  className="px-3 sm:px-4 md:px-6 py-2 sm:py-2.5 md:py-3 text-xs sm:text-sm font-bold text-slate-700 bg-white border-2 border-slate-300 rounded-lg sm:rounded-xl hover:bg-slate-50 active:bg-slate-100 transition-all shadow-md hover:shadow-lg flex-1 sm:flex-none touch-manipulation"
                                                  title="Cancel editing"
                                                  style={{ WebkitTapHighlightColor: 'transparent' }}
                                                >
                                                  Cancel
                                                </button>
                                              </>
                                            ) : (
                                              <>
                                                <button
                                                  type="button"
                                                  onClick={() => startEdit(idx, range)}
                                                  className="px-3 sm:px-4 md:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-bold text-primary-700 bg-primary-50 rounded-lg sm:rounded-xl hover:bg-primary-100 active:bg-primary-200 transition-all shadow-md hover:shadow-lg opacity-0 group-hover:opacity-100 border-2 border-primary-200 flex items-center justify-center gap-1.5 sm:gap-2 flex-1 sm:flex-none touch-manipulation"
                                                  title="Edit this time range"
                                                  style={{ WebkitTapHighlightColor: 'transparent' }}
                                                >
                                                  <Edit className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                                  <span>Edit</span>
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    const rangeSlots = rangesToSlots([range]);
                                                    setAvailability(prev => {
                                                      const currentSlots = new Set(prev[day].selectedSlots);
                                                      rangeSlots.forEach(slot => currentSlots.delete(slot));
                                                      return {
                                                        ...prev,
                                                        [day]: { selectedSlots: currentSlots }
                                                      };
                                                    });
                                                  }}
                                                  className="px-3 sm:px-4 md:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-bold text-red-700 bg-red-50 rounded-lg sm:rounded-xl hover:bg-red-100 active:bg-red-200 transition-all shadow-md hover:shadow-lg opacity-0 group-hover:opacity-100 border-2 border-red-200 flex items-center justify-center gap-1.5 sm:gap-2 flex-1 sm:flex-none touch-manipulation"
                                                  title="Remove this time range"
                                                  style={{ WebkitTapHighlightColor: 'transparent' }}
                                                >
                                                  <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                                  <span>Remove</span>
                                                </button>
                                              </>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })()}

                      </div>
                    )}
                  </div>

                  {!isEditing && hasAnySelected && (
                    <div className="p-4">
                      {(() => {
                        const ranges = slotsToRanges(selectedSlots);
                        // Apply hour filter only when a filter is active
                        let filteredRanges = ranges;
                        if (isFilterActive) {
                          filteredRanges = ranges.filter(range => {
                            const startHour = parseInt(range.start_time.split(':')[0], 10);
                            const endHour = parseInt(range.end_time.split(':')[0], 10);
                            return startHour >= filterStartHour && endHour <= filterEndHour + 1;
                          });
                        }

                        // If in hourly view, group ranges by hour
                        if (displayMode === 'hourly' && filteredRanges.length > 0) {
                          // Group consecutive hours together for cleaner display
                          const hourlyGroups: { hour: number; ranges: typeof filteredRanges }[] = [];
                          filteredRanges.forEach(range => {
                            const startHour = parseInt(range.start_time.split(':')[0], 10);
                            const endHour = parseInt(range.end_time.split(':')[0], 10);

                            // Find if this range fits into an existing hour group
                            let added = false;
                            for (let hour = startHour; hour <= endHour; hour++) {
                              const existingGroup = hourlyGroups.find(g => g.hour === hour);
                              if (existingGroup && !existingGroup.ranges.includes(range)) {
                                existingGroup.ranges.push(range);
                                added = true;
                                break;
                              }
                            }

                            if (!added) {
                              // Create new group for the start hour
                              hourlyGroups.push({ hour: startHour, ranges: [range] });
                            }
                          });

                          return (
                            <div className="space-y-2">
                              <div className="text-xs text-slate-500 mb-2 font-medium">
                                Available Slots:
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {hourlyGroups.map((group, idx) => {
                                  const hourRanges = group.ranges;
                                  const allHours = new Set<number>();
                                  hourRanges.forEach(range => {
                                    const startHour = parseInt(range.start_time.split(':')[0], 10);
                                    const endHour = parseInt(range.end_time.split(':')[0], 10);
                                    for (let h = startHour; h < endHour; h++) {
                                      allHours.add(h);
                                    }
                                  });

                                  // Display as hour range if consecutive, otherwise individual hours
                                  const sortedHours = Array.from(allHours).sort((a, b) => a - b);
                                  const hourDisplay = sortedHours.map(h =>
                                    h >= 12 ? `${h === 12 ? 12 : h - 12} PM` : `${h === 0 ? 12 : h} AM`
                                  ).join(', ');

                                  return (
                                    <div key={idx} className="flex flex-wrap gap-2">
                                      {hourRanges.map((range, rIdx) => (
                                        <span
                                          key={rIdx}
                                          className="px-3 py-1.5 bg-gradient-to-r from-primary-100 via-primary-100/50 to-primary-100 text-primary-800 rounded-lg text-sm font-medium border border-primary-200 shadow-sm"
                                        >
                                          {range.start_time} - {range.end_time}
                                        </span>
                                      ))}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        }

                        // 30-minute view: show all ranges
                        return filteredRanges.length > 0 ? (
                          <div className="space-y-2">
                            <div className="text-xs text-slate-500 mb-2 font-medium">
                              Available Time Slots:
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {filteredRanges.map((range, idx) => (
                                <span
                                  key={idx}
                                  className="px-3 py-1.5 bg-gradient-to-r from-primary-100 via-primary-100/50 to-primary-100 text-primary-800 rounded-lg text-sm font-medium border border-primary-200 shadow-sm"
                                >
                                  {range.start_time} - {range.end_time}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-4 text-slate-500 text-sm bg-slate-50 rounded-lg border border-slate-200">
                            No availability in the filtered range
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {!isEditing && !hasAnySelected && (
                    <div className="p-4 text-slate-500 text-sm">
                      No availability set for this day
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {/* Change request feature removed */}

      {/* Schedule Summary */}
      <Card className="p-5 sm:p-6 bg-gradient-to-br from-white to-slate-50 rounded-xl sm:rounded-2xl shadow-xl border border-slate-200/50 hover:shadow-2xl transition-all duration-300 -mx-2 sm:-mx-3 md:mx-0">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl shadow-lg">
            <Calendar className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
          </div>
          <h2 className="text-lg sm:text-xl md:text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">Schedule Summary</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-primary-50 via-primary-100/50 to-primary-50 p-4 sm:p-5 rounded-xl border-2 border-primary-200/50 shadow-lg hover:shadow-xl transition-all">
            <h3 className="text-xs sm:text-sm font-semibold text-slate-600 uppercase tracking-wide mb-2">Available Days</h3>
            <p className="text-2xl sm:text-3xl font-bold text-primary-700">
              {Object.values(availability).filter((day: DayAvailability) => day.selectedSlots.size > 0).length}
            </p>
            <p className="text-xs sm:text-sm text-primary-600 mt-1">out of 7 days</p>
          </div>

          <div className="bg-gradient-to-br from-primary-50 via-primary-100/50 to-primary-50 p-4 sm:p-5 rounded-xl border-2 border-primary-200/50 shadow-lg hover:shadow-xl transition-all">
            <h3 className="text-xs sm:text-sm font-semibold text-slate-600 uppercase tracking-wide mb-2">Total Hours</h3>
            <p className="text-2xl sm:text-3xl font-bold text-primary-700">
              {(
                Object.values(availability)
                  .reduce((total: number, day: DayAvailability) => {
                    // Each slot is 30 minutes = 0.5 hours
                    return total + (day.selectedSlots.size * 0.5);
                  }, 0) as number
              ).toFixed(1)}
            </p>
            <p className="text-xs sm:text-sm text-primary-600 mt-1">hours per week</p>
          </div>

          <div className="bg-gradient-to-br from-primary-50 via-primary-100/50 to-primary-50 p-4 sm:p-5 rounded-xl border-2 border-primary-200/50 shadow-lg hover:shadow-xl transition-all">
            <h3 className="text-xs sm:text-sm font-semibold text-slate-600 uppercase tracking-wide mb-2">Total Slots</h3>
            <p className="text-2xl sm:text-3xl font-bold text-primary-700">
              {displayMode === 'hourly'
                ? (() => {
                  // Count total slots (in hourly view, each hour counts as 1 slot if both :00 and :30 are selected)
                  const allHourSlots = TIME_SLOTS.filter(slot => {
                    const [, minutes] = slot.split(':');
                    return minutes === '00';
                  });

                  return Object.values(availability).reduce((total: number, day: DayAvailability) => {
                    const slotsSelected = allHourSlots.filter(slot => {
                      const [hours] = slot.split(':');
                      const hourSlot = `${hours}:00`;
                      const halfHourSlot = `${hours}:30`;
                      return day.selectedSlots.has(hourSlot) && day.selectedSlots.has(halfHourSlot);
                    }).length;
                    return total + slotsSelected;
                  }, 0);
                })()
                : Object.values(availability)
                  .reduce((total: number, day: DayAvailability) => total + day.selectedSlots.size, 0)
              }
            </p>
            <p className="text-xs sm:text-sm text-primary-600 mt-1">
              {displayMode === 'hourly' ? 'slots selected (hourly)' : '30-min slots selected'}
            </p>
          </div>
        </div>
      </Card>
    </div >
  );
};

export default AvailabilityScheduling;