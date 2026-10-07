import * as React from 'react';

export interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export const TextField = React.forwardRef<HTMLInputElement, TextFieldProps>(
  ({ label, error, id, className = '', ...props }, ref) => {
    const defaultId = React.useId();
    const inputId = id || defaultId;
    const errorId = `${inputId}-error`;

    return (
      <div className={`pax-input-group ${className}`}>
        <label htmlFor={inputId} className="pax-label">
          {label}
        </label>
        <div className="pax-input-wrapper">
          <input
            ref={ref}
            id={inputId}
            className="pax-input"
            aria-invalid={!!error}
            aria-describedby={error ? errorId : undefined}
            {...props}
          />
        </div>
        {error && (
          <div id={errorId} className="pax-input-error" role="alert">
            {error}
          </div>
        )}
      </div>
    );
  }
);

TextField.displayName = 'TextField';

export const PasswordField = React.forwardRef<HTMLInputElement, TextFieldProps>(
  ({ label, error, id, className = '', ...props }, ref) => {
    const defaultId = React.useId();
    const inputId = id || defaultId;
    const errorId = `${inputId}-error`;
    const [showPassword, setShowPassword] = React.useState(false);

    return (
      <div className={`pax-input-group ${className}`}>
        <label htmlFor={inputId} className="pax-label">
          {label}
        </label>
        <div className="pax-input-wrapper">
          <input
            ref={ref}
            id={inputId}
            type={showPassword ? 'text' : 'password'}
            className="pax-input"
            aria-invalid={!!error}
            aria-describedby={error ? errorId : undefined}
            {...props}
            style={{ paddingRight: 'var(--space-12)' }} // Leave space for toggle button
          />
          <button
            type="button"
            className="pax-password-toggle"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          >
            {showPassword ? 'Ocultar' : 'Mostrar'}
          </button>
        </div>
        {error && (
          <div id={errorId} className="pax-input-error" role="alert">
            {error}
          </div>
        )}
      </div>
    );
  }
);

PasswordField.displayName = 'PasswordField';
