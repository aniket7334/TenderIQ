import { useCallback, useEffect, useRef, useState } from 'react';
import api from '@/lib/api';

/*
 * Unread alert count for the header bell, plus optional browser notifications.
 *
 * Browser notifications are a per-device choice (the browser asks for
 * permission), so the on/off flag lives in localStorage. While TenderIQ is open
 * in a tab, new alerts pop up as system notifications.
 */

const STORAGE_KEY = 'tenderiq_browser_notify';
const POLL_MS = 60 * 1000;
export const ALERTS_CHANGED_EVENT = 'tenderiq:alerts-changed';

export const browserNotifySupported = () => typeof window !== 'undefined' && 'Notification' in window;
export const browserNotifyEnabled = () => localStorage.getItem(STORAGE_KEY) === '1';

export function setBrowserNotifyEnabled(on) {
  localStorage.setItem(STORAGE_KEY, on ? '1' : '0');
  window.dispatchEvent(new Event(ALERTS_CHANGED_EVENT));
}

/** Tell the bell to refresh right away (after marking read, deleting, etc.). */
export const notifyAlertsChanged = () => window.dispatchEvent(new Event(ALERTS_CHANGED_EVENT));

function showSystemNotifications(alerts, onOpen) {
  for (const a of alerts.slice(0, 3)) {
    try {
      const n = new Notification('TenderIQ', {
        body: a.message,
        icon: '/favicon.svg',
        tag: `tenderiq-alert-${a.id}`,
      });
      n.onclick = () => {
        window.focus();
        onOpen(a);
        n.close();
      };
    } catch {
      // Some browsers only allow notifications from a service worker — ignore
    }
  }
}

export default function useAlertNotifications(onOpen) {
  const [unread, setUnread] = useState(0);
  const lastUnread = useRef(null);
  const openRef = useRef(onOpen);
  openRef.current = onOpen;

  const refresh = useCallback(async () => {
    if (!localStorage.getItem('tenderiq_token')) return;
    try {
      const { data } = await api.get('/alerts/unread-count');
      const count = Number(data?.unread || 0);
      const prev = lastUnread.current;
      lastUnread.current = count;
      setUnread(count);
      // New alerts since the last check → system notification (if switched on)
      if (
        prev !== null &&
        count > prev &&
        browserNotifySupported() &&
        browserNotifyEnabled() &&
        Notification.permission === 'granted'
      ) {
        const res = await api.get('/alerts', { params: { is_read: false, page_size: Math.min(count - prev, 3) } });
        showSystemNotifications(res.data?.items || [], (a) => openRef.current?.(a));
      }
    } catch {
      // Bell count is best-effort; errors are ignored
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, POLL_MS);
    const onChange = () => refresh();
    window.addEventListener(ALERTS_CHANGED_EVENT, onChange);
    window.addEventListener('focus', onChange);
    return () => {
      clearInterval(timer);
      window.removeEventListener(ALERTS_CHANGED_EVENT, onChange);
      window.removeEventListener('focus', onChange);
    };
  }, [refresh]);

  return { unread, refresh };
}
