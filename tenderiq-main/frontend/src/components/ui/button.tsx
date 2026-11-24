import React from 'react';
import { clsx } from 'clsx';
import { Loader2 } from 'lucide-react';

/* ──────────────────────────────────────────────────────────────
   Admiralty button — rectilinear, hairline-bordered, text-forward.
   No rounded blobs. The accent is reserved for the primary action.
   ────────────────────────────────────────────────────────────── */

const variantStyles = {
  /** Solid ink, inverse text. The one "do this" action on a screen. */
  primary:
    'border border-ink bg-ink text-paper hover:bg-navy-ink hover:border-navy-ink',
  /** Hairline outline on paper. Secondary actions. */
  secondary:
    'border border-rule-strong bg-transparent text-ink hover:bg-canvas-tint hover:border-ink',
  /** Ghostly — no border, text-only. Nav & toolbar actions. */
  ghost:
    'border border-transparent bg-transparent text-ink-soft hover:text-ink hover:bg-canvas-tint',
  /** Danger. Admiralty red. Outlined, filled on hover. */
  danger:
    'border border-signal/70 bg-transparent text-signal hover:bg-signal hover:text-paper',
  /** Same silhouette as secondary; kept for legacy call-sites. */
  outline:
    'border border-rule-strong bg-transparent text-ink hover:bg-canvas-tint hover:border-ink',
} as const;

const sizeStyles = {
  sm: 'px-3 py-1.5 text-[12.5px]',
  md: 'px-4 py-2 text-[13.5px]',
  lg: 'px-6 py-3 text-[14.5px]',
} as const;

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variantStyles;
  size?: keyof typeof sizeStyles;
  loading?: boolean;
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
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
      'inline-flex items-center justify-center gap-2 font-medium',
      'tracking-[0.005em] transition-colors duration-150',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper',
      'disabled:pointer-events-none disabled:opacity-50',
      variantStyles[variant],
      sizeStyles[size],
      className,
    );

    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children as React.ReactElement<any>, {
        className: clsx(classes, (children as React.ReactElement<any>).props.className),
        ref,
        ...props,
      });
    }

    return (
      <button ref={ref} className={classes} disabled={isDisabled} {...props}>
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {children}
      </button>
    );
  },
);

Button.displayName = 'Button';

export { Button };
