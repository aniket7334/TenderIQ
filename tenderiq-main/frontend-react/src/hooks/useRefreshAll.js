import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import useAuth from '@/hooks/useAuth';

const POLL_MS = 5000;

/**
 * The "Refresh" button on the Dashboard and the Tenders page.
 *
 * Admins: fetches new tenders from every active source (GeM, CPPP, eTenders, ports, state
 * portals …) — the same run as the hourly job — and follows it, calling reload() whenever new
 * tenders have come in and once more at the end. Others can't start a scrape (the server
 * refuses it), so for them refresh() just calls reload().
 * Opening a page while a run is going (also the hourly one) shows its progress.
 *
 * reload: () => void            reloads the page's data quietly
 * options.listOnly: boolean     only reload (e.g. live Europe / UK / World Bank views)
 * Returns { refresh, run, isAdmin } — run: { running, done, total, current, newTenders } or null.
 */
export function useRefreshAll(reload, { listOnly = false } = {}) {
  const isAdmin = useAuth((s) => s.user)?.role === 'admin';
  const [run, setRun] = useState(null);
  const timer = useRef(null);
  const lastNew = useRef(0);
  const reloadRef = useRef(reload);
  reloadRef.current = reload;

  const follow = useCallback(() => {
    clearTimeout(timer.current);
    const poll = async () => {
      try {
        const { data } = await api.get('/sources/scrape-all/status');
        setRun(data);
        if (data.newTenders > lastNew.current) {
          lastNew.current = data.newTenders;
          reloadRef.current?.();
        }
        if (data.running) {
          timer.current = setTimeout(poll, POLL_MS);
          return;
        }
        reloadRef.current?.();
        toast.success(
          data.newTenders
            ? `All sources refreshed — ${data.newTenders.toLocaleString()} new tender${data.newTenders === 1 ? '' : 's'}`
            : 'All sources refreshed — no new tenders',
          { id: 'refresh-all' }
        );
        setRun(null);
      } catch {
        setRun(null);
      }
    };
    poll();
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  // A run already going when the page opens: show its progress
  useEffect(() => {
    if (!isAdmin) return;
    api.get('/sources/scrape-all/status').then(({ data }) => {
      if (data?.running) { lastNew.current = data.newTenders; follow(); }
    }).catch(() => {});
  }, [isAdmin, follow]);

  const refresh = useCallback(async () => {
    reloadRef.current?.();
    if (!isAdmin || listOnly) {
      toast.success('Refreshed', { id: 'refresh-all' });
      return;
    }
    try {
      await api.post('/sources/scrape-all');
      lastNew.current = 0;
      setRun({ running: true, done: 0, total: 0, newTenders: 0 });
      toast('Fetching new tenders from all sources…', { id: 'refresh-all', icon: '🔄' });
      follow();
    } catch {
      // the API helper already reports errors
    }
  }, [isAdmin, listOnly, follow]);

  return { refresh, run, isAdmin };
}
