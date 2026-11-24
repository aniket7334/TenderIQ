import React from 'react';
import { clsx } from 'clsx';

/* ──────────────────────────────────────────────────────────────
   Admiralty input — bottom-rule only, no box. The label is an
   uppercase mono eyebrow sitting above the field. Error messages
   adopt the admiralty red (signal) tone.
   ────────────────────────────────────────────────────────────── */

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, helperText, leftIcon, rightIcon, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="eyebrow mb-2 block">
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center text-ink-muted">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={clsx(
              'block w-full bg-transparent px-0 py-2 text-[14px] text-ink',
              'border-0 border-b transition-colors',
              'placeholder:text-ink-muted focus:outline-none focus:ring-0',
              'disabled:cursor-not-allowed disabled:text-ink-muted',
              error
                ? 'border-signal focus:border-signal'
                : 'border-rule-strong focus:border-ink',
              leftIcon && 'pl-6',
              rightIcon && 'pr-6',
              className,
            )}
            aria-invalid={error ? 'true' : undefined}
            aria-describedby={
              error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined
            }
            {...props}
          />
          {rightIcon && (
            <div className="absolute inset-y-0 right-0 flex items-center text-ink-muted">
              {rightIcon}
            </div>
          )}
        </div>
        {error && (
          <p id={`${inputId}-error`} className="mt-1.5 font-mono text-[11px] text-signal">
            {error}
          </p>
        )}
        {helperText && !error && (
          <p id={`${inputId}-helper`} className="mt-1.5 text-[12px] text-ink-muted">
            {helperText}
          </p>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';

export { Input };
