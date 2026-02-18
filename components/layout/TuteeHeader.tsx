import React from 'react';
import { useAuth } from '../../hooks/useAuth';
import { LogOut, Menu } from 'lucide-react';
import Button from '../ui/Button';
import { NotificationBell } from '../ui/NotificationBell';

interface TuteeHeaderProps {
  onMenuClick?: () => void;
}

const TuteeHeader: React.FC<TuteeHeaderProps> = ({ onMenuClick }) => {
  const { user, logout } = useAuth();

  return (
    <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-30">
      <div className="px-3 sm:px-4 md:px-6 py-2.5 sm:py-3 md:py-4">
        <div className="flex items-center justify-between gap-2 sm:gap-3 md:gap-4">
          <div className="flex items-center gap-2 sm:gap-3 md:gap-4 flex-1 min-w-0">
            {/* Mobile Menu Button */}
            <button
              onClick={onMenuClick}
              className="md:hidden p-2 rounded-lg text-slate-700 hover:bg-slate-100 active:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-300 transition-colors flex-shrink-0 touch-manipulation"
              aria-label="Open menu"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <Menu className="h-5 w-5 sm:h-6 sm:w-6" />
            </button>

            <div className="min-w-0 flex-1 overflow-hidden">
              <h1 className="text-sm sm:text-base md:text-lg lg:text-xl font-semibold text-slate-800 truncate leading-tight">
                Welcome back, {user?.name?.split(' ')[0] || 'Student'}
              </h1>
              <p className="text-[10px] sm:text-xs md:text-sm text-slate-600 hidden sm:block truncate">
                Find tutors and manage your learning sessions
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3 lg:gap-4 flex-shrink-0">
            <NotificationBell />
            <Button
              onClick={logout}
              variant="secondary"
              className="flex items-center justify-center gap-1 sm:gap-1.5 md:gap-2 !px-2 sm:!px-3 !py-1.5 sm:!py-2 text-xs sm:text-sm touch-manipulation"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <LogOut className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default TuteeHeader;
