import React from 'react';
import { clsx } from 'clsx';
import { Loader2 } from 'lucide-react';

const variantStyles = {
  primary:
    'bg-blue-700 text-white shadow-[0_1px_0_rgba(255,255,255,0.12)_inset,0_1px_2px_rgba(13,22,40,0.25)] hover:bg-blue-800 focus-visible:ring-blue-500',
  secondary:
    'bg-gray-100 text-gray-900 hover:bg-gray-200 focus-visible:ring-gray-400',
  danger:
    'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500',
  ghost:
    'bg-transparent text-gray-700 hover:bg-gray-100 focus-visible:ring-gray-400',
  outline:
    'border border-gray-300 bg-white text-gray-700 shadow-[0_1px_2px_rgba(29,28,25,0.04)] hover:border-gray-400 hover:bg-gray-50 focus-visible:ring-gray-400',
};

const sizeStyles = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
};

const Button = React.forwardRef(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      loading = false,
      disabled,
      asChild = false,
      children,
      ...props
    },
    ref,
  ) => {
    const isDisabled = disabled || loading;

    const classes = clsx(
      'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
      'disabled:pointer-events-none disabled:opacity-50',
      variantStyles[variant],
      sizeStyles[size],
      className,
    );

    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children, {
        className: clsx(classes, children.props.className),
        ref,
        ...props,
      });
    }

    return (
      <button
        ref={ref}
        className={classes}
        disabled={isDisabled}
        {...props}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {children}
      </button>
    );
  },
);

Button.displayName = 'Button';

export { Button };
