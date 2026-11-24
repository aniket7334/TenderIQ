import React from 'react';

interface CompassRoseProps {
  size?: number;
  className?: string;
  /** Draw the North needle in brass instead of ink. */
  northAccent?: boolean;
  /** Animate the needle sweep on mount. */
  animated?: boolean;
}

/**
 * CompassRose — hairline-drawn eight-point compass used as the TenderIQ mark.
 * Scales cleanly from 20px to 160px. Uses `currentColor` so a parent can tint it.
 */
export function CompassRose({
  size = 24,
  className,
  northAccent = true,
  animated = false,
}: CompassRoseProps) {
  const stroke = Math.max(0.75, size / 32);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Outer ring */}
      <circle cx="32" cy="32" r="28" opacity={0.55} />
      {/* Inner ring */}
      <circle cx="32" cy="32" r="18" opacity={0.35} />

      {/* Cardinal needles */}
      {/* N (accented) */}
      <path
        d="M32 32 L32 4"
        stroke={northAccent ? 'rgb(var(--brass))' : 'currentColor'}
        strokeWidth={stroke * 1.2}
        className={animated ? 'adm-sweep' : undefined}
      />
      <path
        d="M32 4 L28 14 L32 10 L36 14 Z"
        fill={northAccent ? 'rgb(var(--brass))' : 'currentColor'}
        stroke="none"
      />
      {/* S */}
      <path d="M32 32 L32 60" opacity={0.75} />
      {/* E */}
      <path d="M32 32 L60 32" opacity={0.5} />
      {/* W */}
      <path d="M32 32 L4 32" opacity={0.5} />

      {/* Intercardinal (NE / NW / SE / SW) — shorter, lighter */}
      <path d="M32 32 L52 12" opacity={0.22} />
      <path d="M32 32 L12 12" opacity={0.22} />
      <path d="M32 32 L52 52" opacity={0.22} />
      <path d="M32 32 L12 52" opacity={0.22} />

      {/* Center hub */}
      <circle cx="32" cy="32" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

export default CompassRose;
