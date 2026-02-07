
import React from 'react';

interface LoadingOverlayProps {
    isLoading: boolean;
    message?: string;
    progress?: number;
    subMessage?: string;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
    isLoading,
    message = 'Processing...',
    progress,
    subMessage
}) => {
    if (!isLoading) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-white/80 backdrop-blur-sm animate-[fadeIn_200ms_ease-out]">
            <div className="flex flex-col items-center gap-6 bg-white p-8 rounded-2xl shadow-xl border border-slate-100 transform scale-100 min-w-[300px]">

                {/* Modern Spinner */}
                <div className="relative w-16 h-16">
                    <div className="absolute inset-0 rounded-full border-4 border-slate-100"></div>
                    <div className="absolute inset-0 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin"></div>

                    {/* Inner Pulse */}
                    <div className="absolute inset-4 bg-indigo-50 rounded-full animate-pulse"></div>
                </div>

                {/* Loading Text */}
                <div className="flex flex-col items-center gap-2 w-full">
                    <h3 className="text-lg font-bold text-slate-800 tracking-wide text-center">{message}</h3>

                    {/* Progress Bar Section */}
                    {typeof progress === 'number' && (
                        <div className="w-full flex flex-col gap-2 mt-2 animate-[fadeIn_300ms_ease-out]">
                            <div className="flex justify-between items-center text-xs font-medium text-slate-500 px-1">
                                <span>{subMessage || 'Please wait...'}</span>
                                <span className="text-indigo-600 font-bold">{Math.round(progress)}%</span>
                            </div>

                            <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                                <div
                                    className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 rounded-full transition-all duration-300 ease-out shadow-[0_0_10px_rgba(99,102,241,0.5)]"
                                    style={{ width: `${Math.max(5, Math.min(100, progress))}%` }}
                                >
                                    <div className="w-full h-full opacity-30 bg-[length:1rem_1rem] bg-[linear-gradient(45deg,rgba(255,255,255,0.15)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.15)_50%,rgba(255,255,255,0.15)_75%,transparent_75%,transparent)] animate-[progress-stripes_1s_linear_infinite]"></div>
                                </div>
                            </div>
                        </div>
                    )}

                    {typeof progress !== 'number' && (
                        <p className="text-xs text-slate-500 font-medium tracking-wider uppercase">Please wait</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LoadingOverlay;
