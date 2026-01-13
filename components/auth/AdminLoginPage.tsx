import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { Link, useNavigate } from 'react-router-dom';
import Logo from '../Logo';
import ForgotPasswordModal from './ForgotPasswordModal';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      if (password.length < 7 || password.length > 13) {
        setError('Password must be between 7 and 13 characters.');
        setIsLoading(false);
        return;
      }

      await login(email, password);

      const storedUser = localStorage.getItem('user');
      if (!storedUser) {
        throw new Error('Login failed: No user data found');
      }

      const userData = JSON.parse(storedUser);
      if (userData.user_type !== 'admin' && userData.role !== 'admin') {
        throw new Error('This login is for administrators only. Please use the regular login page.');
      }

      navigate('/admin/dashboard', { replace: true });
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Invalid credentials. Please try again.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const inputStyles = "w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-[3px] focus:ring-sky-500/20 focus:border-sky-500 outline-none transition-all duration-300 font-medium text-slate-900 placeholder:text-slate-400 text-sm shadow-sm";

  return (
    <div className="h-screen bg-gradient-to-br from-slate-50 via-sky-50 to-indigo-100 flex items-start sm:items-center justify-center p-4 relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-sky-400/20 to-indigo-400/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-tr from-indigo-400/20 to-sky-400/20 rounded-full blur-3xl"></div>
      </div>

      <div className="w-full max-w-6xl bg-white/80 backdrop-blur-2xl rounded-[2.5rem] shadow-2xl overflow-hidden grid lg:grid-cols-2 relative z-10 max-h-[95vh] lg:max-h-[800px]">
        {/* Left Side - Slideshow (Desktop Only) */}
        <div className="relative hidden lg:block h-full min-h-[500px]">
          <AdminLoginSlideshow />
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 w-max">
            <div className="flex items-center bg-white/95 backdrop-blur-md border border-white/60 rounded-2xl shadow-xl px-5 py-2.5">
              <span className="px-3 py-1 bg-sky-600 text-white rounded-full text-[10px] font-bold tracking-widest uppercase shadow-sm">Administrative</span>
            </div>
          </div>
        </div>

        {/* Right Side - Login Form */}
        <div className="relative w-full min-h-full lg:h-full bg-white overflow-hidden flex flex-col">
          {/* Decorative background blur for right side content */}
          <div className="absolute top-0 right-0 -mt-20 -mr-20 w-80 h-80 bg-gradient-to-br from-sky-100/40 to-indigo-100/40 rounded-full blur-3xl pointer-events-none"></div>

          <div className="relative lg:absolute lg:inset-0 overflow-y-auto flex flex-col lg:justify-center px-6 sm:px-10 pt-10 pb-10 custom-scrollbar lg:[scrollbar-width:none] lg:[-ms-overflow-style:none] lg:[&::-webkit-scrollbar]:display-none">
            <div className="relative z-10 w-full max-w-md mx-auto">
              {/* Header Section */}
              <div className="mb-8">
                <div className="flex flex-col lg:flex-row items-center lg:justify-between lg:items-end gap-4">
                  <div className="flex flex-col lg:flex-row items-center gap-0">
                    <Logo className="h-11 w-auto text-sky-600" />
                    <span className="text-2xl font-bold bg-gradient-to-r from-sky-600 to-indigo-600 bg-clip-text text-transparent tracking-tight text-center lg:text-left lg:-ml-1.5">TutorFriends</span>
                  </div>
                  <div className="text-center lg:text-right pb-0.5">
                    <h1 className="text-base font-bold text-slate-900 leading-tight">
                      Admin Portal
                    </h1>
                    <p className="text-slate-500 text-xs font-medium leading-tight mt-0.5">
                      Secure Access
                    </p>
                  </div>
                </div>
              </div>

              <form className="space-y-4" onSubmit={handleSubmit}>
                {/* Error Message */}
                {error && (
                  <div className="bg-red-50/90 backdrop-blur-sm border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm font-medium shadow-lg mb-4">
                    <div className="flex items-center">
                      <svg className="w-5 h-5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                      {error}
                    </div>
                  </div>
                )}

                <div className="space-y-1">
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
                      value={email}
                      onChange={(e) => setEmail(e.target.value.toLowerCase())}
                      className={inputStyles}
                      placeholder="admin@university.edu"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between items-center ml-1 mb-0">
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
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      data-form-type="other"
                      data-lpignore="true"
                      data-1p-ignore="true"
                      data-bwignore="true"
                      className={`${inputStyles} pr-10 
                      [&::-ms-reveal]:hidden 
                      [&::-webkit-credentials-auto-fill-button]:!hidden 
                      [&::-webkit-strong-password-auto-fill-button]:!hidden`}
                      minLength={7}
                      maxLength={13}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.049m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88L3 3m11.737 11.737l6.264 6.264M21 12c-1.274 4.057-5.064 7-9.542 7-1.307 0-2.542-.255-3.669-.714m5.94-11.526A8.959 8.959 0 0112 5c4.478 0 8.268 2.943 9.542 7a9.97 9.97 0 01-1.563 3.049" /></svg>
                      )}
                    </button>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-2.5 px-4 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-sky-200 transition-all duration-300 transform active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                  >
                    {isLoading ? (
                      <>
                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        <span>Signing In...</span>
                      </>
                    ) : (
                      <>
                        <span>Sign In</span>
                        <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                      </>
                    )}
                  </button>
                </div>

                <div className="text-center text-sm text-slate-500 font-medium mt-2">
                  Don't have an account?{' '}
                  <Link
                    to="/register"
                    className="text-sky-600 hover:text-sky-700 font-bold transition-colors underline-offset-4 hover:underline"
                  >
                    Register here
                  </Link>
                </div>
              </form>

              <div className="mt-3 mb-2 flex justify-center">
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

      <ForgotPasswordModal
        isOpen={showForgotPasswordModal}
        onClose={() => setShowForgotPasswordModal(false)}
        onSuccess={() => { }}
        mode="admin"
      />
    </div>
  );
};

export default LoginPage;

const AdminLoginSlideshow: React.FC = () => {
  const [index, setIndex] = React.useState(0);
  const slides = React.useMemo(() => [
    {
      src: 'https://images.unsplash.com/photo-1553729459-efe14ef6055d?q=80&w=2070&auto=format&fit=crop',
      alt: 'Admin reviewing dashboard analytics charts',
    },
    {
      src: 'https://images.unsplash.com/photo-1556157382-97eda2d62296?q=80&w=2070&auto=format&fit=crop',
      alt: 'Team collaboration with laptops in modern office',
    },
    {
      src: 'https://images.unsplash.com/photo-1552581234-26160f608093?q=80&w=2070&auto=format&fit=crop',
      alt: 'Secure admin operations on computer',
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