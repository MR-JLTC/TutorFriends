import React, { useState, useEffect } from 'react';
import apiClient from '../../services/api';
import Button from '../ui/Button';
import Card from '../ui/Card';
import Modal from '../ui/Modal';
import { useAuth } from '../../hooks/useAuth';
import { useVerification } from '../../context/VerificationContext';
import { FileText, Upload, CheckCircle, Clock, Plus, X, User, Camera, CreditCard, Edit, Info } from 'lucide-react';

interface TutorProfileData {
  profile_photo: string;
  gcash_number: string;
  gcash_qr: string;
}

interface Subject {
  subject_id: number;
  subject_name: string;
}

interface SubjectApplication {
  id: number;
  subject_name: string;
  status: 'pending' | 'approved' | 'rejected';
  admin_notes?: string;
  created_at: string;
  updated_at: string;
  documents?: Array<{
    id: number;
    file_url: string;
    file_name: string;
    file_type: string;
  }>;
}

const ApplicationVerification: React.FC = () => {
  const { user } = useAuth();
  const { isVerified, applicationStatus, adminNotes, refreshStatus } = useVerification();
  const [tutorId, setTutorId] = useState<number | null>(null);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [availableSubjects, setAvailableSubjects] = useState<Subject[]>([]);
  const [subjectToAdd, setSubjectToAdd] = useState('');
  const [otherSubject, setOtherSubject] = useState('');
  const [isCustomInputDisabled, setIsCustomInputDisabled] = useState(false);
  const [documents, setDocuments] = useState<File[]>([]);
  const [showNewSubjectForm, setShowNewSubjectForm] = useState(false);
  const [newSubjectDocuments, setNewSubjectDocuments] = useState<File[]>([]);
  const [subjectApplications, setSubjectApplications] = useState<SubjectApplication[]>([]);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [previewType, setPreviewType] = useState<string>('');

  // New state for profile and payment info
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
  const [existingProfilePhotoUrl, setExistingProfilePhotoUrl] = useState<string>('');
  const [gcashNumber, setGcashNumber] = useState<string>('');
  const [gcashQR, setGcashQR] = useState<File | null>(null);
  const [existingGcashQRUrl, setExistingGcashQRUrl] = useState<string>('');
  const [tutorIdError, setTutorIdError] = useState<string>('');
  const [tutorCourseId, setTutorCourseId] = useState<number | null>(null);

  // Reapplication form state
  const [fullName, setFullName] = useState<string>('');
  const [yearLevel, setYearLevel] = useState<string>('');
  const [sessionRate, setSessionRate] = useState<string>('');
  const [bio, setBio] = useState<string>('');
  const [reapplicationSubjects, setReapplicationSubjects] = useState<Set<string>>(new Set());
  const [subjectFilesMap, setSubjectFilesMap] = useState<Record<string, File[]>>({});
  // Track existing documents from API (for subjects)
  const [existingSubjectDocumentsMap, setExistingSubjectDocumentsMap] = useState<Record<string, Array<{
    id: number;
    file_url: string;
    file_name: string;
    file_type: string;
  }>>>({});
  const [reapplicationDocuments, setReapplicationDocuments] = useState<File[]>([]);
  // Track existing proof documents from API
  const [existingProofDocuments, setExistingProofDocuments] = useState<Array<{
    id: number;
    file_url: string;
    file_name: string;
    file_type: string;
  }>>([]);
  const [reapplicationAvailability, setReapplicationAvailability] = useState<Record<string, DayAvailability>>({});
  const [showReapplicationForm, setShowReapplicationForm] = useState(false);
  const [isSubmittingReapplication, setIsSubmittingReapplication] = useState(false);
  const [dayToAdd, setDayToAdd] = useState<string>('');

  interface DayAvailability {
    slots: Array<{ startTime: string; endTime: string }>;
  }

  useEffect(() => {
    // Refresh application status when component mounts
    if (user?.user_id) {
      refreshStatus();
      fetchTutorId();
    }
  }, [user]);

  // Debug: log application status when it changes
  useEffect(() => {
    console.log('Application Status changed:', applicationStatus);
    console.log('Is Verified:', isVerified);
  }, [applicationStatus, isVerified]);

  const fetchTutorId = async () => {
    if (!user?.user_id) return;
    try {
      const response = await apiClient.get(`/tutors/by-user/${user.user_id}/tutor-id`);
      setTutorId(response.data.tutor_id);
    } catch (error: any) {
      console.error('Failed to fetch tutor ID:', error);
      console.log('Error details:', {
        status: error.response?.status,
        message: error.message,
        responseData: error.response?.data,
        url: error.config?.url
      });
      // If tutor not found, this means the user doesn't have a tutor profile yet
      // This can happen if they were incorrectly identified as a tutor during login
      if (error.response?.status === 404 || error.message?.includes('Tutor not found')) {
        console.log('User does not have a tutor profile yet. They may need to complete tutor registration.');
        setTutorIdError('You need to complete your tutor registration first. Please go to the tutor registration page to complete your application.');
        // Don't set tutorId, which will prevent the component from making tutor-specific API calls
      }
    }
  };

  useEffect(() => {
    if (tutorId) {
      fetchSubjectApplications();
      fetchTutorProfile();
      fetchTutorCourseId(); // Fetch course_id to filter subjects
      // Refresh application status when tutorId is available
      refreshStatus();
    }
  }, [tutorId]);

  // Fetch full data when status becomes rejected
  useEffect(() => {
    if (tutorId && applicationStatus === 'rejected' && !showReapplicationForm) {
      fetchFullTutorDataForReapplication();
    }
  }, [applicationStatus, tutorId]);

  // Fetch profile image when reapplication form is shown
  useEffect(() => {
    if (showReapplicationForm && tutorId && !profilePhoto) {
      // Fetch profile to ensure we have the latest image
      apiClient.get(`/tutors/${tutorId}/profile`)
        .then((response) => {
          const profilePhotoUrl = response.data.profile_photo || user?.profile_image_url || '';
          console.log('Fetching profile image for reapplication form:', profilePhotoUrl);
          if (profilePhotoUrl) {
            setExistingProfilePhotoUrl(profilePhotoUrl);
          }
        })
        .catch((error) => {
          console.error('Failed to fetch profile for reapplication form:', error);
        });
    }
  }, [showReapplicationForm, tutorId, profilePhoto]);

  useEffect(() => {
    // Fetch subjects when course_id is available
    if (tutorCourseId) {
      fetchAvailableSubjects();
    }
  }, [tutorCourseId]);


  const fetchAvailableSubjects = async () => {
    try {
      // Only fetch subjects if tutor course_id is available (for approved tutors)
      if (tutorCourseId) {
        const response = await apiClient.get('/subjects', {
          params: { course_id: tutorCourseId }
        });
        setAvailableSubjects(response.data);
      } else {
        // If no course_id yet, wait for it
        setAvailableSubjects([]);
      }
    } catch (error) {
      console.error('Failed to fetch subjects:', error);
    }
  };

  const fetchSubjectApplications = async () => {
    if (!tutorId) return;
    try {
      const response = await apiClient.get(`/tutors/${tutorId}/subject-applications`);
      setSubjectApplications(response.data);
    } catch (error) {
      console.error('Failed to fetch subject applications:', error);
    }
  };

  const normalizedSelected = new Set(subjects.map(s => s.toLowerCase()));

  const fetchTutorDocuments = async () => {
    if (!tutorId) return;
    try {
      const documentsRes = await apiClient.get(`/tutors/${tutorId}/documents`).catch(() => ({ data: [] }));
      let documents: any[] = [];
      if (Array.isArray(documentsRes.data)) {
        documents = documentsRes.data;
      } else if (Array.isArray(documentsRes.data?.data)) {
        documents = documentsRes.data.data;
      } else if (documentsRes.data && typeof documentsRes.data === 'object') {
        if (documentsRes.data.documents && Array.isArray(documentsRes.data.documents)) {
          documents = documentsRes.data.documents;
        } else if (documentsRes.data.docs && Array.isArray(documentsRes.data.docs)) {
          documents = documentsRes.data.docs;
        }
      }

      if (documents.length > 0) {
        setExistingProofDocuments(documents.map((doc: any) => ({
          id: doc.document_id || doc.id,
          file_url: doc.file_url,
          file_name: doc.file_name,
          file_type: doc.file_type
        })));
      } else {
        setExistingProofDocuments([]);
      }
    } catch (error) {
      console.error('Failed to fetch tutor documents:', error);
      setExistingProofDocuments([]);
    }
  };

  const fetchTutorProfile = async () => {
    if (!tutorId) return;
    try {
      const response = await apiClient.get(`/tutors/${tutorId}/profile`);
      setExistingProfilePhotoUrl(response.data.profile_photo || '');
      setGcashNumber(response.data.gcash_number || '');
      setExistingGcashQRUrl(response.data.gcash_qr || '');

      // Get course_id from profile to filter subjects
      if (response.data.course_id) {
        setTutorCourseId(response.data.course_id);
      }

      // Fetch documents for all statuses
      await fetchTutorDocuments();

      // If rejected, fetch full data for reapplication
      if (applicationStatus === 'rejected') {
        await fetchFullTutorDataForReapplication();
      }
    } catch (error) {
      console.error('Failed to fetch tutor profile:', error);
    }
  };

  const fetchTutorCourseId = async () => {
    if (!tutorId) return;
    try {
      // Approach 1: Fetch from tutor applications endpoint (includes course relation)
      // This works for all tutor statuses (pending, approved, rejected)
      try {
        const applicationsResponse = await apiClient.get('/tutors/applications').catch(() => ({ data: [] }));
        const currentTutor = (applicationsResponse.data || []).find((t: any) => t.tutor_id === tutorId);
        if (currentTutor?.course_id) {
          setTutorCourseId(currentTutor.course_id);
          return;
        } else if (currentTutor?.course?.course_id) {
          setTutorCourseId(currentTutor.course.course_id);
          return;
        }
      } catch (e) {
        console.log('Could not fetch course_id from applications endpoint:', e);
      }

      // Approach 2: Try from user's tutor_profile if available in context
      if (user?.tutor_profile?.course_id) {
        setTutorCourseId(user.tutor_profile.course_id);
        return;
      }
    } catch (error) {
      console.error('Failed to fetch tutor course_id:', error);
    }
  };

  const fetchFullTutorDataForReapplication = async () => {
    if (!tutorId) return;
    try {
      // Reset profile photo state to ensure we show existing image
      setProfilePhoto(null);

      // First, fetch subject applications to ensure we have the latest data
      await fetchSubjectApplications();

      // Fetch tutor data with all needed fields
      // Note: Documents endpoint doesn't exist (only POST for uploading)
      // Documents will be uploaded fresh during reapplication
      const [profileRes, availabilityRes] = await Promise.all([
        apiClient.get(`/tutors/${tutorId}/profile`),
        apiClient.get(`/tutors/${tutorId}/availability`)
      ]);

      console.log('Profile response data:', profileRes.data);
      console.log('Profile photo URL from API:', profileRes.data.profile_photo);
      console.log('User profile_image_url:', user?.profile_image_url);

      // Populate form fields
      if (user?.name) setFullName(user.name);
      setBio(profileRes.data.bio || '');
      setGcashNumber(profileRes.data.gcash_number || '');
      setSessionRate(profileRes.data.session_rate_per_hour?.toString() || '');

      // Fetch year level from tutor application endpoint (since it's not in profile)
      try {
        const applicationsRes = await apiClient.get('/tutors/applications').catch(() => ({ data: [] }));
        const currentTutor = (applicationsRes.data || []).find((t: any) => t.tutor_id === tutorId);
        if (currentTutor && currentTutor.year_level !== undefined && currentTutor.year_level !== null) {
          setYearLevel(currentTutor.year_level.toString());
        }
      } catch (e) {
        console.error('Failed to fetch year level:', e);
      }

      // Set subjects from subject applications - include ALL subjects (approved, pending, rejected)
      // This allows users to see all their subjects and manage them
      // Wait for subjectApplications to be updated (will use the state that was just fetched)
      const currentSubjectApps = await apiClient.get(`/tutors/${tutorId}/subject-applications`);
      const subjectsSet = new Set<string>();
      const initialSubjectFilesMap: Record<string, File[]> = {};
      const initialExistingDocumentsMap: Record<string, Array<{
        id: number;
        file_url: string;
        file_name: string;
        file_type: string;
      }>> = {};

      (currentSubjectApps.data || []).forEach((app: any) => {
        subjectsSet.add(app.subject_name);
        // Initialize new files array
        initialSubjectFilesMap[app.subject_name] = [];
        // Store existing documents from API
        if (app.documents && Array.isArray(app.documents) && app.documents.length > 0) {
          initialExistingDocumentsMap[app.subject_name] = app.documents.map((doc: any) => ({
            id: doc.id,
            file_url: doc.file_url,
            file_name: doc.file_name,
            file_type: doc.file_type
          }));
        } else {
          initialExistingDocumentsMap[app.subject_name] = [];
        }
      });

      setReapplicationSubjects(subjectsSet);
      setSubjectFilesMap(initialSubjectFilesMap);
      setExistingSubjectDocumentsMap(initialExistingDocumentsMap);

      // Fetch general proof documents (tutor documents)
      try {
        // Use the new GET endpoint to fetch tutor documents directly
        const documentsRes = await apiClient.get(`/tutors/${tutorId}/documents`).catch(() => ({ data: [] }));
        if (documentsRes.data && Array.isArray(documentsRes.data) && documentsRes.data.length > 0) {
          setExistingProofDocuments(documentsRes.data.map((doc: any) => ({
            id: doc.document_id || doc.id,
            file_url: doc.file_url,
            file_name: doc.file_name,
            file_type: doc.file_type
          })));
        } else {
          setExistingProofDocuments([]);
        }
      } catch (e) {
        console.error('Failed to fetch proof documents:', e);
        setExistingProofDocuments([]);
      }

      // Set availability
      if (availabilityRes.data && Array.isArray(availabilityRes.data)) {
        const availabilityMap: Record<string, DayAvailability> = {};
        availabilityRes.data.forEach((avail: any) => {
          const day = avail.day_of_week;
          if (!availabilityMap[day]) {
            availabilityMap[day] = { slots: [] };
          }
          availabilityMap[day].slots.push({
            startTime: avail.start_time,
            endTime: avail.end_time
          });
        });
        setReapplicationAvailability(availabilityMap);
      }

      // Fetch profile image - prioritize profile_photo from API, then user profile_image_url
      const profilePhotoUrl = profileRes.data.profile_photo || user?.profile_image_url || '';
      console.log('Setting profile photo URL to:', profilePhotoUrl);
      setExistingProfilePhotoUrl(profilePhotoUrl);
      setExistingGcashQRUrl(profileRes.data.gcash_qr || '');

      console.log('Profile image state updated. existingProfilePhotoUrl:', profilePhotoUrl);
    } catch (error) {
      console.error('Failed to fetch full tutor data:', error);
    }
  };

  const handleProfilePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    if (file) setProfilePhoto(file);
  };

  const handleGcashNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setGcashNumber(e.target.value);
  };

  const handleGcashQRChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    if (file) setGcashQR(file);
  };

  const handleCustomSubjectChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    setOtherSubject(inputValue);

    // Check if the input matches any available subject
    const matchingSubject = availableSubjects.find(subject =>
      subject.subject_name.toLowerCase() === inputValue.toLowerCase()
    );

    if (matchingSubject) {
      // If match found, select it in dropdown and disable custom input
      setSubjectToAdd(matchingSubject.subject_name);
      setIsCustomInputDisabled(true);
    } else {
      // If no match, clear dropdown selection and enable custom input
      if (subjectToAdd) {
        setSubjectToAdd('');
      }
      setIsCustomInputDisabled(false);
    }
  };

  const handleSubjectDropdownChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedValue = e.target.value;
    setSubjectToAdd(selectedValue);

    // If "Select a subject..." is chosen, enable custom input
    if (selectedValue === '') {
      setIsCustomInputDisabled(false);
      setOtherSubject('');
    } else {
      // If a subject is selected, disable custom input and clear it
      setIsCustomInputDisabled(true);
      setOtherSubject('');
    }
  };

  const addSelectedSubject = () => {
    if (subjectToAdd && !normalizedSelected.has(subjectToAdd.toLowerCase())) {
      setSubjects(prev => [...prev, subjectToAdd]);
      setSubjectToAdd('');
    }
  };

  const addOtherSubject = () => {
    const trimmed = otherSubject.trim();
    if (trimmed && !normalizedSelected.has(trimmed.toLowerCase())) {
      setSubjects(prev => [...prev, trimmed]);
      setOtherSubject('');
    }
  };

  const removeSubject = (name: string) => {
    setSubjects(prev => prev.filter(s => s !== name));
  };

  const handleDocsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setDocuments(Array.from(e.target.files));
  };

  const handleNewSubjectDocsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setNewSubjectDocuments(Array.from(e.target.files));
  };

  // Reapplication form handlers
  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const addReapplicationSubject = (subjectName: string) => {
    if (!subjectName) return;
    setReapplicationSubjects(prev => new Set(prev).add(subjectName));
    if (!subjectFilesMap[subjectName]) {
      setSubjectFilesMap(prev => ({ ...prev, [subjectName]: [] }));
    }
    // Initialize existing documents map if not present
    if (!existingSubjectDocumentsMap[subjectName]) {
      setExistingSubjectDocumentsMap(prev => ({ ...prev, [subjectName]: [] }));
    }
  };

  const removeReapplicationSubject = (subjectName: string) => {
    setReapplicationSubjects(prev => {
      const next = new Set(prev);
      next.delete(subjectName);
      return next;
    });
    setSubjectFilesMap(prev => {
      const next = { ...prev };
      delete next[subjectName];
      return next;
    });
    setExistingSubjectDocumentsMap(prev => {
      const next = { ...prev };
      delete next[subjectName];
      return next;
    });
  };

  const handleSubjectFileChange = (subjectName: string, e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setSubjectFilesMap(prev => ({
        ...prev,
        [subjectName]: [...(prev[subjectName] || []), ...files]
      }));
    }
  };

  const removeSubjectFile = (subjectName: string, fileIndex: number) => {
    setSubjectFilesMap(prev => {
      const next = { ...prev };
      if (next[subjectName]) {
        next[subjectName] = next[subjectName].filter((_, i) => i !== fileIndex);
      }
      return next;
    });
  };

  const removeExistingSubjectDocument = (subjectName: string, docId: number) => {
    setExistingSubjectDocumentsMap(prev => {
      const next = { ...prev };
      if (next[subjectName]) {
        next[subjectName] = next[subjectName].filter(doc => doc.id !== docId);
      }
      return next;
    });
  };

  const removeExistingProofDocument = (docId: number) => {
    setExistingProofDocuments(prev => prev.filter(doc => doc.id !== docId));
  };

  // Availability handlers for reapplication
  const normalizeTime = (raw: string) => {
    if (!raw) return raw;
    const trimmed = raw.trim();
    const parts = trimmed.split(':').map(p => p.replace(/\D/g, ''));
    const hh = parts[0] ? String(Number(parts[0])).padStart(2, '0') : '00';
    const mm = parts[1] ? String(Math.min(59, Number(parts[1]))).padStart(2, '0') : '00';
    return `${hh}:${mm}`;
  };

  const addReapplicationDay = (day: string) => {
    if (!day) return;
    setReapplicationAvailability(prev => ({
      ...prev,
      [day]: { slots: [{ startTime: '09:00', endTime: '17:00' }] }
    }));
  };

  const removeReapplicationDay = (day: string) => {
    setReapplicationAvailability(prev => {
      const next = { ...prev };
      delete next[day];
      return next;
    });
  };

  const addReapplicationTimeSlot = (day: string) => {
    setReapplicationAvailability(prev => {
      const next = { ...prev };
      if (!next[day]) {
        next[day] = { slots: [] };
      }
      const slots = next[day].slots;
      // Add a default 1-hour slot (find non-overlapping time)
      const lastSlot = slots.length > 0 ? slots[slots.length - 1] : null;
      const startTime = lastSlot ? lastSlot.endTime : '09:00';
      const [h, m] = startTime.split(':').map(Number);
      const endMinutes = (h * 60 + m + 60) % (24 * 60);
      const endTime = `${Math.floor(endMinutes / 60).toString().padStart(2, '0')}:${(endMinutes % 60).toString().padStart(2, '0')}`;
      next[day].slots.push({ startTime, endTime });
      return next;
    });
  };

  const removeReapplicationTimeSlot = (day: string, index: number) => {
    setReapplicationAvailability(prev => {
      const next = { ...prev };
      if (next[day]) {
        next[day].slots = next[day].slots.filter((_, i) => i !== index);
        if (next[day].slots.length === 0) {
          delete next[day];
        }
      }
      return next;
    });
  };

  const updateReapplicationSlotTime = (day: string, index: number, type: 'startTime' | 'endTime', value: string) => {
    const normalized = normalizeTime(value);
    setReapplicationAvailability(prev => {
      const next = { ...prev };
      if (next[day] && next[day].slots[index]) {
        next[day].slots[index][type] = normalized;
      }
      return next;
    });
  };

  const submitApplication = async () => {
    if (!tutorId) {
      alert('Tutor not found. Please complete application first.');
      return;
    }

    try {
      // Upload profile image if changed
      if (profilePhoto) {
        const formData = new FormData();
        formData.append('file', profilePhoto);
        await apiClient.post(`/tutors/${tutorId}/profile-image`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }

      // Upload GCash QR if changed
      if (gcashQR) {
        const formData = new FormData();
        formData.append('file', gcashQR);
        await apiClient.post(`/tutors/${tutorId}/gcash-qr`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }

      // Update GCash number and bio (if needed)
      await apiClient.put(`/tutors/${tutorId}/profile`, {
        gcash_number: gcashNumber,
        // You can add bio here if it's also part of this form
      });

      // Upload documents
      if (documents.length > 0) {
        const form = new FormData();
        documents.forEach(f => form.append('files', f));
        await apiClient.post(`/tutors/${tutorId}/documents`, form, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }

      // Submit subjects
      if (subjects.length > 0) {
        await apiClient.post(`/tutors/${tutorId}/subjects`, { subjects });
      }

      // Update application status
      await apiClient.post(`/tutors/${tutorId}/submit-application`);

      alert('Application submitted successfully! Awaiting admin approval.');
      refreshStatus();
    } catch (error) {
      console.error('Failed to submit application:', error);
      alert('Failed to submit application. Please try again.');
    }
  };

  const submitNewSubjectApplication = async () => {
    // Determine which subject to use: dropdown selection or custom input
    const selectedSubject = subjectToAdd || otherSubject.trim();

    if (!tutorId || !selectedSubject || newSubjectDocuments.length === 0) {
      alert('Please select a subject (or enter a custom subject) and upload supporting documents.');
      return;
    }

    try {
      const form = new FormData();
      form.append('subject_name', selectedSubject);
      newSubjectDocuments.forEach(f => form.append('files', f));

      await apiClient.post(`/tutors/${tutorId}/subject-application`, form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      alert('Subject application submitted successfully! Awaiting admin approval.');
      setShowNewSubjectForm(false);
      setSubjectToAdd('');
      setOtherSubject('');
      setNewSubjectDocuments([]);
      fetchSubjectApplications();
    } catch (error: any) {
      console.error('Failed to submit subject application:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to submit subject application. Please try again.';
      alert(errorMessage);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'text-green-600 bg-green-50 border-green-200';
      case 'rejected': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <CheckCircle className="h-4 w-4" />;
      case 'rejected': return <X className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const getFileUrl = (url: string) => {
    if (!url) return '';
    console.log('Getting file URL for:', url);

    if (url.startsWith('http://') || url.startsWith('https://')) {
      console.log('URL is already absolute:', url);
      return url;
    }

    // Profile images are served directly at /user_profile_images/ without /api prefix
    if (url.startsWith('/user_profile_images/') || url.startsWith('user_profile_images/')) {
      const cleanUrl = url.startsWith('/') ? url : `/${url}`;
      const baseUrl = apiClient.defaults.baseURL.replace('/api', '');
      const fullUrl = `${baseUrl}${cleanUrl}`;
      console.log('Constructed profile image URL:', fullUrl);
      return fullUrl;
    }

    // Files are served directly at /tutor_documents/ without /api/files/ prefix
    if (url.startsWith('/tutor_documents/') || url.startsWith('tutor_documents/')) {
      const cleanUrl = url.startsWith('/') ? url : `/${url}`;
      const baseUrl = apiClient.defaults.baseURL.replace('/api', '');
      const fullUrl = `${baseUrl}${cleanUrl}`;
      console.log('Constructed tutor document URL:', fullUrl);
      return fullUrl;
    }

    // For other files, use the standard /files/ endpoint
    const cleanUrl = url.startsWith('/') ? url.substring(1) : url;
    const fullUrl = `${apiClient.defaults.baseURL}/files/${cleanUrl}`;
    console.log('Constructed file URL:', fullUrl);
    return fullUrl;
  };

  const handleOpenDocument = (fileUrl: string, fileType?: string) => {
    console.log('Opening document:', { fileUrl, fileType });

    const normalizedType = (fileType || '').toLowerCase();
    if (normalizedType.startsWith('image/') || normalizedType === 'application/pdf') {
      console.log('Opening in preview modal:', { fileUrl, fileType: normalizedType });
      setPreviewUrl(fileUrl);
      setPreviewType(normalizedType);
      setIsPreviewOpen(true);
      return;
    }
    // Fallback: try extension-based handling
    const lower = fileUrl.toLowerCase();
    if (lower.endsWith('.pdf')) {
      console.log('Opening PDF in preview modal:', fileUrl);
      setPreviewUrl(fileUrl);
      setPreviewType('application/pdf');
      setIsPreviewOpen(true);
      return;
    }
    if (/(\.png|\.jpg|\.jpeg|\.gif|\.webp)$/.test(lower)) {
      console.log('Opening image in preview modal:', fileUrl);
      setPreviewUrl(fileUrl);
      setPreviewType('image/*');
      setIsPreviewOpen(true);
      return;
    }
    // As a last resort, open in new tab
    console.log('Opening in new tab:', fileUrl);
    window.open(fileUrl, '_blank', 'noopener,noreferrer');
  };


  return (
    <div className="space-y-3 sm:space-y-4 md:space-y-6 pb-6 sm:pb-8 md:pb-10">
      <div className="bg-gradient-to-br from-primary-600 via-primary-700 to-primary-800 rounded-xl sm:rounded-2xl p-3 sm:p-4 md:p-5 text-white shadow-xl relative overflow-hidden -mx-2 sm:-mx-3 md:mx-0 border border-primary-500/30">
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <div className="absolute top-0 right-0 w-40 h-40 bg-white rounded-full -mr-20 -mt-20 blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-white rounded-full -ml-16 -mb-16 blur-3xl"></div>
        </div>
        <div className="relative flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 sm:gap-4 lg:gap-6">
          <div className="min-w-0 flex-1 flex items-center gap-2.5 sm:gap-3 bg-white/10 p-2 sm:p-3 rounded-xl backdrop-blur-md border border-white/20 shadow-inner">
            <div className="p-1.5 sm:p-2 bg-white/20 rounded-lg shadow-sm shrink-0">
              <Info className="h-4 w-4 sm:h-5 sm:w-5 text-white drop-shadow-md" />
            </div>
            <p className="text-xs sm:text-sm md:text-base text-white font-medium leading-snug tracking-wide text-shadow-sm">
              Manage your tutor application and subject expertise
            </p>
          </div>
          <div className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-semibold border-2 flex items-center justify-center space-x-1.5 shadow-inner transition-colors duration-300 w-full lg:w-auto ${getStatusColor(applicationStatus)}`}>
            <div className="flex items-center space-x-1.5">
              {getStatusIcon(applicationStatus)}
              <span className="whitespace-nowrap tracking-wide">{applicationStatus.charAt(0).toUpperCase() + applicationStatus.slice(1)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Error message for users without tutor profiles */}
      {tutorIdError && (
        <Card className="p-3 sm:p-4 md:p-6 border-red-200 bg-red-50 -mx-2 sm:-mx-3 md:mx-0">
          <div className="flex items-start space-x-2 sm:space-x-3">
            <X className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <h3 className="text-sm sm:text-base md:text-lg font-semibold text-red-800">Tutor Profile Not Found</h3>
              <p className="text-xs sm:text-sm md:text-base text-red-700 mt-1 break-words">{tutorIdError}</p>
              <p className="text-[10px] sm:text-xs md:text-sm text-red-600 mt-2">
                If you believe this is an error, please contact support or try logging out and logging back in.
              </p>
              <div className="mt-2.5 sm:mt-3 md:mt-4">
                <Button
                  onClick={() => window.location.href = '/tutor-registration'}
                  className="w-full sm:w-auto bg-white text-primary-700 hover:bg-primary-50 border-2 border-primary-600 font-semibold text-xs sm:text-sm md:text-base py-1.5 sm:py-2"
                >
                  Complete Tutor Registration
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Main Application Status */}
      <Card className="p-4 sm:p-5 md:p-6 bg-gradient-to-br from-white to-slate-50 rounded-xl sm:rounded-2xl shadow-xl border border-slate-200/50 hover:shadow-2xl transition-all duration-300 -mx-2 sm:-mx-3 md:mx-0">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl shadow-lg">
            <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
          </div>
          <h2 className="text-lg sm:text-xl md:text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">Main Application Status</h2>
        </div>

        {applicationStatus?.toLowerCase() === 'approved' ? (
          <div className="bg-gradient-to-br from-green-50 via-emerald-50 to-green-50 border-2 border-green-200/50 rounded-xl p-4 sm:p-5 shadow-lg">
            <div className="flex items-start sm:items-center">
              <div className="p-2 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl mr-3 flex-shrink-0 shadow-md">
                <CheckCircle className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm sm:text-base md:text-lg font-bold text-green-800">Your application has been approved!</p>
                <p className="text-xs sm:text-sm text-green-700 mt-1.5">You can now start accepting tutoring sessions.</p>
              </div>
            </div>
          </div>
        ) : applicationStatus?.toLowerCase() === 'rejected' ? (
          <div className="bg-gradient-to-br from-red-50 via-rose-50 to-red-50 border-2 border-red-200/50 rounded-xl p-4 sm:p-5 shadow-lg">
            <div className="flex items-start">
              <div className="p-2 bg-gradient-to-br from-red-500 to-red-600 rounded-xl mr-3 flex-shrink-0 shadow-md">
                <X className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm sm:text-base md:text-lg font-bold text-red-800">Your application has been rejected</p>
                <p className="text-xs sm:text-sm text-red-700 mt-1.5">Your application did not meet the requirements. Please review the feedback below and resubmit if needed.</p>

                {/* Admin Rejection Reason - Always show this section when rejected */}
                <div className="mt-3 sm:mt-4 p-3 sm:p-4 bg-gradient-to-br from-red-100 to-red-50 border-2 border-red-300/50 rounded-xl shadow-sm">
                  <p className="text-xs sm:text-sm font-semibold text-red-800 mb-2">Rejection Reason:</p>
                  {adminNotes ? (
                    <p className="text-xs sm:text-sm text-red-700 leading-relaxed whitespace-pre-wrap break-words">{adminNotes}</p>
                  ) : (
                    <p className="text-xs sm:text-sm text-red-600 italic">No specific rejection reason was provided. Please review your application and ensure all requirements are met before resubmitting.</p>
                  )}
                </div>

                <div className="mt-3 sm:mt-4">
                  <Button
                    onClick={async () => {
                      // Fetch fresh data before showing form
                      await fetchFullTutorDataForReapplication();
                      setShowReapplicationForm(true);
                    }}
                    className="w-full sm:w-auto bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white shadow-lg hover:shadow-xl text-xs sm:text-sm md:text-base py-2 sm:py-2.5 px-4 sm:px-5"
                  >
                    Reapply - Update Application
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-gradient-to-br from-yellow-50 via-amber-50 to-yellow-50 border-2 border-yellow-200/50 rounded-xl p-4 sm:p-5 shadow-lg">
            <div className="flex items-start sm:items-center">
              <div className="p-2 bg-gradient-to-br from-yellow-500 to-amber-600 rounded-xl mr-3 flex-shrink-0 shadow-md">
                <Clock className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm sm:text-base md:text-lg font-bold text-yellow-800">⏳ Your application is pending review</p>
                <p className="text-xs sm:text-sm text-yellow-700 mt-1.5">An admin will review your documents and approve your account.</p>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Current Approved Subjects */}
      <Card className="p-4 sm:p-5 md:p-6 bg-gradient-to-br from-white to-slate-50 rounded-xl sm:rounded-2xl shadow-xl border border-slate-200/50 hover:shadow-2xl transition-all duration-300 -mx-2 sm:-mx-3 md:mx-0">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl shadow-lg">
              <CheckCircle className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
            </div>
            <h2 className="text-lg sm:text-xl md:text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">Approved Subjects of Expertise</h2>
          </div>
          {isVerified && (
            <Button
              onClick={() => setShowNewSubjectForm(true)}
              className="w-full sm:w-auto flex items-center justify-center space-x-2 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white shadow-lg hover:shadow-xl text-xs sm:text-sm md:text-base py-2 sm:py-2.5 px-4 sm:px-5"
            >
              <Plus className="h-4 w-4" />
              <span>Apply for New Subject</span>
            </Button>
          )}
        </div>

        <div className="flex flex-wrap gap-2 sm:gap-2.5">
          {subjectApplications
            .filter(app => app.status === 'approved')
            .map(app => (
              <span
                key={app.id}
                className="px-4 py-2 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl text-sm font-semibold shadow-md hover:shadow-lg hover:scale-105 transition-all duration-200 border border-primary-400/30 flex items-center gap-1.5"
              >
                <CheckCircle className="h-4 w-4 flex-shrink-0" />
                <span className="break-words">{app.subject_name}</span>
              </span>
            ))}
          {subjectApplications.filter(app => app.status === 'approved').length === 0 && (
            <div className="w-full text-center py-6">
              <div className="bg-gradient-to-br from-yellow-50 to-amber-50 border-2 border-yellow-200 rounded-xl p-5 sm:p-6 shadow-lg">
                <Clock className="h-10 w-10 sm:h-12 sm:w-12 text-yellow-600 mx-auto mb-3" />
                <p className="text-sm sm:text-base md:text-lg text-yellow-800 font-semibold mb-1">No approved subjects yet</p>
                <p className="text-xs sm:text-sm text-yellow-700">
                  Your subject expertise applications are being reviewed by our admin team.
                </p>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* New Subject Application Form */}
      {showNewSubjectForm && (
        <Card className="p-4 sm:p-5 md:p-6 bg-gradient-to-br from-white to-slate-50 rounded-xl sm:rounded-2xl shadow-xl border-2 border-primary-200/50 hover:shadow-2xl transition-all duration-300 -mx-2 sm:-mx-3 md:mx-0">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl shadow-lg">
                <Plus className="h-5 w-5 text-white" />
              </div>
              <h3 className="text-lg sm:text-xl md:text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">Apply for Additional Subject</h3>
            </div>
            <button
              onClick={() => setShowNewSubjectForm(false)}
              className="text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-full p-2 transition-all flex-shrink-0"
              aria-label="Close form"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-3 sm:space-y-4">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5 sm:mb-2">
                Select Subject
              </label>
              <p className="text-[10px] sm:text-xs text-slate-500 mb-1.5 sm:mb-2">
                Subjects are filtered based on your course. You can apply for new subjects or reapply for previously rejected subjects.
              </p>
              <select
                className="w-full border border-slate-300 rounded-lg px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm"
                value={subjectToAdd}
                onChange={handleSubjectDropdownChange}
              >
                <option value="">Select a subject...</option>
                {availableSubjects
                  .filter(s => {
                    const normalizedName = s.subject_name.toLowerCase();
                    // Check if there's an existing application for this subject
                    const existingApp = subjectApplications.find(app =>
                      app.subject_name.toLowerCase() === normalizedName
                    );

                    // Allow selection if:
                    // 1. No existing application, OR
                    // 2. Existing application is rejected (can reapply)
                    if (!existingApp) {
                      return true; // No existing application, can apply
                    }

                    // Only allow if rejected - this allows reapplying for rejected subjects
                    return existingApp.status === 'rejected';
                  })
                  .map(s => {
                    const isRejected = subjectApplications.find(app =>
                      app.subject_name.toLowerCase() === s.subject_name.toLowerCase() && app.status === 'rejected'
                    );
                    return (
                      <option key={s.subject_id} value={s.subject_name}>
                        {s.subject_name} {isRejected ? '(Reapply)' : ''}
                      </option>
                    );
                  })}
              </select>
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5 sm:mb-2">
                Custom Subject (Optional)
              </label>
              <p className="text-[10px] sm:text-xs text-slate-500 mb-1.5 sm:mb-2">
                If your desired subject is not in the dropdown above, you can type a custom subject name here.
                {isCustomInputDisabled && (
                  <span className="text-primary-600 font-medium ml-1">
                    ✓ Subject found in dropdown and auto-selected!
                  </span>
                )}
              </p>
              <input
                type="text"
                className={`w-full border rounded-lg px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm ${isCustomInputDisabled
                  ? 'border-slate-300 bg-slate-100 text-slate-500 cursor-not-allowed'
                  : 'border-slate-300 bg-white'
                  }`}
                placeholder={
                  isCustomInputDisabled
                    ? "Custom input disabled - subject found in dropdown"
                    : "Type your custom subject name (e.g., Advanced Calculus, Organic Chemistry)"
                }
                value={otherSubject}
                onChange={handleCustomSubjectChange}
                disabled={isCustomInputDisabled}
              />
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5 sm:mb-2">
                Supporting Documents
              </label>
              <input
                type="file"
                multiple
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={handleNewSubjectDocsChange}
                className="w-full border border-slate-300 rounded-lg px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
              />
              {newSubjectDocuments.length > 0 && (
                <ul className="list-disc list-inside text-xs sm:text-sm text-slate-600 mt-2 space-y-1">
                  {newSubjectDocuments.map((f, i) => (
                    <li key={i} className="break-words">{f.name}</li>
                  ))}
                </ul>
              )}
            </div>

            {/* Subject Preview */}
            {(subjectToAdd || otherSubject.trim()) && (
              <div className="bg-primary-50 border border-primary-200 rounded-lg p-2.5 sm:p-3">
                <h4 className="text-xs sm:text-sm font-medium text-primary-800 mb-1">Subject to be submitted:</h4>
                <p className="text-xs sm:text-sm text-primary-700 break-words">
                  {subjectToAdd || otherSubject.trim()}
                  {subjectToAdd && otherSubject.trim() && (
                    <span className="text-[10px] sm:text-xs text-primary-600 ml-2">
                      (Using dropdown selection)
                    </span>
                  )}
                  {!subjectToAdd && otherSubject.trim() && (
                    <span className="text-[10px] sm:text-xs text-primary-600 ml-2">
                      (Custom subject)
                    </span>
                  )}
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <Button
                onClick={submitNewSubjectApplication}
                disabled={(!subjectToAdd && !otherSubject.trim()) || newSubjectDocuments.length === 0}
                className="w-full sm:w-auto bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white shadow-lg hover:shadow-xl text-xs sm:text-sm md:text-base py-2 sm:py-2.5 px-4 sm:px-5"
              >
                Submit Application
              </Button>
              <Button variant="secondary" onClick={() => setShowNewSubjectForm(false)} className="w-full sm:w-auto text-xs sm:text-sm md:text-base py-2 sm:py-2.5 px-4 sm:px-5">
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Supporting Documents Section */}
      <Card className="p-4 sm:p-5 md:p-6 bg-gradient-to-br from-white to-slate-50 rounded-xl sm:rounded-2xl shadow-xl border border-slate-200/50 hover:shadow-2xl transition-all duration-300 -mx-2 sm:-mx-3 md:mx-0">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl shadow-lg">
            <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
          </div>
          <h2 className="text-lg sm:text-xl md:text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">Supporting Documents</h2>
        </div>

        {existingProofDocuments.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
            {existingProofDocuments.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between bg-gradient-to-r from-slate-50 via-primary-50/50 to-slate-50 rounded-lg p-3 sm:p-3.5 border-2 border-slate-200/50 hover:border-primary-300 hover:shadow-md transition-all duration-200"
              >
                <div className="flex items-center min-w-0 flex-1">
                  <div className="p-1.5 sm:p-2 bg-gradient-to-br from-primary-100 to-primary-200 rounded-lg mr-2.5 flex-shrink-0">
                    <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-primary-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm font-semibold text-slate-800 truncate" title={doc.file_name || 'Document'}>
                      {doc.file_name || 'Document'}
                    </p>
                    <p className="text-[10px] sm:text-xs text-slate-500 truncate">
                      {doc.file_type || 'File'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0 ml-2">
                  <button
                    type="button"
                    onClick={() => handleOpenDocument(getFileUrl(doc.file_url), doc.file_type)}
                    className="text-[10px] sm:text-xs px-2 sm:px-2.5 py-1 sm:py-1.5 bg-gradient-to-r from-primary-600 to-primary-700 text-white hover:from-primary-700 hover:to-primary-800 rounded-lg font-semibold shadow-sm hover:shadow-md transition-all duration-200 whitespace-nowrap"
                    title="View document"
                  >
                    View
                  </button>
                  <a
                    href={getFileUrl(doc.file_url)}
                    download
                    className="text-[10px] sm:text-xs px-2 sm:px-2.5 py-1 sm:py-1.5 bg-gradient-to-r from-slate-600 to-slate-700 text-white hover:from-slate-700 hover:to-slate-800 rounded-lg font-semibold shadow-sm hover:shadow-md transition-all duration-200 whitespace-nowrap"
                    title="Download document"
                  >
                    Download
                  </a>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 sm:py-8 lg:py-10">
            <div className="inline-flex items-center justify-center w-14 h-14 sm:w-18 sm:h-18 lg:w-20 lg:h-20 bg-slate-100 rounded-full mb-3">
              <FileText className="w-7 h-7 sm:w-9 sm:h-9 lg:w-10 lg:h-10 text-slate-400" />
            </div>
            <p className="text-sm sm:text-base text-slate-500 font-medium">No supporting documents uploaded yet.</p>
            <p className="text-xs sm:text-sm text-slate-400 mt-2">
              Upload documents such as National ID, academic transcripts, certifications, or student ID to verify your credibility as a tutor.
            </p>
          </div>
        )}
      </Card>

      {/* Subject Applications History */}
      {subjectApplications.length > 0 && (
        <Card className="p-4 sm:p-5 md:p-6 bg-gradient-to-br from-white to-slate-50 rounded-xl sm:rounded-2xl shadow-xl border border-slate-200/50 hover:shadow-2xl transition-all duration-300 -mx-2 sm:-mx-3 md:mx-0">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl shadow-lg">
              <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
            </div>
            <h2 className="text-lg sm:text-xl md:text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">Subject Application History</h2>
          </div>
          <div className="space-y-3 sm:space-y-4">
            {subjectApplications.map(app => (
              <div key={app.id} className="p-4 sm:p-5 bg-gradient-to-br from-slate-50 via-white to-slate-50 rounded-xl border-2 border-slate-200/50 hover:border-primary-300 hover:shadow-lg transition-all duration-200">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0 mb-2">
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 md:gap-3 min-w-0 flex-1">
                    <span className="font-medium text-xs sm:text-sm md:text-base text-slate-800 break-words">{app.subject_name}</span>
                    <span className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium border flex-shrink-0 ${getStatusColor(app.status)}`}>
                      <div className="flex items-center space-x-0.5 sm:space-x-1">
                        {getStatusIcon(app.status)}
                        <span>{app.status.charAt(0).toUpperCase() + app.status.slice(1)}</span>
                      </div>
                    </span>
                  </div>
                  <span className="text-xs sm:text-sm text-slate-500 whitespace-nowrap">
                    Applied: {new Date(app.created_at).toLocaleDateString()}
                  </span>
                </div>

                {app.status === 'rejected' && (
                  <div className="mt-4 p-4 sm:p-5 bg-gradient-to-br from-red-50 via-rose-50 to-red-50 border-2 border-red-200/50 rounded-xl shadow-lg">
                    <div className="flex items-start space-x-3">
                      <div className="p-2 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex-shrink-0 shadow-md">
                        <X className="h-5 w-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-3">
                          <p className="text-sm sm:text-base font-bold text-red-800">❌ Application Rejected</p>
                          <span className="text-xs sm:text-sm text-red-600 whitespace-nowrap font-semibold">
                            Rejected: {new Date(app.updated_at).toLocaleDateString()}
                          </span>
                        </div>
                        {app.admin_notes ? (
                          <div>
                            <p className="text-xs sm:text-sm font-semibold text-red-700 mb-2 uppercase tracking-wide">Admin Feedback:</p>
                            <div className="bg-gradient-to-br from-red-100 to-red-50 border-2 border-red-300/50 rounded-xl p-3 sm:p-4 shadow-sm">
                              <p className="text-xs sm:text-sm text-red-800 leading-relaxed break-words">{app.admin_notes}</p>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <p className="text-xs sm:text-sm font-semibold text-red-700 mb-2">No specific feedback provided</p>
                            <p className="text-xs sm:text-sm text-red-600">
                              The application was rejected based on current requirements and standards.
                              You can reapply with additional documentation or qualifications.
                            </p>
                          </div>
                        )}
                        <div className="mt-4 p-3 bg-gradient-to-br from-red-100 to-red-50 border-2 border-red-200/50 rounded-xl">
                          <p className="text-xs sm:text-sm text-red-700 font-semibold">
                            💡 You can reapply for this subject by clicking "Apply for New Subject" above.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {app.status === 'approved' && (
                  <div className="mt-4 p-4 sm:p-5 bg-gradient-to-br from-green-50 via-emerald-50 to-green-50 border-2 border-green-200/50 rounded-xl shadow-lg">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex-shrink-0 shadow-md">
                        <CheckCircle className="h-5 w-5 text-white" />
                      </div>
                      <p className="text-sm sm:text-base text-green-800 font-semibold">
                        This subject is now part of your approved expertise areas!
                      </p>
                    </div>
                  </div>
                )}

                {app.status === 'pending' && (
                  <div className="mt-4 p-4 sm:p-5 bg-gradient-to-br from-yellow-50 via-amber-50 to-yellow-50 border-2 border-yellow-200/50 rounded-xl shadow-lg">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-gradient-to-br from-yellow-500 to-amber-600 rounded-xl flex-shrink-0 shadow-md">
                        <Clock className="h-5 w-5 text-white" />
                      </div>
                      <p className="text-sm sm:text-base text-yellow-800 font-semibold">
                        Your application is being reviewed by our admin team.
                      </p>
                    </div>
                  </div>
                )}

                {/* Supporting Documents */}
                {app.documents && app.documents.length > 0 && (
                  <div className="mt-4">
                    <h5 className="text-xs sm:text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wide">Supporting Documents:</h5>
                    <ul className="space-y-2">
                      {app.documents.map((doc) => (
                        <li key={doc.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 bg-gradient-to-r from-slate-50 via-primary-50/50 to-slate-50 rounded-xl p-3 border-2 border-slate-200/50 hover:border-primary-300 hover:shadow-md transition-all">
                          <div className="flex items-center min-w-0 flex-1">
                            <div className="p-1.5 bg-gradient-to-br from-primary-100 to-primary-200 rounded-lg mr-2.5 flex-shrink-0">
                              <FileText className="h-4 w-4 text-primary-600" />
                            </div>
                            <button
                              type="button"
                              onClick={() => handleOpenDocument(getFileUrl(doc.file_url), doc.file_type)}
                              className="text-primary-700 hover:text-primary-900 hover:underline truncate text-left text-xs sm:text-sm font-semibold"
                              title="Open file"
                            >
                              {doc.file_name}
                            </button>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0 ml-0 sm:ml-4 w-full sm:w-auto">
                            <button
                              type="button"
                              onClick={() => handleOpenDocument(getFileUrl(doc.file_url), doc.file_type)}
                              className="text-xs px-3 py-1.5 bg-gradient-to-r from-primary-600 to-primary-700 text-white hover:from-primary-700 hover:to-primary-800 rounded-lg font-semibold shadow-md hover:shadow-lg transition-all"
                            >
                              Open
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Reapplication Form (only show if rejected and user wants to reapply) */}
      {applicationStatus === 'rejected' && showReapplicationForm && (
        <Card className="p-4 sm:p-5 md:p-6 bg-gradient-to-br from-white to-slate-50 rounded-xl sm:rounded-2xl shadow-xl border-2 border-primary-200/50 hover:shadow-2xl transition-all duration-300 -mx-2 sm:-mx-3 md:mx-0">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl shadow-lg">
                <Edit className="h-5 w-5 text-white" />
              </div>
              <h2 className="text-lg sm:text-xl md:text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
                Update & Resubmit Your Application
              </h2>
            </div>
            <Button
              variant="secondary"
              onClick={() => setShowReapplicationForm(false)}
              className="w-full sm:w-auto flex items-center justify-center text-xs sm:text-sm md:text-base py-2 sm:py-2.5 px-4 sm:px-5"
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
          </div>


          <div className="space-y-3 sm:space-y-4 md:space-y-6">
            {/* Full Name */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5 sm:mb-2">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className="w-full border border-slate-300 rounded-lg px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm md:text-base"
                value={fullName}
                onChange={(e) => {
                  // Only allow letters, spaces, hyphens, and apostrophes
                  const filtered = e.target.value.replace(/[^A-Za-z\s\-']/g, '').slice(0, 60);
                  setFullName(filtered);
                }}
                required
              />
            </div>

            {/* Year Level */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5 sm:mb-2">
                Year Level <span className="text-red-500">*</span>
              </label>
              <select
                className="w-full border border-slate-300 rounded-lg px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm md:text-base"
                value={yearLevel}
                onChange={(e) => setYearLevel(e.target.value)}
                required
              >
                <option value="">Select year level</option>
                <option value="1">1st Year</option>
                <option value="2">2nd Year</option>
                <option value="3">3rd Year</option>
                <option value="4">4th Year</option>
                <option value="5">5th Year</option>
              </select>
            </div>

            {/* GCash Number */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5 sm:mb-2">
                GCash Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className="w-full border border-slate-300 rounded-lg px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm md:text-base"
                placeholder="09XX XXX XXXX"
                value={gcashNumber}
                onChange={(e) => {
                  // Only allow numbers, must start with 09, max 11 characters
                  const value = e.target.value.replace(/[^0-9]/g, '');

                  // Empty input
                  if (value.length === 0) {
                    setGcashNumber('');
                  }
                  // Valid: starts with 09
                  else if (value.startsWith('09')) {
                    setGcashNumber(value.slice(0, 11));
                  }
                  // Allow typing '0' while user starts typing
                  else if (value === '0') {
                    setGcashNumber('0');
                  }
                  // If starts with 0 but second digit is not 9, only allow '0'
                  else if (value.startsWith('0') && value[1] !== '9') {
                    setGcashNumber('0');
                  }
                  // If doesn't start with 0, don't allow - reset to empty or keep valid previous value
                  else {
                    if (gcashNumber && gcashNumber.startsWith('09')) {
                      // Keep previous valid value
                      return;
                    } else {
                      setGcashNumber('');
                    }
                  }
                }}
                maxLength={11}
                required
              />
              {gcashNumber && (!gcashNumber.startsWith('09') || gcashNumber.length !== 11) && (
                <p className="text-xs text-red-600 mt-1">GCash number must be 11 digits starting with 09</p>
              )}
            </div>

            {/* Session Rate */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5 sm:mb-2">
                Session Rate Per Hour (PHP) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                className="w-full border border-slate-300 rounded-lg px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm md:text-base"
                placeholder="e.g., 300"
                value={sessionRate}
                onChange={(e) => setSessionRate(e.target.value)}
                min="0"
                step="0.01"
                required
              />
            </div>

            {/* Bio */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5 sm:mb-2">
                Bio <span className="text-red-500">*</span>
              </label>
              <textarea
                className="w-full border border-slate-300 rounded-lg px-2.5 sm:px-3 py-1.5 sm:py-2 min-h-[80px] sm:min-h-[100px] text-xs sm:text-sm md:text-base"
                value={bio}
                onChange={(e) => {
                  // Only allow letters and spaces
                  const filtered = e.target.value.replace(/[^A-Za-z\s]/g, '');
                  setBio(filtered);
                }}
                placeholder="Tell us about yourself and your tutoring experience..."
                required
              />
            </div>

            {/* Profile Photo */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5 sm:mb-2">
                Profile Photo
              </label>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2.5 sm:gap-3 md:gap-4">
                <div className="relative w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-full overflow-hidden bg-slate-200 flex items-center justify-center border-2 sm:border-4 border-white shadow-lg flex-shrink-0 mx-auto sm:mx-0">
                  {profilePhoto ? (
                    <img src={URL.createObjectURL(profilePhoto)} alt="Profile Preview" className="w-full h-full object-cover" style={{ aspectRatio: '1/1' }} />
                  ) : existingProfilePhotoUrl ? (
                    <img
                      src={getFileUrl(existingProfilePhotoUrl)}
                      alt="Profile"
                      className="w-full h-full object-cover"
                      style={{ aspectRatio: '1/1' }}
                      onError={(e) => {
                        console.error('Failed to load profile image. Original URL:', existingProfilePhotoUrl);
                        console.error('Constructed URL:', getFileUrl(existingProfilePhotoUrl));
                        console.error('API Base URL:', apiClient.defaults.baseURL);
                        // Hide broken image
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                      onLoad={() => {
                        console.log('Profile image loaded successfully:', getFileUrl(existingProfilePhotoUrl));
                      }}
                    />
                  ) : (
                    <User className="h-8 w-8 sm:h-10 sm:w-10 md:h-12 md:w-12 text-slate-400" />
                  )}
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 md:gap-4 flex-1 w-full sm:w-auto">
                  <label className="flex items-center justify-center space-x-1.5 sm:space-x-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-primary-600 text-white rounded-lg cursor-pointer hover:bg-primary-700 active:bg-primary-800 transition-colors text-xs sm:text-sm md:text-base w-full sm:w-auto touch-manipulation" style={{ WebkitTapHighlightColor: 'transparent' }}>
                    <Camera className="h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5" />
                    <span>Upload Photo</span>
                    <input type="file" accept="image/*" onChange={handleProfilePhotoChange} className="hidden" />
                  </label>
                  {profilePhoto && (
                    <button
                      onClick={() => setProfilePhoto(null)}
                      className="bg-red-600 text-white px-3 py-1.5 sm:py-2 rounded-lg hover:bg-red-700 active:bg-red-800 transition-colors flex items-center justify-center text-xs sm:text-sm w-full sm:w-auto touch-manipulation"
                      style={{ WebkitTapHighlightColor: 'transparent' }}
                    >
                      <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Subjects of Expertise with Files */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5 sm:mb-2">
                Subjects of Expertise <span className="text-red-500">*</span>
              </label>
              <p className="text-[10px] sm:text-xs text-slate-500 mb-1.5 sm:mb-2">
                You can add new subjects or reapply for previously rejected subjects. Each subject requires supporting documents.
              </p>

              {/* Subject selector */}
              <div className="mb-3 sm:mb-4">
                <select
                  className="w-full border border-slate-300 rounded-lg px-2.5 sm:px-3 py-1.5 sm:py-2 mb-2 text-xs sm:text-sm"
                  value={subjectToAdd}
                  onChange={handleSubjectDropdownChange}
                >
                  <option value="">Select a subject...</option>
                  {availableSubjects
                    .filter(s => {
                      const normalizedName = s.subject_name.toLowerCase();
                      return !Array.from(reapplicationSubjects).some(existing => existing.toLowerCase() === normalizedName);
                    })
                    .map(s => (
                      <option key={s.subject_id} value={s.subject_name}>
                        {s.subject_name}
                      </option>
                    ))}
                </select>
                <Button
                  onClick={() => {
                    if (subjectToAdd) {
                      addReapplicationSubject(subjectToAdd);
                      setSubjectToAdd('');
                    }
                  }}
                  disabled={!subjectToAdd}
                  className="w-full text-xs sm:text-sm py-1.5 sm:py-2"
                >
                  Add Subject
                </Button>

                <div className="mt-2">
                  <input
                    type="text"
                    className="w-full border border-slate-300 rounded-lg px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm"
                    placeholder="Or enter a custom subject name"
                    value={otherSubject}
                    onChange={(e) => {
                      // Only allow letters, spaces, hyphens, and parentheses for subject names
                      const filtered = e.target.value.replace(/[^A-Za-z\s\-()]/g, '');
                      setOtherSubject(filtered);
                      // Check if filtered value matches any available subject
                      const matchingSubject = availableSubjects.find(subject =>
                        subject.subject_name.toLowerCase() === filtered.toLowerCase()
                      );
                      if (matchingSubject) {
                        // If match found, select it in dropdown and disable custom input
                        setSubjectToAdd(matchingSubject.subject_name);
                        setIsCustomInputDisabled(true);
                      } else {
                        // If no match, clear dropdown selection and enable custom input
                        if (subjectToAdd) {
                          setSubjectToAdd('');
                        }
                        setIsCustomInputDisabled(false);
                      }
                    }}
                  />
                  <Button
                    onClick={() => {
                      const trimmed = otherSubject.trim();
                      if (trimmed && !Array.from(reapplicationSubjects).some(s => s.toLowerCase() === trimmed.toLowerCase())) {
                        addReapplicationSubject(trimmed);
                        setOtherSubject('');
                      }
                    }}
                    disabled={!otherSubject.trim()}
                    variant="secondary"
                    className="w-full mt-2 text-xs sm:text-sm py-1.5 sm:py-2"
                  >
                    Add Custom Subject
                  </Button>
                </div>
              </div>

              {/* Selected subjects with files */}
              {Array.from(reapplicationSubjects).length > 0 && (
                <div className="space-y-3 sm:space-y-4 mt-3 sm:mt-4">
                  {Array.from(reapplicationSubjects).map(subject => (
                    <div key={subject} className="border border-slate-200 rounded-lg p-2.5 sm:p-3 md:p-4 bg-slate-50">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-xs sm:text-sm md:text-base text-slate-800 break-words flex-1 min-w-0 pr-2">{subject}</span>
                        <button
                          type="button"
                          onClick={() => removeReapplicationSubject(subject)}
                          className="text-red-600 hover:text-red-800 active:text-red-900 flex-shrink-0 p-1 touch-manipulation"
                          style={{ WebkitTapHighlightColor: 'transparent' }}
                          aria-label="Remove subject"
                        >
                          <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </button>
                      </div>
                      <div>
                        <label className="block text-[10px] sm:text-xs font-medium text-slate-700 mb-1">
                          Supporting Documents for {subject}
                        </label>

                        {/* Display existing documents */}
                        {(existingSubjectDocumentsMap[subject] || []).length > 0 && (
                          <div className="mb-3">
                            <p className="text-[10px] sm:text-xs text-slate-600 mb-1.5 font-medium">Previously uploaded documents:</p>
                            <ul className="space-y-1.5">
                              {(existingSubjectDocumentsMap[subject] || []).map((doc) => (
                                <li key={doc.id} className="flex items-center justify-between text-xs sm:text-sm text-slate-700 bg-blue-50 border border-blue-200 p-1.5 sm:p-2 rounded">
                                  <div className="flex items-center min-w-0 flex-1">
                                    <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-600 mr-2 flex-shrink-0" />
                                    <button
                                      type="button"
                                      onClick={() => handleOpenDocument(getFileUrl(doc.file_url), doc.file_type)}
                                      className="text-blue-700 hover:text-blue-900 hover:underline truncate text-left flex-1 min-w-0"
                                      title="Open file"
                                    >
                                      {doc.file_name}
                                    </button>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => removeExistingSubjectDocument(subject, doc.id)}
                                    className="text-red-600 hover:text-red-800 active:text-red-900 flex-shrink-0 p-1 touch-manipulation ml-2"
                                    style={{ WebkitTapHighlightColor: 'transparent' }}
                                    aria-label="Remove document"
                                    title="Remove this document"
                                  >
                                    <X className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        <input
                          type="file"
                          multiple
                          accept=".pdf,.png,.jpg,.jpeg"
                          onChange={(e) => handleSubjectFileChange(subject, e)}
                          className="w-full border border-slate-300 rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                        />
                        {(subjectFilesMap[subject] || []).length > 0 && (
                          <div className="mt-2">
                            <p className="text-[10px] sm:text-xs text-slate-600 mb-1.5 font-medium">New documents to upload:</p>
                            <ul className="space-y-1">
                              {(subjectFilesMap[subject] || []).map((file, idx) => (
                                <li key={idx} className="flex items-center justify-between text-xs sm:text-sm text-slate-600 bg-white p-1.5 sm:p-2 rounded border border-slate-200">
                                  <span className="break-words flex-1 min-w-0 pr-2">{file.name}</span>
                                  <button
                                    type="button"
                                    onClick={() => removeSubjectFile(subject, idx)}
                                    className="text-red-600 hover:text-red-800 active:text-red-900 flex-shrink-0 p-1 touch-manipulation"
                                    style={{ WebkitTapHighlightColor: 'transparent' }}
                                    aria-label="Remove file"
                                  >
                                    <X className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Documents */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5 sm:mb-2">
                Proof Documents <span className="text-red-500">*</span>
              </label>

              {/* Display existing proof documents */}
              {existingProofDocuments.length > 0 && (
                <div className="mb-3">
                  <p className="text-[10px] sm:text-xs text-slate-600 mb-1.5 font-medium">Previously uploaded documents:</p>
                  <ul className="space-y-1.5">
                    {existingProofDocuments.map((doc) => (
                      <li key={doc.id} className="flex items-center justify-between text-xs sm:text-sm text-slate-700 bg-blue-50 border border-blue-200 p-1.5 sm:p-2 rounded">
                        <div className="flex items-center min-w-0 flex-1">
                          <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-600 mr-2 flex-shrink-0" />
                          <button
                            type="button"
                            onClick={() => handleOpenDocument(getFileUrl(doc.file_url), doc.file_type)}
                            className="text-blue-700 hover:text-blue-900 hover:underline truncate text-left flex-1 min-w-0"
                            title="Open file"
                          >
                            {doc.file_name}
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeExistingProofDocument(doc.id)}
                          className="text-red-600 hover:text-red-800 active:text-red-900 flex-shrink-0 p-1 touch-manipulation ml-2"
                          style={{ WebkitTapHighlightColor: 'transparent' }}
                          aria-label="Remove document"
                          title="Remove this document"
                        >
                          <X className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <input
                type="file"
                multiple
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={(e) => {
                  if (e.target.files) {
                    setReapplicationDocuments(Array.from(e.target.files));
                  }
                }}
                className="w-full border border-slate-300 rounded-lg px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
              />
              {reapplicationDocuments.length > 0 && (
                <div className="mt-2">
                  <p className="text-[10px] sm:text-xs text-slate-600 mb-1.5 font-medium">New documents to upload:</p>
                  <ul className="list-disc list-inside text-xs sm:text-sm text-slate-600 space-y-1">
                    {reapplicationDocuments.map((f, i) => (
                      <li key={i} className="break-words">{f.name}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Weekly Availability */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5 sm:mb-2">
                Weekly Availability
              </label>
              <p className="text-[10px] sm:text-xs text-slate-500 mb-1.5 sm:mb-2">
                Select the days and time slots when you're available for tutoring sessions.
              </p>

              {/* Day selector */}
              <div className="mb-3 sm:mb-4">
                <select
                  className="w-full border border-slate-300 rounded-lg px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm"
                  value={dayToAdd}
                  onChange={(e) => setDayToAdd(e.target.value)}
                >
                  <option value="">Select a day to add...</option>
                  {daysOfWeek
                    .filter(day => !reapplicationAvailability[day])
                    .map(day => (
                      <option key={day} value={day}>{day}</option>
                    ))}
                </select>
                {dayToAdd && (
                  <Button
                    onClick={() => {
                      addReapplicationDay(dayToAdd);
                      setDayToAdd('');
                    }}
                    className="w-full mt-2 text-xs sm:text-sm py-1.5 sm:py-2"
                  >
                    Add Day
                  </Button>
                )}
              </div>

              {/* Availability display */}
              {Object.keys(reapplicationAvailability).length > 0 && (
                <div className="space-y-3 sm:space-y-4 mt-3 sm:mt-4">
                  {Object.entries(reapplicationAvailability).map(([day, dayAvail]) => (
                    <div key={day} className="border border-slate-200 rounded-lg p-2.5 sm:p-3 md:p-4 bg-slate-50">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0 mb-2 sm:mb-3">
                        <h4 className="font-medium text-xs sm:text-sm md:text-base text-slate-800">{day}</h4>
                        <div className="flex gap-1.5 sm:gap-2 w-full sm:w-auto">
                          <button
                            type="button"
                            onClick={() => addReapplicationTimeSlot(day)}
                            className="text-xs sm:text-sm px-2 sm:px-3 py-1 bg-primary-100 text-primary-700 hover:bg-primary-200 active:bg-primary-300 rounded-md flex-1 sm:flex-none touch-manipulation"
                            style={{ WebkitTapHighlightColor: 'transparent' }}
                          >
                            Add Time Slot
                          </button>
                          <button
                            type="button"
                            onClick={() => removeReapplicationDay(day)}
                            className="text-xs sm:text-sm px-2 sm:px-3 py-1 text-red-600 bg-red-50 hover:bg-red-100 active:bg-red-200 rounded-md flex-1 sm:flex-none touch-manipulation"
                            style={{ WebkitTapHighlightColor: 'transparent' }}
                          >
                            Remove Day
                          </button>
                        </div>
                      </div>
                      <div className="space-y-1.5 sm:space-y-2">
                        {dayAvail.slots.map((slot, idx) => (
                          <div key={idx} className="flex flex-wrap items-center gap-1.5 sm:gap-2 bg-white p-1.5 sm:p-2 rounded">
                            <input
                              type="time"
                              value={slot.startTime}
                              onChange={(e) => updateReapplicationSlotTime(day, idx, 'startTime', e.target.value)}
                              className="border border-slate-300 rounded px-1.5 sm:px-2 py-1 text-xs sm:text-sm flex-1 min-w-[100px]"
                            />
                            <span className="text-slate-500 text-xs sm:text-sm">-</span>
                            <input
                              type="time"
                              value={slot.endTime}
                              onChange={(e) => updateReapplicationSlotTime(day, idx, 'endTime', e.target.value)}
                              className="border border-slate-300 rounded px-1.5 sm:px-2 py-1 text-xs sm:text-sm flex-1 min-w-[100px]"
                            />
                            <button
                              type="button"
                              onClick={() => removeReapplicationTimeSlot(day, idx)}
                              className="text-xs sm:text-sm text-red-600 hover:text-red-800 active:text-red-900 p-1 touch-manipulation"
                              style={{ WebkitTapHighlightColor: 'transparent' }}
                              aria-label="Remove time slot"
                            >
                              <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 pt-4 sm:pt-5 border-t-2 border-slate-200">
              <Button
                variant="secondary"
                onClick={() => setShowReapplicationForm(false)}
                className="w-full sm:w-auto text-xs sm:text-sm md:text-base py-2 sm:py-2.5 px-4 sm:px-5 order-2 sm:order-1"
              >
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  if (!tutorId) {
                    alert('Tutor not found');
                    return;
                  }
                  // Validation
                  if (!fullName || !yearLevel || !gcashNumber || !sessionRate || !bio) {
                    alert('Please fill in all required fields');
                    return;
                  }
                  // Validate GCash number format
                  if (!gcashNumber.startsWith('09') || gcashNumber.length !== 11) {
                    alert('Please enter a valid GCash number (11 digits starting with 09)');
                    return;
                  }
                  if (Array.from(reapplicationSubjects).length === 0) {
                    alert('Please add at least one subject of expertise');
                    return;
                  }
                  // Check if all subjects have files (either existing or new)
                  const subjectsWithoutFiles = Array.from(reapplicationSubjects).filter(
                    subject => {
                      const hasNewFiles = subjectFilesMap[subject] && subjectFilesMap[subject].length > 0;
                      const hasExistingFiles = existingSubjectDocumentsMap[subject] && existingSubjectDocumentsMap[subject].length > 0;
                      return !hasNewFiles && !hasExistingFiles;
                    }
                  );
                  if (subjectsWithoutFiles.length > 0) {
                    alert(`Please add supporting documents for: ${subjectsWithoutFiles.join(', ')}`);
                    return;
                  }
                  // Check if there are proof documents (either existing or new)
                  const hasProofDocuments = existingProofDocuments.length > 0 || reapplicationDocuments.length > 0;
                  if (!hasProofDocuments) {
                    alert('Please add at least one proof document');
                    return;
                  }

                  setIsSubmittingReapplication(true);
                  try {
                    // Update tutor basic info
                    await apiClient.put(`/tutors/${tutorId}`, {
                      full_name: fullName,
                      year_level: Number(yearLevel),
                      gcash_number: gcashNumber,
                      session_rate_per_hour: Number(sessionRate),
                      bio: bio
                    });

                    // Update user name if changed
                    if (user?.name !== fullName) {
                      await apiClient.put(`/users/${user?.user_id}`, { name: fullName });
                    }

                    // Upload profile image if changed
                    if (profilePhoto) {
                      const formData = new FormData();
                      formData.append('file', profilePhoto);
                      await apiClient.post(`/tutors/${tutorId}/profile-image`, formData, {
                        headers: { 'Content-Type': 'multipart/form-data' }
                      });
                    }

                    // Upload GCash QR if changed
                    if (gcashQR) {
                      const formData = new FormData();
                      formData.append('file', gcashQR);
                      await apiClient.post(`/tutors/${tutorId}/gcash-qr`, formData, {
                        headers: { 'Content-Type': 'multipart/form-data' }
                      });
                    }

                    // Submit all subjects (reapply all previously applied subjects)
                    for (const subject of Array.from(reapplicationSubjects)) {
                      const files = subjectFilesMap[subject] || [];
                      const hasExistingDocs = existingSubjectDocumentsMap[subject] && existingSubjectDocumentsMap[subject].length > 0;

                      // Submit subject application
                      // If subject has new files, upload them
                      // If subject only has existing documents, still reapply (backend will handle it)
                      const form = new FormData();
                      form.append('subject_name', subject);
                      form.append('is_reapplication', 'true'); // Mark as reapplication

                      if (files.length > 0) {
                        // Has new files - upload them
                        files.forEach(f => form.append('files', f));
                      }
                      // If only has existing documents, form will have no files but is_reapplication flag
                      // Backend will check for existing documents and allow the reapplication

                      // Skip if no files and no existing documents (shouldn't happen due to validation)
                      if (files.length === 0 && !hasExistingDocs) {
                        console.warn(`Skipping subject "${subject}" - no files or existing documents`);
                        continue;
                      }

                      await apiClient.post(`/tutors/${tutorId}/subject-application`, form, {
                        headers: { 'Content-Type': 'multipart/form-data' }
                      });
                    }

                    // Upload new documents if any
                    if (reapplicationDocuments.length > 0) {
                      const form = new FormData();
                      reapplicationDocuments.forEach(f => form.append('files', f));
                      await apiClient.post(`/tutors/${tutorId}/documents`, form, {
                        headers: { 'Content-Type': 'multipart/form-data' }
                      });
                    }

                    // Update availability
                    const availabilitySlots = Object.entries(reapplicationAvailability).flatMap(([day, dayAvail]) =>
                      dayAvail.slots.map(slot => ({
                        day_of_week: day,
                        start_time: slot.startTime,
                        end_time: slot.endTime
                      }))
                    );
                    if (availabilitySlots.length > 0) {
                      await apiClient.post(`/tutors/${tutorId}/availability`, { slots: availabilitySlots });
                    }

                    // Reset status to pending
                    await apiClient.patch(`/tutors/${tutorId}/status`, { status: 'pending' });

                    alert('Application updated and resubmitted successfully! Your application is now pending review.');
                    setShowReapplicationForm(false);
                    refreshStatus();
                    fetchSubjectApplications(); // Refresh subject applications
                  } catch (error: any) {
                    console.error('Failed to resubmit application:', error);
                    alert('Failed to resubmit application. Please try again.');
                  } finally {
                    setIsSubmittingReapplication(false);
                  }
                }}
                disabled={isSubmittingReapplication}
                className="w-full sm:w-auto bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white shadow-lg hover:shadow-xl text-xs sm:text-sm md:text-base py-2 sm:py-2.5 px-4 sm:px-5 order-1 sm:order-2"
              >
                {isSubmittingReapplication ? 'Submitting...' : 'Submit Reapplication'}
              </Button>
            </div>
          </div>
        </Card>
      )}


      {/* File Preview Modal */}
      <Modal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        title={previewType.startsWith('image/') ? 'Image Preview' : previewType === 'application/pdf' ? 'PDF Preview' : 'File Preview'}
        footer={
          <>
            <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary-600">Open in new tab</a>
          </>
        }
      >
        <div className="w-full h-[70vh] bg-slate-100 rounded overflow-hidden flex items-center justify-center">
          {previewType === 'application/pdf' ? (
            <iframe title="PDF" src={previewUrl} className="w-full h-full" />
          ) : previewType.startsWith('image/') || previewType === 'image/*' ? (
            <img src={previewUrl} alt="Preview" className="max-h-full max-w-full object-contain" />
          ) : (
            <div className="text-sm text-slate-600 p-4 text-center">
              Preview not available. You can open the file in a new tab.
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default ApplicationVerification;