import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Logo from '../../components/Logo';
import Modal from '../../components/ui/Modal';
import { TutorRegistrationModal } from './TutorRegistrationPage';
import { TuteeRegistrationModal } from './TuteeRegistrationPage';
import apiClient, { getFileUrl } from '../../services/api';

// New icons for "How it works" section
const MagnifyingGlassIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
  </svg>
);

const LinkIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
  </svg>
);

const LightbulbIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v-.75a.75.75 0 01.75-.75h4.5a.75.75 0 01.75.75v.75m-6 0h6M12 4.5a5.25 5.25 0 015.25 5.25c0 2.298-1.04 4.33-2.625 5.625H9.375c-1.585-1.295-2.625-3.327-2.625-5.625A5.25 5.25 0 0112 4.5z" />
  </svg>
);


const LiveStats: React.FC = () => {
  const [stats, setStats] = useState<{ students: number; tutors: number; universities: number; courses: number; sessions: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    // Function to fetch stats
    // Function to fetch stats
    const fetchStats = async () => {
      try {
        // Use apiClient which correctly handles the base URL from environment variables
        // whether it's a full URL (https://...) or just an IP
        const res = await apiClient.get(`/landing/stats?_t=${Date.now()}`);

        if (mounted) {
          setStats(res.data);
          setError(null); // Clear any previous errors
        }
      } catch (e: any) {
        if (mounted) {
          // On initial load, show error. on subsequent polls, maybe stay silent or log
          // But here we rely on state. If we already have stats, maybe just keep them.
          if (!stats) setError(e.message || 'Failed to load stats');
        }
      }
    };

    // Initial fetch
    fetchStats();

    // Poll every 1 second for "lively" updates
    const intervalId = setInterval(fetchStats, 1000);

    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
  }, []); // Remove dependency on 'stats' to avoid resetting interval constantly, or just leave empty deps

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-6 mb-24">
      {['Students', 'Tutors', 'Universities', 'Courses', 'Sessions'].map((label, idx) => {
        const key = label.toLowerCase() as 'students' | 'tutors' | 'universities' | 'courses' | 'sessions';
        const value = stats ? stats[key] : undefined;
        return (
          <div key={label} className="bg-white/60 backdrop-blur-md rounded-2xl border border-white/50 p-6 text-center shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)] hover:shadow-[0_8px_30px_-4px_rgba(0,0,0,0.12)] hover:-translate-y-1 transition-all duration-300 group">
            <p className="text-slate-500 text-sm font-medium uppercase tracking-wider mb-2 group-hover:text-sky-600 transition-colors">{label}</p>
            <p className="text-3xl lg:text-4xl font-black text-slate-800 mt-1 bg-gradient-to-br from-slate-900 to-slate-700 bg-clip-text text-transparent">{value !== undefined ? value.toLocaleString() : '—'}</p>
          </div>
        );
      })}
      {error && (
        <div className="col-span-2 md:col-span-5 text-center text-slate-500 text-sm">Stats unavailable</div>
      )}
    </div>
  );
};

interface Slide {
  src: string;
  alt: string;
}

const slides: Slide[] = [
  {
    src: '/assets/images/dev_slideMainc.jpg',
    alt: 'The CEO & Developer of the companys'
  },
  {
    src: '/assets/images/dev_slide1c.png',
    alt: 'The Project Manager of the company'
  },
  {
    src: '/assets/images/bgp1.jpg',
    alt: 'A tutor helping a student with a laptop in a well-lit room'
  },
  {
    src: '/assets/images/bg2.png',
    alt: 'A diverse group of young students studying together around a table'
  },
  {
    src: '/assets/images/bg3.png',
    alt: 'Students in a university lecture hall, focused on learning'
  },
  {
    src: '/assets/images/bgp4.jpg',
    alt: 'Online tutoring session in progress'
  }
];

