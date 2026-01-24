import React, { useState, useMemo, useEffect, useRef } from 'react';
import { GraduationCap, Lock, Mail, User, BookOpen, GraduationCap as YearLevelIcon, Info, Image as ImageIcon, QrCode, FileText, Upload, Plus, Trash2, CheckCircle, Info as InfoIcon, X } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import apiClient from '../../services/api';
import { mapRoleToStorageKey, setRoleAuth } from '../../utils/authRole';
import { useToast } from '../ui/Toast';
import * as nsfwjs from 'nsfwjs';
import { CheckCircleIcon } from '../icons/CheckCircleIcon';
import { DocumentArrowUpIcon } from '../icons/DocumentArrowUpIcon';

interface TimeSlot {
  startTime: string;
  endTime: string;
}

interface DayAvailability {
  slots: TimeSlot[];
}

const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const TuteeBecomeTutor: React.FC = () => {
  const { user } = useAuth();
  const { notify } = useToast();

  // Pre-filled values from tutee profile
  const tuteeEmail = user?.email || '';
  const tuteeFullName = user?.name || '';
  const tuteeCourseId = (user as any)?.course_id || '';
  const tuteeCourseName = (user as any)?.course?.course_name || (user as any)?.course_name || '';
  const tuteeYearLevel = (user as any)?.year_level ? String((user as any).year_level) : '';
  const tuteeUniversityId = (user as any)?.university_id || '';
  const tuteeUniversityName = (user as any)?.university?.name || (user as any)?.university_name || '';

  // Form State
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [bio, setBio] = useState('');
  const [gcashNumber, setGcashNumber] = useState('');
  const [sessionRate, setSessionRate] = useState('');
  const [selectedSubjects, setSelectedSubjects] = useState<Set<string>>(new Set<string>());
  const [subjectToAdd, setSubjectToAdd] = useState<string>('');
  const [availableSubjects, setAvailableSubjects] = useState<{ subject_id: number; subject_name: string }[]>([]);
  const [otherSubject, setOtherSubject] = useState('');
  const [subjectFilesMap, setSubjectFilesMap] = useState<Record<string, File[]>>({});
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [gcashQRImage, setGcashQRImage] = useState<File | null>(null);
  const [availability, setAvailability] = useState<Record<string, DayAvailability>>({});

  // UI State
  const [isFileSelecting, setIsFileSelecting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [termsViewed, setTermsViewed] = useState(false);
  const [termsScrollProgress, setTermsScrollProgress] = useState(0);
  const [nsfwModel, setNsfwModel] = useState<any>(null);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [isLoadingModel, setIsLoadingModel] = useState(false);
  const modelLoadingPromiseRef = useRef<Promise<any> | null>(null);
  const [dayToAdd, setDayToAdd] = useState<string>('');

  const [warningModal, setWarningModal] = useState<{
    show: boolean;
    message: string;
    type: 'warning' | 'success';
  }>({ show: false, message: '', type: 'warning' });

  const [confirmModal, setConfirmModal] = useState<{
    show: boolean;
    message: string;
    onConfirm: () => void;
  }>({ show: false, message: '', onConfirm: () => { } });

  // Validation Logic
  const sessionRateError = useMemo(() => {
    if (!sessionRate) return null;
    const rate = Number(sessionRate);
    if (isNaN(rate)) return null;
    if (rate < 100 || rate > 800) {
      return 'Session rate must be between ₱100 and ₱800 per hour.';
    }
    return null;
  }, [sessionRate]);

  const addedDays = useMemo(() => Object.keys(availability), [availability]);
  const remainingDays = useMemo(() => daysOfWeek.filter(d => !addedDays.includes(d)), [addedDays]);

  // Effects
  useEffect(() => {
    if (tuteeUniversityId && tuteeCourseId) {
      (async () => {
        try {
          const params = {
            university_id: tuteeUniversityId,
            course_id: Number(tuteeCourseId)
          };
          const res = await apiClient.get('/subjects', { params });
          setAvailableSubjects(res.data || []);
        } catch (e) {
          console.error('Error fetching subjects:', e);
        }
      })();
    }
  }, [tuteeUniversityId, tuteeCourseId]);

  // Availability Helpers
  const normalizeTime = (raw: string) => {
    if (!raw) return raw;
    const trimmed = raw.trim();
    const [hhmm] = trimmed.split('.');
    const parts = hhmm.split(':').map(p => p.replace(/\D/g, ''));
    const hh = parts[0] ? String(Number(parts[0])).padStart(2, '0') : '00';
    const mm = parts[1] ? String(Math.min(59, Number(parts[1]))).padStart(2, '0') : '00';
    return `${hh}:${mm}`;
  };

  const toMinutes = (time: string) => {
    const t = normalizeTime(time);
    const [h, m] = t.split(':').map(Number);
    return h * 60 + (m || 0);
  };

  const minutesToTime = (mins: number) => {
    const hh = Math.floor(mins / 60).toString().padStart(2, '0');
    const mm = (mins % 60).toString().padStart(2, '0');
    return `${hh}:${mm}`;
  };

  const timesOverlap = (aStart: string, aEnd: string, bStart: string, bEnd: string) => {
    const aS = toMinutes(aStart);
    const aE = toMinutes(aEnd);
    const bS = toMinutes(bStart);
    const bE = toMinutes(bEnd);
    return aS < bE && bS < aE;
  };

  const findNonOverlappingSlotFromExisting = (
    existingSlots: { startTime: string; endTime: string }[],
    durationMins = 60,
    earliestMinute = 7 * 60,
    latestMinute = 22 * 60,
    step = 15
  ) => {
    const normalized = existingSlots.map(s => ({
      startTime: normalizeTime(s.startTime),
      endTime: normalizeTime(s.endTime)
    })).sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));

    for (let i = 0; i <= normalized.length; i++) {
      let gapStart, gapEnd;
      if (i === 0) {
        gapStart = earliestMinute;
        gapEnd = normalized.length > 0 ? toMinutes(normalized[0].startTime) : latestMinute;
      } else if (i === normalized.length) {
        gapStart = toMinutes(normalized[normalized.length - 1].endTime);
        gapEnd = latestMinute;
      } else {
        gapStart = toMinutes(normalized[i - 1].endTime);
        gapEnd = toMinutes(normalized[i].startTime);
      }

      if (gapEnd - gapStart >= durationMins) {
        const slotStart = gapStart;
        const slotEnd = slotStart + durationMins;
        if (slotEnd <= gapEnd) {
          const cand = { startTime: minutesToTime(slotStart), endTime: minutesToTime(slotEnd) };
          const conflict = normalized.some(s => timesOverlap(s.startTime, s.endTime, cand.startTime, cand.endTime));
          if (!conflict) return cand;
        }
      }
    }
    return null;
  };

  const addDay = (day: string) => {
    if (!day) return;
    setAvailability(prev => ({ ...prev, [day]: { slots: [{ startTime: '09:00', endTime: '10:00' }] } }));
    setDayToAdd('');
  };

  const removeDay = (day: string) => {
    setConfirmModal({
      show: true,
      message: `Remove ${day} and all its time slots?`,
      onConfirm: () => {
        setAvailability(prev => {
          const next = { ...prev };
          delete next[day];
          return next;
        });
      }
    });
  };

  const addTimeSlot = (day: string, durationMins = 60) => {
    setAvailability(prev => {
      const next = { ...prev };
      const current = next[day] ? { slots: [...next[day].slots] } : { slots: [] };
      const candidate = findNonOverlappingSlotFromExisting(current.slots, durationMins);
      if (!candidate) {
        notify('No available non-overlapping slot found for that day.', 'error');
        return prev;
      }
      current.slots.push(candidate);
      current.slots.sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));
      next[day] = current;
      return next;
    });
  };

  const updateSlotTime = (day: string, index: number, type: 'startTime' | 'endTime', rawValue: string) => {
    const value = normalizeTime(rawValue);
    setAvailability(prev => {
      const next = { ...prev };
      const current = next[day];
      if (!current) return prev;
      const slots = [...current.slots];
      const updatedSlot = { ...slots[index], [type]: value };
      const sMin = toMinutes(updatedSlot.startTime);
      const eMin = toMinutes(updatedSlot.endTime);

      if (eMin <= sMin) {
        if (updatedSlot.startTime.match(/^\d{2}:\d{2}$/) && updatedSlot.endTime.match(/^\d{2}:\d{2}$/)) {
          notify('End time must be after start time', 'error');
        }
        return prev;
      }

      for (let i = 0; i < slots.length; i++) {
        if (i === index) continue;
        if (timesOverlap(updatedSlot.startTime, updatedSlot.endTime, slots[i].startTime, slots[i].endTime)) {
          notify('This time overlaps with another slot.', 'error');
          return prev;
        }
      }

      slots[index] = updatedSlot;
      slots.sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));
      next[day] = { slots };
      return next;
    });
  };

  const removeTimeSlot = (day: string, index: number) => {
    setConfirmModal({
      show: true,
      message: 'Remove this time slot?',
      onConfirm: () => {
        setAvailability(prev => {
          const next = { ...prev };
          const current = next[day];
          if (!current) return prev;
          current.slots = current.slots.filter((_, i) => i !== index);
          if (current.slots.length === 0) delete next[day];
          return next;
        });
      }
    });
  };

  // NSFW & QR Validation
  const loadNsfwModel = async (): Promise<boolean> => {
    if (nsfwModel) return true;
    if (modelLoadingPromiseRef.current) {
      try { await modelLoadingPromiseRef.current; return true; } catch { return false; }
    }
    try {
      setIsLoadingModel(true);
      const loadPromise = nsfwjs.load();
      modelLoadingPromiseRef.current = loadPromise;
      const model = await loadPromise;
      setNsfwModel(model);
      modelLoadingPromiseRef.current = null;
      setIsLoadingModel(false);
      return true;
    } catch (err) {
      modelLoadingPromiseRef.current = null;
      setIsLoadingModel(false);
      notify('Failed to load image analysis model.', 'error');
      return false;
    }
  };

  const analyzeImageContent = async (file: File): Promise<boolean> => {
    const modelLoaded = await loadNsfwModel();
    if (!modelLoaded || !nsfwModel) return false;
    try {
      setIsAnalyzingImage(true);
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      return new Promise((resolve) => {
        img.onload = async () => {
          try {
            canvas.width = img.width; canvas.height = img.height;
            ctx?.drawImage(img, 0, 0);
            const imageData = ctx?.getImageData(0, 0, canvas.width, canvas.height);
            if (!imageData) { resolve(false); return; }
            const predictions = await nsfwModel.classify(imageData);
            const [neutral, drawing, hentai, porn, sexy] = predictions;
            const isInappropriate = porn.probability > 0.2 || hentai.probability > 0.2 || sexy.probability > 0.3 || sexy.probability > (neutral.probability + 0.2) || drawing.probability > 0.6;
            if (isInappropriate) {
              setWarningModal({ show: true, message: 'Inappropriate content detected. Please choose a different image.', type: 'warning' });
              resolve(false);
            } else {
              setWarningModal({ show: true, message: 'Image analysis passed!', type: 'success' });
              resolve(true);
            }
          } catch { resolve(false); } finally { setIsAnalyzingImage(false); }
        };
        img.src = URL.createObjectURL(file);
      });
    } catch { setIsAnalyzingImage(false); return false; }
  };

  const validateQRCode = async (file: File, isProfile: boolean = false): Promise<boolean> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(false); return; }
        canvas.width = img.width; canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let black = 0, total = data.length / 4;
        for (let i = 0; i < data.length; i += 4) { if ((data[i] + data[i + 1] + data[i + 2]) / 3 < 128) black++; }
        const ratio = black / total;
        const isSquare = Math.abs(img.width - img.height) / Math.max(img.width, img.height) < 0.2;
        const hasQRColor = ratio > 0.2 && ratio < 0.8;
        const isQR = isSquare && hasQRColor;
        if (isProfile && isQR) {
          notify('Profile images cannot be QR codes.', 'error');
          resolve(true); // returning true means it IS a QR code (invalid for profile)
        } else {
          resolve(isQR);
        }
      };
      img.src = URL.createObjectURL(file);
    });
  };

  // Form Handlers
  const handleProfileImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) { notify('Invalid file type.', 'error'); return; }
      const isAppropriate = await analyzeImageContent(file);
      if (!isAppropriate) { e.target.value = ''; return; }
      const isQR = await validateQRCode(file, true);
      if (isQR) { e.target.value = ''; return; }
      setProfileImage(file);
    }
  };

  const handleGcashQRChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const isQR = await validateQRCode(file);
      if (isQR) {
        setGcashQRImage(file);
        setWarningModal({ show: true, message: 'GCash QR uploaded!', type: 'success' });
      } else {
        setWarningModal({ show: true, message: 'Invalid GCash QR code.', type: 'warning' });
        e.target.value = '';
      }
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsFileSelecting(true);
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setUploadedFiles(prev => [...prev, ...files]);
      notify(`${files.length} file(s) added.`, 'success');
    }
    setTimeout(() => { if (e.target) e.target.value = ''; setIsFileSelecting(false); }, 100);
  };

  const handleAddSubject = () => {
    if (subjectToAdd && !selectedSubjects.has(subjectToAdd)) {
      setSelectedSubjects(prev => new Set(prev).add(subjectToAdd));
      setSubjectToAdd('');
    }
  };

  const handleRemoveSubject = (s: string) => {
    setSelectedSubjects(prev => { const n = new Set(prev); n.delete(s); return n; });
    setSubjectFilesMap(prev => { const n = { ...prev }; delete n[s]; return n; });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || password.length < 7) { notify('Password must be at least 7 characters.', 'error'); return; }
    if (!gcashNumber || gcashNumber.length !== 11) { notify('Invalid GCash number.', 'error'); return; }
    if (selectedSubjects.size === 0) { notify('Select at least one subject.', 'error'); return; }
    if (!acceptedTerms) { notify('Please accept the terms.', 'error'); return; }
    if (!termsViewed) { notify('Please read the terms first.', 'error'); return; }

    setIsSubmitting(true);
    try {
      const payload = {
        name: tuteeFullName,
        email: tuteeEmail,
        password,
        user_type: 'tutor',
        university_id: tuteeUniversityId,
        course_id: tuteeCourseId,
        bio,
        year_level: Number(tuteeYearLevel),
        gcash_number: gcashNumber,
        SessionRatePerHour: sessionRate ? Number(sessionRate) : undefined,
      };

      const res = await apiClient.post('/auth/register', payload);
      const { user: newUser, accessToken } = res.data;

      if (accessToken && newUser) {
        localStorage.setItem('token', accessToken);
        localStorage.setItem('user', JSON.stringify(newUser));
        setRoleAuth('tutor', newUser, accessToken);
      }

      const tutorId = newUser?.tutor_profile?.tutor_id || res.data?.tutor_id;

      if (profileImage) {
        const pf = new FormData(); pf.append('file', profileImage);
        await apiClient.post(`/tutors/${tutorId}/profile-image`, pf);
      }
      if (gcashQRImage) {
        const gf = new FormData(); gf.append('file', gcashQRImage);
        await apiClient.post(`/tutors/${tutorId}/gcash-qr`, gf);
      }
      if (uploadedFiles.length > 0) {
        const df = new FormData(); uploadedFiles.forEach(f => df.append('files', f));
        await apiClient.post(`/tutors/${tutorId}/documents`, df);
      }

      const slots = Object.entries(availability).flatMap(([day, d]) =>
        d.slots.map(s => ({ day_of_week: day, start_time: s.startTime, end_time: s.endTime }))
      );
      if (slots.length > 0) await apiClient.post(`/tutors/${tutorId}/availability`, { slots });

      await apiClient.post(`/tutors/${tutorId}/subjects`, { subjects: Array.from(selectedSubjects) });

      for (const subject of Array.from(selectedSubjects)) {
        const files = subjectFilesMap[subject] || [];
        if (files.length > 0) {
          const sf = new FormData();
          sf.append('subject_name', subject);
          files.forEach(f => sf.append('files', f));
          await apiClient.post(`/tutors/${tutorId}/subject-application`, sf);
        }
      }

      setIsSubmitted(true);
    } catch (err: any) {
      notify(err.response?.data?.message || 'Submission failed.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-3xl p-8 text-white shadow-2xl relative overflow-hidden group">
        <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center">
            <GraduationCap className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Become a Tutor</h1>
            <p className="text-blue-100">Elevate your academic journey by sharing your expertise.</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Step 1: Pre-filled Info (Read-only) */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
              <User className="w-4 h-4 text-blue-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-800">1. Account Information</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Full Name</label>
              <div className="p-3 bg-slate-50 rounded-xl text-slate-700 font-medium flex items-center gap-2 border border-slate-100">
                {tuteeFullName}
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Email Address</label>
              <div className="p-3 bg-slate-50 rounded-xl text-slate-700 font-medium flex items-center gap-2 border border-slate-100">
                <Mail className="w-4 h-4 text-slate-400" /> {tuteeEmail}
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">University</label>
              <div className="p-3 bg-slate-50 rounded-xl text-slate-700 font-medium flex items-center gap-2 border border-slate-100">
                {tuteeUniversityName}
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Course</label>
              <div className="p-3 bg-slate-50 rounded-xl text-slate-700 font-medium flex items-center gap-2 border border-slate-100">
                <BookOpen className="w-4 h-4 text-slate-400" /> {tuteeCourseName}
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Year Level</label>
              <div className="p-3 bg-slate-50 rounded-xl text-slate-700 font-medium flex items-center gap-2 border border-slate-100">
                <YearLevelIcon className="w-4 h-4 text-slate-400" /> {tuteeYearLevel} Year
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-800 uppercase tracking-wider">New Password <span className="text-red-500">*</span></label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value.slice(0, 21))}
                  className="w-full p-3 bg-white rounded-xl text-slate-700 border border-slate-200 focus:ring-2 focus:ring-blue-500 transition-all pr-10"
                  placeholder="Set tutor password (min 7 chars)"
                  required
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showPassword ? <X className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Step 2: Professional Details */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center">
              <Info className="w-4 h-4 text-indigo-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-800">2. Professional Details</h2>
          </div>
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">GCash Number <span className="text-red-500">*</span></label>
                <input
                  type="tel"
                  value={gcashNumber}
                  onChange={(e) => setGcashNumber(e.target.value.replace(/\D/g, '').slice(0, 11))}
                  className="w-full p-3 bg-white rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500"
                  placeholder="09XXXXXXXXX"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">Session Rate (₱/hour) <span className="text-red-500">*</span></label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">₱</span>
                  <input
                    type="number"
                    value={sessionRate}
                    onChange={(e) => setSessionRate(e.target.value)}
                    className={`w-full p-3 pl-8 bg-white rounded-xl border ${sessionRateError ? 'border-red-500' : 'border-slate-200'} focus:ring-2 focus:ring-indigo-500`}
                    placeholder="e.g. 350"
                  />
                </div>
                {sessionRateError && <p className="text-xs text-red-500">{sessionRateError}</p>}
              </div>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-700">Bio / Tutoring Style</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full p-4 bg-white rounded-2xl border border-slate-200 h-32 focus:ring-2 focus:ring-indigo-500"
                placeholder="Describe your tutoring experience and how you can help fellow students..."
              />
            </div>
          </div>
        </div>

        {/* Step 3: Subjects & Availability */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 h-full">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-8 h-8 bg-sky-50 rounded-lg flex items-center justify-center">
                <BookOpen className="w-4 h-4 text-sky-600" />
              </div>
              <h2 className="text-xl font-bold text-slate-800">3. Subjects</h2>
            </div>
            <div className="space-y-4">
              <div className="flex gap-2">
                <select
                  value={subjectToAdd}
                  onChange={(e) => setSubjectToAdd(e.target.value)}
                  className="flex-1 p-3 bg-slate-50 rounded-xl border border-slate-100"
                >
                  <option value="">Select a subject...</option>
                  {availableSubjects.filter(s => !selectedSubjects.has(s.subject_name)).map(s => (
                    <option key={s.subject_id} value={s.subject_name}>{s.subject_name}</option>
                  ))}
                </select>
                <button type="button" onClick={handleAddSubject} className="p-3 bg-sky-600 text-white rounded-xl hover:bg-sky-700"><Plus className="w-5 h-5" /></button>
              </div>
              <div className="flex flex-wrap gap-2">
                {Array.from(selectedSubjects).map(s => (
                  <span key={s} className="bg-sky-50 text-sky-700 px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-2 group">
                    {s}
                    <button type="button" onClick={() => handleRemoveSubject(s)} className="text-sky-300 hover:text-sky-600 transition-colors"><X className="w-3 h-3" /></button>
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 h-full">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center">
                <Calendar className="w-4 h-4 text-purple-600" />
              </div>
              <h2 className="text-xl font-bold text-slate-800">4. Availability</h2>
            </div>
            <div className="space-y-4">
              <div className="flex gap-2">
                <select value={dayToAdd} onChange={(e) => setDayToAdd(e.target.value)} className="flex-1 p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <option value="">Add a day...</option>
                  {remainingDays.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <button type="button" onClick={() => addDay(dayToAdd)} className="p-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700"><Plus className="w-5 h-5" /></button>
              </div>
              <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                {Object.entries(availability).map(([day, d]) => (
                  <div key={day} className="bg-slate-50 rounded-2xl p-4 border border-slate-100 group">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-bold text-slate-700">{day}</span>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => addTimeSlot(day)} className="text-xs text-purple-600 font-bold hover:underline">Add slot</button>
                        <button type="button" onClick={() => removeDay(day)} className="text-red-500 hover:text-red-700 transition-colors"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                    {d.slots.map((s, idx) => (
                      <div key={idx} className="flex items-center gap-2 mt-2">
                        <input type="time" value={s.startTime} onChange={(e) => updateSlotTime(day, idx, 'startTime', e.target.value)} className="bg-white border rounded-lg p-1 text-xs" />
                        <span className="text-slate-400">-</span>
                        <input type="time" value={s.endTime} onChange={(e) => updateSlotTime(day, idx, 'endTime', e.target.value)} className="bg-white border rounded-lg p-1 text-xs" />
                        <button type="button" onClick={() => removeTimeSlot(day, idx)} className="text-slate-300 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Step 4: Documents */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center">
              <FileText className="w-4 h-4 text-emerald-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-800">5. Verification Documents</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-700 flex items-center gap-2"><ImageIcon className="w-4 h-4" /> Profile Photo</label>
              <div className="relative group/photo h-40 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center cursor-pointer overflow-hidden hover:border-blue-400 hover:bg-blue-50/30 transition-all">
                {profileImage ? (
                  <img src={URL.createObjectURL(profileImage)} className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-slate-300 mb-2" />
                    <span className="text-xs text-slate-400 text-center px-4">Upload professional photo</span>
                  </>
                )}
                <input type="file" accept="image/*" onChange={handleProfileImageChange} className="absolute inset-0 opacity-0 cursor-pointer" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-700 flex items-center gap-2"><QrCode className="w-4 h-4" /> GCash QR Code</label>
              <div className="relative group/qr h-40 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center cursor-pointer overflow-hidden hover:border-emerald-400 hover:bg-emerald-50/30 transition-all">
                {gcashQRImage ? (
                  <img src={URL.createObjectURL(gcashQRImage)} className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                  <>
                    <QrCode className="w-8 h-8 text-slate-300 mb-2" />
                    <span className="text-xs text-slate-400 text-center px-4">Upload payment QR</span>
                  </>
                )}
                <input type="file" accept="image/*" onChange={handleGcashQRChange} className="absolute inset-0 opacity-0 cursor-pointer" />
              </div>
            </div>

            <div className="space-y-2 lg:col-span-full">
              <label className="block text-sm font-semibold text-slate-700 flex items-center gap-2"><FileText className="w-4 h-4" /> Academic Proofs <span className="text-red-500">*</span></label>
              <div className="relative h-32 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/30 transition-all group/doc">
                <Upload className="w-8 h-8 text-slate-300 mb-2 group-hover/doc:text-indigo-400" />
                <span className="text-xs text-slate-400">Drag/Drop or Click to upload transcripts, certificates, student ID</span>
                <input type="file" multiple onChange={handleFileChange} className="absolute inset-0 opacity-0 cursor-pointer" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 py-4">
                {uploadedFiles.map((f, i) => (
                  <div key={i} className="bg-white border text-xs p-2 rounded-xl flex justify-between items-center pr-1">
                    <span className="truncate flex-1 font-medium">{f.name}</span>
                    <button type="button" onClick={() => setUploadedFiles(prev => prev.filter((_, idx) => idx !== i))} className="text-red-300 hover:text-red-600 ml-2"><X className="w-3 h-3" /></button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer & Submit */}
        <div className="bg-white rounded-3xl p-8 shadow-2xl border border-slate-100 text-center space-y-6">
          <div className="flex flex-col items-center gap-4">
            <div className="flex items-center gap-3 bg-slate-50 px-6 py-3 rounded-2xl border border-slate-100">
              <input
                type="checkbox"
                id="terms"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                disabled={!termsViewed}
                className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="terms" className="text-sm font-medium text-slate-700">
                I agree to the <button type="button" onClick={() => setShowTermsModal(true)} className="text-blue-600 underline hover:text-blue-800">Tutor Terms and Conditions</button>
              </label>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !acceptedTerms}
              className={`w-full max-w-sm py-4 px-8 rounded-2xl font-bold text-lg shadow-xl transition-all transform active:scale-95 ${isSubmitting || !acceptedTerms ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:shadow-blue-500/25 hover:shadow-2xl'}`}
            >
              {isSubmitting ? 'Processing Application...' : 'Submit Application'}
            </button>
          </div>
        </div>
      </form>

      {/* Success Modal */}
      {isSubmitted && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[100] animate-in fade-in duration-300 p-4">
          <div className="bg-white rounded-[2rem] p-10 max-w-md w-full text-center shadow-3xl transform animate-in zoom-in slide-in-from-bottom-10 duration-500">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-12 h-12 text-green-600" />
            </div>
            <h2 className="text-3xl font-black text-slate-800 mb-4">You're Awesome!</h2>
            <p className="text-slate-600 mb-8 leading-relaxed">Your tutor application has been successfully submitted. We'll review your credentials and get back to you soon.</p>
            <button onClick={() => window.location.reload()} className="w-full bg-slate-900 text-white font-bold py-4 rounded-2xl hover:bg-slate-800 transition-colors">Return to Dashboard</button>
          </div>
        </div>
      )}

      {/* Terms Modal */}
      {showTermsModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-[2rem] max-w-3xl w-full h-[85vh] flex flex-col shadow-3xl overflow-hidden animate-in zoom-in duration-300">
            <div className="p-8 border-b flex justify-between items-center bg-slate-50">
              <h2 className="text-2xl font-black text-slate-800">Tutor Terms</h2>
              <button onClick={() => setShowTermsModal(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X className="w-6 h-6" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-10 space-y-6 text-slate-600 leading-relaxed" onScroll={(e) => {
              const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
              const progress = (scrollTop / (scrollHeight - clientHeight)) * 100;
              setTermsScrollProgress(progress);
              if (progress > 90) setTermsViewed(true);
            }}>
              <p className="font-bold text-slate-900">Effective Date: October 31, 2025</p>
              <p>By becoming a tutor on TutorFriends, you agree to provide high-quality academic support to your fellow students while maintaining the highest standards of integrity and professionalism.</p>
              <h3 className="font-bold text-slate-800 text-xl">1. Verification Process</h3>
              <p>All applications are manually reviewed by our administrative team. We verify your transcripts, IDs, and certificates to ensure a safe learning environment.</p>
              <h3 className="font-bold text-slate-800 text-xl">2. Conduct & Ethics</h3>
              <p>Tutors must act as mentors. You are expected to guide students toward understanding, not simply provide answers to assignments or exams.</p>
              <h3 className="font-bold text-slate-800 text-xl">3. Payment & Fees</h3>
              <p>TutorFriends facilitates payments via GCash. A service fee of 13% is applied to help us maintain the platform. 87% goes directly to you.</p>
              <div className="h-20"></div> {/* Spacer for scroll end */}
            </div>
            <div className="p-8 border-t bg-slate-50 flex flex-col items-center gap-4">
              <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                <div className="bg-blue-600 h-full transition-all" style={{ width: `${termsScrollProgress}%` }}></div>
              </div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{termsViewed ? 'Verification ready' : 'Please read to the end to proceed'}</p>
              <button
                onClick={() => { setTermsViewed(true); setShowTermsModal(false); }}
                disabled={!termsViewed}
                className={`w-full py-4 rounded-2xl font-black transition-all ${termsViewed ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-400'}`}
              >
                I Understand & Agree
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Warning/Success Toast Modal */}
      {warningModal.show && (
        <div className="fixed bottom-10 right-10 z-[200] animate-in slide-in-from-right duration-500">
          <div className={`p-6 rounded-3xl shadow-3xl border flex items-center gap-4 bg-white ${warningModal.type === 'warning' ? 'border-amber-200' : 'border-emerald-200'}`}>
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${warningModal.type === 'warning' ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}>
              {warningModal.type === 'warning' ? <InfoIcon className="w-6 h-6" /> : <CheckCircle className="w-6 h-6" />}
            </div>
            <div className="flex-1">
              <p className="font-black text-slate-800 text-lg uppercase tracking-tight">{warningModal.type === 'warning' ? 'Warning' : 'Success'}</p>
              <p className="text-sm text-slate-600">{warningModal.message}</p>
            </div>
            <button onClick={() => setWarningModal({ ...warningModal, show: false })} className="p-2 hover:bg-slate-100 rounded-xl transition-colors"><X className="w-4 h-4 text-slate-400" /></button>
          </div>
        </div>
      )}

      {/* Confirm Modal */}
      {confirmModal.show && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-[2rem] p-8 max-w-sm w-full text-center shadow-3xl animate-in zoom-in duration-200">
            <h3 className="text-2xl font-black text-slate-800 mb-4">Are you sure?</h3>
            <p className="text-slate-600 mb-6">{confirmModal.message}</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmModal({ ...confirmModal, show: false })} className="flex-1 py-3 rounded-2xl bg-slate-100 text-slate-600 font-bold hover:bg-slate-200">Cancel</button>
              <button
                onClick={() => { confirmModal.onConfirm(); setConfirmModal({ ...confirmModal, show: false }); }}
                className="flex-1 py-3 rounded-2xl bg-red-600 text-white font-bold hover:bg-red-700 shadow-lg shadow-red-200"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TuteeBecomeTutor;
