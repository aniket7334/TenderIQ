import React from 'react';
import { clsx } from 'clsx';

/* ──────────────────────────────────────────────────────────────
   Admiralty badge — outlined pill with mono/uppercase label.
   Hairline border + currentColor, no filled background.
   Use the `info`/`success`/… variants, or pass raw `text-x border-x`
   classes to `className` for status-driven colours.
   ────────────────────────────────────────────────────────────── */

const variantStyles = {
  default: 'text-ink-soft border-ink-soft',
  success: 'text-moss border-moss',
  warning: 'text-amber border-amber',
  danger:  'text-signal border-signal',
  info:    'text-navy border-navy',
  accent:  'text-brass border-brass',
} as const;

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: keyof typeof variantStyles;
}

const Badge: React.FC<BadgeProps> = ({
  className,
  variant = 'default',
  children,
  ...props
}) => {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 border bg-transparent px-2 py-[2px]',
        'font-mono text-[10.5px] font-medium uppercase tracking-[0.08em]',
        'rounded-[2px]',
        variantStyles[variant],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
};

export { Badge };