const HeroImageSlider = () => {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % slides.length);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative w-full h-full bg-slate-200">
      {slides.map((slide, index) => (
        <img
          key={index}
          src={slide.src}
          alt={slide.alt}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-in-out ${index === currentIndex ? 'opacity-100' : 'opacity-0'}`}
          aria-hidden={index !== currentIndex}
        />
      ))}
    </div>
  );
};

const RoleSelectionModal: React.FC<{ isOpen: boolean; onClose: () => void; onNavigate: (path: string) => void; }> = ({ isOpen, onClose, onNavigate }) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);

    return () => {
      window.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 transition-opacity p-4" onClick={(e) => { e.preventDefault(); onClose(); }} role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="bg-white rounded-2xl shadow-2xl p-6 md:p-8 m-0 max-w-3xl w-full flex flex-col md:flex-row gap-6 md:gap-8 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div
          role="button"
          tabIndex={0}
          className="flex-1 p-8 rounded-xl border-2 border-slate-200 hover:border-sky-500 hover:bg-sky-50 transition-all duration-300 cursor-pointer flex flex-col items-center text-center focus:outline-none focus:ring-2 focus:ring-sky-500 group"
          onClick={(e) => { e.preventDefault(); onNavigate('/TuteeRegistrationPage'); }}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigate('/TuteeRegistrationPage'); } }}
        >
          <div className="relative flex items-center justify-center h-32 w-32 rounded-full bg-gradient-to-br from-sky-400 to-sky-600 mb-6 overflow-hidden shadow-lg group-hover:shadow-xl transition-all duration-300">
            <img
              src="/assets/images/tutee.png"
              alt="Student"
              className="w-full h-full object-cover rounded-full transform transition-transform duration-500 group-hover:scale-125"
            />
            <div className="absolute inset-0 bg-gradient-to-br from-sky-500/20 to-transparent rounded-full"></div>
            <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-sky-500 rounded-full flex items-center justify-center shadow-md">
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <h3 id="modal-title" className="text-2xl font-bold text-slate-800 group-hover:text-sky-700 transition-colors">I'm a Student</h3>
          <p className="mt-2 text-slate-600 group-hover:text-slate-700 transition-colors">Find a tutor to help you achieve your academic goals.</p>
        </div>
        <div
          role="button"
          tabIndex={0}
          className="flex-1 p-8 rounded-xl border-2 border-slate-200 hover:border-indigo-500 hover:bg-indigo-50 transition-all duration-300 cursor-pointer flex flex-col items-center text-center focus:outline-none focus:ring-2 focus:ring-indigo-500 group"
          onClick={() => onNavigate('/TutorRegistrationPage')}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onNavigate('/TutorRegistrationPage') }}
        >
          <div className="relative flex items-center justify-center h-32 w-32 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 mb-6 overflow-hidden shadow-lg group-hover:shadow-xl transition-all duration-300">
            <img
              src="/assets/images/tutor.png"
              alt="Tutor"
              className="w-full h-full object-cover rounded-full transform transition-transform duration-500 group-hover:scale-125"
            />
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-transparent rounded-full"></div>
            <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center shadow-md">
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
          <h3 className="text-2xl font-bold text-slate-800 group-hover:text-indigo-700 transition-colors">I'm a Tutor</h3>
          <p className="mt-2 text-slate-600 group-hover:text-slate-700 transition-colors">Share your knowledge, help students, and earn money.</p>
        </div>
      </div>
    </div>
  );
};


const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [developersOpen, setDevelopersOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string>('');
  const [isScrolled, setIsScrolled] = useState(false);
  const [isTutorModalOpen, setIsTutorModalOpen] = useState(false);
  const [isTuteeModalOpen, setIsTuteeModalOpen] = useState(false);
  const [tutorModalKey, setTutorModalKey] = useState(0);
  const [tuteeModalKey, setTuteeModalKey] = useState(0);
  const [partnerUniversities, setPartnerUniversities] = useState<Array<{ university_id: number; name: string; logo_url?: string; status?: string }>>([]);
  const [contactForm, setContactForm] = useState({ name: '', email: '', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  const handleContactChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setContactForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmitContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactForm.name || !contactForm.email || !contactForm.message) {
      setSubmitStatus({ type: 'error', message: 'Please fill in all fields.' });
      return;
    }

    try {
      setIsSubmitting(true);
      setSubmitStatus(null);
      await apiClient.post('/landing/contact', contactForm);
      setSubmitStatus({ type: 'success', message: 'Message sent successfully! We will get back to you soon.' });
      setContactForm({ name: '', email: '', message: '' });
    } catch (error) {
      console.error('Failed to send message:', error);
      setSubmitStatus({ type: 'error', message: 'Failed to send message. Please try again later.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    const element = document.getElementById(id);
    if (element) {
      const headerOffset = 100;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth"
      });
    }
  };

  // Detect if device is mobile
  const isMobileDevice = () => {
    if (typeof window === 'undefined') return false;
    // Check for mobile devices using user agent and screen width
    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
    const isMobileUserAgent = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());
    const isMobileWidth = window.innerWidth <= 768; // Mobile breakpoint
    return isMobileUserAgent || isMobileWidth;
  };

  const handleNavigate = (path: string) => {
    // On mobile devices, navigate to full-page routes instead of opening modals
    if (isMobileDevice()) {
      if (path === '/TutorRegistrationPage' || path === '/TuteeRegistrationPage') {
        setIsModalOpen(false);
        navigate(path);
        return;
      }
      navigate(path);
      return;
    }

    // On desktop, open modals
    if (path === '/TutorRegistrationPage') {
      setIsModalOpen(false);
      // Reset tutor modal
      setTutorModalKey(k => k + 1);
      setIsTutorModalOpen(true);
      return;
    }
    if (path === '/TuteeRegistrationPage') {
      setIsModalOpen(false);
      // Reset tutee modal
      setTuteeModalKey(k => k + 1);
      setIsTuteeModalOpen(true);
      return;
    }
    navigate(path);
  };

  useEffect(() => {
    // Debounce scroll handler
    let timeoutId: NodeJS.Timeout;
    const handleScroll = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(() => {
        const scrollTop = window.scrollY;
        setIsScrolled(scrollTop > 50);
      }, 100); // 100ms debounce
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    const fetchUniversities = async () => {
      try {
        // We use apiClient here since it might handle some base URL stuff, 
        // though typically for polling we might want to avoid interceptor overhead if it fails often.
        // But for consistency:
        // Add timestamp to query to prevent caching
        const res = await apiClient.get(`/universities?_t=${Date.now()}`);

        if (mounted) {
          const rows = Array.isArray(res.data) ? res.data : [];
          const active = rows.filter((u: any) => (u.status || 'active') === 'active');
          // Only update if data changed (optional optimization, but React handles diffing well enough for small lists)
          setPartnerUniversities(active);
        }
      } catch (err) {
        // Silent failure on polling
        if (mounted) {
          // console.error('Failed to fetch universities:', err);
        }
      }
    };

    fetchUniversities();
    const intervalId = setInterval(fetchUniversities, 1000); // Poll every 1 second

    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
  }, []);

  return (
    <div className="bg-white text-slate-800 antialiased min-h-screen flex flex-col"> {/* Added antialiased for smoother fonts */}
      <header className={`relative py-3 px-4 sm:px-6 md:px-10 sticky top-0 z-50 transition-all duration-300 ${isScrolled
        ? 'bg-white/90 backdrop-blur-md border-b border-slate-200/50 shadow-lg'
        : 'bg-white/95 backdrop-blur-lg border-b border-slate-200/60 shadow-md'
        }`}>
        {/* Subtle gradient overlay */}
        <div className={`absolute inset-0 pointer-events-none transition-opacity duration-300 ${isScrolled ? 'bg-gradient-to-r from-sky-50/20 via-transparent to-indigo-50/20 opacity-50' : 'bg-gradient-to-r from-sky-50/30 via-transparent to-indigo-50/30'
          }`}></div>

        <div className="max-w-7xl mx-auto flex items-center justify-between relative">
          {/* Logo and Brand Section */}
          <div className="flex items-center group cursor-pointer space-x-1" onClick={() => navigate('/LandingPage')}>
            <Logo className="h-10 sm:h-12 md:h-14 lg:h-16 w-auto transition-all duration-300" />
            <div className="flex flex-col">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold bg-gradient-to-r from-sky-600 to-indigo-600 bg-clip-text text-transparent">
                TutorFriends
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 font-medium hidden sm:block">
                Connecting Minds, Building Futures
              </p>
            </div>
          </div>

          {/* Navigation Menu */}
          <nav className="hidden md:flex items-center space-x-6">
            <button
              onClick={() => scrollToSection('how-it-works')}
              className={`${activeSection === 'how-it-works' ? 'text-sky-600' : 'text-slate-600'} hover:text-sky-600 transition-all duration-200 font-medium text-sm relative group focus:outline-none focus:ring-0`}
            >
              How It Works
              <span className={`absolute bottom-0 left-0 h-0.5 bg-sky-600 transition-all duration-200 ${activeSection === 'how-it-works' ? 'w-full' : 'w-0 group-hover:w-full'}`}></span>
            </button>
            <button
              onClick={() => scrollToSection('features')}
              className={`${activeSection === 'features' ? 'text-sky-600' : 'text-slate-600'} hover:text-sky-600 transition-all duration-200 font-medium text-sm relative group focus:outline-none focus:ring-0`}
            >
              Features
              <span className={`absolute bottom-0 left-0 h-0.5 bg-sky-600 transition-all duration-200 ${activeSection === 'features' ? 'w-full' : 'w-0 group-hover:w-full'}`}></span>
            </button>
            <button
              onClick={() => scrollToSection('contact')}
              className={`${activeSection === 'contact' ? 'text-sky-600' : 'text-slate-600'} hover:text-sky-600 transition-all duration-200 font-medium text-sm relative group focus:outline-none focus:ring-0`}
            >
              Contact
              <span className={`absolute bottom-0 left-0 h-0.5 bg-sky-600 transition-all duration-200 ${activeSection === 'contact' ? 'w-full' : 'w-0 group-hover:w-full'}`}></span>
            </button>
          </nav>

          {/* Action Buttons */}
          <div className="flex items-center space-x-3">
            <button
              className="hidden sm:block text-slate-600 hover:text-sky-600 transition-colors duration-200 font-medium text-sm"
              onClick={() => navigate('/login')}
            >
              Login
            </button>
            <button
              className="hidden sm:block bg-sky-600 hover:bg-sky-700 text-white font-semibold text-sm px-4 py-2 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
              onClick={() => setIsModalOpen(true)}
            >
              Get Started
            </button>


            {/* Mobile Menu Button */}
            <button
              aria-label="Toggle menu"
              className="md:hidden p-2 text-slate-700 hover:text-sky-600 transition-colors duration-200"
              onClick={() => setIsMobileMenuOpen((v) => !v)}
            >
              {isMobileMenuOpen ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile dropdown */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 bg-white/95 backdrop-blur-sm">
            <div className="max-w-7xl mx-auto px-4 py-3 space-y-2">
              <button
                className={`block w-full text-left ${activeSection === 'how-it-works' ? 'text-sky-600' : 'text-slate-700'} hover:text-sky-600 py-2 relative group focus:outline-none focus:ring-0`}
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  scrollToSection('how-it-works');
                }}
              >
                How It Works
                <span className={`absolute bottom-1 left-0 h-0.5 bg-sky-600 transition-all duration-200 ${activeSection === 'how-it-works' ? 'w-full' : 'w-0 group-hover:w-full'}`}></span>
              </button>
              <button
                className={`block w-full text-left ${activeSection === 'features' ? 'text-sky-600' : 'text-slate-700'} hover:text-sky-600 py-2 relative group focus:outline-none focus:ring-0`}
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  scrollToSection('features');
                }}
              >
                Features
                <span className={`absolute bottom-1 left-0 h-0.5 bg-sky-600 transition-all duration-200 ${activeSection === 'features' ? 'w-full' : 'w-0 group-hover:w-full'}`}></span>
              </button>
              <button
                className={`block w-full text-left ${activeSection === 'contact' ? 'text-sky-600' : 'text-slate-700'} hover:text-sky-600 py-2 relative group focus:outline-none focus:ring-0`}
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  scrollToSection('contact');
                }}
              >
                Contact
                <span className={`absolute bottom-1 left-0 h-0.5 bg-sky-600 transition-all duration-200 ${activeSection === 'contact' ? 'w-full' : 'w-0 group-hover:w-full'}`}></span>
              </button>
              <div className="pt-2">
                <button
                  className="w-full text-slate-700 hover:text-sky-600 font-medium py-2 transition-colors duration-200"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    navigate('/login');
                  }}
                >
                  Login
                </button>
                <button
                  className="mt-2 w-full bg-sky-600 hover:bg-sky-700 text-white font-semibold py-2 px-4 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    setIsModalOpen(true);
                  }}
                >
                  Get Started
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Subtle gradient overlay for modern effect */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent"></div>
      </header>

      <main>
        {/* Hero Section */}
        {/* Hero Section */}
        <section className="relative overflow-hidden min-h-[85vh] h-auto flex items-center justify-center pt-10 pb-12 sm:pt-2 sm:pb-16 md:pb-16">
          <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-sky-100 blur-3xl"></div>
          <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-indigo-100 blur-3xl"></div>
          <div className="relative z-10 px-4 sm:px-6 md:px-8 lg:px-16 py-4 sm:py-6 md:py-8 grid md:grid-cols-2 gap-8 md:gap-10 lg:gap-14 items-center max-w-7xl mx-auto w-full">
            <div className="hero-text text-center md:text-left space-y-6 md:space-y-8 flex flex-col justify-center h-full">
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-slate-900 leading-[1.1] break-words tracking-tight">
                Where Students Come to <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-600 to-indigo-600">Learn and Teach</span>
              </h1>
              <p className="text-base sm:text-lg md:text-xl text-slate-600 max-w-lg mx-auto md:mx-0 leading-relaxed font-medium">
                Join a community where you can find the support you need or share your expertise. Become a tutee to excel, or a tutor to inspire.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mt-6 md:mt-8 justify-center md:justify-start">
                <button
                  className="bg-gradient-to-r from-sky-600 to-indigo-600 text-white font-bold py-3 px-6 sm:py-4 sm:px-8 rounded-xl shadow-lg hover:shadow-sky-500/30 hover:scale-105 transition-all duration-300 text-base sm:text-lg w-full sm:w-auto"
                  onClick={() => setIsModalOpen(true)}
                >
                  Get Started Today
                </button>
                <button
                  className="bg-white border-2 border-slate-200 text-slate-700 font-bold py-3 px-6 sm:py-4 sm:px-8 rounded-xl hover:border-sky-600 hover:text-sky-600 hover:bg-sky-50 transition-all duration-300 text-base sm:text-lg w-full sm:w-auto"
                  onClick={() => scrollToSection('how-it-works')}
                >
                  Learn More
                </button>
              </div>
            </div>
            <div className="hero-image aspect-[4/3] w-full rounded-3xl overflow-hidden relative shadow-[0_20px_50px_-12px_rgba(0,0,0,0.25)] border-4 sm:border-8 border-white mx-auto md:mx-0 transform md:translate-x-0">
              <HeroImageSlider />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none"></div>
            </div>
          </div>
        </section>

        {/* Partnered institutions */}
        <section className="px-4 sm:px-8 md:px-16 py-10 md:py-14 w-full">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-800 mb-6">Partnered institutions</h2>
            {partnerUniversities.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6 sm:gap-8">
                {partnerUniversities.map((u) => (
                  <div key={u.university_id} className="group flex flex-col items-center justify-start h-full p-6 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-[0_8px_30px_-4px_rgba(0,0,0,0.08)] transition-all duration-300 hover:-translate-y-1 min-h-[160px]">
                    <div className="flex items-center justify-center h-20 w-20 rounded-full bg-slate-50 border border-slate-100 group-hover:border-sky-100 group-hover:bg-sky-50 transition-colors duration-300 overflow-hidden mb-4 p-2">
                      {u.logo_url ? (
                        <img src={getFileUrl(u.logo_url)} alt={u.name} className="h-full w-full object-contain transition-all duration-300" />
                      ) : (
                        <div className="h-full w-full bg-slate-200" />
                      )}
                    </div>
                    <span className="font-medium text-xs sm:text-sm text-slate-600 group-hover:text-slate-900 text-center leading-snug transition-colors duration-300" title={u.name}>{u.name}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-500">No partners yet.</p>
            )}
          </div>
        </section>

        {/* Features Section (with live stats) */}
        <section id="features" className="relative bg-slate-50 px-4 sm:px-8 md:px-12 lg:px-20 py-14 md:py-20 xl:py-28 w-full overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-sky-100/40 via-transparent to-transparent pointer-events-none"></div>
          <div className="max-w-7xl mx-auto relative z-10">
            <div className="text-center mb-16">
              <span className="text-sky-600 font-bold tracking-wider uppercase text-sm mb-2 block">Why Choose Us</span>
              <h2 className="text-4xl sm:text-5xl font-black text-slate-900 mb-6 tracking-tight">Powerful Features for Everyone</h2>
              <p className="text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed">Whether you're a student seeking help or a tutor sharing knowledge, TutorFriends provides all the tools you need.</p>
            </div>

            {/* Live Stats from DB */}
            <div className="overflow-x-auto mb-20"><LiveStats /></div>

            {/* Features Grid - Bento Style */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12 mb-24">
              {/* Student Side */}
              <div className="space-y-8">
                <div className="flex items-center space-x-4 mb-8">
                  <div className="h-12 w-1 bg-sky-500 rounded-full"></div>
                  <div>
                    <h3 className="text-3xl font-bold text-slate-900">For Students</h3>
                    <p className="text-slate-500">Find the perfect tutor and excel.</p>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_30px_-4px_rgba(0,0,0,0.08)] transition-all duration-300 hover:border-sky-100 group">
                  <div className="w-10 h-10 bg-sky-50 rounded-lg flex items-center justify-center mb-4 group-hover:bg-sky-500 group-hover:text-white transition-all duration-300 text-sky-600">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                  </div>
                  <h4 className="text-lg font-bold text-slate-800 mb-2">Easy Registration</h4>
                  <p className="text-slate-600 text-sm leading-relaxed">Quick signup with university email verification. Get started in seconds.</p>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_30px_-4px_rgba(0,0,0,0.08)] transition-all duration-300 hover:border-sky-100 group">
                  <div className="w-10 h-10 bg-sky-50 rounded-lg flex items-center justify-center mb-4 group-hover:bg-sky-500 group-hover:text-white transition-all duration-300 text-sky-600">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  </div>
                  <h4 className="text-lg font-bold text-slate-800 mb-2">Smart Matching</h4>
                  <p className="text-slate-600 text-sm leading-relaxed">Browse tutors filtered by your course subjects, ratings, and availability.</p>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_30px_-4px_rgba(0,0,0,0.08)] transition-all duration-300 hover:border-sky-100 group">
                  <div className="w-10 h-10 bg-sky-50 rounded-lg flex items-center justify-center mb-4 group-hover:bg-sky-500 group-hover:text-white transition-all duration-300 text-sky-600">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                  </div>
                  <h4 className="text-lg font-bold text-slate-800 mb-2">Secure Payments</h4>
                  <p className="text-slate-600 text-sm leading-relaxed">Pay safely via GCash. Funds are only released when you're satisfied.</p>
                </div>
              </div>

              {/* Tutor Side */}
              <div className="space-y-8">
                <div className="flex items-center space-x-4 mb-8">
                  <div className="h-12 w-1 bg-indigo-500 rounded-full"></div>
                  <div>
                    <h3 className="text-3xl font-bold text-slate-900">For Tutors</h3>
                    <p className="text-slate-500">Share your expertise and earn.</p>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_30px_-4px_rgba(0,0,0,0.08)] transition-all duration-300 hover:border-indigo-100 group">
                  <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center mb-4 group-hover:bg-indigo-500 group-hover:text-white transition-all duration-300 text-indigo-600">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  </div>
                  <h4 className="text-lg font-bold text-slate-800 mb-2">Quick Application</h4>
                  <p className="text-slate-600 text-sm leading-relaxed">Simple vetting process. Upload your credentials and start teaching.</p>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_30px_-4px_rgba(0,0,0,0.08)] transition-all duration-300 hover:border-indigo-100 group">
                  <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center mb-4 group-hover:bg-indigo-500 group-hover:text-white transition-all duration-300 text-indigo-600">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <h4 className="text-lg font-bold text-slate-800 mb-2">Flexible Schedule</h4>
                  <p className="text-slate-600 text-sm leading-relaxed">Be your own boss. Set your availability and rates according to your needs.</p>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_30px_-4px_rgba(0,0,0,0.08)] transition-all duration-300 hover:border-indigo-100 group">
                  <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center mb-4 group-hover:bg-indigo-500 group-hover:text-white transition-all duration-300 text-indigo-600">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                  </div>
                  <h4 className="text-lg font-bold text-slate-800 mb-2">Track Earnings</h4>
                  <p className="text-slate-600 text-sm leading-relaxed">Transparent dashboard to monitor your sessions and income in real-time.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        {/* How It Works Section */}
        <section id="how-it-works" className="bg-white px-4 sm:px-8 md:px-16 py-14 md:py-20 xl:py-28 w-full">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <span className="text-indigo-600 font-bold tracking-wider uppercase text-sm mb-2 block">Simple Process</span>
              <h2 className="text-4xl sm:text-5xl font-black text-slate-900 mb-6">How It Works</h2>
              <p className="text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed">Getting academic help is easier than ever. Follow these simple steps.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
              <div className="hidden md:block absolute top-12 left-[16%] right-[16%] h-0.5 bg-gradient-to-r from-sky-200 via-indigo-200 to-sky-200" aria-hidden="true"></div>

              <div className="text-center relative group">
                <div className="relative z-10 bg-white p-2 w-24 h-24 mx-auto rounded-full mb-6">
                  <div className="w-full h-full bg-sky-50 rounded-full flex items-center justify-center border-2 border-sky-100 group-hover:border-sky-500 transition-colors duration-300">
                    <MagnifyingGlassIcon className="w-10 h-10 text-sky-600" />
                  </div>
                  <div className="absolute -top-2 -right-2 w-8 h-8 bg-sky-600 text-white rounded-full flex items-center justify-center font-bold shadow-md">1</div>
                </div>
                <h3 className="text-2xl font-bold text-slate-800 mb-3">Find a Tutor</h3>
                <p className="text-slate-600 leading-relaxed px-4">Search our diverse network of qualified tutors by subject, location, and availability.</p>
              </div>

              <div className="text-center relative group">
                <div className="relative z-10 bg-white p-2 w-24 h-24 mx-auto rounded-full mb-6">
                  <div className="w-full h-full bg-indigo-50 rounded-full flex items-center justify-center border-2 border-indigo-100 group-hover:border-indigo-500 transition-colors duration-300">
                    <LinkIcon className="w-10 h-10 text-indigo-600" />
                  </div>
                  <div className="absolute -top-2 -right-2 w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold shadow-md">2</div>
                </div>
                <h3 className="text-2xl font-bold text-slate-800 mb-3">Connect & Book</h3>
                <p className="text-slate-600 leading-relaxed px-4">Message tutors directly to discuss your needs and easily schedule your first session.</p>
              </div>

              <div className="text-center relative group">
                <div className="relative z-10 bg-white p-2 w-24 h-24 mx-auto rounded-full mb-6">
                  <div className="w-full h-full bg-purple-50 rounded-full flex items-center justify-center border-2 border-purple-100 group-hover:border-purple-500 transition-colors duration-300">
                    <LightbulbIcon className="w-10 h-10 text-purple-600" />
                  </div>
                  <div className="absolute -top-2 -right-2 w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold shadow-md">3</div>
                </div>
                <h3 className="text-2xl font-bold text-slate-800 mb-3">Get Expert Help</h3>
                <p className="text-slate-600 leading-relaxed px-4">Start learning from experienced educators and watch your grades and confidence soar!</p>
              </div>
            </div>
          </div>
        </section>

        {/* Contact Section */}
        <section id="contact" className="bg-slate-900 px-4 sm:px-8 md:px-16 py-14 md:py-20 xl:py-28 w-full relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,_var(--tw-gradient-stops))] from-sky-900/20 via-slate-900 to-slate-900"></div>
          <div className="max-w-6xl mx-auto relative z-10">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <span className="text-sky-500 font-bold tracking-wider uppercase text-sm mb-2 block">Support</span>
                <h2 className="text-4xl sm:text-5xl font-black text-white mb-6">Get in Touch</h2>
                <p className="text-xl text-slate-400 leading-relaxed mb-8">Have questions? We're here to help you succeed in your academic journey. Our support team is available around the clock.</p>

                <div className="space-y-6">
                  <div className="flex items-center space-x-4 p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
                    <div className="w-10 h-10 bg-sky-500/20 rounded-lg flex items-center justify-center text-sky-400">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                    </div>
                    <div>
                      <p className="text-sm text-slate-400">Email Support</p>
                      <p className="text-white font-medium">jactechnologies7@gmail.com</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4 p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
                    <div className="w-10 h-10 bg-indigo-500/20 rounded-lg flex items-center justify-center text-indigo-400">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <div>
                      <p className="text-sm text-slate-400">Business Hours</p>
                      <p className="text-white font-medium">Monday - Sunday: 24hrs</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4 p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
                    <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center text-purple-400">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    </div>
                    <div>
                      <p className="text-sm text-slate-400">Location</p>
                      <p className="text-white font-medium">Philippines</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-tr from-sky-500/20 to-purple-500/20 rounded-3xl blur-2xl"></div>
                <div className="relative bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-3xl">
                  <h3 className="text-2xl font-bold text-white mb-6">Send us a message</h3>
                  <form className="space-y-4" onSubmit={handleSubmitContact}>
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-1">Name</label>
                      <input
                        type="text"
                        name="name"
                        value={contactForm.name}
                        onChange={handleContactChange}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all"
                        placeholder="Your name"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-1">Email</label>
                      <input
                        type="email"
                        name="email"
                        value={contactForm.email}
                        onChange={handleContactChange}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all"
                        placeholder="your@email.com"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-1">Message</label>
                      <textarea
                        name="message"
                        value={contactForm.message}
                        onChange={handleContactChange}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all h-32"
                        placeholder="How can we help?"
                        required
                      ></textarea>
                    </div>
                    {submitStatus && (
                      <div className={`text-sm p-3 rounded-lg ${submitStatus.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                        {submitStatus.message}
                      </div>
                    )}
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full bg-gradient-to-r from-sky-600 to-indigo-600 text-white font-bold py-3 rounded-xl shadow-lg hover:shadow-sky-500/25 transition-all transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? 'Sending...' : 'Send Message'}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main >

      <footer className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-300 py-8 sm:py-12 px-4 sm:px-8 overflow-hidden w-full mt-auto">
        {/* Background pattern overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-sky-900/10 via-transparent to-indigo-900/10 pointer-events-none"></div>
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-sky-500/30 to-transparent"></div>
        <div className="max-w-6xl mx-auto relative">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 mb-6 sm:mb-8">
            <div>
              <div className="flex items-center mb-4 space-x-3">
                <Logo className="h-14 w-14 object-contain" style={{ aspectRatio: '1/1' }} />
                <div className="flex flex-col">
                  <h3 className="text-xl font-bold text-white mb-1">TutorFriends</h3>
                  <p className="text-sm text-sky-300 font-medium">Connecting Minds, Building Futures</p>
                </div>
              </div>
              <p className="text-slate-400 leading-relaxed text-base">Connecting students with qualified tutors for academic success. Empowering learners and educators to achieve their goals together through personalized learning experiences.</p>
            </div>

            <div>
              <h4 className="text-lg font-semibold text-white mb-4">For Students</h4>
              <ul className="space-y-2">
                <li><span className="text-slate-400 hover:text-sky-400 transition-colors cursor-default">Find Tutors</span></li>
                <li><span className="text-slate-400 hover:text-sky-400 transition-colors cursor-default">Book Sessions</span></li>
                <li><span className="text-slate-400 hover:text-sky-400 transition-colors cursor-default">Payment Guide</span></li>
                <li><span className="text-slate-400 hover:text-sky-400 transition-colors cursor-default">Help Center</span></li>
              </ul>
            </div>

            <div>
              <h4 className="text-lg font-semibold text-white mb-4">For Tutors</h4>
              <ul className="space-y-2">
                <li><span className="text-slate-400 hover:text-sky-400 transition-colors cursor-default">Apply to Teach</span></li>
                <li><span className="text-slate-400 hover:text-sky-400 transition-colors cursor-default">Tutor Resources</span></li>
                <li><span className="text-slate-400 hover:text-sky-400 transition-colors cursor-default">Earnings</span></li>
                <li><span className="text-slate-400 hover:text-sky-400 transition-colors cursor-default">Support</span></li>
              </ul>
            </div>

            <div>
              <h4 className="text-lg font-semibold text-white mb-4">Company</h4>
              <ul className="space-y-2">
                <li className="w-max">
                  <button type="button" onClick={() => setAboutOpen(true)} className="text-left text-slate-400 hover:text-sky-400 transition-colors">About Us</button>
                </li>
                <li className="w-max">
                  <button type="button" onClick={() => setDevelopersOpen(true)} className="text-left text-slate-400 hover:text-sky-400 transition-colors">Meet the Developers</button>
                </li>
                <li className="w-max">
                  <button type="button" onClick={() => navigate('/admin-login')} className="text-left text-slate-400 hover:text-sky-400 transition-colors">Admin Portal</button>
                </li>
                <li className="w-max">
                  <button type="button" onClick={() => setPrivacyOpen(true)} className="text-left text-slate-400 hover:text-sky-400 transition-colors">Privacy Policy</button>
                </li>
                <li className="w-max">
                  <button type="button" onClick={() => setTermsOpen(true)} className="text-left text-slate-400 hover:text-sky-400 transition-colors">Terms of Service</button>
                </li>
                <li className="relative group w-max">
                  <button
                    type="button"
                    onClick={() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })}
                    className="text-left text-slate-400 hover:text-sky-400 transition-colors"
                  >
                    Contact
                  </button>
                </li>
              </ul>
            </div>
          </div>

          {/* About Us Modal */}
          <Modal isOpen={aboutOpen} onClose={() => setAboutOpen(false)} title="About TutorFriends">
            <div className="space-y-4 text-slate-700">
              <p>
                TutorFriends is a student-to-student learning platform where university students can become tutors
                and help other students excel in their studies. Our platform empowers students to share their
                knowledge while earning money, creating a collaborative learning community within Philippine universities.
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Student-to-student learning: Students teach students, creating a peer-to-peer educational ecosystem</li>
                <li>Empowerment through knowledge sharing: Any student can become a tutor and help fellow students succeed</li>
                <li>University-focused community: Connecting students within the same academic environment for better understanding and support</li>
                <li>Flexible earning opportunities: Students can monetize their expertise while helping others learn</li>
              </ul>
            </div>
          </Modal>

          {/* Privacy Policy Modal */}
          <Modal isOpen={privacyOpen} onClose={() => setPrivacyOpen(false)} title="Privacy Policy">
            <div className="space-y-4 text-slate-700">
              <p>
                We comply with the Data Privacy Act of 2012 (Republic Act No. 10173) and process
                personal data lawfully and transparently. This summary explains how we collect,
                use, and protect information for tutor/tutee services.
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  Data we collect: account details (name, email), university/course info, tutor profiles,
                  booking and payment confirmations, and support communications.
                </li>
                <li>
                  Purpose: enable registration, matching, booking, messaging, payment validation,
                  and safety monitoring.
                </li>
                <li>
                  Rights: you may access, correct, or request deletion of your data; you may also
                  withdraw consent subject to legal/operational requirements.
                </li>
                <li>
                  Security: we apply appropriate organizational and technical safeguards and limit access
                  to authorized personnel only.
                </li>
                <li>
                  Retention: we retain data only as long as needed for services and legal obligations.
                </li>
                <li>
                  Third parties: we share data only with processors essential to our services (e.g., hosting,
                  email) under confidentiality and DPA‑compliant agreements.
                </li>
                <li>
                  Contact: for privacy requests or concerns, email <span className="font-medium">jactechnologies7@gmail.com</span>.
                </li>
              </ul>
            </div>
          </Modal>

          {/* Terms of Service Modal */}
          <Modal isOpen={termsOpen} onClose={() => setTermsOpen(false)} title="Terms of Service">
            <div className="space-y-4 text-slate-700">
              <p>
                By using TutorFriends, you agree to these terms. If you do not agree, please do not use the service.
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Accounts: provide accurate information and keep your credentials secure.</li>
                <li>Bookings and Payments: follow the posted process; submit valid proofs when required.</li>
                <li>Conduct: be respectful; no harassment, fraud, or academic dishonesty.</li>
                <li>
                  Content: reviews and profiles must be truthful and may be moderated to ensure platform safety.
                </li>
                <li>
                  Liability: TutorFriends facilitates connections; session outcomes remain between tutors and students
                  subject to applicable law.
                </li>
                <li>
                  Changes: we may update these terms and will indicate the effective date; continued use means acceptance.
                </li>
                <li>Contact: questions about these terms? Email us at <span className="font-medium">jactechnologies7@gmail.com</span>.</li>
              </ul>
            </div>
          </Modal>

          {/* BahandiSoft Company Modal */}
          <Modal
            isOpen={developersOpen}
            onClose={() => setDevelopersOpen(false)}
            title="" // Custom header inside
            maxWidth="3xl"
          >
            <div className="relative">
              {/* Modern Header Section */}
              <div className="text-center space-y-4 pt-2 pb-8 border-b border-slate-100">
                <div className="w-48 mx-auto filter drop-shadow-sm hover:drop-shadow-md transition-all duration-300">
                  <img src="/assets/images/bahandisoft.png" alt="BahandiSoft" className="w-full h-auto object-contain" />
                </div>
                <div className="max-w-md mx-auto">
                  <p className="text-slate-600 font-medium text-lg italic relative inline-block">
                    <span className="text-sky-400 absolute -top-2 -left-2 text-2xl">"</span>
                    Innovating Education, One Line of Code at a Time
                    <span className="text-indigo-400 absolute -bottom-4 -right-2 text-2xl leading-[0]">"</span>
                  </p>
                </div>
              </div>

              <div className="py-8 px-2 sm:px-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
                  {/* CEO Card */}
                  <div className="group relative bg-white p-6 rounded-2xl border border-slate-100 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_30px_-4px_rgba(0,0,0,0.1)] transition-all duration-300 hover:-translate-y-1">
                    <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-indigo-500 to-sky-500 rounded-t-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <div className="flex flex-col items-center">
                      <div className="relative mb-4">
                        <div className="absolute -inset-2 bg-gradient-to-r from-indigo-500 to-sky-500 rounded-full opacity-0 group-hover:opacity-20 blur-md transition-opacity duration-300"></div>
                        <div className="relative w-32 h-32 rounded-full overflow-hidden border-4 border-white shadow-lg group-hover:border-indigo-50 transition-colors">
                          <img
                            src="/assets/images/dev_pf1.jpg"
                            alt="Jhon Lloyd T. Cruz"
                            className="w-full h-full object-cover transform transition-transform duration-700 group-hover:scale-110"
                          />
                        </div>
                        <div className="absolute bottom-0 right-0 bg-indigo-500 text-white text-[10px] font-bold px-2 py-1 rounded-full border-2 border-white shadow-sm">
                          CEO
                        </div>
                      </div>
                      <h3 className="text-xl font-bold text-slate-800 group-hover:text-indigo-600 transition-colors text-center">Jhon Lloyd T. Cruz</h3>
                      <p className="text-sm font-medium text-slate-500 mt-1 uppercase tracking-wide">Chief Executive Officer</p>
                      <div className="mt-4 flex space-x-2 opacity-60 group-hover:opacity-100 transition-opacity">
                        <div className="h-1 w-8 bg-indigo-500 rounded-full"></div>
                        <div className="h-1 w-2 bg-sky-500 rounded-full"></div>
                      </div>
                    </div>
                  </div>

                  {/* COO Card */}
                  <div className="group relative bg-white p-6 rounded-2xl border border-slate-100 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_30px_-4px_rgba(0,0,0,0.1)] transition-all duration-300 hover:-translate-y-1">
                    <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-sky-500 to-indigo-500 rounded-t-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <div className="flex flex-col items-center">
                      <div className="relative mb-4">
                        <div className="absolute -inset-2 bg-gradient-to-r from-sky-500 to-indigo-500 rounded-full opacity-0 group-hover:opacity-20 blur-md transition-opacity duration-300"></div>
                        <div className="relative w-32 h-32 rounded-full overflow-hidden border-4 border-white shadow-lg group-hover:border-sky-50 transition-colors">
                          <img
                            src="/assets/images/dev_pf2.jpg"
                            alt="John Emmanuel De Vera"
                            className="w-full h-full object-cover transform transition-transform duration-700 group-hover:scale-110"
                          />
                        </div>
                        <div className="absolute bottom-0 right-0 bg-sky-500 text-white text-[10px] font-bold px-2 py-1 rounded-full border-2 border-white shadow-sm">
                          COO
                        </div>
                      </div>
                      <h3 className="text-xl font-bold text-slate-800 group-hover:text-sky-600 transition-colors text-center">John Emmanuel De Vera</h3>
                      <p className="text-sm font-medium text-slate-500 mt-1 uppercase tracking-wide">Chief Operating Officer</p>
                      <div className="mt-4 flex space-x-2 opacity-60 group-hover:opacity-100 transition-opacity">
                        <div className="h-1 w-8 bg-sky-500 rounded-full"></div>
                        <div className="h-1 w-2 bg-indigo-500 rounded-full"></div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Academic Background Block */}
                <div className="mt-10 bg-gradient-to-br from-slate-50 to-white rounded-2xl p-6 sm:p-8 border border-slate-100 shadow-inner relative overflow-hidden">
                  <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-sky-100 rounded-full opacity-50 blur-2xl"></div>
                  <div className="absolute bottom-0 left-0 -mb-4 -ml-4 w-24 h-24 bg-indigo-100 rounded-full opacity-50 blur-2xl"></div>

                  <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center gap-6">
                    <div className="flex-shrink-0 bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                      <svg className="w-8 h-8 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 14l9-5-9-5-9 5 9 5z" />
                        <path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 text-lg mb-1">Academic Roots</h4>
                      <p className="text-slate-600 leading-relaxed text-sm sm:text-base">
                        Proud students of the <span className="font-semibold text-slate-900">Bachelor of Science in Computer Science</span> program at <span className="font-semibold text-sky-700">Bohol Island State University (BISU) - Calape Campus</span>.
                        Dedicated to building technology that strengthens the academic community.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Modal>

          <div className="border-t border-slate-700/50 pt-8 mt-12 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-slate-500 text-sm order-2 md:order-1">&copy; {new Date().getFullYear()} TutorFriends. All rights reserved.</p>

            <button
              type="button"
              className="order-1 md:order-2 flex items-center gap-3 group cursor-pointer px-2 py-1 rounded-xl transition-all duration-300 focus:outline-none"
              onClick={() => setDevelopersOpen(true)}
            >
              <span className="text-xs text-slate-500 group-hover:text-slate-300 transition-colors font-medium">Developed by</span>
              <div className="flex items-center gap-2 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/50 group-hover:border-sky-500/30 px-3 py-1.5 rounded-lg backdrop-blur-sm transition-all duration-300 shadow-sm group-hover:shadow-[0_0_15px_-3px_rgba(56,189,248,0.2)]">
                <img src="/assets/images/bahandisoft.png" alt="BahandiSoft" className="w-5 h-5 object-contain" />
                <span className="text-sm font-bold text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-indigo-400 group-hover:from-sky-300 group-hover:to-indigo-300 transition-all">
                  BahandiSoft
                </span>
              </div>
            </button>
          </div>
        </div>
      </footer>

      <RoleSelectionModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onNavigate={handleNavigate} />
      {
        isTutorModalOpen && <TutorRegistrationModal
          key={`tutor-${tutorModalKey}`}
          isOpen={true}
          onClose={() => {
            setIsTutorModalOpen(false);
            setTutorModalKey(k => k + 1);
          }}
        />
      }
      {
        isTuteeModalOpen && <TuteeRegistrationModal
          key={`tutee-${tuteeModalKey}`}
          isOpen={true}
          onClose={() => {
            setIsTuteeModalOpen(false);
            setTuteeModalKey(k => k + 1);
          }}
        />
      }
    </div >
  );
};

export default LandingPage;