import { useCallback, useEffect, useRef, useState } from 'react';
import api from '@/lib/api';

const POLL_MS = 60 * 1000;

/**
 * Live tender updates. Asks the API once a minute (only while the tab is
 * visible, and right away when you come back to it) whether new tenders have
 * arrived since the last check, and calls onNew(count) when they have.
 * Also returns the GeM sync status for the "Live" indicator.
 */
export function useLiveTenders(onNew) {
  const [sync, setSync] = useState(null);
  const [checkedAt, setCheckedAt] = useState(null);
  const sinceRef = useRef(null);
  const onNewRef = useRef(onNew);
  onNewRef.current = onNew;

  const check = useCallback(async () => {
    if (document.visibilityState === 'hidden') return;
    try {
      const res = await api.get('/tenders/updates', {
        params: sinceRef.current ? { since: sinceRef.current } : {},
      });
      const data = res.data || {};
      if (sinceRef.current && data.new_count > 0) onNewRef.current?.(data.new_count);
      // Next check counts from the server's clock, so time zones don't matter
      sinceRef.current = data.server_time || new Date().toISOString();
      setSync(data.sync || null);
      setCheckedAt(new Date());
    } catch {
      // Offline or server waking up — try again on the next tick
    }
  }, []);

  useEffect(() => {
    check();
    const timer = setInterval(check, POLL_MS);
    const onVisible = () => document.visibilityState === 'visible' && check();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [check]);

  return { sync, checkedAt, checkNow: check };
}

/** "just now", "3 min ago", "2 h ago" */
export function timeAgo(date) {
  if (!date) return '';
  const s = Math.max(0, Math.round((Date.now() - new Date(date).getTime()) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} days ago`;
}
