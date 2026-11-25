import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { formatDistanceToNow, parseISO } from 'date-fns';
import toast from 'react-hot-toast';
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  BellOff,
  BellRing,
  Check,
  CheckCheck,
  Clock,
  FileText,
  Hourglass,
  Info,
  Layers,
  Loader2,
  Monitor,
  RefreshCw,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import api from '@/lib/api';
import { formatDate } from '@/lib/utils';
import {
  browserNotifyEnabled,
  browserNotifySupported,
  notifyAlertsChanged,
  setBrowserNotifyEnabled,
} from '@/hooks/useAlertNotifications';

/* ------------------------------------------------------------------ */
/*  Small building blocks                                              */
/* ------------------------------------------------------------------ */

function Switch({ checked, onChange, disabled, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={clsx(
        'relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 disabled:opacity-50',
        checked ? 'bg-brand-700' : 'bg-gray-300',
      )}
    >
      <span
        className={clsx(
          'inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform',
          checked ? 'translate-x-[22px]' : 'translate-x-0.5',
        )}
      />
    </button>
  );
}

function SettingRow({ icon: Icon, title, description, control, children }) {
  return (
    <div className="py-4 first:pt-0 last:pb-0">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900">{title}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-gray-500">{description}</p>
        </div>
        <div className="flex-shrink-0">{control}</div>
      </div>
      {children && <div className="mt-3 pl-11">{children}</div>}
    </div>
  );
}

const timeAgo = (d) => {
  try {
    return formatDistanceToNow(typeof d === 'string' ? parseISO(d) : new Date(d), { addSuffix: true });
  } catch {
    return '';
  }
};

const daysLeft = (d) => {
  if (!d) return null;
  const ms = new Date(d).getTime() - Date.now();
  if (ms <= 0) return 'Closed';
  const h = ms / 3600000;
  return h < 24 ? `${Math.max(1, Math.round(h))}h left` : `${Math.ceil(h / 24)}d left`;
};

const ALERT_STYLES = {
  new_tender: { icon: Sparkles, cls: 'bg-emerald-50 text-emerald-700 ring-emerald-100', label: 'New tender' },
  new_tenders_digest: { icon: Layers, cls: 'bg-emerald-50 text-emerald-700 ring-emerald-100', label: 'New tenders' },
  deadline: { icon: Hourglass, cls: 'bg-amber-50 text-amber-700 ring-amber-100', label: 'Closing soon' },
  deadline_digest: { icon: Clock, cls: 'bg-amber-50 text-amber-700 ring-amber-100', label: 'Closing soon' },
};
const alertStyle = (t) => ALERT_STYLES[t] || { icon: Info, cls: 'bg-gray-100 text-gray-600 ring-gray-200', label: 'Update' };

