import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../services/api';
import { CheckCircleIcon } from '../../components/icons/CheckCircleIcon';
import { useToast } from '../../components/ui/Toast';
import Logo from '../../components/Logo';
import { mapRoleToStorageKey, setRoleAuth, updateRoleUser } from '../../utils/authRole';
import LoadingOverlay from '../../components/ui/LoadingOverlay';

interface TuteeRegistrationModalProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const TuteeRegistrationPage: React.FC<TuteeRegistrationModalProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { notify } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | undefined>(undefined);
  const [uploadMessage, setUploadMessage] = useState<string>('');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    course: '',
    yearLevel: '',
  });
  const [universities, setUniversities] = useState<{ university_id: number; name: string; email_domain: string; status: string }[]>([]);
  const [universityId, setUniversityId] = useState<number | ''>('');
  const [emailDomainError, setEmailDomainError] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [courses, setCourses] = useState<{ course_id: number; course_name: string; university_id: number | null }[]>([]);
  const [courseId, setCourseId] = useState<number | ''>('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [termsViewed, setTermsViewed] = useState(false);
  const [termsScrollProgress, setTermsScrollProgress] = useState(0);

  // Email verification states
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [verificationError, setVerificationError] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [codeExpiresAt, setCodeExpiresAt] = useState<number | null>(null);

  // Profile image state
  const [profileImage, setProfileImage] = useState<File | null>(null);

  const selectedUniversity = useMemo(() =>
    universities.find(u => u.university_id === universityId),
    [universities, universityId]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (name === 'email') {
      validateEmail(value, selectedUniversity);
    }
  };

  const validateEmail = (email: string, university: { university_id: number; name: string; email_domain: string; status: string } | undefined) => {
    if (!email || !universityId) {
      setEmailDomainError(null);
      setIsEmailVerified(false);
      return;
    }
    const uni = universities.find(u => u.university_id === universityId);
    if (!uni) {
      setEmailDomainError(null);
      setIsEmailVerified(false);
      return;
    }
    const domain = email.split('@')[1] || '';
    if (!domain || domain.toLowerCase() !== uni.email_domain.toLowerCase()) {
      setEmailDomainError(`Email domain must be ${uni.email_domain}`);
      setIsEmailVerified(false);
    } else {
      setEmailDomainError(null);
      // Check if email is already verified
      checkEmailVerificationStatus(email);
    }
  };

  const checkEmailVerificationStatus = async (emailToCheck: string) => {
    if (!emailToCheck || !universityId) {
      setIsEmailVerified(false);
      return;
    }

    try {
      const response = await apiClient.get(`/auth/email-verification/status?email=${encodeURIComponent(emailToCheck)}&user_type=tutee`);
      if (response.data && response.data.is_verified === 1) {
        setIsEmailVerified(true);
        // Reset code state when email is already verified
        setCodeSent(false);
        setCodeExpiresAt(null);
      } else {
        setIsEmailVerified(false);
      }
    } catch (err) {
      // If API call fails, assume email is not verified
      setIsEmailVerified(false);
    }
  };

  const checkActiveVerificationCode = async (emailToCheck: string) => {
    if (!emailToCheck || !universityId) {
      setCodeSent(false);
      setCodeExpiresAt(null);
      return;
    }

    try {
      // Check if there's an active verification code by checking the registry
      // We'll use a custom endpoint or check the status endpoint with additional info
      const response = await apiClient.get(`/auth/email-verification/status?email=${encodeURIComponent(emailToCheck)}&user_type=tutee`);

      // If the response includes code expiration info, use it
      if (response.data && response.data.verification_expires) {
        const expiresAt = new Date(response.data.verification_expires).getTime();
        const now = Date.now();

        // If code exists and hasn't expired
        if (expiresAt > now) {
          setCodeExpiresAt(expiresAt);
          setCodeSent(true);
          return;
        }
      }

      // If no active code found, reset state
      setCodeSent(false);
      setCodeExpiresAt(null);
    } catch (err) {
      // If API call fails, assume no active code
      setCodeSent(false);
      setCodeExpiresAt(null);
    }
  };

  const handleSendVerificationCode = async () => {
    if (!formData.email || !universityId) {
      notify('Please enter email and select university first.', 'error');
      return;
    }
    if (emailDomainError) {
      notify(emailDomainError, 'error');
      return;
    }

    setIsSendingCode(true);
    setVerificationError('');

    try {
      console.log('Frontend: Sending verification code to:', formData.email);
      const response = await apiClient.post('/auth/email-verification/send-code', {
        email: formData.email,
        user_type: 'tutee'
      });
      console.log('Frontend: Verification code response:', response.data);

      if (response.data) {
        // Set code expiration to 10 minutes from now
        const expirationTime = Date.now() + (10 * 60 * 1000); // 10 minutes
        setCodeExpiresAt(expirationTime);
        setCodeSent(true);
        notify('Verification code sent to your email!', 'success');
      }
    } catch (err: any) {
      console.log('Frontend: Verification code error:', err);
      const errorMessage = err.response?.data?.message || 'Failed to send verification code. Please try again.';
      setVerificationError(errorMessage);
      notify(errorMessage, 'error');
    } finally {
      setIsSendingCode(false);
    }
  };

  const handleInputCode = () => {
    if (codeSent && !isCodeExpired) {
      setShowVerificationModal(true);
      setVerificationError('');
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode.trim()) {
      setVerificationError('Please enter the verification code');
      return;
    }

    setIsVerifyingCode(true);
    setVerificationError('');

    try {
      console.log('Frontend: Verifying code:', verificationCode);
      const response = await apiClient.post('/auth/email-verification/verify-code', {
        email: formData.email,
        code: verificationCode,
        user_type: 'tutee'
      });
      console.log('Frontend: Verification response:', response.data);

      if (response.data) {
        setIsEmailVerified(true);
        setShowVerificationModal(false);
        setVerificationCode('');
        setCodeSent(false);
        setCodeExpiresAt(null);
        notify('Email verified successfully! You can now submit your registration.', 'success');
      }
    } catch (err: any) {
      console.log('Frontend: Verification error:', err);
      const errorMessage = err.response?.data?.message || 'Invalid verification code. Please try again.';
      setVerificationError(errorMessage);
      notify(errorMessage, 'error');
    } finally {
      setIsVerifyingCode(false);
    }
  };

  const handleCloseVerificationModal = () => {
    setShowVerificationModal(false);
    setVerificationCode('');
    setVerificationError('');
  };

  const handleCloseTermsModal = () => {
    if (termsScrollProgress >= 80) {
      setTermsViewed(true);
    }
    setShowTermsModal(false);
  };

  const handleTermsModalScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const scrollTop = target.scrollTop;
    const scrollHeight = target.scrollHeight;
    const clientHeight = target.clientHeight;
    const scrollPercentage = (scrollTop / (scrollHeight - clientHeight)) * 100;
    setTermsScrollProgress(scrollPercentage);
    if (scrollPercentage >= 80) {
      setTermsViewed(true);
    }
  };

  const handleProfileImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      // Check if it's an image file
      if (file.type.startsWith('image/')) {
        setProfileImage(file);
        notify('Profile image selected successfully!', 'success');
      } else {
        notify('Please select a valid image file.', 'error');
        e.target.value = '';
      }
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const res = await apiClient.get('/universities');
        // Filter to only include universities with "active" status
        const activeUniversities = (res.data || []).filter((uni: any) => uni.status === 'active');
        setUniversities(activeUniversities);
        const cr = await apiClient.get('/courses');
        const normalized = (Array.isArray(cr.data) ? cr.data : []).map((c: any) => ({
          ...c,
          university_id: c?.university_id ?? c?.university?.university_id ?? c?.universityId ?? null,
        }));
        setCourses(normalized);
      } catch (e) {
        setUniversities([]);
        setCourses([]);
      }
    })();
  }, []);

  useEffect(() => {
    if (!formData.email || !universityId) {
      setEmailDomainError(null);
      setIsEmailVerified(false);
      setCodeSent(false);
      setCodeExpiresAt(null);
      return;
    }
    const uni = universities.find(u => u.university_id === universityId);
    if (!uni) {
      setEmailDomainError(null);
      setIsEmailVerified(false);
      setCodeSent(false);
      setCodeExpiresAt(null);
      return;
    }
    const domain = formData.email.split('@')[1] || '';
    if (!domain || domain.toLowerCase() !== uni.email_domain.toLowerCase()) {
      setEmailDomainError(`Email domain must be ${uni.email_domain}`);
      setIsEmailVerified(false);
      setCodeSent(false);
      setCodeExpiresAt(null);
    } else {
      setEmailDomainError(null);
      // Check if email is already verified
      checkEmailVerificationStatus(formData.email);
      // Check if there's an active verification code
      checkActiveVerificationCode(formData.email);
    }
  }, [formData.email, universityId, universities]);

  // Check if code has expired
  const isCodeExpired = useMemo(() => {
    if (!codeExpiresAt) return true;
    return Date.now() > codeExpiresAt;
  }, [codeExpiresAt]);

  // Check expiration periodically
  useEffect(() => {
    if (!codeExpiresAt) return;

    const interval = setInterval(() => {
      if (Date.now() > codeExpiresAt) {
        setCodeSent(false);
        setCodeExpiresAt(null);
      }
    }, 1000); // Check every second

    return () => clearInterval(interval);
  }, [codeExpiresAt]);

  const filteredCourses = useMemo(() => {
    return courses.filter((c: any) => {
      const uid = c?.university_id ?? c?.university?.university_id ?? c?.universityId;
      return !universityId || uid === universityId;
    });
  }, [courses, universityId]);

  // Auto-select course if typed exactly matches existing (case-insensitive)
  useEffect(() => {
    const trimmed = formData.course.trim().toLowerCase();
    if (!trimmed || courseId) return;
    const match = filteredCourses.find(c => c.course_name.toLowerCase() === trimmed);
    if (match) {
      setCourseId(match.course_id);
    }
  }, [formData.course, courseId, filteredCourses]);

  // If university changes and current selected course no longer applies, reset
  useEffect(() => {
    if (!courseId) return;
    const stillValid = filteredCourses.some(c => c.course_id === courseId);
    if (!stillValid) {
      setCourseId('');
      setFormData(prev => ({ ...prev, course: '' }));
    }
  }, [filteredCourses, courseId]);

  // If no university selected, clear course selection/input
  useEffect(() => {
    if (!universityId) {
      setCourseId('');
      setFormData(prev => ({ ...prev, course: '' }));
    }
  }, [universityId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.password || !formData.yearLevel) {
      notify('Please fill all required fields.', 'error');
      return;
    }

    if (emailDomainError) {
      notify(emailDomainError, 'error');
      return;
    }

    if (!isEmailVerified) {
      notify('Please verify your email address before submitting the registration.', 'error');
      return;
    }

    if (formData.password.length < 7 || formData.password.length > 21) {
      notify('Password must be between 7 and 21 characters.', 'error');
      return;
    }

    const courseProvided = !!courseId || !!formData.course.trim();
    if (!courseProvided) {
      notify('Please select or enter a course.', 'error');
      return;
    }

    setIsLoading(true);

    setIsLoading(true);
    setUploadProgress(0);
    setUploadMessage('Initializing registration...');

    try {
      // Progress Weights (Total 100%)
      // 1. Register User: 40%
      // 2. Profile Image: 60%

      let currentBaseProgress = 0;

      const updateProgress = (base: number, percent: number, weight: number) => {
        const calculated = base + (percent * (weight / 100));
        setUploadProgress(Math.min(99, calculated)); // Cap at 99 until fully done
      };

      console.log('Starting tutee registration submission...');
      setUploadMessage('Creating your account...');

      console.log('Form data:', {
        name: formData.name.trim(),
        email: formData.email.toLowerCase(), // Ensure email is lowercase
        password: formData.password,
        university_id: Number(universityId),
        course_id: courseId ? Number(courseId) : undefined,
        course_name: !courseId && formData.course.trim().length > 0 ? formData.course.trim() : undefined,
        year_level: Number(formData.yearLevel),
      });

      // Register the user as a tutee
      const registerPayload = {
        name: formData.name.trim(),
        email: formData.email.toLowerCase(),
        password: formData.password,
        user_type: 'tutee',
        university_id: Number(universityId),
        course_id: courseId ? Number(courseId) : undefined,
        course_name: !courseId && formData.course.trim().length > 0 ? formData.course.trim() : undefined,
        year_level: Number(formData.yearLevel),
      };

      const registrationResponse = await apiClient.post('/auth/register', registerPayload);
      console.log('Tutee registration successful:', registrationResponse.data);

      // Store the token for authenticated requests
      const { user, accessToken } = registrationResponse.data;
      localStorage.setItem('token', accessToken);
      localStorage.setItem('user', JSON.stringify(user));
      const storageRole = mapRoleToStorageKey(user?.role) ?? mapRoleToStorageKey(user?.user_type);
      if (storageRole && user) {
        setRoleAuth(storageRole, user, accessToken);
      }

      console.log('Token stored:', accessToken);
      console.log('User stored:', user);

      // Test authentication endpoint
      try {
        const testResponse = await apiClient.get('/users/test-auth', {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        });
        console.log('Auth test successful:', testResponse.data);
      } catch (testErr) {
        console.error('Auth test failed:', testErr);
      }

      // Small delay to ensure token is properly set
      await new Promise(resolve => setTimeout(resolve, 100));

      currentBaseProgress += 40;
      setUploadProgress(currentBaseProgress);

      // Upload profile image if provided (Weight: 60%)
      if (profileImage) {
        try {
          console.log('Uploading profile image for tutee:', user.user_id);
          console.log('Using token:', accessToken);
          setUploadMessage('Uploading profile photo...');

          const pf = new FormData();
          pf.append('file', profileImage);

          const profileResponse = await apiClient.post(`/users/${user.user_id}/profile-image`, pf, {
            headers: {
              'Content-Type': 'multipart/form-data',
              'Authorization': `Bearer ${accessToken}`
            },
            onUploadProgress: (progressEvent) => {
              const percentCompleted = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 1));
              updateProgress(currentBaseProgress, percentCompleted, 60);
            }
          });
          console.log('Profile image uploaded successfully:', profileResponse.data);

          // Update user with new profile image URL
          const updatedUser = { ...user, profile_image_url: profileResponse.data.profile_image_url };
          localStorage.setItem('user', JSON.stringify(updatedUser));
          updateRoleUser(updatedUser);
          notify('Profile image uploaded successfully!', 'success');
        } catch (imageErr) {
          console.error('Failed to upload profile image:', imageErr);
          console.error('Error details:', imageErr.response?.data);
          console.error('Error status:', imageErr.response?.status);
          // Don't block registration if image upload fails
          notify('Registration successful, but profile image upload failed. You can update it later.', 'info');
          notify('Registration successful, but profile image upload failed. You can update it later.', 'info');
        }
      } else {
        // Set placeholder profile image
        setUploadMessage('Finalizing account...');
        try {
          console.log('Setting placeholder profile image for tutee');
          await apiClient.post(`/users/${user.user_id}/profile-image-placeholder`, {}, {
            headers: {
              'Authorization': `Bearer ${accessToken}`
            }
          });
          console.log('Placeholder profile image set');
        } catch (placeholderErr) {
          console.error('Failed to set placeholder profile image:', placeholderErr);
        }
      }

      setUploadProgress(100);
      setUploadMessage('Registration completed!');
      await new Promise(r => setTimeout(r, 600)); // Small delay to show 100%

      notify('Registration successful!', 'success');
      if (onClose) {
        onClose();
      } else {
        navigate('/LandingPage');
      }
      return;
    } catch (err: any) {
      setIsLoading(false);
      setUploadProgress(undefined);
      console.error('Registration error:', err);
      console.error('Error response:', err?.response?.data);
      console.error('Error status:', err?.response?.status);

      const message = err?.response?.data?.message || err?.message || 'Failed to submit registration';

      if (typeof message === 'string' && message.toLowerCase().includes('email already registered')) {
        notify('Email already registered', 'error');
      } else {
        notify(message, 'error');
      }
    }
  };

  if (isSubmitted) {
    return (
      <div className="min-h-[calc(100vh-68px)] flex flex-col items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full text-center bg-white p-10 rounded-xl shadow-lg">
          <CheckCircleIcon className="w-16 h-16 text-green-500 mx-auto" />
          <h2 className="text-3xl font-bold text-slate-800 mt-4">Registration Successful!</h2>
          <p className="text-slate-600 mt-2">
            Your account is now active! You can log in with your credentials anytime.
          </p>
          <button
            onClick={() => navigate('/login')}
            className="mt-8 w-full bg-sky-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-sky-700 transition-colors"
          >
            Proceed to Login
          </button>
          <button
            onClick={() => navigate('/LandingPage')}
            className="mt-8 w-full bg-sky-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-sky-700 transition-colors"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  const isModal = typeof isOpen === 'boolean';
  const isModalOpen = isModal ? !!isOpen : true;
  const handleCloseModal = () => {
    if (onClose) return onClose();
    try { window.history.back(); } catch { }
  };

  // Reset success state and gating when modal opens again
  useEffect(() => {
    if (isModalOpen) {
      setIsSubmitted(false);
      setAcceptedTerms(false);
      setTermsViewed(false);
      setShowVerificationModal(false);
    }
  }, [isModalOpen]);

  if (!isModalOpen) return null;

  return (
    <div
      className={isModal ? "fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-3 sm:p-6 animate-[fadeIn_200ms_ease-out]" : "min-h-screen flex items-center justify-center lg:py-8 bg-gradient-to-br from-indigo-50/40 to-sky-50/40"}
      role={isModal ? "dialog" : undefined}
      aria-modal={isModal ? "true" : undefined as any}
    >
      <div
        className={
          isModal
            ? "w-full max-w-5xl lg:max-w-4xl bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/50 overflow-hidden transform transition-all duration-300 ease-out animate-[slideUp_240ms_ease-out]"
            : "w-full max-w-5xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden max-h-[95vh] lg:max-h-[80vh] flex flex-col"
        }
      >
        <div className="flex items-center justify-between px-3 sm:px-4 md:px-5 lg:px-4 py-2.5 sm:py-3 lg:py-2 border-b border-slate-200/70 bg-gradient-to-r from-slate-50 to-white">
          <LoadingOverlay
            isLoading={isLoading}
            message={uploadProgress !== undefined ? "Registration in progress" : "Creating your account..."}
            progress={uploadProgress}
            subMessage={uploadMessage}
          />
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
            <Logo className="h-10 w-10 sm:h-12 sm:w-12 lg:h-10 lg:w-10 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-2xl font-bold text-slate-800 truncate">Student Registration</h1>
              <p className="text-slate-600 text-xs sm:text-sm hidden sm:block lg:hidden">Create your account to find a tutor.</p>
            </div>
          </div>
          {isModal ? (
            <button aria-label="Close" onClick={handleCloseModal} className="p-1.5 sm:p-2 rounded-full hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors flex-shrink-0 ml-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          ) : (
            <button
              type="button"
              aria-label="Back"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (onClose) {
                  onClose();
                } else {
                  window.history.back();
                }
              }}
              className="p-1.5 sm:p-2 rounded-full hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors flex-shrink-0 ml-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            </button>
          )}
        </div>
        <div className={`overflow-y-auto px-2 sm:px-3 md:px-4 lg:px-4 py-3 sm:py-4 lg:py-3 bg-gradient-to-br from-indigo-50/40 to-sky-50/40 ${isModal ? 'max-h-[85vh] sm:max-h-[90vh]' : 'flex-1'}`}>
          <div className="w-full bg-white/80 backdrop-blur-lg p-3 sm:p-4 md:p-5 lg:p-4 rounded-xl sm:rounded-2xl shadow-xl border border-white/50">
            <form onSubmit={handleSubmit} noValidate className="max-w-4xl mx-auto">
              {/* Email Verification Section */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-3 sm:p-4 md:p-4 lg:p-3 rounded-lg sm:rounded-xl border border-blue-200 mb-3 sm:mb-4 lg:mb-3">
                <h3 className="text-base sm:text-lg lg:text-base font-semibold text-slate-800 mb-3 sm:mb-3 lg:mb-2 flex items-center">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <span className="truncate">Email Verification</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="w-full">
                    <label className="block text-sm sm:text-base lg:text-sm text-slate-700 font-semibold mb-1.5 sm:mb-2 lg:mb-1">University</label>
                    <select
                      className="w-full px-3 sm:px-4 lg:px-3 py-2 sm:py-3 lg:py-2 text-sm sm:text-base lg:text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all max-w-[60ch]"
                      value={universityId}
                      onChange={(e) => setUniversityId(e.target.value ? Number(e.target.value) : '')}
                      required
                    >
                      <option value="">Select University</option>
                      {universities.map(u => (
                        <option key={u.university_id} value={u.university_id}>{u.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="w-full">
                    <label className="block text-sm sm:text-base lg:text-sm text-slate-700 font-semibold mb-1.5 sm:mb-2 lg:mb-1">Email Address</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      disabled={!universityId}
                      className={`w-full px-3 sm:px-4 lg:px-3 py-2 sm:py-3 lg:py-2 text-sm sm:text-base lg:text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all ${emailDomainError ? 'border-red-400 bg-red-50' :
                        !universityId ? 'border-slate-200 bg-slate-100 text-slate-500 cursor-not-allowed' :
                          'border-slate-300'
                        }`}
                      placeholder={!universityId ? "Select a university first" : "Enter your university email"}
                      name="email"
                      required
                    />
                    {!universityId && (
                      <p className="text-xs sm:text-sm text-slate-500 mt-1.5 sm:mt-2 flex items-start sm:items-center">
                        <svg className="w-3 h-3 sm:w-4 sm:h-4 mr-1 flex-shrink-0 mt-0.5 sm:mt-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="break-words">Please select a university first to enter your email</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Verification Buttons */}
                <div className="mt-3 sm:mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-end gap-3 sm:gap-4">
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={handleInputCode}
                      disabled={!codeSent || isCodeExpired || isEmailVerified}
                      className={`w-full sm:w-auto px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base rounded-lg font-semibold transition-all duration-300 transform flex-shrink-0 ${isEmailVerified
                        ? 'bg-green-100 text-green-800 border-2 border-green-300 cursor-default'
                        : !codeSent || isCodeExpired
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:scale-105 shadow-lg hover:shadow-xl'
                        }`}
                      title={
                        isEmailVerified
                          ? 'Email verified ✓'
                          : !codeSent
                            ? 'Send verification code first'
                            : isCodeExpired
                              ? 'Code expired. Please send a new code'
                              : 'Input verification code'
                      }
                    >
                      <div className="flex items-center">
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        Input Code
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={handleSendVerificationCode}
                      disabled={Boolean(!formData.email || !universityId || emailDomainError || isSendingCode || isEmailVerified || (codeSent && !isCodeExpired))}
                      className={`w-full sm:w-auto px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base rounded-lg font-semibold transition-all duration-300 transform flex-shrink-0 ${isEmailVerified
                        ? 'bg-green-100 text-green-800 border-2 border-green-300 cursor-default'
                        : !formData.email || !universityId || emailDomainError || (codeSent && !isCodeExpired)
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-blue-600 text-white hover:bg-blue-700 hover:scale-105 shadow-lg hover:shadow-xl'
                        }`}
                      title={
                        isEmailVerified
                          ? 'Email verified ✓'
                          : !formData.email || !universityId
                            ? 'Enter email and select university first'
                            : emailDomainError
                              ? 'Fix email domain error first'
                              : (codeSent && !isCodeExpired)
                                ? 'Code already sent. Use "Input Code" button or wait for expiration'
                                : 'Send verification code'
                      }
                    >
                      {isSendingCode ? (
                        <div className="flex items-center">
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Sending Code...
                        </div>
                      ) : isEmailVerified ? (
                        <div className="flex items-center">
                          <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          Verified ✓
                        </div>
                      ) : (
                        <div className="flex items-center">
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                          Send Verification Code
                        </div>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Other Account Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 sm:gap-3 lg:gap-3 mb-4 sm:mb-4 lg:mb-3 items-start">
                <div className="w-full sm:col-span-2 lg:col-span-8">
                  <label className="block text-sm sm:text-base lg:text-sm text-slate-700 font-semibold mb-1 lg:mb-0.5" htmlFor="name">Full Name</label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={(e) => {
                      const next = e.target.value.replace(/[^A-Za-z\-\s]/g, '').slice(0, 60);
                      handleInputChange({ target: { name: 'name', value: next } } as any);
                    }}
                    maxLength={60}
                    className="w-full py-2 sm:py-2 lg:py-1.5 pl-3 sm:pl-3 lg:pl-3 pr-3 sm:pr-3 lg:pr-3 text-sm sm:text-base lg:text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    placeholder="Enter your full name"
                    required
                  />
                </div>
                <div className="w-full sm:col-span-2 lg:col-span-4">
                  <label className="block text-sm sm:text-base lg:text-sm text-slate-700 font-semibold mb-1 lg:mb-0.5" htmlFor="password">Password</label>
                  <div className="relative w-full">
                    <input
                      type={showPassword ? "text" : "password"}
                      id="password"
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      minLength={7}
                      maxLength={21}
                      className="w-full px-3 sm:px-4 lg:px-3 py-2 sm:py-2.5 lg:py-1.5 pr-10 sm:pr-12 lg:pr-10 text-sm sm:text-base lg:text-sm border border-slate-300 rounded-lg 
                  [&::-ms-reveal]:hidden 
                  [&::-webkit-credentials-auto-fill-button]:hidden 
                  [&::-webkit-strong-password-auto-fill-button]:hidden"
                      autoComplete="new-password"
                      data-form-type="other"
                      data-lpignore="true"
                      data-1p-ignore="true"
                      data-bwignore="true"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-2 sm:pr-3 flex items-center text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? (
                        // Swapped to a cleaner, known-good "Eye" SVG
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={1.5}
                          stroke="currentColor"
                          className="h-4 w-4 sm:h-5 sm:w-5"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                        </svg>
                      ) : (
                        // Swapped to a cleaner, known-good "EyeOff" SVG
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={1.5}
                          stroke="currentColor"
                          className="h-4 w-4 sm:h-5 sm:w-5"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L6.228 6.228"
                          />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
                <div className="w-full sm:col-span-2 lg:col-span-8">
                  <label className="block text-sm sm:text-base text-slate-700 font-semibold mb-1">Course</label>
                  <select
                    className={`w-full px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base border rounded-lg ${!universityId ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed' : 'border-slate-300'}`}
                    value={courseId}
                    onChange={(e) => {
                      const value = e.target.value ? Number(e.target.value) : '';
                      setCourseId(value);
                      if (value) {
                        setFormData(prev => ({ ...prev, course: '' }));
                      }
                    }}
                    disabled={!universityId}
                    title={!universityId ? 'Select a university first' : undefined}
                  >
                    <option value="">Select Course</option>
                    {filteredCourses.map(c => (
                      <option key={c.course_id} value={c.course_id}>{c.course_name}</option>
                    ))}
                  </select>
                </div>
                <div className="w-full sm:col-span-2 lg:col-span-4">
                  <label className="block text-sm sm:text-base text-slate-700 font-semibold mb-1" htmlFor="yearLevel">Year Level</label>
                  <select
                    id="yearLevel"
                    name="yearLevel"
                    value={formData.yearLevel}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 text-sm sm:text-base border border-slate-300 rounded-lg"
                    required
                  >
                    <option value="">Select Year Level</option>
                    <option value="1">1st Year</option>
                    <option value="2">2nd Year</option>
                    <option value="3">3rd Year</option>
                    <option value="4">4th Year</option>
                    <option value="5">5th Year</option>
                  </select>
                </div>
              </div>

              {/* Profile Image Upload */}
              <div className="mb-4 sm:mb-4 lg:mb-3">
                <label className="block text-sm sm:text-base text-slate-700 font-semibold mb-1">Profile Image (optional)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleProfileImageChange}
                  className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-slate-300 rounded-lg"
                />
                {profileImage && <p className="text-xs text-slate-500 mt-1">Selected: {profileImage.name}</p>}
                <p className="text-xs text-slate-500 mt-1">Upload a photo of yourself (JPG, PNG, or other image formats)</p>
              </div>

              <div className="pt-2">
                <div className="flex items-start gap-2 text-xs sm:text-sm text-slate-700">
                  <input
                    id="accept-terms-tutee"
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                    disabled={!termsViewed}
                    className={`mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 flex-shrink-0 ${!termsViewed ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                  />
                  <label htmlFor="accept-terms-tutee" className="leading-5 break-words">
                    {termsViewed
                      ? 'I have read and agree to the Student Terms and Conditions.'
                      : 'I agree to the Student Terms and Conditions (please read the terms first).'}
                    <button
                      type="button"
                      className="ml-1 sm:ml-2 text-indigo-600 hover:text-indigo-700 underline whitespace-nowrap"
                      onClick={() => {
                        setShowTermsModal(true);
                        setTermsScrollProgress(0);
                      }}
                    >
                      {termsViewed ? 'Review Terms' : 'Read Terms'}
                    </button>
                  </label>
                </div>
                {!termsViewed && (
                  <p className="text-xs text-amber-600 mt-1 ml-6 sm:ml-7 flex items-start sm:items-center">
                    <svg className="w-3 h-3 sm:w-4 sm:h-4 mr-1 flex-shrink-0 mt-0.5 sm:mt-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <span className="break-words">Please open and read the Terms and Conditions before accepting.</span>
                  </p>
                )}
                <button
                  type="submit"
                  className={`mt-3 sm:mt-4 w-full font-bold py-2.5 sm:py-3 px-4 sm:px-6 text-sm sm:text-base rounded-lg transition-colors ${isEmailVerified && acceptedTerms && termsViewed
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                    : 'bg-gray-400 text-gray-600 cursor-not-allowed'
                    }`}
                  disabled={!isEmailVerified || !acceptedTerms || !termsViewed}
                  title={
                    !isEmailVerified
                      ? 'Please verify your email first'
                      : !termsViewed
                        ? 'Please read the Terms and Conditions first'
                        : !acceptedTerms
                          ? 'Please accept the Terms and Conditions'
                          : 'Create your account'
                  }
                >
                  {isEmailVerified ? 'Create Account' : 'Verify Email to Submit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Email Verification Modal */}
      {showVerificationModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/50 max-w-md w-full relative overflow-hidden">
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-5">
              <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-blue-500 to-indigo-600"></div>
            </div>

            <div className="relative z-10 p-6">
              {/* Header */}
              <div className="text-center mb-6">
                <div className="mx-auto w-16 h-16 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold bg-gradient-to-r from-slate-900 via-blue-800 to-indigo-800 bg-clip-text text-transparent mb-2">
                  Verify Your Email
                </h2>
                <p className="text-slate-600 text-sm">
                  We've sent a 6-digit verification code to <strong>{formData.email}</strong>. Please check your email and enter the code below.
                </p>
              </div>

              {/* Error Message */}
              {verificationError && (
                <div className="bg-red-50/90 backdrop-blur-sm border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm font-medium shadow-lg mb-4">
                  <div className="flex items-center">
                    <svg className="w-5 h-5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    {verificationError}
                  </div>
                </div>
              )}

              {/* Verification Code Input */}
              <div className="space-y-4">
                <div>
                  <label htmlFor="verification-code" className="block text-sm font-semibold text-slate-800 mb-2">
                    Verification Code
                  </label>
                  <input
                    id="verification-code"
                    type="text"
                    value={verificationCode}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                      setVerificationCode(value);
                    }}
                    placeholder="Enter 6-digit code"
                    className="w-full px-4 py-3 bg-white/95 backdrop-blur-sm border-2 border-slate-200 rounded-lg focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-300 placeholder-slate-400 font-medium shadow-lg hover:shadow-xl text-center text-2xl tracking-widest"
                    maxLength={6}
                    autoComplete="off"
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={handleVerifyCode}
                    disabled={!verificationCode.trim() || verificationCode.length !== 6 || isVerifyingCode}
                    className="flex-1 flex justify-center items-center py-3 px-6 border border-transparent rounded-lg shadow-2xl text-sm font-bold text-white bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 hover:from-blue-700 hover:via-blue-600 hover:to-indigo-700 focus:outline-none focus:ring-4 focus:ring-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 hover:shadow-3xl relative overflow-hidden group"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    {isVerifyingCode ? (
                      <div className="flex items-center relative z-10">
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span className="text-sm">Verifying...</span>
                      </div>
                    ) : (
                      <span className="relative z-10 flex items-center">
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Verify Code
                      </span>
                    )}
                  </button>

                  <button
                    onClick={handleCloseVerificationModal}
                    className="px-4 py-3 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>

                {/* Resend Code */}
                <div className="text-center">
                  <button
                    onClick={handleSendVerificationCode}
                    disabled={isSendingCode}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
                  >
                    {isSendingCode ? 'Sending...' : "Didn't receive the code? Resend"}
                  </button>
                </div>
              </div>
            </div>

            {/* Close Button */}
            <button
              onClick={handleCloseVerificationModal}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
      {/* Terms and Conditions Modal */}
      {showTermsModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/50 max-w-3xl w-full relative overflow-hidden">
            <div className="relative z-10 p-6">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-slate-800">Student Terms and Conditions</h2>
                  {termsScrollProgress > 0 && (
                    <div className="mt-2">
                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <div className="flex-1 bg-slate-200 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-indigo-600 h-full transition-all duration-300 ease-out"
                            style={{ width: `${Math.min(termsScrollProgress, 100)}%` }}
                          />
                        </div>
                        <span className="min-w-[3rem] text-right">
                          {Math.round(termsScrollProgress)}%
                        </span>
                      </div>
                      {termsScrollProgress >= 80 && (
                        <p className="text-xs text-green-600 mt-1 flex items-center">
                          <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          You can now accept the terms
                        </p>
                      )}
                    </div>
                  )}
                </div>
                <button type="button" onClick={handleCloseTermsModal} className="p-2 text-slate-400 hover:text-slate-600 ml-4">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div
                className="max-h-[65vh] overflow-y-auto pr-1 text-slate-700 space-y-4"
                onScroll={handleTermsModalScroll}
              >
                <p><strong>Effective Date:</strong> October 31, 2025</p>
                <p><strong>Platform Name:</strong> TutorFriends (“the Platform”)</p>
                <h3 className="font-semibold">1. Overview</h3>
                <p>These Terms govern your participation as a Student (Tutee) on TutorFriends. By registering and using the Platform, you agree to follow these rules and use the services responsibly.</p>
                <h3 className="font-semibold">2. Account and Verification</h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Provide accurate personal and academic information.</li>
                  <li>Use your official university email for verification.</li>
                  <li>Do not share your account with others.</li>
                </ul>
                <h3 className="font-semibold">3. Session Bookings</h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Book sessions only when you intend to attend.</li>
                  <li>Communicate clearly with tutors about your subject needs.</li>
                  <li>Confirm completed sessions promptly.</li>
                </ul>
                <h3 className="font-semibold">4. Payments</h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Payments are handled securely via the Platform.</li>
                  <li>Do not pay tutors outside the Platform.</li>
                </ul>
                <h3 className="font-semibold">4.1. Service Fee Deduction</h3>
                <p>All tutor earnings processed through the platform will be subject to a 13% service fee, automatically deducted to cover system and operational costs. The remaining 87% will be issued as the tutor's final payout. This fee is fixed and non-refundable.</p>
                <h3 className="font-semibold">5. Conduct</h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Be respectful and professional during sessions.</li>
                  <li>Do not request inappropriate content or behavior.</li>
                </ul>
                <h3 className="font-semibold">6. Ratings and Feedback</h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Provide fair and honest feedback after sessions.</li>
                  <li>Do not abuse the review system.</li>
                </ul>
                <h3 className="font-semibold">7. Privacy</h3>
                <p>Your information is handled in accordance with the Data Privacy Act of 2012. We use your data to operate and improve the Platform.</p>
                <h3 className="font-semibold">8. Modifications</h3>
                <p>TutorFriends may update these Terms anytime. Continued use means you accept the revised version.</p>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button type="button" onClick={handleCloseTermsModal} className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50">Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TuteeRegistrationPage;
export const TuteeRegistrationModal = TuteeRegistrationPage;