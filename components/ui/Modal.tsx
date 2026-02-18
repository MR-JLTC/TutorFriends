
import React from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  contentClassName?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl' | '5xl' | '6xl' | '7xl';
  hideScrollbar?: boolean;
}

import ReactDOM from 'react-dom';

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, footer, className = '', contentClassName = '', maxWidth = '2xl', hideScrollbar = false }) => {
  if (!isOpen) return null;

  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '4xl': 'max-w-4xl',
    '5xl': 'max-w-5xl',
    '6xl': 'max-w-6xl',
    '7xl': 'max-w-7xl',
  };

  return ReactDOM.createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-2 sm:p-4 overflow-y-auto" onClick={onClose}>
      <div className={`bg-white rounded-lg sm:rounded-xl shadow-xl w-full ${maxWidthClasses[maxWidth]} max-h-[95vh] sm:max-h-[90vh] my-auto flex flex-col ${className}`} onClick={(e) => e.stopPropagation()}>
        {title && (
          <div className="flex justify-between items-center p-4 sm:p-5 border-b border-slate-200 flex-shrink-0">
            <h2 className="text-lg sm:text-xl font-bold text-slate-800 pr-2">{title}</h2>
            <button
              onClick={onClose}
              className="text-slate-500 hover:text-slate-800 active:text-slate-900 text-2xl sm:text-3xl leading-none p-1 rounded-lg hover:bg-slate-100 active:bg-slate-200 transition-colors touch-manipulation flex-shrink-0"
              style={{ WebkitTapHighlightColor: 'transparent' }}
              aria-label="Close modal"
            >
              &times;
            </button>
          </div>
        )}
        {!title && (
          <div className="absolute top-3 right-3 z-10">
            <button
              onClick={onClose}
              className="text-slate-500 hover:text-slate-800 active:text-slate-900 text-2xl leading-none bg-white/90 hover:bg-white rounded-full w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center shadow-lg hover:shadow-xl transition-all touch-manipulation"
              style={{ WebkitTapHighlightColor: 'transparent' }}
              aria-label="Close modal"
            >
              &times;
            </button>
          </div>
        )}
        <div className={`flex-1 overflow-y-auto min-h-0 ${!title ? 'p-4 sm:p-6' : 'p-4 sm:p-6'} ${hideScrollbar ? 'no-scrollbar' : ''} ${contentClassName}`}>
          {children}
        </div>
        {footer && (
          <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-2 p-4 sm:p-5 border-t border-slate-200 flex-shrink-0 bg-slate-50 sm:bg-white">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default Modal;
