import React, { useState, useEffect, useRef } from 'react';
import apiClient from '../../services/api';
import { X, Calendar, AlarmClock, MessageSquare, Send } from 'lucide-react';

interface Props {
  open: boolean;
  bookingId: number;
  bookingContext?: {
    subject?: string;
    currentDate?: string;
    currentTime?: string;
    currentDuration?: number;
    tutorId?: number;
  };
  onClose: () => void;
  onSuccess?: () => void;
}

const parseToMin = (t: string): number => {
  const parts = (t || '').split(':');
  return (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
};

const fmtMin = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

const genSlots = (start: string, end: string, selectedDate: string): string[] => {
  const s = parseToMin(start), e = parseToMin(end);
  if (isNaN(s) || isNaN(e) || e <= s) return [];
  const today = new Date().toISOString().split('T')[0];
  const isToday = selectedDate === today;
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const slots: string[] = [];
  for (let m = s; m <= e; m += 30) {
    if (!isToday || m > nowMin + 30) slots.push(fmtMin(m));
  }
  return slots;
};

const slotFree = (startTime: string, hours: number, existing: any[]): boolean => {
  const s = parseToMin(startTime), e = s + hours * 60;
  return existing.every(b => {
    const bs = parseToMin(b.time), be = bs + (b.duration || 0) * 60;
    return !(s < be && e > bs);
  });
};

const RescheduleModal: React.FC<Props> = ({ open, bookingId, bookingContext, onClose, onSuccess }) => {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState<number | undefined>(undefined);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [availability, setAvailability] = useState<any[]>([]);
  const [existingBookings, setExistingBookings] = useState<any[]>([]);
  const [availableTimeSlots, setAvailableTimeSlots] = useState<string[]>([]);
  const [allowedDurations, setAllowedDurations] = useState<number[]>([]);
  const [maxAllowedMinutes, setMaxAllowedMinutes] = useState(0);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [resolvedTutorId, setResolvedTutorId] = useState<number | undefined>(undefined);
  const [timeDropdownOpen, setTimeDropdownOpen] = useState(false);
  const timeDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      setDate('');
      setTime('');
      setDuration(undefined);
      setReason('');
      setTimeDropdownOpen(false);
      return;
    }
    if (bookingContext?.currentDuration !== undefined) {
      setDuration(Number(bookingContext.currentDuration));
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      setResolvedTutorId(undefined);
      setAvailability([]);
      return;
    }
    const fetchAvailability = (tid: number) => {
      setResolvedTutorId(tid);
      apiClient.get(`/tutors/${tid}/availability`)
        .then(r => setAvailability(Array.isArray(r.data) ? r.data : []))
        .catch(() => setAvailability([]));
    };
    const tid = bookingContext?.tutorId;
    if (tid) {
      fetchAvailability(tid);
      return;
    }
    setAvailability([]);
    apiClient.get('/users/me/bookings')
      .then(r => {
        const list: any[] = Array.isArray(r.data) ? r.data : [];
        const found = list.find((b: any) => b.id === bookingId);
        const id = found?.tutor?.tutor_id ?? (found as any)?.tutor_id;
        if (id) fetchAvailability(Number(id));
      })
      .catch(() => {});
  }, [open, bookingContext?.tutorId, bookingId]);

  useEffect(() => {
    if (!timeDropdownOpen) return;
    const handle = (e: MouseEvent) => {
      if (timeDropdownRef.current && !timeDropdownRef.current.contains(e.target as Node)) {
        setTimeDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [timeDropdownOpen]);

  useEffect(() => {
    if (!date || !resolvedTutorId) { setExistingBookings([]); return; }
    setLoadingBookings(true);
    apiClient.get(`/tutors/${resolvedTutorId}/booking-requests`)
      .then(r => {
        const all: any[] = Array.isArray(r.data) ? r.data : (r.data?.data || []);
        setExistingBookings(all.filter((b: any) => {
          const bd = new Date(b.date).toISOString().split('T')[0];
          return bd === date && ['pending', 'upcoming', 'confirmed'].includes((b.status || '').toLowerCase()) && b.id !== bookingId;
        }));
      })
      .catch(() => setExistingBookings([]))
      .finally(() => setLoadingBookings(false));
  }, [date, resolvedTutorId, bookingId]);

  useEffect(() => {
    if (!date || !availability.length) { setAvailableTimeSlots([]); return; }
    const dow = new Date(date).toLocaleDateString('en-US', { weekday: 'long' });
    const blocks = availability.filter((a: any) => a.day_of_week.toLowerCase() === dow.toLowerCase());
    if (!blocks.length) { setAvailableTimeSlots([]); return; }
    const raw = blocks.flatMap((b: any) => genSlots(b.start_time, b.end_time, date));
    const unique = Array.from(new Set(raw)).sort();
    const filtered = unique.filter(slot => {
      const sMin = parseToMin(slot);
      const durMin = (duration || 0) * 60;
      if (durMin > 0) {
        const fits = blocks.some((b: any) => sMin >= parseToMin(b.start_time) && sMin + durMin <= parseToMin(b.end_time));
        if (!fits) return false;
        return slotFree(slot, duration!, existingBookings);
      }
      return true;
    });
    setAvailableTimeSlots(filtered);
  }, [date, duration, availability, existingBookings]);

  useEffect(() => {
    if (time && availableTimeSlots.length > 0 && !availableTimeSlots.includes(time)) setTime('');
  }, [availableTimeSlots]);

  useEffect(() => {
    if (!availability.length || !date) { setAllowedDurations([]); setMaxAllowedMinutes(0); return; }
    const dow = new Date(date).toLocaleDateString('en-US', { weekday: 'long' });
    const blocks = availability.filter((a: any) => a.day_of_week.toLowerCase() === dow.toLowerCase());
    if (!blocks.length) { setAllowedDurations([]); setMaxAllowedMinutes(0); return; }
    let maxMins = 0;
    if (time) {
      const tMin = parseToMin(time);
      const block = blocks.find((b: any) => tMin >= parseToMin(b.start_time) && tMin < parseToMin(b.end_time));
      if (block) {
        maxMins = parseToMin(block.end_time) - tMin;
        for (const bk of existingBookings) {
          const bs = parseToMin(bk.time);
          if (bs > tMin && bs < parseToMin(block.end_time)) maxMins = Math.min(maxMins, bs - tMin);
        }
      }
    } else {
      blocks.forEach((b: any) => {
        let period = parseToMin(b.end_time) - parseToMin(b.start_time);
        for (const bk of existingBookings) {
          const bs = parseToMin(bk.time), be = bs + (bk.duration || 0) * 60;
          if (bs < parseToMin(b.end_time) && be > parseToMin(b.start_time)) {
            const before = bs > parseToMin(b.start_time) ? bs - parseToMin(b.start_time) : 0;
            const after = be < parseToMin(b.end_time) ? parseToMin(b.end_time) - be : 0;
            period = Math.min(period, Math.max(before, after));
          }
        }
        if (period > maxMins) maxMins = period;
      });
    }
    setMaxAllowedMinutes(maxMins);
    const durations: number[] = [];
    for (let h = 0.5; h <= maxMins / 60; h += 0.5) durations.push(Math.round(h * 2) / 2);
    setAllowedDurations(durations);
  }, [time, date, availability, existingBookings]);

  if (!open) return null;

  const notify = (window as any).__notify as ((msg: string, type?: 'success' | 'error' | 'info') => void) | undefined;

  const submit = async () => {
    if (!date || !time) { notify?.('Please select a date and time', 'error'); return; }
    setLoading(true);
    try {
      const payload: any = { booking_id: bookingId, proposedDate: date, proposedTime: time };
      if (duration) payload.proposedDuration = duration;
      if (reason) payload.reason = reason;
      const res = await apiClient.post('/reschedules', payload);
      if (!res.data?.success) throw new Error(res.data?.message || 'Failed to send proposal');
      notify?.('Reschedule proposal sent', 'success');
      onSuccess?.();
      onClose();
    } catch (e: any) {
      notify?.(e?.response?.data?.message || 'Failed to send proposal', 'error');
    } finally {
      setLoading(false);
    }
  };

  const dayBlocks = date && availability.length
    ? availability.filter((a: any) => a.day_of_week.toLowerCase() === new Date(date).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase())
    : [];

  const origDate = bookingContext?.currentDate
    ? new Date(bookingContext.currentDate).toISOString().split('T')[0]
    : undefined;
  const origDuration = bookingContext?.currentDuration !== undefined
    ? Number(bookingContext.currentDuration)
    : undefined;
  const dateMatches = Boolean(date && origDate && date === origDate);
  const timeMatches = Boolean(
    time && bookingContext?.currentTime &&
    parseToMin(time) === parseToMin(bookingContext.currentTime)
  );
  const durationMatches = origDuration === undefined
    ? true
    : duration !== undefined && Number(duration) === origDuration;
  const isSameAsOriginal = dateMatches && timeMatches && durationMatches;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[95dvh] sm:max-h-[90vh]">

        {/* Header */}
        <div className="relative bg-gradient-to-r from-primary-600 to-primary-700 px-4 sm:px-5 py-3.5 sm:py-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white leading-tight">Propose Reschedule</h3>
              {bookingContext?.subject && (
                <p className="text-primary-200 text-xs mt-0.5 font-medium">{bookingContext.subject}</p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors">
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Current session info */}
        {(bookingContext?.currentDate || bookingContext?.currentTime) && (
          <div className="mx-4 sm:mx-5 mt-3 sm:mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5">
            <AlarmClock className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-amber-700">
              <span className="font-semibold block mb-0.5">Currently scheduled</span>
              {bookingContext.currentDate && (
                <span>{new Date(bookingContext.currentDate).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
              )}
              {bookingContext.currentTime && <span> · {bookingContext.currentTime}</span>}
            </div>
          </div>
        )}

        {/* Form */}
        <div className="px-4 sm:px-5 py-3 sm:py-4 space-y-3 sm:space-y-4 overflow-y-auto flex-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

            {/* Date */}
            <div className="space-y-2">
              <div className="flex items-center min-h-[1.5rem]">
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <svg className="w-4 h-4 text-sky-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  New Date
                </label>
              </div>
              <div className="relative">
                <div className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => { setDate(e.target.value); setTime(''); }}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full border-2 border-slate-300 bg-white hover:border-sky-400 pl-10 sm:pl-12 pr-3 sm:pr-4 py-2.5 sm:py-3.5 rounded-lg sm:rounded-xl focus:ring-4 focus:ring-sky-200 focus:border-sky-500 transition-all text-sm sm:text-base font-medium text-slate-700"
                />
              </div>
              {date && !availableTimeSlots.length && !loadingBookings && (
                <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-2 rounded-lg flex items-start gap-2">
                  <svg className="w-4 h-4 flex-shrink-0 mt-px" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                  <span>No available times on this date</span>
                </div>
              )}
            </div>

            {/* Time */}
            <div className="space-y-2">
              <div className="flex items-center justify-between min-h-[1.5rem] gap-1 flex-wrap">
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <svg className="w-4 h-4 text-indigo-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  New Time
                </label>
                {availableTimeSlots.length > 0 && !loadingBookings && (
                  <span className="text-xs font-normal text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full flex-shrink-0 whitespace-nowrap">{availableTimeSlots.length} slots</span>
                )}
                {loadingBookings && (
                  <span className="text-xs text-slate-400 flex items-center gap-1 flex-shrink-0 whitespace-nowrap">
                    <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
                    Checking...
                  </span>
                )}
              </div>
              <div ref={timeDropdownRef}>
                <button
                  type="button"
                  disabled={!date}
                  onClick={() => date && setTimeDropdownOpen(o => !o)}
                  className={`w-full border-2 text-left flex items-center gap-2 pl-9 pr-3 py-2.5 sm:py-3 rounded-lg sm:rounded-xl transition-all text-sm font-medium ${
                    !date
                      ? 'border-slate-200 bg-slate-100 cursor-not-allowed opacity-60 text-slate-400'
                      : timeDropdownOpen
                      ? 'border-indigo-500 ring-4 ring-indigo-100 bg-white text-slate-700'
                      : 'border-slate-300 bg-white hover:border-indigo-400 text-slate-700'
                  }`}
                >
                  <svg className="w-4 h-4 text-slate-400 flex-shrink-0 -ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className={`flex-1 ${!time ? 'text-slate-400' : ''}`}>{time || 'Select time'}</span>
                  <svg className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform duration-200 ${timeDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {timeDropdownOpen && (
                  <div className="mt-1 border-2 border-indigo-200 rounded-xl bg-white shadow-lg overflow-hidden">
                    <div className="max-h-44 overflow-y-auto divide-y divide-slate-100">
                      {availableTimeSlots.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-slate-400 text-center">No available slots</div>
                      ) : (
                        availableTimeSlots.map(slot => (
                          <button
                            key={slot}
                            type="button"
                            onClick={() => { setTime(slot); setTimeDropdownOpen(false); }}
                            className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                              time === slot ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            {slot}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
              {date && dayBlocks.length > 0 && (() => {
                if (time) {
                  const tMin = parseToMin(time);
                  const block = dayBlocks.find((b: any) => tMin >= parseToMin(b.start_time) && tMin < parseToMin(b.end_time));
                  if (block) return <div className="text-xs text-slate-500 truncate"><span className="font-semibold">Avail:</span> {block.start_time}–{block.end_time}</div>;
                }
                return dayBlocks.map((b: any, i: number) => (
                  <div key={i} className="text-xs text-slate-500 truncate"><span className="font-semibold">Avail:</span> {b.start_time}–{b.end_time}</div>
                ));
              })()}
              {!date && <p className="text-xs text-slate-500">Please select a date first</p>}
              {date && duration && duration > 0 && availableTimeSlots.length === 0 && !loadingBookings && (
                <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                  No available slots for this duration on the selected date
                </p>
              )}
            </div>

            {/* Duration — fixed from original booking */}
            <div className="space-y-2 sm:col-span-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <svg className="w-4 h-4 text-sky-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Duration
                <span className="ml-auto flex items-center gap-1 text-xs font-normal text-slate-400">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                  Fixed from booking
                </span>
              </label>
              <div className="relative">
                <div className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="w-full border-2 border-slate-200 bg-slate-50 pl-10 sm:pl-12 pr-10 sm:pr-12 py-2.5 sm:py-3 rounded-lg sm:rounded-xl text-sm font-medium text-slate-600 select-none">
                  {duration !== undefined
                    ? (duration % 1 === 0 ? `${duration} hr${duration !== 1 ? 's' : ''}` : `${duration} hr`)
                    : '—'}
                </div>
                <div className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                  <svg className="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                </div>
              </div>
            </div>
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <MessageSquare className="w-4 h-4 text-slate-500 flex-shrink-0" />
              Reason
              <span className="text-xs font-normal text-slate-400">— optional</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Let them know why you need to reschedule…"
              rows={3}
              className="w-full border-2 border-slate-300 bg-white hover:border-slate-400 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg sm:rounded-xl focus:ring-4 focus:ring-slate-200 focus:border-slate-500 transition-all text-sm font-medium text-slate-700 resize-none"
            />
          </div>
        </div>

        {/* Same-as-original warning */}
        {isSameAsOriginal && (
          <div className="mx-4 sm:mx-5 mb-2 sm:mb-3 flex items-start gap-2.5 bg-amber-50 border border-amber-300 rounded-xl px-3 sm:px-3.5 py-2.5 sm:py-3">
            <svg className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <p className="text-xs text-amber-800 leading-relaxed">
              <span className="font-semibold block mb-0.5">Same as current schedule</span>
              The date, time, and duration you selected match the existing session. Please choose at least one different value to propose a reschedule.
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-2 flex gap-2 sm:gap-2.5 flex-shrink-0 border-t border-slate-100" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 1rem))' }}>
          <button onClick={onClose} className="flex-1 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition-colors">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={loading || !date || !time || isSameAsOriginal}
            className="flex-[2] px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white font-semibold text-sm shadow-md shadow-primary-200/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 active:scale-95"
          >
            <Send className="w-4 h-4" />
            {loading ? 'Sending…' : 'Send Proposal'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RescheduleModal;
