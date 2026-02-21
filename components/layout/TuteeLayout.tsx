import React, { useState, useEffect } from 'react';
import TuteeSidebar from './TuteeSidebar';
import TuteeHeader from './TuteeHeader';
import { NotificationProvider } from '../../context/NotificationContext';
import { X } from 'lucide-react';

interface TuteeLayoutProps {
  children: React.ReactNode;
}

const TuteeLayout: React.FC<TuteeLayoutProps> = ({ children }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Close mobile menu on window resize to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsMobileMenuOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileMenuOpen]);

  return (
    <NotificationProvider>
      <div className="flex h-screen bg-slate-50 overflow-hidden">
        {/* Desktop Sidebar */}
        <div className="hidden md:flex"><TuteeSidebar /></div>

        {/* Mobile Sidebar */}
        <div className={`fixed inset-y-0 left-0 z-50 w-72 bg-white/95 backdrop-blur-xl border-r border-slate-200/50 shadow-2xl md:hidden transform transition-all duration-300 ease-out flex flex-col ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}>
          <div className="flex items-center justify-between h-16 shrink-0 px-6 border-b border-slate-100 bg-white/50 backdrop-blur-md">
            <h2 className="text-lg font-bold text-slate-800 bg-gradient-to-r from-primary-600 to-primary-800 bg-clip-text text-transparent">Menu</h2>
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="p-2 rounded-full text-slate-500 hover:bg-slate-100/80 hover:text-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-100"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            <TuteeSidebar />
          </div>
        </div>

        {/* Mobile Overlay */}
        {isMobileMenuOpen && (
          <div
            className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        <div className="flex-1 flex flex-col min-h-0 bg-slate-50 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/20 via-white to-sky-50/20 pointer-events-none" />
          <TuteeHeader onMenuClick={() => setIsMobileMenuOpen(true)} />
          <main className="flex-1 overflow-y-auto relative z-10 scroll-smooth">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-2 pb-6 sm:pt-4 sm:pb-8 lg:pt-5 lg:pb-10 w-full">
              {children}
            </div>
          </main>
        </div>
      </div>
    </NotificationProvider>
  );
};

export default TuteeLayout;
