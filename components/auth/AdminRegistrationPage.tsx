import React, { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { Link, useNavigate } from 'react-router-dom';
import Logo from '../Logo';
import { logoBase64 } from '../../assets/logo';
import apiClient from '../../services/api';
import { University } from '../../types';
import { useToast } from '../ui/Toast';

const RegistrationPage: React.FC = () => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { register } = useAuth();
  const { notify } = useToast();
  const [universities, setUniversities] = useState<University[]>([]);
  const [universityId, setUniversityId] = useState<number | ''>('');
  const [emailDomainError, setEmailDomainError] = useState<string | null>(null);
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [showVerificationModal, setShowVerificationModal] = useState(false);

  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [verificationError, setVerificationError] = useState('');
  const [hasCodeSent, setHasCodeSent] = useState(false);
  const [codeExpired, setCodeExpired] = useState(false);

  useEffect(() => {
    const loadUniversities = async () => {
      try {
        const res = await apiClient.get('/universities');
        // Filter to only include universities with "active" status
        const activeUniversities = (res.data || []).filter((uni: any) => uni.status === 'active');
        setUniversities(activeUniversities);
      } catch (e) {
        // ignore, handled by interceptor
      }
    };
    loadUniversities();
  }, []);

  // Email validation effect (without domain constraint)
  useEffect(() => {
    if (!email) {
      setEmailDomainError(null);
      setIsEmailVerified(false);
      setHasCodeSent(false);
      setCodeExpired(false);
      return;
    }

    // No domain validation - allow any email format
    setEmailDomainError(null);
    // Check if email is already verified or has pending code
    checkEmailVerificationStatus(email);
  }, [email]);

  const checkEmailVerificationStatus = async (emailToCheck: string) => {
    if (!emailToCheck) {
      setIsEmailVerified(false);
      setHasCodeSent(false);
      setCodeExpired(false);
      return;
    }

    try {
      const response = await apiClient.get(`/auth/email-verification/status?email=${encodeURIComponent(emailToCheck)}&user_type=admin`);
      if (response.data && response.data.is_verified === 1) {
        setIsEmailVerified(true);
        setHasCodeSent(false);
        setCodeExpired(false);
      } else {
        setIsEmailVerified(false);
        // Check if there's a pending code (not verified but code exists)
        if (response.data && response.data.verification_expires) {
          const expiresAt = new Date(response.data.verification_expires);
          const now = new Date();
          if (expiresAt > now) {
            // Code exists and is not expired
            setHasCodeSent(true);
            setCodeExpired(false);
          } else {
            // Code exists but is expired
            setHasCodeSent(true);
            setCodeExpired(true);
          }
        } else {
          // No code sent
          setHasCodeSent(false);
          setCodeExpired(false);
        }
      }
    } catch (err) {
      // If API call fails, assume email is not verified and no code sent
      setIsEmailVerified(false);
      setHasCodeSent(false);
      setCodeExpired(false);
    }
  };

  const handleSendVerificationCode = async () => {
    if (!email || emailDomainError) {
      return;
    }

    setIsSendingCode(true);
    setVerificationError('');

    try {
      console.log('Frontend: Sending verification code to:', email);
      const response = await apiClient.post('/auth/email-verification/send-code', {
        email,
        user_type: 'admin'
      }, {
        timeout: 30000 // 30 seconds timeout for email sending
      });
      console.log('Frontend: Verification code response:', response.data);

      if (response.data) {
        setHasCodeSent(true);
        setCodeExpired(false);
        setShowVerificationModal(true);
        notify('Verification code sent to your email!', 'success');
      }
    } catch (err: any) {
      console.log('Frontend: Verification code error:', err);
      console.log('Error details:', {
        message: err.message,
        code: err.code,
        response: err.response,
        request: err.request
      });

      // Check if it's a network error vs server error
      let errorMessage = 'Failed to send verification code. Please try again.';

      // Check for connection timeout errors (browser-level, can't reach server)
      const isConnectionTimeout = err.code === 'ERR_CONNECTION_TIMED_OUT' ||
        err.code === 'ETIMEDOUT' ||
        (err.message && err.message.includes('ERR_CONNECTION_TIMED_OUT')) ||
        (err.message && err.message.includes('Connection timed out'));

      // Check for axios timeout errors (request took too long but server was reachable)
      const isRequestTimeout = err.code === 'ECONNABORTED' ||
        (err.message && err.message.includes('timeout') && !isConnectionTimeout);

      // Check for actual network errors (no response from server, but not timeout)
      const isNetworkError = (err.isNetworkError || // Flag from interceptor
        err.code === 'ENOTFOUND' ||
        err.code === 'ERR_NETWORK' ||
        err.code === 'ERR_INTERNET_DISCONNECTED' ||
        (err.message && err.message.includes('Network Error'))) &&
        !isConnectionTimeout && !isRequestTimeout;

      // Check for connection errors (no response but not timeout)
      const isConnectionError = (!err.response && err.request && !isConnectionTimeout && !isRequestTimeout) ||
        (err.response && !err.response.status &&
          err.response.data?.message?.includes('Unable to connect to the server') &&
          !isConnectionTimeout && !isRequestTimeout);

      if (isConnectionTimeout) {
        // Connection timeout - can't reach the backend server
        errorMessage = 'Connection timed out. Please check that the backend server is running at the correct IP address and port, and that there are no firewall issues blocking the connection.';
      } else if (isRequestTimeout) {
        // Request timeout - server was reachable but took too long
        errorMessage = 'Request timed out. The email service may be slow. Please try again.';
      } else if (isNetworkError || isConnectionError) {
        // Network error - backend might not be running
        errorMessage = 'Unable to connect to the server. Please ensure the backend server is running and try again.';
      } else if (err.response?.data?.message) {
        // Server returned an error message - use it directly
        errorMessage = err.response.data.message;
      } else if (err.message) {
        // Use the error message if available
        errorMessage = err.message;
      }

      setVerificationError(errorMessage);
    } finally {
      setIsSendingCode(false);
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
        email,
        code: verificationCode,
        user_type: 'admin'
      }, {
        timeout: 30000 // 30 seconds timeout for email verification
      });
      console.log('Frontend: Verification response:', response.data);

      if (response.data) {
        setIsEmailVerified(true);
        setHasCodeSent(false);
        setCodeExpired(false);
        setShowVerificationModal(false);
        setVerificationCode('');
        notify('Email verified successfully! You can now create your account.', 'success');
      }
    } catch (err: any) {
      console.log('Frontend: Verification error:', err);
      console.log('Error details:', {
        message: err.message,
        code: err.code,
        response: err.response,
        request: err.request
      });

      // Check if it's a network error vs server error
      let errorMessage = 'Invalid verification code. Please try again.';

      // Check for connection timeout errors (browser-level, can't reach server)
      const isConnectionTimeout = err.code === 'ERR_CONNECTION_TIMED_OUT' ||
        err.code === 'ETIMEDOUT' ||
        (err.message && err.message.includes('ERR_CONNECTION_TIMED_OUT')) ||
        (err.message && err.message.includes('Connection timed out'));

      // Check for axios timeout errors (request took too long but server was reachable)
      const isRequestTimeout = err.code === 'ECONNABORTED' ||
        (err.message && err.message.includes('timeout') && !isConnectionTimeout);

      // Check for actual network errors (no response from server, but not timeout)
      const isNetworkError = (err.isNetworkError || // Flag from interceptor
        err.code === 'ENOTFOUND' ||
        err.code === 'ERR_NETWORK' ||
        err.code === 'ERR_INTERNET_DISCONNECTED' ||
        (err.message && err.message.includes('Network Error'))) &&
        !isConnectionTimeout && !isRequestTimeout;

      // Check for connection errors (no response but not timeout)
      const isConnectionError = (!err.response && err.request && !isConnectionTimeout && !isRequestTimeout) ||
        (err.response && !err.response.status &&
          err.response.data?.message?.includes('Unable to connect to the server') &&
          !isConnectionTimeout && !isRequestTimeout);

      if (isConnectionTimeout) {
        // Connection timeout - can't reach the backend server
        errorMessage = 'Connection timed out. Please check that the backend server is running at the correct IP address and port, and that there are no firewall issues blocking the connection.';
      } else if (isRequestTimeout) {
        // Request timeout - server was reachable but took too long
        errorMessage = 'Request timed out. The email service may be slow. Please try again.';
      } else if (isNetworkError || isConnectionError) {
        // Network error - backend might not be running
        errorMessage = 'Unable to connect to the server. Please ensure the backend server is running and try again.';
      } else if (err.response?.data?.message) {
        // Server returned an error message - use it directly
        errorMessage = err.response.data.message;
      } else if (err.message) {
        // Use the error message if available
        errorMessage = err.message;
      }

      setVerificationError(errorMessage);
    } finally {
      setIsVerifyingCode(false);
    }
  };

  const handleCloseVerificationModal = () => {
    setShowVerificationModal(false);
    setVerificationCode('');
    setVerificationError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 7 || password.length > 13) {
      setError('Password must be between 7 and 13 characters.');
      return;
    }
    if (emailDomainError) {
      setError(emailDomainError);
      return;
    }
    if (!isEmailVerified) {
      setError('Please verify your email address before creating your account.');
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      await register({ name, email, password, user_type: 'admin', ...(universityId ? { university_id: Number(universityId) } : {}) });
      // Show success message
      notify('Account created successfully! Redirecting to admin dashboard...', 'success');
      // Small delay to show the success message before navigation
      setTimeout(() => {
        setIsLoading(false);
        navigate('/admin/dashboard');
      }, 1500);
    } catch (err: any) {
      const serverMessage = err.response?.data?.message || err.message || 'An unknown error occurred during registration.';
      const statusCode = err.response?.status;
      const normalizedMessage =
        statusCode === 404 || serverMessage?.toString().includes('404')
          ? '1 Admin Account is permitted.'
          : serverMessage;
      setError(normalizedMessage);
      setIsLoading(false);
    }
  };

  const inputStyles = "w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-[3px] focus:ring-sky-500/20 focus:border-sky-500 outline-none transition-all duration-300 font-medium text-slate-900 placeholder:text-slate-400 text-sm shadow-sm";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-sky-50 to-indigo-100 flex items-start justify-center p-4 relative overflow-y-auto overflow-x-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-sky-400/20 to-indigo-400/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-tr from-indigo-400/20 to-sky-400/20 rounded-full blur-3xl"></div>
      </div>

      <div className="w-full max-w-6xl my-auto bg-white/80 backdrop-blur-2xl rounded-[2.5rem] shadow-2xl lg:overflow-hidden grid lg:grid-cols-2 relative z-10 lg:max-h-[800px]">
        {/* Left Side - Slideshow (Desktop Only) */}
        <div className="relative hidden lg:block h-full min-h-[500px]">
          <AdminRegisterSlideshow />
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 w-max">
            <div className="flex items-center gap-3 bg-white/95 backdrop-blur-md border border-white/60 rounded-2xl shadow-xl px-5 py-2.5">
              <Logo className="h-8 w-auto text-sky-600" />
              <div className="h-6 w-px bg-slate-200 mx-1"></div>
              <span className="px-3 py-1 bg-sky-600 text-white rounded-full text-[10px] font-bold tracking-widest uppercase shadow-sm">Administrative</span>
            </div>
          </div>
        </div>

        {/* Right Side - Registration Form */}
        <div className="relative w-full min-h-full lg:h-full bg-white overflow-hidden flex flex-col">
          {/* Decorative background blur for right side content */}
          <div className="absolute top-0 right-0 -mt-20 -mr-20 w-80 h-80 bg-gradient-to-br from-sky-100/40 to-indigo-100/40 rounded-full blur-3xl pointer-events-none"></div>

          <div className="relative lg:absolute lg:inset-0 lg:overflow-y-auto flex flex-col lg:justify-center px-6 sm:px-10 pt-12 pb-10 custom-scrollbar lg:[scrollbar-width:none] lg:[-ms-overflow-style:none] lg:[&::-webkit-scrollbar]:display-none">
            <div className="relative z-10 w-full max-w-md mx-auto">
              <form className="space-y-4 pt-0" onSubmit={handleSubmit}>
                {/* Email Verification Section - First */}
                <div className="bg-gradient-to-r from-primary-50 to-primary-100 p-3 rounded-xl border border-primary-200 mt-2">
                  <h3 className="text-base font-semibold text-slate-800 mb-2 flex items-center">
                    <svg className="w-4 h-4 mr-2 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    Email Verification
                  </h3>

                  <div className="flex flex-col gap-2">
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">University(Optional)</label>
                      <select
                        className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
                        value={universityId}
                        onChange={(e) => setUniversityId(e.target.value ? Number(e.target.value) : '')}
                      >
                        <option value="">Select University</option>
                        {universities.map(u => (
                          <option key={u.university_id} value={u.university_id}>{u.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Email Address</label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all ${emailDomainError ? 'border-red-400 bg-red-50' : 'border-slate-300'
                          }`}
                        placeholder="Enter your email address"
                        required
                      />
                      {emailDomainError && <p className="text-sm text-red-600 mt-2 flex items-center">
                        <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        {emailDomainError}
                      </p>}
                    </div>
                  </div>

                  {/* Verification Status and Button */}
                  <div className="mt-2 space-y-2">
                    <div className="flex items-center text-slate-600">
                      {isEmailVerified ? (
                        <div className="flex items-center text-green-700">
                          <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                              clipRule="evenodd"
                            />
                          </svg>
                          <span className="font-medium">Email verified successfully!</span>
                        </div>
                      ) : (
                        <div className="flex items-center text-slate-600">
                          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 19.5c-.77.833.192 2.5 1.732 2.5z" />
                          </svg>
                          <span>Email verification required to create account</span>
                        </div>
                      )}
                    </div>

                    {/* Show "Send Code" button when no code sent or code expired */}
                    {(!hasCodeSent || codeExpired) && !isEmailVerified && (
                      <button
                        type="button"
                        onClick={handleSendVerificationCode}
                        disabled={!email || emailDomainError || isSendingCode}
                        className={`w-full px-6 py-3 rounded-lg font-semibold transition-all duration-300 transform ${!email || emailDomainError
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-primary-600 text-white hover:bg-primary-700 hover:scale-105 shadow-lg hover:shadow-xl focus:ring-2 focus:ring-primary-500 focus:ring-offset-2'
                          }`}
                        title={
                          !email
                            ? 'Enter email first'
                            : emailDomainError
                              ? 'Fix email domain error first'
                              : codeExpired
                                ? 'Code expired. Send a new code'
                                : 'Send verification code'
                        }
                      >
                        {isSendingCode ? (
                          <div className="flex justify-center items-center">
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Sending Code...
                          </div>
                        ) : (
                          <div className="flex justify-center items-center">
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                            Send Code
                          </div>
                        )}
                      </button>
                    )}

                    {/* Show "Input Code" button when code has been sent and is not expired */}
                    {hasCodeSent && !codeExpired && !isEmailVerified && (
                      <button
                        type="button"
                        onClick={() => setShowVerificationModal(true)}
                        disabled={!email || emailDomainError}
                        className={`w-full px-6 py-3 rounded-lg font-semibold transition-all duration-300 transform ${!email || emailDomainError
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-primary-600 text-white hover:bg-primary-700 hover:scale-105 shadow-lg hover:shadow-xl focus:ring-2 focus:ring-primary-500 focus:ring-offset-2'
                          }`}
                        title={
                          !email
                            ? 'Enter email first'
                            : emailDomainError
                              ? 'Fix email domain error first'
                              : 'Enter verification code'
                        }
                      >
                        <div className="flex justify-center items-center">
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          Input Code
                        </div>
                      </button>
                    )}

                    {/* Show verified status when email is verified */}
                    {isEmailVerified && (
                      <div className="w-full px-6 py-3 rounded-lg font-semibold bg-green-100 text-green-800 border-2 border-green-300 cursor-default flex justify-center items-center">
                        <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        Verified ✓
                      </div>
                    )}
                  </div>
                </div>

                {/* Full Name, Password, and Confirm Password - Only visible after email verification */}
                {isEmailVerified && (
                  <>
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                        Full Name
                      </label>
                      <input
                        id="name"
                        name="name"
                        type="text"
                        autoComplete="name"
                        required
                        value={name}
                        onChange={(e) => {
                          // Only allow letters and periods (no spaces)
                          let filteredValue = e.target.value.replace(/[^a-zA-Z.]/g, '');
                          // Allow only one period
                          const periodCount = (filteredValue.match(/\./g) || []).length;
                          if (periodCount > 1) {
                            // Keep only the first period
                            const firstPeriodIndex = filteredValue.indexOf('.');
                            filteredValue = filteredValue.slice(0, firstPeriodIndex + 1) +
                              filteredValue.slice(firstPeriodIndex + 1).replace(/\./g, '');
                          }
                          // Limit to 100 characters
                          if (filteredValue.length > 100) {
                            filteredValue = filteredValue.slice(0, 100);
                          }
                          setName(filteredValue);
                        }}
                        className={inputStyles}
                        placeholder="John Doe"
                        maxLength={100}
                      />
                    </div>

                    <div>
                      <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                        Password
                      </label>
                      <div className="relative">
                        <input
                          id="password"
                          name="password"
                          type={showPassword ? "text" : "password"}
                          autoComplete="new-password"
                          data-form-type="other"
                          data-lpignore="true"
                          data-1p-ignore="true"
                          data-bwignore="true"
                          style={{
                            WebkitTextSecurity: showPassword ? 'none' : 'disc',
                            WebkitAppearance: 'none',
                            MozAppearance: 'textfield'
                          }}
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className={`${inputStyles} pr-10 
                    [&::-ms-reveal]:hidden 
                    [&::-webkit-credentials-auto-fill-button]:!hidden 
                    [&::-webkit-strong-password-auto-fill-button]:!hidden 
                    [&::-webkit-credentials-auto-fill-button]:!hidden 
                    [&::-webkit-strong-password-auto-fill-button]:!hidden`
                          }
                          minLength={7}
                          maxLength={13}
                          placeholder="********"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                        >
                          {showPassword ? (
                            // Swapped to a cleaner, known-good "Eye" SVG
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 24 24"
                              strokeWidth={1.5}
                              stroke="currentColor"
                              className="h-5 w-5"
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
                              className="h-5 w-5"
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

                    <div>
                      <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700">
                        Confirm Password
                      </label>
                      <div className="relative">
                        <input
                          id="confirm-password"
                          name="confirm-password"
                          type={showConfirmPassword ? "text" : "password"}
                          autoComplete="new-password"
                          data-form-type="other"
                          data-lpignore="true"
                          data-1p-ignore="true"
                          data-bwignore="true"
                          style={{
                            WebkitTextSecurity: showConfirmPassword ? 'none' : 'disc',
                            WebkitAppearance: 'none',
                            MozAppearance: 'textfield'
                          }}
                          required
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className={`${inputStyles} pr-10 
                    [&::-ms-reveal]:hidden 
                    [&::-webkit-credentials-auto-fill-button]:!hidden 
                    [&::-webkit-strong-password-auto-fill-button]:!hidden 
                    [&::-webkit-credentials-auto-fill-button]:!hidden 
                    [&::-webkit-strong-password-auto-fill-button]:!hidden`
                          }
                          minLength={7}
                          maxLength={13}
                          placeholder="********"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                        >
                          {showConfirmPassword ? (
                            // Swapped to a cleaner, known-good "Eye" SVG
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 24 24"
                              strokeWidth={1.5}
                              stroke="currentColor"
                              className="h-5 w-5"
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
                              className="h-5 w-5"
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
                  </>
                )}

                {error && (
                  <div className="bg-red-50/90 backdrop-blur-sm border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm font-medium shadow-lg">
                    <div className="flex items-center">
                      <svg className="w-5 h-5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                      {error}
                    </div>
                  </div>
                )}

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isLoading || !isEmailVerified}
                    className="w-full py-2.5 px-4 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-sky-200 transition-all duration-300 transform active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                  >
                    {isLoading ? (
                      <>
                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        <span>Creating account...</span>
                      </>
                    ) : (
                      <>
                        <span>{isEmailVerified ? 'Create account' : 'Verify Email to Create Account'}</span>
                        <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                      </>
                    )}
                  </button>
                </div>
              </form>
              <div className="mt-2 text-center text-sm text-slate-500 font-medium">
                Already have an account?{' '}
                <Link to="/admin-login" className="text-sky-600 hover:text-sky-700 font-bold transition-colors underline-offset-4 hover:underline">
                  Sign in here
                </Link>
              </div>
              <div className="mt-2 mb-2 flex justify-center">
                <button
                  onClick={() => navigate('/LandingPage')}
                  className="group relative flex items-center justify-center text-slate-500 hover:text-sky-600 transition-all duration-300 text-sm font-semibold hover:translate-x-1 py-1"
                >
                  <span className="absolute -left-6 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">←</span>
                  <span>Back to Home Page</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Email Verification Modal */}
      {showVerificationModal && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            // Close modal when clicking on the backdrop (not the modal content)
            if (e.target === e.currentTarget) {
              handleCloseVerificationModal();
            }
          }}
        >
          <div
            className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/50 max-w-md w-full relative overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-5">
              <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-primary-500 to-primary-700"></div>
            </div>

            <div className="relative z-10 p-6">
              {/* Header */}
              <div className="text-center mb-6">
                <div className="mx-auto w-16 h-16 bg-gradient-to-r from-primary-500 to-primary-700 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold bg-gradient-to-r from-slate-900 via-primary-700 to-primary-800 bg-clip-text text-transparent mb-2">
                  Verify Your Email
                </h2>
                <p className="text-slate-600 text-sm">
                  We've sent a 6-digit verification code to <strong>{email}</strong>. Please check your email and enter the code below.
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
                  <div className="relative">
                    <input
                      id="verification-code"
                      type="text"
                      value={verificationCode}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                        setVerificationCode(value);
                      }}
                      placeholder="Enter 6-digit code"
                      className="w-full px-4 py-3 pr-12 bg-white/95 backdrop-blur-sm border-2 border-slate-200 rounded-lg focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-300 placeholder-slate-400 font-medium shadow-lg hover:shadow-xl text-center text-2xl tracking-widest"
                      maxLength={6}
                      autoComplete="off"
                    />
                    {verificationCode && (
                      <button
                        type="button"
                        onClick={() => {
                          setVerificationCode('');
                          setVerificationError('');
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 transition-colors rounded-full hover:bg-slate-100"
                        title="Clear code"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={handleVerifyCode}
                    disabled={!verificationCode.trim() || verificationCode.length !== 6 || isVerifyingCode}
                    className="flex-1 flex justify-center items-center py-3 px-6 border border-transparent rounded-lg shadow-2xl text-sm font-bold text-white bg-gradient-to-r from-primary-600 via-primary-500 to-primary-700 hover:from-primary-700 hover:via-primary-600 hover:to-primary-800 focus:outline-none focus:ring-4 focus:ring-primary-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 hover:shadow-3xl relative overflow-hidden group"
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
                    className="text-sm text-primary-600 hover:text-primary-700 font-medium transition-colors"
                  >
                    {isSendingCode ? 'Sending...' : "Didn't receive the code? Resend"}
                  </button>
                </div>
              </div>
            </div>

            {/* Close Button */}
            <button
              type="button"
              onClick={handleCloseVerificationModal}
              className="absolute top-4 right-4 z-20 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all duration-200 cursor-pointer"
              title="Close"
              aria-label="Close verification modal"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RegistrationPage;

// Simple fading slideshow for admin-themed images
const AdminRegisterSlideshow: React.FC = () => {
  const [index, setIndex] = React.useState(0);
  const slides = React.useMemo(() => [
    {
      src: 'https://images.unsplash.com/photo-1552581234-26160f608093?q=80&w=2070&auto=format&fit=crop',
      alt: 'Admin secure registration environment',
    },
    {
      src: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?q=80&w=2070&auto=format&fit=crop',
      alt: 'Admin collaboration in modern workspace',
    },
    {
      src: 'https://images.unsplash.com/photo-1521791136064-7986c2920216?q=80&w=2070&auto=format&fit=crop',
      alt: 'Admin teamwork in modern office',
    },
  ], []);

  React.useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % slides.length), 4000);
    return () => clearInterval(id);
  }, [slides.length]);

  return (
    <div className="absolute inset-0">
      {slides.map((s, i) => (
        <img
          key={i}
          src={s.src}
          alt={s.alt}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${i === index ? 'opacity-100' : 'opacity-0'}`}
        />
      ))}
      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/10 to-transparent"></div>
    </div>
  );
};