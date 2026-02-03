import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
  action?: {
    label: string;
    onClick?: () => void;
  } | null;
}

interface ToastContextType {
  notify: (message: string, type?: ToastType, action?: { label: string; onClick?: () => void } | null) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(1);

  const remove = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id));

  const notify = (message: string, type: ToastType = 'info') => {
    const id = idRef.current++;
    setToasts((prev) => [...prev, { id, message, type, action: null }]);
    setTimeout(() => remove(id), 3500);
  };

  // Expose a global notifier for non-react code (e.g., axios interceptors)
  useEffect(() => {
    (window as any).__notify = (msg: string, type?: ToastType, action?: { label: string; onClick?: () => void } | null) => {
      const id = idRef.current++;
      setToasts((prev) => [...prev, { id, message: msg, type: type || 'info', action: action || null }]);
      setTimeout(() => remove(id), 3500);
    };
    return () => { delete (window as any).__notify; };
  }, []);

  const value = useMemo(() => ({ notify }), []);

  /* 
   * Modern Glassmorphism Design System 
   * - Uses backdrop-blur for depth
   * - Crisp borders and shadows for separation
   * - System colors (Blue/Red/Green) used as accents rather than full backgrounds
   */
  const stylesByType: Record<ToastType, { icon: React.ElementType, border: string, bg: string, text: string, iconColor: string }> = {
    success: {
      icon: CheckCircle,
      border: 'border-green-200',
      bg: 'bg-white/90',
      text: 'text-slate-800',
      iconColor: 'text-green-500'
    },
    error: {
      icon: AlertCircle,
      border: 'border-red-200',
      bg: 'bg-white/90',
      text: 'text-slate-800',
      iconColor: 'text-red-500'
    },
    info: {
      icon: Info,
      border: 'border-blue-200',
      bg: 'bg-white/90',
      text: 'text-slate-800',
      iconColor: 'text-blue-500'
    },
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed top-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
        {toasts.map((t) => {
          const style = stylesByType[t.type] || stylesByType.info;
          const Icon = style.icon;

          return (
            <div
              key={t.id}
              className={`
                pointer-events-auto
                relative w-full max-w-sm overflow-hidden
                flex items-start gap-4 p-4
                rounded-xl border ${style.border}
                ${style.bg} backdrop-blur-md
                shadow-xl shadow-slate-200/50
                animate-toast-slide-in
                transition-all duration-300
              `}
              role="alert"
            >
              {/* Icon Section */}
              <div className={`flex-shrink-0 pt-0.5 ${style.iconColor}`}>
                <Icon className="w-5 h-5" strokeWidth={2.5} />
              </div>

              {/* Content Section */}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${style.text} leading-snug`}>
                  {t.message}
                </p>

                {/* Optional Action Button */}
                {t.action && (
                  <div className="mt-2.5">
                    <button
                      onClick={() => {
                        try {
                          t.action?.onClick && t.action.onClick();
                        } catch (e) {
                          console.error('Toast action failed', e);
                        }
                        remove(t.id);
                      }}
                      className={`
                        inline-flex items-center px-3 py-1.5
                        text-xs font-semibold rounded-lg
                        transition-colors duration-200
                        bg-slate-100 hover:bg-slate-200 text-slate-700
                      `}
                    >
                      {t.action.label}
                    </button>
                  </div>
                )}
              </div>

              {/* Close Button */}
              <button
                onClick={() => remove(t.id)}
                className="flex-shrink-0 -mt-1 -mr-1 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                aria-label="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Progress/Time indicator (optional visual hint) */}
              <div className={`absolute bottom-0 left-0 h-0.5 ${style.bg === 'bg-white/90' ? style.iconColor.replace('text-', 'bg-') : 'bg-current'} opacity-20 w-full animate-toast-progress origin-left`} />
            </div>
          );
        })}
      </div>
      <style>
        {`
          @keyframes toast-slide-in {
            0% { transform: translateX(100%) scale(0.95); opacity: 0; }
            100% { transform: translateX(0) scale(1); opacity: 1; }
          }
          .animate-toast-slide-in {
            animation: toast-slide-in 0.3s cubic-bezier(0.2, 0, 0, 1) forwards;
          }
          
          @keyframes toast-progress {
            from { transform: scaleX(1); }
            to { transform: scaleX(0); }
          }
          .animate-toast-progress {
            animation: toast-progress 3.5s linear forwards;
          }
        `}
      </style>
    </ToastContext.Provider>
  );
};


