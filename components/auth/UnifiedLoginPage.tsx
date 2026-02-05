import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Logo from '../Logo';
import { useAuth } from '../../hooks/useAuth';
import ForgotPasswordModal from './ForgotPasswordModal';
import { useToast } from '../../components/ui/Toast';

const UnifiedLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { loginTutorTutee } = useAuth();
  const { notify } = useToast();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  // Online images related to tutoring/learning concepts
  const slideshowImages = [
    {
      src: 'assets/images/bgp4.jpg',
      alt: 'Student attending online tutoring session',
      title: 'Personalized Tutoring',
      description: 'One-on-one online sessions that make learning more effective'
    },
    {
      src: 'assets/images/bg6.png',
      alt: 'Tutor helping student with laptop',
      title: 'Expert Guidance',
      description: 'Students empowering each other through personalized learning'
    },
    {
      src: 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?q=80&w=2070&auto=format&fit=crop',
      alt: 'Students in university lecture hall',
      title: 'Academic Excellence',
      description: 'Building knowledge and skills for future success'
    },
    {
      src: 'assets/images/bg2.png',
      alt: 'Student raising hand in classroom',
      title: 'Interactive Learning',
      description: 'Engaging educational experiences that inspire growth'
    },
    {
      src: 'assets/images/bg3.png',
      alt: 'Person using laptop with virtual learning icons',
      title: 'Digital Education',
      description: 'Empowering learning through innovative online platforms'
    },
    {
      src: 'assets/images/bg5.png',
      alt: 'Students studying together in a modern classroom',
      title: 'Collaborative Learning',
      description: 'Students working together to achieve academic success'
    }
  ];

  // Restore saved email on mount if "remember me" was previously checked
  useEffect(() => {
    const savedEmail = localStorage.getItem('rememberedEmail');
    const rememberMeStatus = localStorage.getItem('rememberMe') === 'true';

    if (savedEmail && rememberMeStatus) {
      setFormData(prev => ({ ...prev, email: savedEmail }));
      setRememberMe(true);
    }
  }, []);

  // Save/remove email based on rememberMe checkbox
  useEffect(() => {
    if (rememberMe && formData.email) {
      localStorage.setItem('rememberedEmail', formData.email);
      localStorage.setItem('rememberMe', 'true');
    } else if (!rememberMe) {
      localStorage.removeItem('rememberedEmail');
      localStorage.removeItem('rememberMe');
    }
  }, [rememberMe, formData.email]);

  // Auto-advance slideshow with cleanup and pause on unmount
  useEffect(() => {
    let isMounted = true;
    const interval = setInterval(() => {
      if (isMounted) {
        setCurrentSlide((prevSlide) => (prevSlide + 1) % slideshowImages.length);
      }
    }, 4000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const checkNetworkQuality = () => {
      if (!navigator.onLine) {
        notify('You are currently offline', 'error');
        return;
      }

      const connection = (navigator as any).connection;
      if (connection) {
        // criteria for "Excellent": 4g and low latency
        if (connection.effectiveType === '4g' && connection.rtt < 100 && connection.downlink > 10) {
          notify('Excellent internet connection 🚀', 'success');
        } else if (connection.effectiveType === '4g') {
          notify('Good internet connection', 'info');
        } else if (['3g', '2g', 'slow-2g'].includes(connection.effectiveType)) {
          notify('Internet connection is slow', 'error');
        } else {
          notify('Internet connection stable', 'info');
        }
      } else {
        // Fallback if connection API is not available
        notify('Internet connection available', 'info');
      }
    };

    // Check on mount
    const timer = setTimeout(checkNetworkQuality, 1000);

    // Check when browser history navigation occurs (back/forward cache)
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        setTimeout(checkNetworkQuality, 500);
      }
    };

    // Standard visibility change
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkNetworkQuality();
      }
    };

    window.addEventListener('pageshow', handlePageShow);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', checkNetworkQuality);
    window.addEventListener('offline', checkNetworkQuality);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('pageshow', handlePageShow);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', checkNetworkQuality);
      window.removeEventListener('offline', checkNetworkQuality);
    };
  }, [notify]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (error) setError(''); // Clear error when user starts typing
  };



  const handleAccountSelection = async (accountType: string) => {
    setIsLoading(true);
    setShowAccountSelection(false);
    try {
      const result = await loginTutorTutee(formData.email, formData.password, accountType);
      const role = result as string;
      switch (role) {
        case 'tutee': navigate('/tutee-dashboard', { replace: true }); break;
        case 'tutor': navigate('/tutor-dashboard/sessions', { replace: true }); break;
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Login failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const [showAccountSelection, setShowAccountSelection] = useState(false);
  const [availableAccounts, setAvailableAccounts] = useState<{ user_type: string; name: string }[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // Pass undefined for user_type initially
      const result: any = await loginTutorTutee(formData.email, formData.password);

      // Check for multi-account response
      if (result && result.multiple_accounts) {
        setAvailableAccounts(result.accounts);
        setShowAccountSelection(true);
        setIsLoading(false);
        return;
      }

      // Normal login success
      const role = result as string;
      switch (role) {
        case 'tutee':
          navigate('/tutee-dashboard', { replace: true });
          break;
        case 'tutor':
          navigate('/tutor-dashboard/sessions', { replace: true });
          break;
        default:
          throw new Error('Invalid user role');
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Invalid credentials. Please try again.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const inputStyles = "w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-[3px] focus:ring-sky-500/20 focus:border-sky-500 outline-none transition-all duration-300 font-medium text-slate-900 placeholder:text-slate-400 text-sm shadow-sm";
  return (
    <div className="h-screen bg-gradient-to-br from-slate-50 via-sky-50 to-indigo-100 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-sky-400/20 to-indigo-400/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-tr from-indigo-400/20 to-sky-400/20 rounded-full blur-3xl"></div>
      </div>

      <div className="w-full max-w-6xl bg-white/80 backdrop-blur-2xl rounded-[2.5rem] shadow-2xl overflow-hidden grid lg:grid-cols-2 relative z-10 max-h-[90vh] lg:max-h-[800px]">

        {/* Left Side - Slideshow (Desktop Only) */}
        <div className="relative hidden lg:block h-full min-h-[500px]">
          {slideshowImages.map((image, index) => (
            <div
              key={index}
              className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${index === currentSlide ? 'opacity-100' : 'opacity-0'}`}
            >
              <img
                src={image.src}
                alt={image.alt}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent"></div>
            </div>
          ))}

          <div className="absolute bottom-10 left-10 right-10 text-white z-20">
            <h2 className="text-3xl font-bold mb-2 leading-tight">{slideshowImages[currentSlide].title}</h2>
            <p className="text-base text-white/90 mb-6 leading-normal max-w-md">{slideshowImages[currentSlide].description}</p>

            <div className="flex space-x-2">
              {slideshowImages.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentSlide(index)}
                  className={`h-1.5 rounded-full transition-all duration-300 ${index === currentSlide ? 'w-8 bg-white' : 'w-2 bg-white/40 hover:bg-white/60'}`}
                  aria-label={`Go to slide ${index + 1}`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Right Side - Login Form */}
        <div className="relative w-full min-h-full lg:h-full bg-white overflow-hidden flex flex-col">

          {/* Decorative background blur for right side content */}
          <div className="absolute top-0 right-0 -mt-20 -mr-20 w-80 h-80 bg-gradient-to-br from-sky-100/40 to-indigo-100/40 rounded-full blur-3xl pointer-events-none"></div>

          <div className="relative lg:absolute lg:inset-0 overflow-y-auto flex flex-col justify-center p-6 sm:p-10 custom-scrollbar">

            <div className="relative z-10 w-full max-w-md mx-auto">
              {/* Header Section */}
              <div className="mb-6">
                <div className="flex flex-col lg:flex-row items-center lg:justify-between lg:items-end gap-4">
                  <div className="flex flex-col lg:flex-row items-center gap-0">
                    <Logo className="h-14 w-auto text-sky-600" />
                    <span className="text-2xl font-bold bg-gradient-to-r from-sky-600 to-indigo-600 bg-clip-text text-transparent tracking-tight text-center lg:text-left lg:-ml-1.5">TutorFriends</span>
                  </div>
                  <div className="text-center lg:text-right pb-0.5">
                    <h1 className="text-base font-bold text-slate-900 leading-tight">
                      Welcome Back
                    </h1>
                    <p className="text-slate-500 text-xs font-medium leading-tight mt-0.5">
                      Please sign in
                    </p>
                  </div>
                </div>
              </div>

              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="space-y-1.5">
                  <label htmlFor="email" className="block text-xs font-bold text-slate-600 uppercase tracking-wider ml-1">Email Address</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-slate-400 group-focus-within:text-sky-500 transition-colors duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" /></svg>
                    </div>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      required
                      value={formData.email}
                      onChange={handleInputChange}
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-[3px] focus:ring-sky-500/20 focus:border-sky-500 outline-none transition-all duration-300 font-medium text-slate-900 placeholder:text-slate-400 text-sm shadow-sm"
                      placeholder="student@university.edu"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center ml-1 mb-0.5">
                    <label htmlFor="password" className="block text-xs font-bold text-slate-600 uppercase tracking-wider">Password</label>
                    <button type="button" onClick={() => setShowForgotPasswordModal(true)} className="text-xs font-bold text-sky-600 hover:text-sky-700 transition-colors">Forgot Password?</button>
                  </div>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-slate-400 group-focus-within:text-sky-500 transition-colors duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                    </div>
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      required
                      value={formData.password}
                      autoComplete="current-password"
                      data-form-type="other"
                      data-lpignore="true"
                      data-1p-ignore="true"
                      data-bwignore="true"
                      onChange={handleInputChange}
                      className={`${inputStyles} pr-10 
                      [&::-ms-reveal]:hidden 
                      [&::-webkit-credentials-auto-fill-button]:!hidden 
                      [&::-webkit-strong-password-auto-fill-button]:!hidden`}
                      minLength={7}
                      maxLength={13}
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1"
                    >
                      {showPassword ? (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L6.228 6.228" /></svg>
                      )}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="bg-red-50/80 backdrop-blur-sm text-red-600 px-3 py-2 rounded-lg text-xs font-medium flex items-center shadow-sm border border-red-100 animate-fade-in-up">
                    <svg className="w-4 h-4 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-sky-500/20 hover:shadow-sky-500/40 hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center space-x-2 text-sm tracking-wide"
                >
                  {isLoading ? (
                    <>
                      <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                      <span>Checking...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign In</span>
                      <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                    </>
                  )}
                </button>
              </form>

              <div className="mt-8 flex justify-center">
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

          <ForgotPasswordModal
            isOpen={showForgotPasswordModal}
            onClose={() => setShowForgotPasswordModal(false)}
            onSuccess={() => { }}
          />

          {/* Account Selection Modal */}
          {showAccountSelection && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
              <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm transform transition-all scale-100 animate-slide-up">
                <h3 className="text-xl font-bold text-slate-800 mb-2">Multiple Accounts Found</h3>
                <p className="text-slate-600 text-sm mb-6">This email is associated with multiple accounts. Please select which one you want to continue as:</p>

                <div className="space-y-3">
                  {availableAccounts.map((account) => (
                    <button
                      key={account.user_type}
                      onClick={() => handleAccountSelection(account.user_type)}
                      className="w-full text-left p-4 rounded-xl border border-slate-200 hover:border-sky-500 hover:bg-sky-50 hover:shadow-md transition-all duration-200 group relative overflow-hidden"
                    >
                      <div className="flex items-center justify-between relative z-10">
                        <div>
                          <p className="font-bold text-slate-800 group-hover:text-sky-700 capitalize text-lg">{account.user_type}</p>
                          <p className="text-xs text-slate-500 group-hover:text-sky-600">Continue as {account.user_type}</p>
                        </div>
                        <div className="h-12 w-12 bg-slate-100 group-hover:bg-white rounded-full flex items-center justify-center group-hover:shadow-sm transition-all overflow-hidden border border-slate-200">
                          <img
                            src={account.user_type === 'tutor' ? '/assets/images/tutor.png' : '/assets/images/tutee.png'}
                            alt={account.user_type}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 flex justify-center">
                  <button
                    onClick={() => setShowAccountSelection(false)}
                    className="text-slate-400 hover:text-slate-600 text-sm font-medium transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UnifiedLoginPage;
