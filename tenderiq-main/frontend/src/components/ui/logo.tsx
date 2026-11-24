import React from 'react';

interface LogoProps {
  /** Pixel size of the mark (width = height). */
  size?: number;
  className?: string;
  /** Override the ring colour. Defaults to the theme's brass accent (via the
   *  `--brass` CSS token), so the logo automatically tracks the admiralty
   *  palette on both light and dark surfaces. */
  accent?: string;
  /** When true, the Q ring uses `currentColor` instead of the accent — useful for a
   *  single-ink stamp (e.g. dark-background favicon, a PDF export). */
  monochrome?: boolean;
  /** Decorative by default. Set a label if the logo stands in for the product name. */
  label?: string;
}

/**
 * TenderIQ mark — "TQ monogram".
 * A geometric T seated inside a Q ring; the Q's tail picks up the brass accent.
 * The T uses `currentColor` so it tracks the surrounding text colour, which
 * keeps the logo legible on both light and dark backgrounds.
 */
export function Logo({
  size = 24,
  className,
  accent = 'rgb(var(--brass))',
  monochrome = false,
  label,
}: LogoProps) {
  const ringColor = monochrome ? 'currentColor' : accent;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      fill="none"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {/* Q — ring + tail */}
      <circle cx="32" cy="32" r="26" stroke={ringColor} strokeWidth={5} />
      <line
        x1="46"
        y1="46"
        x2="56"
        y2="56"
        stroke={ringColor}
        strokeWidth={5}
        strokeLinecap="round"
      />
      {/* T — crossbar + stem, in ink */}
      <rect x="16" y="18" width="32" height="6" rx="1" fill="currentColor" />
      <rect x="29" y="18" width="6" height="28" rx="1" fill="currentColor" />
    </svg>
  );
}

export default Logo;
