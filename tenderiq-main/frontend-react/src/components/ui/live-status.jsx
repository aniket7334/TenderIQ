import React, { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { timeAgo } from '@/hooks/useLiveTenders';

/** Small "Live · GeM synced 2 min ago" label (label = source name: GeM, TED, Find a Tender, World Bank). */
export function LiveStatus({ sync, className, label = 'GeM' }) {
  // Re-render every 30s so "x min ago" stays current
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  if (!sync) return null;
  const ok = !!sync.last_success_at;
  const text = sync.running
    ? `Checking ${label} for new tenders…`
    : ok
      ? `${label} synced ${timeAgo(sync.last_success_at)}`
      : `Waiting for first ${label} sync`;

  return (
    <span
      className={clsx('inline-flex items-center gap-2 text-xs text-gray-500', className)}
      title={`New ${label} tenders are fetched automatically every few minutes; this page updates by itself.`}
    >
      <span className="relative flex h-2 w-2">
        {sync.running && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-500 opacity-60" />}
        <span className={clsx('relative inline-flex h-2 w-2 rounded-full', ok ? 'bg-brand-600' : 'bg-gray-400')} />
      </span>
      <span className="font-medium text-gray-700">Live</span>
      <span>· {text}</span>
    </span>
  );
}
