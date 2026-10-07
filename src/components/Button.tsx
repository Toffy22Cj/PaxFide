import * as React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
  submitting?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', submitting, children, disabled, className = '', onClick, ...props }, ref) => {
    const isDisabled = disabled || submitting;

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (isDisabled) {
        e.preventDefault();
        return;
      }
      if (onClick) onClick(e);
    };

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={`pax-btn pax-btn-${variant} ${className}`}
        onClick={handleClick}
        {...props}
      >
        {children}{submitting ? '…' : ''}
      </button>
    );
  }
);

Button.displayName = 'Button';
