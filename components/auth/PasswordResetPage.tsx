import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Logo from '../Logo';
import api from '../../services/api';

const PasswordResetPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [formData, setFormData] = useState({
    code: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);

  // Get email and determine flow type (default vs admin)
  const email = searchParams.get('email') || '';
  const flowType = searchParams.get('type') === 'admin' ? 'admin' : 'default';
  const userType = searchParams.get('user_type'); // Get target user type if specified
  const resetEndpoint = flowType === 'admin' ? '/auth/password-reset/admin/verify-and-reset' : '/auth/password-reset/verify-and-reset';
  const redirectRoute = flowType === 'admin' ? '/admin-login' : '/login';

  // Online images related to tutoring/learning concepts (kept from original)
  const slideshowImages = [
    {
      src: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=2070&auto=format&fit=crop',
      alt: 'Students studying together in a modern classroom',
      title: 'Collaborative Learning',
      description: 'Students working together to achieve academic success'
    },
    {
      src: 'https://images.unsplash.com/photo-1543269865-cbf427effbad?q=80&w=2070&auto=format&fit=crop',
      alt: 'Tutor helping student with laptop',
      title: 'Expert Guidance',
      description: 'Experienced tutors providing personalized support'
    },
    {
      src: 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?q=80&w=2070&auto=format&fit=crop',
      alt: 'Students in university lecture hall',
      title: 'Academic Excellence',
      description: 'Building knowledge and skills for future success'
    },
    {
      src: 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?q=80&w=2070&auto=format&fit=crop',
      alt: 'Student raising hand in classroom',
      title: 'Interactive Learning',
      description: 'Engaging educational experiences that inspire growth'
    }
  ];

  // Auto-advance slideshow
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prevSlide) => (prevSlide + 1) % slideshowImages.length);
    }, 4000);

    return () => clearInterval(interval);
  }, [slideshowImages.length]);

  // Redirect to login if no email provided
  useEffect(() => {
    if (!email) {
      navigate(redirectRoute);
    }
  }, [email, navigate, redirectRoute]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (error) setError(''); // Clear error when user starts typing
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    // Validation
    if (formData.newPassword !== formData.confirmPassword) {
      setError('Passwords do not match');
      setIsLoading(false);
      return;
    }

    if (formData.newPassword.length < 7) {
      setError('Password must be at least 7 characters long');
      setIsLoading(false);
      return;
    }

    try {
      const response = await api.post(resetEndpoint, {
        email,
        code: formData.code,
        newPassword: formData.newPassword,
        user_type: userType || undefined, // Include user_type in request
      });

      if (response.data) {
        // Show success message and redirect to login
        // Use a more subtle notification or just redirect? 
        // Original code used alert, let's use a nice localized success state or just redirect.
        // For consistency with Login flow, maybe navigate with state?
        // But the original had an alert. I'll stick to alert for now or navigation.
        // Better yet, just navigate.
        alert('Password reset successful! You can now log in with your new password.');
        navigate(redirectRoute);
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to reset password. Please try again.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const inputStyles = "w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-[3px] focus:ring-sky-500/20 focus:border-sky-500 outline-none transition-all duration-300 font-medium text-slate-900 placeholder:text-slate-400 text-sm shadow-sm";

  if (!email) {
    return null;
  }

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

        {/* Right Side - Password Reset Form */}
        <div className="relative w-full min-h-full lg:h-full bg-white overflow-hidden flex flex-col">
          {/* Decorative background blur for right side content */}
          <div className="absolute top-0 right-0 -mt-20 -mr-20 w-80 h-80 bg-gradient-to-br from-sky-100/40 to-indigo-100/40 rounded-full blur-3xl pointer-events-none"></div>

          <div className="relative lg:absolute lg:inset-0 overflow-hidden flex flex-col justify-center p-6 sm:p-10">

            <div className="relative z-10 w-full max-w-md mx-auto">
              {/* Header Section */}
              <div className="mb-6">
                <div className="flex flex-col lg:flex-row items-center lg:justify-between lg:items-end gap-4">
                  <div className="flex flex-col lg:flex-row items-center gap-0">
                    <Logo className="h-11 w-auto text-sky-600" />
                    <span className="text-2xl font-bold bg-gradient-to-r from-sky-600 to-indigo-600 bg-clip-text text-transparent tracking-tight text-center lg:text-left lg:-ml-1.5">TutorFriends</span>
                  </div>
                  <div className="text-center lg:text-right pb-0.5">
                    <h1 className="text-base font-bold text-slate-900 leading-tight">
                      {flowType === 'admin' ? 'Reset Admin Password' : 'Reset Password'}
                    </h1>
                    <p className="text-slate-500 text-xs font-medium leading-tight mt-0.5">
                      Verify and Create New Password
                    </p>
                  </div>
                </div>
              </div>

              <form className="space-y-4" onSubmit={handleSubmit}>
                {/* Verification Code */}
                <div className="space-y-1.5">
                  <label htmlFor="code" className="block text-xs font-bold text-slate-600 uppercase tracking-wider ml-1">Verification Code</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-slate-400 group-focus-within:text-sky-500 transition-colors duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <input
                      id="code"
                      name="code"
                      type="text"
                      required
                      value={formData.code}
                      onChange={handleInputChange}
                      maxLength={6}
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-[3px] focus:ring-sky-500/20 focus:border-sky-500 outline-none transition-all duration-300 font-medium text-slate-900 placeholder:text-slate-400 text-sm shadow-sm tracking-widest text-center"
                      placeholder="000000"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400/80 ml-1">Enter the 6-digit code sent to {email}</p>
                </div>

                {/* New Password */}
                <div className="space-y-1.5">
                  <label htmlFor="newPassword" className="block text-xs font-bold text-slate-600 uppercase tracking-wider ml-1">New Password</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-slate-400 group-focus-within:text-sky-500 transition-colors duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                    </div>
                    <input
                      id="newPassword"
                      name="newPassword"
                      type={showPassword ? "text" : "password"}
                      required
                      value={formData.newPassword}
                      onChange={handleInputChange}
                      className={`${inputStyles} pr-10 
                      [&::-ms-reveal]:hidden 
                      [&::-webkit-credentials-auto-fill-button]:!hidden 
                      [&::-webkit-strong-password-auto-fill-button]:!hidden`}
                      minLength={7}
                      maxLength={21}
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

                {/* Confirm Password */}
                <div className="space-y-1.5">
                  <label htmlFor="confirmPassword" className="block text-xs font-bold text-slate-600 uppercase tracking-wider ml-1">Confirm Password</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-slate-400 group-focus-within:text-sky-500 transition-colors duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                    </div>
                    <input
                      id="confirmPassword"
                      name="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      required
                      value={formData.confirmPassword}
                      onChange={handleInputChange}
                      className={`${inputStyles} pr-10 
                      [&::-ms-reveal]:hidden 
                      [&::-webkit-credentials-auto-fill-button]:!hidden 
                      [&::-webkit-strong-password-auto-fill-button]:!hidden`}
                      minLength={7}
                      maxLength={21}
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1"
                    >
                      {showConfirmPassword ? (
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
                      <span>Resetting...</span>
                    </>
                  ) : (
                    <>
                      <span>Reset Password</span>
                      <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                    </>
                  )}
                </button>
              </form>

              <div className="mt-8 flex justify-center">
                <button
                  onClick={() => navigate(redirectRoute)}
                  className="group relative flex items-center justify-center text-slate-500 hover:text-sky-600 transition-all duration-300 text-sm font-semibold hover:translate-x-1 py-1"
                >
                  <span className="absolute -left-6 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">←</span>
                  <span>Back to {flowType === 'admin' ? 'Admin Login' : 'Login'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PasswordResetPage;
