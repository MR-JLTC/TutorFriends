import React, { useState, useEffect } from 'react';
import TutorSidebar from './TutorSidebar';
import TutorHeader from './TutorHeader';
import { VerificationProvider } from '../../context/VerificationContext';
import { NotificationProvider } from '../../context/NotificationContext';
import { X } from 'lucide-react';

interface TutorLayoutProps {
  children: React.ReactNode;
}

const TutorLayout: React.FC<TutorLayoutProps> = ({ children }) => {
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
    <VerificationProvider>
      <NotificationProvider>
        <div className="flex h-screen bg-slate-50 overflow-hidden">
          {/* Desktop Sidebar */}
          <div className="hidden md:flex"><TutorSidebar /></div>

          {/* Mobile Sidebar */}
          <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 md:hidden transform transition-transform duration-300 ease-in-out flex flex-col ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
            }`}>
            <div className="flex items-center justify-between h-16 shrink-0 px-4 border-b border-slate-200 bg-white">
              <h2 className="text-lg font-bold text-slate-800">Menu</h2>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 rounded-md text-slate-600 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-300"
                aria-label="Close menu"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
              <TutorSidebar />
            </div>
          </div>

          {/* Mobile Overlay */}
          {isMobileMenuOpen && (
            <div
              className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
              onClick={() => setIsMobileMenuOpen(false)}
            />
          )}

          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <TutorHeader onMenuClick={() => setIsMobileMenuOpen(true)} />
            <main className="flex-1 overflow-y-auto bg-slate-50 overscroll-contain">
              <div className="max-w-7xl mx-auto px-2 sm:px-3 md:px-4 lg:px-6 pt-2 sm:pt-3 md:pt-4 lg:pt-4 pb-3 sm:pb-4 md:pb-6 lg:pb-8 w-full">
                {children}
              </div>
            </main>
          </div>
        </div>
      </NotificationProvider>
    </VerificationProvider>
  );
};

export default TutorLayout;
