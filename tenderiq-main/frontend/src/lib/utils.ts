import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, parseISO, isValid, differenceInCalendarDays } from 'date-fns';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Admiralty-flavoured currency compaction — "₹ 42.6 Cr" / "₹ 8.4 L"
 * for tender values which are often in crores. For values below a lakh,
 * falls back to the full formatted amount.
 */
export function formatCurrencyShort(amount: number): string {
  if (!Number.isFinite(amount)) return '—';
  const abs = Math.abs(amount);
  if (abs >= 1e7) return `₹ ${(amount / 1e7).toFixed(2)} Cr`;
  if (abs >= 1e5) return `₹ ${(amount / 1e5).toFixed(2)} L`;
  if (abs >= 1e3) return `₹ ${(amount / 1e3).toFixed(1)} K`;
  return formatCurrency(amount);
}

export function formatDate(
  dateString: string | null | undefined,
  dateFormat: string = 'dd MMM yyyy',
): string {
  if (!dateString) return '—';
  try {
    const date = parseISO(dateString);
    if (!isValid(date)) return '—';
    return format(date, dateFormat);
  } catch {
    return '—';
  }
}

/**
 * Human-friendly deadline string. `Overdue` / `Today` / `Tomorrow` /
 * `32 days` — no mono-prefix, no cryptic ship's-log formatting.
 * Tone is still returned so cells can colour themselves (signal / amber / ok).
 */
export function formatCountdown(dateString: string | null | undefined): {
  text: string;
  tone: 'overdue' | 'urgent' | 'warn' | 'ok' | 'none';
} {
  if (!dateString) return { text: '—', tone: 'none' };
  try {
    const date = parseISO(dateString);
    if (!isValid(date)) return { text: '—', tone: 'none' };
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    if (diffMs < 0) return { text: 'Overdue', tone: 'overdue' };
    const days = Math.ceil(diffMs / 86_400_000);
    if (days === 0) return { text: 'Today', tone: 'urgent' };
    if (days === 1) return { text: 'Tomorrow', tone: 'urgent' };
    const tone = days <= 7 ? 'warn' : 'ok';
    return { text: `${days} days`, tone };
  } catch {
    return { text: '—', tone: 'none' };
  }
}

/** Days to a date, negative when past. Used for charts. */
export function daysTo(dateString: string | null | undefined): number {
  if (!dateString) return 0;
  try {
    const date = parseISO(dateString);
    if (!isValid(date)) return 0;
    return Math.max(0, differenceInCalendarDays(date, new Date()));
  } catch {
    return 0;
  }
}

/**
 * Admiralty status mapping — text + border colour only. Pair with the `.pill`
 * class in globals.css for the outlined mono look.
 */
export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    draft:            'text-amber border-amber',
    published:        'text-navy border-navy',
    open:             'text-moss border-moss',
    active:           'text-moss border-moss',
    closed:           'text-ink-muted border-ink-muted',
    under_evaluation: 'text-amber border-amber',
    evaluation:       'text-amber border-amber',
    awarded:          'text-moss border-moss',
    cancelled:        'text-ink-muted border-ink-muted',
    expired:          'text-signal border-signal',
    submitted:        'text-navy border-navy',
    scraped:          'text-ink-soft border-ink-soft',
    new:              'text-moss border-moss',
    interested:       'text-brass border-brass',
    not_interested:   'text-ink-muted border-ink-muted',
    bid_submitted:    'text-navy border-navy',
    won:              'text-moss border-moss',
    lost:             'text-signal border-signal',
  };

  return colors[status.toLowerCase()] || 'text-ink-soft border-ink-soft';
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    draft: 'Draft',
    published: 'Published',
    open: 'Open',
    active: 'Active',
    closed: 'Closed',
    under_evaluation: 'Under Evaluation',
    evaluation: 'Evaluation',
    awarded: 'Awarded',
    cancelled: 'Cancelled',
    expired: 'Expired',
    submitted: 'Submitted',
    scraped: 'Scraped',
    new: 'New',
    interested: 'Interested',
    not_interested: 'Not Interested',
    bid_submitted: 'Bid Submitted',
    won: 'Won',
    lost: 'Lost',
  };

  return (
    labels[status.toLowerCase()] ||
    status
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
  );
}
