import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (email: string) => void;
  mode?: 'default' | 'admin';
}

const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  mode = 'default',
}) => {
  const navigate = useNavigate();
  const [multiAccountOptions, setMultiAccountOptions] = useState<Array<{ user_type: string, name: string }>>([]);
  const [showMultiAccountSelection, setShowMultiAccountSelection] = useState(false);
  const [selectedAccountType, setSelectedAccountType] = useState<string | null>(null);

  // Restore missing state variables
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showProceedButton, setShowProceedButton] = useState(false);

  const isAdminMode = mode === 'admin';
  const requestEndpoint = isAdminMode ? '/auth/password-reset/admin/request' : '/auth/password-reset/request';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      console.log('Frontend: Sending email:', email);

      // First, check user type before submitting
      try {
        const userTypeResponse = await api.get(`/auth/password-reset/check-user-type?email=${encodeURIComponent(email)}`);
        const result = userTypeResponse.data;

        console.log('Frontend: User type check result:', result);

        if (!result) {
          setError('This email address is not registered in our system. Cannot proceed with password reset. Please verify your email address or contact support if you believe this is an error.');
          setIsLoading(false);
          return;
        }

        // Handle multiple accounts
        if (result.multiple_accounts) {
          setMultiAccountOptions(result.accounts);
          setShowMultiAccountSelection(true);
          setIsLoading(false);
          return;
        }

        const userType = result.userType;

        // Validate user type matches the mode
        if (isAdminMode && userType !== 'admin') {
          const userTypeLabel = userType === 'tutor' ? 'tutor' : userType === 'tutee' ? 'tutee' : userType;
          setError(`This email belongs to a ${userTypeLabel} account. Please use the regular login page to reset your password.`);
          setIsLoading(false);
          return;
        }

        if (!isAdminMode && userType === 'admin') {
          setError('This email belongs to an admin account. Admin password reset must be done through the Admin Login Page.');
          setIsLoading(false);
          return;
        }
      } catch (checkError: any) {
        // If user not found, show appropriate error
        if (checkError.response?.status === 404 || checkError.response?.status === 400) {
          const checkErrorMessage = checkError.response?.data?.message || '';
          if (checkErrorMessage.toLowerCase().includes('not found') || checkErrorMessage.toLowerCase().includes('not registered')) {
            setError('This email address is not registered in our system. Cannot proceed with password reset. Please verify your email address or contact support if you believe this is an error.');
            setIsLoading(false);
            return;
          }
        }
        // If check fails for other reasons, continue with the request (backend will validate)
        console.log('Frontend: User type check failed, continuing with request:', checkError);
      }

      await sendResetRequest(email);

    } catch (err: any) {
      handleError(err);
    }
  };

  const sendResetRequest = async (email: string, user_type?: string) => {
    try {
      setIsLoading(true);
      const requestBody = { email, user_type };
      console.log('Frontend: Request body:', requestBody);

      const response = await api.post(requestEndpoint, requestBody);
      console.log('Frontend: Response received:', response.data);

      if (response.data) {
        setSuccess(true);
        setShowProceedButton(true);
        if (user_type) setSelectedAccountType(user_type);
      }
    } catch (err: any) {
      handleError(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleError = (err: any) => {
    console.log('Frontend: Error occurred:', err);
    console.log('Frontend: Error response:', err.response?.data);

    // Check for specific error cases
    const errorMessage = err.response?.data?.message || err.message || 'Failed to send verification code. Please try again.';
    const errorStatus = err.response?.status;

    // Handle email not registered/found case
    if (
      errorStatus === 404 ||
      errorMessage.toLowerCase().includes('not found') ||
      errorMessage.toLowerCase().includes('user not found') ||
      errorMessage.toLowerCase().includes('email not registered') ||
      errorMessage.toLowerCase().includes('could not find') ||
      errorMessage.toLowerCase().includes('does not exist')
    ) {
      setError('This email address is not registered in our system. Cannot proceed with password reset. Please verify your email address or contact support if you believe this is an error.');
    } else {
      setError(errorMessage);
    }
    setIsLoading(false);
  };

  const handleAccountSelection = (account: { user_type: string, name: string }) => {
    setShowMultiAccountSelection(false);
    sendResetRequest(email, account.user_type);
  };

  const handleClose = () => {
    setEmail('');
    setError('');
    setSuccess(false);
    setShowProceedButton(false);
    setShowMultiAccountSelection(false);
    setMultiAccountOptions([]);
    setSelectedAccountType(null);
    onClose();
  };

  const handleProceedToReset = () => {
    const params = new URLSearchParams();
    if (email) params.set('email', email);
    if (isAdminMode) params.set('type', 'admin');
    if (selectedAccountType) params.set('user_type', selectedAccountType); // Pass selected user type
    navigate(`/password-reset?${params.toString()}`);
    if (onSuccess) {
      onSuccess(email);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/50 max-w-md w-full relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-sky-500 to-indigo-600"></div>
        </div>

        <div className="relative z-10 p-5">
          {/* Header */}
          <div className="text-center mb-3">
            <div className="mx-auto w-12 h-12 bg-gradient-to-r from-sky-500 to-indigo-600 rounded-full flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-slate-900 via-sky-800 to-indigo-800 bg-clip-text text-transparent mb-2">
              Forgot Password?
            </h2>
            <p className="text-slate-600 text-sm">
              {showMultiAccountSelection
                ? 'Select the account you want to reset password for.'
                : `Enter your ${isAdminMode ? 'admin' : 'account'} email address and we'll send you a verification code to reset your password.`
              }
            </p>
          </div>

          {success ? (
            <div className="text-center">
              <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-3">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-green-800 mb-2">Code Sent!</h3>
              <p className="text-green-700 text-sm mb-4">
                We've sent a verification code to <strong>{email}</strong>. Please check your email and spam folder.
              </p>
              <div className="flex items-center justify-center space-x-1 mb-4">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
              </div>

              {/* Proceed to Reset Password Button */}
              <div className="space-y-3">
                <button
                  onClick={handleProceedToReset}
                  className="w-full flex justify-center items-center py-3 px-6 border border-transparent rounded-lg shadow-xl text-sm font-bold text-white bg-gradient-to-r from-green-600 via-green-500 to-emerald-600 hover:from-green-700 hover:via-green-600 hover:to-emerald-700 focus:outline-none focus:ring-4 focus:ring-green-500/30 transition-all duration-300 transform hover:scale-105 hover:shadow-2xl relative overflow-hidden group"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <span className="relative z-10 flex items-center">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Reset Password
                  </span>
                </button>

                <button
                  onClick={handleClose}
                  className="w-full py-2 px-4 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          ) : showMultiAccountSelection ? (
            <div className="space-y-3">
              {multiAccountOptions.map((account, index) => (
                <button
                  key={index}
                  onClick={() => handleAccountSelection(account)}
                  className="w-full flex items-center p-3 border-2 border-slate-200 rounded-xl hover:border-sky-500 hover:bg-sky-50 transition-all duration-200 group relative overflow-hidden"
                >
                  <div className="w-10 h-10 rounded-full bg-sky-100 flex items-center justify-center mr-3 group-hover:bg-sky-200 transition-colors">
                    {/* Simple icon based on type */}
                    {account.user_type === 'tutor' ? (
                      <svg className="w-6 h-6 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                    ) : (
                      <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                    )}
                  </div>
                  <div className="text-left">
                    <div className="font-bold text-slate-800 group-hover:text-sky-700 capitalize">
                      {account.user_type} Account
                    </div>
                    <div className="text-xs text-slate-500">
                      click to reset password
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              {/* Error Message */}
              {error && (
                <div className="bg-red-50/90 backdrop-blur-sm border border-red-200 text-red-600 px-3 py-2 rounded-xl text-xs font-medium shadow-lg">
                  <div className="flex items-center">
                    <svg className="w-4 h-4 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    {error}
                  </div>
                </div>
              )}

              {/* Email Field */}
              <div className="space-y-1">
                <label htmlFor="email" className="block text-sm font-semibold text-slate-800">
                  Email Address
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-4 w-4 text-slate-400 group-focus-within:text-sky-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                    </svg>
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-white/95 backdrop-blur-sm border-2 border-slate-200 rounded-lg focus:ring-4 focus:ring-sky-500/20 focus:border-sky-500 transition-all duration-300 placeholder-slate-400 font-medium shadow-lg hover:shadow-xl text-sm group-focus-within:shadow-xl"
                    placeholder="Enter your university email"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex justify-center items-center py-2.5 px-6 border border-transparent rounded-lg shadow-2xl text-sm font-bold text-white bg-gradient-to-r from-sky-600 via-sky-500 to-indigo-600 hover:from-sky-700 hover:via-sky-600 hover:to-indigo-700 focus:outline-none focus:ring-4 focus:ring-sky-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 hover:shadow-3xl relative overflow-hidden group"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  {isLoading ? (
                    <div className="flex items-center relative z-10">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span className="text-sm">Sending Code...</span>
                    </div>
                  ) : (
                    <span className="relative z-10 flex items-center">
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      Send Verification Code
                    </span>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Close Button */}
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordModal;