const FEED_TABS = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'new', label: 'New tenders' },
  { key: 'closing', label: 'Closing soon' },
];

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function AlertsPage() {
  const navigate = useNavigate();

  // Settings
  const [settings, setSettings] = useState(null);
  const [savingKey, setSavingKey] = useState(null);
  const [categories, setCategories] = useState([]);
  const [browserOn, setBrowserOn] = useState(browserNotifyEnabled());
  const [permission, setPermission] = useState(browserNotifySupported() ? Notification.permission : 'unsupported');

  // Today
  const [scope, setScope] = useState('mine');
  const [today, setToday] = useState(null);
  const [todayLoading, setTodayLoading] = useState(true);

  // Feed
  const [tab, setTab] = useState('all');
  const [alerts, setAlerts] = useState([]);
  const [total, setTotal] = useState(0);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [feedLoading, setFeedLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  /* ---- loaders ---- */
  const loadSettings = useCallback(async () => {
    try {
      const [s, f] = await Promise.all([api.get('/alerts/settings'), api.get('/tenders/facets')]);
      setSettings(s.data);
      setCategories((f.data?.sectors || []).map((x) => x.sector));
    } catch {
      setSettings((prev) => prev || { notify_new_tenders: false, notify_deadlines: false, keyword_matches_only: true, alert_categories: [], deadline_reminder_days: 3 });
    }
  }, []);

  const loadToday = useCallback(async () => {
    setTodayLoading(true);
    try {
      const { data } = await api.get('/alerts/today', { params: { scope } });
      setToday(data);
    } catch {
      setToday(null);
    } finally {
      setTodayLoading(false);
    }
  }, [scope]);

  const loadFeed = useCallback(
    async (nextPage = 1) => {
      setFeedLoading(true);
      try {
        const params = { page: nextPage, page_size: 15 };
        if (tab === 'unread') params.is_read = false;
        if (tab === 'new' || tab === 'closing') params.alert_type = tab;
        const [list, unread] = await Promise.all([api.get('/alerts', { params }), api.get('/alerts/unread-count')]);
        setAlerts((prev) => (nextPage === 1 ? list.data.items : [...prev, ...list.data.items]));
        setTotal(list.data.total || 0);
        setPage(nextPage);
        setUnreadTotal(Number(unread.data?.unread || 0));
      } catch {
        if (nextPage === 1) setAlerts([]);
      } finally {
        setFeedLoading(false);
      }
    },
    [tab],
  );

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);
  useEffect(() => {
    loadToday();
  }, [loadToday]);
  useEffect(() => {
    loadFeed(1);
  }, [loadFeed]);

  /* ---- settings actions ---- */
  const saveSetting = async (patch, key, successMsg) => {
    setSavingKey(key);
    const prev = settings;
    setSettings((s) => ({ ...s, ...patch }));
    try {
      const { data } = await api.patch('/alerts/settings', patch);
      setSettings(data);
      if (successMsg) toast.success(successMsg);
      // Switching closing-soon on runs a check right away → refresh the feed and bell
      loadFeed(1);
      loadToday();
      notifyAlertsChanged();
    } catch (err) {
      setSettings(prev);
      toast.error(err instanceof Error ? err.message : 'Could not save the setting');
    } finally {
      setSavingKey(null);
    }
  };

  const toggleCategory = (cat) => {
    const current = settings?.alert_categories || [];
    const next = current.includes(cat) ? current.filter((c) => c !== cat) : [...current, cat];
    saveSetting({ alert_categories: next }, 'categories');
  };

  const enableBrowserNotifications = async () => {
    if (!browserNotifySupported()) return;
    let perm = Notification.permission;
    if (perm === 'default') perm = await Notification.requestPermission();
    setPermission(perm);
    if (perm === 'granted') {
      setBrowserNotifyEnabled(true);
      setBrowserOn(true);
      try {
        new Notification('TenderIQ notifications are on', {
          body: 'You will see new and closing-soon tender alerts here while TenderIQ is open.',
          icon: '/favicon.svg',
        });
      } catch {
        /* ignore */
      }
    } else {
      toast.error('Notifications are blocked in your browser settings');
    }
  };

  /* ---- feed actions ---- */
  const markRead = async (alert) => {
    if (alert.is_read) return;
    setAlerts((list) => list.map((a) => (a.id === alert.id ? { ...a, is_read: true } : a)));
    setUnreadTotal((n) => Math.max(0, n - 1));
    try {
      await api.patch(`/alerts/${alert.id}/read`);
      notifyAlertsChanged();
    } catch {
      /* best effort */
    }
  };

  const removeAlert = async (alert) => {
    setAlerts((list) => list.filter((a) => a.id !== alert.id));
    setTotal((n) => Math.max(0, n - 1));
    if (!alert.is_read) setUnreadTotal((n) => Math.max(0, n - 1));
    try {
      await api.post(`/alerts/${alert.id}/delete`);
      notifyAlertsChanged();
    } catch {
      loadFeed(1);
    }
  };

  const markAllRead = async () => {
    setMarkingAll(true);
    try {
      await api.post('/alerts/mark-all-read');
      setAlerts((list) => list.map((a) => ({ ...a, is_read: true })));
      setUnreadTotal(0);
      notifyAlertsChanged();
    } finally {
      setMarkingAll(false);
    }
  };

  const openAlert = (alert) => {
    markRead(alert);
    if (alert.tender_id) navigate(`/tenders/${alert.tender_id}`);
    else if (/digest/.test(alert.alert_type)) navigate('/tenders');
  };

  const anyOn = settings?.notify_new_tenders || settings?.notify_deadlines;
  const maxCat = Math.max(1, ...(today?.by_category || []).map((c) => c.count));

  /* ---------------------------------------------------------------- */
  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Alerts</h1>
          <p className="mt-1 text-sm text-gray-500">New tenders and closing deadlines, in one place.</p>
        </div>
        <div className="flex items-center gap-2">
          {unreadTotal > 0 && (
            <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
              {unreadTotal} unread
            </span>
          )}
          <Button variant="outline" size="sm" onClick={markAllRead} loading={markingAll} disabled={!unreadTotal}>
            <CheckCheck className="h-4 w-4" />
            Mark all read
          </Button>
        </div>
      </div>

      {/* Turn-on banner */}
      {settings && !anyOn && (
        <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm sm:flex-row sm:items-center">
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-brand-900 text-white">
            <BellRing className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900">Turn on tender alerts</p>
            <p className="text-sm text-gray-600">Get notified when new tenders are published and before matching tenders close.</p>
          </div>
          <Button
            variant="primary"
            size="sm"
            loading={savingKey === 'all'}
            onClick={() => saveSetting({ notify_new_tenders: true, notify_deadlines: true }, 'all', 'Alerts turned on')}
          >
            <Bell className="h-4 w-4" />
            Turn on alerts
          </Button>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        {/* ---------------- Left column ---------------- */}
        <div className="min-w-0 space-y-6">
          {/* Today's new tenders */}
          <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <header className="flex flex-wrap items-center gap-3 border-b border-gray-100 px-5 py-4">
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-gray-900">Today's new tenders</h2>
                <p className="text-xs text-gray-500">{formatDate(new Date().toISOString(), 'EEEE, d MMMM yyyy')}</p>
              </div>
              <div className="ml-auto flex rounded-lg bg-gray-100 p-0.5 text-xs font-medium">
                {[
                  ['mine', 'Matching my alerts'],
                  ['all', 'All tenders'],
                ].map(([k, l]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setScope(k)}
                    className={clsx(
                      'rounded-md px-3 py-1.5 transition-colors',
                      scope === k ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700',
                    )}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </header>

            {todayLoading && !today ? (
              <div className="flex items-center justify-center gap-2 py-14 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading today's tenders…
              </div>
            ) : !today ? (
              <div className="py-12 text-center text-sm text-gray-500">Couldn't load today's tenders.</div>
            ) : (
              <div className={clsx('transition-opacity', todayLoading && 'opacity-60')}>
                <div className="grid gap-5 px-5 py-5 md:grid-cols-[200px_minmax(0,1fr)]">
                  <div className="flex gap-6 md:flex-col md:gap-4">
                    <div>
                      <p className="font-serif text-4xl font-semibold text-gray-900">{today.total.toLocaleString('en-IN')}</p>
                      <p className="text-xs text-gray-500">new {scope === 'mine' ? 'matching your alerts' : 'tenders'} today</p>
                    </div>
                    <div>
                      <p className="font-serif text-2xl font-semibold text-amber-700">{today.closing_within_3_days.toLocaleString('en-IN')}</p>
                      <p className="text-xs text-gray-500">of them close within 3 days</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {today.by_category.length === 0 && <p className="text-sm text-gray-500">No categories yet today.</p>}
                    {today.by_category.map((c) => (
                      <Link
                        key={c.category}
                        to={`/tenders?category=${encodeURIComponent(c.category)}`}
                        className="group flex items-center gap-3 text-sm"
                      >
                        <span className="w-28 flex-shrink-0 truncate text-gray-700 group-hover:text-brand-700">{c.category}</span>
                        <span className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                          <span className="block h-full rounded-full bg-brand-600" style={{ width: `${(c.count / maxCat) * 100}%` }} />
                        </span>
                        <span className="w-12 flex-shrink-0 text-right text-xs font-medium text-gray-600">{c.count.toLocaleString('en-IN')}</span>
                      </Link>
                    ))}
                  </div>
                </div>

                <ul className="divide-y divide-gray-100 border-t border-gray-100">
                  {today.items.slice(0, 8).map((t) => (
                    <li key={t.id}>
                      <Link to={`/tenders/${t.id}`} className="flex items-start gap-3 px-5 py-3 transition-colors hover:bg-gray-50">
                        <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-emerald-500" />
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-1 text-sm font-medium text-gray-900">{t.title}</p>
                          <p className="mt-0.5 truncate text-xs text-gray-500">
                            {[t.source, t.organization].filter(Boolean).join(' · ')}
                          </p>
                          {t.categories.length > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {t.categories.slice(0, 3).map((c) => (
                                <span key={c} className="rounded bg-brand-50 px-1.5 py-0.5 text-[11px] font-medium text-brand-700">
                                  {c}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        {daysLeft(t.deadline) && (
                          <span
                            className={clsx(
                              'flex-shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold',
                              /h left|^1d|^2d|^3d/.test(daysLeft(t.deadline)) ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-600',
                            )}
                          >
                            {daysLeft(t.deadline)}
                          </span>
                        )}
                      </Link>
                    </li>
                  ))}
                  {today.items.length === 0 && (
                    <li className="px-5 py-8 text-center text-sm text-gray-500">
                      {scope === 'mine' ? 'No new tenders match your alerts yet today.' : 'No new tenders yet today.'}
                    </li>
                  )}
                </ul>
                {today.total > 8 && (
                  <div className="border-t border-gray-100 px-5 py-3 text-right">
                    <Link to="/tenders" className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:text-brand-800">
                      See all new tenders <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Alerts feed */}
          <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <header className="flex flex-wrap items-center gap-3 border-b border-gray-100 px-5 py-3">
              <h2 className="text-base font-semibold text-gray-900">Your alerts</h2>
              <div className="scrollbar-none -mb-3 ml-auto flex gap-4 overflow-x-auto text-sm">
                {FEED_TABS.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setTab(t.key)}
                    className={clsx(
                      'whitespace-nowrap border-b-2 pb-3 font-medium transition-colors',
                      tab === t.key ? 'border-brand-700 text-brand-800' : 'border-transparent text-gray-500 hover:text-gray-700',
                    )}
                  >
                    {t.label}
                    {t.key === 'unread' && unreadTotal > 0 && (
                      <span className="ml-1.5 rounded-full bg-brand-700 px-1.5 text-[10px] font-semibold text-white">{unreadTotal}</span>
                    )}
                  </button>
                ))}
              </div>
            </header>

            {feedLoading && alerts.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-14 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading alerts…
              </div>
            ) : alerts.length === 0 ? (
              <div className="flex flex-col items-center px-6 py-14 text-center">
                <BellOff className="mb-3 h-10 w-10 text-gray-300" />
                <p className="text-sm font-medium text-gray-700">{tab === 'unread' ? "You're all caught up" : 'No alerts yet'}</p>
                <p className="mt-1 max-w-sm text-sm text-gray-500">
                  {anyOn
                    ? 'New tender alerts are checked every 15 minutes; closing-soon alerts every morning at 8 AM.'
                    : 'Turn on alerts in Notification settings to start receiving them.'}
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {alerts.map((a) => {
                  const st = alertStyle(a.alert_type);
                  const Icon = st.icon;
                  return (
                    <li key={a.id} className={clsx('group relative flex gap-3 px-5 py-4 transition-colors hover:bg-gray-50', !a.is_read && 'bg-brand-50/30')}>
                      {!a.is_read && <span className="absolute left-1.5 top-6 h-1.5 w-1.5 rounded-full bg-brand-700" aria-label="Unread" />}
                      <span className={clsx('flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ring-1', st.cls)}>
                        <Icon className="h-[18px] w-[18px]" />
                      </span>
                      <button type="button" onClick={() => openAlert(a)} className="min-w-0 flex-1 text-left">
                        <p className="flex flex-wrap items-center gap-x-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                          {st.label}
                          <span className="font-normal normal-case tracking-normal text-gray-400">· {timeAgo(a.created_at)}</span>
                        </p>
                        <p className={clsx('mt-0.5 text-sm', a.is_read ? 'text-gray-700' : 'font-semibold text-gray-900')}>{a.message}</p>
                        {a.tender_reference && (
                          <p className="mt-1 truncate font-mono text-xs text-gray-500">
                            {a.tender_reference}
                            {a.tender_source && ` · ${a.tender_source}`}
                            {a.tender_deadline && ` · ${daysLeft(a.tender_deadline)}`}
                          </p>
                        )}
                        {!a.tender_id && (a.alert_type === 'new_tenders_digest' || a.alert_type === 'deadline_digest') && (
                          <span className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-brand-700">
                            View tenders <ArrowRight className="h-3.5 w-3.5" />
                          </span>
                        )}
                      </button>
                      <div className="flex flex-shrink-0 items-start gap-1 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
                        {!a.is_read && (
                          <button
                            type="button"
                            onClick={() => markRead(a)}
                            className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                            aria-label="Mark as read"
                            title="Mark as read"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => removeAlert(a)}
                          className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                          aria-label="Delete alert"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            {alerts.length < total && (
              <div className="border-t border-gray-100 px-5 py-3 text-center">
                <Button variant="ghost" size="sm" onClick={() => loadFeed(page + 1)} loading={feedLoading}>
                  Load more
                </Button>
              </div>
            )}
          </section>
        </div>

        {/* ---------------- Right column: settings ---------------- */}
        <aside className="min-w-0">
          <section className="rounded-xl border border-gray-200 bg-white shadow-sm xl:sticky xl:top-2">
            <header className="flex items-center gap-2 border-b border-gray-100 px-5 py-4">
              <Bell className="h-[18px] w-[18px] text-gray-500" />
              <h2 className="text-base font-semibold text-gray-900">Notification settings</h2>
              {savingKey && <Loader2 className="ml-auto h-4 w-4 animate-spin text-gray-400" />}
            </header>

            {!settings ? (
              <div className="flex items-center justify-center py-10 text-gray-400">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : (
              <div className="divide-y divide-gray-100 px-5 py-4">
                <SettingRow
                  icon={Sparkles}
                  title="New tender alerts"
                  description="When new tenders matching your filters are published. Checked every 15 minutes."
                  control={
                    <Switch
                      label="New tender alerts"
                      checked={settings.notify_new_tenders}
                      disabled={!!savingKey}
                      onChange={(v) => saveSetting({ notify_new_tenders: v }, 'new', v ? 'New tender alerts on' : 'New tender alerts off')}
                    />
                  }
                />

                <SettingRow
                  icon={Hourglass}
                  title="Closing-soon alerts"
                  description="Before tenders matching your filters close. Sent each morning at 8 AM."
                  control={
                    <Switch
                      label="Closing-soon alerts"
                      checked={settings.notify_deadlines}
                      disabled={!!savingKey}
                      onChange={(v) => saveSetting({ notify_deadlines: v }, 'deadline', v ? 'Closing-soon alerts on' : 'Closing-soon alerts off')}
                    />
                  }
                >
                  <div className={clsx('flex items-center gap-2', !settings.notify_deadlines && 'opacity-50')}>
                    <span className="text-xs text-gray-500">Remind me</span>
                    <div className="flex rounded-lg border border-gray-200 p-0.5 text-xs font-medium">
                      {[1, 3, 7].map((d) => (
                        <button
                          key={d}
                          type="button"
                          disabled={!settings.notify_deadlines || !!savingKey}
                          onClick={() => saveSetting({ deadline_reminder_days: d }, 'days')}
                          className={clsx(
                            'rounded-md px-2.5 py-1 transition-colors',
                            settings.deadline_reminder_days === d ? 'bg-brand-700 text-white' : 'text-gray-600 hover:bg-gray-100',
                          )}
                        >
                          {d} day{d > 1 ? 's' : ''}
                        </button>
                      ))}
                    </div>
                    <span className="text-xs text-gray-500">before</span>
                  </div>
                </SettingRow>

                <SettingRow
                  icon={FileText}
                  title="Only tenders matching my keywords"
                  description="Off = every tender in the categories you pick below."
                  control={
                    <Switch
                      label="Only keyword matches"
                      checked={settings.keyword_matches_only}
                      disabled={!!savingKey}
                      onChange={(v) => saveSetting({ keyword_matches_only: v }, 'keywords')}
                    />
                  }
                >
                  <Link to="/admin/keywords" className="text-xs font-medium text-brand-700 hover:underline">
                    Manage keywords
                  </Link>
                </SettingRow>

                <SettingRow
                  icon={Layers}
                  title="Categories"
                  description={
                    settings.alert_categories.length
                      ? `Alerts for ${settings.alert_categories.length} selected categor${settings.alert_categories.length === 1 ? 'y' : 'ies'}.`
                      : 'All categories. Tap to choose specific ones.'
                  }
                  control={null}
                >
                  <div className="flex flex-wrap gap-1.5">
                    {categories.map((c) => {
                      const on = settings.alert_categories.includes(c);
                      return (
                        <button
                          key={c}
                          type="button"
                          disabled={!!savingKey}
                          onClick={() => toggleCategory(c)}
                          className={clsx(
                            'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                            on ? 'border-brand-700 bg-brand-700 text-white' : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50',
                          )}
                        >
                          {on && <Check className="-ml-0.5 mr-1 inline h-3 w-3" />}
                          {c}
                        </button>
                      );
                    })}
                    {settings.alert_categories.length > 0 && (
                      <button
                        type="button"
                        onClick={() => saveSetting({ alert_categories: [] }, 'categories')}
                        className="rounded-full px-2.5 py-1 text-xs font-medium text-gray-500 hover:text-gray-800"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </SettingRow>

                <SettingRow
                  icon={Monitor}
                  title="Browser notifications"
                  description={
                    permission === 'unsupported'
                      ? "This browser doesn't support notifications."
                      : permission === 'denied'
                        ? 'Blocked in this browser. Allow notifications for this site in the browser settings.'
                        : 'Pop-up notifications on this device while TenderIQ is open.'
                  }
                  control={
                    permission === 'granted' ? (
                      <Switch
                        label="Browser notifications"
                        checked={browserOn}
                        onChange={(v) => {
                          setBrowserNotifyEnabled(v);
                          setBrowserOn(v);
                        }}
                      />
                    ) : permission === 'default' ? (
                      <Button variant="outline" size="sm" onClick={enableBrowserNotifications}>
                        Enable
                      </Button>
                    ) : permission === 'denied' ? (
                      <AlertTriangle className="h-5 w-5 text-amber-500" />
                    ) : null
                  }
                />
              </div>
            )}
            <footer className="flex items-center justify-between gap-3 border-t border-gray-100 px-5 py-3">
              <p className="text-xs text-gray-500">Settings save automatically.</p>
              <button
                type="button"
                onClick={() => {
                  loadToday();
                  loadFeed(1);
                  notifyAlertsChanged();
                }}
                className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:text-brand-800"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Refresh
              </button>
            </footer>
          </section>
        </aside>
      </div>
    </div>
  );
}
