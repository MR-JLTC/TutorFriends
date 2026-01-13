import React from 'react';
import { Page } from '../types';
import Logo from './Logo';

const ChevronLeftIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
  </svg>
);

interface HeaderProps {
  onNavigate: (page: Page) => void;
}

const Header: React.FC<HeaderProps> = ({ onNavigate }) => {
  return (
    <header className="bg-white/80 backdrop-blur-lg shadow-sm sticky top-0 z-50 border-b border-white/50">
      <div className="container mx-auto px-6 py-3">
        <button
          onClick={() => onNavigate(Page.Landing)}
          className="flex items-center gap-3 text-slate-700 hover:text-sky-600 transition-colors group"
          aria-label="Back to Home"
        >
          <ChevronLeftIcon className="w-6 h-6 transform transition-transform group-hover:-translate-x-1" />
          <div className="flex items-center gap-3">
            <Logo className="h-10 w-auto" />
            <span className="text-xl sm:text-2xl md:text-3xl font-bold bg-gradient-to-r from-sky-600 to-indigo-600 bg-clip-text text-transparent">TutorFriends</span>
          </div>
        </button>
      </div>
    </header>
  );
};

export default Header;
