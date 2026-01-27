import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger';
  isLoading?: boolean;
}

const Button: React.FC<ButtonProps> = ({
  children,
  className,
  variant = 'primary',
  isLoading: externalLoading,
  onClick,
  disabled,
  ...props
}) => {
  const [internalLoading, setInternalLoading] = useState(false);

  const baseClasses = 'px-4 py-2 rounded-md font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2';

  const variantClasses = {
    primary: 'bg-primary-600 text-white hover:bg-primary-700 focus:ring-primary-500',
    secondary: 'bg-slate-200 text-slate-800 hover:bg-slate-300 focus:ring-slate-400',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
  };

  const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!onClick) return;

    try {
      const result = onClick(e);

      // key check: is it a Promise?
      if (result && typeof (result as any).then === 'function') {
        setInternalLoading(true);
        await result;
      }
    } catch (error) {
      console.error("Button action failed:", error);
    } finally {
      // Always reset loading if we set it
      // Note: If component unmounts during await, this might warn in older React, 
      // but is generally safe or ignored in modern React.
      setInternalLoading(false);
    }
  };

  const isLoading = externalLoading || internalLoading;

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      onClick={handleClick}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && <Loader2 className="animate-spin h-4 w-4" />}
      {children}
    </button>
  );
};

export default Button;
