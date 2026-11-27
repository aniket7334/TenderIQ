import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import {
  AlertTriangle,
  Bell,
  Check,
  FileText,
  Hourglass,
  Layers,
  Loader2,
  Monitor,
  Sparkles,
  UserRound,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import api from '@/lib/api';
import useAuth from '@/hooks/useAuth';
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
    <div className="py-5 first:pt-0 last:pb-0">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-gray-200 text-gray-500">
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

function Panel({ icon: Icon, title, subtitle, right, children, footer }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white">
      <header className="flex items-start gap-3 border-b border-gray-100 px-5 py-4">
        <Icon className="mt-0.5 h-[18px] w-[18px] flex-shrink-0 text-gray-500" />
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>}
        </div>
        {right}
      </header>
      {children}
      {footer}
    </section>
  );
}

const ROLE_LABELS = { admin: 'Admin', manager: 'Manager', analyst: 'Analyst', viewer: 'Viewer' };

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function SettingsPage() {
  const user = useAuth((s) => s.user);

  const [settings, setSettings] = useState(null);
  const [savingKey, setSavingKey] = useState(null);
  const [categories, setCategories] = useState([]);
  const [browserOn, setBrowserOn] = useState(browserNotifyEnabled());
  const [permission, setPermission] = useState(browserNotifySupported() ? Notification.permission : 'unsupported');

  const loadSettings = useCallback(async () => {
    try {
      const [s, f] = await Promise.all([api.get('/alerts/settings'), api.get('/tenders/facets')]);
      setSettings(s.data);
      setCategories((f.data?.sectors || []).map((x) => x.sector));
    } catch {
      setSettings((prev) => prev || { notify_new_tenders: false, notify_deadlines: false, keyword_matches_only: true, alert_categories: [], deadline_reminder_days: 3 });
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const saveSetting = async (patch, key, successMsg) => {
    setSavingKey(key);
    const prev = settings;
    setSettings((s) => ({ ...s, ...patch }));
    try {
      const { data } = await api.patch('/alerts/settings', patch);
      setSettings(data);
      if (successMsg) toast.success(successMsg);
      // e.g. switching closing-soon on runs a check right away → refresh the bell
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

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-16">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">Your account and how TenderIQ notifies you.</p>
      </div>

      {/* Account */}
      <Panel icon={UserRound} title="Account">
        <dl className="grid gap-4 px-5 py-4 sm:grid-cols-3">
          <div className="min-w-0">
            <dt className="text-xs text-gray-500">Name</dt>
            <dd className="mt-0.5 truncate text-sm font-medium text-gray-900">{(user?.full_name || user?.fullName) || '—'}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs text-gray-500">Email</dt>
            <dd className="mt-0.5 truncate text-sm font-medium text-gray-900">{user?.email || '—'}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs text-gray-500">Role</dt>
            <dd className="mt-0.5 text-sm font-medium text-gray-900">{ROLE_LABELS[user?.role] || user?.role || '—'}</dd>
          </div>
        </dl>
      </Panel>

      {/* Notifications */}
      <Panel
        icon={Bell}
        title="Notification settings"
        subtitle="Choose which tender alerts you get. Your alerts appear on the Alerts page and the bell."
        right={savingKey && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
        footer={
          <footer className="flex items-center justify-between gap-3 border-t border-gray-100 px-5 py-3">
            <p className="text-xs text-gray-500">Settings save automatically.</p>
            <Link to="/alerts" className="text-xs font-medium text-brand-700 hover:text-brand-900">
              Go to Alerts
            </Link>
          </footer>
        }
      >
        {!settings ? (
          <div className="flex items-center justify-center py-12 text-gray-400">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <div className="divide-y divide-gray-100 px-5 py-5">
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
              <div className={clsx('flex flex-wrap items-center gap-2', !settings.notify_deadlines && 'opacity-50')}>
                <span className="text-xs text-gray-500">Remind me</span>
                {/* Day buttons + "before" stay together when the line wraps on phones */}
                <span className="flex items-center gap-2">
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
                </span>
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
                  <AlertTriangle className="h-5 w-5 text-gray-400" />
                ) : null
              }
            />
          </div>
        )}
      </Panel>
    </div>
  );
}
